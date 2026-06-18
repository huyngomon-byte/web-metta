import { adminAuth, adminDb } from '../../api/_firebaseAdmin.js';
import { normalizePhone, stringeePccAgentByUserId, stringeePccCallout, stringeePhoneBridgeCallout } from '../../api/_stringee.js';

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

type CallSettings = {
  fromNumber?: string;
  fallbackAgentId?: string;
  fallbackAgentName?: string;
  userMappings?: Array<{
    crmUserId: string;
    crmName?: string;
    stringeeUserId: string;
    active?: boolean;
    agentPhoneNumber?: string;
    routingType?: 1 | 2;
    answerTimeoutSec?: number;
  }>;
};

function bearerToken(req: VercelRequest) {
  const value = req.headers.authorization || req.headers.Authorization;
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.replace(/^Bearer\s+/i, '').trim() || '';
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripUndefined(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, stripUndefined(item)]),
    ) as T;
  }
  return value;
}

async function settings(db: ReturnType<typeof adminDb>): Promise<CallSettings> {
  const snap = await db.collection('callCenterSettings').doc('stringee').get().catch(() => null);
  return snap?.exists ? snap.data() as CallSettings : {};
}

function mappingForCrm(crmUserId: string, config: CallSettings) {
  return config.userMappings?.find((item) => item.crmUserId === crmUserId && item.active !== false);
}

function mappedCrmName(crmUserId: string, config: CallSettings) {
  return config.userMappings?.find((item) => item.crmUserId === crmUserId && item.active !== false)?.crmName || '';
}

async function resolveAgentPhone(stringeeUserId: string, mapping?: NonNullable<CallSettings['userMappings']>[number]) {
  const configuredPhone = normalizePhone(mapping?.agentPhoneNumber || '');
  if (configuredPhone) return configuredPhone;
  const agent = await stringeePccAgentByUserId(stringeeUserId).catch(() => null);
  const routingType = Number(agent?.routing_type);
  const agentPhone = normalizePhone(String(agent?.phone_number || ''));
  return routingType === 2 && agentPhone ? agentPhone : '';
}

async function writeInitialLog(db: ReturnType<typeof adminDb>, data: Record<string, unknown>) {
  const providerCallId = String(data.providerCallId || `pcc-out-${Date.now()}`);
  await db.collection('callLogs').doc(providerCallId).set(stripUndefined({
    id: providerCallId,
    provider: 'stringee',
    direction: 'outbound',
    status: 'ringing',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...data,
  }), { merge: true }).catch(() => {});
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing Firebase ID token' });

  const decoded = await adminAuth().verifyIdToken(token).catch(() => null);
  if (!decoded?.uid) return res.status(401).json({ error: 'Invalid Firebase ID token' });

  const crmUserId = String(req.body?.crmUserId || decoded.uid).trim();
  if (crmUserId !== decoded.uid && decoded.role !== 'admin') {
    return res.status(403).json({ error: 'Cannot start call for another user' });
  }

  const customerNumber = normalizePhone(String(req.body?.phone || req.body?.customerNumber || ''));
  if (!customerNumber) return res.status(400).json({ error: 'Lead phone is required' });

  const db = adminDb();
  const config = await settings(db);
  const fromNumber = normalizePhone(String(config.fromNumber || process.env.STRINGEE_FROM_NUMBER || '842471058267'));
  const fallbackCrmId = process.env.CALL_FALLBACK_AGENT_ID || config.fallbackAgentId || '';
  const requestedMapping = mappingForCrm(crmUserId, config);
  const fallbackMapping = fallbackCrmId ? mappingForCrm(fallbackCrmId, config) : undefined;
  const routedCrmId = requestedMapping?.crmUserId || fallbackMapping?.crmUserId || crmUserId;
  const stringeeUserId = requestedMapping?.stringeeUserId || fallbackMapping?.stringeeUserId || crmUserId;
  if (!stringeeUserId) return res.status(400).json({ error: 'Missing Stringee user mapping for this CRM user' });

  const requestedCallId = String(req.body?.providerCallId || '').trim();
  const providerCallId = requestedCallId || `pcc-out-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const leadName = String(req.body?.leadName || '').trim();
  const agentName = String(
    req.body?.agentName || mappedCrmName(crmUserId, config) || crmUserId,
  ).trim();
  const routedAgentName = String(
    requestedMapping?.crmName || fallbackMapping?.crmName || (fallbackMapping ? config.fallbackAgentName : '') || routedCrmId,
  ).trim();

  try {
    const agentPhoneNumber = await resolveAgentPhone(stringeeUserId, requestedMapping || fallbackMapping);
    const result = agentPhoneNumber
      ? await stringeePhoneBridgeCallout({
        agentPhoneNumber,
        customerNumber,
        fromNumber,
      })
      : await stringeePccCallout({
        agentUserId: stringeeUserId,
        customerNumber,
        fromNumber,
        toAgentFromNumberDisplay: `Call-out-from-${fromNumber}`,
        toAgentFromNumberDisplayAlias: `Call-out-from-${fromNumber}-Alias`,
      });

    const stringeeCallId = String(result.payload?.callId || '').trim();
    const logId = stringeeCallId || providerCallId;
    const calloutMode = agentPhoneNumber ? 'phone_bridge' : 'pcc_app_sip';

    await writeInitialLog(db, {
      providerCallId: logId,
      clientCallId: providerCallId,
      stringeeCallId,
      leadId: req.body?.leadId || '',
      leadName,
      agentId: crmUserId,
      agentName,
      stringeeAgentId: stringeeUserId,
      routedAgentId: routedCrmId,
      routedAgentName,
      agentPhoneNumber,
      fromNumber,
      toNumber: customerNumber,
      customerNumber,
      startedAt: new Date().toISOString(),
      rawEvent: {
        type: agentPhoneNumber ? 'phone_bridge_callout_requested' : 'pcc_callout_requested',
        calloutMode,
        fallbackUsed: !requestedMapping && Boolean(fallbackMapping),
        stringeeResponse: result.payload,
        request: result.request,
      },
    });

    return res.status(200).json({
      ok: true,
      providerCallId: logId,
      clientCallId: providerCallId,
      stringeeCallId,
      userId: stringeeUserId,
      mode: calloutMode,
      message: result.payload?.message || 'PCC callout requested',
    });
  } catch (error) {
    await writeInitialLog(db, {
      providerCallId,
      status: 'failed',
      leadId: req.body?.leadId || '',
      leadName,
      agentId: crmUserId,
      agentName,
      stringeeAgentId: stringeeUserId,
      routedAgentId: routedCrmId,
      routedAgentName,
      fromNumber,
      toNumber: customerNumber,
      customerNumber,
      startedAt: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      rawEvent: {
        type: 'pcc_callout_failed',
        fallbackUsed: !requestedMapping && Boolean(fallbackMapping),
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Cannot start PCC callout' });
  }
}
