import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { canViewAllLeads } from '@/lib/permissions';
import { currentUser } from '@/services/authService';
import { delay, store } from '@/services/store';
import type { Appointment } from '@/types/crm';

const now = () => new Date().toISOString();
const USE_FIREBASE = isFirebaseConfigured && !!db;
const COL = 'appointments';
const STAGE_DEMO_CONSULTATION_PREFIX = 'ap-demo-stage-consultation-';
const PRIORITY_DEMO_CONSULTATION_PREFIX = 'ap-demo-priority-consultation-';
const REALTIME_APPOINTMENTS_LIMIT = 500;

type AppointmentSubscribeOptions = {
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
};

type AppointmentListOptions = AppointmentSubscribeOptions & {
  order?: 'asc' | 'desc';
};

function persist() {
  // Appointment data is shared state. Firestore is the only persistent store.
}

function dispatchRealtimeError(message: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('metta-realtime-error', { detail: message }));
}

function dispatchRealtimeOk() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('metta-realtime-ok'));
}

function isDemoAppointment(item: Partial<Appointment>) {
  const id = String(item.id || '');
  const leadId = String(item.leadId || '');
  return id.startsWith(STAGE_DEMO_CONSULTATION_PREFIX)
    || id.startsWith(PRIORITY_DEMO_CONSULTATION_PREFIX)
    || /^ap-[1-5]$/.test(id)
    || leadId.startsWith('lead-demo-stage-')
    || leadId.startsWith('lead-demo-priority-')
    || /^lead-[1-5]$/.test(leadId)
    || /^lead-x\d+$/.test(leadId);
}

function loadLocal() {
  store.appointments = store.appointments.filter((item) => !isDemoAppointment(item));
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

function normalizeDateStart(value?: string) {
  if (!value) return '';
  return value.length === 10 ? `${value}T00:00:00.000Z` : value;
}

function normalizeDateEnd(value?: string) {
  if (!value) return '';
  return value.length === 10 ? `${value}T23:59:59.999Z` : value;
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
  if (!USE_FIREBASE) return current.filter((item) => !isDemoAppointment(item));
  const demoItems = current.filter((item) => isDemoAppointment(item));
  try {
    await Promise.all(demoItems.map((item) => deleteFirestore(item.id).catch(() => {})));
    return current.filter((item) => !isDemoAppointment(item));
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

  const updated = overdue.map((item) => ({ ...item, status: 'overdue' as const, updatedAt: timestamp }));
  await Promise.all(updated.map(writeFirestore));
  const updatedById = new Map(updated.map((item) => [item.id, item]));
  store.appointments = store.appointments.map((item) => updatedById.get(item.id) || item);
}

export const appointmentService = {
  getAppointments: async (options: AppointmentListOptions = {}) => {
    const user = currentUser();

    if (USE_FIREBASE) {
      const dateFrom = normalizeDateStart(options.dateFrom);
      const dateTo = normalizeDateEnd(options.dateTo);
      const safeLimit = options.limit ? Math.max(1, Math.min(1000, Math.round(options.limit))) : 0;
      const hasRange = Boolean(dateFrom || dateTo);
      const appointmentQuery = query(
        collection(db!, COL),
        ...(user?.role === 'sales' ? [where('assignedTo', '==', user.id)] : []),
        ...(dateFrom ? [where('startTime', '>=', dateFrom)] : []),
        ...(dateTo ? [where('startTime', '<=', dateTo)] : []),
        ...(user?.role !== 'sales' || hasRange ? [orderBy('startTime', options.order || 'desc')] : []),
        ...(safeLimit ? [limit(safeLimit)] : []),
      );
      const snap = await getDocs(appointmentQuery);
      let firestoreItems = snap.docs.map((item) => item.data() as Appointment);
      if (canViewAllLeads(user)) firestoreItems = await replaceFirestoreDemoAppointments(firestoreItems);
      store.appointments = mergeAppointments([], firestoreItems);
      await markOverdueAppointments();
      persist();
      const visibleItems = canViewAllLeads(user)
        ? store.appointments
        : store.appointments.filter((item) => item.assignedTo === user?.id);
      return delay(visibleItems);
    }

    loadLocal();
    await markOverdueAppointments();
    return delay(canViewAllLeads(user) ? store.appointments : store.appointments.filter((item) => item.assignedTo === user?.id));
  },

  subscribeAppointments: (callback: (appointments: Appointment[]) => void, onError?: (error: unknown) => void, options: AppointmentSubscribeOptions = {}): Unsubscribe => {
    const user = currentUser();
    if (!USE_FIREBASE) {
      void appointmentService.getAppointments().then(callback).catch(onError);
      return () => {};
    }

    const dateFrom = normalizeDateStart(options.dateFrom);
    const dateTo = normalizeDateEnd(options.dateTo);
    const safeLimit = Math.max(50, Math.min(1000, Math.round(options.limit || REALTIME_APPOINTMENTS_LIMIT)));
    const canUseDateRange = canViewAllLeads(user) && Boolean(dateFrom || dateTo);
    const appointmentQuery = user?.role === 'sales'
      ? query(collection(db!, COL), where('assignedTo', '==', user.id), limit(safeLimit))
      : canUseDateRange
        ? query(
          collection(db!, COL),
          ...(dateFrom ? [where('startTime', '>=', dateFrom)] : []),
          ...(dateTo ? [where('startTime', '<=', dateTo)] : []),
          orderBy('startTime', 'desc'),
          limit(safeLimit),
        )
        : query(collection(db!, COL), orderBy('startTime', 'desc'), limit(safeLimit));

    return onSnapshot(appointmentQuery, (snap) => {
      dispatchRealtimeOk();
      void (async () => {
        try {
          const remoteItems = snap.docs.map((item) => item.data() as Appointment);
          store.appointments = mergeAppointments([], remoteItems);
          const visibleItems = canViewAllLeads(user)
            ? store.appointments
            : store.appointments.filter((item) => item.assignedTo === user?.id);
          callback(visibleItems);
        } catch (error) {
          onError?.(error);
        }
      })();
    }, (error) => {
      console.warn('[Appointments] Realtime listener failed:', error);
      dispatchRealtimeError('Appointments realtime đang fallback');
      onError?.(error);
    });
  },

  saveAppointment: async (appointment: Partial<Appointment>) => {
    await appointmentService.getAppointments();
    const timestamp = now();
    let saved: Appointment;

    if (appointment.id) {
      const existing = store.appointments.find((item) => item.id === appointment.id);
      if (!existing) throw new Error('Không tìm thấy lịch hẹn.');
      saved = { ...existing, ...appointment, updatedAt: timestamp };
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
    }

    await writeFirestore(saved);
    store.appointments = appointment.id
      ? store.appointments.map((item) => item.id === saved.id ? saved : item)
      : [saved, ...store.appointments];
    persist();
    return delay(store.appointments);
  },

  updateStatus: async (id: string, status: Appointment['status']) => {
    await appointmentService.getAppointments();
    const timestamp = now();
    const existing = store.appointments.find((item) => item.id === id);
    const saved = existing ? { ...existing, status, updatedAt: timestamp } : undefined;
    if (!saved) throw new Error('Không tìm thấy lịch hẹn.');
    await writeFirestore(saved);
    store.appointments = store.appointments.map((item) => item.id === id ? saved : item);
    persist();
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
    await Promise.all(targets.map((item) => deleteFirestore(item.id)));
    store.appointments = store.appointments.filter((item) => !(item.leadId === leadId && appointmentTypeKey(item.type) === targetType));
    persist();
    return delay(store.appointments);
  },

  /** Xóa toàn bộ lịch hẹn liên quan đến một lead — gọi khi xóa lead để giữ data sync. */
  deleteAllForLead: async (leadId: string) => {
    await appointmentService.getAppointments();
    const targets = store.appointments.filter((item) => item.leadId === leadId);
    await Promise.all(targets.map((item) => deleteFirestore(item.id)));
    store.appointments = store.appointments.filter((item) => item.leadId !== leadId);
    persist();
    return delay(store.appointments);
  },

  deleteOtherForLead: async (leadId: string, keepId: string) => {
    await appointmentService.getAppointments();
    const targets = store.appointments.filter((item) => item.leadId === leadId && item.id !== keepId);
    await Promise.all(targets.map((item) => deleteFirestore(item.id)));
    store.appointments = store.appointments.filter((item) => !(item.leadId === leadId && item.id !== keepId));
    persist();
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

    await writeFirestore(appointment);
    if (existing) {
      store.appointments = store.appointments.map((item) => (item.id === existing.id ? appointment : item));
    } else {
      store.appointments.unshift(appointment);
    }
    persist();
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
