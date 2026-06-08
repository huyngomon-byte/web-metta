import { appointments, capiEventLogs, capiMappings, capiSettings, classes, classSessions, classStudents, courses, leadActivities, leads, mediaItems, pages, sections, siteSettings, students, users } from '@/data/seed';

/* ── localStorage persistence helpers ───────────────────────────────────────── */
const LS = {
  pages:    'metta_cms_pages',
  sections: 'metta_cms_sections',
  settings: 'metta_cms_settings',
};

function loadLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    // basic sanity: must be same type (array vs object)
    if (Array.isArray(fallback) !== Array.isArray(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function persistCMS() {
  try {
    localStorage.setItem(LS.pages,    JSON.stringify(store.pages));
    localStorage.setItem(LS.sections, JSON.stringify(store.sections));
    localStorage.setItem(LS.settings, JSON.stringify(store.siteSettings));
  } catch { /* quota exceeded – ignore */ }
}

export const store = {
  siteSettings: loadLS(LS.settings, { ...siteSettings }),
  pages:        loadLS(LS.pages,    [...pages]),
  sections:     loadLS(LS.sections, [...sections]),
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
  users: [...users]
};

export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
export const delay = <T>(value: T) => new Promise<T>((resolve) => setTimeout(() => resolve(clone(value)), 140));
