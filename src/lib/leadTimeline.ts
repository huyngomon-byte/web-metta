import { DEAL_QUOTED_STATUS, LOST_LEAD_STATUS, WON_LEAD_STATUS } from '@/lib/constants';
import { expectedRevenueAmount, revenueAmount } from '@/lib/leadFinance';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Appointment, Lead, LeadActivity } from '@/types/crm';

export type LeadTimelineTone = 'blue' | 'cyan' | 'green' | 'orange' | 'red' | 'purple' | 'gray';

export interface LeadTimelineEvent {
  id: string;
  at: string;
  tone: LeadTimelineTone;
  label: string;
  title: string;
  description?: string;
  meta?: string;
}

function displayName(lead: Partial<Lead>) {
  return String(lead.studentName || lead.parentName || lead.fullName || '').trim() || 'Lead';
}

function hasDate(value?: string) {
  if (!value) return false;
  return Number.isFinite(new Date(value).getTime());
}

function push(events: LeadTimelineEvent[], event: LeadTimelineEvent | false | undefined | null | '') {
  if (event && hasDate(event.at)) events.push(event);
}

function appointmentStatus(status: Appointment['status']) {
  if (status === 'done') return 'Hoàn thành';
  if (status === 'cancelled') return 'Đã hủy';
  if (status === 'overdue') return 'Quá hạn';
  return 'Sắp diễn ra';
}

export function buildLeadTimeline(lead: Lead, activities: LeadActivity[] = [], appointments: Appointment[] = []) {
  const events: LeadTimelineEvent[] = [];
  const name = displayName(lead);

  push(events, {
    id: `${lead.id}-created`,
    at: lead.createdAt,
    tone: 'blue',
    label: 'Lead',
    title: `Tạo lead ${name}`,
    description: `Nguồn ${lead.source || '-'}${lead.centerName ? ` · Trung tâm ${lead.centerName}` : ''}${lead.priorityLevel ? ` · P${lead.priorityLevel}` : ''}`,
  });

  push(events, lead.assignedAt && {
    id: `${lead.id}-assigned`,
    at: lead.assignedAt,
    tone: 'cyan',
    label: 'Phân lead',
    title: `Phân lead cho ${lead.assignedToName || lead.assignedTo || 'sales'}`,
    description: lead.assignedBy === 'auto-assignment-rule' ? 'Phân tự động theo rule tỷ lệ sales.' : 'Phân lead thủ công hoặc cập nhật PIC.',
  });

  push(events, lead.failedAt && {
    id: `${lead.id}-returned`,
    at: lead.failedAt,
    tone: 'orange',
    label: 'Trả lead',
    title: 'Lead bị trả về',
    description: `Sales cũ: ${lead.failedAssignedToName || lead.failedAssignedTo || '-'}. Lý do: ${lead.failedReason || '-'}`,
  });

  push(events, (lead.statusUpdatedAt || lead.updatedAt) && {
    id: `${lead.id}-status-current`,
    at: lead.statusUpdatedAt || lead.updatedAt,
    tone: lead.status === LOST_LEAD_STATUS ? 'red' : lead.status === WON_LEAD_STATUS ? 'green' : 'purple',
    label: 'Status',
    title: `Trạng thái hiện tại: ${lead.status}`,
    description: `Cập nhật gần nhất ${formatDate(lead.updatedAt, true)}.`,
  });

  push(events, lead.followUpDate && {
    id: `${lead.id}-follow-up`,
    at: lead.followUpDate,
    tone: 'orange',
    label: 'Follow-up',
    title: 'Lịch gọi lại / follow-up',
    description: 'Lịch follow-up được lưu trên lead.',
  });

  push(events, lead.consultationDate && {
    id: `${lead.id}-consultation-date`,
    at: lead.consultationDate,
    tone: 'purple',
    label: 'Tư vấn',
    title: 'Lịch tư vấn / test',
    description: 'Lịch tư vấn được lưu trên lead.',
  });

  push(events, lead.status === DEAL_QUOTED_STATUS && {
    id: `${lead.id}-quote`,
    at: lead.updatedAt || lead.createdAt,
    tone: 'orange',
    label: 'Báo phí',
    title: `Expected revenue ${formatCurrency(expectedRevenueAmount(lead), lead.dealCurrency || 'VND')}`,
    description: `${lead.pendingReason || 'Đã báo phí / chờ chốt'}${lead.pendingWarmthPercent ? ` · Warmth ${lead.pendingWarmthPercent}%` : ''}`,
    meta: lead.dealNote,
  });

  push(events, lead.status === WON_LEAD_STATUS && {
    id: `${lead.id}-won`,
    at: lead.wonAt || lead.revenueAt || lead.updatedAt,
    tone: 'green',
    label: 'Revenue',
    title: `Đã đăng ký học · ${formatCurrency(revenueAmount(lead), lead.dealCurrency || 'VND')}`,
    description: lead.dealPackage || 'Expected revenue đã chuyển thành revenue.',
    meta: lead.dealNote,
  });

  push(events, lead.status === LOST_LEAD_STATUS && {
    id: `${lead.id}-lost`,
    at: lead.updatedAt || lead.createdAt,
    tone: 'red',
    label: 'Mất lead',
    title: lead.lostReason || 'Mất lead',
    description: lead.lostNote || 'Lead đã được đánh dấu mất.',
  });

  for (const appointment of appointments) {
    push(events, {
      id: `appointment-${appointment.id}`,
      at: appointment.startTime,
      tone: appointment.status === 'done' ? 'green' : appointment.status === 'cancelled' ? 'red' : appointment.status === 'overdue' ? 'orange' : 'purple',
      label: appointment.type,
      title: `${appointment.type} · ${appointmentStatus(appointment.status)}`,
      description: appointment.notes || appointment.title,
      meta: appointment.assignedToName ? `PIC: ${appointment.assignedToName}` : undefined,
    });
  }

  for (const activity of activities) {
    push(events, {
      id: activity.id,
      at: activity.createdAt,
      tone: activity.type === 'status_change' ? 'purple' : activity.type === 'assignment' ? 'cyan' : activity.type === 'consultation' ? 'orange' : activity.type === 'call' ? 'blue' : 'gray',
      label: activity.type,
      title: activity.content,
      description: activity.type === 'call'
        ? [
          activity.callDirection ? `Hướng gọi: ${activity.callDirection}` : '',
          activity.callDurationSec ? `Thời lượng: ${activity.callDurationSec}s` : '',
          activity.recordingUrl ? 'Có ghi âm Stringee' : '',
        ].filter(Boolean).join(' · ')
        : undefined,
      meta: `${activity.createdBy} · ${formatDate(activity.createdAt, true)}`,
    });
  }

  return events.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}
