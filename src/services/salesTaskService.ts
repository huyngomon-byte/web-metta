import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { currentUser } from '@/services/authService';

export type TaskStatus = 'open' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high';

export type ManualTask = {
  id: string;
  title: string;
  notes: string;
  dueAt: string;
  assignedTo: string;
  assignedToName: string;
  leadId?: string;
  status: TaskStatus;
  priority: TaskPriority;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  createdByName?: string;
};

let cachedTasks: ManualTask[] = [];
const USE_FIREBASE = isFirebaseConfigured && !!db;
const COL_MANUAL_TASKS = 'salesManualTasks';

function now() {
  return new Date().toISOString();
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
    status: task.status || 'open',
    priority: task.priority || 'normal',
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

  subscribeTasks: (callback: (tasks: ManualTask[]) => void, onError?: (error: unknown) => void): Unsubscribe => {
    const user = currentUser();
    if (!USE_FIREBASE) {
      void salesTaskService.getTasks().then(callback).catch(onError);
      return () => {};
    }

    const canViewAll = Boolean(user && ['admin', 'manager'].includes(user.role));
    const taskQuery = canViewAll
      ? query(collection(db!, COL_MANUAL_TASKS), orderBy('updatedAt', 'desc'), limit(1000))
      : query(collection(db!, COL_MANUAL_TASKS), where('assignedTo', '==', user?.id || ''), limit(1000));

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
