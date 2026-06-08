import type { Lead } from '@/types/crm';
import type { SalesAssignmentPick, SalesAssignmentRule } from '@/types/assignment';
import type { AdminUser } from '@/types/user';

const LS_KEY = 'metta_sales_assignment_rules';

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
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStored(rules: SalesAssignmentRule[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(rules));
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

export function chooseAutoAssignedSales(leads: Lead[], users: AdminUser[]): SalesAssignmentPick | null {
  const rules = normalizeAssignmentRules(users).filter((rule) => rule.active && cleanPercent(rule.percent) > 0);
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

export const assignmentRuleService = {
  getRules: (users: AdminUser[]) => normalizeAssignmentRules(users),
  saveRules: (users: AdminUser[], rules: SalesAssignmentRule[]) => {
    const normalized = normalizeAssignmentRules(users, rules).map((rule) => ({
      ...rule,
      percent: cleanPercent(rule.percent),
      updatedAt: new Date().toISOString(),
    }));
    const total = assignmentRulesTotal(normalized);
    if (total !== 100) throw new Error('Tổng tỷ lệ phân lead của sales đang active phải bằng 100%.');
    writeStored(normalized);
    return normalized;
  },
};
