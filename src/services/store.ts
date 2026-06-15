import { appointments, capiEventLogs, capiMappings, capiSettings, classes, classSessions, classStudents, courses, leadActivities, leads, mediaItems, pages, sections, siteSettings, students, users } from '@/data/seed';

export function persistCMS() {
  // Shared CMS data must come from Firestore. This is intentionally memory-only.
}

export const store = {
  siteSettings: { ...siteSettings },
  pages: [...pages],
  sections: [...sections],
  media: [...mediaItems],
  leads: [...leads],
  leadActivities: [...leadActivities],
  appointments: [...appointments],
  students: [...students],
  courses: [...courses],
  classes: [...classes],
  classStudents: [...classStudents],
  classSessions: [...classSessions],
  attendance: [],
  testResults: [],
  teacherFeedback: [],
  capiSettings: { ...capiSettings },
  capiMappings: [...capiMappings],
  capiEvents: [...capiEventLogs],
  users: [...users],
};

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const delay = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(clone(value)), 140));
