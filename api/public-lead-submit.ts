import crypto from 'node:crypto';
import { adminAppCheck, adminDb } from './_firebaseAdmin.js';
import { dedupeIndexPayload, findLeadByDedupe, normalizeLeadPhone } from './_leadDedupe.js';
import { sendLeadCapiSignal } from './_metaCapi.js';
import { notifyLeadAssigned, notifyLeadManagers } from './_notifications.js';

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
];

const WON_LEAD_STATUS = 'Đã đăng ký học';
const DEFAULT_DEAL_CURRENCY = 'VND';
const METTA_SUMMER_COURSE = 'METTA Summer 2026';
const METTA_SUMMER_DEAL_SIZE = 1999000;

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 6;
const DAY_MS = 24 * 60 * 60 * 1000;
const SOURCE_PRIORITY: Record<string, number> = {
  'Meta Lead Form': 5,
  Referral: 5,
  'Meta Ads': 4,
  Website: 4,
  'Zalo OA': 4,
  'Google Ads': 4,
  'Landing Page': 4,
  'Facebook Ads': 4,
  'Sales input': 3,
  'Instagram Ads': 3,
  'TikTok Ads': 3,
  Zalo: 3,
  'Walk-in': 3,
  'Khác': 1,
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

type LeadAssignmentSnapshot = {
  assignedTo?: string;
  assignedToName?: string;
  assignedStatus?: string;
};

type LeadAssignmentCount = {
  assignedTo?: string;
  assignedToName?: string;
  assignedStatus?: string;
  count?: number;
};

type LeadDoc = Record<string, any> & {
  id: string;
  parentName?: string;
  studentName?: string;
  fullName?: string;
  phone?: string;
  status?: string;
  assignedTo?: string;
  assignedToName?: string;
  assignedStatus?: string;
  assignedAtMs?: number;
  assignedExpiresAtMs?: number;
  stageHistory?: Array<{ status: string; enteredAt: string; exitedAt?: string }>;
  submissionHistory?: Array<Record<string, unknown>>;
};

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

function isValidEmail(email?: string) {
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone: string) {
  return /^0(3|5|7|8|9|1[2689])\d{8}$/.test(phone);
}

function cleanCourseName(value: unknown) {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, 120);
}

function firstHeaderValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function clientIp(req: VercelRequest) {
  const forwarded = firstHeaderValue(req.headers['x-forwarded-for']);
  return (forwarded?.split(',')[0] || firstHeaderValue(req.headers['x-real-ip']) || 'unknown').trim();
}

function rateLimitId(req: VercelRequest) {
  return crypto.createHash('sha256').update(`public-lead:${clientIp(req)}`).digest('hex').slice(0, 48);
}

async function enforceRateLimit(db: ReturnType<typeof adminDb>, req: VercelRequest) {
  const ref = db.collection('rateLimits').doc(rateLimitId(req));
  const nowMs = Date.now();

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : null;
    const windowStartMs = Number(data?.windowStartMs || 0);
    const count = Number(data?.count || 0);
    const sameWindow = nowMs - windowStartMs < RATE_LIMIT_WINDOW_MS;

    if (sameWindow && count >= RATE_LIMIT_MAX) {
      throw new Error('RATE_LIMITED');
    }

    tx.set(ref, {
      count: sameWindow ? count + 1 : 1,
      windowStartMs: sameWindow ? windowStartMs : nowMs,
      updatedAt: new Date(nowMs).toISOString(),
    }, { merge: true });
  });
}

async function verifyAppCheckIfRequired(req: VercelRequest) {
  if (process.env.REQUIRE_APP_CHECK !== 'true') return;
  const token = firstHeaderValue(req.headers['x-firebase-appcheck']);
  if (!token) throw new Error('APP_CHECK_REQUIRED');
  await adminAppCheck().verifyToken(token).catch(() => {
    throw new Error('APP_CHECK_INVALID');
  });
}

function originFromRequest(req: VercelRequest) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || 'www.metta.edu.vn';
  return `${Array.isArray(proto) ? proto[0] : proto}://${Array.isArray(host) ? host[0] : host}`;
}

function cleanName(value?: string) {
  return String(value || '').replace(/\s+/g, ' ').trim();
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

function stringOrExisting(value: unknown, existing: unknown, fallback = '') {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text) return text;
  const existingText = typeof existing === 'string' ? existing.trim() : '';
  return existingText || fallback;
}

function cleanPercent(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(100, Math.round(parsed));
}

function clampPriority(value: unknown) {
  const parsed = Number(value);
  if (parsed >= 5) return 5;
  if (parsed >= 4) return 4;
  if (parsed >= 3) return 3;
  if (parsed >= 2) return 2;
  return 1;
}

function cleanOptional(value: unknown) {
  const text = String(value || '').trim();
  return text || undefined;
}

function cleanTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const tags: string[] = [];
  value.forEach((item) => {
    const tag = String(item || '').replace(/\s+/g, ' ').trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) return;
    seen.add(key);
    tags.push(tag.slice(0, 48));
  });
  return tags.slice(0, 12);
}

function mergeTags(existing: unknown, incoming: unknown) {
  return cleanTags([
    ...(Array.isArray(existing) ? existing : []),
    ...cleanTags(incoming),
  ]);
}

function trackingFromLead(lead: Record<string, any>, sourceUrl: string, req: VercelRequest, now: string) {
  const input = lead.tracking && typeof lead.tracking === 'object' ? lead.tracking : {};
  return {
    sourceUrl,
    fbp: cleanOptional(input.fbp),
    fbc: cleanOptional(input.fbc),
    fbclid: cleanOptional(input.fbclid),
    utmSource: cleanOptional(input.utmSource),
    utmCampaign: cleanOptional(input.utmCampaign),
    utmContent: cleanOptional(input.utmContent),
    utmTerm: cleanOptional(input.utmTerm),
    userAgent: cleanOptional(input.userAgent) || firstHeaderValue(req.headers['user-agent']) || '',
    capturedAt: cleanOptional(input.capturedAt) || now,
  };
}

function activeSales(users: AdminUser[]) {
  return users.filter((user) => user.role === 'sales' && user.active);
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

function assignmentRulesTotal(rules: SalesAssignmentRule[]) {
  return rules.filter((rule) => rule.active).reduce((sum, rule) => sum + cleanPercent(rule.percent), 0);
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

function salesMatches(lead: LeadAssignmentSnapshot, rule: SalesAssignmentRule) {
  return lead.assignedTo === rule.salesId || lead.assignedTo === rule.salesName || lead.assignedToName === rule.salesName;
}

function chooseAutoAssignedSales(leads: LeadAssignmentCount[], users: AdminUser[], savedRules: SalesAssignmentRule[]) {
  const rules = normalizeAssignmentRules(users, savedRules).filter((rule) => rule.active && cleanPercent(rule.percent) > 0);
  if (!rules.length || assignmentRulesTotal(rules) !== 100) return null;

  const assignedTotal = leads.reduce((sum, lead) => sum + Number(lead.count || 0), 0);
  const totalAfter = assignedTotal + 1;
  const ranked = rules.map((rule) => {
    const current = leads
      .filter((lead) => salesMatches(lead, rule) && lead.assignedStatus !== 'returned')
      .reduce((sum, lead) => sum + Number(lead.count || 0), 0);
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
    cleanPercent(b.rule.percent) - cleanPercent(a.rule.percent),
  );

  const winner = ranked[0]?.rule;
  return winner ? { salesId: winner.salesId, salesName: winner.salesName } : null;
}

async function countAssignedLeadsForRule(db: ReturnType<typeof adminDb>, rule: SalesAssignmentRule) {
  const leadIds = new Set<string>();
  const collect = (snap: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>) => {
    snap.docs.forEach((doc) => {
      if (doc.data().assignedStatus !== 'returned') leadIds.add(doc.id);
    });
  };

  const queries = [
    db.collection('leads').where('assignedTo', '==', rule.salesId).get(),
    db.collection('leads').where('assignedTo', '==', rule.salesName).get(),
    db.collection('leads').where('assignedToName', '==', rule.salesName).get(),
  ];
  const snapshots = await Promise.all(queries);
  snapshots.forEach(collect);
  return leadIds.size;
}

async function priorityForSource(db: ReturnType<typeof adminDb>, source: string) {
  try {
    const snap = await db.collection('appConfig').doc('leadSourceConfigs').get();
    const data = snap.exists ? snap.data() : null;
    const configs = Array.isArray(data?.configs) ? data.configs : [];
    const match = configs.find((item: any) =>
      item?.active !== false && String(item?.name || '').toLowerCase() === source.toLowerCase(),
    );
    if (match) return clampPriority(match.priorityLevel);
  } catch (error) {
    console.warn('[PublicLead] Source priority config read failed, using fallback:', error);
  }
  return SOURCE_PRIORITY[source] || 1;
}

function assignmentStillActive(lead: LeadDoc | null, nowMs: number) {
  if (!lead?.assignedTo) return false;
  if (lead.assignedStatus === 'returned') return false;
  if (lead.assignedStatus === 'accepted') return true;
  const assignedAtMs = Number(lead.assignedAtMs || 0);
  const expiresAt = Number(lead.assignedExpiresAtMs || 0) || (assignedAtMs ? assignedAtMs + DAY_MS : 0);
  return !expiresAt || expiresAt > nowMs;
}

function nextStageHistory(existing: LeadDoc | null, status: string, now: string) {
  const history = Array.isArray(existing?.stageHistory) ? existing!.stageHistory : [];
  const last = history[history.length - 1];
  if (last?.status === status) return history;
  return [...history, { status, enteredAt: now }];
}

function nextSubmissionHistory(existing: LeadDoc | null, entry: Record<string, unknown>) {
  const history = Array.isArray(existing?.submissionHistory) ? existing!.submissionHistory : [];
  return [...history.slice(-19), entry];
}

async function pickAutoAssignedSales(db: ReturnType<typeof adminDb>) {
  try {
    const [usersSnap, rulesSnap] = await Promise.all([
      db.collection('users').get(),
      db.collection('appConfig').doc('salesAssignmentRules').get(),
    ]);
    const users = usersSnap.docs.map((item) => {
      const data = item.data() as Partial<AdminUser>;
      return { id: item.id, fullName: data.fullName || '', role: data.role || '', active: data.active === true };
    });
    const rulesData = rulesSnap.exists ? rulesSnap.data() : null;
    const rules = Array.isArray(rulesData?.rules) ? rulesData.rules as SalesAssignmentRule[] : [];
    const normalizedRules = normalizeAssignmentRules(users, rules);
    const countableRules = normalizedRules.filter((rule) => rule.active && cleanPercent(rule.percent) > 0);
    const counts = await Promise.all(countableRules.map(async (rule) => {
      return {
        assignedTo: rule.salesId,
        assignedToName: rule.salesName,
        assignedStatus: 'active',
        count: await countAssignedLeadsForRule(db, rule),
      };
    }));
    return chooseAutoAssignedSales(counts, users, normalizedRules);
  } catch (error) {
    console.warn('[PublicLead] Auto assignment config read failed, leaving lead unassigned:', error);
    return null;
  }
}

async function handlePublicLeadSubmit(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const lead = req.body || {};
  if (lead.company || lead.website) return res.status(200).json({ ok: true, spam: true });
  const legacyName = cleanName(lead.fullName);
  const parentName = cleanName(lead.parentName || (lead.contactType === 'parent' ? legacyName : ''));
  const studentName = cleanName(lead.studentName || (lead.contactType === 'student' ? legacyName : ''));
  if (!parentName || !studentName || !lead.phone) return res.status(400).json({ error: 'parentName, studentName and phone are required' });
  const interestedCourse = cleanCourseName(lead.interestedCourse);
  if (lead.interestedCourse && !interestedCourse) return res.status(400).json({ error: 'Invalid interestedCourse' });
  if (!isValidEmail(lead.email)) return res.status(400).json({ error: 'Invalid email' });

  const phone = normalizeLeadPhone(lead.phone);
  if (!isValidPhone(phone)) return res.status(400).json({ error: 'Invalid phone' });

  const db = adminDb();
  try {
    await verifyAppCheckIfRequired(req);
  } catch (error) {
    if (error instanceof Error && (error.message === 'APP_CHECK_REQUIRED' || error.message === 'APP_CHECK_INVALID')) {
      return res.status(401).json({ error: 'App Check verification failed' });
    }
    throw error;
  }
  try {
    await enforceRateLimit(db, req);
  } catch (error) {
    if (error instanceof Error && error.message === 'RATE_LIMITED') {
      return res.status(429).json({ error: 'Too many submissions. Please try again later.' });
    }
    throw error;
  }

  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const eventId = `lead_${nowMs}_${Math.random().toString(36).slice(2)}`;
  const source = String(lead.source || 'Website');
  const referralPhone = lead.referralPhone ? normalizeLeadPhone(lead.referralPhone) : '';
  if (String(source).toLowerCase() === 'referral' && !isValidPhone(referralPhone)) {
    return res.status(400).json({ error: 'Referral source requires a valid referralPhone' });
  }
  const existingLead = await findLeadByDedupe(db, phone, studentName) as LeadDoc | null;
  const existingAssignmentActive = assignmentStillActive(existingLead, nowMs);
  const requestedStatus = typeof lead.status === 'string' ? lead.status.trim() : '';
  const status = LEAD_STATUSES.includes(requestedStatus) ? requestedStatus : existingLead?.status || 'Lead mới';
  const isWonLead = status === WON_LEAD_STATUS;
  const rawDealSize = Number(lead.dealSize);
  const existingDealSize = Number(existingLead?.dealSize || 0);
  const dealSize = Number.isFinite(rawDealSize) && rawDealSize > 0
    ? rawDealSize
    : interestedCourse === METTA_SUMMER_COURSE
      ? METTA_SUMMER_DEAL_SIZE
      : existingDealSize;
  const rawExpectedRevenue = Number(lead.expectedRevenue);
  const existingExpectedRevenue = Number(existingLead?.expectedRevenue || 0);
  const expectedRevenue = Number.isFinite(rawExpectedRevenue) && rawExpectedRevenue > 0
    ? rawExpectedRevenue
    : dealSize || existingExpectedRevenue;
  const rawRevenue = Number(lead.revenue);
  const existingRevenue = Number(existingLead?.revenue || 0);
  const revenue = Number.isFinite(rawRevenue) && rawRevenue > 0 ? rawRevenue : isWonLead ? expectedRevenue : existingRevenue;

  const leadRef = existingLead ? db.collection('leads').doc(existingLead.id) : db.collection('leads').doc();
  const sourceUrl = lead.sourceUrl || `${originFromRequest(req)}/${lead.pageSlug || ''}`;
  const [priorityLevel, autoAssignedSales] = await Promise.all([
    priorityForSource(db, source),
    existingAssignmentActive ? Promise.resolve(null) : pickAutoAssignedSales(db),
  ]);
  const assignedTo = existingAssignmentActive ? String(existingLead?.assignedTo || '') : autoAssignedSales?.salesId || '';
  const assignedToName = existingAssignmentActive ? String(existingLead?.assignedToName || '') : autoAssignedSales?.salesName || '';
  const assignedAtMs = assignedTo ? existingAssignmentActive ? Number(existingLead?.assignedAtMs || nowMs) : nowMs : 0;
  const assignedExpiresAtMs = assignedTo
    ? existingAssignmentActive ? Number(existingLead?.assignedExpiresAtMs || 0) : nowMs + DAY_MS
    : 0;
  const assignedStatus = assignedTo ? existingAssignmentActive ? existingLead?.assignedStatus || 'active' : 'active' : 'unassigned';
  const tracking = trackingFromLead(lead, sourceUrl, req, now);
  const submissionEntry = stripUndefined({
    at: now,
    source,
    sourceUrl,
    formId: lead.formId || 'public-lead-form',
    pageSlug: lead.pageSlug || '',
    parentName,
    studentName,
    phone,
    interestedCourse,
  });

  const payload = stripUndefined({
    id: leadRef.id,
    fullName: studentName,
    parentName,
    studentName,
    phone,
    email: stringOrExisting(lead.email, existingLead?.email),
    contactType: lead.contactType || existingLead?.contactType || 'parent',
    age: stringOrExisting(lead.age, existingLead?.age),
    school: stringOrExisting(lead.school, existingLead?.school),
    currentClass: stringOrExisting(lead.currentClass, existingLead?.currentClass),
    interestedCourse: stringOrExisting(interestedCourse, existingLead?.interestedCourse),
    currentLevel: stringOrExisting(lead.currentLevel, existingLead?.currentLevel),
    targetGoal: stringOrExisting(lead.targetGoal, existingLead?.targetGoal),
    source,
    tags: mergeTags(existingLead?.tags, lead.tags),
    referralPhone,
    centerName: stringOrExisting(lead.centerName, existingLead?.centerName),
    priorityLevel,
    status,
    assignedTo,
    assignedToName,
    assignedBy: assignedTo ? existingAssignmentActive ? existingLead?.assignedBy || '' : 'auto-assignment-rule' : '',
    assignedAt: assignedTo ? existingAssignmentActive ? existingLead?.assignedAt || now : now : '',
    assignedAtMs,
    assignedExpiresAtMs,
    assignedStatus,
    followUpDate: existingLead?.followUpDate || '',
    consultationDate: existingLead?.consultationDate || '',
    dealSize,
    dealCurrency: typeof lead.dealCurrency === 'string' && lead.dealCurrency.trim() ? String(lead.dealCurrency).trim() : DEFAULT_DEAL_CURRENCY,
    dealPackage: stringOrExisting(lead.dealPackage, existingLead?.dealPackage),
    dealNote: stringOrExisting(lead.dealNote, existingLead?.dealNote),
    discountPercent: Number(existingLead?.discountPercent || 0),
    expectedRevenue,
    revenue,
    revenueAt: isWonLead ? existingLead?.revenueAt || now : existingLead?.revenueAt || '',
    expectedCloseDate: existingLead?.expectedCloseDate || '',
    enrollmentType: existingLead?.enrollmentType || 'new',
    wonAt: isWonLead ? existingLead?.wonAt || now : existingLead?.wonAt || '',
    pendingReason: existingLead?.pendingReason || '',
    pendingReasonNote: existingLead?.pendingReasonNote || '',
    pendingWarmthPercent: Number(existingLead?.pendingWarmthPercent || 0),
    lostReason: existingLead?.lostReason || '',
    lostNote: existingLead?.lostNote || '',
    initialNote: stringOrExisting(lead.note || lead.initialNote, existingLead?.initialNote),
    createdBy: 'public_landing_page',
    pageSlug: stringOrExisting(lead.pageSlug, existingLead?.pageSlug),
    formId: stringOrExisting(lead.formId, existingLead?.formId, 'public-lead-form'),
    tracking,
    createdAt: existingLead?.createdAt || now,
    updatedAt: now,
    lastPublicSubmittedAt: now,
    publicSubmitCount: Number(existingLead?.publicSubmitCount || 0) + 1,
    stageHistory: nextStageHistory(existingLead, status, now),
    submissionHistory: nextSubmissionHistory(existingLead, submissionEntry),
    convertedToStudentId: existingLead?.convertedToStudentId || '',
  });

  const leadWrite = db.batch();
  leadWrite.set(leadRef, payload, { merge: Boolean(existingLead) });
  const dedupeIndex = dedupeIndexPayload(payload as LeadDoc, now);
  if (dedupeIndex) {
    leadWrite.set(db.collection('leadDedupeIndex').doc(dedupeIndex.id), dedupeIndex.data, { merge: true });
  }
  await leadWrite.commit();

  const capiResult = await sendLeadCapiSignal({
    db,
    lead: payload,
    eventName: 'Lead',
    statusKey: isWonLead ? 'da-dang-ky-hoc' : 'lead-moi',
    source: 'server',
    request: req,
    formId: payload.formId,
  }).catch((error) => {
    console.warn('[PublicLead] CAPI Lead event failed:', error);
    return null;
  });

  if (assignedTo && !existingAssignmentActive) {
    await notifyLeadAssigned(db, {
      leadId: leadRef.id,
      leadName: studentName || parentName || phone,
      salesId: assignedTo,
      assignedByName: 'Auto rule',
      auto: true,
      createdAt: now,
    }).catch((error) => console.warn('[PublicLead] Sales notification failed:', error));
  } else if (!assignedTo) {
    await notifyLeadManagers(db, {
      title: 'Lead mới chưa có PIC',
      body: `${studentName || parentName || phone} từ ${source} cần được phân sales.`,
      leadId: leadRef.id,
      url: '/crm/lead-assignment',
      createdAt: now,
    }).catch((error) => console.warn('[PublicLead] Manager notification failed:', error));
  }

  const parentProfileId = `parent-${phone}`;
  const parentProfileRef = db.collection('parentProfiles').doc(parentProfileId);
  const parentProfileSnap = await parentProfileRef.get().catch(() => null);
  const existingParentProfile = parentProfileSnap?.exists ? parentProfileSnap.data() || {} : {};
  await parentProfileRef.set(stripUndefined({
    id: parentProfileId,
    phone,
    parentName,
    email: payload.email || existingParentProfile.email || '',
    occupation: existingParentProfile.occupation || '',
    workplace: existingParentProfile.workplace || '',
    incomeRange: existingParentProfile.incomeRange || '',
    knownFrom: existingParentProfile.knownFrom || source,
    numberOfChildren: existingParentProfile.numberOfChildren || '',
    address: existingParentProfile.address || '',
    preferredContactChannel: existingParentProfile.preferredContactChannel || 'Phone/Zalo',
    notes: existingParentProfile.notes || '',
    createdAt: existingParentProfile.createdAt || now,
    updatedAt: now,
  }), { merge: true });

  return res.status(200).json({
    ok: true,
    leadId: leadRef.id,
    mode: existingLead ? 'updated' : 'created',
    assignedTo,
    assignedToName,
    eventId: capiResult?.eventId || eventId,
    capi: {
      triggered: Boolean(capiResult?.sent),
      eventName: 'Lead',
      dedupEventId: capiResult?.eventId || eventId,
      logId: capiResult?.logId || '',
      status: capiResult?.status || 'failed',
    },
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await handlePublicLeadSubmit(req, res);
  } catch (error) {
    console.error('[PublicLead] Submit failed:', error);
    return res.status(500).json({ error: 'Không gửi được thông tin. Vui lòng thử lại.' });
  }
}
