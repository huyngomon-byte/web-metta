import { DEAL_QUOTED_STATUS, LOST_LEAD_STATUS, WON_LEAD_STATUS, leadStatuses } from '@/lib/constants';
import type { Lead, LeadStageHistoryEntry } from '@/types/crm';

const HOUR_MS = 60 * 60 * 1000;

export function normalizePhone(value?: string) {
  return String(value || '').replace(/\D/g, '').replace(/^84/, '0');
}

export function isReferralSource(source?: string) {
  return String(source || '').trim().toLowerCase() === 'referral';
}

function validDate(value?: string) {
  const time = value ? new Date(value).getTime() : Number.NaN;
  return Number.isFinite(time) ? time : 0;
}

function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function statusIndex(status?: string) {
  const index = (leadStatuses as readonly string[]).indexOf(String(status || ''));
  return index >= 0 ? index : 0;
}

export function normalizeStageHistory(lead: Lead): LeadStageHistoryEntry[] {
  if (Array.isArray(lead.stageHistory) && lead.stageHistory.length) {
    return lead.stageHistory
      .filter((entry) => entry.status && validDate(entry.enteredAt))
      .sort((a, b) => validDate(a.enteredAt) - validDate(b.enteredAt));
  }

  const currentIndex = statusIndex(lead.status);
  const createdMs = validDate(lead.createdAt) || validDate(lead.updatedAt) || Date.now();
  const currentMs = Math.max(validDate(lead.statusUpdatedAt), validDate(lead.updatedAt), createdMs);
  const steps = Math.max(currentIndex + 1, 1);
  const gap = Math.max(Math.floor((currentMs - createdMs) / steps), HOUR_MS * 3);

  return leadStatuses.slice(0, currentIndex + 1).map((status, index) => {
    const enteredAt = new Date(createdMs + gap * index).toISOString();
    const isCurrent = index === currentIndex;
    return {
      status,
      enteredAt,
      ...(isCurrent ? {} : { exitedAt: new Date(createdMs + gap * (index + 1)).toISOString() }),
    };
  });
}

export function updateStageHistory(
  lead: Partial<Lead>,
  nextStatus: string,
  timestamp: string,
): LeadStageHistoryEntry[] {
  const history = Array.isArray(lead.stageHistory) ? [...lead.stageHistory] : [];
  const currentStatus = history[history.length - 1]?.status || lead.status;
  if (currentStatus === nextStatus) return history;

  if (!history.length && lead.status) {
    history.push({
      status: lead.status,
      enteredAt: lead.createdAt || timestamp,
      exitedAt: timestamp,
    });
  } else if (history.length) {
    history[history.length - 1] = {
      ...history[history.length - 1],
      exitedAt: history[history.length - 1].exitedAt || timestamp,
    };
  }

  history.push({ status: nextStatus, enteredAt: timestamp });
  return history;
}

export function buildStageCohortData(leads: Lead[]) {
  const total = leads.length;
  const historiesByLead = leads.map((lead) => ({ lead, history: normalizeStageHistory(lead) }));

  return leadStatuses.map((status, index) => {
    const current = leads.filter((lead) => lead.status === status).length;
    const reached = historiesByLead.filter(({ history }) => history.some((entry) => entry.status === status)).length;
    const durations = historiesByLead.flatMap(({ history }) =>
      history
        .filter((entry) => entry.status === status && entry.exitedAt)
        .map((entry) => {
          const hours = (validDate(entry.exitedAt) - validDate(entry.enteredAt)) / HOUR_MS;
          return Number.isFinite(hours) && hours >= 0 ? hours : 0;
        })
        .filter((hours) => hours > 0),
    );
    const avgHours = durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0;
    const medianHours = Math.round(median(durations));
    return {
      status,
      index: index + 1,
      current,
      currentRate: total ? Math.round((current / total) * 100) : 0,
      reached,
      reachedRate: total ? Math.round((reached / total) * 100) : 0,
      avgHours,
      medianHours,
      samples: durations.length,
    };
  });
}

export function formatDurationHours(hours: number) {
  if (!hours) return '-';
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  return restHours ? `${days}d ${restHours}h` : `${days}d`;
}

export function buildReasonShareData(
  leads: Lead[],
  field: 'pendingReason' | 'lostReason',
) {
  const sourceLeads = field === 'pendingReason'
    ? leads.filter((lead) => lead.status === DEAL_QUOTED_STATUS || lead.pendingReason)
    : leads.filter((lead) => lead.status === LOST_LEAD_STATUS || lead.lostReason);
  const total = sourceLeads.length;
  const map = new Map<string, number>();
  sourceLeads.forEach((lead) => {
    const reason = String(lead[field] || 'Chưa chọn lý do').trim() || 'Chưa chọn lý do';
    map.set(reason, (map.get(reason) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value, rate: total ? Math.round((value / total) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);
}

export function buildReferralStats(leads: Lead[]) {
  const byReferrerPhone = new Map<string, Lead[]>();
  leads.forEach((lead) => {
    if (!isReferralSource(lead.source)) return;
    const phone = normalizePhone(lead.referralPhone);
    if (!phone) return;
    byReferrerPhone.set(phone, [...(byReferrerPhone.get(phone) || []), lead]);
  });

  const stats = new Map<string, {
    total: number;
    won: number;
    quoted: number;
    lost: number;
    active: number;
    statusCounts: Record<string, number>;
  }>();

  leads.forEach((lead) => {
    const referred = byReferrerPhone.get(normalizePhone(lead.phone)) || [];
    const statusCounts = Object.fromEntries(leadStatuses.map((status) => [
      status,
      referred.filter((item) => item.status === status).length,
    ])) as Record<string, number>;
    const won = referred.filter((item) => item.status === WON_LEAD_STATUS).length;
    const quoted = referred.filter((item) => item.status === DEAL_QUOTED_STATUS).length;
    const lost = referred.filter((item) => item.status === LOST_LEAD_STATUS).length;
    stats.set(lead.id, {
      total: referred.length,
      won,
      quoted,
      lost,
      active: referred.length - won - lost,
      statusCounts,
    });
  });

  return stats;
}
