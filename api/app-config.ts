import { adminAuth, adminDb } from './_firebaseAdmin.js';
import { sendBlogPage, sendPublicBlogPost, sendPublicBlogPosts, sendSitemap } from './_publicSeoServer.js';

type PublicCmsDocument = {
  id: string;
  [key: string]: unknown;
};

type PublicCmsSnapshot = {
  pages: PublicCmsDocument[];
  sections: PublicCmsDocument[];
  settings: Record<string, unknown> | null;
  generatedAt: string;
  source?: string;
  schemaVersion?: number;
  stale?: boolean;
  staleReason?: string;
};

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
  fullName: string;
  role: string;
  active: boolean;
};

type AdminUser = {
  id: string;
  fullName: string;
  role: string;
  active: boolean;
};

type SalesAssignmentRule = {
  salesId: string;
  salesName: string;
  percent: number;
  active: boolean;
  updatedAt?: string;
};

type LeadDoc = Record<string, any> & {
  id: string;
  fullName?: string;
  parentName?: string;
  studentName?: string;
  phone?: string;
  status?: string;
  assignedTo?: string;
  assignedToName?: string;
  assignedStatus?: string;
};

type LeadRecord = {
  id: string;
  ref: FirebaseFirestore.DocumentReference;
  lead: LeadDoc;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_LEAD_STATUS = 'Lead mới';
const MAX_WRITES_PER_BATCH = 440;
const WRITES_PER_LEAD = 4;
const MAX_LEADS_PER_BATCH = Math.floor(MAX_WRITES_PER_BATCH / WRITES_PER_LEAD);
const PUBLIC_CMS_NO_STORE_HEADER = 'no-store, max-age=0, must-revalidate';
const LEAD_PAGE_SIZE = 100;
const LEAD_PAGE_DEFAULT_SINCE_DAYS = 30;

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

function cleanPercent(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(100, Math.round(parsed));
}

function activeSales(users: AdminUser[]) {
  return users.filter((user) => user.role === 'sales' && user.active);
}

function assignmentRulesTotal(rules: SalesAssignmentRule[]) {
  return rules.filter((rule) => rule.active).reduce((sum, rule) => sum + cleanPercent(rule.percent), 0);
}

function defaultRules(users: AdminUser[]): SalesAssignmentRule[] {
  const sales = activeSales(users);
  if (!sales.length) return [];
  if (sales.length === 2) {
    return sales.map((user, index) => ({
      salesId: user.id,
      salesName: user.fullName,
      percent: index === 0 ? 60 : 40,
      active: true,
      updatedAt: new Date().toISOString(),
    }));
  }

  const base = Math.floor(100 / sales.length);
  let remainder = 100 - base * sales.length;
  return sales.map((user) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return {
      salesId: user.id,
      salesName: user.fullName,
      percent: base + extra,
      active: true,
      updatedAt: new Date().toISOString(),
    };
  });
}

function normalizeAssignmentRules(users: AdminUser[], saved: SalesAssignmentRule[]) {
  const sales = activeSales(users);
  if (!sales.length) return [];
  if (!saved.length) return defaultRules(users);

  const savedById = new Map(saved.map((rule) => [rule.salesId, rule]));
  const rules = sales.map((user) => {
    const existing = savedById.get(user.id);
    return {
      salesId: user.id,
      salesName: user.fullName,
      percent: cleanPercent(existing?.percent),
      active: existing?.active !== false,
      updatedAt: existing?.updatedAt,
    };
  });

  return assignmentRulesTotal(rules) > 0 ? rules : defaultRules(users);
}

function salesMatches(lead: LeadDoc, sales: Pick<AdminUser, 'id' | 'fullName'> | SalesAssignmentRule) {
  const salesId = 'salesId' in sales ? sales.salesId : sales.id;
  const salesName = 'salesName' in sales ? sales.salesName : sales.fullName;
  return lead.assignedTo === salesId || lead.assignedTo === salesName || lead.assignedToName === salesName;
}

function hasActiveSalesAssignment(lead: LeadDoc, salesUsers: AdminUser[]) {
  return lead.assignedStatus !== 'returned' && salesUsers.some((sales) => salesMatches(lead, sales));
}

function leadName(lead: LeadDoc) {
  return String(lead.studentName || lead.fullName || lead.parentName || lead.phone || 'Lead mới').trim();
}

function assignmentPickForNext(rules: SalesAssignmentRule[], counts: Map<string, number>, totalAfter: number) {
  return rules.map((rule) => {
    const current = counts.get(rule.salesId) || 0;
    const targetExact = (totalAfter * cleanPercent(rule.percent)) / 100;
    const targetRounded = Math.round(targetExact);
    return {
      rule,
      current,
      targetExact,
      targetRounded,
      roundedGap: targetRounded - current,
      exactGap: targetExact - current,
    };
  }).sort((a, b) =>
    b.roundedGap - a.roundedGap ||
    b.exactGap - a.exactGap ||
    a.current - b.current ||
    cleanPercent(b.rule.percent) - cleanPercent(a.rule.percent) ||
    a.rule.salesName.localeCompare(b.rule.salesName, 'vi'),
  )[0]?.rule || null;
}

function generatedId(prefix: string, index: number) {
  return `${prefix}-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}

function leadUrl(leadId: string) {
  return `/crm/leads?view=kanban&leadId=${encodeURIComponent(leadId)}`;
}

function serializable(data: Record<string, unknown> | undefined, id: string): PublicCmsDocument {
  return {
    id,
    ...(data || {}),
  };
}

async function readPublicCmsSnapshot(): Promise<PublicCmsSnapshot> {
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
    settings: settingsSnap.exists ? settingsSnap.data() || null : null,
    generatedAt: new Date().toISOString(),
    source: 'firestore',
    schemaVersion: 1,
  };
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
    fullName: String(data.fullName || decoded.name || decoded.email || decoded.uid),
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

async function readActiveUsersForAssignment(db: FirebaseFirestore.Firestore) {
  const snap = await db.collection('users').get();
  return snap.docs.map((docSnap) => {
    const data = docSnap.data() || {};
    return {
      id: docSnap.id,
      fullName: String(data.fullName || data.email || docSnap.id),
      role: String(data.role || ''),
      active: data.active === true,
    };
  });
}

async function readAssignmentRules(db: FirebaseFirestore.Firestore, users: AdminUser[]) {
  const snap = await db.collection('appConfig').doc('salesAssignmentRules').get();
  const data = snap.exists ? snap.data() || {} : {};
  const savedRules = Array.isArray(data.rules) ? data.rules as SalesAssignmentRule[] : [];
  return normalizeAssignmentRules(users, savedRules)
    .filter((rule) => rule.active && cleanPercent(rule.percent) > 0);
}

async function readNewLeadRecords(db: FirebaseFirestore.Firestore): Promise<LeadRecord[]> {
  const snap = await db.collection('leads').where('status', '==', NEW_LEAD_STATUS).get();
  return snap.docs.map((docSnap) => {
    const data = docSnap.data() as LeadDoc;
    return {
      id: docSnap.id,
      ref: docSnap.ref,
      lead: { ...data, id: data.id || docSnap.id },
    };
  });
}

async function commitLeadAssignments(
  db: FirebaseFirestore.Firestore,
  assignments: Array<{ record: LeadRecord; rule: SalesAssignmentRule }>,
  user: AppConfigUser,
) {
  const timestamp = new Date().toISOString();
  const assignedAtMs = Date.now();
  const assignedExpiresAtMs = assignedAtMs + DAY_MS;

  for (let start = 0; start < assignments.length; start += MAX_LEADS_PER_BATCH) {
    const batch = db.batch();
    assignments.slice(start, start + MAX_LEADS_PER_BATCH).forEach((item, offset) => {
      const index = start + offset;
      const { record, rule } = item;
      const name = leadName(record.lead);

      batch.set(record.ref, {
        assignedTo: rule.salesId,
        assignedToName: rule.salesName,
        assignedBy: user.id,
        assignedAt: timestamp,
        assignedAtMs,
        assignedExpiresAtMs,
        assignedStatus: 'active',
        failedAssignedTo: '',
        failedAssignedToName: '',
        failedAt: '',
        failedAtMs: 0,
        failedReason: '',
        updatedAt: timestamp,
      }, { merge: true });

      const activityRef = db.collection('leadActivities').doc(generatedId('act', index));
      batch.set(activityRef, {
        id: activityRef.id,
        leadId: record.id,
        type: 'assignment',
        content: `Auto chia lead mới cho ${rule.salesName}.`,
        createdBy: user.fullName || user.email || 'Auto rule',
        createdAt: timestamp,
      });

      const auditRef = db.collection('activityLogs').doc(generatedId('audit', index));
      batch.set(auditRef, {
        id: auditRef.id,
        type: 'lead_auto_balanced_assigned',
        leadId: record.id,
        assignedTo: rule.salesId,
        assignedToName: rule.salesName,
        assignedBy: user.id,
        assignedByName: user.fullName || user.email || '',
        createdAt: timestamp,
        createdAtMs: assignedAtMs,
      });

      const notificationRef = db.collection('appNotifications').doc(generatedId('noti', index));
      batch.set(notificationRef, {
        id: notificationRef.id,
        type: 'lead_assigned',
        userId: rule.salesId,
        title: 'Lead mới được auto assign',
        body: `${name} - ${user.fullName || user.email || 'Auto rule'}`,
        leadId: record.id,
        url: leadUrl(record.id),
        read: false,
        createdAt: timestamp,
      });
    });
    await batch.commit();
  }
}

async function bulkAutoAssignNewLeads(req: VercelRequest, res: VercelResponse) {
  const user = await requireActiveUser(req);
  requireManagerAccess(user);

  const db = adminDb();
  const users = await readActiveUsersForAssignment(db);
  const salesUsers = activeSales(users);
  if (!salesUsers.length) return res.status(400).json({ error: 'Chưa có sales active để chia lead.' });

  const rules = await readAssignmentRules(db, users);
  if (!rules.length || assignmentRulesTotal(rules) !== 100) {
    return res.status(400).json({ error: 'Tổng tỷ lệ active trong rule chia lead phải bằng 100%.' });
  }

  const newLeadRecords = await readNewLeadRecords(db);
  const assignedNewLeadRecords = newLeadRecords.filter((record) => hasActiveSalesAssignment(record.lead, salesUsers));
  const candidateRecords = newLeadRecords
    .filter((record) => !hasActiveSalesAssignment(record.lead, salesUsers))
    .sort((a, b) =>
      String(a.lead.createdAt || a.lead.updatedAt || '').localeCompare(String(b.lead.createdAt || b.lead.updatedAt || '')) ||
      a.id.localeCompare(b.id),
    );

  const counts = new Map<string, number>();
  rules.forEach((rule) => counts.set(rule.salesId, 0));
  assignedNewLeadRecords.forEach((record) => {
    const rule = rules.find((item) => salesMatches(record.lead, item));
    if (rule) counts.set(rule.salesId, (counts.get(rule.salesId) || 0) + 1);
  });
  const beforeCounts = new Map(counts);

  const assignments: Array<{ record: LeadRecord; rule: SalesAssignmentRule }> = [];
  candidateRecords.forEach((record) => {
    const totalAfter = assignedNewLeadRecords.length + assignments.length + 1;
    const rule = assignmentPickForNext(rules, counts, totalAfter);
    if (!rule) return;
    counts.set(rule.salesId, (counts.get(rule.salesId) || 0) + 1);
    assignments.push({ record, rule });
  });

  await commitLeadAssignments(db, assignments, user);

  const totalAfter = assignedNewLeadRecords.length + assignments.length;
  const distribution = rules.map((rule) => {
    const before = beforeCounts.get(rule.salesId) || 0;
    const after = counts.get(rule.salesId) || 0;
    return {
      salesId: rule.salesId,
      salesName: rule.salesName,
      percent: cleanPercent(rule.percent),
      before,
      assigned: after - before,
      after,
      shareAfter: totalAfter ? Math.round((after / totalAfter) * 100) : 0,
      targetAfter: Math.round((totalAfter * cleanPercent(rule.percent)) / 100),
    };
  });

  return res.status(200).json({
    ok: true,
    status: NEW_LEAD_STATUS,
    totalNewLeadCount: newLeadRecords.length,
    baselineAssignedCount: assignedNewLeadRecords.length,
    candidateCount: candidateRecords.length,
    assignedCount: assignments.length,
    distribution,
  });
}

function positiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.round(parsed)));
}

function leadPageDateStart(value?: string) {
  if (!value) return '';
  return value.length === 10 ? `${value}T00:00:00.000Z` : value;
}

function leadPageDateEnd(value?: string) {
  if (!value) return '';
  return value.length === 10 ? `${value}T23:59:59.999Z` : value;
}

async function readLeadNumberedPage(req: VercelRequest, res: VercelResponse) {
  const user = await requireActiveUser(req);
  if (!['admin', 'manager', 'sales'].includes(user.role)) throw new Error('User cannot read leads');

  const requestedPage = positiveInteger(queryValue(req.query?.page), 1, 100_000);
  const pageSize = positiveInteger(queryValue(req.query?.pageSize), LEAD_PAGE_SIZE, LEAD_PAGE_SIZE);
  const sinceDays = positiveInteger(queryValue(req.query?.sinceDays), LEAD_PAGE_DEFAULT_SINCE_DAYS, 3_650);
  const fallbackDate = new Date();
  fallbackDate.setDate(fallbackDate.getDate() - sinceDays);
  const dateFrom = leadPageDateStart(queryValue(req.query?.dateFrom)) || fallbackDate.toISOString();
  const dateTo = leadPageDateEnd(queryValue(req.query?.dateTo));

  const db = adminDb();
  let baseQuery: FirebaseFirestore.Query = db.collection('leads');
  if (user.role === 'sales') baseQuery = baseQuery.where('assignedTo', '==', user.id);
  baseQuery = baseQuery.where('createdAt', '>=', dateFrom);
  if (dateTo) baseQuery = baseQuery.where('createdAt', '<=', dateTo);
  baseQuery = baseQuery.orderBy('createdAt', 'desc');

  const countSnap = await baseQuery.count().get();
  const total = countSnap.data().count;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const pageSnap = await baseQuery.offset((page - 1) * pageSize).limit(pageSize).get();
  const leads = pageSnap.docs.map((item) => ({ ...item.data(), id: item.id }));

  return res.status(200).json({
    leads,
    page,
    pageSize,
    total,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const id = String(queryValue(req.query?.id) || req.body?.id || '');

    if (req.method === 'GET' && id === 'publicCms') {
      res.setHeader?.('Cache-Control', PUBLIC_CMS_NO_STORE_HEADER);
      const firestoreSnapshot = await readPublicCmsSnapshot().catch((error) => {
        console.warn('[PublicCMS] Cannot read Firestore public CMS:', error);
        return null;
      });
      if (firestoreSnapshot) {
        res.setHeader?.('X-Public-CMS-Source', 'firestore');
        return res.status(200).json(firestoreSnapshot);
      }

      res.setHeader?.('X-Public-CMS-Source', 'unavailable');
      return res.status(503).json({ error: 'Public CMS snapshot is unavailable.' });
    }

    if ((req.method === 'PUT' || req.method === 'PATCH') && id === 'publicCms') {
      const user = await requireActiveUser(req);
      if (!canManageCms(user)) throw new Error('Only CMS users can publish public CMS snapshots');

      res.setHeader?.('Cache-Control', PUBLIC_CMS_NO_STORE_HEADER);
      res.setHeader?.('X-Public-CMS-Source', 'firestore');
      return res.status(200).json({
        id: 'publicCms',
        ok: true,
        source: 'firestore',
        publishedAt: new Date().toISOString(),
      });
    }

    if (req.method === 'GET' && id === 'sitemap') {
      return sendSitemap(req as Parameters<typeof sendSitemap>[0], res);
    }

    if (req.method === 'GET' && id === 'blogPage') {
      return sendBlogPage(req as Parameters<typeof sendBlogPage>[0], res);
    }

    if (req.method === 'GET' && id === 'publicBlogPosts') {
      return sendPublicBlogPosts(req as Parameters<typeof sendPublicBlogPosts>[0], res);
    }

    if (req.method === 'GET' && id === 'publicBlogPost') {
      return sendPublicBlogPost(req as Parameters<typeof sendPublicBlogPost>[0], res);
    }

    if (id === 'bulkAutoAssignNewLeads' && req.method === 'POST') {
      return await bulkAutoAssignNewLeads(req, res);
    }

    if (id === 'leadPage' && req.method === 'GET') {
      return await readLeadNumberedPage(req, res);
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
