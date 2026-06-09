import type { Lead } from '@/types/crm';
import type { AppNotification } from '@/types/notification';
import type { Appointment } from '@/types/crm';
import type { AdminUser } from '@/types/user';
import { DEAL_QUOTED_STATUS, LOST_LEAD_STATUS, WON_LEAD_STATUS, leadStatuses } from '@/lib/constants';
import { expectedRevenueAmount } from '@/lib/leadFinance';
import { currentUser } from '@/services/authService';

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

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function dateKey(value?: string) {
  return String(value || '').slice(0, 10);
}

function activeLead(lead: Lead) {
  return ![WON_LEAD_STATUS, LOST_LEAD_STATUS].includes(lead.status);
}

function userCanSeeAll(user?: AdminUser | null) {
  return Boolean(user?.active && ['admin', 'manager'].includes(user.role));
}

function stableDigest(id: string, readState: Map<string, boolean>, item: Omit<AppNotification, 'id' | 'read' | 'createdAt'>): AppNotification {
  return {
    ...item,
    id,
    read: readState.get(id) || false,
    createdAt: new Date().toISOString(),
  };
}

function leadName(lead?: Pick<Lead, 'fullName' | 'studentName' | 'parentName' | 'phone'>) {
  return String(lead?.studentName || lead?.parentName || lead?.fullName || lead?.phone || 'Lead').trim();
}

export const notificationService = {
  getForUser: (userId?: string) => {
    if (!userId) return [];
    return readAll()
      .filter((item) => item.userId === userId)
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  },

  getDigestForUser: ({
    user,
    leads,
    appointments,
  }: {
    user?: AdminUser | null;
    leads: Lead[];
    appointments: Appointment[];
  }) => {
    if (!user?.id) return [];
    const readState = new Map(readAll().filter((item) => item.userId === user.id).map((item) => [item.id, item.read]));
    const today = todayKey();
    const userLeads = userCanSeeAll(user) ? leads : leads.filter((lead) => lead.assignedTo === user.id);
    const userAppointments = userCanSeeAll(user) ? appointments : appointments.filter((item) => item.assignedTo === user.id);
    const items: AppNotification[] = [];

    if (userCanSeeAll(user)) {
      const unassigned = leads.filter((lead) => !lead.assignedTo && activeLead(lead));
      const overdueFollowUp = leads.filter((lead) => lead.followUpDate && dateKey(lead.followUpDate) < today && activeLead(lead));
      const stale = leads.filter((lead) => activeLead(lead) && dateKey(lead.updatedAt) < today && !lead.followUpDate);
      const todayAppointments = userAppointments.filter((item) => dateKey(item.startTime) === today && item.status === 'upcoming');
      const expected = leads.filter((lead) => lead.status === DEAL_QUOTED_STATUS).reduce((sum, lead) => sum + expectedRevenueAmount(lead), 0);

      if (unassigned.length) {
        items.push(stableDigest(`digest-${today}-${user.id}-unassigned`, readState, {
          type: 'admin_digest',
          userId: user.id,
          title: `${unassigned.length} lead chưa có PIC`,
          body: `Ưu tiên phân ${unassigned.filter((lead) => Number(lead.priorityLevel || 0) >= 4).length} lead P4/P5 trước để sales xử lý.`,
          url: '/crm/lead-assignment',
        }));
      }
      if (overdueFollowUp.length) {
        items.push(stableDigest(`digest-${today}-${user.id}-overdue-followup`, readState, {
          type: 'pipeline_alert',
          userId: user.id,
          title: `${overdueFollowUp.length} follow-up quá hạn`,
          body: `Cần nhắc sales xử lý lại các lead đang mở, tránh rơi khỏi pipeline.`,
          url: '/crm/tasks',
        }));
      }
      if (stale.length) {
        items.push(stableDigest(`digest-${today}-${user.id}-stale-leads`, readState, {
          type: 'admin_digest',
          userId: user.id,
          title: `${stale.length} lead chưa có bước chăm sóc mới`,
          body: `Các lead active chưa có lịch follow-up rõ ràng trong hôm nay.`,
          url: '/dashboard',
        }));
      }
      if (todayAppointments.length) {
        items.push(stableDigest(`digest-${today}-${user.id}-appointments`, readState, {
          type: 'appointment_due',
          userId: user.id,
          title: `${todayAppointments.length} lịch hẹn trong hôm nay`,
          body: `Bao gồm tư vấn, test đầu vào và lịch gọi lại của toàn team.`,
          url: '/appointments',
        }));
      }
      if (expected > 0) {
        items.push(stableDigest(`digest-${today}-${user.id}-expected-revenue`, readState, {
          type: 'admin_digest',
          userId: user.id,
          title: `Pipeline expected revenue đang mở`,
          body: `Có ${leads.filter((lead) => lead.status === DEAL_QUOTED_STATUS).length} lead chờ chốt cần follow-up doanh thu.`,
          url: '/dashboard',
        }));
      }
    } else if (user.role === 'sales') {
      const dueFollowUp = userLeads.filter((lead) => lead.followUpDate && dateKey(lead.followUpDate) <= today && activeLead(lead));
      const todayAppointments = userAppointments.filter((item) => dateKey(item.startTime) === today && item.status === 'upcoming');
      const quoteLeads = userLeads.filter((lead) => lead.status === DEAL_QUOTED_STATUS);
      const noAnswer = userLeads.filter((lead) => lead.status === leadStatuses[2] && activeLead(lead));
      const newAssigned = userLeads.filter((lead) => lead.assignedStatus === 'active' && dateKey(lead.assignedAt || lead.createdAt) === today);

      if (newAssigned.length) {
        const firstLead = newAssigned[0];
        items.push(stableDigest(`digest-${today}-${user.id}-new-assigned`, readState, {
          type: 'lead_assigned',
          userId: user.id,
          title: `${newAssigned.length} lead mới được giao`,
          body: `${leadName(firstLead)}${newAssigned.length > 1 ? ` và ${newAssigned.length - 1} lead khác` : ''}. Nên xử lý trong ngày.`,
          leadId: firstLead.id,
          url: leadUrl(firstLead.id),
        }));
      }
      if (dueFollowUp.length) {
        const firstLead = dueFollowUp[0];
        items.push(stableDigest(`digest-${today}-${user.id}-due-followup`, readState, {
          type: 'task_due',
          userId: user.id,
          title: `${dueFollowUp.length} follow-up đến hạn`,
          body: `Lead gần nhất: ${leadName(firstLead)}. Ưu tiên gọi/chốt trạng thái ngay hôm nay.`,
          leadId: firstLead.id,
          url: '/crm/tasks',
        }));
      }
      if (todayAppointments.length) {
        items.push(stableDigest(`digest-${today}-${user.id}-my-appointments`, readState, {
          type: 'appointment_due',
          userId: user.id,
          title: `${todayAppointments.length} lịch hẹn của bạn hôm nay`,
          body: todayAppointments.slice(0, 2).map((item) => `${item.title} lúc ${item.startTime.slice(11, 16)}`).join(' · '),
          url: '/crm/tasks',
        }));
      }
      if (quoteLeads.length) {
        const totalExpected = quoteLeads.reduce((sum, lead) => sum + expectedRevenueAmount(lead), 0);
        items.push(stableDigest(`digest-${today}-${user.id}-quote-follow`, readState, {
          type: 'sales_digest',
          userId: user.id,
          title: `${quoteLeads.length} lead đang chờ chốt`,
          body: `Expected revenue ${totalExpected.toLocaleString('vi-VN')} đ. Cần follow-up lý do pending.`,
          url: '/crm/tasks',
        }));
      }
      if (noAnswer.length) {
        items.push(stableDigest(`digest-${today}-${user.id}-no-answer`, readState, {
          type: 'sales_digest',
          userId: user.id,
          title: `${noAnswer.length} lead chưa nghe máy`,
          body: `Nên gọi lại theo nhịp +2h trong ngày hoặc chuyển hẹn ngày mai nếu đã gọi nhiều lần.`,
          url: '/crm/tasks',
        }));
      }
    }

    return items;
  },

  getCombinedForUser: (user: AdminUser | null | undefined, leads: Lead[], appointments: Appointment[]) => {
    if (!user?.id) return [];
    const persisted = notificationService.getForUser(user.id);
    const digest = notificationService.getDigestForUser({ user, leads, appointments });
    const map = new Map<string, AppNotification>();
    [...persisted, ...digest].forEach((item) => map.set(item.id, item));
    return Array.from(map.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
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
    const existing = readAll();
    const hasItem = existing.some((item) => item.id === id);
    const next = hasItem
      ? existing.map((item) => (item.id === id ? { ...item, read: true } : item))
      : [{
        id,
        type: 'admin_digest' as const,
        userId: currentUser()?.id || '',
        title: '',
        body: '',
        read: true,
        createdAt: now(),
      }, ...existing];
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
