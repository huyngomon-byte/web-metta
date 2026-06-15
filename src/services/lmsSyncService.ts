import { DEFAULT_DEAL_CURRENCY } from '@/lib/constants';
import { expectedRevenueAmount, revenueAmount } from '@/lib/leadFinance';
import type { Appointment, Lead, LeadActivity } from '@/types/crm';
import type { LmsEnrollmentPayload, LmsSyncLogEntry, LmsSyncResult } from '@/types/lms';

let cachedLogs: LmsSyncLogEntry[] = [];

const now = () => new Date().toISOString();

function safeString(value: unknown) {
  return String(value || '').trim();
}

function enrollmentEventId(lead: Lead) {
  const marker = lead.revenueAt || lead.wonAt || lead.statusUpdatedAt || lead.updatedAt || now();
  return `lms_${lead.id}_${marker}`.replace(/[^a-zA-Z0-9_-]/g, '_');
}

function studentExternalId(lead: Lead) {
  return lead.convertedToStudentId || `crm-${lead.id}`;
}

function readLogs(): LmsSyncLogEntry[] {
  return cachedLogs;
}

function writeLog(entry: LmsSyncLogEntry) {
  cachedLogs = [entry, ...readLogs()].slice(0, 200);
}

export function buildLmsEnrollmentPayload(
  lead: Lead,
  activities: LeadActivity[] = [],
  appointments: Appointment[] = [],
): LmsEnrollmentPayload {
  const revenue = revenueAmount(lead);
  return {
    schemaVersion: 'metta-lms-enrollment-v1',
    eventId: enrollmentEventId(lead),
    eventName: lead.convertedToStudentId ? 'enrollment.updated' : 'enrollment.created',
    occurredAt: now(),
    lead: {
      id: lead.id,
      status: lead.status,
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
      statusUpdatedAt: lead.statusUpdatedAt,
    },
    parent: {
      name: safeString(lead.parentName || lead.fullName),
      phone: safeString(lead.phone),
      email: safeString(lead.email),
      referralPhone: safeString(lead.referralPhone),
    },
    student: {
      name: safeString(lead.studentName || lead.fullName),
      age: safeString(lead.age),
      school: safeString(lead.school),
      currentClass: safeString(lead.currentClass),
    },
    enrollment: {
      studentExternalId: studentExternalId(lead),
      interestedCourse: safeString(lead.interestedCourse),
      centerName: safeString(lead.centerName),
      enrollmentType: lead.enrollmentType,
      wonAt: lead.wonAt,
      expectedCloseDate: lead.expectedCloseDate,
    },
    finance: {
      dealSize: Number(lead.dealSize || 0),
      discountPercent: Number(lead.discountPercent || 0),
      expectedRevenue: expectedRevenueAmount(lead),
      revenue,
      currency: lead.dealCurrency || DEFAULT_DEAL_CURRENCY,
      dealPackage: lead.dealPackage,
      dealNote: lead.dealNote,
    },
    crm: {
      ownerId: safeString(lead.assignedTo),
      ownerName: safeString(lead.assignedToName || lead.assignedTo),
      source: safeString(lead.source),
      priorityLevel: Number(lead.priorityLevel || 0),
      pendingReason: lead.pendingReason,
      pendingWarmthPercent: lead.pendingWarmthPercent,
      lostReason: lead.lostReason,
      initialNote: safeString(lead.initialNote),
      stageHistory: lead.stageHistory || [],
      activities,
      appointments,
    },
    raw: { lead },
  };
}

export const lmsSyncService = {
  getLogs: () => readLogs(),

  syncEnrollmentLead: async (
    lead: Lead,
    activities: LeadActivity[] = [],
    appointments: Appointment[] = [],
  ): Promise<LmsSyncResult> => {
    const payload = buildLmsEnrollmentPayload(lead, activities, appointments);
    const localDryRun = import.meta.env.DEV && import.meta.env.VITE_ENABLE_LMS_SYNC_DEV !== 'true';
    if (localDryRun) {
      const result: LmsSyncResult = {
        ok: true,
        skipped: true,
        message: 'Local dry-run: set VITE_ENABLE_LMS_SYNC_DEV=true and run the API endpoint to test a real LMS call.',
      };
      writeLog({
        id: `lms-log-${Date.now()}`,
        leadId: lead.id,
        eventId: payload.eventId,
        status: 'skipped',
        message: result.message || 'Local dry-run',
        createdAt: now(),
        payloadPreview: {
          studentName: payload.student.name,
          parentPhone: payload.parent.phone,
          revenue: payload.finance.revenue,
          course: payload.enrollment.interestedCourse,
        },
        response: result,
      });
      return result;
    }

    const response = await fetch('/api/lms-sync-enrollment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await response.json().catch(() => ({ ok: false, message: 'LMS API response is not valid JSON.' })) as LmsSyncResult;
    const ok = response.ok && result.ok !== false;
    writeLog({
      id: `lms-log-${Date.now()}`,
      leadId: lead.id,
      eventId: payload.eventId,
      status: ok ? 'success' : 'failed',
      message: result.message || (ok ? 'Synced to LMS.' : 'LMS sync failed.'),
      createdAt: now(),
      payloadPreview: {
        studentName: payload.student.name,
        parentPhone: payload.parent.phone,
        revenue: payload.finance.revenue,
        course: payload.enrollment.interestedCourse,
      },
      response: result,
    });

    if (!ok) throw new Error(result.message || `LMS sync failed with status ${response.status}.`);
    return result;
  },
};
