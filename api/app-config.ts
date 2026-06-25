import { createHash } from 'crypto';
import { adminAuth, adminDb } from './_firebaseAdmin.js';
import leadImportHandler from './_leadImport.js';
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

const PUBLIC_CMS_NO_STORE_HEADER = 'no-store, max-age=0, must-revalidate';
const PUBLIC_CMS_CACHE_HEADER = 'public, max-age=300, stale-while-revalidate=1800';
const PUBLIC_CMS_MEMORY_TTL_MS = 5 * 60 * 1000;
const PUBLIC_CMS_MEMORY_STALE_MS = 30 * 60 * 1000;
const LEAD_PAGE_SIZE = 100;
const LEAD_PAGE_DEFAULT_SINCE_DAYS = 30;
const LEAD_ASSIGNMENT_GROUPS = ['all', 'unassigned', 'stale', 'returned', 'assigned'] as const;
const LEAD_STATUSES = [
  'Lead mới',
  'Đã liên hệ',
  'Chưa nghe máy',
  'Đã hẹn tư vấn',
  'Đã tư vấn/Đặt lịch test',
  'Đã test/Học thử',
  'Đã báo phí/Chờ chốt',
  'Đã đăng ký học',
  'Mất lead',
] as const;
const DASHBOARD_SUMMARY_CACHE_SCHEMA = 1;
const DASHBOARD_SUMMARY_CACHE_MAX_BYTES = 900_000;
const DASHBOARD_LEAD_FIELDS = [
  'id',
  'fullName',
  'parentName',
  'studentName',
  'phone',
  'email',
  'age',
  'source',
  'interestedCourse',
  'centerName',
  'status',
  'assignedTo',
  'assignedToName',
  'assignedStatus',
  'failedAssignedTo',
  'failedAssignedToName',
  'followUpDate',
  'createdAt',
  'updatedAt',
  'convertedToStudentId',
  'dealSize',
  'discountPercent',
  'expectedRevenue',
  'revenue',
  'pendingReason',
  'lostReason',
  'stageHistory',
] as const;

type LeadAssignmentGroup = typeof LEAD_ASSIGNMENT_GROUPS[number];

type LeadPageFilters = {
  assignedTo: string;
  status: string;
  source: string;
  centerName: string;
  course: string;
  dateFrom: string;
  dateTo: string;
};

type DashboardSummaryFilters = {
  sales: string;
  source: string;
  course: string;
  center: string;
};

const configFields: Record<string, 'configs'> = {
  leadCenterConfigs: 'configs',
  leadSourceConfigs: 'configs',
};

const activeUserReadableConfigs = new Set(['leadCenterConfigs', 'leadSourceConfigs']);

let publicCmsMemoryCache: { snapshot: PublicCmsSnapshot; expiresAt: number; staleUntil: number } | null = null;
let publicCmsReadInFlight: Promise<PublicCmsSnapshot> | null = null;
const dashboardMemoryCache = new Map<string, { payload: unknown; expiresAt: number }>();

function bearer(req: VercelRequest) {
  const raw = req.headers?.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.startsWith('Bearer ') ? value.slice(7) : '';
}

function queryValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function cleanQueryValue(value?: string | string[]) {
  return String(queryValue(value) || '').trim();
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

async function readCachedPublicCmsSnapshot(): Promise<{ snapshot: PublicCmsSnapshot; cache: 'fresh' | 'refreshed' | 'stale' }> {
  const nowMs = Date.now();
  if (publicCmsMemoryCache && publicCmsMemoryCache.expiresAt > nowMs) {
    return { snapshot: publicCmsMemoryCache.snapshot, cache: 'fresh' };
  }

  if (!publicCmsReadInFlight) {
    publicCmsReadInFlight = readPublicCmsSnapshot()
      .then((snapshot) => {
        publicCmsMemoryCache = {
          snapshot,
          expiresAt: Date.now() + PUBLIC_CMS_MEMORY_TTL_MS,
          staleUntil: Date.now() + PUBLIC_CMS_MEMORY_STALE_MS,
        };
        return snapshot;
      })
      .finally(() => {
        publicCmsReadInFlight = null;
      });
  }

  try {
    return { snapshot: await publicCmsReadInFlight, cache: 'refreshed' };
  } catch (error) {
    if (publicCmsMemoryCache && publicCmsMemoryCache.staleUntil > nowMs) {
      return {
        snapshot: {
          ...publicCmsMemoryCache.snapshot,
          stale: true,
          staleReason: error instanceof Error ? error.message : 'Firestore read failed',
        },
        cache: 'stale',
      };
    }
    throw error;
  }
}

function invalidatePublicCmsCache() {
  publicCmsMemoryCache = null;
  publicCmsReadInFlight = null;
}

function rememberDashboardPayload(key: string, payload: unknown) {
  dashboardMemoryCache.set(key, { payload, expiresAt: Date.now() + 60_000 });
  if (dashboardMemoryCache.size > 100) {
    const oldestKey = dashboardMemoryCache.keys().next().value as string | undefined;
    if (oldestKey) dashboardMemoryCache.delete(oldestKey);
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

function positiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.round(parsed)));
}

function dateBoundaryToComparableIso(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function leadPageDateStart(value?: string) {
  if (!value) return '';
  const normalized = value.length === 10 ? `${value}T00:00:00.000+07:00` : value;
  return dateBoundaryToComparableIso(normalized);
}

function leadPageDateEnd(value?: string) {
  if (!value) return '';
  const normalized = value.length === 10 ? `${value}T23:59:59.999+07:00` : value;
  return dateBoundaryToComparableIso(normalized);
}

function readLeadPageFilters(req: VercelRequest, sinceDays: number): LeadPageFilters {
  const fallbackDate = new Date();
  fallbackDate.setDate(fallbackDate.getDate() - sinceDays);
  return {
    assignedTo: cleanQueryValue(req.query?.assignedTo),
    status: cleanQueryValue(req.query?.status),
    source: cleanQueryValue(req.query?.source),
    centerName: cleanQueryValue(req.query?.centerName),
    course: cleanQueryValue(req.query?.course),
    dateFrom: leadPageDateStart(cleanQueryValue(req.query?.dateFrom)) || fallbackDate.toISOString(),
    dateTo: leadPageDateEnd(cleanQueryValue(req.query?.dateTo)),
  };
}

function buildLeadPageQuery(
  db: FirebaseFirestore.Firestore,
  user: AppConfigUser,
  filters: LeadPageFilters,
  statusOverride?: string,
) {
  let baseQuery: FirebaseFirestore.Query = db.collection('leads');
  if (user.role === 'sales') {
    baseQuery = baseQuery.where('assignedTo', '==', user.id);
  } else if (filters.assignedTo) {
    baseQuery = baseQuery.where('assignedTo', '==', filters.assignedTo);
  }

  const status = statusOverride ?? filters.status;
  if (status) baseQuery = baseQuery.where('status', '==', status);
  if (filters.source) baseQuery = baseQuery.where('source', '==', filters.source);
  if (filters.centerName) baseQuery = baseQuery.where('centerName', '==', filters.centerName);
  if (filters.course) baseQuery = baseQuery.where('interestedCourse', '==', filters.course);
  baseQuery = baseQuery.where('createdAt', '>=', filters.dateFrom);
  if (filters.dateTo) baseQuery = baseQuery.where('createdAt', '<=', filters.dateTo);
  return baseQuery.orderBy('createdAt', 'desc');
}

async function countLeadStatuses(db: FirebaseFirestore.Firestore, user: AppConfigUser, filters: LeadPageFilters) {
  const statuses = filters.status
    ? LEAD_STATUSES.filter((status) => status === filters.status)
    : LEAD_STATUSES;
  const entries = await Promise.all(statuses.map(async (status) => {
    const snap = await buildLeadPageQuery(db, user, filters, status).count().get();
    return [status, snap.data().count] as const;
  }));
  const counted = new Map<string, number>(entries);
  return Object.fromEntries(LEAD_STATUSES.map((status) => [status, counted.get(status) || 0]));
}

async function readLeadNumberedPage(req: VercelRequest, res: VercelResponse) {
  const user = await requireActiveUser(req);
  if (!['admin', 'manager', 'sales'].includes(user.role)) throw new Error('User cannot read leads');

  const requestedPage = positiveInteger(queryValue(req.query?.page), 1, 100_000);
  const pageSize = positiveInteger(queryValue(req.query?.pageSize), LEAD_PAGE_SIZE, LEAD_PAGE_SIZE);
  const sinceDays = positiveInteger(queryValue(req.query?.sinceDays), LEAD_PAGE_DEFAULT_SINCE_DAYS, 3_650);
  const filters = readLeadPageFilters(req, sinceDays);

  const db = adminDb();
  const baseQuery = buildLeadPageQuery(db, user, filters);

  const [countSnap, statusCounts] = await Promise.all([
    baseQuery.count().get(),
    countLeadStatuses(db, user, filters),
  ]);
  const total = countSnap.data().count;
  const totalPages = Math.ceil(total / pageSize);
  const page = totalPages > 0 ? Math.min(requestedPage, totalPages) : 1;
  const pageSnap = await baseQuery.offset((page - 1) * pageSize).limit(pageSize).get();
  const leads = pageSnap.docs.map((item) => ({ ...item.data(), id: item.id }));

  return res.status(200).json({
    leads,
    page,
    pageSize,
    total,
    totalPages,
    statusCounts,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
  });
}

async function readLeadStatusCounts(req: VercelRequest, res: VercelResponse) {
  const user = await requireActiveUser(req);
  if (!['admin', 'manager', 'sales'].includes(user.role)) throw new Error('User cannot read leads');

  const sinceDays = positiveInteger(queryValue(req.query?.sinceDays), LEAD_PAGE_DEFAULT_SINCE_DAYS, 3_650);
  const filters = readLeadPageFilters(req, sinceDays);
  const statusCounts = await countLeadStatuses(adminDb(), user, filters);
  return res.status(200).json({ statusCounts });
}

async function readLeadAssignmentPage(req: VercelRequest, res: VercelResponse) {
  const user = await requireActiveUser(req);
  requireManagerAccess(user);

  const requestedPage = positiveInteger(queryValue(req.query?.page), 1, 100_000);
  const pageSize = positiveInteger(queryValue(req.query?.pageSize), LEAD_PAGE_SIZE, LEAD_PAGE_SIZE);
  const requestedGroup = String(queryValue(req.query?.group) || 'all') as LeadAssignmentGroup;
  const group: LeadAssignmentGroup = LEAD_ASSIGNMENT_GROUPS.includes(requestedGroup) ? requestedGroup : 'all';

  const db = adminDb();
  const usersSnap = await db.collection('users').get();
  const activeOwnerKeys = Array.from(new Set(usersSnap.docs.flatMap((item) => {
    const data = item.data();
    if (data.role !== 'sales' || data.active !== true) return [];
    return [item.id, String(data.fullName || '').trim()].filter(Boolean);
  })));
  const activeOwnerSet = new Set(activeOwnerKeys);
  const leadsCollection = db.collection('leads');
  const unassignedQuery = leadsCollection.where('assignedStatus', '==', 'unassigned');
  const returnedQuery = leadsCollection.where('assignedStatus', '==', 'returned');
  const canQueryAssignedOwners = activeOwnerKeys.length > 0 && activeOwnerKeys.length <= 30;
  const staleExcludedKeys = ['', ...activeOwnerKeys];
  const canQueryStaleOwners = staleExcludedKeys.length <= 10;
  const requiresOwnerScan = !canQueryAssignedOwners || !canQueryStaleOwners;
  const assignedQuery = canQueryAssignedOwners
    ? leadsCollection.where('assignedTo', 'in', activeOwnerKeys)
    : null;
  const staleQuery = canQueryStaleOwners
    ? leadsCollection.where('assignedTo', 'not-in', staleExcludedKeys)
    : null;

  const [allCountSnap, unassignedCountSnap, returnedCountSnap, assignedCountSnap, staleCountSnap, ownerScanSnap] = await Promise.all([
    leadsCollection.count().get(),
    unassignedQuery.count().get(),
    returnedQuery.count().get(),
    assignedQuery ? assignedQuery.count().get() : Promise.resolve(null),
    staleQuery ? staleQuery.count().get() : Promise.resolve(null),
    requiresOwnerScan
      ? leadsCollection.where('assignedStatus', 'in', ['active', 'accepted']).get()
      : Promise.resolve(null),
  ]);

  const ownerScanDocs = ownerScanSnap?.docs || [];
  const scannedAssignedDocs = ownerScanDocs.filter((item) => activeOwnerSet.has(String(item.data().assignedTo || '')));
  const scannedStaleDocs = ownerScanDocs.filter((item) => {
    const assignedTo = String(item.data().assignedTo || '').trim();
    return Boolean(assignedTo) && !activeOwnerSet.has(assignedTo);
  });
  const groupCounts: Record<LeadAssignmentGroup, number> = {
    all: allCountSnap.data().count,
    unassigned: unassignedCountSnap.data().count,
    returned: returnedCountSnap.data().count,
    assigned: assignedCountSnap?.data().count ?? scannedAssignedDocs.length,
    stale: staleCountSnap?.data().count ?? scannedStaleDocs.length,
  };

  const total = groupCounts[group];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;
  let docs: FirebaseFirestore.QueryDocumentSnapshot[] = [];

  if (group === 'all') {
    docs = (await leadsCollection.orderBy('createdAt', 'desc').offset(offset).limit(pageSize).get()).docs;
  } else if (group === 'unassigned') {
    docs = (await unassignedQuery.offset(offset).limit(pageSize).get()).docs;
  } else if (group === 'returned') {
    docs = (await returnedQuery.offset(offset).limit(pageSize).get()).docs;
  } else if (group === 'assigned') {
    docs = assignedQuery
      ? (await assignedQuery.offset(offset).limit(pageSize).get()).docs
      : scannedAssignedDocs.slice(offset, offset + pageSize);
  } else {
    docs = staleQuery
      ? (await staleQuery.offset(offset).limit(pageSize).get()).docs
      : scannedStaleDocs.slice(offset, offset + pageSize);
  }

  const leads = docs
    .map((item) => ({ ...item.data(), id: item.id }) as Record<string, any> & { id: string })
    .sort((a, b) => String(b.createdAt || b.updatedAt || '').localeCompare(String(a.createdAt || a.updatedAt || '')));

  return res.status(200).json({
    leads,
    group,
    groupCounts,
    page,
    pageSize,
    total,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
  });
}

function dashboardSummaryFilters(req: VercelRequest): DashboardSummaryFilters {
  return {
    sales: String(queryValue(req.query?.sales) || '').trim(),
    source: String(queryValue(req.query?.source) || '').trim(),
    course: String(queryValue(req.query?.course) || '').trim(),
    center: String(queryValue(req.query?.center) || '').trim(),
  };
}

function dashboardSummaryCacheKey(user: AppConfigUser, filters: DashboardSummaryFilters) {
  const scope = user.role === 'sales' ? `sales:${user.id}` : 'all';
  const raw = JSON.stringify({ schema: DASHBOARD_SUMMARY_CACHE_SCHEMA, scope, filters });
  return `dashboardSummary_${createHash('sha256').update(raw).digest('hex')}`;
}

function isDashboardDemoLead(lead: Record<string, any>) {
  const id = String(lead.id || '');
  const email = String(lead.email || '').toLowerCase();
  return id.startsWith('lead-demo-stage-')
    || id.startsWith('lead-demo-priority-')
    || /^lead-[1-5]$/.test(id)
    || /^lead-x\d+$/.test(id)
    || email.includes('@metta.test')
    || email.includes('@example.com');
}

function compactDashboardLead(doc: FirebaseFirestore.QueryDocumentSnapshot) {
  const data = doc.data() as Record<string, any>;
  return {
    ...data,
    id: String(data.id || doc.id),
    fullName: String(data.fullName || data.studentName || data.parentName || ''),
    parentName: String(data.parentName || ''),
    studentName: String(data.studentName || ''),
    phone: String(data.phone || ''),
    age: String(data.age || ''),
    source: String(data.source || ''),
    interestedCourse: String(data.interestedCourse || ''),
    centerName: String(data.centerName || ''),
    status: String(data.status || ''),
    assignedTo: String(data.assignedTo || ''),
    assignedToName: String(data.assignedToName || ''),
    assignedStatus: data.assignedStatus || (data.assignedTo ? 'accepted' : 'unassigned'),
    failedAssignedTo: String(data.failedAssignedTo || ''),
    failedAssignedToName: String(data.failedAssignedToName || ''),
    followUpDate: String(data.followUpDate || ''),
    createdAt: String(data.createdAt || data.updatedAt || ''),
    updatedAt: String(data.updatedAt || data.createdAt || ''),
    convertedToStudentId: String(data.convertedToStudentId || ''),
    dealSize: Number(data.dealSize || 0) || 0,
    discountPercent: Number(data.discountPercent || 0) || 0,
    expectedRevenue: Number(data.expectedRevenue || 0) || 0,
    revenue: Number(data.revenue || 0) || 0,
    pendingReason: String(data.pendingReason || ''),
    lostReason: String(data.lostReason || ''),
    stageHistory: Array.isArray(data.stageHistory) ? data.stageHistory : [],
  };
}

function matchesDashboardFilters(lead: Record<string, any>, filters: DashboardSummaryFilters) {
  if (filters.sales && lead.assignedTo !== filters.sales && lead.assignedToName !== filters.sales) return false;
  if (filters.source && lead.source !== filters.source) return false;
  if (filters.course && lead.interestedCourse !== filters.course) return false;
  if (filters.center && lead.centerName !== filters.center) return false;
  return true;
}

function dashboardPayloadSize(payload: unknown) {
  return Buffer.byteLength(JSON.stringify(payload), 'utf8');
}

async function readDashboardSummary(req: VercelRequest, res: VercelResponse) {
  const user = await requireActiveUser(req);
  if (!['admin', 'manager', 'sales'].includes(user.role)) throw new Error('User cannot read dashboard');

  const filters = dashboardSummaryFilters(req);
  const db = adminDb();
  let visibleBase: FirebaseFirestore.Query = db.collection('leads');
  if (user.role === 'sales') visibleBase = visibleBase.where('assignedTo', '==', user.id);

  if (user.role === 'sales' && filters.sales && filters.sales !== user.id && filters.sales !== user.fullName) {
    return res.status(200).json({ leads: [], cached: false, generatedAt: new Date().toISOString() });
  }

  const cacheKey = dashboardSummaryCacheKey(user, filters);
  const memoryCached = dashboardMemoryCache.get(cacheKey);
  if (memoryCached && memoryCached.expiresAt > Date.now()) {
    return res.status(200).json({ ...(memoryCached.payload as Record<string, unknown>), cached: true, memoryCached: true });
  }

  const cacheRef = db.collection('appCache').doc(cacheKey);
  const [latestSnap, visibleCountSnap, cacheSnap] = await Promise.all([
    db.collection('leads').orderBy('updatedAt', 'desc').limit(1).select('updatedAt', 'createdAt').get(),
    visibleBase.count().get(),
    cacheRef.get().catch(() => null),
  ]);
  const latestDoc = latestSnap.docs[0]?.data() || {};
  const latestUpdatedAt = String(latestDoc.updatedAt || latestDoc.createdAt || '');
  const visibleLeadCount = Number(visibleCountSnap.data().count || 0);
  const cached = cacheSnap?.exists ? cacheSnap.data() || {} : {};
  if (
    cached.schema === DASHBOARD_SUMMARY_CACHE_SCHEMA
    && cached.latestUpdatedAt === latestUpdatedAt
    && cached.visibleLeadCount === visibleLeadCount
    && cached.payload
  ) {
    rememberDashboardPayload(cacheKey, cached.payload);
    return res.status(200).json({ ...cached.payload, cached: true });
  }

  const snap = await visibleBase.select(...DASHBOARD_LEAD_FIELDS).get();
  const leads = snap.docs
    .map(compactDashboardLead)
    .filter((lead) => (isLeadManager(user) ? !isDashboardDemoLead(lead) : true))
    .filter((lead) => matchesDashboardFilters(lead, filters))
    .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')));

  const payload = {
    leads,
    cached: false,
    generatedAt: new Date().toISOString(),
  };
  rememberDashboardPayload(cacheKey, payload);

  if (dashboardPayloadSize(payload) <= DASHBOARD_SUMMARY_CACHE_MAX_BYTES) {
    await cacheRef.set({
      schema: DASHBOARD_SUMMARY_CACHE_SCHEMA,
      latestUpdatedAt,
      visibleLeadCount,
      generatedAt: payload.generatedAt,
      payload: { ...payload, cached: false },
    }).catch((error) => {
      console.warn('[DashboardSummary] Cache write failed:', error);
    });
  }

  return res.status(200).json(payload);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const id = String(queryValue(req.query?.id) || req.body?.id || '');

    if (req.method === 'GET' && id === 'publicCms') {
      res.setHeader?.('Cache-Control', PUBLIC_CMS_CACHE_HEADER);
      const cachedSnapshot = await readCachedPublicCmsSnapshot().catch((error) => {
        console.warn('[PublicCMS] Cannot read Firestore public CMS:', error);
        return null;
      });
      if (cachedSnapshot) {
        res.setHeader?.('X-Public-CMS-Source', cachedSnapshot.cache);
        return res.status(200).json(cachedSnapshot.snapshot);
      }

      res.setHeader?.('X-Public-CMS-Source', 'unavailable');
      return res.status(503).json({ error: 'Public CMS snapshot is unavailable.' });
    }

    if ((req.method === 'PUT' || req.method === 'PATCH') && id === 'publicCms') {
      const user = await requireActiveUser(req);
      if (!canManageCms(user)) throw new Error('Only CMS users can publish public CMS snapshots');

      invalidatePublicCmsCache();
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
      return res.status(410).json({ error: 'Auto chia lead đã được tắt. Vui lòng phân lead thủ công bằng tài khoản Admin hoặc Manager.' });
    }

    if (id === 'leadPage' && req.method === 'GET') {
      return await readLeadNumberedPage(req, res);
    }

    if (id === 'leadStatusCounts' && req.method === 'GET') {
      return await readLeadStatusCounts(req, res);
    }

    if (id === 'leadAssignmentPage' && req.method === 'GET') {
      return await readLeadAssignmentPage(req, res);
    }

    if (id === 'dashboardSummary' && req.method === 'GET') {
      return await readDashboardSummary(req, res);
    }

    if (id === 'leadImport' && req.method === 'POST') {
      return await leadImportHandler(
        req as Parameters<typeof leadImportHandler>[0],
        res as Parameters<typeof leadImportHandler>[1],
      );
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
