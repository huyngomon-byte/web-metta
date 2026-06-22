import { adminDb } from '../../api/_firebaseAdmin.js';
import { ApiError, requireApiUser } from '../../api/_apiAuth.js';
import { releaseCallLock } from './lock.js';

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

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

function safeStatus(value: unknown) {
  const status = String(value || '').toLowerCase();
  return status === 'failed' || status === 'missed' ? status : 'ended';
}

function callIds(body: Record<string, unknown>) {
  return Array.from(new Set([
    body.providerCallId,
    body.clientCallId,
    body.stringeeCallId,
    body.callLogId,
    body.id,
  ].map((value) => String(value || '').trim()).filter(Boolean)));
}

async function findLog(db: ReturnType<typeof adminDb>, ids: string[]) {
  for (const id of ids) {
    const snap = await db.collection('callLogs').doc(id).get().catch(() => null);
    if (snap?.exists) return { ref: snap.ref, data: snap.data() || {} };
  }
  return null;
}

function durationSec(startedAt?: string, endedAt?: string) {
  const start = startedAt ? new Date(startedAt).getTime() : 0;
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  if (!start || Number.isNaN(start) || Number.isNaN(end) || end <= start) return undefined;
  return Math.round((end - start) / 1000);
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
    return res.status(403).json({ error: 'Only Admin, Manager or Sales can finish calls' });
  }

  const ids = callIds(req.body || {});
  if (!ids.length) return res.status(400).json({ error: 'Missing call id to finish' });

  const existing = await findLog(db, ids);
  if (existing?.data.agentId && user.role === 'sales' && existing.data.agentId !== user.id) {
    return res.status(403).json({ error: 'Sales can only finish their own calls' });
  }

  const endedAt = new Date().toISOString();
  const status = safeStatus(req.body?.status);
  const startedAt = String(existing?.data.startedAt || req.body?.startedAt || '');
  const patch = stripUndefined({
    id: existing?.data.id || ids[0],
    provider: 'stringee',
    providerCallId: existing?.data.providerCallId || req.body?.providerCallId || ids[0],
    clientCallId: existing?.data.clientCallId || req.body?.clientCallId,
    stringeeCallId: existing?.data.stringeeCallId || req.body?.stringeeCallId,
    status,
    callStatus: status,
    endedAt,
    stopTime: endedAt,
    durationSec: existing?.data.durationSec || durationSec(startedAt, endedAt),
    updatedAt: endedAt,
    rawEvent: {
      ...(existing?.data.rawEvent && typeof existing.data.rawEvent === 'object' ? existing.data.rawEvent : {}),
      crmFinish: {
        at: endedAt,
        by: user.id,
        byName: user.fullName,
        reason: req.body?.reason || 'crm_hangup',
      },
    },
  });

  const ref = existing?.ref || db.collection('callLogs').doc(ids[0]);
  await ref.set(patch, { merge: true });
  await releaseCallLock(db, ids, {
    releaseReason: 'crm_finish',
    endedAt,
    providerCallId: patch.providerCallId,
    stringeeCallId: patch.stringeeCallId,
  });

  return res.status(200).json({ ok: true, callId: ref.id, status });
}
