import { adminAuth, adminDb } from './_firebaseAdmin.js';

type TaskStatus = 'open' | 'done';
type TaskPriority = 'low' | 'normal' | 'high';
type TaskCategory = 'center_consulting' | 'telesales' | 'seeding' | 'flyering' | 'page_care' | 'class_management';

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

type TaskAssignee = {
  id: string;
  name: string;
  proofImages: string[];
  status: TaskStatus;
  completedAt?: string;
  completedBy?: string;
  completedByName?: string;
};

type ManualTask = {
  id: string;
  title: string;
  notes: string;
  dueAt: string;
  assignedTo: string;
  assignedToName: string;
  assigneeIds: string[];
  assignees: TaskAssignee[];
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

const COL = 'salesManualTasks';
const TASK_PAGE_SIZE = 50;
const priorities = ['low', 'normal', 'high'];
const statuses = ['open', 'done'];
const categories = ['center_consulting', 'telesales', 'seeding', 'flyering', 'page_care', 'class_management'];

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

async function activeSalesByIds(ids: string[]) {
  const uniqueIds = Array.from(new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))).slice(0, 20);
  const users: Array<{ id: string; fullName: string }> = [];
  for (const id of uniqueIds) {
    const user = await activeSalesById(id);
    if (user) users.push(user);
  }
  return users;
}

function visibleForUser(task: ManualTask, user: AuthUser) {
  const assigneeIds = Array.isArray(task.assigneeIds) ? task.assigneeIds.map(String) : [];
  const assignees = Array.isArray(task.assignees) ? task.assignees : [];
  return canManageAll(user)
    || task.assignedTo === user.id
    || assigneeIds.includes(user.id)
    || assignees.some((item) => item?.id === user.id);
}

function cleanCategory(value: unknown): TaskCategory {
  return categories.includes(String(value)) ? String(value) as TaskCategory : 'telesales';
}

function cleanProofImages(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 8);
}

function cleanIdList(value: unknown) {
  if (Array.isArray(value)) return Array.from(new Set(value.map((item) => String(item || '').trim()).filter(Boolean))).slice(0, 20);
  const single = String(value || '').trim();
  return single ? [single] : [];
}

function cleanStatus(value: unknown): TaskStatus {
  return value === 'done' ? 'done' : 'open';
}

function normalizeAssignees(input: Partial<ManualTask>, assignedUsers: Array<{ id: string; fullName: string }>): TaskAssignee[] {
  const rawAssignees = Array.isArray(input.assignees) ? input.assignees : [];
  const rawById = new Map(rawAssignees.map((item) => [String(item?.id || '').trim(), item]).filter(([id]) => Boolean(id)) as Array<[string, TaskAssignee]>);
  const legacyProofImages = cleanProofImages(input.proofImages);
  const legacyStatus = cleanStatus(input.status);

  return assignedUsers.map((assignedUser, index) => {
    const raw = rawById.get(assignedUser.id);
    const proofImages = cleanProofImages(raw?.proofImages).length
      ? cleanProofImages(raw?.proofImages)
      : index === 0
        ? legacyProofImages
        : [];
    const requestedStatus = cleanStatus(raw?.status || (index === 0 ? legacyStatus : 'open'));
    const status = requestedStatus === 'done' && proofImages.length ? 'done' : 'open';
    return {
      id: assignedUser.id,
      name: String(raw?.name || assignedUser.fullName || assignedUser.id),
      proofImages,
      status,
      completedAt: status === 'done' ? String(raw?.completedAt || input.completedAt || new Date().toISOString()) : undefined,
      completedBy: status === 'done' ? String(raw?.completedBy || input.completedBy || '').trim() || undefined : undefined,
      completedByName: status === 'done' ? String(raw?.completedByName || input.completedByName || '').trim() || undefined : undefined,
    };
  });
}

function deriveTaskStatus(assignees: TaskAssignee[]): TaskStatus {
  return assignees.length && assignees.every((item) => item.status === 'done') ? 'done' : 'open';
}

function existingAssignees(task: Partial<ManualTask>): TaskAssignee[] {
  const raw = Array.isArray(task.assignees) ? task.assignees : [];
  const byId = new Map<string, TaskAssignee>();
  raw.forEach((item) => {
    const id = String(item?.id || '').trim();
    if (!id) return;
    byId.set(id, {
      id,
      name: String(item?.name || id),
      proofImages: cleanProofImages(item?.proofImages),
      status: cleanStatus(item?.status),
      completedAt: String(item?.completedAt || '').trim() || undefined,
      completedBy: String(item?.completedBy || '').trim() || undefined,
      completedByName: String(item?.completedByName || '').trim() || undefined,
    });
  });
  const legacyId = String(task.assignedTo || '').trim();
  if (legacyId && !byId.has(legacyId)) {
    byId.set(legacyId, {
      id: legacyId,
      name: String(task.assignedToName || legacyId),
      proofImages: cleanProofImages(task.proofImages),
      status: cleanStatus(task.status),
      completedAt: String(task.completedAt || '').trim() || undefined,
      completedBy: String(task.completedBy || '').trim() || undefined,
      completedByName: String(task.completedByName || '').trim() || undefined,
    });
  }
  const assigneeIds = Array.isArray(task.assigneeIds) ? task.assigneeIds : [];
  assigneeIds.forEach((item) => {
    const id = String(item || '').trim();
    if (!id || byId.has(id)) return;
    byId.set(id, { id, name: id, proofImages: [], status: 'open' });
  });
  return Array.from(byId.values()).slice(0, 20);
}

function syncLegacyAssigneeFields(patch: Partial<ManualTask>, assignees: TaskAssignee[]) {
  const primaryAssignee = assignees[0];
  patch.assigneeIds = assignees.map((item) => item.id);
  patch.assignees = assignees;
  patch.assignedTo = primaryAssignee?.id || '';
  patch.assignedToName = primaryAssignee?.name || '';
  patch.proofImages = primaryAssignee?.proofImages || [];
  patch.status = deriveTaskStatus(assignees);
  if (patch.status === 'done') {
    patch.completedAt = assignees.map((item) => item.completedAt).filter(Boolean).sort().slice(-1)[0] || new Date().toISOString();
  } else {
    patch.completedAt = '';
    patch.completedBy = '';
    patch.completedByName = '';
  }
}

function cleanTask(input: Partial<ManualTask>, user: AuthUser, assignedUsers: Array<{ id: string; fullName: string }>): ManualTask {
  const now = new Date().toISOString();
  const priority = priorities.includes(String(input.priority)) ? input.priority as TaskPriority : 'normal';
  const assignees = normalizeAssignees(input, assignedUsers);
  const primaryAssignee = assignees[0];
  const status = deriveTaskStatus(assignees);
  return {
    id: String(input.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    title: String(input.title || '').trim(),
    notes: String(input.notes || '').trim(),
    dueAt: input.dueAt ? new Date(String(input.dueAt)).toISOString() : now,
    assignedTo: primaryAssignee?.id || '',
    assignedToName: primaryAssignee?.name || '',
    assigneeIds: assignees.map((item) => item.id),
    assignees,
    leadId: String(input.leadId || '').trim(),
    category: cleanCategory(input.category),
    status,
    priority,
    proofImages: primaryAssignee?.proofImages || [],
    completedAt: status === 'done' ? (input.completedAt || now) : undefined,
    completedBy: status === 'done' ? (input.completedBy || user.id) : undefined,
    completedByName: status === 'done' ? (input.completedByName || user.fullName) : undefined,
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
      const taskDocs = new Map<string, ManualTask>();
      if (canManageAll(user)) {
        const snap = await db.collection(COL).orderBy('updatedAt', 'desc').limit(TASK_PAGE_SIZE).get();
        snap.docs.forEach((docSnap) => taskDocs.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as ManualTask));
      } else {
        const [legacySnap, multiSnap] = await Promise.all([
          db.collection(COL).where('assignedTo', '==', user.id).limit(TASK_PAGE_SIZE).get(),
          db.collection(COL).where('assigneeIds', 'array-contains', user.id).limit(TASK_PAGE_SIZE).get(),
        ]);
        [...legacySnap.docs, ...multiSnap.docs].forEach((docSnap) => taskDocs.set(docSnap.id, { id: docSnap.id, ...docSnap.data() } as ManualTask));
      }
      const tasks = Array.from(taskDocs.values())
        .filter((task) => visibleForUser(task, user))
        .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
        .slice(0, TASK_PAGE_SIZE);
      return res.status(200).json({ tasks });
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      const inputTasks = Array.isArray(req.body?.tasks) ? req.body.tasks : [req.body?.task || req.body || {}];
      const tasks: ManualTask[] = [];
      for (const input of inputTasks.slice(0, 50)) {
        const requestedAssigneeIds = cleanIdList(input.assigneeIds).length ? cleanIdList(input.assigneeIds) : cleanIdList(input.assignedTo);
        const assignedUsers = canManageAll(user)
          ? await activeSalesByIds(requestedAssigneeIds)
          : user.role === 'sales' && requestedAssigneeIds.length === 1 && requestedAssigneeIds[0] === user.id
            ? [{ id: user.id, fullName: user.fullName }]
            : [];
        if (!assignedUsers.length || assignedUsers.length !== requestedAssigneeIds.length) return res.status(400).json({ error: 'Task must be assigned to active sales users' });
        const task = cleanTask(input, user, assignedUsers);
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
      if (req.body?.priority && priorities.includes(String(req.body.priority))) patch.priority = req.body.priority;
      if (req.body?.category !== undefined) patch.category = cleanCategory(req.body.category);
      if (req.body?.title !== undefined) patch.title = String(req.body.title || '').trim();
      if (req.body?.notes !== undefined) patch.notes = String(req.body.notes || '').trim();
      if (req.body?.dueAt) patch.dueAt = new Date(String(req.body.dueAt)).toISOString();
      if (req.body?.leadId !== undefined) patch.leadId = String(req.body.leadId || '').trim();

      let assignees = existingAssignees(existing);
      if (canManageAll(user) && (req.body?.assigneeIds !== undefined || req.body?.assignedTo !== undefined)) {
        const requestedAssigneeIds = cleanIdList(req.body.assigneeIds).length ? cleanIdList(req.body.assigneeIds) : cleanIdList(req.body.assignedTo);
        const assignedUsers = await activeSalesByIds(requestedAssigneeIds);
        if (!assignedUsers.length || assignedUsers.length !== requestedAssigneeIds.length) return res.status(400).json({ error: 'Task must be assigned to active sales users' });
        const currentById = new Map(assignees.map((item) => [item.id, item]));
        assignees = assignedUsers.map((assignedUser) => currentById.get(assignedUser.id) || {
          id: assignedUser.id,
          name: assignedUser.fullName,
          proofImages: [],
          status: 'open' as TaskStatus,
        });
        syncLegacyAssigneeFields(patch, assignees);
      }

      const requestedAssigneeId = String(req.body?.assigneeId || '').trim();
      const targetAssigneeId = requestedAssigneeId || (canManageAll(user) ? String(req.body?.assignedTo || existing.assignedTo || '').trim() : user.id);
      if ((req.body?.proofImages !== undefined || req.body?.status !== undefined) && targetAssigneeId) {
        if (!canManageAll(user) && targetAssigneeId !== user.id) return res.status(403).json({ error: 'Cannot update another sales proof' });
        const hasTarget = assignees.some((item) => item.id === targetAssigneeId);
        if (!hasTarget) return res.status(400).json({ error: 'Sales is not assigned to this task' });
        const nextStatus = statuses.includes(String(req.body?.status)) ? String(req.body.status) as TaskStatus : undefined;
        assignees = assignees.map((item) => {
          if (item.id !== targetAssigneeId) return item;
          const proofImages = req.body?.proofImages !== undefined ? cleanProofImages(req.body.proofImages) : item.proofImages;
          if (nextStatus === 'done') {
            if (!proofImages.length) throw new Error('Task must have at least one proof image before completion');
            return {
              ...item,
              proofImages,
              status: 'done',
              completedAt: req.body?.completedAt ? new Date(String(req.body.completedAt)).toISOString() : new Date().toISOString(),
              completedBy: user.id,
              completedByName: user.fullName,
            };
          }
          if (nextStatus === 'open') {
            return {
              ...item,
              proofImages,
              status: 'open',
              completedAt: '',
              completedBy: '',
              completedByName: '',
            };
          }
          return { ...item, proofImages };
        });
        syncLegacyAssigneeFields(patch, assignees);
      }

      if (req.body?.status !== undefined && !requestedAssigneeId && !targetAssigneeId) {
        const nextStatus = statuses.includes(String(req.body.status)) ? String(req.body.status) as TaskStatus : undefined;
        if (nextStatus === 'done') {
          if (!assignees.every((item) => item.proofImages.length)) return res.status(400).json({ error: 'All assignees must have proof images before completion' });
          assignees = assignees.map((item) => ({
            ...item,
            status: 'done',
            completedAt: item.completedAt || new Date().toISOString(),
            completedBy: item.completedBy || user.id,
            completedByName: item.completedByName || user.fullName,
          }));
          syncLegacyAssigneeFields(patch, assignees);
        }
        if (nextStatus === 'open') {
          assignees = assignees.map((item) => ({ ...item, status: 'open', completedAt: '', completedBy: '', completedByName: '' }));
          syncLegacyAssigneeFields(patch, assignees);
        }
      }

      if (patch.title !== undefined && !patch.title) return res.status(400).json({ error: 'Task title is required' });
      if (!assignees.length) {
        return res.status(400).json({ error: 'Task must be assigned to active sales users' });
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
