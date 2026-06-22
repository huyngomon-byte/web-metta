import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { currentUser } from '@/services/authService';

export type TaskStatus = 'open' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high';
export type TaskCategory = 'center_consulting' | 'telesales' | 'seeding' | 'flyering' | 'page_care' | 'class_management';

export const TASK_CATEGORIES: Array<{ value: TaskCategory; label: string }> = [
  { value: 'center_consulting', label: 'Tư vấn tại trung tâm' },
  { value: 'telesales', label: 'Telesales' },
  { value: 'seeding', label: 'Seeding' },
  { value: 'flyering', label: 'Phát tờ rơi' },
  { value: 'page_care', label: 'Chăm sóc page' },
  { value: 'class_management', label: 'Quản lý lớp' },
];

export type ManualTask = {
  id: string;
  title: string;
  notes: string;
  dueAt: string;
  assignedTo: string;
  assignedToName: string;
  leadId?: string;
  category: TaskCategory;
  status: TaskStatus;
  priority: TaskPriority;
  proofImages: string[];
  completedAt?: string;
  completedBy?: string;
  completedByName?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  createdByName?: string;
};

type TaskPageOptions = {
  pageSize?: number;
  cursorUpdatedAt?: string;
};

let cachedTasks: ManualTask[] = [];
const USE_FIREBASE = isFirebaseConfigured && !!db;
const COL_MANUAL_TASKS = 'salesManualTasks';
const TASK_PAGE_SIZE = 50;

function now() {
  return new Date().toISOString();
}

function normalizeCategory(value?: string): TaskCategory {
  return TASK_CATEGORIES.some((item) => item.value === value) ? value as TaskCategory : 'telesales';
}

function normalizeProofImages(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeTask(task: Partial<ManualTask>): ManualTask {
  const timestamp = now();
  return {
    id: task.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: String(task.title || '').trim(),
    notes: String(task.notes || '').trim(),
    dueAt: task.dueAt || timestamp,
    assignedTo: String(task.assignedTo || '').trim(),
    assignedToName: String(task.assignedToName || '').trim(),
    leadId: String(task.leadId || '').trim(),
    category: normalizeCategory(task.category),
    status: task.status || 'open',
    priority: task.priority || 'normal',
    proofImages: normalizeProofImages(task.proofImages),
    completedAt: String(task.completedAt || '').trim() || undefined,
    completedBy: String(task.completedBy || '').trim() || undefined,
    completedByName: String(task.completedByName || '').trim() || undefined,
    createdAt: task.createdAt || timestamp,
    updatedAt: task.updatedAt || timestamp,
    createdBy: String(task.createdBy || '').trim() || undefined,
    createdByName: String(task.createdByName || '').trim() || undefined,
  };
}

function mergeTasks(tasks: Partial<ManualTask>[]) {
  const map = new Map<string, ManualTask>();
  tasks.map(normalizeTask).forEach((task) => {
    const existing = map.get(task.id);
    if (!existing || task.updatedAt >= existing.updatedAt) map.set(task.id, task);
  });
  return Array.from(map.values()).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
}

function dispatchUpdate() {
  window.dispatchEvent(new Event('metta-sales-tasks-updated'));
}

function dispatchRealtimeError(message: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('metta-realtime-error', { detail: message }));
}

function dispatchRealtimeOk() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('metta-realtime-ok'));
}

function readLocalTasks(): ManualTask[] {
  return cachedTasks;
}

function writeLocalTasks(tasks: Partial<ManualTask>[], notify = true) {
  cachedTasks = mergeTasks(tasks).slice(0, 1000);
  if (notify) dispatchUpdate();
}

async function salesTasksApi<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown): Promise<T | null> {
  const token = await auth?.currentUser?.getIdToken().catch(() => '');
  if (!token) throw new Error('Missing auth token for sales task sync.');
  const response = await fetch('/api/sales-tasks', {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error || 'Sales task sync failed.');
  }
  return response.json().catch(() => ({})) as Promise<T>;
}

export const salesTaskService = {
  getTasks: async () => {
    const payload = await salesTasksApi<{ tasks?: ManualTask[] }>('GET');
    const tasks = mergeTasks(payload?.tasks || []);
    writeLocalTasks(tasks, false);
    return tasks;
  },

  getTasksPage: async ({ pageSize = TASK_PAGE_SIZE, cursorUpdatedAt }: TaskPageOptions = {}) => {
    const user = currentUser();
    const safePageSize = Math.max(1, Math.min(200, Math.round(pageSize)));
    if (!USE_FIREBASE) {
      const tasks = await salesTaskService.getTasks();
      return cursorUpdatedAt ? tasks.filter((task) => task.updatedAt < cursorUpdatedAt).slice(0, safePageSize) : tasks.slice(0, safePageSize);
    }

    const canViewAll = Boolean(user && ['admin', 'manager'].includes(user.role));
    const taskQuery = canViewAll
      ? query(
        collection(db!, COL_MANUAL_TASKS),
        orderBy('updatedAt', 'desc'),
        ...(cursorUpdatedAt ? [startAfter(cursorUpdatedAt)] : []),
        limit(safePageSize),
      )
      : query(
        collection(db!, COL_MANUAL_TASKS),
        where('assignedTo', '==', user?.id || ''),
        orderBy('updatedAt', 'desc'),
        ...(cursorUpdatedAt ? [startAfter(cursorUpdatedAt)] : []),
        limit(safePageSize),
      );
    const snap = await getDocs(taskQuery);
    const page = mergeTasks(snap.docs.map((item) => ({ id: item.id, ...item.data() } as ManualTask)));
    writeLocalTasks(cursorUpdatedAt ? [...cachedTasks, ...page] : page, false);
    return page;
  },

  subscribeTasks: (callback: (tasks: ManualTask[]) => void, onError?: (error: unknown) => void): Unsubscribe => {
    const user = currentUser();
    if (!USE_FIREBASE) {
      void salesTaskService.getTasks().then(callback).catch(onError);
      return () => {};
    }

    const canViewAll = Boolean(user && ['admin', 'manager'].includes(user.role));
    const taskQuery = canViewAll
      ? query(collection(db!, COL_MANUAL_TASKS), orderBy('updatedAt', 'desc'), limit(TASK_PAGE_SIZE))
      : query(collection(db!, COL_MANUAL_TASKS), where('assignedTo', '==', user?.id || ''), orderBy('updatedAt', 'desc'), limit(TASK_PAGE_SIZE));

    return onSnapshot(taskQuery, (snap) => {
      dispatchRealtimeOk();
      const tasks = mergeTasks(snap.docs.map((item) => ({ id: item.id, ...item.data() } as ManualTask)));
      writeLocalTasks(tasks, false);
      callback(tasks);
    }, (error) => {
      console.warn('[SalesTasks] Realtime listener failed:', error);
      dispatchRealtimeError('Tasks realtime đang fallback');
      onError?.(error);
    });
  },

  saveTasks: async (tasks: Partial<ManualTask>[]) => {
    const saved = tasks.map((task) => normalizeTask({ ...task, updatedAt: now() }));
    const payload = await salesTasksApi<{ tasks?: ManualTask[] }>('POST', { tasks: saved });
    const next = mergeTasks([...(payload?.tasks || saved), ...cachedTasks]);
    writeLocalTasks(next);
    return next;
  },

  updateTask: async (id: string, patch: Partial<ManualTask>) => {
    const timestamp = now();
    const payload = await salesTasksApi<{ task?: ManualTask }>('PATCH', { id, ...patch, updatedAt: timestamp });
    const remoteTask = payload?.task;
    const current = readLocalTasks();
    const next = current.some((task) => task.id === id)
      ? current.map((task) => task.id === id ? normalizeTask({ ...task, ...(remoteTask || patch), updatedAt: remoteTask?.updatedAt || timestamp }) : task)
      : remoteTask
        ? [normalizeTask(remoteTask)]
        : current;
    writeLocalTasks(next);
    return next;
  },

  deleteTask: async (id: string) => {
    await salesTasksApi<{ ok?: boolean }>('DELETE', { id });
    const next = readLocalTasks().filter((task) => task.id !== id);
    writeLocalTasks(next);
    return next;
  },
};
