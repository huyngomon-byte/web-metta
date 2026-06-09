import { adminDb } from '../_firebaseAdmin.js';
import { normalizePhone, verifyStringeeSignature } from '../_stringee.js';

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

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function field(req: VercelRequest, key: string) {
  return first(req.query?.[key]) || req.body?.[key] || '';
}

function parseCustomData(value?: string) {
  try {
    return value ? JSON.parse(value) as Record<string, unknown> : {};
  } catch {
    return {};
  }
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

function callId(req: VercelRequest) {
  return String(
    field(req, 'callId')
      || field(req, 'call_id')
      || field(req, 'uuid')
      || field(req, 'callIdNumber')
      || field(req, 'stringeeCallId')
      || `stringee-${Date.now()}`,
  );
}

function parseTime(value: unknown) {
  if (!value) return '';
  if (typeof value === 'number') {
    const ms = value > 10_000_000_000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  const date = new Date(String(value));
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}

function statusFromEvent(req: VercelRequest) {
  const explicit = String(field(req, 'call_status') || field(req, 'status') || '').toLowerCase();
  const endCause = String(field(req, 'endCallCause') || field(req, 'end_call_cause') || field(req, 'callEndedReason') || '').toLowerCase();
  if (explicit.includes('start') || explicit.includes('ring')) return 'ringing';
  if (explicit.includes('agentended') || explicit.includes('end') || explicit.includes('stop') || explicit.includes('hangup')) {
    if (
      endCause.includes('timeout')
      || endCause.includes('unavailable')
      || endCause.includes('busy')
      || endCause.includes('fail')
      || endCause.includes('no_answer')
      || endCause.includes('no answer')
    ) return 'failed';
    return 'ended';
  }
  if (explicit.includes('answer') || explicit.includes('connect')) return 'answered';

  const text = JSON.stringify(req.body || req.query || {}).toLowerCase();
  if (text.includes('end') || text.includes('hangup') || text.includes('stop')) return 'ended';
  if (text.includes('missed') || text.includes('no_answer') || text.includes('no answer') || text.includes('timeout')) return 'missed';
  if (text.includes('busy')) return 'failed';
  if (text.includes('record')) return '';
  if (text.includes('fail') || text.includes('error')) return 'failed';
  if (text.includes('answer') || text.includes('answered')) return 'answered';
  if (text.includes('ring') || text.includes('start')) return 'ringing';
  return '';
}

function recordingUrl(req: VercelRequest) {
  return String(
    field(req, 'recordingUrl')
      || field(req, 'recording_url')
      || field(req, 'recordedUrl')
      || field(req, 'recorded_url')
      || field(req, 'recordedFileUrl')
      || field(req, 'fileUrl')
      || '',
  );
}

function duration(req: VercelRequest, startedAt?: string, endedAt?: string) {
  const value = Number(field(req, 'duration') || field(req, 'callDuration') || field(req, 'talkTime') || 0);
  if (Number.isFinite(value) && value > 0) return Math.round(value);
  const start = startedAt ? new Date(startedAt).getTime() : 0;
  const end = endedAt ? new Date(endedAt).getTime() : 0;
  if (start && end && end > start) return Math.round((end - start) / 1000);
  return undefined;
}

async function recentLogByCustomer(db: ReturnType<typeof adminDb>, customerNumber: string) {
  if (!customerNumber) return null;
  const snap = await db.collection('callLogs').where('customerNumber', '==', customerNumber).limit(20).get().catch(() => null);
  const nowMs = Date.now();
  return snap?.docs
    .map((item) => ({ ref: item.ref, data: item.data() as Record<string, any> }))
    .filter((item) => {
      const startedAt = new Date(String(item.data.startedAt || item.data.createdAt || '')).getTime();
      return Number.isFinite(startedAt) && nowMs - startedAt < 20 * 60 * 1000;
    })
    .sort((a, b) => String(b.data.startedAt || b.data.createdAt || '').localeCompare(String(a.data.startedAt || a.data.createdAt || '')))[0] || null;
}

async function addOrUpdateCallActivity(db: ReturnType<typeof adminDb>, callLog: Record<string, any>) {
  const leadId = String(callLog.leadId || '');
  if (!leadId) return;
  const disposition = callLog.disposition || 'Chưa wrap-up';
  const durationText = callLog.durationSec ? ` · ${Math.round(Number(callLog.durationSec))}s` : '';
  const recordingText = callLog.recordingUrl ? ' · có ghi âm Stringee' : '';
  const id = `call-activity-${callLog.providerCallId || callLog.id}`;
  await db.collection('leadActivities').doc(id).set({
    id,
    leadId,
    type: 'call',
    content: `Call ${callLog.direction || ''}: ${disposition}${durationText}${recordingText}`,
    createdBy: callLog.agentName || 'Stringee',
    createdAt: callLog.endedAt || callLog.updatedAt || new Date().toISOString(),
    callLogId: callLog.id || callLog.providerCallId,
    callDirection: callLog.direction || '',
    callDurationSec: callLog.durationSec || 0,
    callDisposition: callLog.disposition || '',
    recordingUrl: callLog.recordingUrl || '',
  }, { merge: true }).catch(() => {});
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!verifyStringeeSignature(req)) return res.status(401).json({ error: 'Invalid Stringee signature' });

  const db = adminDb();
  const stringeeCallId = callId(req);
  const custom = parseCustomData(String(
    field(req, 'clientCustomData')
      || field(req, 'client_custom_data')
      || field(req, 'custom')
      || field(req, 'customData')
      || field(req, 'custom_data')
      || '',
  ));
  const eventCustomerNumber = normalizePhone(String(
    custom.customerNumber
      || field(req, 'customerNumber')
      || field(req, 'customer_number')
      || field(req, 'to')
      || field(req, 'toNumber')
      || field(req, 'from')
      || field(req, 'fromNumber')
      || '',
  ));

  let ref = db.collection('callLogs').doc(stringeeCallId);
  let existingSnap = await ref.get().catch(() => null);
  if (!existingSnap?.exists) {
    const recent = await recentLogByCustomer(db, eventCustomerNumber);
    if (recent) {
      ref = recent.ref;
      existingSnap = await ref.get().catch(() => null);
    }
  }
  const existing = existingSnap?.exists ? existingSnap.data() as Record<string, any> : {};
  const providerCallId = existing.providerCallId || existing.id || stringeeCallId;
  const timestamp = new Date().toISOString();
  const startedAt = existing.startedAt || parseTime(field(req, 'startTime') || field(req, 'createdTime')) || timestamp;
  const answeredAt = existing.answeredAt || parseTime(field(req, 'answerTime') || field(req, 'answeredTime'));
  const status = statusFromEvent(req);
  const endedAt = parseTime(field(req, 'endTime') || field(req, 'endedTime')) || (status === 'ended' || status === 'failed' || status === 'missed' ? timestamp : existing.endedAt);
  const nextStatus = status || existing.status || 'ringing';
  const recording = recordingUrl(req) || existing.recordingUrl || '';
  const recordingExpiresAt = recording
    ? existing.recordingExpiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    : '';
  const patch = {
    id: providerCallId,
    provider: 'stringee',
    providerCallId,
    stringeeCallId,
    direction: existing.direction || String(custom.direction || field(req, 'direction') || ''),
    status: nextStatus,
    leadId: existing.leadId || String(custom.leadId || field(req, 'leadId') || ''),
    leadName: existing.leadName || String(custom.leadName || field(req, 'leadName') || ''),
    agentId: existing.agentId || String(custom.agentId || field(req, 'agentId') || ''),
    agentName: existing.agentName || String(custom.agentName || field(req, 'agentName') || ''),
    fromNumber: existing.fromNumber || normalizePhone(String(field(req, 'from') || field(req, 'fromNumber') || '')),
    toNumber: existing.toNumber || normalizePhone(String(field(req, 'to') || field(req, 'toNumber') || '')),
    customerNumber: existing.customerNumber || eventCustomerNumber,
    startedAt,
    answeredAt,
    endedAt,
    durationSec: duration(req, answeredAt || startedAt, endedAt),
    recordingUrl: recording,
    recordingExpiresAt,
    createdAt: existing.createdAt || startedAt,
    updatedAt: timestamp,
    rawEvent: req.body || req.query || {},
  };

  const safePatch = stripUndefined(patch);
  await ref.set(safePatch, { merge: true });
  if (safePatch.endedAt || safePatch.recordingUrl) await addOrUpdateCallActivity(db, { ...existing, ...safePatch });
  return res.status(200).json({ ok: true, callId: providerCallId, stringeeCallId });
}
