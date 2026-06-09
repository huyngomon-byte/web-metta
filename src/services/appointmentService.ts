import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { canViewAllLeads } from '@/lib/permissions';
import { currentUser } from '@/services/authService';
import { delay, store } from '@/services/store';
import type { Appointment } from '@/types/crm';

const now = () => new Date().toISOString();
const USE_FIREBASE = isFirebaseConfigured && !!db;
const COL = 'appointments';
const LS_KEY = 'metta_appointments';
const LS_DEMO_RESET = 'metta_appointment_demo_reset_v4';
const LS_FIRESTORE_DEMO_RESET = 'metta_appointment_demo_firestore_reset_v4';
const STAGE_DEMO_CONSULTATION_PREFIX = 'ap-demo-stage-consultation-';
const PRIORITY_DEMO_CONSULTATION_PREFIX = 'ap-demo-priority-consultation-';
const demoConsultationAppointments = store.appointments.filter((item) =>
  item.id.startsWith(STAGE_DEMO_CONSULTATION_PREFIX) || item.id.startsWith(PRIORITY_DEMO_CONSULTATION_PREFIX),
);

function persist() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(store.appointments)); } catch {}
}

function isDemoAppointment(item: Partial<Appointment>) {
  const id = String(item.id || '');
  return id.startsWith(STAGE_DEMO_CONSULTATION_PREFIX)
    || id.startsWith(PRIORITY_DEMO_CONSULTATION_PREFIX)
    || /^ap-[1-5]$/.test(id);
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      if (!localStorage.getItem(LS_DEMO_RESET)) {
        store.appointments = [...demoConsultationAppointments, ...parsed.filter((item: Appointment) => !isDemoAppointment(item))];
        localStorage.setItem(LS_DEMO_RESET, '1');
        persist();
        return;
      }
      const existingIds = new Set(parsed.map((item: Appointment) => item.id));
      const missingDemoAppointments = demoConsultationAppointments.filter((item) => !existingIds.has(item.id));
      const normalizedAp2 = parsed.some((item: Appointment) => item.id === 'ap-2' && item.type !== 'Tư vấn');
      const nextItems = parsed.map((item: Appointment) => {
        if (item.id !== 'ap-2') return item;
        return {
          ...item,
          type: 'Tư vấn' as Appointment['type'],
          title: 'Tư vấn Phonics cho Trần Minh Khoa',
          endTime: addMinutes(item.startTime, 45),
          assignedTo: item.assignedTo === 'Teacher An' ? 'u2' : item.assignedTo,
          assignedToName: item.assignedToName || 'Linh',
          notes: item.notes || 'Demo appointment tư vấn bắt buộc cho trạng thái Đã hẹn tư vấn.',
        };
      });
      store.appointments = missingDemoAppointments.length ? [...missingDemoAppointments, ...nextItems] : nextItems;
      if (missingDemoAppointments.length || normalizedAp2) persist();
    }
  } catch {}
}

function addMinutes(value: string, minutes: number) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function mergeAppointments(localItems: Appointment[], firestoreItems: Appointment[]) {
  const map = new Map<string, Appointment>();
  localItems.forEach((item) => map.set(item.id, item));
  firestoreItems.forEach((item) => map.set(item.id, item));
  return Array.from(map.values()).sort((a, b) => b.startTime.localeCompare(a.startTime));
}

function defaultDuration(type: Appointment['type']) {
  if (type === 'Gọi lại') return 20;
  if (type === 'Tư vấn' || type === 'Test đầu vào') return 45;
  return 30;
}

function appointmentTypeKey(type: string) {
  if (type === 'Gọi lại' || type.includes('Gá')) return 'callback';
  if (type === 'Tư vấn' || type.includes('TÆ')) return 'consultation';
  if (type === 'Test đầu vào' || type.toLowerCase().includes('test')) return 'test';
  return type;
}

async function writeFirestore(appointment: Appointment) {
  if (!USE_FIREBASE) return;
  const cleanAppointment = Object.fromEntries(
    Object.entries(appointment).filter(([, value]) => value !== undefined),
  ) as Appointment;
  await setDoc(doc(db!, COL, appointment.id), cleanAppointment);
}

async function deleteFirestore(id: string) {
  if (!USE_FIREBASE) return;
  await deleteDoc(doc(db!, COL, id));
}

async function replaceFirestoreDemoAppointments(current: Appointment[]) {
  if (!USE_FIREBASE || localStorage.getItem(LS_FIRESTORE_DEMO_RESET)) return current;
  const demoItems = current.filter((item) => isDemoAppointment(item));
  try {
    await Promise.all(demoItems.map((item) => deleteFirestore(item.id).catch(() => {})));
    await Promise.all(demoConsultationAppointments.map(writeFirestore));
    localStorage.setItem(LS_FIRESTORE_DEMO_RESET, '1');
    return [...demoConsultationAppointments, ...current.filter((item) => !isDemoAppointment(item))];
  } catch (error) {
    console.warn('[Appointments] Demo reset failed, keeping current data:', error);
    return current;
  }
}

async function markOverdueAppointments() {
  const timestamp = now();
  const overdue = store.appointments.filter((item) => {
    if (item.status !== 'upcoming') return false;
    const startMs = new Date(item.startTime).getTime();
    return Number.isFinite(startMs) && startMs < Date.now();
  });
  if (!overdue.length) return;

  const overdueIds = new Set(overdue.map((item) => item.id));
  store.appointments = store.appointments.map((item) =>
    overdueIds.has(item.id) ? { ...item, status: 'overdue', updatedAt: timestamp } : item,
  );
  persist();
  await Promise.all(store.appointments.filter((item) => overdueIds.has(item.id)).map(writeFirestore));
}

export const appointmentService = {
  getAppointments: async () => {
    const user = currentUser();
    loadLocal();
    const localItems = [...store.appointments];

    if (USE_FIREBASE) {
      try {
        const appointmentQuery = user?.role === 'sales'
          ? query(collection(db!, COL), where('assignedTo', '==', user.id))
          : query(collection(db!, COL), orderBy('startTime', 'desc'));
        const snap = await getDocs(appointmentQuery);
        let firestoreItems = snap.docs.map((item) => item.data() as Appointment);
        if (canViewAllLeads(user)) firestoreItems = await replaceFirestoreDemoAppointments(firestoreItems);
        store.appointments = firestoreItems.length ? mergeAppointments(localItems, firestoreItems) : [];
        await markOverdueAppointments();
        persist();
        const visibleItems = canViewAllLeads(user)
          ? store.appointments
          : store.appointments.filter((item) => item.assignedTo === user?.id);
        return delay(visibleItems);
      } catch (error) {
        console.warn('[Appointments] Firestore read failed, using local cache:', error);
      }
    }

    await markOverdueAppointments();
    return delay(canViewAllLeads(user) ? store.appointments : store.appointments.filter((item) => item.assignedTo === user?.id));
  },

  saveAppointment: async (appointment: Partial<Appointment>) => {
    const timestamp = now();
    let saved: Appointment;

    if (appointment.id) {
      store.appointments = store.appointments.map((item) =>
        item.id === appointment.id ? { ...item, ...appointment, updatedAt: timestamp } : item,
      );
      saved = store.appointments.find((item) => item.id === appointment.id)!;
    } else {
      saved = {
        id: `ap-${Date.now()}`,
        title: appointment.title || '',
        type: appointment.type || 'Tư vấn',
        startTime: appointment.startTime || timestamp,
        endTime: appointment.endTime || timestamp,
        assignedTo: appointment.assignedTo || '',
        assignedToName: appointment.assignedToName || '',
        status: appointment.status || 'upcoming',
        notes: appointment.notes || '',
        leadId: appointment.leadId,
        studentId: appointment.studentId,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      store.appointments.unshift(saved);
    }

    persist();
    await writeFirestore(saved);
    return delay(store.appointments);
  },

  updateStatus: async (id: string, status: Appointment['status']) => {
    await appointmentService.getAppointments();
    const timestamp = now();
    store.appointments = store.appointments.map((item) =>
      item.id === id ? { ...item, status, updatedAt: timestamp } : item,
    );
    const saved = store.appointments.find((item) => item.id === id);
    if (!saved) throw new Error('Không tìm thấy lịch hẹn.');
    persist();
    await writeFirestore(saved);
    return delay(saved);
  },

  getByLead: async (leadId: string) => {
    await appointmentService.getAppointments();
    return delay(store.appointments.filter((item) => item.leadId === leadId));
  },

  deleteLeadAppointmentType: async (leadId: string, type: Appointment['type']) => {
    await appointmentService.getAppointments();
    const targetType = appointmentTypeKey(type);
    const targets = store.appointments.filter((item) => item.leadId === leadId && appointmentTypeKey(item.type) === targetType);
    store.appointments = store.appointments.filter((item) => !(item.leadId === leadId && appointmentTypeKey(item.type) === targetType));
    persist();
    await Promise.all(targets.map((item) => deleteFirestore(item.id)));
    return delay(store.appointments);
  },

  /** Xóa toàn bộ lịch hẹn liên quan đến một lead — gọi khi xóa lead để giữ data sync. */
  deleteAllForLead: async (leadId: string) => {
    await appointmentService.getAppointments();
    const targets = store.appointments.filter((item) => item.leadId === leadId);
    store.appointments = store.appointments.filter((item) => item.leadId !== leadId);
    persist();
    await Promise.all(targets.map((item) => deleteFirestore(item.id)));
    return delay(store.appointments);
  },

  deleteOtherForLead: async (leadId: string, keepId: string) => {
    await appointmentService.getAppointments();
    const targets = store.appointments.filter((item) => item.leadId === leadId && item.id !== keepId);
    store.appointments = store.appointments.filter((item) => !(item.leadId === leadId && item.id !== keepId));
    persist();
    await Promise.all(targets.map((item) => deleteFirestore(item.id)));
    return delay(store.appointments);
  },

  upsertLeadAppointment: async (data: {
    leadId: string;
    leadName: string;
    phone?: string;
    type: Appointment['type'];
    startTime: string;
    assignedTo?: string;
    assignedToName?: string;
    notes?: string;
  }) => {
    await appointmentService.getAppointments();
    const timestamp = now();
    const title = data.phone ? `${data.leadName} - ${data.phone}` : data.leadName;
    const existing = store.appointments.find((item) => item.leadId === data.leadId && appointmentTypeKey(item.type) === appointmentTypeKey(data.type));
    const appointment: Appointment = {
      id: existing?.id || `ap-${Date.now()}`,
      leadId: data.leadId,
      studentId: existing?.studentId,
      title,
      type: data.type,
      startTime: data.startTime,
      endTime: addMinutes(data.startTime, defaultDuration(data.type)),
      assignedTo: data.assignedTo || '',
      assignedToName: data.assignedToName || '',
      status: existing?.status || 'upcoming',
      notes: data.notes || '',
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
    };

    if (existing) {
      store.appointments = store.appointments.map((item) => (item.id === existing.id ? appointment : item));
    } else {
      store.appointments.unshift(appointment);
    }

    persist();
    await writeFirestore(appointment);
    return delay(appointment);
  },

  upsertConsultationForLead: async (data: {
    leadId: string;
    leadName: string;
    phone?: string;
    startTime: string;
    assignedTo?: string;
    assignedToName?: string;
    notes?: string;
  }) => appointmentService.upsertLeadAppointment({ ...data, type: 'Tư vấn' }),
};
