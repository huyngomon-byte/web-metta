import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { delay, store } from '@/services/store';
import type { CapiEventLog, CapiMapping, CapiSettings } from '@/types/capi';

const now = () => new Date().toISOString();
const USE_FIREBASE = isFirebaseConfigured && !!db;
const SETTINGS_DOC = 'capiSettings/main';
const COL_MAPPINGS = 'capiMappings';
const COL_EVENTS = 'capiEvents';

function sanitizeSettings(settings: CapiSettings): CapiSettings {
  return { ...settings, accessToken: '', updatedAt: settings.updatedAt || now() };
}

async function readSettings() {
  if (!USE_FIREBASE) return null;
  const snap = await getDoc(doc(db!, SETTINGS_DOC)).catch(() => null);
  return snap?.exists() ? sanitizeSettings(snap.data() as CapiSettings) : null;
}

async function readMappings() {
  if (!USE_FIREBASE) return null;
  const snap = await getDocs(query(collection(db!, COL_MAPPINGS), orderBy('updatedAt', 'desc'))).catch(() => null);
  return snap ? snap.docs.map((item) => ({ id: item.id, ...item.data() }) as CapiMapping) : null;
}

async function readEvents() {
  if (!USE_FIREBASE) return null;
  const snap = await getDocs(query(collection(db!, COL_EVENTS), orderBy('createdAt', 'desc'))).catch(() => null);
  return snap ? snap.docs.map((item) => ({ id: item.id, ...item.data() }) as CapiEventLog) : null;
}

async function sendServerEvent(body: Record<string, unknown>) {
  const token = await auth?.currentUser?.getIdToken().catch(() => '');
  const response = await fetch('/api/capi-send-event', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error || 'CAPI server event failed.');
  return payload;
}

async function retryServerEvent(id: string) {
  const token = await auth?.currentUser?.getIdToken().catch(() => '');
  const response = await fetch('/api/capi-send-event', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action: 'retry', id }),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error || 'Retry CAPI event failed.');
  return payload;
}

export const capiService = {
  getSettings: async () => {
    const remote = await readSettings();
    if (remote) store.capiSettings = remote;
    return delay(sanitizeSettings(store.capiSettings));
  },

  saveSettings: async (settings: CapiSettings) => {
    const saved = sanitizeSettings({ ...settings, updatedAt: now() });
    store.capiSettings = saved;
    if (USE_FIREBASE) {
      await setDoc(doc(db!, SETTINGS_DOC), saved, { merge: true });
    }
    return delay(saved);
  },

  getMappings: async () => {
    const remote = await readMappings();
    if (remote) store.capiMappings = remote;
    return delay(store.capiMappings);
  },

  saveMapping: async (mapping: Partial<CapiMapping>) => {
    const saved: CapiMapping = mapping.id
      ? { ...store.capiMappings.find((item) => item.id === mapping.id), ...mapping, updatedAt: now() } as CapiMapping
      : {
          id: `map-${Date.now()}`,
          formId: mapping.formId || '',
          formName: mapping.formName || '',
          eventName: mapping.eventName || 'Lead',
          landingPageSlug: mapping.landingPageSlug || '',
          enabled: true,
          sendBrowserEvent: true,
          sendServerEvent: true,
          customDataFields: [],
          updatedAt: now(),
        };

    store.capiMappings = mapping.id
      ? store.capiMappings.map((item) => (item.id === saved.id ? saved : item))
      : [saved, ...store.capiMappings];

    if (USE_FIREBASE) {
      await setDoc(doc(db!, COL_MAPPINGS, saved.id), saved, { merge: true });
    }
    return delay(saved);
  },

  getEvents: async () => {
    const remote = await readEvents();
    if (remote) store.capiEvents = remote;
    return delay(store.capiEvents);
  },

  sendTestEvent: async (eventName = 'Lead') => {
    const settings = sanitizeSettings(store.capiSettings);
    await sendServerEvent({
      event_name: eventName,
      event_source_url: settings.defaultSourceUrl || window.location.origin,
      formId: 'test-panel',
      custom_data: { source: 'admin_test' },
    });
    const remote = await readEvents();
    if (remote) store.capiEvents = remote;
    return delay(store.capiEvents[0]);
  },

  retryEvent: async (id: string) => {
    const event = store.capiEvents.find((item) => item.id === id);
    if (!event) throw new Error('Event not found.');
    await retryServerEvent(id);
    const remote = await readEvents();
    if (remote) store.capiEvents = remote;
    return delay(store.capiEvents);
  },
};
