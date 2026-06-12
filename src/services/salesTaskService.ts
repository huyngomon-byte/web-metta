import { auth } from '@/lib/firebase';

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

const LS_MANUAL_TASKS = 'metta_sales_manual_tasks';
const LS_REMOTE_MIGRATION = 'metta_sales_manual_tasks_remote_migration_v1';

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

function readLocalTasks(): ManualTask[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LS_MANUAL_TASKS) || '[]');
    return Array.isArray(parsed) ? mergeTasks(parsed) : [];
  } catch {
    return [];
  }
}

function writeLocalTasks(tasks: Partial<ManualTask>[], notify = true) {
  localStorage.setItem(LS_MANUAL_TASKS, JSON.stringify(mergeTasks(tasks).slice(0, 1000)));
  if (notify) dispatchUpdate();
}

async function salesTasksApi<T>(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown): Promise<T | null> {
  const token = await auth?.currentUser?.getIdToken().catch(() => '');
  if (!token) return null;
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
    const local = readLocalTasks();
    const payload = await salesTasksApi<{ tasks?: ManualTask[] }>('GET').catch((error) => {
      console.warn('[SalesTasks] Remote read failed, using local cache:', error);
      return null;
    });
    if (!payload?.tasks) return local;

    let tasks = mergeTasks(payload.tasks);
    if (local.length && !localStorage.getItem(LS_REMOTE_MIGRATION)) {
      await salesTasksApi<{ tasks?: ManualTask[] }>('PUT', { tasks: local }).catch((error) => {
        console.warn('[SalesTasks] Remote migration failed:', error);
      });
      localStorage.setItem(LS_REMOTE_MIGRATION, '1');
      tasks = mergeTasks([...tasks, ...local]);
    }
    writeLocalTasks(tasks, false);
    return tasks;
  },

  saveTasks: async (tasks: Partial<ManualTask>[]) => {
    const saved = tasks.map((task) => normalizeTask({ ...task, updatedAt: now() }));
    const next = mergeTasks([...saved, ...readLocalTasks()]);
    writeLocalTasks(next);
    await salesTasksApi<{ tasks?: ManualTask[] }>('POST', { tasks: saved }).catch((error) => {
      console.warn('[SalesTasks] Remote save failed, keeping local cache:', error);
    });
    return next;
  },

  updateTask: async (id: string, patch: Partial<ManualTask>) => {
    const timestamp = now();
    const next = readLocalTasks().map((task) => task.id === id ? normalizeTask({ ...task, ...patch, updatedAt: timestamp }) : task);
    writeLocalTasks(next);
    await salesTasksApi<{ task?: ManualTask }>('PATCH', { id, ...patch, updatedAt: timestamp }).catch((error) => {
      console.warn('[SalesTasks] Remote update failed, keeping local cache:', error);
    });
    return next;
  },

  deleteTask: async (id: string) => {
    const next = readLocalTasks().filter((task) => task.id !== id);
    writeLocalTasks(next);
    await salesTasksApi<{ ok?: boolean }>('DELETE', { id }).catch((error) => {
      console.warn('[SalesTasks] Remote delete failed:', error);
    });
    return next;
  },
};
