import crypto from 'node:crypto';
import { adminAppCheck, adminDb } from './_firebaseAdmin.js';

const COURSE_OPTIONS = [
  'Mau giao',
  'Mẫu giáo',
  'Thieu Nhi',
  'Thiếu Nhi',
  'Phonics',
  'METTA Kiddies',
  'METTA on Phonics',
  'METTA Young Learner',
  'METTA Young Learners',
];
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX = 6;

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
  const host = req.headers.host || 'metta-academy.gg99.vn';
  return `${Array.isArray(proto) ? proto[0] : proto}://${Array.isArray(host) ? host[0] : host}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const lead = req.body || {};
  if (lead.company || lead.website) return res.status(200).json({ ok: true, spam: true });
  if (!lead.fullName || !lead.phone) return res.status(400).json({ error: 'fullName and phone are required' });
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

  const now = new Date().toISOString();
  const eventId = `lead_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const source = lead.source || 'Website';
  const leadRef = db.collection('leads').doc();
  const sourceUrl = lead.sourceUrl || `${originFromRequest(req)}/${lead.pageSlug || ''}`;

  const payload = {
    id: leadRef.id,
    fullName: String(lead.fullName).trim(),
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
    status: 'Lead mới',
    assignedTo: '',
    assignedToName: '',
    assignedStatus: 'unassigned',
    followUpDate: '',
    consultationDate: '',
    dealSize: 0,
    dealCurrency: 'VND',
    dealPackage: '',
    dealNote: '',
    expectedRevenue: 0,
    expectedCloseDate: '',
    enrollmentType: 'new',
    wonAt: '',
    lostReason: '',
    lostNote: '',
    initialNote: lead.note || lead.initialNote || '',
    createdBy: 'public_landing_page',
    pageSlug: lead.pageSlug || '',
    formId: lead.formId || 'public-lead-form',
    createdAt: now,
    updatedAt: now,
    convertedToStudentId: '',
  };

  await leadRef.set(payload);

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
