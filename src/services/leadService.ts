import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { STAGE_DEMO_LEAD_PREFIX } from '@/data/stageDemoLeads';
import { DEAL_QUOTED_STATUS, DEFAULT_DEAL_CURRENCY, LOST_LEAD_STATUS, WON_LEAD_STATUS, leadStatuses, pendingReasonOptions } from '@/lib/constants';
import { isReferralSource, normalizeStageHistory, updateStageHistory } from '@/lib/leadAnalytics';
import { financeDefaultsForLead, revenueAmount } from '@/lib/leadFinance';
import { canDeleteLead, canViewAllLeads, canViewLead, leadAssignmentExpired } from '@/lib/permissions';
import { appointmentService } from '@/services/appointmentService';
import { chooseAutoAssignedSales } from '@/services/assignmentRuleService';
import { currentUser } from '@/services/authService';
import { lmsSyncService } from '@/services/lmsSyncService';
import { notificationService } from '@/services/notificationService';
import { sourceConfigService, sourcePriority } from '@/services/sourceConfigService';
import { delay, store } from '@/services/store';
import type { InterestedCourse, Lead, LeadActivity } from '@/types/crm';
import type { AdminUser } from '@/types/user';

const now = () => new Date().toISOString();
const USE_FIREBASE = isFirebaseConfigured && !!db;
const ENABLE_STAGE_DEMO_SEED = import.meta.env.DEV;
const COL_LEADS = 'leads';
const COL_ACTIVITIES = 'leadActivities';
const COL_AUDIT_LOGS = 'activityLogs';
const LS_LEADS = 'metta_leads';
const LS_ACTIVITIES = 'metta_lead_activities';
const LS_FINANCE_DEMO_MIGRATION = 'metta_lead_finance_demo_seed_v1';
const LS_STAGE_DEMO_MIGRATION = 'metta_lead_stage_demo_seed_v1';
const LS_DEMO_RESET_LOCAL = 'metta_lead_demo_reset_v6';
const LS_DEMO_RESET_FIRESTORE = 'metta_lead_demo_firestore_reset_v6';
const FINANCE_DEMO_ID_PREFIX = 'lead-demo-priority-';
const DAY_MS = 24 * 60 * 60 * 1000;
const financeDemoSeedLeads = store.leads.filter((lead) => lead.id.startsWith(FINANCE_DEMO_ID_PREFIX));
const stageDemoSeedLeads = store.leads.filter((lead) => lead.id.startsWith(STAGE_DEMO_LEAD_PREFIX));

type PublicLeadSubmitInput = Partial<Lead> & {
  company?: string;
  website?: string;
  formId?: string;
  pageSlug?: string;
  sourceUrl?: string;
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
  return id.startsWith(STAGE_DEMO_LEAD_PREFIX)
    || id.startsWith(FINANCE_DEMO_ID_PREFIX)
    || /^lead-[1-5]$/.test(id)
    || /^lead-x\d+$/.test(id)
    || email.includes('@metta.test')
    || email.includes('@example.com');
}

function salesNameById(id?: string) {
  if (!id) return '';
  return store.users.find((user) => user.id === id)?.fullName || id;
}

function activeSalesUsers() {
  return store.users.filter((user) => user.role === 'sales' && user.active);
}

function findSalesByNameHint(hint: string, fallbackIndex: number) {
  const salesUsers = activeSalesUsers();
  const normalizedHint = hint.toLowerCase();
  return salesUsers.find((sales) => sales.fullName.toLowerCase().includes(normalizedHint))
    || salesUsers[fallbackIndex]
    || salesUsers[0];
}

function legacySalesUser(idOrName?: string, displayName?: string) {
  const key = `${idOrName || ''} ${displayName || ''}`.toLowerCase();
  if (key.includes('ms. linh') || key.includes('linh') || key.includes('u2')) return findSalesByNameHint('linh', 1);
  if (key.includes('teacher an') || key.includes('u3')) return findSalesByNameHint('chi', 0);
  return undefined;
}

function shouldRepointSales(idOrName: string | undefined, displayName: string | undefined, sales: AdminUser) {
  const key = `${idOrName || ''} ${displayName || ''}`.toLowerCase();
  return key.includes('ms. linh')
    || key.includes('teacher an')
    || key.includes('u2')
    || key.includes('u3')
    || Boolean(displayName && displayName === sales.fullName && idOrName !== sales.id);
}

function normalizeLeadSales(lead: Lead) {
  const assigned = legacySalesUser(lead.assignedTo, lead.assignedToName);
  if (assigned && shouldRepointSales(lead.assignedTo, lead.assignedToName, assigned)) {
    lead.assignedTo = assigned.id;
    lead.assignedToName = assigned.fullName;
  }

  const failedAssigned = legacySalesUser(lead.failedAssignedTo, lead.failedAssignedToName);
  if (failedAssigned && shouldRepointSales(lead.failedAssignedTo, lead.failedAssignedToName, failedAssigned)) {
    lead.failedAssignedTo = failedAssigned.id;
    lead.failedAssignedToName = failedAssigned.fullName;
  }
}

function demoPhoneFromIndex(globalIndex: number) {
  return `09${String(71000000 + globalIndex * 13791).padStart(8, '0').slice(0, 8)}`;
}

function referralPhoneFromDemoLeadId(id?: string) {
  const match = String(id || '').match(/^lead-demo-stage-(\d+)-(\d+)$/);
  if (!match) return '';
  const stageIndex = Number(match[1]) - 1;
  const indexInStage = Number(match[2]) - 1;
  if (!Number.isFinite(stageIndex) || !Number.isFinite(indexInStage) || stageIndex < 0 || indexInStage < 0) return '';
  const globalIndex = stageIndex * 10 + indexInStage;
  const referrerIndex = Math.max(0, globalIndex - ((globalIndex % 9) + 1));
  return demoPhoneFromIndex(referrerIndex);
}

function repairReferralPhone(lead: Lead) {
  if (!isReferralSource(lead.source)) {
    lead.referralPhone = lead.referralPhone || '';
    return;
  }

  if (String(lead.referralPhone || '').replace(/\D/g, '').length >= 9) return;
  const demoReferralPhone = referralPhoneFromDemoLeadId(lead.id);
  if (demoReferralPhone) lead.referralPhone = demoReferralPhone;
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

function normalizeLead(raw: Lead): Lead {
  const lead = { ...raw, interestedCourse: normalizeCourse(raw.interestedCourse) as InterestedCourse | '' };
  normalizeLeadSales(lead);
  repairReferralPhone(lead);
  if (!lead.studentName && lead.contactType === 'student' && lead.fullName) lead.studentName = lead.fullName;
  if (!lead.parentName && lead.contactType !== 'student' && lead.fullName) lead.parentName = lead.fullName;
  if (!lead.fullName) lead.fullName = leadDisplayName(lead);
  if (!lead.assignedStatus) lead.assignedStatus = lead.assignedTo ? 'accepted' : 'unassigned';
  if (!lead.priorityLevel) lead.priorityLevel = 1;
  if (lead.pendingReason && !lead.pendingWarmthPercent) lead.pendingWarmthPercent = pendingWarmth(lead.pendingReason) || 0;
  if (lead.status === DEAL_QUOTED_STATUS || lead.status === WON_LEAD_STATUS) {
    Object.assign(lead, financeDefaultsForLead(lead));
  }
  if (lead.status === WON_LEAD_STATUS && !lead.revenue) {
    lead.revenue = revenueAmount(lead);
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

function persistLeads() {
  try { localStorage.setItem(LS_LEADS, JSON.stringify(store.leads)); } catch {}
}

function mergeMissingSeedLeads(current: Lead[], seedLeads: Lead[]) {
  const existingIds = new Set(current.map((lead) => lead?.id).filter(Boolean));
  const missingDemoLeads = seedLeads.filter((lead) => !existingIds.has(lead.id));
  return missingDemoLeads.length ? [...missingDemoLeads, ...current] : current;
}

function mergeSeedLeads(current: Lead[], seedLeads: Lead[], migrationKey: string) {
  if (localStorage.getItem(migrationKey)) return current;
  const merged = mergeMissingSeedLeads(current, seedLeads);
  localStorage.setItem(migrationKey, '1');
  return merged;
}

function mergeDemoSeeds(current: Lead[]) {
  const mergedFinanceDemo = mergeSeedLeads(current, financeDemoSeedLeads, LS_FINANCE_DEMO_MIGRATION);
  if (!ENABLE_STAGE_DEMO_SEED) {
    return mergeSeedLeads(mergedFinanceDemo, stageDemoSeedLeads, LS_STAGE_DEMO_MIGRATION);
  }
  localStorage.setItem(LS_STAGE_DEMO_MIGRATION, '1');
  return mergeMissingSeedLeads(mergedFinanceDemo, stageDemoSeedLeads);
}

function replaceLocalDemoLeads(current: Lead[]) {
  if (!ENABLE_STAGE_DEMO_SEED || localStorage.getItem(LS_DEMO_RESET_LOCAL)) return current;
  localStorage.setItem(LS_FINANCE_DEMO_MIGRATION, '1');
  localStorage.setItem(LS_STAGE_DEMO_MIGRATION, '1');
  localStorage.setItem(LS_DEMO_RESET_LOCAL, '1');
  const nonDemo = current.filter((lead) => !isDemoLead(lead));
  return [...stageDemoSeedLeads, ...nonDemo];
}

async function replaceFirestoreDemoLeads(current: Lead[]) {
  if (!USE_FIREBASE || !ENABLE_STAGE_DEMO_SEED || localStorage.getItem(LS_DEMO_RESET_FIRESTORE)) return current;
  if (!auth?.currentUser) {
    localStorage.setItem(LS_DEMO_RESET_FIRESTORE, '1');
    const nonDemo = current.filter((lead) => !isDemoLead(lead));
    return [...stageDemoSeedLeads.map(normalizeLead), ...nonDemo];
  }
  const demoLeads = current.filter((lead) => isDemoLead(lead));
  try {
    await Promise.all(demoLeads.map((lead) => deleteDoc(doc(db!, COL_LEADS, lead.id)).catch(() => {})));
    await Promise.all(stageDemoSeedLeads.map((lead) => writeFirestoreLead(normalizeLead(lead))));
    localStorage.setItem(LS_DEMO_RESET_FIRESTORE, '1');
    const nonDemo = current.filter((lead) => !isDemoLead(lead));
    return [...stageDemoSeedLeads.map(normalizeLead), ...nonDemo];
  } catch (error) {
    console.warn('[Leads] Demo reset failed, keeping current data:', error);
    return current;
  }
}

function loadLeads() {
  try {
    const raw = localStorage.getItem(LS_LEADS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        const merged = mergeDemoSeeds(replaceLocalDemoLeads(parsed));
        store.leads = merged.map((lead) => normalizeLead(lead as Lead));
        persistLeads();
      }
    }
  } catch {}
}

function persistActivities() {
  try { localStorage.setItem(LS_ACTIVITIES, JSON.stringify(store.leadActivities)); } catch {}
}

function loadActivities() {
  try {
    const raw = localStorage.getItem(LS_ACTIVITIES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) store.leadActivities = parsed;
    }
  } catch {}
}

async function writeFirestoreLead(lead: Lead) {
  if (!USE_FIREBASE) return;
  try {
    await setDoc(doc(db!, COL_LEADS, lead.id), stripUndefined(lead));
  } catch (error) {
    console.warn('[Leads] Firestore lead write failed, keeping local:', error);
  }
}

async function syncMissingStageDemoLeadsToFirestore(current: Lead[]) {
  if (!USE_FIREBASE || !ENABLE_STAGE_DEMO_SEED) return;
  const existingIds = new Set(current.map((lead) => lead.id));
  const missingDemoLeads = stageDemoSeedLeads.filter((lead) => !existingIds.has(lead.id));
  for (const lead of missingDemoLeads) await writeFirestoreLead(normalizeLead(lead));
}

async function writeFirestoreActivity(activity: LeadActivity) {
  if (!USE_FIREBASE) return;
  try {
    await setDoc(doc(db!, COL_ACTIVITIES, activity.id), stripUndefined(activity));
  } catch (error) {
    console.warn('[Leads] Firestore activity write failed, keeping local:', error);
  }
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
  store.leadActivities.unshift(entry);
  persistActivities();
  await writeFirestoreActivity(entry);
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

async function syncEnrollmentToLms(lead: Lead) {
  try {
    const [activities, appointments] = await Promise.all([
      leadService.getActivities(lead.id).catch(() => []),
      appointmentService.getByLead(lead.id).catch(() => []),
    ]);
    const result = await lmsSyncService.syncEnrollmentLead(lead, activities, appointments);
    if (result.externalId && !lead.convertedToStudentId) {
      const updatedLead = normalizeLead({ ...lead, convertedToStudentId: result.externalId, updatedAt: now() });
      store.leads = store.leads.map((item) => (item.id === lead.id ? updatedLead : item));
      persistLeads();
      await writeFirestoreLead(updatedLead);
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
  getLeads: async () => {
    const user = currentUser();
    loadLeads();
    if (USE_FIREBASE) {
      try {
        if (user?.role === 'sales') {
          const nowMs = Date.now();
          const activeSnap = await getDocs(query(
            collection(db!, COL_LEADS),
            where('assignedTo', '==', user.id),
            where('assignedStatus', '==', 'active'),
            where('assignedExpiresAtMs', '>', nowMs),
          ));
          const acceptedSnap = await getDocs(query(
            collection(db!, COL_LEADS),
            where('assignedTo', '==', user.id),
            where('assignedStatus', '==', 'accepted'),
          ));
          const remoteLeads = [...activeSnap.docs, ...acceptedSnap.docs].map((item) => normalizeLead(item.data() as Lead));
          if (remoteLeads.length || !store.leads.length) store.leads = ENABLE_STAGE_DEMO_SEED ? mergeDemoSeeds(remoteLeads) : remoteLeads;
        } else {
          const snap = await getDocs(query(collection(db!, COL_LEADS), orderBy('createdAt', 'desc')));
          let remoteLeads = snap.docs.map((item) => normalizeLead(item.data() as Lead));
          remoteLeads = await replaceFirestoreDemoLeads(remoteLeads);
          if (remoteLeads.length || !store.leads.length) {
            store.leads = ENABLE_STAGE_DEMO_SEED ? mergeDemoSeeds(remoteLeads) : remoteLeads;
            await syncMissingStageDemoLeadsToFirestore(remoteLeads);
          }
          await expireOverdueAssignments(user);
        }
        persistLeads();
      } catch (error) {
        console.warn('[Leads] Firestore read failed, using local:', error);
      }
    }
    await expireOverdueAssignments(user);
    return delay(visibleLeads(user));
  },

  getLead: async (id: string) => {
    const user = currentUser();
    loadLeads();
    if (USE_FIREBASE) {
      try {
        const snap = await getDoc(doc(db!, COL_LEADS, id));
        if (snap.exists()) {
          const remote = normalizeLead(snap.data() as Lead);
          store.leads = store.leads.some((lead) => lead.id === id)
            ? store.leads.map((lead) => (lead.id === id ? remote : lead))
            : [remote, ...store.leads];
          persistLeads();
          return delay(canViewLead(user, remote) ? remote : undefined);
        }
      } catch (error) {
        console.warn('[Leads] Firestore lead detail read failed, using local:', error);
      }
    }
    const local = store.leads.find((lead) => lead.id === id);
    return delay(local && canViewLead(user, local) ? normalizeLead(local) : undefined);
  },

  saveLead: async (lead: Partial<Lead>) => {
    const user = currentUser();
    const timestamp = now();
    const nowMs = Date.now();
    const sourceConfigs = await sourceConfigService.getConfigs();
    if (lead.interestedCourse) lead = { ...lead, interestedCourse: normalizeCourse(lead.interestedCourse) as InterestedCourse | '' };
    lead = normalizeDealFields(lead);
    const displayName = leadDisplayName(lead);
    const leadSource = lead.source || 'Website';
    const warmthPercent = pendingWarmth(lead.pendingReason);
    lead = {
      ...lead,
      ...(displayName ? { fullName: displayName } : {}),
      ...((lead.source || !lead.id) ? { priorityLevel: sourcePriority(sourceConfigs, leadSource, lead.priorityLevel) } : {}),
      ...(warmthPercent !== undefined ? { pendingWarmthPercent: warmthPercent } : {}),
    };
    let assignmentNotification: { salesId: string; assignedByName?: string; auto?: boolean } | null = null;
    const activityQueue: Partial<LeadActivity>[] = [];
    let shouldSyncLms = false;

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
      if (prev && statusChanged) {
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
          content: `Lead đã đăng ký học. Revenue: ${revenueAmount({ ...prev, ...lead } as Lead).toLocaleString('vi-VN')} VND.`,
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
        Object.assign(patch, financeDefaultsForLead(mergedForValidation), { revenue: undefined, revenueAt: undefined });
      }
      if (mergedForValidation.status === WON_LEAD_STATUS) {
        if (statusChanged || !prev?.revenueAt) shouldSyncLms = true;
        patch.wonAt = lead.wonAt || prev?.wonAt || timestamp;
        Object.assign(patch, financeDefaultsForLead(mergedForValidation), {
          revenue: revenueAmount(mergedForValidation),
          revenueAt: mergedForValidation.revenueAt || timestamp,
        });
      } else if (statusChanged && prev?.status === WON_LEAD_STATUS) {
        patch.wonAt = '';
        patch.revenue = undefined;
        patch.revenueAt = undefined;
      }
      if (assignmentChanged) {
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
      if (user?.role === 'sales') throw new Error('Sales không được tạo lead trực tiếp.');
      const autoAssignedSales = lead.assignedTo ? null : chooseAutoAssignedSales(store.leads.map(normalizeLead), store.users);
      const assignedTo = lead.assignedTo || autoAssignedSales?.salesId || '';
      const assignedToName = lead.assignedToName || autoAssignedSales?.salesName || salesNameById(assignedTo);
      const assignedBy = lead.assignedBy || (autoAssignedSales ? 'auto-assignment-rule' : '');
      const hasAssignment = Boolean(assignedTo);
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
        priorityLevel: sourcePriority(sourceConfigs, leadSource, lead.priorityLevel),
        status: lead.status || leadStatuses[0],
        assignedTo,
        assignedToName,
        assignedBy,
        assignedStatus: hasAssignment ? 'active' : 'unassigned',
        assignedAt: hasAssignment ? (lead.assignedAt || timestamp) : '',
        assignedAtMs: hasAssignment ? (lead.assignedAtMs || nowMs) : undefined,
        assignedExpiresAtMs: hasAssignment ? (lead.assignedExpiresAtMs || nowMs + DAY_MS) : undefined,
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
      if (hasAssignment) {
        assignmentNotification = {
          salesId: assignedTo,
          assignedByName: autoAssignedSales ? 'Auto rule' : user?.fullName,
          auto: Boolean(autoAssignedSales),
        };
      }
      activityQueue.push({
        leadId: draftForValidation.id,
        type: 'update',
        content: `Tạo lead mới từ nguồn ${draftForValidation.source || leadSource}.`,
      });
    }
    const saved = store.leads.find((item) => item.id === lead.id) || store.leads[0];
    persistLeads();
    await writeFirestoreLead(saved);
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
    store.leads = store.leads.filter((lead) => lead.id !== id);
    store.leadActivities = store.leadActivities.filter((activity) => activity.leadId !== id);
    persistLeads();
    persistActivities();
    if (USE_FIREBASE) {
      try { await deleteDoc(doc(db!, COL_LEADS, id)); } catch {}
    }
    // Sync xóa toàn bộ lịch hẹn liên quan đến lead này
    try { await appointmentService.deleteAllForLead(id); } catch {}
    return delay(true);
  },

  getActivities: async (leadId: string) => {
    const user = currentUser();
    loadActivities();
    if (USE_FIREBASE) {
      try {
        const activityQuery = user?.role === 'sales'
          ? query(collection(db!, COL_ACTIVITIES), where('leadId', '==', leadId), orderBy('createdAt', 'desc'))
          : query(collection(db!, COL_ACTIVITIES), orderBy('createdAt', 'desc'));
        const snap = await getDocs(activityQuery);
        store.leadActivities = snap.docs.map((item) => item.data() as LeadActivity);
        persistActivities();
      } catch {}
    }
    return delay(store.leadActivities.filter((activity) => activity.leadId === leadId));
  },

  addActivity: async (activity: Partial<LeadActivity>) => {
    await appendLeadActivity(activity);
    return delay(store.leadActivities);
  },

  publicSubmit: async (lead: PublicLeadSubmitInput, formId = 'consultation-form') => {
    const displayName = leadDisplayName(lead);
    if (!displayName || !lead.phone) throw new Error('Thiếu họ tên hoặc số điện thoại.');
    const response = await fetch('/api/public-lead-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...lead,
        fullName: displayName,
        formId,
        sourceUrl: lead.sourceUrl || window.location.href,
        pageSlug: lead.pageSlug || window.location.pathname.replace(/^\/+/, ''),
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
    await leadService.getLeads();
    const timestamp = now();
    const assignedAtMs = Date.now();
    const assignedExpiresAtMs = assignedAtMs + DAY_MS;
    const changed: Lead[] = [];

    store.leads = store.leads.map((lead) => {
      if (!leadIds.includes(lead.id)) return lead;
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

    persistLeads();
    await Promise.all(changed.map(async (lead) => {
      await writeFirestoreLead(lead);
      await writeAuditLog({
        type: lead.failedAssignedTo ? 'lead_reassigned' : 'lead_assigned',
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
    return delay(changed);
  },
};
