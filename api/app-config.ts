import { adminAuth, adminDb } from './_firebaseAdmin.js';

type VercelRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

const configFields: Record<string, 'configs' | 'rules'> = {
  leadCenterConfigs: 'configs',
  leadSourceConfigs: 'configs',
  salesAssignmentRules: 'rules',
};

function bearer(req: VercelRequest) {
  const raw = req.headers?.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.startsWith('Bearer ') ? value.slice(7) : '';
}

function queryValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

async function requireManagerAccess(req: VercelRequest) {
  const token = bearer(req);
  if (!token) throw new Error('Missing auth token');
  const decoded = await adminAuth().verifyIdToken(token);
  const snap = await adminDb().collection('users').doc(decoded.uid).get();
  const data = snap.exists ? snap.data() || {} : {};
  const role = data.role || decoded.role;
  const active = snap.exists ? data.active !== false : true;
  if (!active || !['admin', 'manager'].includes(role)) throw new Error('Only admin or manager can manage app config');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireManagerAccess(req);
    const id = String(queryValue(req.query?.id) || req.body?.id || '');
    const field = configFields[id];
    if (!field) return res.status(400).json({ error: 'Invalid config id' });

    const db = adminDb();
    const ref = db.collection('appConfig').doc(id);

    if (req.method === 'GET') {
      const snap = await ref.get();
      return res.status(200).json({ id, ...(snap.exists ? snap.data() : {}) });
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      const value = req.body?.[field];
      if (!Array.isArray(value)) return res.status(400).json({ error: `Missing ${field} array` });
      const payload = { [field]: value, updatedAt: new Date().toISOString() };
      await ref.set(payload, { merge: true });
      return res.status(200).json({ id, ...payload });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(403).json({ error: error instanceof Error ? error.message : 'Forbidden' });
  }
}
