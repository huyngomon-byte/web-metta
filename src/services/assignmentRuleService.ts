import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { readAppConfig, writeAppConfig } from '@/services/appConfigApi';
import type { Lead } from '@/types/crm';
import type { SalesAssignmentPick, SalesAssignmentRule } from '@/types/assignment';
import type { AdminUser } from '@/types/user';

const USE_FIREBASE = isFirebaseConfigured && !!db;
const CONFIG_COLLECTION = 'appConfig';
const CONFIG_DOC_ID = 'salesAssignmentRules';

let cachedRules: SalesAssignmentRule[] | null = null;

export type BulkAutoAssignNewLeadsResult = {
  ok: boolean;
  status: string;
  totalNewLeadCount: number;
  baselineAssignedCount: number;
  candidateCount: number;
  assignedCount: number;
  distribution: Array<{
    salesId: string;
    salesName: string;
    percent: number;
    before: number;
    assigned: number;
    after: number;
    shareAfter: number;
    targetAfter: number;
  }>;
};

async function authHeaders() {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Missing auth token');
  return { Authorization: `Bearer ${token}` };
}

function activeSales(users: AdminUser[]) {
  return users.filter((user) => user.role === 'sales' && user.active);
}

function cleanPercent(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(100, Math.round(parsed));
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

function readStored(): SalesAssignmentRule[] {
  if (cachedRules) return cachedRules;
  return [];
}

function writeStored(rules: SalesAssignmentRule[]) {
  cachedRules = rules;
}

async function readRemoteRules() {
  if (!USE_FIREBASE) return null;
  try {
    const apiRules = await readAppConfig<SalesAssignmentRule>(CONFIG_DOC_ID, 'rules');
    if (apiRules) {
      writeStored(apiRules);
      return apiRules;
    }
  } catch (error) {
    console.warn('[AssignmentRules] API read failed, trying Firestore client:', error);
  }
  try {
    const snap = await getDoc(doc(db!, CONFIG_COLLECTION, CONFIG_DOC_ID));
    if (!snap.exists()) return null;
    const data = snap.data() as { rules?: SalesAssignmentRule[] };
    if (!Array.isArray(data.rules)) return null;
    writeStored(data.rules);
    return data.rules;
  } catch (error) {
    console.warn('[AssignmentRules] Firestore read failed:', error);
    throw error;
  }
}

async function writeRemoteRules(rules: SalesAssignmentRule[]) {
  try {
    await writeAppConfig<SalesAssignmentRule>(CONFIG_DOC_ID, 'rules', rules);
    return;
  } catch (error) {
    console.warn('[AssignmentRules] API save failed, trying Firestore client:', error);
  }
  await setDoc(doc(db!, CONFIG_COLLECTION, CONFIG_DOC_ID), {
    rules,
    updatedAt: new Date().toISOString(),
  });
}

async function getStoredRules() {
  const remote = await readRemoteRules();
  if (remote) return remote;
  if (USE_FIREBASE) return [];
  const local = readStored();
  if (USE_FIREBASE && local.length) {
    void writeRemoteRules(local).catch((error) => {
      console.warn('[AssignmentRules] Local-to-Firestore migration failed:', error);
    });
  }
  return local;
}

export function assignmentRulesTotal(rules: SalesAssignmentRule[]) {
  return rules.filter((rule) => rule.active).reduce((sum, rule) => sum + cleanPercent(rule.percent), 0);
}

export function normalizeAssignmentRules(users: AdminUser[], saved = readStored()) {
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

  const total = assignmentRulesTotal(rules);
  return total > 0 ? rules : defaultRules(users);
}

function salesMatches(lead: Lead, rule: SalesAssignmentRule) {
  return lead.assignedTo === rule.salesId || lead.assignedTo === rule.salesName || lead.assignedToName === rule.salesName;
}

function chooseAutoAssignedSalesFromRules(leads: Lead[], users: AdminUser[], savedRules?: SalesAssignmentRule[]): SalesAssignmentPick | null {
  const rules = normalizeAssignmentRules(users, savedRules).filter((rule) => rule.active && cleanPercent(rule.percent) > 0);
  if (!rules.length || assignmentRulesTotal(rules) !== 100) return null;

  const assignedLeads = leads.filter((lead) => rules.some((rule) => salesMatches(lead, rule)) && lead.assignedStatus !== 'returned');
  const totalAfter = assignedLeads.length + 1;

  const ranked = rules.map((rule) => {
    const current = assignedLeads.filter((lead) => salesMatches(lead, rule)).length;
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
  if (!winner) return null;
  return { salesId: winner.salesId, salesName: winner.salesName, targetPercent: cleanPercent(winner.percent) };
}

export function chooseAutoAssignedSales(leads: Lead[], users: AdminUser[]): SalesAssignmentPick | null {
  return chooseAutoAssignedSalesFromRules(leads, users, readStored());
}

export async function chooseAutoAssignedSalesAsync(leads: Lead[], users: AdminUser[]): Promise<SalesAssignmentPick | null> {
  return chooseAutoAssignedSalesFromRules(leads, users, await getStoredRules());
}

export const assignmentRuleService = {
  getRules: async (users: AdminUser[]) => normalizeAssignmentRules(users, await getStoredRules()),
  saveRules: async (users: AdminUser[], rules: SalesAssignmentRule[]) => {
    const normalized = normalizeAssignmentRules(users, rules).map((rule) => ({
      ...rule,
      percent: cleanPercent(rule.percent),
      updatedAt: new Date().toISOString(),
    }));
    const total = assignmentRulesTotal(normalized);
    if (total !== 100) throw new Error('Tổng tỷ lệ phân lead của sales đang active phải bằng 100%.');
    if (USE_FIREBASE) {
      try {
        await writeRemoteRules(normalized);
      } catch (error) {
        console.error('[AssignmentRules] Firestore save failed:', error);
        throw new Error('Không lưu được rule chia lead lên Firestore. Vui lòng thử lại hoặc kiểm tra quyền tài khoản.');
      }
    }
    writeStored(normalized);
    return normalized;
  },
  bulkAutoAssignNewLeads: async (): Promise<BulkAutoAssignNewLeadsResult> => {
    const response = await fetch('/api/app-config?id=bulkAutoAssignNewLeads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    });
    const payload = await response.json().catch(() => ({})) as Partial<BulkAutoAssignNewLeadsResult> & { error?: string };
    if (!response.ok) throw new Error(payload.error || 'Không auto chia được lead mới.');
    return payload as BulkAutoAssignNewLeadsResult;
  },
};
