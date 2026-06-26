import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { delay, store } from '@/services/store';
import type { CapiEventLog, CapiRuntimeConfig } from '@/types/capi';

const USE_FIREBASE = isFirebaseConfigured && !!db;
const COL_EVENTS = 'capiEvents';

async function readEvents() {
  if (!USE_FIREBASE) return null;
  const snap = await getDocs(query(collection(db!, COL_EVENTS), orderBy('createdAt', 'desc'), limit(100))).catch(() => null);
  return snap ? snap.docs.map((item) => ({ id: item.id, ...item.data() }) as CapiEventLog) : null;
}

async function authenticatedRequest(body?: Record<string, unknown>) {
  const token = await auth?.currentUser?.getIdToken().catch(() => '');
  const response = await fetch('/api/capi-send-event', {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error || 'CAPI server request failed.');
  return payload;
}

export const capiService = {
  getRuntimeConfig: async () => authenticatedRequest() as Promise<CapiRuntimeConfig>,

  getEvents: async () => {
    const remote = await readEvents();
    if (remote) store.capiEvents = remote;
    return delay(store.capiEvents);
  },

  retryEvent: async (id: string) => {
    const event = store.capiEvents.find((item) => item.id === id);
    if (!event) throw new Error('Event not found.');
    await authenticatedRequest({ action: 'retry', id });
    const remote = await readEvents();
    if (remote) store.capiEvents = remote;
    return delay(store.capiEvents);
  },
};
