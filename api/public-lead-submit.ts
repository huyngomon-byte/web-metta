import crypto from 'node:crypto';
import { adminAppCheck, adminDb } from './_firebaseAdmin.js';
import { notifyLeadAssigned, notifyLeadManagers } from './_notifications.js';

const COURSE_OPTIONS = [
  'Mẫu giáo',
  'Thiếu Nhi',
  'Phonics',
  'METTA Kiddies',
  'METTA on Phonics',
  'METTA Young Learner',
  'METTA Young Learners',
  'Metta+ Pass',
];
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

function normalizePhone(phone: string) {
  return phone.replace(/[\s.\-()]/g, '').replace(/^\+84/, '0');
}

function isValidPhone(phone: string) {
  return /^0(3|5|7|8|9|1[2689])\d{8}$/.test(phone);
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
      const snap = await db.collection('leads').where('assignedTo', '==', rule.salesId).count().get();
      return {
        assignedTo: rule.salesId,
        assignedToName: rule.salesName,
        assignedStatus: 'active',
        count: snap.data().count,
      };
    }));
    return chooseAutoAssignedSales(counts, users, normalizedRules);
  } catch (error) {
    console.warn('[PublicLead] Auto assignment config read failed, leaving lead unassigned:', error);
    return null;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const lead = req.body || {};
  if (lead.company || lead.website) return res.status(200).json({ ok: true, spam: true });
  const legacyName = cleanName(lead.fullName);
  const parentName = cleanName(lead.parentName || (lead.contactType === 'parent' ? legacyName : ''));
  const studentName = cleanName(lead.studentName || (lead.contactType === 'student' ? legacyName : ''));
  if (!parentName || !studentName || !lead.phone) return res.status(400).json({ error: 'parentName, studentName and phone are required' });
  if (lead.interestedCourse && !COURSE_OPTIONS.includes(lead.interestedCourse)) return res.status(400).json({ error: 'Invalid interestedCourse' });
  if (!isValidEmail(lead.email)) return res.status(400).json({ error: 'Invalid email' });

  const phone = normalizePhone(String(lead.phone));
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
  const referralPhone = lead.referralPhone ? normalizePhone(String(lead.referralPhone)) : '';
  if (String(source).toLowerCase() === 'referral' && !isValidPhone(referralPhone)) {
    return res.status(400).json({ error: 'Referral source requires a valid referralPhone' });
  }
  const leadRef = db.collection('leads').doc();
  const sourceUrl = lead.sourceUrl || `${originFromRequest(req)}/${lead.pageSlug || ''}`;
  const [priorityLevel, autoAssignedSales] = await Promise.all([
    priorityForSource(db, source),
    pickAutoAssignedSales(db),
  ]);
  const assignedTo = autoAssignedSales?.salesId || '';
  const assignedToName = autoAssignedSales?.salesName || '';

  const payload = {
    id: leadRef.id,
    fullName: studentName,
    parentName,
    studentName,
    phone,
    email: lead.email ? String(lead.email).trim() : '',
    contactType: lead.contactType || 'parent',
    age: lead.age || '',
    school: lead.school || '',
    currentClass: lead.currentClass || '',
    interestedCourse: lead.interestedCourse || '',
    currentLevel: lead.currentLevel || '',
    targetGoal: lead.targetGoal || '',
    source,
    referralPhone,
    centerName: lead.centerName || '',
    priorityLevel,
    status: 'Lead mới',
    assignedTo,
    assignedToName,
    assignedBy: assignedTo ? 'auto-assignment-rule' : '',
    assignedAt: assignedTo ? now : '',
    ...(assignedTo ? { assignedAtMs: nowMs, assignedExpiresAtMs: nowMs + DAY_MS } : {}),
    assignedStatus: assignedTo ? 'active' : 'unassigned',
    followUpDate: '',
    consultationDate: '',
    dealSize: 0,
    dealCurrency: 'VND',
    dealPackage: '',
    dealNote: '',
    discountPercent: 0,
    expectedRevenue: 0,
    revenue: 0,
    revenueAt: '',
    expectedCloseDate: '',
    enrollmentType: 'new',
    wonAt: '',
    pendingReason: '',
    pendingReasonNote: '',
    pendingWarmthPercent: 0,
    lostReason: '',
    lostNote: '',
    initialNote: lead.note || lead.initialNote || '',
    createdBy: 'public_landing_page',
    pageSlug: lead.pageSlug || '',
    formId: lead.formId || 'public-lead-form',
    createdAt: now,
    updatedAt: now,
    stageHistory: [{ status: 'Lead mới', enteredAt: now }],
    convertedToStudentId: '',
  };

  await leadRef.set(payload);

  if (assignedTo) {
    await notifyLeadAssigned(db, {
      leadId: leadRef.id,
      leadName: studentName || parentName || phone,
      salesId: assignedTo,
      assignedByName: 'Auto rule',
      auto: true,
      createdAt: now,
    }).catch((error) => console.warn('[PublicLead] Sales notification failed:', error));
  } else {
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
  await parentProfileRef.set({
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
  }, { merge: true });

  const capiRef = db.collection('capiEvents').doc();
  await capiRef.set({
    id: capiRef.id,
    eventName: 'Lead',
    eventId,
    formId: payload.formId,
    leadId: leadRef.id,
    sourceUrl,
    status: 'pending',
    responseMessage: 'Lead created. CAPI can be sent by /api/capi-send-event.',
    payloadPreview: {
      event_name: 'Lead',
      course: payload.interestedCourse,
      source: payload.source,
      lead_status: payload.status,
    },
    createdAt: now,
  });

  return res.status(200).json({
    ok: true,
    leadId: leadRef.id,
    eventId,
    capi: { triggered: false, eventName: 'Lead', dedupEventId: eventId, logId: capiRef.id },
  });
}
