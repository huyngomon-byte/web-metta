import type { Lead } from '@/types/crm';
import type { AppNotification } from '@/types/notification';

const LS_KEY = 'metta_notifications';

function now() {
  return new Date().toISOString();
}

function readAll(): AppNotification[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: AppNotification[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items.slice(0, 200)));
  window.dispatchEvent(new Event('metta-notifications-updated'));
}

function leadUrl(leadId: string) {
  return `/crm/leads?view=kanban&leadId=${encodeURIComponent(leadId)}`;
}

export const notificationService = {
  getForUser: (userId?: string) => {
    if (!userId) return [];
    return readAll()
      .filter((item) => item.userId === userId)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },

  unreadCount: (userId?: string) => notificationService.getForUser(userId).filter((item) => !item.read).length,

  notifyLeadAssigned: (lead: Pick<Lead, 'id' | 'fullName' | 'studentName' | 'parentName' | 'phone'>, salesId: string, assignedByName?: string, auto = false) => {
    if (!salesId || !lead.id) return null;
    const leadName = lead.studentName || lead.fullName || lead.parentName || lead.phone || 'Lead mới';
    const notification: AppNotification = {
      id: `noti-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type: 'lead_assigned',
      userId: salesId,
      title: auto ? 'Lead mới được auto assign' : 'Lead mới được phân cho bạn',
      body: `${leadName}${assignedByName ? ` • ${assignedByName}` : ''}`,
      leadId: lead.id,
      url: leadUrl(lead.id),
      read: false,
      createdAt: now(),
    };
    writeAll([notification, ...readAll()]);
    return notification;
  },

  markRead: (id: string) => {
    const next = readAll().map((item) => (item.id === id ? { ...item, read: true } : item));
    writeAll(next);
    return next;
  },

  markAllRead: (userId?: string) => {
    if (!userId) return [];
    const next = readAll().map((item) => (item.userId === userId ? { ...item, read: true } : item));
    writeAll(next);
    return next;
  },
};
