import { adminAuth, adminDb } from './_firebaseAdmin.js';
import {
  PUBLIC_CMS_CACHE_HEADER,
  normalizePublicCmsSnapshot,
  readPublicCmsBlobSnapshot,
  writePublicCmsBlobSnapshot,
  type PublicCmsDocument,
  type PublicCmsSnapshot,
} from './_publicCmsSnapshot.js';
import { sendBlogPage, sendSitemap } from './_publicSeoServer.js';

type VercelRequest = {
  method?: string;
  query?: Record<string, string | string[] | undefined>;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  setHeader?: (name: string, value: string) => void;
  status: (code: number) => VercelResponse;
  send?: (body: string) => void;
  json: (body: unknown) => void;
};

type AppConfigUser = {
  id: string;
  email: string;
  role: string;
  active: boolean;
};

const PUBLIC_CMS_MEMORY_TTL_MS = 60 * 1000;
const PUBLIC_CMS_MEMORY_STALE_MS = 24 * 60 * 60 * 1000;

let publicCmsMemoryCache: {
  snapshot: PublicCmsSnapshot;
  expiresAt: number;
  staleUntil: number;
} | null = null;

const configFields: Record<string, 'configs' | 'rules'> = {
  leadCenterConfigs: 'configs',
  leadSourceConfigs: 'configs',
  salesAssignmentRules: 'rules',
};

const activeUserReadableConfigs = new Set(['leadCenterConfigs', 'leadSourceConfigs']);

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

async function readPublicCmsSnapshot(): Promise<PublicCmsSnapshot> {
  const timestamp = Date.now();
  if (publicCmsMemoryCache && publicCmsMemoryCache.expiresAt > timestamp) {
    return publicCmsMemoryCache.snapshot;
  }

  const db = adminDb();
  try {
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
    const snapshot: PublicCmsSnapshot = {
      pages,
      sections,
      settings: settingsSnap.exists ? settingsSnap.data() || null : null,
      generatedAt: new Date().toISOString(),
      source: 'firestore-fallback',
      schemaVersion: 1,
    };

    publicCmsMemoryCache = {
      snapshot,
      expiresAt: timestamp + PUBLIC_CMS_MEMORY_TTL_MS,
      staleUntil: timestamp + PUBLIC_CMS_MEMORY_STALE_MS,
    };

    return snapshot;
  } catch (error) {
    if (publicCmsMemoryCache && publicCmsMemoryCache.staleUntil > timestamp) {
      return {
        ...publicCmsMemoryCache.snapshot,
        stale: true,
        staleReason: error instanceof Error ? error.message : 'Cannot refresh public CMS',
      } as PublicCmsSnapshot;
    }
    throw error;
  }
}

async function requireActiveUser(req: VercelRequest): Promise<AppConfigUser> {
  const token = bearer(req);
  if (!token) throw new Error('Missing auth token');
  const decoded = await adminAuth().verifyIdToken(token);
  const snap = await adminDb().collection('users').doc(decoded.uid).get();
  const data = snap.exists ? snap.data() || {} : {};
  const role = data.role || decoded.role;
  const active = snap.exists ? data.active !== false : true;
  if (!active) throw new Error('Inactive user');
  return {
    id: decoded.uid,
    email: String(data.email || decoded.email || ''),
    role: String(role || ''),
    active,
  };
}

function isLeadManager(user: AppConfigUser) {
  return user.active && ['admin', 'manager'].includes(user.role);
}

function canManageCms(user: AppConfigUser) {
  return user.active && ['admin', 'manager', 'design'].includes(user.role);
}

function canReadAppConfig(id: string, user: AppConfigUser) {
  return isLeadManager(user) || activeUserReadableConfigs.has(id);
}

function requireManagerAccess(user: AppConfigUser) {
  if (!isLeadManager(user)) throw new Error('Only admin or manager can manage app config');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const id = String(queryValue(req.query?.id) || req.body?.id || '');

    if (req.method === 'GET' && id === 'publicCms') {
      res.setHeader?.('Cache-Control', PUBLIC_CMS_CACHE_HEADER);
      const blobSnapshot = await readPublicCmsBlobSnapshot().catch((error) => {
        console.warn('[PublicCMS] Cannot read Blob snapshot:', error);
        return null;
      });
      if (blobSnapshot) {
        res.setHeader?.('X-Public-CMS-Source', 'blob');
        return res.status(200).json(blobSnapshot.snapshot);
      }

      const firestoreFallback = await readPublicCmsSnapshot().catch((error) => {
        console.warn('[PublicCMS] Cannot read Firestore fallback:', error);
        return null;
      });
      if (firestoreFallback) {
        res.setHeader?.('X-Public-CMS-Source', 'firestore-fallback');
        return res.status(200).json(firestoreFallback);
      }

      res.setHeader?.('X-Public-CMS-Source', 'unavailable');
      return res.status(503).json({ error: 'Public CMS snapshot is unavailable.' });
    }

    if ((req.method === 'PUT' || req.method === 'PATCH') && id === 'publicCms') {
      const user = await requireActiveUser(req);
      if (!canManageCms(user)) throw new Error('Only CMS users can publish public CMS snapshots');

      const snapshot = normalizePublicCmsSnapshot(req.body?.snapshot || req.body);
      const result = await writePublicCmsBlobSnapshot(snapshot, {
        id: user.id,
        email: user.email,
        role: user.role,
      });

      res.setHeader?.('Cache-Control', 'no-store, max-age=0, must-revalidate');
      res.setHeader?.('X-Public-CMS-Source', 'blob');
      return res.status(200).json({
        id: 'publicCms',
        ok: true,
        source: 'blob',
        url: result.blob.url,
        pathname: result.blob.pathname,
        publishedAt: result.snapshot.publishedAt,
      });
    }

    if (req.method === 'GET' && id === 'sitemap') {
      return sendSitemap(req as Parameters<typeof sendSitemap>[0], res);
    }

    if (req.method === 'GET' && id === 'blogPage') {
      return sendBlogPage(req as Parameters<typeof sendBlogPage>[0], res);
    }

    const field = configFields[id];
    if (!field) return res.status(400).json({ error: 'Invalid config id' });
    const user = await requireActiveUser(req);

    const db = adminDb();
    const ref = db.collection('appConfig').doc(id);

    if (req.method === 'GET') {
      if (!canReadAppConfig(id, user)) throw new Error('Only admin or manager can read this app config');
      const snap = await ref.get();
      return res.status(200).json({ id, ...(snap.exists ? snap.data() : {}) });
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
      requireManagerAccess(user);
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
