import type { Firestore } from 'firebase-admin/firestore';

const LOCK_ID = 'stringee-main';
const DEFAULT_LOCK_TTL_MS = 30 * 60 * 1000;
const DEFAULT_RINGING_LOCK_TTL_MS = 5 * 60 * 1000;

export class CallLockBusyError extends Error {
  lock: Record<string, unknown>;
  status = 409;

  constructor(lock: Record<string, unknown>) {
    const agentName = String(lock.agentName || lock.routedAgentName || lock.agentId || 'Sales');
    super(`Tổng đài đang có cuộc gọi của ${agentName}. Vui lòng đợi cuộc gọi hiện tại kết thúc.`);
    this.lock = lock;
  }
}

function lockTtlMs() {
  const value = Number(process.env.CALL_LOCK_TTL_MS || 0);
  return Number.isFinite(value) && value >= 30_000 ? value : DEFAULT_LOCK_TTL_MS;
}

function ringingLockTtlMs() {
  const value = Number(process.env.CALL_RINGING_LOCK_TTL_MS || 0);
  return Number.isFinite(value) && value >= 30_000 ? value : DEFAULT_RINGING_LOCK_TTL_MS;
}

function nowIso(ms = Date.now()) {
  return new Date(ms).toISOString();
}

function callIdMatches(lock: Record<string, unknown>, callId?: string | string[]) {
  if (!callId || (Array.isArray(callId) && !callId.length)) return true;
  const targets = new Set((Array.isArray(callId) ? callId : [callId]).map((value) => String(value || '')).filter(Boolean));
  if (!targets.size) return true;
  return [
    lock.providerCallId,
    lock.clientCallId,
    lock.stringeeCallId,
    lock.id,
  ].some((value) => targets.has(String(value || '')));
}

function terminalLog(data: Record<string, unknown>) {
  const status = String(data.status || data.callStatus || '').toLowerCase();
  return status === 'ended'
    || status === 'failed'
    || status === 'missed'
    || Boolean(data.endedAt || data.stopTime);
}

export async function acquireCallLock(db: Firestore, data: Record<string, unknown>) {
  const ref = db.collection('callLocks').doc(LOCK_ID);
  const nowMs = Date.now();
  const expiresAtMs = nowMs + lockTtlMs();

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const existing = snap.exists ? snap.data() || {} : {};
    const lockAgeMs = Number(existing.acquiredAtMs || 0) ? nowMs - Number(existing.acquiredAtMs || 0) : 0;
    const existingCallStatus = String(existing.callStatus || '').toLowerCase();
    const ringingStale = existingCallStatus !== 'answered' && lockAgeMs >= ringingLockTtlMs();
    const logIds = Array.from(new Set([
      existing.providerCallId,
      existing.clientCallId,
      existing.stringeeCallId,
      existing.id,
    ].map((value) => String(value || '').trim()).filter(Boolean)));
    let alreadyEnded = false;
    for (const id of logIds) {
      const logSnap = await transaction.get(db.collection('callLogs').doc(id));
      if (logSnap.exists && terminalLog(logSnap.data() || {})) {
        alreadyEnded = true;
        break;
      }
    }
    const active = existing.status === 'active' && Number(existing.expiresAtMs || 0) > nowMs && !ringingStale && !alreadyEnded;
    if (active) throw new CallLockBusyError(existing);

    transaction.set(ref, {
      id: LOCK_ID,
      status: 'active',
      acquiredAt: nowIso(nowMs),
      acquiredAtMs: nowMs,
      expiresAtMs,
      updatedAt: nowIso(nowMs),
      ...data,
    });
  });
}

export async function updateCallLock(db: Firestore, data: Record<string, unknown>) {
  const ref = db.collection('callLocks').doc(LOCK_ID);
  await ref.set({
    ...data,
    updatedAt: nowIso(),
  }, { merge: true }).catch(() => {});
}

export async function updateMatchingCallLock(db: Firestore, callId?: string | string[], data: Record<string, unknown> = {}) {
  const ref = db.collection('callLocks').doc(LOCK_ID);
  const snap = await ref.get().catch(() => null);
  if (!snap?.exists) return;
  const existing = snap.data() || {};
  if (existing.status !== 'active') return;
  if (!callIdMatches(existing, callId)) return;
  await ref.set({
    ...data,
    updatedAt: nowIso(),
  }, { merge: true }).catch(() => {});
}

export async function releaseCallLock(db: Firestore, callId?: string | string[], patch: Record<string, unknown> = {}) {
  const ref = db.collection('callLocks').doc(LOCK_ID);
  const snap = await ref.get().catch(() => null);
  if (!snap?.exists) return;
  const existing = snap.data() || {};
  if (existing.status !== 'active') return;
  if (!callIdMatches(existing, callId)) return;
  const timestamp = nowIso();
  await ref.set({
    ...patch,
    status: 'released',
    releasedAt: timestamp,
    updatedAt: timestamp,
  }, { merge: true }).catch(() => {});
}
