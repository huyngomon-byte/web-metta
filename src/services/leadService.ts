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
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { canDeleteLead, canViewAllLeads, canViewLead, leadAssignmentExpired } from '@/lib/permissions';
import { appointmentService } from '@/services/appointmentService';
import { currentUser } from '@/services/authService';
import { delay, store } from '@/services/store';
import type { InterestedCourse, Lead, LeadActivity } from '@/types/crm';
import type { AdminUser } from '@/types/user';

const now = () => new Date().toISOString();
const USE_FIREBASE = isFirebaseConfigured && !!db;
const COL_LEADS = 'leads';
const COL_ACTIVITIES = 'leadActivities';
const COL_AUDIT_LOGS = 'activityLogs';
const LS_LEADS = 'metta_leads';
const LS_ACTIVITIES = 'metta_lead_activities';
const DAY_MS = 24 * 60 * 60 * 1000;

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

function normalizeLead(raw: Lead): Lead {
  const lead = { ...raw, interestedCourse: normalizeCourse(raw.interestedCourse) as InterestedCourse | '' };
  if (!lead.assignedStatus) lead.assignedStatus = lead.assignedTo ? 'accepted' : 'unassigned';
  if (!lead.assignedToName && lead.assignedTo && !lead.assignedTo.includes('-') && !lead.assignedTo.startsWith('uid')) {
    lead.assignedToName = lead.assignedTo;
  }
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

function loadLeads() {
  try {
    const raw = localStorage.getItem(LS_LEADS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) store.leads = parsed;
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
  await setDoc(doc(db!, COL_LEADS, lead.id), stripUndefined(lead));
}

async function writeFirestoreActivity(activity: LeadActivity) {
  if (!USE_FIREBASE) return;
  await setDoc(doc(db!, COL_ACTIVITIES, activity.id), stripUndefined(activity));
}

async function writeAuditLog(data: Record<string, unknown>) {
  if (!USE_FIREBASE) return;
  const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await setDoc(doc(db!, COL_AUDIT_LOGS, id), stripUndefined({
    id,
    createdAt: now(),
    createdAtMs: Date.now(),
    ...data,
  }));
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
          store.leads = [...activeSnap.docs, ...acceptedSnap.docs].map((item) => normalizeLead(item.data() as Lead));
        } else {
          const snap = await getDocs(query(collection(db!, COL_LEADS), orderBy('createdAt', 'desc')));
          store.leads = snap.docs.map((item) => normalizeLead(item.data() as Lead));
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
    if (lead.interestedCourse) lead = { ...lead, interestedCourse: normalizeCourse(lead.interestedCourse) as InterestedCourse | '' };

    if (lead.id) {
      const prev = store.leads.find((item) => item.id === lead.id);
      if (prev && !canViewLead(user, prev)) throw new Error('Bạn không có quyền cập nhật lead này.');
      const statusChanged = prev && lead.status && lead.status !== prev.status;
      const patch: Partial<Lead> = {
        ...lead,
        updatedAt: timestamp,
        ...(statusChanged ? {
          statusUpdatedAt: timestamp,
          statusUpdatedAtMs: Date.now(),
          assignedStatus: prev?.assignedTo ? 'accepted' : prev?.assignedStatus,
        } : {}),
      };
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
      store.leads.unshift(normalizeLead({
        id: `lead-${Date.now()}`,
        fullName: lead.fullName || '',
        phone: lead.phone || '',
        email: lead.email || '',
        contactType: lead.contactType || 'parent',
        age: lead.age || '',
        school: lead.school || '',
        currentClass: lead.currentClass || '',
        interestedCourse: lead.interestedCourse || '',
        currentLevel: lead.currentLevel || '',
        targetGoal: lead.targetGoal || '',
        source: lead.source || 'Website',
        status: lead.status || 'Lead mới',
        assignedTo: lead.assignedTo || '',
        assignedToName: lead.assignedToName || '',
        assignedStatus: lead.assignedTo ? 'active' : 'unassigned',
        followUpDate: lead.followUpDate,
        consultationDate: lead.consultationDate,
        initialNote: lead.initialNote || '',
        createdAt: timestamp,
        updatedAt: timestamp,
      } as Lead));
    }
    const saved = store.leads.find((item) => item.id === lead.id) || store.leads[0];
    persistLeads();
    await writeFirestoreLead(saved);
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
    return delay(store.leadActivities);
  },

  publicSubmit: async (lead: PublicLeadSubmitInput, formId = 'consultation-form') => {
    if (!lead.fullName || !lead.phone) throw new Error('Thiếu họ tên hoặc số điện thoại.');
    const response = await fetch('/api/public-lead-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...lead,
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
    }));
    return delay(changed);
  },
};
