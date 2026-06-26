import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildLeadEventPayload,
  buildMetaRequestPayload,
  capiEventsForLeadStatus,
  ledgerIdentity,
  normalizeVietnamPhoneForHash,
  retryCapiLog,
  runtimeConfig,
  sendLeadCapiSignal,
  sha256,
} from '../api/_metaCapi.ts';
import { captureLeadTracking } from '../src/lib/capiTracking.ts';
import { isMetaTrackablePath, trackMetaEvent } from '../src/lib/metaPixel.ts';

function fakeFirestore() {
  const collections = new Map();
  let autoId = 0;
  const records = (name) => {
    if (!collections.has(name)) collections.set(name, new Map());
    return collections.get(name);
  };
  return {
    collection(name) {
      return {
        doc(id = `auto_${++autoId}`) {
          return {
            id,
            async get() {
              const value = records(name).get(id);
              return { exists: value !== undefined, id, data: () => value };
            },
            async set(value, options = {}) {
              const current = records(name).get(id) || {};
              records(name).set(id, options.merge ? { ...current, ...value } : value);
            },
          };
        },
      };
    },
    records,
  };
}

function withProductionCapiEnv() {
  const keys = ['VERCEL_ENV', 'META_CAPI_ENABLED', 'META_PIXEL_ID', 'META_ACCESS_TOKEN', 'META_TEST_EVENT_CODE', 'META_SEND_LEAD_FAILED'];
  const original = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  Object.assign(process.env, {
    VERCEL_ENV: 'production',
    META_CAPI_ENABLED: 'true',
    META_PIXEL_ID: 'pixel_123',
    META_ACCESS_TOKEN: 'token_123',
    META_TEST_EVENT_CODE: 'MUST_NOT_BE_SENT',
    META_SEND_LEAD_FAILED: 'false',
  });
  return () => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

test('production mode never includes test_event_code', () => {
  const config = runtimeConfig({
    VERCEL_ENV: 'production',
    META_TEST_EVENT_CODE: 'TEST123',
    META_PIXEL_ID: '123',
    META_ACCESS_TOKEN: 'secret',
  });
  assert.equal(config.mode, 'production');
  assert.equal(config.testEventCode, '');
  assert.equal('test_event_code' in buildMetaRequestPayload(config, { event_name: 'Lead' }), false);
});

test('non-production mode includes configured test_event_code', () => {
  const config = runtimeConfig({ META_TEST_EVENT_CODE: 'TEST123' });
  const payload = buildMetaRequestPayload(config, { event_name: 'Lead' });
  assert.equal(config.mode, 'test');
  assert.equal(payload.test_event_code, 'TEST123');
});

test('hash normalization matches Meta requirements', () => {
  assert.equal(normalizeVietnamPhoneForHash('090 123-4567'), '84901234567');
  assert.equal(sha256(' User@Example.COM '), sha256('user@example.com'));
  assert.equal(sha256(normalizeVietnamPhoneForHash('+84 901 234 567')), sha256('84901234567'));
});

test('lifecycle payload uses original customer metadata and purchase data', () => {
  const { event, usedCustomerMeta } = buildLeadEventPayload({
    lead: {
      id: 'lead_123',
      phone: '0901234567',
      email: 'parent@example.com',
      interestedCourse: 'METTA Summer 2026',
      courseId: 'summer-2026',
      dealCurrency: 'VND',
      revenue: 1999000,
      customerMeta: {
        client_ip_address: '203.0.113.10',
        client_user_agent: 'Customer Browser',
        fbp: 'fb.1.100.customer',
        fbc: 'fb.1.100.click',
        event_source_url: 'https://www.metta.edu.vn/p/metta-summer?utm_source=facebook',
        first_utm_source: 'facebook',
      },
    },
    eventName: 'Purchase',
    previousStatus: 'Đã báo phí/Chờ chốt',
    nextStatus: 'Đã đăng ký học',
  }, 'event_purchase_123');

  assert.equal(usedCustomerMeta, true);
  assert.equal(event.user_data.client_ip_address, '203.0.113.10');
  assert.equal(event.user_data.client_user_agent, 'Customer Browser');
  assert.equal(event.user_data.fbp, 'fb.1.100.customer');
  assert.equal(event.user_data.fbc, 'fb.1.100.click');
  assert.equal(event.custom_data.value, 1999000);
  assert.equal(event.custom_data.currency, 'VND');
  assert.deepEqual(event.custom_data.content_ids, ['summer-2026']);
  assert.equal(event.custom_data.order_id, 'lead_123');
});

test('production status mapping suppresses LeadFailed and sends conversion milestones', () => {
  const previous = process.env.META_SEND_LEAD_FAILED;
  process.env.META_SEND_LEAD_FAILED = 'false';
  try {
    assert.deepEqual(capiEventsForLeadStatus('Mất lead'), []);
    assert.deepEqual(capiEventsForLeadStatus('Đã liên hệ'), ['QualifiedLead']);
    assert.deepEqual(capiEventsForLeadStatus('Đã test/Học thử'), ['QualifiedLead']);
    assert.deepEqual(capiEventsForLeadStatus('Đã báo phí/Chờ chốt'), ['InitiateCheckout']);
    assert.deepEqual(capiEventsForLeadStatus('Đã đăng ký học'), ['Purchase']);
  } finally {
    if (previous === undefined) delete process.env.META_SEND_LEAD_FAILED;
    else process.env.META_SEND_LEAD_FAILED = previous;
  }
});

test('ledger identity is scoped to each event instance', () => {
  const first = ledgerIdentity('lead_123', 'Lead', 'event_a');
  const retry = ledgerIdentity('lead_123', 'Lead', 'event_a');
  const nextSubmission = ledgerIdentity('lead_123', 'Lead', 'event_b');
  assert.equal(first.ledgerId, retry.ledgerId);
  assert.notEqual(first.ledgerId, nextSubmission.ledgerId);
  assert.equal(first.ledgerKey, 'lead_123:Lead:event_a');
});

test('server send logs production mode and deduplicates the same event instance', async () => {
  const restoreEnv = withProductionCapiEnv();
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ events_received: 1, messages: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const db = fakeFirestore();
  const options = {
    db,
    lead: {
      id: 'lead_server_1',
      phone: '0901234567',
      customerMeta: { client_ip_address: '203.0.113.20', client_user_agent: 'Customer Browser' },
    },
    eventName: 'Lead',
    eventId: 'event_shared_server_1',
    source: 'server',
  };
  try {
    const first = await sendLeadCapiSignal(options);
    const duplicate = await sendLeadCapiSignal(options);
    assert.equal(first.status, 'success');
    assert.equal(duplicate.skipped, true);
    assert.equal(requests.length, 1);
    assert.equal(requests[0].test_event_code, undefined);
    assert.equal(requests[0].data[0].event_id, 'event_shared_server_1');
    const logs = [...db.records('capiEvents').values()];
    assert.equal(logs.length, 1);
    assert.equal(logs[0].mode, 'production');
    assert.equal(logs[0].event_id, 'event_shared_server_1');
    assert.equal(logs[0].used_customer_meta, true);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

test('retry reuses the original event_id', async () => {
  const restoreEnv = withProductionCapiEnv();
  const originalFetch = globalThis.fetch;
  const sentEventIds = [];
  let attempt = 0;
  globalThis.fetch = async (_url, init) => {
    const payload = JSON.parse(init.body);
    sentEventIds.push(payload.data[0].event_id);
    attempt += 1;
    return new Response(JSON.stringify(attempt === 1 ? { error: { message: 'temporary' } } : { events_received: 1 }), {
      status: attempt === 1 ? 500 : 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const db = fakeFirestore();
  const lead = {
    id: 'lead_retry_1',
    phone: '0901234567',
    formId: 'consultation-form',
    status: 'Lead mới',
    customerMeta: { client_ip_address: '203.0.113.30', client_user_agent: 'Customer Browser' },
  };
  await db.collection('leads').doc(lead.id).set(lead);
  try {
    const failed = await sendLeadCapiSignal({ db, lead, eventName: 'Lead', eventId: 'event_retry_same_1', source: 'server' });
    assert.equal(failed.status, 'failed');
    const retried = await retryCapiLog(db, failed.logId);
    assert.equal(retried.status, 'success');
    assert.deepEqual(sentEventIds, ['event_retry_same_1', 'event_retry_same_1']);
    const retryLog = db.records('capiEvents').get(retried.logId);
    assert.equal(retryLog.retry_count, 1);
    assert.equal(retryLog.source, 'retry');
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

test('browser Pixel receives the same eventID as CAPI', () => {
  const calls = [];
  globalThis.window = { fbq: (...args) => calls.push(args) };
  try {
    assert.equal(trackMetaEvent('Lead', { content_name: 'Course' }, 'event_shared_123'), true);
    assert.deepEqual(calls[0], ['track', 'Lead', { content_name: 'Course' }, { eventID: 'event_shared_123' }]);
  } finally {
    delete globalThis.window;
  }
});

test('browser Pixel is not initialized on admin routes', () => {
  assert.equal(isMetaTrackablePath('/'), true);
  assert.equal(isMetaTrackablePath('/p/metta-summer'), true);
  assert.equal(isMetaTrackablePath('/dashboard'), false);
  assert.equal(isMetaTrackablePath('/crm/leads'), false);
  assert.equal(isMetaTrackablePath('/capi'), false);
});

test('lead tracking creates fbc from fbclid and captures utm_medium', () => {
  globalThis.document = { cookie: '_fbp=fb.1.100.browser' };
  globalThis.window = {
    location: {
      href: 'https://www.metta.edu.vn/?fbclid=CLICK123&utm_source=facebook&utm_medium=paid_social',
      search: '?fbclid=CLICK123&utm_source=facebook&utm_medium=paid_social',
    },
  };
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: { userAgent: 'Customer Browser' }, configurable: true });
  try {
    const tracking = captureLeadTracking();
    assert.equal(tracking.fbp, 'fb.1.100.browser');
    assert.match(tracking.fbc || '', /^fb\.1\.\d+\.CLICK123$/);
    assert.equal(tracking.utmMedium, 'paid_social');
  } finally {
    delete globalThis.document;
    delete globalThis.window;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
  }
});
