import crypto from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';

export type VercelRequestLike = {
  headers: Record<string, string | string[] | undefined>;
};

export type CapiTracking = {
  sourceUrl?: string;
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  utmSource?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  userAgent?: string;
  capturedAt?: string;
};

export type LeadForCapi = {
  id: string;
  phone?: string;
  email?: string;
  interestedCourse?: string;
  source?: string;
  status?: string;
  dealCurrency?: string;
  dealSize?: number;
  expectedRevenue?: number;
  revenue?: number;
  formId?: string;
  pageSlug?: string;
  sourceUrl?: string;
  tracking?: CapiTracking;
};

type SendLeadCapiOptions = {
  db: Firestore;
  lead: LeadForCapi;
  eventName: string;
  statusKey?: string;
  source?: 'server' | 'test' | 'retry';
  request?: VercelRequestLike;
  previousStatus?: string;
  nextStatus?: string;
  formId?: string;
};

type ManualEventInput = {
  event_name?: string;
  event_id?: string;
  event_source_url?: string;
  email?: string;
  phone?: string;
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  formId?: string;
  form_id?: string;
  leadId?: string;
  lead_id?: string;
  custom_data?: Record<string, unknown>;
};

const GRAPH_API_BASE = 'https://graph.facebook.com';
const DEFAULT_GRAPH_VERSION = 'v25.0';
const DEFAULT_SOURCE_URL = 'https://www.metta.edu.vn/';
const DEFAULT_CAPI_TIMEOUT_MS = 8000;
const SUCCESS_STATUS = 'success';

function firstHeaderValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function shortMessage(value: unknown) {
  if (typeof value === 'string') return value.slice(0, 800);
  return JSON.stringify(value || {}).slice(0, 800);
}

export function sha256(value?: string) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return undefined;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function normalizeEmail(email?: string) {
  return String(email || '').trim().toLowerCase();
}

export function normalizeVietnamPhoneForHash(phone?: string) {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0084')) digits = digits.slice(2);
  if (digits.startsWith('84')) return digits;
  if (digits.startsWith('0')) return `84${digits.slice(1)}`;
  return digits;
}

export function toStatusKey(value?: string) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'unknown';
}

function cleanDocPart(value: string) {
  return toStatusKey(value).replace(/[^a-z0-9-]/g, '-').slice(0, 80) || 'event';
}

function graphVersion() {
  const version = String(process.env.META_GRAPH_VERSION || DEFAULT_GRAPH_VERSION).trim();
  return version.startsWith('v') ? version : `v${version}`;
}

function runtimeConfig() {
  const pixelId = String(process.env.META_PIXEL_ID || '').trim();
  const accessToken = String(process.env.META_ACCESS_TOKEN || '').trim();
  const enabled = process.env.META_CAPI_ENABLED !== 'false';
  return {
    enabled,
    pixelId,
    accessToken,
    graphVersion: graphVersion(),
    testEventCode: String(process.env.META_TEST_EVENT_CODE || '').trim(),
  };
}

function capiTimeoutMs() {
  const parsed = Number(process.env.META_CAPI_TIMEOUT_MS || DEFAULT_CAPI_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CAPI_TIMEOUT_MS;
}

function clientIp(req?: VercelRequestLike) {
  if (!req) return '';
  const forwarded = firstHeaderValue(req.headers['x-forwarded-for']);
  return (forwarded?.split(',')[0] || firstHeaderValue(req.headers['x-real-ip']) || '').trim();
}

function requestUserAgent(req?: VercelRequestLike) {
  return firstHeaderValue(req?.headers['user-agent']);
}

function sourceUrlForLead(lead: LeadForCapi) {
  return lead.tracking?.sourceUrl
    || lead.sourceUrl
    || (lead.pageSlug ? `https://www.metta.edu.vn/${lead.pageSlug}` : DEFAULT_SOURCE_URL);
}

function fbcFromTracking(tracking?: CapiTracking) {
  if (tracking?.fbc) return tracking.fbc;
  if (!tracking?.fbclid) return undefined;
  const capturedMs = tracking.capturedAt ? Date.parse(tracking.capturedAt) : Date.now();
  return `fb.1.${Number.isFinite(capturedMs) ? capturedMs : Date.now()}.${tracking.fbclid}`;
}

function eventValue(lead: LeadForCapi, eventName: string) {
  const revenue = Number(lead.revenue || 0);
  const expectedRevenue = Number(lead.expectedRevenue || 0);
  const dealSize = Number(lead.dealSize || 0);
  if (eventName === 'Purchase') return revenue || expectedRevenue || dealSize || 0;
  if (eventName === 'InitiateCheckout' || eventName === 'QualifiedLead') return expectedRevenue || dealSize || revenue || 0;
  return 0;
}

function buildEventId(leadId: string, eventName: string, statusKey: string) {
  return `${leadId}_${cleanDocPart(eventName)}_${cleanDocPart(statusKey)}`;
}

function payloadPreviewFor(event: Record<string, any>, ledgerId?: string, statusKey?: string) {
  return {
    event_name: event.event_name,
    event_id: event.event_id,
    status_key: statusKey,
    ledger_id: ledgerId,
    event_source_url: event.event_source_url,
    custom_data: event.custom_data || {},
    user_data_keys: Object.keys(event.user_data || {}).filter((key) => Boolean(event.user_data[key])),
  };
}

function removeUndefined<T extends Record<string, any>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== '')) as T;
}

function buildLeadEventPayload(options: SendLeadCapiOptions, eventId: string) {
  const { lead, eventName, request } = options;
  const tracking = lead.tracking || {};
  const value = eventValue(lead, eventName);
  const userData = removeUndefined({
    em: sha256(normalizeEmail(lead.email)),
    ph: sha256(normalizeVietnamPhoneForHash(lead.phone)),
    fbp: tracking.fbp,
    fbc: fbcFromTracking(tracking),
    external_id: sha256(lead.id),
    client_ip_address: clientIp(request),
    client_user_agent: requestUserAgent(request) || tracking.userAgent,
  });
  const customData = removeUndefined({
    currency: value ? (lead.dealCurrency || 'VND') : undefined,
    value: value || undefined,
    content_name: lead.interestedCourse || undefined,
    content_category: 'education',
    lead_status: options.nextStatus || lead.status || undefined,
    previous_status: options.previousStatus || undefined,
    lead_source: lead.source || undefined,
    utm_source: tracking.utmSource,
    utm_campaign: tracking.utmCampaign,
    utm_content: tracking.utmContent,
    utm_term: tracking.utmTerm,
  });

  return {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: 'website',
    event_source_url: sourceUrlForLead(lead),
    user_data: userData,
    custom_data: customData,
  };
}

async function postMetaEvent(config: ReturnType<typeof runtimeConfig>, event: Record<string, any>) {
  const payload = {
    data: [event],
    ...(config.testEventCode ? { test_event_code: config.testEventCode } : {}),
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), capiTimeoutMs());
  try {
    const response = await fetch(`${GRAPH_API_BASE}/${config.graphVersion}/${config.pixelId}/events?access_token=${encodeURIComponent(config.accessToken)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const result = await response.json().catch(() => ({ statusText: response.statusText }));
    return { ok: response.ok, status: response.status, result };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      result: { error: error instanceof Error ? error.message : 'Meta CAPI request failed.' },
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function writeCapiLog(db: Firestore, input: {
  event: Record<string, any>;
  status: 'success' | 'failed' | 'pending';
  source: 'server' | 'test' | 'retry';
  responseMessage: string;
  leadId?: string;
  formId?: string;
  ledgerId?: string;
  statusKey?: string;
  attempts?: number;
  httpStatus?: number;
}) {
  const now = new Date().toISOString();
  const logRef = db.collection('capiEvents').doc();
  await logRef.set({
    id: logRef.id,
    eventName: input.event.event_name,
    eventId: input.event.event_id,
    formId: input.formId || '',
    leadId: input.leadId || '',
    sourceUrl: input.event.event_source_url || '',
    source: input.source,
    status: input.status,
    responseMessage: input.responseMessage,
    payloadPreview: payloadPreviewFor(input.event, input.ledgerId, input.statusKey),
    ledgerId: input.ledgerId || '',
    attempts: input.attempts || 1,
    httpStatus: input.httpStatus || 0,
    createdAt: now,
    updatedAt: now,
  });
  return logRef.id;
}

export async function sendLeadCapiSignal(options: SendLeadCapiOptions) {
  const { db, lead, eventName } = options;
  const statusKey = options.statusKey || toStatusKey(options.nextStatus || lead.status || eventName);
  const eventId = buildEventId(lead.id, eventName, statusKey);
  const ledgerId = buildEventId(lead.id, eventName, statusKey);
  const ledgerRef = db.collection('capiSignalLedger').doc(ledgerId);
  const ledgerSnap = await ledgerRef.get().catch(() => null);
  const ledger = ledgerSnap?.exists ? ledgerSnap.data() || {} : {};
  const attempts = Number(ledger.attempts || 0) + 1;

  if (ledger.status === SUCCESS_STATUS) {
    return {
      skipped: true,
      sent: false,
      status: SUCCESS_STATUS,
      eventId,
      ledgerId,
      logId: ledger.logId || '',
      message: 'Duplicate success event skipped.',
    };
  }

  const event = buildLeadEventPayload(options, eventId);
  const config = runtimeConfig();

  if (!config.enabled || !config.pixelId || !config.accessToken) {
    const message = !config.enabled
      ? 'Meta CAPI disabled by META_CAPI_ENABLED=false; event queued.'
      : 'Missing META_PIXEL_ID or META_ACCESS_TOKEN; event queued for retry.';
    const logId = await writeCapiLog(db, {
      event,
      status: 'pending',
      source: options.source || 'server',
      responseMessage: message,
      leadId: lead.id,
      formId: options.formId || lead.formId,
      ledgerId,
      statusKey,
      attempts,
    });
    await ledgerRef.set({
      id: ledgerId,
      eventName,
      eventId,
      leadId: lead.id,
      formId: options.formId || lead.formId || '',
      status: 'pending',
      statusKey,
      attempts,
      lastLogId: logId,
      updatedAt: new Date().toISOString(),
      createdAt: ledger.createdAt || new Date().toISOString(),
    }, { merge: true });
    return { skipped: false, sent: false, status: 'pending', eventId, ledgerId, logId, message };
  }

  const meta = await postMetaEvent(config, event);
  const status = meta.ok ? 'success' : 'failed';
  const logId = await writeCapiLog(db, {
    event,
    status,
    source: options.source || 'server',
    responseMessage: shortMessage(meta.result),
    leadId: lead.id,
    formId: options.formId || lead.formId,
    ledgerId,
    statusKey,
    attempts,
    httpStatus: meta.status,
  });
  await ledgerRef.set({
    id: ledgerId,
    eventName,
    eventId,
    leadId: lead.id,
    formId: options.formId || lead.formId || '',
    status,
    statusKey,
    attempts,
    lastLogId: logId,
    responseMessage: shortMessage(meta.result),
    httpStatus: meta.status,
    updatedAt: new Date().toISOString(),
    createdAt: ledger.createdAt || new Date().toISOString(),
  }, { merge: true });

  return { skipped: false, sent: meta.ok, status, eventId, ledgerId, logId, result: meta.result };
}

export function capiEventsForLeadStatus(status?: string) {
  const key = toStatusKey(status);
  if (key === 'mat-lead') return ['LeadFailed'];
  if (key === 'da-test-hoc-thu') return ['QualifiedLead'];
  if (key === 'da-bao-phi-cho-chot') return ['InitiateCheckout'];
  if (key === 'da-dang-ky-hoc') return ['Purchase'];
  return [];
}

export async function sendManualCapiEvent(db: Firestore, req: VercelRequestLike, body: ManualEventInput) {
  const eventId = body.event_id || `metta_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const eventName = body.event_name || 'Lead';
  const event = {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: eventId,
    action_source: 'website',
    event_source_url: body.event_source_url || DEFAULT_SOURCE_URL,
    user_data: removeUndefined({
      em: sha256(normalizeEmail(body.email)),
      ph: sha256(normalizeVietnamPhoneForHash(body.phone)),
      fbp: body.fbp,
      fbc: body.fbc || fbcFromTracking({ fbclid: body.fbclid }),
      client_ip_address: clientIp(req),
      client_user_agent: requestUserAgent(req),
    }),
    custom_data: body.custom_data || {},
  };
  const config = runtimeConfig();
  if (!config.enabled || !config.pixelId || !config.accessToken) {
    const logId = await writeCapiLog(db, {
      event,
      status: 'pending',
      source: 'test',
      responseMessage: 'Missing META_PIXEL_ID or META_ACCESS_TOKEN; test event queued.',
      leadId: body.leadId || body.lead_id,
      formId: body.formId || body.form_id,
    });
    return { ok: false, queued: true, eventId, logId };
  }

  const meta = await postMetaEvent(config, event);
  const logId = await writeCapiLog(db, {
    event,
    status: meta.ok ? 'success' : 'failed',
    source: 'test',
    responseMessage: shortMessage(meta.result),
    leadId: body.leadId || body.lead_id,
    formId: body.formId || body.form_id,
    httpStatus: meta.status,
  });
  return { ok: meta.ok, queued: false, eventId, logId, result: meta.result };
}

export async function retryCapiLog(db: Firestore, req: VercelRequestLike, logId: string) {
  const logSnap = await db.collection('capiEvents').doc(logId).get();
  if (!logSnap.exists) throw new Error('Event log not found.');
  const log = logSnap.data() || {};
  if (log.status === SUCCESS_STATUS) {
    return { skipped: true, status: SUCCESS_STATUS, eventId: log.eventId, logId };
  }

  const leadId = String(log.leadId || '');
  if (!leadId) {
    return sendManualCapiEvent(db, req, {
      event_name: String(log.eventName || 'Lead'),
      event_source_url: String(log.sourceUrl || DEFAULT_SOURCE_URL),
      formId: String(log.formId || ''),
      custom_data: log.payloadPreview?.custom_data || {},
    });
  }

  const leadSnap = await db.collection('leads').doc(leadId).get();
  if (!leadSnap.exists) throw new Error('Lead not found for retry.');
  const lead = { id: leadSnap.id, ...leadSnap.data() } as LeadForCapi;
  return sendLeadCapiSignal({
    db,
    lead,
    eventName: String(log.eventName || 'Lead'),
    statusKey: String(log.payloadPreview?.status_key || toStatusKey(lead.status || log.eventName)),
    source: 'retry',
    request: req,
    formId: String(log.formId || lead.formId || ''),
  });
}
