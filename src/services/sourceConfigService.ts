import { doc, getDoc, setDoc } from 'firebase/firestore';
import { defaultLeadSourceConfigs } from '@/lib/constants';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { readAppConfig, writeAppConfig } from '@/services/appConfigApi';
import type { LeadSourceConfig, LeadPriorityLevel } from '@/types/crm';

const USE_FIREBASE = isFirebaseConfigured && !!db;
const CONFIG_COLLECTION = 'appConfig';
const CONFIG_DOC_ID = 'leadSourceConfigs';
let cachedConfigs: LeadSourceConfig[] | null = null;

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

function cacheConfigs(configs: LeadSourceConfig[]) {
  cachedConfigs = configs;
}

function readLocalConfigs() {
  return cachedConfigs ? normalizeList(cachedConfigs) : null;
}

async function readRemoteConfigs() {
  if (!USE_FIREBASE) return null;
  try {
    const apiConfigs = await readAppConfig<LeadSourceConfig>(CONFIG_DOC_ID, 'configs');
    if (apiConfigs) {
      const normalized = normalizeList(apiConfigs);
      cacheConfigs(normalized);
      return normalized;
    }
  } catch (error) {
    console.warn('[LeadSourceConfigs] API read failed, trying Firestore client:', error);
  }
  try {
    const snap = await getDoc(doc(db!, CONFIG_COLLECTION, CONFIG_DOC_ID));
    if (!snap.exists()) return null;
    const data = snap.data() as { configs?: LeadSourceConfig[] };
    if (!Array.isArray(data.configs)) return null;
    const normalized = normalizeList(data.configs);
    cacheConfigs(normalized);
    return normalized;
  } catch (error) {
    console.warn('[LeadSourceConfigs] Firestore read failed:', error);
    throw error;
  }
}

async function writeRemoteConfigs(configs: LeadSourceConfig[]) {
  try {
    await writeAppConfig<LeadSourceConfig>(CONFIG_DOC_ID, 'configs', configs);
    return;
  } catch (error) {
    console.warn('[LeadSourceConfigs] API save failed, trying Firestore client:', error);
  }
  await setDoc(doc(db!, CONFIG_COLLECTION, CONFIG_DOC_ID), {
    configs,
    updatedAt: new Date().toISOString(),
  });
}

async function migrateLocalToRemote(configs: LeadSourceConfig[]) {
  if (!USE_FIREBASE) return;
  try {
    await writeRemoteConfigs(configs);
  } catch (error) {
    console.warn('[LeadSourceConfigs] Local-to-Firestore migration failed:', error);
  }
}

export function sourcePriority(configs: LeadSourceConfig[], source?: string, fallback: unknown = 1): LeadPriorityLevel {
  const match = configs.find((item) => item.name.toLowerCase() === String(source || '').toLowerCase());
  return match ? match.priorityLevel : clampPriority(fallback);
}

export const sourceConfigService = {
  getConfigs: async () => {
    const remote = await readRemoteConfigs();
    if (remote) return remote;

    if (USE_FIREBASE) {
      const fallback = defaultConfigs();
      cacheConfigs(fallback);
      void migrateLocalToRemote(fallback);
      return fallback;
    }

    const local = readLocalConfigs();
    if (local) {
      void migrateLocalToRemote(local);
      return local;
    }

    const fallback = defaultConfigs();
    cacheConfigs(fallback);
    void migrateLocalToRemote(fallback);
    return fallback;
  },

  saveConfigs: async (configs: LeadSourceConfig[]) => {
    const normalized = normalizeList(configs).map((item) => ({
      ...item,
      priorityLevel: clampPriority(item.priorityLevel),
      updatedAt: new Date().toISOString(),
    }));
    if (USE_FIREBASE) {
      try {
        await writeRemoteConfigs(normalized);
      } catch (error) {
        console.error('[LeadSourceConfigs] Firestore save failed:', error);
        throw new Error('Không lưu được cấu hình source lên Firestore. Vui lòng thử lại hoặc kiểm tra quyền tài khoản.');
      }
    }
    cacheConfigs(normalized);
    return normalized;
  },

  priorityForSource: async (source?: string, fallback: unknown = 1) => {
    const configs = await sourceConfigService.getConfigs();
    return sourcePriority(configs, source, fallback);
  },
};
