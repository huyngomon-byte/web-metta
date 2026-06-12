import { adminAuth, adminDb } from './_firebaseAdmin.js';

type TaskStatus = 'open' | 'done';
type TaskPriority = 'low' | 'normal' | 'high';

type VercelRequest = {
  method?: string;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

type AuthUser = {
  id: string;
  fullName: string;
  role: string;
  active: boolean;
};

type ManualTask = {
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

const COL = 'salesManualTasks';
const priorities = ['low', 'normal', 'high'];
const statuses = ['open', 'done'];

function bearer(req: VercelRequest) {
  const raw = req.headers?.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.startsWith('Bearer ') ? value.slice(7) : '';
}

async function requireTaskUser(req: VercelRequest): Promise<AuthUser> {
  const token = bearer(req);
  if (!token) throw new Error('Missing auth token');
  const decoded = await adminAuth().verifyIdToken(token);
  const snap = await adminDb().collection('users').doc(decoded.uid).get();
  const data = snap.exists ? snap.data() || {} : {};
  const role = String(data.role || decoded.role || '');
  const active = snap.exists ? data.active !== false : true;
  if (!active || !['admin', 'manager', 'sales'].includes(role)) throw new Error('No task permission');
  return {
    id: decoded.uid,
    fullName: String(data.fullName || decoded.name || decoded.email || decoded.uid),
    role,
    active,
  };
}

function canManageAll(user: AuthUser) {
  return user.role === 'admin' || user.role === 'manager';
}

async function activeSalesById(id: string) {
  if (!id) return null;
  const snap = await adminDb().collection('users').doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  if (data.active === false || data.role !== 'sales') return null;
  return { id: snap.id, fullName: String(data.fullName || id) };
}

function visibleForUser(task: ManualTask, user: AuthUser) {
  return canManageAll(user) || task.assignedTo === user.id;
}

function cleanTask(input: Partial<ManualTask>, user: AuthUser, assignedUser: { id: string; fullName: string }): ManualTask {
  const now = new Date().toISOString();
  const priority = priorities.includes(String(input.priority)) ? input.priority as TaskPriority : 'normal';
  const status = statuses.includes(String(input.status)) ? input.status as TaskStatus : 'open';
  return {
    id: String(input.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    title: String(input.title || '').trim(),
    notes: String(input.notes || '').trim(),
    dueAt: input.dueAt ? new Date(String(input.dueAt)).toISOString() : now,
    assignedTo: assignedUser.id,
    assignedToName: assignedUser.fullName,
    leadId: String(input.leadId || '').trim(),
    status,
    priority,
    createdAt: input.createdAt || now,
    updatedAt: now,
    createdBy: input.createdBy || user.id,
    createdByName: input.createdByName || user.fullName,
  };
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripUndefined(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, stripUndefined(item)]),
    ) as T;
  }
  return value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = await requireTaskUser(req);
    const db = adminDb();

    if (req.method === 'GET') {
      const snap = await db.collection(COL).orderBy('updatedAt', 'desc').limit(1000).get();
      const tasks = snap.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as ManualTask)
        .filter((task) => visibleForUser(task, user));
      return res.status(200).json({ tasks });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const inputTasks = Array.isArray(req.body?.tasks) ? req.body.tasks : [req.body?.task || req.body || {}];
      const tasks: ManualTask[] = [];
      for (const input of inputTasks.slice(0, 50)) {
        const requestedAssignedTo = String(input.assignedTo || '').trim();
        const assignedUser = canManageAll(user)
          ? await activeSalesById(requestedAssignedTo)
          : user.role === 'sales' && requestedAssignedTo === user.id
            ? { id: user.id, fullName: user.fullName }
            : null;
        if (!assignedUser) return res.status(400).json({ error: 'Task must be assigned to an active sales user' });
        const task = cleanTask(input, user, assignedUser);
        if (!task.title) return res.status(400).json({ error: 'Task title is required' });
        tasks.push(task);
      }

      for (let i = 0; i < tasks.length; i += 450) {
        const batch = db.batch();
        tasks.slice(i, i + 450).forEach((task) => {
          batch.set(db.collection(COL).doc(task.id), stripUndefined(task), { merge: true });
        });
        await batch.commit();
      }
      return res.status(200).json({ tasks });
    }

    if (req.method === 'PATCH') {
      const id = String(req.body?.id || '');
      if (!id) return res.status(400).json({ error: 'Missing task id' });
      const ref = db.collection(COL).doc(id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ error: 'Task not found' });
      const existing = { id: snap.id, ...snap.data() } as ManualTask;
      if (!visibleForUser(existing, user)) return res.status(403).json({ error: 'Cannot update this task' });

      const patch: Partial<ManualTask> = {};
      if (req.body?.status && statuses.includes(String(req.body.status))) patch.status = req.body.status;
      if (req.body?.priority && priorities.includes(String(req.body.priority))) patch.priority = req.body.priority;
      if (req.body?.title !== undefined) patch.title = String(req.body.title || '').trim();
      if (req.body?.notes !== undefined) patch.notes = String(req.body.notes || '').trim();
      if (req.body?.dueAt) patch.dueAt = new Date(String(req.body.dueAt)).toISOString();
      if (req.body?.leadId !== undefined) patch.leadId = String(req.body.leadId || '').trim();
      if (canManageAll(user) && req.body?.assignedTo) {
        const assignedUser = await activeSalesById(String(req.body.assignedTo));
        if (!assignedUser) return res.status(400).json({ error: 'Task must be assigned to an active sales user' });
        patch.assignedTo = assignedUser.id;
        patch.assignedToName = assignedUser.fullName;
      }
      patch.updatedAt = new Date().toISOString();
      await ref.set(stripUndefined(patch), { merge: true });
      return res.status(200).json({ task: { ...existing, ...patch } });
    }

    if (req.method === 'DELETE') {
      const id = String(req.body?.id || '');
      if (!id) return res.status(400).json({ error: 'Missing task id' });
      const ref = db.collection(COL).doc(id);
      const snap = await ref.get();
      if (!snap.exists) return res.status(200).json({ ok: true });
      const existing = { id: snap.id, ...snap.data() } as ManualTask;
      if (!visibleForUser(existing, user)) return res.status(403).json({ error: 'Cannot delete this task' });
      await ref.delete();
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(403).json({ error: error instanceof Error ? error.message : 'Forbidden' });
  }
}
