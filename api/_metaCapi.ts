import crypto from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';

export type VercelRequestLike = {
  headers: Record<string, string | string[] | undefined>;
};

export type CapiMode = 'production' | 'test';

export type CapiTracking = {
  sourceUrl?: string;
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  userAgent?: string;
  capturedAt?: string;
};

export type CustomerMeta = {
  client_ip_address?: string;
  client_user_agent?: string;
  fbp?: string;
  fbc?: string;
  event_source_url?: string;
  first_utm_source?: string;
  first_utm_medium?: string;
  first_utm_campaign?: string;
  first_utm_content?: string;
  first_utm_term?: string;
};

export type LeadForCapi = {
  id: string;
  phone?: string;
  email?: string;
  interestedCourse?: string;
  courseId?: string;
  paymentId?: string;
  source?: string;
  status?: string;
  dealCurrency?: string;
  dealSize?: number;
  expectedRevenue?: number;
  revenue?: number;
  formId?: string;
  pageSlug?: string;
  sourceUrl?: string;
  metaEventId?: string;
  tracking?: CapiTracking;
  customerMeta?: CustomerMeta & Record<string, unknown>;
};

type SendLeadCapiOptions = {
  db: Firestore;
  lead: LeadForCapi;
  eventName: string;
  eventId?: string;
  statusKey?: string;
  source?: 'server' | 'test' | 'retry';
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

type RuntimeConfig = ReturnType<typeof runtimeConfig>;

const GRAPH_API_BASE = 'https://graph.facebook.com';
const DEFAULT_GRAPH_VERSION = 'v25.0';
const DEFAULT_SOURCE_URL = 'https://www.metta.edu.vn/';
const DEFAULT_CAPI_TIMEOUT_MS = 8000;
const SUCCESS_STATUS = 'success';

function shortMessage(value: unknown) {
  if (typeof value === 'string') return value.slice(0, 800);
  return JSON.stringify(value || {}).slice(0, 800);
}

function envFlag(env: NodeJS.ProcessEnv, name: string, defaultValue: boolean) {
  const value = String(env[name] || '').trim().toLowerCase();
  if (!value) return defaultValue;
  return value === 'true' || value === '1' || value === 'yes' || value === 'on';
}

export function resolveCapiMode(env: NodeJS.ProcessEnv = process.env): CapiMode {
  if (env.VERCEL_ENV === 'production') return 'production';
  return String(env.META_CAPI_MODE || '').trim().toLowerCase() === 'production' ? 'production' : 'test';
}

function graphVersion(env: NodeJS.ProcessEnv) {
  const version = String(env.META_GRAPH_VERSION || DEFAULT_GRAPH_VERSION).trim();
  return version.startsWith('v') ? version : `v${version}`;
}

export function runtimeConfig(env: NodeJS.ProcessEnv = process.env) {
  const mode = resolveCapiMode(env);
  const pixelId = String(env.META_PIXEL_ID || '').trim();
  const browserPixelId = String(env.VITE_META_PIXEL_ID || '').trim();
  const configuredTestEventCode = String(env.META_TEST_EVENT_CODE || '').trim();
  return {
    mode,
    vercelEnv: String(env.VERCEL_ENV || 'local'),
    enabled: envFlag(env, 'META_CAPI_ENABLED', true),
    browserPixelEnabled: envFlag(env, 'META_BROWSER_PIXEL_ENABLED', true)
      && envFlag(env, 'VITE_META_BROWSER_PIXEL_ENABLED', true)
      && Boolean(browserPixelId),
    pixelId,
    browserPixelId,
    accessToken: String(env.META_ACCESS_TOKEN || '').trim(),
    graphVersion: graphVersion(env),
    configuredTestEventCode,
    // Production is authoritative: a configured test code is never attached there.
    testEventCode: mode === 'test' ? configuredTestEventCode : '',
    timeoutMs: capiTimeoutMs(env),
    manualEventsEnabled: envFlag(env, 'META_ALLOW_MANUAL_EVENTS', mode === 'test'),
    eventToggles: {
      Lead: envFlag(env, 'META_SEND_LEAD', true),
      QualifiedLead: envFlag(env, 'META_SEND_QUALIFIED_LEAD', true),
      InitiateCheckout: envFlag(env, 'META_SEND_INITIATE_CHECKOUT', true),
      Purchase: envFlag(env, 'META_SEND_PURCHASE', true),
      LeadFailed: envFlag(env, 'META_SEND_LEAD_FAILED', false),
    },
  };
}

function maskSecret(value: string) {
  if (!value) return '';
  if (value.length <= 6) return '*'.repeat(value.length);
  return `${value.slice(0, 3)}${'*'.repeat(Math.min(8, value.length - 6))}${value.slice(-3)}`;
}

export function capiRuntimeSummary(env: NodeJS.ProcessEnv = process.env) {
  const config = runtimeConfig(env);
  return {
    mode: config.mode,
    vercelEnv: config.vercelEnv,
    capiEnabled: config.enabled,
    browserPixelEnabled: config.browserPixelEnabled,
    pixelId: config.pixelId,
    browserPixelId: config.browserPixelId,
    pixelIdsMatch: Boolean(config.pixelId && config.browserPixelId && config.pixelId === config.browserPixelId),
    accessTokenConfigured: Boolean(config.accessToken),
    testEventCodeConfigured: Boolean(config.configuredTestEventCode),
    testEventCodeActive: Boolean(config.testEventCode),
    testEventCodeMasked: config.testEventCode ? maskSecret(config.testEventCode) : '',
    graphVersion: config.graphVersion,
    timeoutMs: config.timeoutMs,
    manualEventsEnabled: config.manualEventsEnabled,
    eventToggles: config.eventToggles,
    statusMappings: [
      { status: 'Public form submit', eventName: 'Lead', destination: 'Meta' },
      { status: 'Đã liên hệ / Đã hẹn tư vấn / Đã tư vấn / Đã test', eventName: 'QualifiedLead', destination: 'Meta (first milestone only)' },
      { status: 'Đã báo phí/Chờ chốt', eventName: 'InitiateCheckout', destination: 'Meta (first milestone only)' },
      { status: 'Đã đăng ký học', eventName: 'Purchase', destination: 'Meta (first milestone only)' },
      { status: 'Mất lead', eventName: 'LeadFailed', destination: config.eventToggles.LeadFailed ? 'Meta' : 'CRM internal only' },
    ],
  };
}

function capiTimeoutMs(env: NodeJS.ProcessEnv = process.env) {
  const parsed = Number(env.META_CAPI_TIMEOUT_MS || DEFAULT_CAPI_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_CAPI_TIMEOUT_MS;
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
  return toStatusKey(value).replace(/[^a-z0-9-]/g, '-').slice(0, 100) || 'event';
}

export function normalizeMetaEventId(value?: string) {
  const eventId = String(value || '').trim();
  return /^[A-Za-z0-9._:-]{8,128}$/.test(eventId) ? eventId : '';
}

function fbcFromTracking(tracking?: CapiTracking) {
  if (tracking?.fbc) return tracking.fbc;
  if (!tracking?.fbclid) return undefined;
  const capturedMs = tracking.capturedAt ? Date.parse(tracking.capturedAt) : Date.now();
  return `fb.1.${Number.isFinite(capturedMs) ? capturedMs : Date.now()}.${tracking.fbclid}`;
}

function customerMetaValue(meta: Record<string, unknown>, snakeKey: string, camelKey: string) {
  return String(meta[snakeKey] || meta[camelKey] || '').trim() || undefined;
}

function customerMetaForLead(lead: LeadForCapi) {
  const meta = (lead.customerMeta || {}) as Record<string, unknown>;
  const tracking = lead.tracking || {};
  const values = {
    clientIpAddress: customerMetaValue(meta, 'client_ip_address', 'clientIpAddress'),
    clientUserAgent: customerMetaValue(meta, 'client_user_agent', 'clientUserAgent') || tracking.userAgent,
    fbp: customerMetaValue(meta, 'fbp', 'fbp') || tracking.fbp,
    fbc: customerMetaValue(meta, 'fbc', 'fbc') || fbcFromTracking(tracking),
    eventSourceUrl: customerMetaValue(meta, 'event_source_url', 'eventSourceUrl') || tracking.sourceUrl || lead.sourceUrl,
    utmSource: customerMetaValue(meta, 'first_utm_source', 'firstUtmSource') || tracking.utmSource,
    utmMedium: customerMetaValue(meta, 'first_utm_medium', 'firstUtmMedium') || tracking.utmMedium,
    utmCampaign: customerMetaValue(meta, 'first_utm_campaign', 'firstUtmCampaign') || tracking.utmCampaign,
    utmContent: customerMetaValue(meta, 'first_utm_content', 'firstUtmContent') || tracking.utmContent,
    utmTerm: customerMetaValue(meta, 'first_utm_term', 'firstUtmTerm') || tracking.utmTerm,
  };
  return {
    ...values,
    usedCustomerMeta: Object.keys(meta).length > 0 && Object.values(values).some(Boolean),
  };
}

function sourceUrlForLead(lead: LeadForCapi) {
  const meta = customerMetaForLead(lead);
  return meta.eventSourceUrl
    || (lead.pageSlug ? `https://www.metta.edu.vn/${lead.pageSlug}` : DEFAULT_SOURCE_URL);
}

function eventValue(lead: LeadForCapi, eventName: string) {
  const revenue = Number(lead.revenue || 0);
  const expectedRevenue = Number(lead.expectedRevenue || 0);
  const dealSize = Number(lead.dealSize || 0);
  if (eventName === 'Purchase') return revenue || expectedRevenue || dealSize || 0;
  if (eventName === 'InitiateCheckout' || eventName === 'QualifiedLead') return expectedRevenue || dealSize || revenue || 0;
  return 0;
}

function defaultLifecycleEventId(leadId: string, eventName: string) {
  return `${cleanDocPart(leadId)}_${cleanDocPart(eventName)}_milestone`;
}

export function ledgerIdentity(leadId: string, eventName: string, eventId: string) {
  const ledgerKey = `${leadId}:${eventName}:${eventId}`;
  return {
    ledgerKey,
    ledgerId: crypto.createHash('sha256').update(ledgerKey).digest('hex'),
  };
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

export function buildLeadEventPayload(options: Omit<SendLeadCapiOptions, 'db'>, eventId: string) {
  const { lead, eventName } = options;
  const customerMeta = customerMetaForLead(lead);
  const value = eventValue(lead, eventName);
  const userData = removeUndefined({
    em: sha256(normalizeEmail(lead.email)),
    ph: sha256(normalizeVietnamPhoneForHash(lead.phone)),
    fbp: customerMeta.fbp,
    fbc: customerMeta.fbc,
    external_id: sha256(lead.id),
    client_ip_address: customerMeta.clientIpAddress,
    client_user_agent: customerMeta.clientUserAgent,
  });
  const isPurchase = eventName === 'Purchase';
  const customData = removeUndefined({
    currency: value ? (lead.dealCurrency || 'VND') : undefined,
    value: value || undefined,
    content_name: lead.interestedCourse || undefined,
    content_category: isPurchase ? 'english_course' : 'education',
    content_ids: lead.courseId ? [lead.courseId] : undefined,
    order_id: isPurchase ? (lead.paymentId || lead.id) : undefined,
    lead_status: options.nextStatus || lead.status || undefined,
    previous_status: options.previousStatus || undefined,
    lead_source: lead.source || undefined,
    utm_source: customerMeta.utmSource,
    utm_medium: customerMeta.utmMedium,
    utm_campaign: customerMeta.utmCampaign,
    utm_content: customerMeta.utmContent,
    utm_term: customerMeta.utmTerm,
  });

  return {
    event: {
      event_name: eventName,
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId,
      action_source: 'website',
      event_source_url: sourceUrlForLead(lead),
      user_data: userData,
      custom_data: customData,
    },
    usedCustomerMeta: customerMeta.usedCustomerMeta,
  };
}

export function buildMetaRequestPayload(config: Pick<RuntimeConfig, 'testEventCode'>, event: Record<string, any>) {
  return {
    data: [event],
    ...(config.testEventCode ? { test_event_code: config.testEventCode } : {}),
  };
}

async function postMetaEvent(config: RuntimeConfig, event: Record<string, any>) {
  const payload = buildMetaRequestPayload(config, event);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
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

function eventToggleEnabled(config: RuntimeConfig, eventName: string) {
  const toggles = config.eventToggles as Record<string, boolean>;
  return toggles[eventName] ?? true;
}

async function writeCapiLog(db: Firestore, input: {
  config: RuntimeConfig;
  event: Record<string, any>;
  status: 'success' | 'failed' | 'pending';
  source: 'server' | 'test' | 'retry';
  responseMessage: string;
  metaResponse?: unknown;
  usedCustomerMeta: boolean;
  leadId?: string;
  formId?: string;
  ledgerId?: string;
  ledgerKey?: string;
  statusKey?: string;
  attempts?: number;
  httpStatus?: number;
}) {
  const now = new Date().toISOString();
  const logRef = db.collection('capiEvents').doc();
  const userData = input.event.user_data || {};
  const attempts = input.attempts || 1;
  await logRef.set({
    id: logRef.id,
    eventName: input.event.event_name,
    eventId: input.event.event_id,
    event_name: input.event.event_name,
    event_id: input.event.event_id,
    formId: input.formId || '',
    leadId: input.leadId || '',
    lead_id: input.leadId || '',
    sourceUrl: input.event.event_source_url || '',
    event_source_url: input.event.event_source_url || '',
    actionSource: input.event.action_source || 'website',
    action_source: input.event.action_source || 'website',
    source: input.source,
    mode: input.config.mode,
    status: input.status,
    responseMessage: input.responseMessage,
    metaResponse: input.metaResponse || null,
    meta_response: input.metaResponse || null,
    payloadPreview: payloadPreviewFor(input.event, input.ledgerId, input.statusKey),
    ledgerId: input.ledgerId || '',
    ledgerKey: input.ledgerKey || '',
    attempts,
    retryCount: Math.max(0, attempts - 1),
    retry_count: Math.max(0, attempts - 1),
    lastRetryAt: input.source === 'retry' ? now : '',
    last_retry_at: input.source === 'retry' ? now : '',
    httpStatus: input.httpStatus || 0,
    http_status: input.httpStatus || 0,
    hasEm: Boolean(userData.em),
    hasPh: Boolean(userData.ph),
    hasFbp: Boolean(userData.fbp),
    hasFbc: Boolean(userData.fbc),
    hasExternalId: Boolean(userData.external_id),
    has_em: Boolean(userData.em),
    has_ph: Boolean(userData.ph),
    has_fbp: Boolean(userData.fbp),
    has_fbc: Boolean(userData.fbc),
    has_external_id: Boolean(userData.external_id),
    usedCustomerMeta: input.usedCustomerMeta,
    used_customer_meta: input.usedCustomerMeta,
    createdAt: now,
    created_at: now,
    updatedAt: now,
  });
  return logRef.id;
}

export async function sendLeadCapiSignal(options: SendLeadCapiOptions) {
  const { db, lead, eventName } = options;
  const config = runtimeConfig();
  const suppliedEventId = normalizeMetaEventId(options.eventId);
  const eventId = suppliedEventId || defaultLifecycleEventId(lead.id, eventName);
  const statusKey = options.statusKey || toStatusKey(options.nextStatus || lead.status || eventName);

  if (!config.enabled) {
    return { skipped: true, sent: false, status: 'skipped', eventId, message: 'Meta CAPI is disabled.' };
  }
  if (!eventToggleEnabled(config, eventName)) {
    return { skipped: true, sent: false, status: 'skipped', eventId, message: `${eventName} is disabled for Meta.` };
  }

  const { ledgerId, ledgerKey } = ledgerIdentity(lead.id, eventName, eventId);
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
      logId: ledger.lastLogId || '',
      message: 'Duplicate successful event instance skipped.',
    };
  }

  const { event, usedCustomerMeta } = buildLeadEventPayload(options, eventId);

  if (!config.pixelId || !config.accessToken) {
    const message = 'Missing META_PIXEL_ID or META_ACCESS_TOKEN; event queued for retry.';
    const metaResponse = { error: message };
    const logId = await writeCapiLog(db, {
      config,
      event,
      status: 'pending',
      source: options.source || 'server',
      responseMessage: message,
      metaResponse,
      usedCustomerMeta,
      leadId: lead.id,
      formId: options.formId || lead.formId,
      ledgerId,
      ledgerKey,
      statusKey,
      attempts,
    });
    await ledgerRef.set({
      id: ledgerId,
      ledgerKey,
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
    config,
    event,
    status,
    source: options.source || 'server',
    responseMessage: shortMessage(meta.result),
    metaResponse: meta.result,
    usedCustomerMeta,
    leadId: lead.id,
    formId: options.formId || lead.formId,
    ledgerId,
    ledgerKey,
    statusKey,
    attempts,
    httpStatus: meta.status,
  });
  await ledgerRef.set({
    id: ledgerId,
    ledgerKey,
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
  if (['da-lien-he', 'da-hen-tu-van', 'da-tu-van-dat-lich-test', 'da-test-hoc-thu'].includes(key)) return ['QualifiedLead'];
  if (key === 'da-bao-phi-cho-chot') return ['InitiateCheckout'];
  if (key === 'da-dang-ky-hoc') return ['Purchase'];
  // Lost leads remain in CRM activity/history and are not sent to Meta by default.
  if (key === 'mat-lead' && runtimeConfig().eventToggles.LeadFailed) return ['LeadFailed'];
  return [];
}

export async function sendManualCapiEvent(db: Firestore, req: VercelRequestLike, body: ManualEventInput) {
  const config = runtimeConfig();
  if (!config.manualEventsEnabled) {
    return { ok: true, skipped: true, queued: false, reason: 'Manual CAPI events are disabled in this environment.' };
  }
  const eventId = normalizeMetaEventId(body.event_id) || `metta_${crypto.randomUUID()}`;
  const eventName = body.event_name || 'Lead';
  const tracking: CapiTracking = { fbc: body.fbc, fbclid: body.fbclid };
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
      fbc: fbcFromTracking(tracking),
    }),
    custom_data: body.custom_data || {},
  };
  if (!config.pixelId || !config.accessToken) {
    const message = 'Missing META_PIXEL_ID or META_ACCESS_TOKEN; test event queued.';
    const logId = await writeCapiLog(db, {
      config,
      event,
      status: 'pending',
      source: 'test',
      responseMessage: message,
      metaResponse: { error: message },
      usedCustomerMeta: false,
      leadId: body.leadId || body.lead_id,
      formId: body.formId || body.form_id,
    });
    return { ok: false, queued: true, eventId, logId };
  }

  const meta = await postMetaEvent(config, event);
  const logId = await writeCapiLog(db, {
    config,
    event,
    status: meta.ok ? 'success' : 'failed',
    source: 'test',
    responseMessage: shortMessage(meta.result),
    metaResponse: meta.result,
    usedCustomerMeta: false,
    leadId: body.leadId || body.lead_id,
    formId: body.formId || body.form_id,
    httpStatus: meta.status,
  });
  return { ok: meta.ok, queued: false, eventId, logId, result: meta.result };
}

export async function retryCapiLog(db: Firestore, logId: string) {
  const logSnap = await db.collection('capiEvents').doc(logId).get();
  if (!logSnap.exists) throw new Error('Event log not found.');
  const log = logSnap.data() || {};
  if (log.status === SUCCESS_STATUS) {
    return { skipped: true, status: SUCCESS_STATUS, eventId: log.eventId || log.event_id, logId };
  }

  const leadId = String(log.leadId || log.lead_id || '');
  if (!leadId) throw new Error('Legacy event has no lead metadata and cannot be retried safely.');

  const leadSnap = await db.collection('leads').doc(leadId).get();
  if (!leadSnap.exists) throw new Error('Lead not found for retry.');
  const lead = { id: leadSnap.id, ...leadSnap.data() } as LeadForCapi;
  const eventName = String(log.eventName || log.event_name || 'Lead');
  const eventId = normalizeMetaEventId(log.eventId || log.event_id);
  if (!eventId) throw new Error('Event has no reusable event_id and cannot be retried safely.');
  return sendLeadCapiSignal({
    db,
    lead,
    eventName,
    eventId,
    statusKey: String(log.payloadPreview?.status_key || toStatusKey(lead.status || eventName)),
    source: 'retry',
    formId: String(log.formId || lead.formId || ''),
  });
}
