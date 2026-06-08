import type { Appointment, Lead, LeadActivity, LeadStageHistoryEntry } from '@/types/crm';

export interface LmsEnrollmentPayload {
  schemaVersion: 'metta-lms-enrollment-v1';
  eventId: string;
  eventName: 'enrollment.created' | 'enrollment.updated';
  occurredAt: string;
  lead: {
    id: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    statusUpdatedAt?: string;
  };
  parent: {
    name: string;
    phone: string;
    email: string;
    referralPhone?: string;
  };
  student: {
    name: string;
    age: string;
    school: string;
    currentClass: string;
  };
  enrollment: {
    studentExternalId: string;
    interestedCourse: string;
    centerName: string;
    enrollmentType?: string;
    wonAt?: string;
    expectedCloseDate?: string;
  };
  finance: {
    dealSize: number;
    discountPercent: number;
    expectedRevenue: number;
    revenue: number;
    currency: string;
    dealPackage?: string;
    dealNote?: string;
  };
  crm: {
    ownerId: string;
    ownerName: string;
    source: string;
    priorityLevel: number;
    pendingReason?: string;
    pendingWarmthPercent?: number;
    lostReason?: string;
    initialNote: string;
    stageHistory: LeadStageHistoryEntry[];
    activities: LeadActivity[];
    appointments: Appointment[];
  };
  raw: {
    lead: Lead;
  };
}

export interface LmsSyncResult {
  ok: boolean;
  skipped?: boolean;
  status?: number;
  externalId?: string;
  message?: string;
  requestId?: string;
  result?: unknown;
}

export interface LmsSyncLogEntry {
  id: string;
  leadId: string;
  eventId: string;
  status: 'success' | 'skipped' | 'failed';
  message: string;
  createdAt: string;
  payloadPreview: {
    studentName: string;
    parentPhone: string;
    revenue: number;
    course: string;
  };
  response?: LmsSyncResult;
}
