import {
  onAuthStateChanged,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { currentUser } from '@/services/authService';
import { leadService } from '@/services/leadService';
import { delay, store } from '@/services/store';
import type { AgentPresence, CallCenterSettings, CallLog, StartCallPayload } from '@/types/call';
import { DEFAULT_CALL_DISPOSITIONS } from '@/types/call';
import type { Lead } from '@/types/crm';
import type { AdminUser } from '@/types/user';

const USE_FIREBASE = isFirebaseConfigured && !!db;
const COL_CALL_LOGS = 'callLogs';
const COL_CALL_SETTINGS = 'callCenterSettings';
const COL_AGENT_PRESENCE = 'agentPresence';
const SETTINGS_DOC_ID = 'stringee';
const DEFAULT_CALL_LOG_PAGE_SIZE = 100;
const DEFAULT_CALL_LOG_SINCE_DAYS = 30;
const DEFAULT_STRINGEE_FROM_NUMBER = '842488921797';
let cachedLogs: CallLog[] = [];
let cachedSettings: CallCenterSettings | null = null;

type CallLogListOptions = {
  pageSize?: number;
  sinceDays?: number;
};

function now() {
  return new Date().toISOString();
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
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

function readLocalLogs(): CallLog[] {
  return cachedLogs;
}

function writeLocalLogs(logs: CallLog[]) {
  cachedLogs = logs.slice(0, 500);
  window.dispatchEvent(new Event('metta-call-logs-updated'));
}

function mergeLogs(incoming: CallLog[], existing: CallLog[] = readLocalLogs()) {
  const byId = new Map<string, CallLog>();
  existing.forEach((log) => byId.set(log.id || log.providerCallId, log));
  incoming.forEach((log) => byId.set(log.id || log.providerCallId, log));
  return Array.from(byId.values())
    .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
}

function readLocalSettings(): CallCenterSettings | null {
  return cachedSettings;
}

function writeLocalSettings(settings: CallCenterSettings) {
  cachedSettings = settings;
  window.dispatchEvent(new Event('metta-call-settings-updated'));
}

function salesUsers() {
  return store.users.filter((user) => user.role === 'sales' && user.active);
}

function defaultUserMappings() {
  return [];
}

export function defaultCallCenterSettings(): CallCenterSettings {
  const firstSales = salesUsers()[0];
  return {
    provider: 'stringee',
    enabled: true,
    pccMode: true,
    fromNumber: DEFAULT_STRINGEE_FROM_NUMBER,
    fallbackAgentId: firstSales?.id || '',
    fallbackAgentName: firstSales?.fullName || 'Sales lead',
    userMappings: defaultUserMappings(),
    dispositions: [...DEFAULT_CALL_DISPOSITIONS],
    updatedAt: now(),
  };
}

export function normalizePhoneForCall(phone?: string) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+84')) return `84${digits.slice(3)}`;
  if (digits.startsWith('84')) return digits;
  if (digits.startsWith('0')) return `84${digits.slice(1)}`;
  return digits;
}

function displayName(lead: Partial<Lead> | StartCallPayload) {
  return String(
    'leadName' in lead
      ? lead.leadName
      : lead.studentName || lead.parentName || lead.fullName || lead.phone || '',
  ).trim();
}

function mapSettings(settings: Partial<CallCenterSettings>): CallCenterSettings {
  const defaults = defaultCallCenterSettings();
  return {
    ...defaults,
    ...settings,
    pccMode: settings.pccMode ?? defaults.pccMode,
    userMappings: settings.userMappings?.length ? settings.userMappings : defaults.userMappings,
    dispositions: settings.dispositions?.length ? settings.dispositions : defaults.dispositions,
  };
}

async function currentFirebaseIdToken(timeoutMs = 4000) {
  const authInstance = auth;
  if (!authInstance) return '';
  const current = authInstance.currentUser;
  if (current) return current.getIdToken().catch(() => '');

  const restored = await new Promise<FirebaseUser | null>((resolve) => {
    const timeout = window.setTimeout(() => {
      unsubscribe();
      resolve(null);
    }, timeoutMs);
    const unsubscribe = onAuthStateChanged(authInstance, (nextUser) => {
      window.clearTimeout(timeout);
      unsubscribe();
      resolve(nextUser);
    });
  });
  return restored?.getIdToken().catch(() => '') || '';
}

async function writeFirestoreSettings(settings: CallCenterSettings) {
  if (!USE_FIREBASE) return;
  await setDoc(doc(db!, COL_CALL_SETTINGS, SETTINGS_DOC_ID), stripUndefined(settings));
}

async function writeFirestoreLog(log: CallLog) {
  if (!USE_FIREBASE) return;
  await setDoc(doc(db!, COL_CALL_LOGS, log.id), stripUndefined(log), { merge: true });
}

async function writeFirestorePresence(presence: AgentPresence) {
  if (!USE_FIREBASE) return;
  try {
    await setDoc(doc(db!, COL_AGENT_PRESENCE, presence.userId), stripUndefined(presence), { merge: true });
  } catch (error) {
    console.warn('[CallCenter] Cannot write presence to Firestore:', error);
  }
}

export const callCenterService = {
  getSettings: async () => {
    let settings = mapSettings(defaultCallCenterSettings());
    if (USE_FIREBASE) {
      const snap = await getDoc(doc(db!, COL_CALL_SETTINGS, SETTINGS_DOC_ID));
      if (snap.exists()) settings = mapSettings(snap.data() as Partial<CallCenterSettings>);
    } else {
      settings = mapSettings(readLocalSettings() || defaultCallCenterSettings());
    }
    writeLocalSettings(settings);
    return delay(settings);
  },

  saveSettings: async (settings: CallCenterSettings) => {
    const normalized = mapSettings({ ...settings, updatedAt: now() });
    await writeFirestoreSettings(normalized);
    writeLocalSettings(normalized);
    return delay(normalized);
  },

  getMappedStringeeUserId: async (user?: AdminUser | null) => {
    if (!user) return '';
    const settings = await callCenterService.getSettings();
    const directMapping = settings.userMappings.find((mapping) => mapping.crmUserId === user.id && mapping.active);
    if (directMapping?.stringeeUserId) return directMapping.stringeeUserId;
    if (user.role === 'admin' && settings.fallbackAgentId) {
      const fallbackMapping = settings.userMappings.find((mapping) => mapping.crmUserId === settings.fallbackAgentId && mapping.active);
      if (fallbackMapping?.stringeeUserId) return fallbackMapping.stringeeUserId;
    }
    return user.id;
  },

  getToken: async (user?: AdminUser | null) => {
    if (!user) return '';
    const idToken = await currentFirebaseIdToken();
    const stringeeUserId = await callCenterService.getMappedStringeeUserId(user);
    const response = await fetch('/api/call/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({ stringeeUserId, crmUserId: user.id }),
    });
    const payload = await response.json().catch(() => ({})) as { token?: string; expiresAt?: string; error?: string };
    if (!response.ok || !payload.token) throw new Error(payload.error || 'Cannot issue Stringee token.');
    return payload.token;
  },

  startPccOutboundCall: async (lead: Lead, user?: AdminUser | null, providerCallId?: string) => {
    if (!user) throw new Error('Bạn cần đăng nhập để gọi.');
    const idToken = await currentFirebaseIdToken();
    const settings = await callCenterService.getSettings();
    const response = await fetch('/api/call/outbound', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({
        providerCallId,
        leadId: lead.id,
        leadName: displayName(lead),
        phone: normalizePhoneForCall(lead.phone),
        crmUserId: user.id,
        agentName: user.fullName,
        fromNumber: settings.fromNumber,
      }),
    });
    const payload = await response.json().catch(() => ({})) as { ok?: boolean; providerCallId?: string; clientCallId?: string; stringeeCallId?: string; userId?: string; message?: string; error?: string };
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'Stringee PCC chưa tạo được cuộc gọi.');
    return payload;
  },

  finishPccCall: async (log: Partial<CallLog>, status: 'ended' | 'failed' | 'missed' = 'ended') => {
    const idToken = await currentFirebaseIdToken();
    const response = await fetch('/api/call/finish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      },
      body: JSON.stringify({
        providerCallId: log.providerCallId || log.id,
        clientCallId: log.clientCallId,
        stringeeCallId: log.stringeeCallId,
        callLogId: log.id,
        status,
        startedAt: log.startedAt,
        reason: 'crm_hangup',
      }),
    });
    const payload = await response.json().catch(() => ({})) as { ok?: boolean; callId?: string; status?: string; error?: string };
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'CRM chÆ°a giáº£i phÃ³ng Ä‘Æ°á»£c lock cuá»™c gá»i.');
    return payload;
  },

  getLogs: async ({ pageSize = DEFAULT_CALL_LOG_PAGE_SIZE, sinceDays = DEFAULT_CALL_LOG_SINCE_DAYS }: CallLogListOptions = {}) => {
    const user = currentUser();
    const safePageSize = Math.max(1, Math.min(500, Math.round(pageSize)));
    const cutoff = daysAgoIso(sinceDays);
    let logs = USE_FIREBASE
      ? []
      : readLocalLogs()
        .filter((log) => !log.startedAt || log.startedAt >= cutoff)
        .slice(0, safePageSize);
    if (USE_FIREBASE) {
      const logsQuery = user?.role === 'sales'
        ? query(collection(db!, COL_CALL_LOGS), where('agentId', '==', user.id), where('startedAt', '>=', cutoff), orderBy('startedAt', 'desc'), limit(safePageSize))
        : query(collection(db!, COL_CALL_LOGS), where('startedAt', '>=', cutoff), orderBy('startedAt', 'desc'), limit(safePageSize));
      const snap = await getDocs(logsQuery);
      logs = snap.docs.map((item) => item.data() as CallLog);
      writeLocalLogs(user?.role === 'sales' ? mergeLogs(logs) : logs);
    }
    return delay(logs.sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || '')));
  },

  getLogsForLead: async (leadId: string) => {
    const user = currentUser();
    let logs = USE_FIREBASE ? [] : readLocalLogs().filter((log) => log.leadId === leadId);
    if (USE_FIREBASE) {
      const logsQuery = user?.role === 'sales'
        ? query(collection(db!, COL_CALL_LOGS), where('agentId', '==', user.id))
        : query(collection(db!, COL_CALL_LOGS), where('leadId', '==', leadId), orderBy('startedAt', 'desc'));
      const snap = await getDocs(logsQuery);
      logs = snap.docs.map((item) => item.data() as CallLog);
      if (user?.role === 'sales') logs = logs.filter((log) => log.leadId === leadId);
      writeLocalLogs(mergeLogs(logs));
    }
    return delay(logs.sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || '')));
  },

  latestForLead: (leadId: string) => readLocalLogs()
    .filter((log) => log.leadId === leadId)
    .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''))[0],

  saveLog: async (input: Partial<CallLog>) => {
    const timestamp = now();
    const id = input.id || input.providerCallId || `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const existing = readLocalLogs().find((log) => log.id === id || log.providerCallId === input.providerCallId);
    const log: CallLog = {
      id: existing?.id || id,
      provider: 'stringee',
      providerCallId: input.providerCallId || existing?.providerCallId || id,
      clientCallId: input.clientCallId || existing?.clientCallId,
      stringeeCallId: input.stringeeCallId || existing?.stringeeCallId,
      direction: input.direction || existing?.direction || 'outbound',
      status: input.status || existing?.status || 'queued',
      callStatus: input.callStatus || input.status || existing?.callStatus || existing?.status || 'queued',
      leadId: input.leadId || existing?.leadId,
      customerId: input.customerId || existing?.customerId || input.leadId || existing?.leadId,
      leadName: input.leadName || existing?.leadName,
      agentId: input.agentId || existing?.agentId || currentUser()?.id,
      saleId: input.saleId || existing?.saleId || input.agentId || existing?.agentId || currentUser()?.id,
      agentName: input.agentName || existing?.agentName || currentUser()?.fullName,
      stringeeAgentId: input.stringeeAgentId || existing?.stringeeAgentId,
      routedAgentId: input.routedAgentId || existing?.routedAgentId,
      routedAgentName: input.routedAgentName || existing?.routedAgentName,
      agentPhoneNumber: input.agentPhoneNumber || existing?.agentPhoneNumber,
      fromNumber: input.fromNumber || existing?.fromNumber || '',
      toNumber: input.toNumber || existing?.toNumber || '',
      customerNumber: input.customerNumber || existing?.customerNumber || input.toNumber || '',
      startedAt: input.startedAt || existing?.startedAt || timestamp,
      startTime: input.startTime || existing?.startTime || input.startedAt || existing?.startedAt || timestamp,
      answeredAt: input.answeredAt || existing?.answeredAt,
      answerTime: input.answerTime || existing?.answerTime || input.answeredAt || existing?.answeredAt,
      endedAt: input.endedAt || existing?.endedAt,
      stopTime: input.stopTime || existing?.stopTime || input.endedAt || existing?.endedAt,
      durationSec: input.durationSec ?? existing?.durationSec,
      recordingUrl: input.recordingUrl || existing?.recordingUrl,
      recordingExpiresAt: input.recordingExpiresAt || existing?.recordingExpiresAt,
      disposition: input.disposition || existing?.disposition,
      note: input.note || existing?.note,
      createdAt: existing?.createdAt || input.createdAt || timestamp,
      updatedAt: timestamp,
      rawEvent: input.rawEvent || existing?.rawEvent,
    };
    await writeFirestoreLog(log);
    const next = [log, ...readLocalLogs().filter((item) => item.id !== log.id && item.providerCallId !== log.providerCallId)];
    writeLocalLogs(next);
    return delay(log);
  },

  startLocalLogForLead: async (lead: Lead, direction: 'outbound' | 'inbound' = 'outbound', providerCallId?: string) => {
    const user = currentUser();
    return callCenterService.saveLog({
      providerCallId: providerCallId || `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      direction,
      status: direction === 'outbound' ? 'queued' : 'ringing',
      leadId: lead.id,
      leadName: displayName(lead),
      agentId: user?.id,
      agentName: user?.fullName,
      fromNumber: direction === 'outbound' ? user?.id || '' : normalizePhoneForCall(lead.phone),
      toNumber: direction === 'outbound' ? normalizePhoneForCall(lead.phone) : user?.id || '',
      customerNumber: normalizePhoneForCall(lead.phone),
      startedAt: now(),
    });
  },

  wrapUp: async (log: CallLog, disposition: string, note: string) => {
    const saved = await callCenterService.saveLog({
      ...log,
      status: log.status === 'ringing' || log.status === 'queued' ? 'ended' : log.status,
      disposition,
      note,
      endedAt: log.endedAt || now(),
    });
    if (saved.leadId) {
      const duration = saved.durationSec ? ` · ${Math.round(saved.durationSec)}s` : '';
      const recording = saved.recordingUrl ? ' · có ghi âm' : '';
      await leadService.addActivity({
        leadId: saved.leadId,
        type: 'call',
        content: `Call ${saved.direction === 'outbound' ? 'outbound' : 'inbound'}: ${disposition}${duration}${recording}${note ? ` · ${note}` : ''}`,
        createdBy: saved.agentName || currentUser()?.fullName || 'Call Center',
        callLogId: saved.id,
        callDirection: saved.direction,
        callDurationSec: saved.durationSec,
        callDisposition: disposition,
        recordingUrl: saved.recordingUrl,
      });
    }
    return saved;
  },

  setPresence: async (user: AdminUser | null, online: boolean, currentCallId?: string) => {
    if (!user) return null;
    const stringeeUserId = await callCenterService.getMappedStringeeUserId(user);
    const presence: AgentPresence = {
      userId: user.id,
      stringeeUserId,
      online,
      currentCallId,
      lastSeenAt: now(),
    };
    await writeFirestorePresence(presence);
    return delay(presence);
  },

  findLeadByPhone: async (phone: string) => {
    const target = normalizePhoneForCall(phone);
    const leads = await leadService.getLeads();
    return leads.find((lead) => normalizePhoneForCall(lead.phone) === target);
  },

  recordingProxyUrl: (log: Pick<CallLog, 'id' | 'providerCallId'>) => {
    const id = log.id || log.providerCallId;
    return `/api/call/recording?callLogId=${encodeURIComponent(id)}`;
  },

  recordingProxyUrlById: (callLogId: string) => `/api/call/recording?callLogId=${encodeURIComponent(callLogId)}`,

  recordingPageUrl: (log: Pick<CallLog, 'id' | 'providerCallId'>) => {
    const id = encodeURIComponent(log.id || log.providerCallId);
    return `/crm/calls/${id}/recording`;
  },
};
