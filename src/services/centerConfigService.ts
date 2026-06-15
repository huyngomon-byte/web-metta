import { doc, getDoc, setDoc } from 'firebase/firestore';
import { defaultLeadCenterConfigs } from '@/lib/constants';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { readAppConfig, writeAppConfig } from '@/services/appConfigApi';
import type { LeadCenterConfig } from '@/types/crm';

const LS_KEY = 'metta_lead_center_configs';
const USE_FIREBASE = isFirebaseConfigured && !!db;
const CONFIG_COLLECTION = 'appConfig';
const CONFIG_DOC_ID = 'leadCenterConfigs';

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

function isLegacyDefaultConfig(configs: LeadCenterConfig[]) {
  const ids = configs.map((item) => centerId(item.name)).sort();
  return ids.length === 3
    && ids.includes('metta-quan-1')
    && ids.includes('metta-thao-dien')
    && ids.includes('metta-phu-nhuan');
}

function cacheConfigs(configs: LeadCenterConfig[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(configs)); } catch {}
}

function readLocalConfigs() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return normalizeList(parsed);
  } catch {
    return null;
  }
}

function resolveRemoteConfigs(configs: LeadCenterConfig[]) {
  const normalized = normalizeList(configs);
  if (isLegacyDefaultConfig(normalized)) {
    const fallback = defaultConfigs();
    cacheConfigs(fallback);
    void writeRemoteConfigs(fallback).catch((error) => {
      console.warn('[LeadCenterConfigs] Legacy remote cleanup failed:', error);
    });
    return fallback;
  }
  cacheConfigs(normalized);
  return normalized;
}

async function readRemoteConfigs() {
  if (!USE_FIREBASE) return null;
  try {
    const apiConfigs = await readAppConfig<LeadCenterConfig>(CONFIG_DOC_ID, 'configs');
    if (apiConfigs) return resolveRemoteConfigs(apiConfigs);
  } catch (error) {
    console.warn('[LeadCenterConfigs] API read failed, trying Firestore client:', error);
  }
  try {
    const snap = await getDoc(doc(db!, CONFIG_COLLECTION, CONFIG_DOC_ID));
    if (!snap.exists()) return null;
    const data = snap.data() as { configs?: LeadCenterConfig[] };
    if (!Array.isArray(data.configs)) return null;
    return resolveRemoteConfigs(data.configs);
  } catch (error) {
    console.warn('[LeadCenterConfigs] Firestore read failed, using local cache:', error);
    return null;
  }
}

async function writeRemoteConfigs(configs: LeadCenterConfig[]) {
  try {
    await writeAppConfig<LeadCenterConfig>(CONFIG_DOC_ID, 'configs', configs);
    return;
  } catch (error) {
    console.warn('[LeadCenterConfigs] API save failed, trying Firestore client:', error);
  }
  await setDoc(doc(db!, CONFIG_COLLECTION, CONFIG_DOC_ID), {
    configs,
    updatedAt: new Date().toISOString(),
  });
}

async function migrateLocalToRemote(configs: LeadCenterConfig[]) {
  if (!USE_FIREBASE) return;
  try {
    await writeRemoteConfigs(configs);
  } catch (error) {
    console.warn('[LeadCenterConfigs] Local-to-Firestore migration failed:', error);
  }
}

export const centerConfigService = {
  getConfigs: async () => {
    const remote = await readRemoteConfigs();
    if (remote) return remote;

    const local = readLocalConfigs();
    if (local) {
      if (isLegacyDefaultConfig(local)) {
        const fallback = defaultConfigs();
        cacheConfigs(fallback);
        void migrateLocalToRemote(fallback);
        return fallback;
      }
      void migrateLocalToRemote(local);
      return local;
    }

    const fallback = defaultConfigs();
    cacheConfigs(fallback);
    void migrateLocalToRemote(fallback);
    return fallback;
  },

  saveConfigs: async (configs: LeadCenterConfig[]) => {
    const normalized = normalizeList(configs).map((item) => ({
      ...item,
      updatedAt: new Date().toISOString(),
    }));
    if (USE_FIREBASE) {
      try {
        await writeRemoteConfigs(normalized);
      } catch (error) {
        console.error('[LeadCenterConfigs] Firestore save failed:', error);
        throw new Error('Không lưu được cấu hình trung tâm lên Firestore. Vui lòng thử lại hoặc kiểm tra quyền tài khoản.');
      }
    }
    cacheConfigs(normalized);
    return normalized;
  },
};
