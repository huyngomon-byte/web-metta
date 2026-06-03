import type { COURSE_OPTIONS, leadSources, leadStatuses, lostReasons } from '@/lib/constants';

export type LeadStatus = (typeof leadStatuses)[number];
export type LeadSource = (typeof leadSources)[number];
export type LostReason = (typeof lostReasons)[number] | string;
/** Tên khóa tự do (lấy động từ CMS programs hoặc COURSE_OPTIONS fallback). */
export type InterestedCourse = string;

export interface Lead {
  id: string;
  fullName: string;
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
  expectedRevenue?: number;
  expectedCloseDate?: string;
  enrollmentType?: 'new' | 'upsell' | 'renewal' | string;
  wonAt?: string;
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
