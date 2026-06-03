import type { COURSE_OPTIONS, leadSources, leadStatuses, lostReasons, pendingReasonOptions } from '@/lib/constants';

export type LeadStatus = (typeof leadStatuses)[number];
export type LeadSource = string;
export type LostReason = (typeof lostReasons)[number] | string;
export type PendingReason = (typeof pendingReasonOptions)[number]['reason'] | string;
export type LeadPriorityLevel = 1 | 2 | 3 | 4 | 5;
/** Tên khóa tự do (lấy động từ CMS programs hoặc COURSE_OPTIONS fallback). */
export type InterestedCourse = string;

export interface LeadSourceConfig {
  id: string;
  name: string;
  priorityLevel: LeadPriorityLevel;
  description: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface LeadCenterConfig {
  id: string;
  name: string;
  address: string;
  description: string;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Lead {
  id: string;
  fullName: string;
  parentName?: string;
  studentName?: string;
  phone: string;
  email: string;
  contactType: 'parent' | 'student' | 'other';
  age: string;
  school: string;
  currentClass: string;
  interestedCourse: InterestedCourse | '';
  currentLevel: string;
  targetGoal: string;
  source: LeadSource;
  centerName?: string;
  priorityLevel?: LeadPriorityLevel | number;
  status: LeadStatus;
  assignedTo: string;
  assignedToName?: string;
  assignedBy?: string;
  assignedAt?: string;
  assignedAtMs?: number;
  assignedExpiresAtMs?: number;
  assignedStatus?: 'unassigned' | 'active' | 'accepted' | 'returned';
  failedAssignedTo?: string;
  failedAssignedToName?: string;
  failedAt?: string;
  failedAtMs?: number;
  failedReason?: 'no_status_update_24h' | string;
  statusUpdatedAt?: string;
  statusUpdatedAtMs?: number;
  followUpDate?: string;
  consultationDate?: string;
  dealSize?: number;
  dealCurrency?: string;
  dealPackage?: string;
  dealNote?: string;
  discountPercent?: number;
  expectedRevenue?: number;
  revenue?: number;
  revenueAt?: string;
  expectedCloseDate?: string;
  enrollmentType?: 'new' | 'upsell' | 'renewal' | string;
  wonAt?: string;
  pendingReason?: PendingReason;
  pendingReasonNote?: string;
  pendingWarmthPercent?: number;
  lostReason?: LostReason;
  lostNote?: string;
  initialNote: string;
  createdAt: string;
  updatedAt: string;
  convertedToStudentId?: string;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  type: 'call' | 'zalo' | 'email' | 'consultation' | 'note' | 'update' | 'status_change' | 'assignment' | 'other';
  content: string;
  createdBy: string;
  createdAt: string;
}

export interface Appointment {
  id: string;
  leadId?: string;
  studentId?: string;
  title: string;
  type: 'Gọi lại' | 'Tư vấn' | 'Test đầu vào' | 'Nhắc đóng phí' | 'Khác';
  startTime: string;
  endTime: string;
  assignedTo: string;
  assignedToName?: string;
  status: 'upcoming' | 'done' | 'cancelled' | 'overdue';
  notes: string;
  createdAt: string;
  updatedAt: string;
}
