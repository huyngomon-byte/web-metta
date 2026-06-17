import { adminAuth, adminDb } from './_firebaseAdmin.js';

type VercelRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  setHeader?: (name: string, value: string) => void;
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

type PublicCmsDocument = {
  id: string;
  [key: string]: unknown;
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

function serializable(data: Record<string, unknown> | undefined, id: string): PublicCmsDocument {
  return {
    id,
    ...(data || {}),
  };
}

async function readPublicCmsSnapshot() {
  const db = adminDb();
  const [pagesSnap, sectionsSnap, settingsSnap] = await Promise.all([
    db.collection('pages').where('status', '==', 'published').get(),
    db.collection('pageSections').where('visible', '==', true).get(),
    db.doc('siteSettings/main').get(),
  ]);

  const pages = pagesSnap.docs.map((doc) => serializable(doc.data(), doc.id));
  const publishedPageIds = new Set(pages.map((page) => String(page.id)));
  const sections = sectionsSnap.docs
    .map((doc) => serializable(doc.data(), doc.id))
    .filter((section) => publishedPageIds.has(String(section.pageId || '')))
    .sort((a, b) => Number(a.order || 0) - Number(b.order || 0));

  return {
    pages,
    sections,
    settings: settingsSnap.exists ? settingsSnap.data() : null,
    generatedAt: new Date().toISOString(),
  };
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
    const id = String(queryValue(req.query?.id) || req.body?.id || '');

    if (req.method === 'GET' && id === 'publicCms') {
      res.setHeader?.('Cache-Control', 'no-store, max-age=0, must-revalidate');
      return res.status(200).json(await readPublicCmsSnapshot());
    }

    await requireManagerAccess(req);
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
