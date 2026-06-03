import { defaultLeadSourceConfigs } from '@/lib/constants';
import type { LeadSourceConfig, LeadPriorityLevel } from '@/types/crm';

const LS_KEY = 'metta_lead_source_configs';

function sourceId(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `source-${Date.now()}`;
}

function clampPriority(value: unknown): LeadPriorityLevel {
  const parsed = Number(value);
  if (parsed >= 5) return 5;
  if (parsed >= 4) return 4;
  if (parsed >= 3) return 3;
  if (parsed >= 2) return 2;
  return 1;
}

function normalizeConfig(config: Partial<LeadSourceConfig> & { name: string }, index = 0): LeadSourceConfig {
  const now = new Date().toISOString();
  const name = config.name.trim();
  return {
    id: config.id || sourceId(name || `source-${index + 1}`),
    name,
    priorityLevel: clampPriority(config.priorityLevel),
    description: config.description || '',
    active: config.active !== false,
    createdAt: config.createdAt || now,
    updatedAt: config.updatedAt || now,
  };
}

function defaultConfigs(): LeadSourceConfig[] {
  return defaultLeadSourceConfigs.map((item, index) => normalizeConfig({
    id: sourceId(item.name),
    name: item.name,
    priorityLevel: item.priorityLevel,
    description: item.description,
    active: true,
  }, index));
}

function normalizeList(configs: LeadSourceConfig[]) {
  const map = new Map<string, LeadSourceConfig>();
  configs.forEach((item, index) => {
    const normalized = normalizeConfig(item, index);
    if (normalized.name) map.set(normalized.name.toLowerCase(), normalized);
  });
  return Array.from(map.values()).filter((item) => item.name);
}

export function sourcePriority(configs: LeadSourceConfig[], source?: string, fallback: unknown = 1): LeadPriorityLevel {
  const match = configs.find((item) => item.name.toLowerCase() === String(source || '').toLowerCase());
  return match ? match.priorityLevel : clampPriority(fallback);
}

export const sourceConfigService = {
  getConfigs: async () => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return defaultConfigs();
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return defaultConfigs();
      const normalized = normalizeList(parsed);
      return normalized.length ? normalized : defaultConfigs();
    } catch {
      return defaultConfigs();
    }
  },

  saveConfigs: async (configs: LeadSourceConfig[]) => {
    const normalized = normalizeList(configs).map((item) => ({
      ...item,
      priorityLevel: clampPriority(item.priorityLevel),
      updatedAt: new Date().toISOString(),
    }));
    try { localStorage.setItem(LS_KEY, JSON.stringify(normalized)); } catch {}
    return normalized;
  },

  priorityForSource: async (source?: string, fallback: unknown = 1) => {
    const configs = await sourceConfigService.getConfigs();
    return sourcePriority(configs, source, fallback);
  },
};
