import { adminDb } from './_firebaseAdmin.js';
import { dedupeIndexPayload, normalizeLeadPhone } from './_leadDedupe.js';
import { notifyLeadManagers } from './_notifications.js';

const GRAPH_API_BASE = 'https://graph.facebook.com';
const DEFAULT_GRAPH_VERSION = 'v25.0';
const SOURCE = 'Meta Lead Form';
const DEFAULT_STATUS = 'Lead mới';

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
  body?: any;
  url?: string;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  send?: (body: unknown) => void;
  end?: (body?: unknown) => void;
};

type MetaLeadField = {
  name?: string;
  values?: unknown[];
};

type MetaLeadDetail = {
  id?: string;
  created_time?: string;
  field_data?: MetaLeadField[];
};

type MetaLeadChange = {
  field?: string;
  value?: {
    leadgen_id?: string;
    page_id?: string;
    form_id?: string;
    ad_id?: string;
    adgroup_id?: string;
    created_time?: number;
  };
};

type LeadDoc = Record<string, any> & {
  id: string;
  assignedTo?: string;
  assignedToName?: string;
  assignedStatus?: string;
  createdAt?: string;
  source?: string;
  status?: string;
  stageHistory?: Array<{ status: string; enteredAt: string; exitedAt?: string }>;
  submissionHistory?: Array<Record<string, unknown>>;
  studentName?: string;
};

function graphVersion() {
  return String(process.env.META_LEAD_GRAPH_VERSION || process.env.META_GRAPH_VERSION || DEFAULT_GRAPH_VERSION)
    .trim()
    .replace(/^\/+/, '') || DEFAULT_GRAPH_VERSION;
}

function requiredPageAccessToken() {
  const token = String(process.env.META_LEAD_PAGE_ACCESS_TOKEN || process.env.META_PAGE_ACCESS_TOKEN || '').trim();
  if (!token) throw new Error('Missing META_LEAD_PAGE_ACCESS_TOKEN');
  return token;
}

function queryValue(req: VercelRequest, key: string) {
  const direct = req.query?.[key];
  if (Array.isArray(direct)) return direct[0] || '';
  if (direct) return direct;

  const host = Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host;
  const url = new URL(req.url || '/', `https://${host || 'www.metta.edu.vn'}`);
  return url.searchParams.get(key) || '';
}

function sendText(res: VercelResponse, status: number, text: string) {
  const next = res.status(status);
  if (next.send) return next.send(text);
  if (next.end) return next.end(text);
  return next.json({ text });
}

function cleanText(value: unknown) {
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

function normalizeLookup(value: unknown) {
  return cleanText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function fieldValue(field: MetaLeadField) {
  return (Array.isArray(field.values) ? field.values : [])
    .map((value) => cleanText(value))
    .filter(Boolean)
    .join(', ');
}

function findField(fields: MetaLeadField[], predicates: Array<(key: string, value: string) => boolean>) {
  for (const field of fields) {
    const key = normalizeLookup(field.name);
    const value = fieldValue(field);
    if (!value) continue;
    if (predicates.some((predicate) => predicate(key, value))) return value;
  }
  return '';
}

function looksLikeAge(value: string) {
  const normalized = normalizeLookup(value);
  return /\b(be|tuoi|age)\b/.test(normalized) && /\d/.test(normalized)
    || /\b\d{1,2}\s*[-–]\s*\d{1,2}\b/.test(value);
}

function extractLeadFields(fields: MetaLeadField[]) {
  const parentName = findField(fields, [
    (key) => ['full name', 'fullname', 'name', 'ho ten', 'ten'].includes(key),
    (key) => key.includes('ho ten') || key.includes('ten cua ban'),
  ]);
  const phone = normalizeLeadPhone(findField(fields, [
    (key) => key.includes('phone') || key.includes('sdt') || key.includes('so dien thoai'),
  ]));
  const email = findField(fields, [
    (key) => key.includes('email') || key.includes('e mail'),
  ]);
  const age = findField(fields, [
    (key, value) => key.includes('do tuoi') || key.includes('tuoi') || key.includes('age') || looksLikeAge(value),
  ]);

  return { parentName, phone, email, age };
}

function fieldSummary(fields: MetaLeadField[]) {
  return fields
    .map((field) => {
      const name = cleanText(field.name);
      const value = fieldValue(field);
      return name && value ? `${name}: ${value}` : '';
    })
    .filter(Boolean);
}

async function graphGet<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const token = requiredPageAccessToken();
  const search = new URLSearchParams({ ...params, access_token: token });
  const response = await fetch(`${GRAPH_API_BASE}/${graphVersion()}/${path}?${search.toString()}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = cleanText((payload as any)?.error?.message) || `Meta Graph API returned ${response.status}`;
    throw new Error(message);
  }
  return payload as T;
}

async function metaName(id: string | undefined, field = 'name') {
  if (!id) return '';
  return graphGet<Record<string, unknown>>(id, { fields: field })
    .then((payload) => cleanText(payload[field]))
    .catch(() => '');
}

function leadCreatedAt(detail: MetaLeadDetail, change: MetaLeadChange, fallback: string) {
  const fromDetail = cleanText(detail.created_time);
  if (fromDetail && !Number.isNaN(Date.parse(fromDetail))) return new Date(fromDetail).toISOString();
  const fromChange = Number(change.value?.created_time || 0);
  if (fromChange > 0) return new Date(fromChange * 1000).toISOString();
  return fallback;
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

async function findExistingLead(db: ReturnType<typeof adminDb>, phone: string, metaLeadId: string) {
  const metaSnap = await db.collection('leads').where('metaLeadId', '==', metaLeadId).limit(1).get();
  if (!metaSnap.empty) return { id: metaSnap.docs[0].id, ...metaSnap.docs[0].data() } as LeadDoc;

  if (!phone) return null;
  const phoneSnap = await db.collection('leads').where('phone', '==', phone).limit(20).get();
  const leads = phoneSnap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }) as LeadDoc);
  return leads.find((lead) => lead.source === SOURCE && !cleanText(lead.studentName))
    || leads.find((lead) => !cleanText(lead.studentName))
    || null;
}

async function priorityForSource(db: ReturnType<typeof adminDb>) {
  try {
    const snap = await db.collection('appConfig').doc('leadSourceConfigs').get();
    const configs = Array.isArray(snap.data()?.configs) ? snap.data()!.configs : [];
    const match = configs.find((item: any) =>
      item?.active !== false && String(item?.name || '').toLowerCase() === SOURCE.toLowerCase(),
    );
    const priority = Number(match?.priorityLevel);
    if (priority >= 1 && priority <= 5) return priority;
  } catch (error) {
    console.warn('[MetaLeadWebhook] Cannot read source priority config:', error);
  }
  return 5;
}

async function writeParentProfile(db: ReturnType<typeof adminDb>, input: {
  phone: string;
  parentName: string;
  email: string;
  source: string;
  now: string;
}) {
  if (!input.phone) return;
  const ref = db.collection('parentProfiles').doc(`parent-${input.phone}`);
  const snap = await ref.get().catch(() => null);
  const existing = snap?.exists ? snap.data() || {} : {};
  await ref.set(stripUndefined({
    id: `parent-${input.phone}`,
    phone: input.phone,
    parentName: input.parentName || existing.parentName || '',
    email: input.email || existing.email || '',
    occupation: existing.occupation || '',
    workplace: existing.workplace || '',
    incomeRange: existing.incomeRange || '',
    knownFrom: existing.knownFrom || input.source,
    numberOfChildren: existing.numberOfChildren || '',
    address: existing.address || '',
    preferredContactChannel: existing.preferredContactChannel || 'Phone/Zalo',
    notes: existing.notes || '',
    createdAt: existing.createdAt || input.now,
    updatedAt: input.now,
  }), { merge: true });
}

async function processLeadgenChange(db: ReturnType<typeof adminDb>, change: MetaLeadChange) {
  const metaLeadId = cleanText(change.value?.leadgen_id);
  if (!metaLeadId) return { skipped: true, reason: 'missing_leadgen_id' };

  const eventRef = db.collection('metaLeadWebhookEvents').doc(metaLeadId);
  const eventSnap = await eventRef.get();
  if (eventSnap.exists && cleanText(eventSnap.data()?.leadId)) {
    return { skipped: true, reason: 'already_processed', leadId: cleanText(eventSnap.data()?.leadId) };
  }

  const now = new Date().toISOString();
  await eventRef.set(stripUndefined({
    id: metaLeadId,
    status: 'received',
    receivedAt: eventSnap.data()?.receivedAt || now,
    updatedAt: now,
    pageId: change.value?.page_id,
    formId: change.value?.form_id,
    adId: change.value?.ad_id,
    adgroupId: change.value?.adgroup_id,
  }), { merge: true });

  const detail = await graphGet<MetaLeadDetail>(metaLeadId, { fields: 'created_time,field_data' });
  const fields = Array.isArray(detail.field_data) ? detail.field_data : [];
  const extracted = extractLeadFields(fields);
  if (!extracted.phone) throw new Error('Meta lead is missing phone number');

  const formId = cleanText(change.value?.form_id);
  const adId = cleanText(change.value?.ad_id);
  const [formName, adName] = await Promise.all([
    metaName(formId),
    metaName(adId),
  ]);

  const existing = await findExistingLead(db, extracted.phone, metaLeadId);
  const leadRef = existing ? db.collection('leads').doc(existing.id) : db.collection('leads').doc();
  const status = cleanText(existing?.status) || DEFAULT_STATUS;
  const assignedTo = cleanText(existing?.assignedTo);
  const assignedToName = cleanText(existing?.assignedToName);
  const assignedStatus = assignedTo ? cleanText(existing?.assignedStatus) || 'active' : 'unassigned';
  const createdAt = existing?.createdAt || leadCreatedAt(detail, change, now);
  const priorityLevel = await priorityForSource(db);
  const answers = fieldSummary(fields);
  const leadName = extracted.parentName || existing?.parentName || existing?.fullName || '';
  const displayName = leadName || extracted.phone || 'Lead Meta';
  const noteParts = [
    `Meta Lead Form${formName ? ` - ${formName}` : ''}.`,
    extracted.age ? `Độ tuổi: ${extracted.age}.` : '',
    adName ? `Ad: ${adName}.` : '',
    answers.length ? `Câu trả lời: ${answers.join(' | ')}` : '',
  ].filter(Boolean);
  const submissionEntry = stripUndefined({
    at: now,
    source: SOURCE,
    metaLeadId,
    pageId: change.value?.page_id,
    formId,
    formName,
    adId,
    adName,
    age: extracted.age,
    parentName: extracted.parentName,
    phone: extracted.phone,
  });

  const payload = stripUndefined({
    id: leadRef.id,
    fullName: leadName,
    parentName: extracted.parentName || existing?.parentName || existing?.fullName || '',
    studentName: cleanText(existing?.studentName),
    phone: extracted.phone,
    email: extracted.email || existing?.email || '',
    contactType: existing?.contactType || 'parent',
    age: extracted.age || existing?.age || '',
    school: existing?.school || '',
    currentClass: existing?.currentClass || '',
    interestedCourse: existing?.interestedCourse || '',
    currentLevel: existing?.currentLevel || '',
    targetGoal: existing?.targetGoal || '',
    source: SOURCE,
    tags: Array.from(new Set([...(Array.isArray(existing?.tags) ? existing!.tags : []), 'Meta Lead Form'])).slice(0, 12),
    referralPhone: existing?.referralPhone || '',
    centerName: existing?.centerName || '',
    priorityLevel,
    status,
    assignedTo,
    assignedToName,
    assignedBy: assignedTo ? existing?.assignedBy || '' : '',
    assignedAt: assignedTo ? existing?.assignedAt || now : '',
    assignedAtMs: assignedTo ? Number(existing?.assignedAtMs || Date.now()) : 0,
    assignedExpiresAtMs: assignedTo ? Number(existing?.assignedExpiresAtMs || 0) : 0,
    assignedStatus,
    followUpDate: existing?.followUpDate || '',
    consultationDate: existing?.consultationDate || '',
    dealSize: existing?.dealSize,
    dealCurrency: existing?.dealCurrency || 'VND',
    dealPackage: existing?.dealPackage || '',
    dealNote: existing?.dealNote || '',
    discountPercent: Number(existing?.discountPercent || 0),
    expectedRevenue: existing?.expectedRevenue,
    revenue: existing?.revenue,
    revenueAt: existing?.revenueAt || '',
    expectedCloseDate: existing?.expectedCloseDate || '',
    enrollmentType: existing?.enrollmentType || 'new',
    wonAt: existing?.wonAt || '',
    pendingReason: existing?.pendingReason || '',
    pendingReasonNote: existing?.pendingReasonNote || '',
    pendingWarmthPercent: Number(existing?.pendingWarmthPercent || 0),
    lostReason: existing?.lostReason || '',
    lostNote: existing?.lostNote || '',
    initialNote: existing?.initialNote || noteParts.join(' '),
    createdBy: existing?.createdBy || 'meta_lead_ads',
    pageSlug: existing?.pageSlug || '',
    formId: formId ? `meta-${formId}` : 'meta-lead-form',
    metaLeadId,
    metaPageId: cleanText(change.value?.page_id),
    metaFormId: formId,
    metaFormName: formName,
    metaAdId: adId,
    metaAdName: adName,
    tracking: {
      sourceUrl: `meta://leadgen/${metaLeadId}`,
      utmSource: 'meta',
      utmMedium: 'lead_form',
      utmCampaign: formName || '',
      capturedAt: now,
    },
    createdAt,
    updatedAt: now,
    lastMetaLeadSubmittedAt: now,
    metaLeadSubmitCount: Number(existing?.metaLeadSubmitCount || 0) + 1,
    stageHistory: nextStageHistory(existing, status, now),
    submissionHistory: nextSubmissionHistory(existing, submissionEntry),
    convertedToStudentId: existing?.convertedToStudentId || '',
  });

  const batch = db.batch();
  batch.set(leadRef, payload, { merge: Boolean(existing) });
  const dedupeIndex = dedupeIndexPayload(payload as LeadDoc, now);
  if (dedupeIndex) batch.set(db.collection('leadDedupeIndex').doc(dedupeIndex.id), dedupeIndex.data, { merge: true });
  batch.set(eventRef, {
    status: 'processed',
    leadId: leadRef.id,
    updatedAt: now,
  }, { merge: true });
  await batch.commit();

  await writeParentProfile(db, {
    phone: extracted.phone,
    parentName: payload.parentName,
    email: payload.email,
    source: SOURCE,
    now,
  });

  if (!assignedTo) {
    await notifyLeadManagers(db, {
      title: 'Lead Meta mới chưa có PIC',
      body: `${displayName} từ Meta Lead Form cần được phân sales.`,
      leadId: leadRef.id,
      url: '/crm/lead-assignment',
      createdAt: now,
    }).catch((error) => console.warn('[MetaLeadWebhook] Manager notification failed:', error));
  }

  return { leadId: leadRef.id, mode: existing ? 'updated' : 'created', age: extracted.age };
}

function leadgenChanges(body: any): MetaLeadChange[] {
  if (!Array.isArray(body?.entry)) return [];
  return body.entry.flatMap((entry: any) =>
    (Array.isArray(entry?.changes) ? entry.changes : [])
      .filter((change: MetaLeadChange) => change?.field === 'leadgen' && change?.value?.leadgen_id),
  );
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  const verifyToken = String(process.env.META_LEAD_WEBHOOK_VERIFY_TOKEN || '').trim();
  const mode = queryValue(req, 'hub.mode');
  const token = queryValue(req, 'hub.verify_token');
  const challenge = queryValue(req, 'hub.challenge');
  if (verifyToken && mode === 'subscribe' && token === verifyToken) {
    return sendText(res, 200, challenge);
  }
  return sendText(res, 403, 'Forbidden');
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  const changes = leadgenChanges(body);
  if (!changes.length) return res.status(200).json({ ok: true, processed: 0, skipped: true });

  const db = adminDb();
  const results = [];
  for (const change of changes) {
    try {
      results.push(await processLeadgenChange(db, change));
    } catch (error) {
      const metaLeadId = cleanText(change.value?.leadgen_id);
      if (metaLeadId) {
        await db.collection('metaLeadWebhookEvents').doc(metaLeadId).set({
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          updatedAt: new Date().toISOString(),
        }, { merge: true }).catch(() => undefined);
      }
      console.error('[MetaLeadWebhook] Failed to process lead:', error);
      results.push({ failed: true, leadgenId: metaLeadId, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return res.status(200).json({ ok: true, results });
}

export default async function metaLeadWebhookHandler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') return await handleGet(req, res);
    if (req.method === 'POST') return await handlePost(req, res);
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[MetaLeadWebhook] Unexpected error:', error);
    return res.status(500).json({ error: 'Cannot process Meta lead webhook.' });
  }
}
