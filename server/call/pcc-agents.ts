import { adminDb } from '../../api/_firebaseAdmin.js';
import { normalizePhone, stringeePccAgentByUserId, verifyStringeeSignature } from '../../api/_stringee.js';

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
  query?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

type LeadDoc = {
  id: string;
  phone?: string;
  fullName?: string;
  parentName?: string;
  studentName?: string;
  assignedTo?: string;
  assignedToName?: string;
};

type CallSettings = {
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

type PccCall = {
  callId?: string;
  from?: string;
  to?: string;
};

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function field(req: VercelRequest, key: string) {
  return first(req.query?.[key]) || req.body?.[key] || '';
}

async function settings(db: ReturnType<typeof adminDb>): Promise<CallSettings> {
  const snap = await db.collection('callCenterSettings').doc('stringee').get().catch(() => null);
  return snap?.exists ? snap.data() as CallSettings : {};
}

async function findLeadByPhone(db: ReturnType<typeof adminDb>, phone: string) {
  const target = normalizePhone(phone);
  if (!target) return null;
  const snap = await db.collection('leads').limit(1000).get();
  return snap.docs
    .map((item) => ({ id: item.id, ...item.data() }) as LeadDoc)
    .find((lead) => normalizePhone(lead.phone) === target) || null;
}

function mappingForCrm(crmUserId: string, config: CallSettings) {
  return config.userMappings?.find((item) => item.crmUserId === crmUserId && item.active !== false);
}

async function agentOnline(db: ReturnType<typeof adminDb>, crmUserId?: string) {
  if (!crmUserId) return false;
  const snap = await db.collection('agentPresence').doc(crmUserId).get().catch(() => null);
  const data = snap?.exists ? snap.data() : null;
  if (!data?.online) return false;
  const lastSeenMs = new Date(String(data.lastSeenAt || '')).getTime();
  return Number.isFinite(lastSeenMs) && Date.now() - lastSeenMs < 2 * 60 * 1000;
}

function leadName(lead?: LeadDoc | null) {
  return String(lead?.studentName || lead?.parentName || lead?.fullName || lead?.phone || '').trim();
}

async function pccAgent(mapping: NonNullable<ReturnType<typeof mappingForCrm>>) {
  const stringeeAgent = await stringeePccAgentByUserId(mapping.stringeeUserId).catch(() => null);
  const stringeeRoutingType = Number(stringeeAgent?.routing_type);
  const routingType = (mapping.routingType || (stringeeRoutingType === 2 ? 2 : 1)) as 1 | 2;
  const phoneNumber = normalizePhone(mapping.agentPhoneNumber || String(stringeeAgent?.phone_number || ''));
  const agent: Record<string, unknown> = {
    stringee_user_id: mapping.stringeeUserId,
    routing_type: routingType,
    answer_timeout: mapping.answerTimeoutSec || 15,
  };
  if (phoneNumber) agent.phone_number = phoneNumber;
  return agent;
}

function callsFromRequest(req: VercelRequest): PccCall[] {
  const bodyCalls = Array.isArray(req.body?.calls) ? req.body.calls : [];
  if (bodyCalls.length) return bodyCalls as PccCall[];
  const callId = String(field(req, 'callId') || field(req, 'call_id') || `call-${Date.now()}`);
  return [{
    callId,
    from: String(field(req, 'from') || field(req, 'fromNumber') || ''),
    to: String(field(req, 'to') || field(req, 'toNumber') || ''),
  }];
}

async function writeInboundLog(db: ReturnType<typeof adminDb>, data: Record<string, unknown>) {
  const providerCallId = String(data.providerCallId || `pcc-in-${Date.now()}`);
  const timestamp = new Date().toISOString();
  const startedAt = String(data.startedAt || timestamp);
  await db.collection('callLogs').doc(providerCallId).set({
    id: providerCallId,
    provider: 'stringee',
    direction: 'inbound',
    status: 'ringing',
    createdAt: timestamp,
    updatedAt: timestamp,
    ...data,
    callStatus: data.callStatus || 'ringing',
    startTime: data.startTime || data.startedAt || startedAt,
  }, { merge: true }).catch(() => {});
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!verifyStringeeSignature(req)) return res.status(401).json({ error: 'Invalid Stringee signature' });

  const db = adminDb();
  const config = await settings(db);
  const fallbackCrmId = process.env.CALL_FALLBACK_AGENT_ID || config.fallbackAgentId || '';
  const fallbackMapping = fallbackCrmId
    ? mappingForCrm(fallbackCrmId, config) || {
      crmUserId: fallbackCrmId,
      crmName: config.fallbackAgentName || fallbackCrmId,
      stringeeUserId: fallbackCrmId,
      active: true,
    }
    : undefined;

  const responseCalls = await Promise.all(callsFromRequest(req).map(async (call) => {
    const customerNumber = normalizePhone(call.from || '');
    const lead = await findLeadByPhone(db, customerNumber);
    const assignedCrmId = lead?.assignedTo || '';
    const assignedPresenceOnline = await agentOnline(db, assignedCrmId);
    const assignedMapping = assignedCrmId ? mappingForCrm(assignedCrmId, config) : undefined;
    const onlineAssignedMapping = assignedPresenceOnline ? assignedMapping : undefined;
    const targetCrmId = onlineAssignedMapping?.crmUserId || fallbackMapping?.crmUserId || '';
    const targetMapping = onlineAssignedMapping || fallbackMapping;
    const agentEntries = await Promise.all(
      [targetMapping, fallbackMapping]
        .filter((mapping, index, items): mapping is NonNullable<typeof targetMapping> =>
          Boolean(mapping?.stringeeUserId && items.findIndex((item) => item?.stringeeUserId === mapping.stringeeUserId) === index),
        )
        .map((mapping) => pccAgent(mapping)),
    );

    await writeInboundLog(db, {
      providerCallId: call.callId || `pcc-in-${Date.now()}`,
      leadId: lead?.id || '',
      leadName: leadName(lead),
      agentId: targetCrmId,
      saleId: targetCrmId,
      agentName: targetCrmId === assignedCrmId ? lead?.assignedToName || targetMapping?.crmName || targetCrmId : fallbackMapping?.crmName || config.fallbackAgentName || fallbackCrmId,
      fromNumber: customerNumber,
      toNumber: normalizePhone(call.to || process.env.STRINGEE_FROM_NUMBER || ''),
      customerNumber,
      customerId: lead?.id || '',
      startedAt: new Date().toISOString(),
      rawEvent: {
        type: 'pcc_get_list_agents',
        queueId: req.body?.queueId || field(req, 'queueId'),
        projectId: req.body?.projectId || field(req, 'projectId'),
        leadMatched: Boolean(lead),
        assignedCrmId,
        assignedPresenceOnline,
        assignedMappingReturned: Boolean(onlineAssignedMapping),
      },
    });

    return {
      callId: call.callId,
      agents: agentEntries,
    };
  }));

  return res.status(200).json({
    version: 2,
    calls: responseCalls,
  });
}
