import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  startAfter,
  where,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { captureLeadTracking, type PublicLeadTracking } from '@/lib/capiTracking';
import { DEAL_QUOTED_STATUS, DEFAULT_DEAL_CURRENCY, LOST_LEAD_STATUS, WON_LEAD_STATUS, leadStatuses, pendingReasonOptions, resolveCourseDealSizeForProgram } from '@/lib/constants';
import { isReferralSource, normalizeStageHistory, updateStageHistory } from '@/lib/leadAnalytics';
import { financeDefaultsForLead, revenueAmount, type CourseDealSizeRule } from '@/lib/leadFinance';
import { canDeleteLead, canViewAllLeads, canViewLead, leadAssignmentExpired, leadAssignmentExpiresAtMs } from '@/lib/permissions';
import { appointmentService } from '@/services/appointmentService';
import { currentUser } from '@/services/authService';
import { lmsSyncService } from '@/services/lmsSyncService';
import { notificationService } from '@/services/notificationService';
import { purgeDemoDataOnServerOnce } from '@/services/demoDataPurgeService';
import { sourceConfigService, sourcePriority } from '@/services/sourceConfigService';
import { delay, store } from '@/services/store';
import { userService } from '@/services/userService';
import type { Appointment, InterestedCourse, Lead, LeadActivity, LeadPriorityLevel, LeadSourceConfig } from '@/types/crm';
import type { AdminUser } from '@/types/user';

const now = () => new Date().toISOString();
const USE_FIREBASE = isFirebaseConfigured && !!db;
const COL_LEADS = 'leads';
const COL_ACTIVITIES = 'leadActivities';
const COL_APPOINTMENTS = 'appointments';
const COL_AUDIT_LOGS = 'activityLogs';
const STAGE_DEMO_ID_PREFIX = 'lead-demo-stage-';
const FINANCE_DEMO_ID_PREFIX = 'lead-demo-priority-';
const DAY_MS = 24 * 60 * 60 * 1000;
const REALTIME_LEADS_LIMIT = 1000;
const DEFAULT_LEADS_PAGE_SIZE = 100;
const DEFAULT_LEADS_SINCE_DAYS = 30;
const CAPI_STATUS_TIMEOUT_MS = 8000;

export type LeadPageCursor = {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  snapshot?: QueryDocumentSnapshot;
};

type LeadPageOptions = {
  pageSize?: number;
  cursor?: LeadPageCursor | null;
  sinceDays?: number;
  dateFrom?: string;
  dateTo?: string;
};

export type LeadNumberedPageOptions = {
  page?: number;
  pageSize?: number;
  sinceDays?: number;
  dateFrom?: string;
  dateTo?: string;
};

export type LeadNumberedPageResult = {
  leads: Lead[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
};

export type LeadAssignmentGroup = 'all' | 'unassigned' | 'stale' | 'returned' | 'assigned';

export type LeadAssignmentGroupCounts = Record<LeadAssignmentGroup, number>;

export type LeadAssignmentPageOptions = {
  page?: number;
  pageSize?: number;
  group?: LeadAssignmentGroup;
};

export type LeadAssignmentPageResult = LeadNumberedPageResult & {
  group: LeadAssignmentGroup;
  groupCounts: LeadAssignmentGroupCounts;
};

type PublicLeadSubmitInput = Partial<Lead> & {
  company?: string;
  website?: string;
  formId?: string;
  pageSlug?: string;
  sourceUrl?: string;
  tracking?: PublicLeadTracking;
};

type LeadStatusCapiChange = {
  leadId: string;
  previousStatus: string;
  nextStatus: string;
};

type LeadSubscribeMeta = {
  replace?: boolean;
  removedIds?: string[];
};

type LeadSubscribeCallback = (leads: Lead[], meta?: LeadSubscribeMeta) => void;

export type LeadImportInputRow = {
  rowNumber: number;
  lead: Partial<Lead>;
};

export type LeadImportRowResult = {
  rowNumber: number;
  leadId: string;
  mode: 'create' | 'update' | 'failed';
  error?: string;
  warnings?: string[];
};

export type LeadImportResult = {
  created: number;
  updated: number;
  failed: number;
  results: LeadImportRowResult[];
};

const COURSE_MIGRATION: Record<string, InterestedCourse> = {
  'Mẫu giáo': 'METTA Kiddies',
  'Thiếu Nhi': 'METTA Young Learner',
  'Young Learners': 'METTA Young Learner',
  'METTA Young Learners': 'METTA Young Learner',
  Phonics: 'METTA on Phonics',
};

function normalizeCourse(v?: string): string {
  return (v && COURSE_MIGRATION[v]) ? COURSE_MIGRATION[v] : (v || '');
}

function leadDisplayName(lead: Partial<Lead>) {
  return String(lead.studentName || lead.parentName || lead.fullName || '').trim();
}

function pendingWarmth(reason?: string) {
  return pendingReasonOptions.find((item) => item.reason === reason)?.warmthPercent;
}

function isDemoLead(lead: Partial<Lead>) {
  const id = String(lead.id || '');
  const email = String(lead.email || '').toLowerCase();
  return isDemoLeadId(id)
    || /^lead-[1-5]$/.test(id)
    || /^lead-x\d+$/.test(id)
    || email.includes('@metta.test')
    || email.includes('@example.com');
}

function isDemoLeadId(id?: string) {
  const value = String(id || '');
  return value.startsWith(STAGE_DEMO_ID_PREFIX)
    || value.startsWith(FINANCE_DEMO_ID_PREFIX)
    || /^lead-[1-5]$/.test(value)
    || /^lead-x\d+$/.test(value);
}

function isDemoAppointment(item: Partial<Appointment>, demoLeadIds = new Set<string>()) {
  const id = String(item.id || '');
  const leadId = String(item.leadId || '');
  return id.startsWith('ap-demo-stage-consultation-')
    || id.startsWith('ap-demo-priority-consultation-')
    || /^ap-[1-5]$/.test(id)
    || isDemoLeadId(leadId)
    || demoLeadIds.has(leadId);
}

function salesNameById(id?: string) {
  if (!id) return '';
  return store.users.find((user) => user.id === id)?.fullName || id;
}

function activeSalesUsers() {
  return store.users.filter((user) => user.role === 'sales' && user.active);
}

function normalizedSalesKey(value?: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function uniqueSalesMatch(candidates: AdminUser[]) {
  const unique = Array.from(new Map(candidates.map((sales) => [sales.id, sales])).values());
  return unique.length === 1 ? unique[0] : undefined;
}

function salesUserFromAssignment(idOrName?: string, displayName?: string) {
  const idKey = String(idOrName || '').trim();
  const rawKeys = [idOrName, displayName]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  const normalizedKeys = rawKeys.map(normalizedSalesKey).filter(Boolean);
  const salesUsers = activeSalesUsers();
  return salesUsers.find((sales) => sales.id === idKey)
    || salesUsers.find((sales) => rawKeys.some((key) => key.toLowerCase() === sales.email.toLowerCase()))
    || salesUsers.find((sales) => normalizedKeys.some((key) => normalizedSalesKey(sales.fullName) === key))
    || uniqueSalesMatch(salesUsers.filter((sales) => {
      const name = normalizedSalesKey(sales.fullName);
      const tokens = name.split(' ').filter(Boolean);
      return normalizedKeys.some((key) => key.length >= 2 && (tokens.includes(key) || name.endsWith(` ${key}`)));
    }));
}

function shouldNormalizeSales(idOrName: string | undefined, displayName: string | undefined, sales: AdminUser) {
  return idOrName !== sales.id || displayName !== sales.fullName;
}

function normalizeSalesAssignmentFields<T extends Partial<Lead>>(input: T): T {
  const lead = { ...input } as T & Partial<Lead>;
  const assigned = salesUserFromAssignment(lead.assignedTo, lead.assignedToName);
  if (assigned && shouldNormalizeSales(lead.assignedTo, lead.assignedToName, assigned)) {
    lead.assignedTo = assigned.id;
    lead.assignedToName = assigned.fullName;
  }

  const failedAssigned = salesUserFromAssignment(lead.failedAssignedTo, lead.failedAssignedToName);
  if (failedAssigned && shouldNormalizeSales(lead.failedAssignedTo, lead.failedAssignedToName, failedAssigned)) {
    lead.failedAssignedTo = failedAssigned.id;
    lead.failedAssignedToName = failedAssigned.fullName;
  }
  return lead as T;
}

function normalizeLeadSales(lead: Lead) {
  const normalized = normalizeSalesAssignmentFields(lead);
  Object.assign(lead, normalized);
}

function assignmentFieldsChanged(before: Partial<Lead>, after: Partial<Lead>) {
  return before.assignedTo !== after.assignedTo
    || before.assignedToName !== after.assignedToName
    || before.failedAssignedTo !== after.failedAssignedTo
    || before.failedAssignedToName !== after.failedAssignedToName;
}

function importedAssignmentLabel(lead: Partial<Lead>) {
  return String(lead.assignedToName || lead.assignedTo || '').trim();
}

function validateRequestedSalesAssignment(lead: Partial<Lead>) {
  const requested = importedAssignmentLabel(lead);
  if (!requested) return;
  if (lead.assignedTo && activeSalesUsers().some((sales) => sales.id === lead.assignedTo)) return;
  throw new Error(`Không tìm thấy sales active khớp với "${requested}". Vui lòng nhập Sales ID hoặc tên sales đúng trong file import.`);
}

function explicitPriority(value: unknown): LeadPriorityLevel | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(Math.max(Math.round(parsed), 1), 5) as LeadPriorityLevel;
}

function resolvedPriority(configs: LeadSourceConfig[], source?: string, value?: unknown) {
  return explicitPriority(value) || sourcePriority(configs, source, value);
}

async function refreshUsersForAssignmentRepair(user: AdminUser | null) {
  if (!USE_FIREBASE || !canViewAllLeads(user)) return;
  await userService.getUsers().catch((error) => {
    console.warn('[Leads] Cannot load users for assignment repair:', error);
  });
}

async function repairNormalizedAssignments(leads: Lead[], originals: Lead[], user: AdminUser | null) {
  if (!USE_FIREBASE || !canViewAllLeads(user)) return;
  const repairs = leads.filter((lead, index) => assignmentFieldsChanged(originals[index] || {}, lead));
  if (!repairs.length) return;
  await Promise.all(repairs.map((lead) => writeFirestoreLead(lead).catch((error) => {
    console.warn('[Leads] Assignment repair failed:', lead.id, error);
  })));
}

function repairReferralPhone(lead: Lead) {
  if (!isReferralSource(lead.source)) {
    lead.referralPhone = lead.referralPhone || '';
    return;
  }

  lead.referralPhone = lead.referralPhone || '';
}

function notifyLeadAssignment(lead: Lead, salesId?: string, assignedByName?: string, auto = false) {
  if (!salesId) return;
  notificationService.notifyLeadAssigned(lead, salesId, assignedByName, auto);
}

function parseMoney(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? value : undefined;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function normalizeDealFields<T extends Partial<Lead>>(input: T): T {
  const lead = { ...input } as T & Partial<Lead>;
  const dealSize = parseMoney(lead.dealSize);
  const expectedRevenue = parseMoney(lead.expectedRevenue);
  const discountPercent = parseMoney(lead.discountPercent);
  const revenue = parseMoney(lead.revenue);

  if (dealSize === undefined) {
    delete lead.dealSize;
  } else {
    lead.dealSize = dealSize;
  }

  if (expectedRevenue === undefined) {
    if (dealSize !== undefined) lead.expectedRevenue = dealSize;
    else delete lead.expectedRevenue;
  } else {
    lead.expectedRevenue = expectedRevenue;
  }

  if (discountPercent === undefined) {
    delete lead.discountPercent;
  } else {
    lead.discountPercent = discountPercent;
  }

  if (revenue === undefined) {
    delete lead.revenue;
  } else {
    lead.revenue = revenue;
  }

  if ((lead.dealSize !== undefined || lead.expectedRevenue !== undefined || lead.revenue !== undefined) && !lead.dealCurrency) {
    lead.dealCurrency = DEFAULT_DEAL_CURRENCY;
  }

  return lead as T;
}

function currentCourseDealSizes(): CourseDealSizeRule[] {
  const programs = store.siteSettings?.programs?.filter((program) => program.visible !== false) || [];
  return programs.map((program) => ({
    courseName: program.title?.trim() || program.courseName?.trim() || program.slug,
    dealSize: resolveCourseDealSizeForProgram(program),
    aliases: [program.courseName, program.slug].map((item) => item?.trim()).filter((item): item is string => Boolean(item)),
  })).filter((item) => Boolean(item.courseName));
}

function normalizeLead(raw: Lead): Lead {
  const lead = { ...raw, interestedCourse: normalizeCourse(raw.interestedCourse) as InterestedCourse | '' };
  const tags = Array.isArray(lead.tags)
    ? Array.from(new Set(lead.tags.map((tag) => String(tag || '').replace(/\s+/g, ' ').trim()).filter(Boolean))).slice(0, 12)
    : [];
  if (tags.length) lead.tags = tags;
  else delete lead.tags;
  normalizeLeadSales(lead);
  repairReferralPhone(lead);
  if (!lead.studentName && lead.contactType === 'student' && lead.fullName) lead.studentName = lead.fullName;
  if (!lead.parentName && lead.contactType !== 'student' && lead.fullName) lead.parentName = lead.fullName;
  if (!lead.fullName) lead.fullName = leadDisplayName(lead);
  if (!lead.assignedStatus) lead.assignedStatus = lead.assignedTo ? 'accepted' : 'unassigned';
  if (!lead.priorityLevel) lead.priorityLevel = 1;
  if (lead.pendingReason && !lead.pendingWarmthPercent) lead.pendingWarmthPercent = pendingWarmth(lead.pendingReason) || 0;
  if (lead.status === DEAL_QUOTED_STATUS || lead.status === WON_LEAD_STATUS) {
    Object.assign(lead, financeDefaultsForLead(lead, currentCourseDealSizes()));
  }
  if (lead.status === WON_LEAD_STATUS && !lead.revenue) {
    lead.revenue = revenueAmount(lead, currentCourseDealSizes());
  }
  if (!lead.dealCurrency && (lead.dealSize !== undefined || lead.expectedRevenue !== undefined)) lead.dealCurrency = DEFAULT_DEAL_CURRENCY;
  if (lead.dealSize !== undefined && lead.expectedRevenue === undefined) lead.expectedRevenue = lead.dealSize;
  if (!lead.assignedToName && lead.assignedTo) lead.assignedToName = salesNameById(lead.assignedTo);
  lead.stageHistory = normalizeStageHistory(lead);
  return lead;
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

async function authJsonHeaders() {
  const token = await auth?.currentUser?.getIdToken().catch(() => '');
  return token ? { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } : null;
}

async function sendLeadStatusCapiEvent(change: LeadStatusCapiChange) {
  if (!USE_FIREBASE || !change.leadId || !change.nextStatus || change.previousStatus === change.nextStatus) return;
  const headers = await authJsonHeaders();
  if (!headers) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CAPI_STATUS_TIMEOUT_MS);
  try {
    const response = await fetch('/api/capi-send-event', {
      method: 'POST',
      headers,
      body: JSON.stringify({ action: 'lead-status', ...change }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({})) as { error?: string };
      console.warn('[CAPI] Status event failed:', payload.error || response.statusText);
    }
  } catch (error) {
    console.warn('[CAPI] Status event failed:', error);
  } finally {
    clearTimeout(timeout);
  }
}

function persistLeads() {
  // Lead data is shared state. Firestore is the only persistent store.
}

function dispatchRealtimeError(message: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('metta-realtime-error', { detail: message }));
}

function dispatchRealtimeOk() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('metta-realtime-ok'));
}

function mergeDemoSeeds(current: Lead[]) {
  return current.filter((lead) => !isDemoLead(lead));
}

function mergeLeadLists(incoming: Lead[], existing: Lead[]) {
  const byId = new Map<string, Lead>();
  existing.forEach((lead) => byId.set(lead.id, lead));
  incoming.forEach((lead) => byId.set(lead.id, lead));
  return Array.from(byId.values()).sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
}

function setStoreLeads(remoteLeads: Lead[], replace = false) {
  const normalized = remoteLeads.map(normalizeLead);
  store.leads = replace
    ? mergeDemoSeeds(normalized)
    : mergeDemoSeeds(mergeLeadLists(normalized, store.leads.map(normalizeLead)));
}

function removeStoreLeads(ids: string[]) {
  if (!ids.length) return;
  const removed = new Set(ids);
  store.leads = store.leads.filter((lead) => !removed.has(lead.id));
}

async function deletedLeadIdsFromChanges(changes: Array<{ type: string; doc: { id: string } }>) {
  if (!USE_FIREBASE) return [];
  const removedIds = changes
    .filter((change) => change.type === 'removed')
    .map((change) => change.doc.id)
    .filter(Boolean);
  if (!removedIds.length) return [];

  const checks = await Promise.all(removedIds.map(async (id) => {
    const snap = await getDoc(doc(db!, COL_LEADS, id)).catch(() => null);
    return snap && !snap.exists() ? id : '';
  }));
  return checks.filter(Boolean);
}

function replaceLocalDemoLeads(current: Lead[]) {
  return current.filter((lead) => !isDemoLead(lead));
}

async function deleteFirestoreDemoDependencies(demoLeadIds: Set<string>) {
  if (!USE_FIREBASE) return;
  const [activitySnap, appointmentSnap] = await Promise.all([
    getDocs(collection(db!, COL_ACTIVITIES)),
    getDocs(collection(db!, COL_APPOINTMENTS)),
  ]);
  const demoActivities = activitySnap.docs
    .filter((item) => {
      const leadId = String((item.data() as LeadActivity).leadId || '');
      return isDemoLeadId(leadId) || demoLeadIds.has(leadId);
    })
    .map((item) => item.id);
  const demoAppointments = appointmentSnap.docs
    .filter((item) => isDemoAppointment({ ...(item.data() as Appointment), id: item.id }, demoLeadIds))
    .map((item) => item.id);

  await Promise.all([
    ...demoActivities.map((id) => deleteDoc(doc(db!, COL_ACTIVITIES, id)).catch(() => {})),
    ...demoAppointments.map((id) => deleteDoc(doc(db!, COL_APPOINTMENTS, id)).catch(() => {})),
  ]);
}

async function replaceFirestoreDemoLeads(current: Lead[]) {
  if (!USE_FIREBASE) return current.filter((lead) => !isDemoLead(lead));
  const demoLeads = current.filter((lead) => isDemoLead(lead));
  const demoLeadIds = new Set(demoLeads.map((lead) => lead.id).filter(Boolean));
  try {
    await Promise.all(demoLeads.map((lead) => deleteDoc(doc(db!, COL_LEADS, lead.id)).catch(() => {})));
    await deleteFirestoreDemoDependencies(demoLeadIds);
    return current.filter((lead) => !isDemoLead(lead));
  } catch (error) {
    console.warn('[Leads] Demo reset failed, keeping current data:', error);
    return current;
  }
}

async function replaceFirestoreDemoActivities(current: LeadActivity[]) {
  const demoActivities = current.filter((activity) => isDemoLeadId(activity.leadId));
  if (!demoActivities.length) return current;
  await Promise.all(demoActivities.map((activity) => deleteDoc(doc(db!, COL_ACTIVITIES, activity.id)).catch(() => {})));
  return current.filter((activity) => !isDemoLeadId(activity.leadId));
}

function loadLeads() {
  store.leads = mergeDemoSeeds(replaceLocalDemoLeads(store.leads)).map((lead) => normalizeLead(lead as Lead));
}

function persistActivities() {
  // Lead activity data is shared state. Firestore is the only persistent store.
}

function loadActivities() {
  store.leadActivities = store.leadActivities.filter((activity) => !isDemoLeadId(activity.leadId));
}

async function writeFirestoreLead(lead: Lead) {
  if (!USE_FIREBASE) return;
  await setDoc(doc(db!, COL_LEADS, lead.id), stripUndefined(lead));
}

async function writeFirestoreActivity(activity: LeadActivity) {
  if (!USE_FIREBASE) return;
  await setDoc(doc(db!, COL_ACTIVITIES, activity.id), stripUndefined(activity));
}

async function appendLeadActivity(activity: Partial<LeadActivity>) {
  const entry: LeadActivity = {
    id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    leadId: activity.leadId!,
    type: activity.type || 'note',
    content: activity.content || '',
    createdBy: activity.createdBy || currentUser()?.fullName || 'Admin',
    createdAt: now(),
  };
  await writeFirestoreActivity(entry);
  store.leadActivities.unshift(entry);
  persistActivities();
  return entry;
}

async function writeAuditLog(data: Record<string, unknown>) {
  if (!USE_FIREBASE) return;
  const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  try {
    await setDoc(doc(db!, COL_AUDIT_LOGS, id), stripUndefined({
      id,
      createdAt: now(),
      createdAtMs: Date.now(),
      ...data,
    }));
  } catch (error) {
    console.warn('[Leads] Firestore audit write failed, keeping local:', error);
  }
}

function returnedLead(lead: Lead): Lead {
  const timestamp = now();
  return {
    ...lead,
    assignedTo: '',
    assignedToName: '',
    failedAssignedTo: lead.assignedTo,
    failedAssignedToName: lead.assignedToName || lead.assignedTo,
    failedAt: timestamp,
    failedAtMs: Date.now(),
    failedReason: 'no_status_update_24h',
    assignedStatus: 'returned',
    updatedAt: timestamp,
  };
}

function validateLostReason(lead: Partial<Lead>) {
  if (lead.status !== LOST_LEAD_STATUS) return;
  if (String(lead.lostReason || '').trim()) return;
  throw new Error('Vui lòng chọn lý do mất lead trước khi chuyển trạng thái Mất lead.');
}

function validatePendingReason(lead: Partial<Lead>) {
  if (lead.status !== DEAL_QUOTED_STATUS) return;
  if (String(lead.pendingReason || '').trim()) return;
  throw new Error('Vui lòng chọn lý do pending trước khi chuyển trạng thái Đã báo phí/Chờ chốt.');
}

function validateReferralPhone(lead: Partial<Lead>) {
  if (!isReferralSource(lead.source)) return;
  if (String(lead.referralPhone || '').replace(/\D/g, '').length >= 9) return;
  throw new Error('Lead source Referral cần có SĐT phụ huynh/người giới thiệu.');
}

async function expireOverdueAssignments(user: AdminUser | null) {
  if (!canViewAllLeads(user)) return;
  const expired = store.leads.filter((lead) => leadAssignmentExpired(lead));
  for (const lead of expired) {
    const next = returnedLead(lead);
    store.leads = store.leads.map((item) => (item.id === lead.id ? next : item));
    await writeFirestoreLead(next);
    await writeAuditLog({
      type: 'lead_assignment_returned',
      leadId: lead.id,
      failedAssignedTo: lead.assignedTo,
      failedAssignedToName: lead.assignedToName || lead.assignedTo,
      reason: 'no_status_update_24h',
      actorId: 'system',
    });
    await leadService.addActivity({
      leadId: lead.id,
      type: 'note',
      content: `Lead bị trả về do không cập nhật status sau 24h. Sales cũ: ${lead.assignedToName || lead.assignedTo}`,
      createdBy: 'system',
    });
  }
  if (expired.length) persistLeads();
}

function visibleLeads(user: AdminUser | null) {
  return store.leads.map(normalizeLead).filter((lead) => canViewLead(user, lead));
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function normalizeDateStart(value?: string) {
  if (!value) return '';
  return value.length === 10 ? `${value}T00:00:00.000Z` : value;
}

function normalizeDateEnd(value?: string) {
  if (!value) return '';
  return value.length === 10 ? `${value}T23:59:59.999Z` : value;
}

function leadPageDateRange(options: LeadPageOptions) {
  return {
    dateFrom: normalizeDateStart(options.dateFrom) || daysAgoIso(options.sinceDays ?? DEFAULT_LEADS_SINCE_DAYS),
    dateTo: normalizeDateEnd(options.dateTo),
  };
}

function inLeadPageDateRange(lead: Lead, dateFrom: string, dateTo: string) {
  const createdAt = lead.createdAt || lead.updatedAt || '';
  if (!createdAt) return false;
  if (dateFrom && createdAt < dateFrom) return false;
  if (dateTo && createdAt > dateTo) return false;
  return true;
}

async function syncEnrollmentToLms(lead: Lead) {
  try {
    const [activities, appointments] = await Promise.all([
      leadService.getActivities(lead.id).catch(() => []),
      appointmentService.getByLead(lead.id).catch(() => []),
    ]);
    const result = await lmsSyncService.syncEnrollmentLead(lead, activities, appointments);
    if (result.externalId && !lead.convertedToStudentId) {
      const updatedLead = normalizeLead({ ...lead, convertedToStudentId: result.externalId, updatedAt: now() });
      await writeFirestoreLead(updatedLead);
      store.leads = store.leads.map((item) => (item.id === lead.id ? updatedLead : item));
      persistLeads();
    }
    await appendLeadActivity({
      leadId: lead.id,
      type: 'update',
      content: result.skipped ? 'LMS sync dry-run: payload enrollment da duoc build va luu log local.' : 'Da sync enrollment sang LMS.',
      createdBy: 'system',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Khong sync duoc LMS.';
    console.warn('[LMS] Enrollment sync failed:', error);
    await appendLeadActivity({
      leadId: lead.id,
      type: 'note',
      content: `LMS sync failed: ${message}`,
      createdBy: 'system',
    }).catch(() => {});
  }
}

export const leadService = {
  useCachedLeadsPage: (leads: Lead[]) => {
    setStoreLeads(leads, true);
    persistLeads();
    return visibleLeads(currentUser());
  },

  importLeads: async (rows: LeadImportInputRow[]): Promise<LeadImportResult> => {
    const token = await auth?.currentUser?.getIdToken();
    if (!token) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại trước khi import.');
    const response = await fetch('/api/app-config?id=leadImport', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ rows }),
    });
    const payload = await response.json().catch(() => ({})) as Partial<LeadImportResult> & { error?: string };
    if (!response.ok) throw new Error(payload.error || 'Không import được leads trên server.');
    if (!Array.isArray(payload.results)) throw new Error('Server trả về kết quả import không hợp lệ.');
    return {
      created: Number(payload.created || 0),
      updated: Number(payload.updated || 0),
      failed: Number(payload.failed || 0),
      results: payload.results,
    };
  },

  getNumberedLeadsPage: async (options: LeadNumberedPageOptions = {}): Promise<LeadNumberedPageResult> => {
    const pageSize = Math.max(1, Math.min(DEFAULT_LEADS_PAGE_SIZE, Math.round(options.pageSize || DEFAULT_LEADS_PAGE_SIZE)));
    const requestedPage = Math.max(1, Math.round(options.page || 1));
    const user = currentUser();
    const { dateFrom, dateTo } = leadPageDateRange(options);

    if (!USE_FIREBASE) {
      loadLeads();
      const allLeads = visibleLeads(user)
        .filter((lead) => inLeadPageDateRange(lead, dateFrom, dateTo))
        .sort((a, b) => (b.createdAt || b.updatedAt || '').localeCompare(a.createdAt || a.updatedAt || ''));
      const total = allLeads.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const page = Math.min(requestedPage, totalPages);
      return delay({
        leads: allLeads.slice((page - 1) * pageSize, page * pageSize),
        page,
        pageSize,
        total,
        totalPages,
        hasPrevious: page > 1,
        hasNext: page < totalPages,
      });
    }

    const token = await auth?.currentUser?.getIdToken();
    if (!token) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    const params = new URLSearchParams({
      page: String(requestedPage),
      pageSize: String(pageSize),
      sinceDays: String(options.sinceDays ?? DEFAULT_LEADS_SINCE_DAYS),
    });
    if (options.dateFrom) params.set('dateFrom', options.dateFrom);
    if (options.dateTo) params.set('dateTo', options.dateTo);
    params.set('id', 'leadPage');
    const response = await fetch(`/api/app-config?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json().catch(() => ({})) as Partial<LeadNumberedPageResult> & { error?: string };
    if (!response.ok) throw new Error(payload.error || 'Không tải được trang leads.');
    if (!Array.isArray(payload.leads)) throw new Error('Server trả về trang leads không hợp lệ.');

    let remoteLeads = payload.leads.map((lead) => normalizeLead(lead));
    if (canViewAllLeads(user)) remoteLeads = await replaceFirestoreDemoLeads(remoteLeads);
    setStoreLeads(remoteLeads, true);
    persistLeads();
    return {
      leads: visibleLeads(user),
      page: Number(payload.page || 1),
      pageSize: Number(payload.pageSize || pageSize),
      total: Number(payload.total || 0),
      totalPages: Number(payload.totalPages || 1),
      hasPrevious: Boolean(payload.hasPrevious),
      hasNext: Boolean(payload.hasNext),
    };
  },

  getLeadAssignmentPage: async (options: LeadAssignmentPageOptions = {}): Promise<LeadAssignmentPageResult> => {
    const pageSize = Math.max(1, Math.min(DEFAULT_LEADS_PAGE_SIZE, Math.round(options.pageSize || DEFAULT_LEADS_PAGE_SIZE)));
    const requestedPage = Math.max(1, Math.round(options.page || 1));
    const group = options.group || 'all';
    const user = currentUser();

    if (!USE_FIREBASE) {
      loadLeads();
      const activeSalesIds = new Set(store.users.filter((item) => item.role === 'sales' && item.active).map((item) => item.id));
      const grouped: Record<LeadAssignmentGroup, Lead[]> = { all: [], unassigned: [], stale: [], returned: [], assigned: [] };
      visibleLeads(user).forEach((lead) => {
        grouped.all.push(lead);
        if (lead.assignedStatus === 'returned' || lead.failedReason) grouped.returned.push(lead);
        else if (!lead.assignedTo) grouped.unassigned.push(lead);
        else if (activeSalesIds.has(lead.assignedTo)) grouped.assigned.push(lead);
        else grouped.stale.push(lead);
      });
      const groupCounts = Object.fromEntries(Object.entries(grouped).map(([key, items]) => [key, items.length])) as LeadAssignmentGroupCounts;
      const selected = grouped[group].sort((a, b) => (b.createdAt || b.updatedAt || '').localeCompare(a.createdAt || a.updatedAt || ''));
      const total = selected.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const page = Math.min(requestedPage, totalPages);
      return delay({
        leads: selected.slice((page - 1) * pageSize, page * pageSize),
        group,
        groupCounts,
        page,
        pageSize,
        total,
        totalPages,
        hasPrevious: page > 1,
        hasNext: page < totalPages,
      });
    }

    const token = await auth?.currentUser?.getIdToken();
    if (!token) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    const params = new URLSearchParams({
      id: 'leadAssignmentPage',
      group,
      page: String(requestedPage),
      pageSize: String(pageSize),
    });
    const response = await fetch(`/api/app-config?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json().catch(() => ({})) as Partial<LeadAssignmentPageResult> & { error?: string };
    if (!response.ok) throw new Error(payload.error || 'Không tải được dữ liệu phân lead.');
    if (!Array.isArray(payload.leads) || !payload.groupCounts) throw new Error('Server trả về dữ liệu phân lead không hợp lệ.');

    let remoteLeads = payload.leads.map((lead) => normalizeLead(lead));
    if (canViewAllLeads(user)) remoteLeads = await replaceFirestoreDemoLeads(remoteLeads);
    setStoreLeads(remoteLeads, true);
    persistLeads();
    return {
      leads: visibleLeads(user),
      group: payload.group || group,
      groupCounts: payload.groupCounts,
      page: Number(payload.page || 1),
      pageSize: Number(payload.pageSize || pageSize),
      total: Number(payload.total || 0),
      totalPages: Number(payload.totalPages || 1),
      hasPrevious: Boolean(payload.hasPrevious),
      hasNext: Boolean(payload.hasNext),
    };
  },

  getLeads: async () => {
    const user = currentUser();
    if (USE_FIREBASE) {
      await refreshUsersForAssignmentRepair(user);
      if (canViewAllLeads(user)) await purgeDemoDataOnServerOnce();
      if (user?.role === 'sales') {
        const snap = await getDocs(query(
          collection(db!, COL_LEADS),
          where('assignedTo', '==', user.id),
        ));
        const remoteLeads = snap.docs
          .map((item) => normalizeLead({ ...(item.data() as Lead), id: (item.data() as Lead).id || item.id }))
          .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
        store.leads = mergeDemoSeeds(remoteLeads);
      } else {
        const snap = await getDocs(query(collection(db!, COL_LEADS), orderBy('createdAt', 'desc')));
        const rawLeads = snap.docs.map((item) => ({ ...(item.data() as Lead), id: (item.data() as Lead).id || item.id }));
        let remoteLeads = rawLeads.map((lead) => normalizeLead(lead));
        await repairNormalizedAssignments(remoteLeads, rawLeads, user);
        remoteLeads = await replaceFirestoreDemoLeads(remoteLeads);
        store.leads = mergeDemoSeeds(remoteLeads);
        await expireOverdueAssignments(user);
      }
      persistLeads();
    } else {
      loadLeads();
    }
    await expireOverdueAssignments(user);
    return delay(visibleLeads(user));
  },

  getLeadsPage: async (options: LeadPageOptions = {}) => {
    const { pageSize = DEFAULT_LEADS_PAGE_SIZE, cursor } = options;
    const user = currentUser();
    const safePageSize = Math.max(1, Math.min(1000, Math.round(pageSize)));
    const { dateFrom, dateTo } = leadPageDateRange(options);

    if (!USE_FIREBASE) {
      loadLeads();
      const allLeads = visibleLeads(user)
        .filter((lead) => inLeadPageDateRange(lead, dateFrom, dateTo))
        .sort((a, b) => (b.createdAt || b.updatedAt || '').localeCompare(a.createdAt || a.updatedAt || ''));
      const startIndex = cursor?.id ? Math.max(0, allLeads.findIndex((lead) => lead.id === cursor.id) + 1) : 0;
      const page = allLeads.slice(startIndex, startIndex + safePageSize);
      const loaded = allLeads.slice(0, startIndex + page.length);
      const last = page[page.length - 1];
      return delay({
        leads: loaded,
        hasMore: allLeads.length > startIndex + page.length,
        nextCursor: last ? { createdAt: last.createdAt || last.updatedAt || '', id: last.id } : null,
      });
    }

    await refreshUsersForAssignmentRepair(user);

    const constraints = [
      ...(user?.role === 'sales' ? [where('assignedTo', '==', user.id)] : []),
      where('createdAt', '>=', dateFrom),
      ...(dateTo ? [where('createdAt', '<=', dateTo)] : []),
      orderBy('createdAt', 'desc'),
      ...(cursor?.snapshot ? [startAfter(cursor.snapshot)] : []),
      limit(safePageSize),
    ];
    const snap = await getDocs(query(collection(db!, COL_LEADS), ...constraints));
    const rawLeads = snap.docs.map((item) => ({ ...(item.data() as Lead), id: (item.data() as Lead).id || item.id }));
    let remoteLeads = rawLeads.map((lead) => normalizeLead(lead));
    await repairNormalizedAssignments(remoteLeads, rawLeads, user);
    if (canViewAllLeads(user)) remoteLeads = await replaceFirestoreDemoLeads(remoteLeads);
    setStoreLeads(remoteLeads, !cursor);
    persistLeads();
    const loadedLeads = visibleLeads(user);
    const lastDoc = snap.docs[snap.docs.length - 1];
    const lastLead = remoteLeads[remoteLeads.length - 1];
    return delay({
      leads: loadedLeads,
      hasMore: remoteLeads.length === safePageSize,
      nextCursor: lastLead && lastDoc ? { createdAt: lastLead.createdAt || lastLead.updatedAt || '', id: lastDoc.id, snapshot: lastDoc } : null,
    });
  },

  subscribeLeads: (callback: LeadSubscribeCallback, onError?: (error: unknown) => void): Unsubscribe => {
    const user = currentUser();
    if (!USE_FIREBASE) {
      void leadService.getLeads().then(callback).catch(onError);
      return () => {};
    }

    const emit = async (items: Lead[], meta: LeadSubscribeMeta = {}) => {
      try {
        setStoreLeads(items, Boolean(meta.replace));
        if (meta.removedIds?.length) removeStoreLeads(meta.removedIds);
        callback(visibleLeads(user), meta);
      } catch (error) {
        onError?.(error);
      }
    };

    const handleError = (error: unknown) => {
      console.warn('[Leads] Realtime listener failed:', error);
      dispatchRealtimeError('Leads realtime đang fallback');
      onError?.(error);
    };

    if (user?.role === 'sales') {
      let assignedLeads: Lead[] = [];
      let expiryTimer: number | undefined;
      const emitSales = () => {
        void emit(
          assignedLeads
            .map(normalizeLead)
            .sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '')),
          { replace: true },
        );
      };
      const scheduleExpiryRefresh = () => {
        if (expiryTimer) window.clearTimeout(expiryTimer);
        const nowMs = Date.now();
        const nextExpiry = assignedLeads
          .filter((lead) => lead.assignedStatus === 'active')
          .map((lead) => leadAssignmentExpiresAtMs(lead))
          .filter((value) => value > nowMs)
          .sort((a, b) => a - b)[0];
        if (nextExpiry) {
          expiryTimer = window.setTimeout(emitSales, Math.min(nextExpiry - nowMs + 1000, 2147483647));
        }
      };
      const assignedQuery = query(
        collection(db!, COL_LEADS),
        where('assignedTo', '==', user.id),
      );
      const unsubAssigned = onSnapshot(assignedQuery, (snap) => {
        dispatchRealtimeOk();
        assignedLeads = snap.docs.map((item) => ({ ...(item.data() as Lead), id: (item.data() as Lead).id || item.id }));
        scheduleExpiryRefresh();
        emitSales();
      }, handleError);
      return () => {
        if (expiryTimer) window.clearTimeout(expiryTimer);
        unsubAssigned();
      };
    }

    const leadQuery = query(collection(db!, COL_LEADS), orderBy('updatedAt', 'desc'), limit(REALTIME_LEADS_LIMIT));
    return onSnapshot(leadQuery, (snap) => {
      dispatchRealtimeOk();
      void (async () => {
        const removedIds = await deletedLeadIdsFromChanges(snap.docChanges());
        await emit(snap.docs.map((item) => item.data() as Lead), { removedIds });
      })();
    }, handleError);
  },

  getLead: async (id: string) => {
    const user = currentUser();
    if (USE_FIREBASE) {
      const snap = await getDoc(doc(db!, COL_LEADS, id));
      if (snap.exists()) {
        const remote = normalizeLead(snap.data() as Lead);
        store.leads = store.leads.some((lead) => lead.id === id)
          ? store.leads.map((lead) => (lead.id === id ? remote : lead))
          : [remote, ...store.leads];
        persistLeads();
        return delay(canViewLead(user, remote) ? remote : undefined);
      }
      return delay(undefined);
    }
    loadLeads();
    const local = store.leads.find((lead) => lead.id === id);
    return delay(local && canViewLead(user, local) ? normalizeLead(local) : undefined);
  },

  saveLead: async (lead: Partial<Lead>) => {
    const user = currentUser();
    const timestamp = now();
    const nowMs = Date.now();
    await refreshUsersForAssignmentRepair(user);
    const sourceConfigs = await sourceConfigService.getConfigs();
    lead = normalizeSalesAssignmentFields(lead);
    validateRequestedSalesAssignment(lead);
    if (lead.interestedCourse) lead = { ...lead, interestedCourse: normalizeCourse(lead.interestedCourse) as InterestedCourse | '' };
    lead = normalizeDealFields(lead);
    const displayName = leadDisplayName(lead);
    const leadSource = lead.source || 'Website';
    const warmthPercent = pendingWarmth(lead.pendingReason);
    lead = {
      ...lead,
      ...(displayName ? { fullName: displayName } : {}),
      ...((lead.source || lead.priorityLevel !== undefined || !lead.id) ? { priorityLevel: resolvedPriority(sourceConfigs, leadSource, lead.priorityLevel) } : {}),
      ...(warmthPercent !== undefined ? { pendingWarmthPercent: warmthPercent } : {}),
    };
    let assignmentNotification: { salesId: string; assignedByName?: string; auto?: boolean } | null = null;
    const activityQueue: Partial<LeadActivity>[] = [];
    let shouldSyncLms = false;
    let capiStatusChange: LeadStatusCapiChange | null = null;

    if (lead.id) {
      const prev = store.leads.find((item) => item.id === lead.id);
      if (prev && !canViewLead(user, prev)) throw new Error('Bạn không có quyền cập nhật lead này.');
      const statusChanged = prev && lead.status && lead.status !== prev.status;
      const assignmentChanged = Boolean(
        prev &&
        canViewAllLeads(user) &&
        lead.assignedTo !== undefined &&
        lead.assignedTo !== prev.assignedTo,
      );
      const assignmentNeedsRefresh = Boolean(
        prev &&
        canViewAllLeads(user) &&
        lead.assignedTo !== undefined &&
        lead.assignedTo &&
        (lead.assignedTo !== prev.assignedTo || prev.assignedStatus === 'returned' || leadAssignmentExpired(prev, nowMs)),
      );
      if (prev && statusChanged) {
        capiStatusChange = { leadId: prev.id, previousStatus: prev.status, nextStatus: lead.status! };
        activityQueue.push({
          leadId: prev.id,
          type: 'status_change',
          content: `Chuyển trạng thái từ "${prev.status}" sang "${lead.status}".`,
        });
      }
      if (prev && assignmentChanged && lead.assignedTo) {
        activityQueue.push({
          leadId: prev.id,
          type: 'assignment',
          content: `Phân lead cho ${lead.assignedToName || salesNameById(lead.assignedTo)}.`,
        });
      }
      if (prev && lead.status === DEAL_QUOTED_STATUS && lead.pendingReason && lead.pendingReason !== prev.pendingReason) {
        activityQueue.push({
          leadId: prev.id,
          type: 'note',
          content: `Cập nhật lý do pending: ${lead.pendingReason}.`,
        });
      }
      if (prev && lead.status === WON_LEAD_STATUS && statusChanged) {
        activityQueue.push({
          leadId: prev.id,
          type: 'update',
          content: `Lead đã đăng ký học. Revenue: ${revenueAmount({ ...prev, ...lead } as Lead, currentCourseDealSizes()).toLocaleString('vi-VN')} VND.`,
        });
      }
      const patch: Partial<Lead> = {
        ...lead,
        updatedAt: timestamp,
        ...(statusChanged ? {
          statusUpdatedAt: timestamp,
          statusUpdatedAtMs: nowMs,
          assignedStatus: prev?.assignedTo ? 'accepted' : prev?.assignedStatus,
          stageHistory: updateStageHistory(prev || {}, lead.status!, timestamp),
        } : {}),
      };
      const mergedForValidation = normalizeLead({ ...(prev || {}), ...patch } as Lead);
      validateReferralPhone(mergedForValidation);
      validateLostReason(mergedForValidation);
      validatePendingReason(mergedForValidation);
      if (mergedForValidation.status === DEAL_QUOTED_STATUS) {
        Object.assign(patch, financeDefaultsForLead(mergedForValidation, currentCourseDealSizes()), { revenue: undefined, revenueAt: undefined });
      }
      if (mergedForValidation.status === WON_LEAD_STATUS) {
        if (statusChanged || !prev?.revenueAt) shouldSyncLms = true;
        patch.wonAt = lead.wonAt || prev?.wonAt || timestamp;
        Object.assign(patch, financeDefaultsForLead(mergedForValidation, currentCourseDealSizes()), {
          revenue: revenueAmount(mergedForValidation, currentCourseDealSizes()),
          revenueAt: mergedForValidation.revenueAt || timestamp,
        });
      } else if (statusChanged && prev?.status === WON_LEAD_STATUS) {
        patch.wonAt = '';
        patch.revenue = undefined;
        patch.revenueAt = undefined;
      }
      if (assignmentChanged || assignmentNeedsRefresh) {
        if (lead.assignedTo) {
          patch.assignedBy = lead.assignedBy || user?.id || prev?.assignedBy || '';
          patch.assignedAt = timestamp;
          patch.assignedAtMs = nowMs;
          patch.assignedExpiresAtMs = nowMs + DAY_MS;
          patch.assignedStatus = 'active';
          patch.failedReason = '';
          patch.failedAt = '';
          patch.failedAtMs = undefined;
          assignmentNotification = {
            salesId: lead.assignedTo,
            assignedByName: user?.fullName || salesNameById(patch.assignedBy),
          };
        } else {
          patch.assignedToName = '';
          patch.assignedBy = '';
          patch.assignedAt = '';
          patch.assignedAtMs = undefined;
          patch.assignedExpiresAtMs = undefined;
          patch.assignedStatus = 'unassigned';
        }
      }
      if (!canViewAllLeads(user)) {
        delete patch.assignedTo;
        delete patch.assignedToName;
        delete patch.assignedBy;
        delete patch.assignedAt;
        delete patch.assignedAtMs;
        delete patch.assignedExpiresAtMs;
      }
      store.leads = store.leads.map((item) => (item.id === lead.id ? normalizeLead({ ...item, ...patch } as Lead) : item));
    } else {
      const salesSelfCreate = user?.role === 'sales';
      const assignedTo = salesSelfCreate ? user.id : (lead.assignedTo || '');
      const assignedToName = salesSelfCreate ? user.fullName : (lead.assignedToName || salesNameById(assignedTo));
      const assignedBy = salesSelfCreate ? user.id : (lead.assignedBy || '');
      const hasAssignment = Boolean(assignedTo);
      const assignedStatus = hasAssignment ? (salesSelfCreate ? 'accepted' : 'active') : 'unassigned';
      const draftForValidation = normalizeLead({
        id: `lead-${Date.now()}`,
        fullName: lead.fullName || '',
        parentName: lead.parentName || '',
        studentName: lead.studentName || '',
        phone: lead.phone || '',
        email: lead.email || '',
        contactType: lead.contactType || 'parent',
        age: lead.age || '',
        school: lead.school || '',
        currentClass: lead.currentClass || '',
        interestedCourse: lead.interestedCourse || '',
        currentLevel: lead.currentLevel || '',
        targetGoal: lead.targetGoal || '',
        source: leadSource,
        referralPhone: lead.referralPhone || '',
        centerName: lead.centerName || '',
        priorityLevel: resolvedPriority(sourceConfigs, leadSource, lead.priorityLevel),
        status: lead.status || leadStatuses[0],
        assignedTo,
        assignedToName,
        assignedBy,
        assignedStatus,
        assignedAt: hasAssignment ? (lead.assignedAt || timestamp) : '',
        assignedAtMs: hasAssignment ? (lead.assignedAtMs || nowMs) : undefined,
        assignedExpiresAtMs: hasAssignment && !salesSelfCreate ? (lead.assignedExpiresAtMs || nowMs + DAY_MS) : undefined,
        followUpDate: lead.followUpDate,
        consultationDate: lead.consultationDate,
        dealSize: lead.dealSize,
        dealCurrency: lead.dealCurrency || DEFAULT_DEAL_CURRENCY,
        dealPackage: lead.dealPackage || '',
        dealNote: lead.dealNote || '',
        discountPercent: lead.discountPercent,
        expectedRevenue: lead.expectedRevenue,
        revenue: lead.revenue,
        revenueAt: lead.revenueAt || (lead.status === WON_LEAD_STATUS ? timestamp : ''),
        expectedCloseDate: lead.expectedCloseDate || '',
        enrollmentType: lead.enrollmentType || 'new',
        wonAt: lead.status === WON_LEAD_STATUS ? (lead.wonAt || timestamp) : '',
        pendingReason: lead.pendingReason || '',
        pendingReasonNote: lead.pendingReasonNote || '',
        pendingWarmthPercent: pendingWarmth(lead.pendingReason) || 0,
        lostReason: lead.lostReason || '',
        lostNote: lead.lostNote || '',
        initialNote: lead.initialNote || '',
        createdAt: timestamp,
        updatedAt: timestamp,
        stageHistory: [{ status: lead.status || leadStatuses[0], enteredAt: timestamp }],
      } as Lead);
      validateReferralPhone(draftForValidation);
      validateLostReason(draftForValidation);
      validatePendingReason(draftForValidation);
      if (draftForValidation.status === WON_LEAD_STATUS) shouldSyncLms = true;
      store.leads.unshift(normalizeLead({
        ...draftForValidation,
      }));
      if (hasAssignment && !salesSelfCreate) {
        assignmentNotification = {
          salesId: assignedTo,
          assignedByName: user?.fullName,
          auto: false,
        };
      }
      activityQueue.push({
        leadId: draftForValidation.id,
        type: 'update',
        content: `Tạo lead mới từ nguồn ${draftForValidation.source || leadSource}.`,
      });
    }
    const saved = store.leads.find((item) => item.id === lead.id) || store.leads[0];
    await writeFirestoreLead(saved);
    if (capiStatusChange) await sendLeadStatusCapiEvent(capiStatusChange);
    persistLeads();
    if (assignmentNotification) {
      notifyLeadAssignment(saved, assignmentNotification.salesId, assignmentNotification.assignedByName, assignmentNotification.auto);
    }
    for (const activity of activityQueue) {
      await appendLeadActivity({ ...activity, leadId: activity.leadId || saved.id });
    }
    if (shouldSyncLms && saved?.id) await syncEnrollmentToLms(saved);
    return delay(visibleLeads(user));
  },

  deleteLead: async (id: string) => {
    const user = currentUser();
    if (!canDeleteLead(user)) throw new Error('Chỉ Admin và Manager mới có quyền xóa lead.');
    await appointmentService.deleteAllForLead(id);
    if (USE_FIREBASE) {
      const activitySnap = await getDocs(query(collection(db!, COL_ACTIVITIES), where('leadId', '==', id)));
      await Promise.all(activitySnap.docs.map((item) => deleteDoc(item.ref)));
      await deleteDoc(doc(db!, COL_LEADS, id));
    }
    store.leads = store.leads.filter((lead) => lead.id !== id);
    store.leadActivities = store.leadActivities.filter((activity) => activity.leadId !== id);
    persistLeads();
    persistActivities();
    // Sync xóa toàn bộ lịch hẹn liên quan đến lead này
    return delay(true);
  },

  getActivities: async (leadId: string) => {
    if (USE_FIREBASE) {
      const activityQuery = query(
        collection(db!, COL_ACTIVITIES),
        where('leadId', '==', leadId),
        orderBy('createdAt', 'desc'),
      );
      const snap = await getDocs(activityQuery);
      const remoteActivities = snap.docs.map((item) => ({ ...item.data(), id: item.id }) as LeadActivity);
      store.leadActivities = [
        ...store.leadActivities.filter((activity) => activity.leadId !== leadId),
        ...remoteActivities,
      ];
      persistActivities();
    } else {
      loadActivities();
    }
    return delay(store.leadActivities.filter((activity) => activity.leadId === leadId));
  },

  addActivity: async (activity: Partial<LeadActivity>) => {
    await appendLeadActivity(activity);
    return delay(store.leadActivities);
  },

  publicSubmit: async (lead: PublicLeadSubmitInput, formId = 'consultation-form') => {
    const parentName = String(lead.parentName || '').replace(/\s+/g, ' ').trim();
    const studentName = String(lead.studentName || lead.fullName || '').replace(/\s+/g, ' ').trim();
    if (!parentName || !studentName || !lead.phone) throw new Error('Thiếu họ tên phụ huynh, họ tên bé hoặc số điện thoại.');
    const response = await fetch('/api/public-lead-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...lead,
        fullName: studentName,
        parentName,
        studentName,
        formId,
        sourceUrl: lead.sourceUrl || window.location.href,
        pageSlug: lead.pageSlug || window.location.pathname.replace(/^\/+/, ''),
        tracking: { ...captureLeadTracking(), ...lead.tracking },
      }),
    });
    const payload = await response.json().catch(() => ({})) as { leadId?: string; error?: string };
    if (!response.ok) throw new Error(payload.error || 'Không gửi được thông tin. Vui lòng thử lại.');
    return delay({
      id: payload.leadId || `lead-${Date.now()}`,
      ...lead,
      formId,
    });
  },

  assignLeads: async (leadIds: string[], sales: AdminUser, assignedBy: AdminUser) => {
    if (!canViewAllLeads(assignedBy)) throw new Error('Bạn không có quyền phân lead.');
    if (sales.role !== 'sales' || !sales.active) throw new Error('Chỉ được phân cho user sales đang active.');
    const requestedIds = Array.from(new Set(leadIds.filter(Boolean)));
    const existingIds = new Set(store.leads.map((lead) => lead.id));
    const missingIds = requestedIds.filter((id) => !existingIds.has(id));
    if (USE_FIREBASE && missingIds.length) {
      const snaps = await Promise.all(missingIds.map((id) => getDoc(doc(db!, COL_LEADS, id))));
      const fetchedLeads = snaps
        .filter((snap) => snap.exists())
        .map((snap) => normalizeLead({ ...(snap.data() as Lead), id: (snap.data() as Lead).id || snap.id }));
      setStoreLeads(fetchedLeads, false);
    }
    const availableIds = new Set(store.leads.map((lead) => lead.id));
    const notFoundIds = requestedIds.filter((id) => !availableIds.has(id));
    if (notFoundIds.length) throw new Error(`Khong tim thay ${notFoundIds.length} lead can phan.`);
    const timestamp = now();
    const assignedAtMs = Date.now();
    const assignedExpiresAtMs = assignedAtMs + DAY_MS;
    const changed: Lead[] = [];
    const reassignedLeadIds = new Set<string>();

    store.leads = store.leads.map((lead) => {
      if (!requestedIds.includes(lead.id)) return lead;
      const wasAssigned = Boolean(lead.assignedTo || lead.assignedToName);
      if (wasAssigned) reassignedLeadIds.add(lead.id);
      const next: Lead = {
        ...lead,
        assignedTo: sales.id,
        assignedToName: sales.fullName,
        assignedBy: assignedBy.id,
        assignedAt: timestamp,
        assignedAtMs,
        assignedExpiresAtMs,
        assignedStatus: 'active',
        failedAssignedTo: '',
        failedAssignedToName: '',
        failedAt: '',
        failedAtMs: 0,
        failedReason: '',
        updatedAt: timestamp,
      };
      changed.push(next);
      return next;
    });

    await Promise.all(changed.map(async (lead) => {
      await writeFirestoreLead(lead);
      await writeAuditLog({
        type: reassignedLeadIds.has(lead.id) ? 'lead_reassigned' : 'lead_assigned',
        leadId: lead.id,
        assignedTo: sales.id,
        assignedToName: sales.fullName,
        assignedBy: assignedBy.id,
        assignedByName: assignedBy.fullName,
      });
      await leadService.addActivity({
        leadId: lead.id,
        type: 'note',
        content: `Phân lead cho ${sales.fullName}`,
        createdBy: assignedBy.fullName,
      });
      notifyLeadAssignment(lead, sales.id, assignedBy.fullName);
    }));
    persistLeads();
    return delay(changed);
  },
};
