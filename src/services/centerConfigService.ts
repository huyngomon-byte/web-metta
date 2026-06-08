import { defaultLeadCenterConfigs } from '@/lib/constants';
import type { LeadCenterConfig } from '@/types/crm';

const LS_KEY = 'metta_lead_center_configs';

function centerId(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || `center-${Date.now()}`;
}

function normalizeConfig(config: Partial<LeadCenterConfig> & { name: string }, index = 0): LeadCenterConfig {
  const now = new Date().toISOString();
  const name = config.name.trim();
  return {
    id: config.id || centerId(name || `center-${index + 1}`),
    name,
    address: config.address || '',
    description: config.description || '',
    active: config.active !== false,
    createdAt: config.createdAt || now,
    updatedAt: config.updatedAt || now,
  };
}

function defaultConfigs(): LeadCenterConfig[] {
  return defaultLeadCenterConfigs.map((item, index) => normalizeConfig({
    id: centerId(item.name),
    name: item.name,
    address: item.address,
    description: item.description,
    active: true,
  }, index));
}

function normalizeList(configs: LeadCenterConfig[]) {
  const map = new Map<string, LeadCenterConfig>();
  configs.forEach((item, index) => {
    const normalized = normalizeConfig(item, index);
    if (normalized.name) map.set(normalized.name.toLowerCase(), normalized);
  });
  return Array.from(map.values()).filter((item) => item.name);
}

export const centerConfigService = {
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

  saveConfigs: async (configs: LeadCenterConfig[]) => {
    const normalized = normalizeList(configs).map((item) => ({
      ...item,
      updatedAt: new Date().toISOString(),
    }));
    try { localStorage.setItem(LS_KEY, JSON.stringify(normalized)); } catch {}
    return normalized;
  },
};
