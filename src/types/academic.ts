import type { classStatuses, classStudentStatuses, sessionStatuses, studentStatuses } from '@/lib/constants';

export type CourseName = string;
export type StudentStatus = (typeof studentStatuses)[number];
export type ClassStatus = (typeof classStatuses)[number];
export type ClassStudentStatus = (typeof classStudentStatuses)[number];
export type SessionStatus = (typeof sessionStatuses)[number];

export interface Course {
  id: string;
  name: CourseName;
  code: string;
  description: string;
  ageRange: string;
  level: string;
  totalSessions: number;
  sessionDuration: string;
  tuitionFee: number;
  curriculum: string;
  status: 'Đang mở' | 'Tạm ẩn' | 'Đã đóng';
  createdAt: string;
  updatedAt: string;
}

export interface Student {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  age: string;
  school: string;
  currentClass: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  sourceLeadId?: string;
  interestedCourse: CourseName;
  currentCourseId?: string;
  currentClassId?: string;
  currentLevel: string;
  targetGoal: string;
  status: StudentStatus;
  assignedTo: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClassItem {
  id: string;
  name: string;
  code: string;
  courseId: string;
  teacherId: string;
  assistantId?: string;
  startDate: string;
  expectedEndDate: string;
  scheduleText: string;
  room: string;
  onlineLink?: string;
  maxStudents: number;
  currentStudentCount: number;
  status: ClassStatus;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClassStudent {
  id: string;
  classId: string;
  studentId: string;
  joinedAt: string;
  status: ClassStudentStatus;
  notes: string;
}

export interface ClassSession {
  id: string;
  classId: string;
  sessionNumber: number;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  teacherId: string;
  room: string;
  onlineLink?: string;
  lessonContent: string;
  homework: string;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  classId: string;
  sessionId: string;
  studentId: string;
  status: string;
  note: string;
  markedBy: string;
  markedAt: string;
}

export interface TestResult {
  id: string;
  studentId: string;
  classId: string;
  testType: string;
  testDate: string;
  score: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
}
