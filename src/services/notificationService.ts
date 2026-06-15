import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import type { Lead } from '@/types/crm';
import type { AppNotification } from '@/types/notification';

const USE_FIREBASE = isFirebaseConfigured && !!db;
const COL_NOTIFICATIONS = 'appNotifications';

let cachedNotifications: AppNotification[] = [];

function now() {
  return new Date().toISOString();
}

function dispatchUpdate() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('metta-notifications-updated'));
}

function dispatchRealtimeError(message: string) {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('metta-realtime-error', { detail: message }));
}

function dispatchRealtimeOk() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('metta-realtime-ok'));
}

function readAll(): AppNotification[] {
  return cachedNotifications;
}

function writeAll(items: AppNotification[]) {
  cachedNotifications = items
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
    .slice(0, 200);
  dispatchUpdate();
}

function leadUrl(leadId: string) {
  return `/crm/leads?view=kanban&leadId=${encodeURIComponent(leadId)}`;
}

function normalizeNotification(input: Partial<AppNotification>): AppNotification {
  return {
    id: String(input.id || `noti-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    type: input.type || 'admin_digest',
    userId: String(input.userId || ''),
    title: String(input.title || ''),
    body: String(input.body || ''),
    leadId: input.leadId,
    url: input.url,
    read: Boolean(input.read),
    createdAt: input.createdAt || now(),
  };
}

function mergeCachedForUser(userId: string, items: AppNotification[]) {
  writeAll([
    ...items,
    ...cachedNotifications.filter((item) => item.userId !== userId),
  ]);
}

async function writeRemote(notification: AppNotification) {
  if (!USE_FIREBASE) {
    writeAll([notification, ...readAll()]);
    return;
  }
  await setDoc(doc(db!, COL_NOTIFICATIONS, notification.id), notification);
}

export const notificationService = {
  subscribeForUser: (userId: string | undefined, callback: (items: AppNotification[]) => void, onError?: (error: unknown) => void): Unsubscribe => {
    if (!userId) {
      callback([]);
      return () => {};
    }

    if (!USE_FIREBASE) {
      callback(notificationService.getForUser(userId));
      return () => {};
    }

    const notificationQuery = query(collection(db!, COL_NOTIFICATIONS), where('userId', '==', userId));

    return onSnapshot(notificationQuery, (snap) => {
      dispatchRealtimeOk();
      const items = snap.docs
        .map((item) => normalizeNotification({ id: item.id, ...item.data() }))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
        .slice(0, 30);
      mergeCachedForUser(userId, items);
      callback(items);
    }, (error) => {
      console.warn('[Notifications] Realtime listener failed:', error);
      dispatchRealtimeError('Notification realtime đang fallback');
      onError?.(error);
      callback(notificationService.getForUser(userId));
    });
  },

  getForUser: (userId?: string) => {
    if (!userId) return [];
    return readAll()
      .filter((item) => item.userId === userId)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },

  notifyLeadAssigned: (lead: Pick<Lead, 'id' | 'fullName' | 'studentName' | 'parentName' | 'phone'>, salesId: string, assignedByName?: string, auto = false) => {
    if (!salesId || !lead.id) return null;
    const leadName = lead.studentName || lead.fullName || lead.parentName || lead.phone || 'Lead mới';
    const notification: AppNotification = {
      id: `noti-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'lead_assigned',
      userId: salesId,
      title: auto ? 'Lead mới được auto assign' : 'Lead mới được phân cho bạn',
      body: `${leadName}${assignedByName ? ` - ${assignedByName}` : ''}`,
      leadId: lead.id,
      url: leadUrl(lead.id),
      read: false,
      createdAt: now(),
    };
    void writeRemote(notification).catch((error) => {
      console.warn('[Notifications] Could not save notification:', error);
      writeAll([notification, ...readAll()]);
    });
    return notification;
  },

  markRead: (id: string) => {
    const existing = readAll();
    const next = existing.map((item) => (item.id === id ? { ...item, read: true } : item));
    writeAll(next);
    if (USE_FIREBASE) {
      void updateDoc(doc(db!, COL_NOTIFICATIONS, id), { read: true }).catch((error) => {
        console.warn('[Notifications] Could not mark notification read:', error);
      });
    }
    return next;
  },

  markAllRead: (userId?: string) => {
    if (!userId) return [];
    const next = readAll().map((item) => (item.userId === userId ? { ...item, read: true } : item));
    writeAll(next);
    if (USE_FIREBASE) {
      void (async () => {
        const snap = await getDocs(query(collection(db!, COL_NOTIFICATIONS), where('userId', '==', userId)));
        const batch = writeBatch(db!);
        snap.docs
          .filter((item) => normalizeNotification({ id: item.id, ...item.data() }).read === false)
          .slice(0, 450)
          .forEach((item) => batch.update(item.ref, { read: true }));
        await batch.commit();
      })().catch((error) => {
        console.warn('[Notifications] Could not mark all notifications read:', error);
      });
    }
    return next;
  },
};
