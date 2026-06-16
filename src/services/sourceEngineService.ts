import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { delay } from '@/services/store';
import type {
  AttributionLog,
  AttributionPayload,
  AttributionResult,
  AttributionRule,
  SourceChannel,
  SourceConnector,
  SourceEngineState,
} from '@/types/sourceEngine';

const now = () => new Date().toISOString();
const USE_FIREBASE = isFirebaseConfigured && !!db;
const CONFIG_DOC = 'appConfig/sourceEngineState';

const sampleSources: SourceChannel[] = [
  {
    id: 'src-meta-lead-form',
    name: 'Meta Lead Form',
    platform: 'Meta',
    priorityLevel: 5,
    defaultCenter: 'METTA',
    defaultCourse: 'METTA Kiddies',
    routingHint: 'Auto assign theo rule Phân lead',
    description: 'Lead đẩy từ Facebook/Instagram Instant Form qua webhook hoặc API.',
    active: true,
    updatedAt: now(),
  },
  {
    id: 'src-website-form',
    name: 'Website Form',
    platform: 'Website',
    priorityLevel: 4,
    defaultCenter: 'METTA',
    defaultCourse: 'METTA on Phonics',
    routingHint: 'Theo center trong form',
    description: 'Form tư vấn trên website, landing page hoặc form nhúng.',
    active: true,
    updatedAt: now(),
  },
  {
    id: 'src-zalo-oa',
    name: 'Zalo OA',
    platform: 'Zalo OA',
    priorityLevel: 4,
    defaultCenter: 'METTA',
    defaultCourse: 'METTA Young Learner',
    routingHint: 'Theo tag OA',
    description: 'Lead từ Zalo OA, chat event hoặc form Zalo.',
    active: true,
    updatedAt: now(),
  },
];

const sampleConnectors: SourceConnector[] = [
  {
    id: 'con-meta',
    name: 'Meta Ads / Lead Forms',
    platform: 'Meta',
    captureMethod: 'Webhook',
    status: 'needs_setup',
    credentialStatus: 'missing',
    identifiers: 'ad_account_id, page_id, form_id, pixel_id',
    lastSyncAt: '',
    testStatus: 'Chưa test',
    updatedAt: now(),
  },
  {
    id: 'con-website',
    name: 'Website Tracking',
    platform: 'Website',
    captureMethod: 'Website Form',
    status: 'connected',
    credentialStatus: 'not_required',
    identifiers: 'utm_source, utm_campaign, page_slug, referrer',
    lastSyncAt: now(),
    testStatus: 'Form listener sẵn sàng',
    updatedAt: now(),
  },
  {
    id: 'con-zalo',
    name: 'Zalo OA Webhook',
    platform: 'Zalo OA',
    captureMethod: 'Webhook',
    status: 'needs_setup',
    credentialStatus: 'missing',
    identifiers: 'oa_id, app_id, webhook_secret',
    lastSyncAt: '',
    testStatus: 'Chưa kết nối',
    updatedAt: now(),
  },
];

const sampleRules: AttributionRule[] = [
  {
    id: 'rule-meta-form',
    name: 'Meta Lead Form ID',
    order: 10,
    active: true,
    matchField: 'form_id',
    operator: 'contains',
    matchValue: 'meta',
    sourceId: 'src-meta-lead-form',
    confidence: 95,
    notes: 'Ưu tiên form_id explicit từ Meta webhook/API.',
    updatedAt: now(),
  },
  {
    id: 'rule-website-utm',
    name: 'Website UTM',
    order: 20,
    active: true,
    matchField: 'utm_source',
    operator: 'equals',
    matchValue: 'website',
    sourceId: 'src-website-form',
    confidence: 85,
    notes: 'Map UTM website hoặc landing page nội bộ.',
    updatedAt: now(),
  },
  {
    id: 'rule-zalo-referrer',
    name: 'Zalo Referrer',
    order: 30,
    active: true,
    matchField: 'referrer',
    operator: 'contains',
    matchValue: 'zalo',
    sourceId: 'src-zalo-oa',
    confidence: 80,
    notes: 'Fallback khi lead có referrer/tag đến từ Zalo.',
    updatedAt: now(),
  },
];

const sampleLogs: AttributionLog[] = [
  {
    id: 'log-1',
    leadName: 'Bảo An demo',
    rawChannel: 'Meta webhook',
    campaign: 'Kiddies June Intake',
    sourceName: 'Meta Lead Form',
    matchedRuleName: 'Meta Lead Form ID',
    confidence: 95,
    status: 'matched',
    receivedAt: now(),
  },
  {
    id: 'log-2',
    leadName: 'Minh Khang demo',
    rawChannel: 'Website form',
    campaign: 'phonics_landing',
    sourceName: 'Website Form',
    matchedRuleName: 'Website UTM',
    confidence: 85,
    status: 'matched',
    receivedAt: now(),
  },
  {
    id: 'log-3',
    leadName: 'Lead chưa rõ nguồn',
    rawChannel: 'Manual import',
    campaign: '',
    sourceName: 'Needs review',
    matchedRuleName: 'No rule matched',
    confidence: 20,
    status: 'review',
    receivedAt: now(),
  },
];

const defaultState: SourceEngineState = {
  sources: sampleSources,
  connectors: sampleConnectors,
  rules: sampleRules,
  logs: sampleLogs,
};

function cloneState(value: SourceEngineState): SourceEngineState {
  return JSON.parse(JSON.stringify(value)) as SourceEngineState;
}

function normalizeState(value: Partial<SourceEngineState> | undefined): SourceEngineState {
  const fallback = cloneState(defaultState);
  return {
    sources: Array.isArray(value?.sources) ? value.sources : fallback.sources,
    connectors: Array.isArray(value?.connectors) ? value.connectors : fallback.connectors,
    rules: Array.isArray(value?.rules) ? value.rules : fallback.rules,
    logs: Array.isArray(value?.logs) ? value.logs : fallback.logs,
  };
}

async function readState(): Promise<SourceEngineState> {
  if (!USE_FIREBASE) return cloneState(defaultState);
  const snap = await getDoc(doc(db!, CONFIG_DOC));
  if (!snap.exists()) return cloneState(defaultState);
  return normalizeState(snap.data() as Partial<SourceEngineState>);
}

async function writeState(state: SourceEngineState) {
  if (!USE_FIREBASE) return;
  await setDoc(doc(db!, CONFIG_DOC), { ...state, updatedAt: now() }, { merge: true });
}

function fieldValue(payload: AttributionPayload, field: AttributionRule['matchField']) {
  return String(payload[field] || '').trim();
}

function matchRule(rule: AttributionRule, payload: AttributionPayload) {
  const value = fieldValue(payload, rule.matchField).toLowerCase();
  const expected = rule.matchValue.trim().toLowerCase();
  if (rule.operator === 'exists') return Boolean(value);
  if (!value || !expected) return false;
  if (rule.operator === 'equals') return value === expected;
  if (rule.operator === 'contains') return value.includes(expected);
  if (rule.operator === 'starts_with') return value.startsWith(expected);
  return false;
}

function evaluate(state: SourceEngineState, payload: AttributionPayload): AttributionResult {
  const rule = [...state.rules]
    .filter((item) => item.active)
    .sort((a, b) => a.order - b.order)
    .find((item) => matchRule(item, payload));
  const source = rule ? state.sources.find((item) => item.id === rule.sourceId && item.active) : undefined;
  if (!rule || !source) return { confidence: 20, status: 'review' };
  return {
    rule,
    source,
    confidence: rule.confidence,
    status: rule.confidence >= 70 ? 'matched' : 'warning',
  };
}

export const sourceEngineService = {
  getState: async () => delay(await readState()),

  resetSamples: async () => {
    const next = cloneState(defaultState);
    await writeState(next);
    return delay(next);
  },

  saveSource: async (source: Partial<SourceChannel>) => {
    const state = await readState();
    const id = source.id || `src-${Date.now()}`;
    const next: SourceChannel = {
      id,
      name: source.name || 'Nguồn mới',
      platform: source.platform || 'Other',
      priorityLevel: source.priorityLevel || 3,
      defaultCenter: source.defaultCenter || '',
      defaultCourse: source.defaultCourse || '',
      routingHint: source.routingHint || 'Auto assign theo rule Phân lead',
      description: source.description || '',
      active: source.active !== false,
      updatedAt: now(),
    };
    state.sources = state.sources.some((item) => item.id === id)
      ? state.sources.map((item) => (item.id === id ? next : item))
      : [next, ...state.sources];
    await writeState(state);
    return delay(state);
  },

  saveConnector: async (connector: Partial<SourceConnector>) => {
    const state = await readState();
    const id = connector.id || `con-${Date.now()}`;
    const next: SourceConnector = {
      id,
      name: connector.name || 'Connector mới',
      platform: connector.platform || 'Other',
      captureMethod: connector.captureMethod || 'Webhook',
      status: connector.status || 'needs_setup',
      credentialStatus: connector.credentialStatus || 'missing',
      identifiers: connector.identifiers || '',
      lastSyncAt: connector.status === 'connected' ? now() : connector.lastSyncAt || '',
      testStatus: connector.testStatus || 'Chưa test',
      updatedAt: now(),
    };
    state.connectors = state.connectors.some((item) => item.id === id)
      ? state.connectors.map((item) => (item.id === id ? next : item))
      : [next, ...state.connectors];
    await writeState(state);
    return delay(state);
  },

  saveRule: async (rule: Partial<AttributionRule>) => {
    const state = await readState();
    const id = rule.id || `rule-${Date.now()}`;
    const next: AttributionRule = {
      id,
      name: rule.name || 'Rule mới',
      order: Number(rule.order || state.rules.length * 10 + 10),
      active: rule.active !== false,
      matchField: rule.matchField || 'utm_source',
      operator: rule.operator || 'contains',
      matchValue: rule.matchValue || '',
      sourceId: rule.sourceId || state.sources[0]?.id || '',
      confidence: Math.min(Math.max(Number(rule.confidence || 70), 0), 100),
      notes: rule.notes || '',
      updatedAt: now(),
    };
    state.rules = state.rules.some((item) => item.id === id)
      ? state.rules.map((item) => (item.id === id ? next : item))
      : [...state.rules, next];
    state.rules.sort((a, b) => a.order - b.order);
    await writeState(state);
    return delay(state);
  },

  testAttribution: async (payload: AttributionPayload) => {
    const state = await readState();
    const result = evaluate(state, payload);
    const log: AttributionLog = {
      id: `log-${Date.now()}`,
      leadName: payload.leadName || 'Lead test',
      rawChannel: payload.rawChannel || payload.utm_source || payload.form_id || 'Manual test',
      campaign: payload.utm_campaign || '',
      sourceName: result.source?.name || 'Needs review',
      matchedRuleName: result.rule?.name || 'No rule matched',
      confidence: result.confidence,
      status: result.status,
      receivedAt: now(),
    };
    state.logs = [log, ...state.logs].slice(0, 80);
    await writeState(state);
    return delay({ state, result, log });
  },
};
