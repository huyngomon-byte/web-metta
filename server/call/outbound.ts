import { adminDb } from '../../api/_firebaseAdmin.js';
import { ApiError, requireApiUser } from '../../api/_apiAuth.js';
import { normalizePhone, stringeePccAgentByUserId, stringeePccCallout, stringeePhoneBridgeCallout } from '../../api/_stringee.js';
import { acquireCallLock, CallLockBusyError, releaseCallLock, updateCallLock } from './lock.js';

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

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_STRINGEE_FROM_NUMBER = '842488921797';

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
  const timestamp = new Date().toISOString();
  const status = String(data.status || 'ringing');
  const startedAt = String(data.startedAt || timestamp);
  await db.collection('callLogs').doc(providerCallId).set(stripUndefined({
    id: providerCallId,
    provider: 'stringee',
    direction: 'outbound',
    status,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...data,
    callStatus: data.callStatus || data.status || status,
    startTime: data.startTime || data.startedAt || startedAt,
  }), { merge: true }).catch(() => {});
}

function assignmentExpired(lead: Record<string, any>, nowMs = Date.now()) {
  if (!lead.assignedTo || lead.assignedStatus === 'returned') return true;
  if (lead.assignedStatus === 'accepted') return false;
  const assignedAtMs = Number(lead.assignedAtMs || 0);
  return Boolean(assignedAtMs) && nowMs - assignedAtMs >= DAY_MS;
}

async function leadForCall(db: ReturnType<typeof adminDb>, leadId: string) {
  if (!leadId) throw new ApiError(400, 'Missing leadId for outbound call');
  const snap = await db.collection('leads').doc(leadId).get();
  if (!snap.exists) throw new ApiError(404, 'Lead not found');
  return { id: snap.id, ...(snap.data() || {}) } as Record<string, any>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const db = adminDb();
  const user = await requireApiUser(db, req).catch((error) => {
    if (error instanceof ApiError) return error;
    return new ApiError(401, 'Invalid Firebase ID token');
  });
  if (user instanceof ApiError) return res.status(user.status).json({ error: user.message });
  if (!['admin', 'manager', 'sales'].includes(user.role)) {
    return res.status(403).json({ error: 'Only Admin, Manager or Sales can start outbound calls' });
  }

  const crmUserId = String(req.body?.crmUserId || user.id).trim();
  if (crmUserId !== user.id && user.role !== 'admin') {
    return res.status(403).json({ error: 'Cannot start call for another user' });
  }

  const lead = await leadForCall(db, String(req.body?.leadId || '').trim()).catch((error) => error);
  if (lead instanceof ApiError) return res.status(lead.status).json({ error: lead.message });
  if (lead instanceof Error) return res.status(500).json({ error: lead.message });
  if (user.role === 'sales' && (lead.assignedTo !== user.id || assignmentExpired(lead))) {
    return res.status(403).json({ error: 'Sales can only call active leads assigned to them' });
  }

  const customerNumber = normalizePhone(String(lead.phone || req.body?.phone || req.body?.customerNumber || ''));
  if (!customerNumber) return res.status(400).json({ error: 'Lead phone is required' });

  const config = await settings(db);
  const fromNumber = normalizePhone(String(config.fromNumber || process.env.STRINGEE_FROM_NUMBER || DEFAULT_STRINGEE_FROM_NUMBER));
  const fallbackCrmId = process.env.CALL_FALLBACK_AGENT_ID || config.fallbackAgentId || '';
  const requestedMapping = mappingForCrm(crmUserId, config);
  const fallbackMapping = fallbackCrmId ? mappingForCrm(fallbackCrmId, config) : undefined;
  const routedCrmId = requestedMapping?.crmUserId || fallbackMapping?.crmUserId || crmUserId;
  const stringeeUserId = requestedMapping?.stringeeUserId || fallbackMapping?.stringeeUserId || crmUserId;
  if (!stringeeUserId) return res.status(400).json({ error: 'Missing Stringee user mapping for this CRM user' });

  const requestedCallId = String(req.body?.providerCallId || '').trim();
  const providerCallId = requestedCallId || `pcc-out-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const leadName = String(req.body?.leadName || lead.studentName || lead.parentName || lead.fullName || '').trim();
  const agentName = String(
    req.body?.agentName || mappedCrmName(crmUserId, config) || user.fullName || crmUserId,
  ).trim();
  const routedAgentName = String(
    requestedMapping?.crmName || fallbackMapping?.crmName || (fallbackMapping ? config.fallbackAgentName : '') || routedCrmId,
  ).trim();

  let lockAcquired = false;
  try {
    await acquireCallLock(db, {
      providerCallId,
      clientCallId: providerCallId,
      agentId: crmUserId,
      agentName,
      stringeeAgentId: stringeeUserId,
      routedAgentId: routedCrmId,
      routedAgentName,
      leadId: lead.id,
      leadName,
      customerNumber,
      fromNumber,
      callStatus: 'ringing',
    });
    lockAcquired = true;

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
    const startedAt = new Date().toISOString();

    await updateCallLock(db, {
      providerCallId: logId,
      clientCallId: providerCallId,
      stringeeCallId,
      calloutMode,
      startedAt,
    });

    await writeInitialLog(db, {
      providerCallId: logId,
      clientCallId: providerCallId,
      stringeeCallId,
      leadId: lead.id,
      leadName,
      agentId: crmUserId,
      saleId: crmUserId,
      agentName,
      stringeeAgentId: stringeeUserId,
      routedAgentId: routedCrmId,
      routedAgentName,
      agentPhoneNumber,
      fromNumber,
      toNumber: customerNumber,
      customerNumber,
      customerId: lead.id,
      startedAt,
      startTime: startedAt,
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
    if (error instanceof CallLockBusyError) {
      return res.status(error.status).json({ error: error.message, lock: error.lock });
    }
    if (lockAcquired) {
      await releaseCallLock(db, providerCallId, {
        releaseReason: 'callout_failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await writeInitialLog(db, {
      providerCallId,
      status: 'failed',
      leadId: lead.id,
      leadName,
      agentId: crmUserId,
      saleId: crmUserId,
      agentName,
      stringeeAgentId: stringeeUserId,
      routedAgentId: routedCrmId,
      routedAgentName,
      fromNumber,
      toNumber: customerNumber,
      customerNumber,
      customerId: lead.id,
      startedAt: new Date().toISOString(),
      startTime: new Date().toISOString(),
      endedAt: new Date().toISOString(),
      stopTime: new Date().toISOString(),
      callStatus: 'failed',
      rawEvent: {
        type: 'pcc_callout_failed',
        fallbackUsed: !requestedMapping && Boolean(fallbackMapping),
        error: error instanceof Error ? error.message : String(error),
      },
    });
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Cannot start PCC callout' });
  }
}
