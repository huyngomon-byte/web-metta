import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Eye,
  ImagePlus,
  LayoutGrid,
  List,
  ListTodo,
  Phone,
  PhoneCall,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { CallRecordingButton } from '@/components/call/CallRecordingPlayer';
import { useCallCenter } from '@/context/CallCenterContext';
import { DEAL_QUOTED_STATUS, LOST_LEAD_STATUS, WON_LEAD_STATUS, leadStatuses } from '@/lib/constants';
import { expectedRevenueAmount, revenueAmount, type CourseDealSizeRule } from '@/lib/leadFinance';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useCourseCatalog } from '@/hooks/useCms';
import { useLeads } from '@/hooks/useLeads';
import { appointmentService } from '@/services/appointmentService';
import { callCenterService } from '@/services/callCenterService';
import { centerConfigService } from '@/services/centerConfigService';
import { leadService } from '@/services/leadService';
import { TASK_CATEGORIES, salesTaskService, type ManualTask, type TaskAssignee, type TaskCategory, type TaskPriority } from '@/services/salesTaskService';
import { userService } from '@/services/userService';
import type { CallLog } from '@/types/call';
import type { Appointment, Lead, LeadCenterConfig } from '@/types/crm';
import type { AdminUser } from '@/types/user';

type TaskType = 'follow_up' | 'appointment' | 'retry_call' | 'quote' | 'manual';
type TaskStatus = 'open' | 'done';
type ViewMode = 'list' | 'kanban';
type SortField = 'due' | 'priority';
type SortDirection = 'asc' | 'desc';
const MANUAL_TASK_PAGE_SIZE = 50;

type SalesTask = {
  id: string;
  type: TaskType;
  title: string;
  detail: string;
  dueAt: string;
  leadId?: string;
  leadName?: string;
  parentName?: string;
  phone?: string;
  assignedTo: string;
  assignedToName: string;
  assigneeIds: string[];
  assignees: TaskAssignee[];
  status: TaskStatus;
  priority: TaskPriority;
  category: TaskCategory;
  proofImages: string[];
  completedAt?: string;
  completedByName?: string;
  createdByName?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

const ACTIVE_STATUSES = leadStatuses.filter((status) => ![WON_LEAD_STATUS, LOST_LEAD_STATUS].includes(status));
const priorityWeight: Record<TaskPriority, number> = { high: 3, normal: 2, low: 1 };
const TASK_CATEGORY_LABELS = Object.fromEntries(TASK_CATEGORIES.map((item) => [item.value, item.label])) as Record<TaskCategory, string>;
const TASK_STATUS_LABELS: Record<TaskStatus, string> = { open: 'Đang mở', done: 'Hoàn thành' };
const MAX_TASK_PROOF_IMAGES = 6;

function taskCategoryLabel(category?: string) {
  return TASK_CATEGORY_LABELS[category as TaskCategory] || 'Telesales';
}

function makeTaskAssignees(assignedTo?: string, assignedToName?: string, proofImages: string[] = [], status: TaskStatus = 'open'): TaskAssignee[] {
  const id = String(assignedTo || '').trim();
  if (!id) return [];
  return [{
    id,
    name: String(assignedToName || assignedTo || '').trim(),
    proofImages,
    status,
  }];
}

function normalizeTaskAssignees(task: Pick<SalesTask, 'assignedTo' | 'assignedToName' | 'assigneeIds' | 'assignees' | 'proofImages' | 'status' | 'completedAt' | 'completedByName'>): TaskAssignee[] {
  const byId = new Map<string, TaskAssignee>();
  (task.assignees || []).forEach((item) => {
    const id = String(item.id || '').trim();
    if (!id) return;
    byId.set(id, {
      id,
      name: String(item.name || id).trim(),
      proofImages: Array.isArray(item.proofImages) ? item.proofImages.filter(Boolean) : [],
      status: item.status === 'done' ? 'done' : 'open',
      completedAt: item.completedAt,
      completedBy: item.completedBy,
      completedByName: item.completedByName,
    });
  });
  if (task.assignedTo && !byId.has(task.assignedTo)) {
    byId.set(task.assignedTo, {
      id: task.assignedTo,
      name: task.assignedToName || task.assignedTo,
      proofImages: task.proofImages || [],
      status: task.status,
      completedAt: task.completedAt,
      completedByName: task.completedByName,
    });
  }
  (task.assigneeIds || []).forEach((id) => {
    if (id && !byId.has(id)) byId.set(id, { id, name: id, proofImages: [], status: 'open' });
  });
  return Array.from(byId.values());
}

function taskProofCount(task: SalesTask) {
  const count = normalizeTaskAssignees(task).reduce((total, assignee) => total + assignee.proofImages.length, 0);
  return count || task.proofImages.length;
}

function taskDoneCount(task: SalesTask) {
  return normalizeTaskAssignees(task).filter((assignee) => assignee.status === 'done').length;
}

function taskAssigneeSummary(task: SalesTask) {
  const assignees = normalizeTaskAssignees(task);
  if (!assignees.length) return 'Chưa có sales';
  if (assignees.length === 1) return assignees[0].name || assignees[0].id;
  return `${assignees.length} sales`;
}

function canEditAssigneeProof(assigneeId: string, currentUserId?: string, canViewAll = false) {
  return canViewAll || assigneeId === currentUserId;
}

function percent(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function nowIso() {
  return new Date().toISOString();
}

function localInputValue(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (item: number) => String(item).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string) {
  return value ? new Date(value).toISOString() : '';
}

async function resizeTaskProof(file: File, maxWidth = 1280, quality = 0.72): Promise<string> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = imageUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Không đọc được ảnh minh chứng.'));
    });
    const ratio = Math.min(1, maxWidth / image.width);
    const width = Math.max(1, Math.round(image.width * ratio));
    const height = Math.max(1, Math.round(image.height * ratio));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function uploadTaskProofAsset(file: File): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (cloudName && uploadPreset) {
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', uploadPreset);
    form.append('folder', 'metta-task-proofs');
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) throw new Error('Upload ảnh minh chứng không thành công.');
    const data = await response.json() as { secure_url?: string };
    if (!data.secure_url) throw new Error('Không nhận được URL ảnh minh chứng.');
    return data.secure_url;
  }
  return resizeTaskProof(file);
}

function addHours(value: string, hours: number) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return nowIso();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function nextMorning(value: string) {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return nowIso();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date.toISOString();
}

function dateKey(value?: string) {
  return String(value || '').slice(0, 10);
}

function endOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);
  return date;
}

function startOfDay(value: Date) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function startOfWeek(value: Date) {
  const date = startOfDay(value);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return date;
}

function endOfWeek(value: Date) {
  const date = startOfWeek(value);
  date.setDate(date.getDate() + 6);
  return endOfDay(date);
}

function startOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(value: Date) {
  return new Date(value.getFullYear(), value.getMonth() + 1, 0, 23, 59, 59, 999);
}

function taskDueTone(dueAt: string) {
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  if (Number.isFinite(due) && due < now) return 'red';
  if (dateKey(dueAt) === dateKey(nowIso())) return 'orange';
  return 'blue';
}

function isNoAnswer(log: CallLog) {
  const text = `${log.disposition || ''} ${log.status || ''}`.toLowerCase();
  return text.includes('không nghe') || text.includes('khong nghe') || text.includes('missed') || text.includes('failed');
}

function leadName(lead?: Lead) {
  if (!lead) return '';
  return String(lead.studentName || lead.fullName || lead.parentName || lead.phone || '').trim();
}

function latestLeadCall(logs: CallLog[], leadId: string) {
  return logs
    .filter((log) => log.leadId === leadId)
    .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''))[0];
}

function retryDueAt(lead: Lead, logs: CallLog[]) {
  const leadLogs = logs.filter((log) => log.leadId === lead.id).sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
  const latest = leadLogs[0];
  if (!latest?.startedAt) return addHours(lead.updatedAt || lead.createdAt, 2);
  const noAnswerToday = leadLogs.filter((log) => dateKey(log.startedAt) === dateKey(latest.startedAt) && isNoAnswer(log)).length;
  return noAnswerToday >= 2 ? nextMorning(latest.startedAt) : addHours(latest.startedAt, 2);
}

function inferPriority(input: { type: TaskType; dueAt: string; lead?: Lead; warmth?: number; appointmentStatus?: Appointment['status'] }): TaskPriority {
  const dueMs = new Date(input.dueAt).getTime();
  const isOverdue = Number.isFinite(dueMs) && dueMs < Date.now();
  const isToday = dateKey(input.dueAt) === dateKey(nowIso());
  const leadPriority = Number(input.lead?.priorityLevel || 0);
  if (isOverdue || input.appointmentStatus === 'overdue' || input.type === 'retry_call' || leadPriority >= 5 || Number(input.warmth || 0) >= 70) return 'high';
  if (isToday || leadPriority >= 3 || input.type === 'quote' || input.type === 'appointment') return 'normal';
  return 'low';
}

function buildTasks(
  leads: Lead[],
  appointments: Appointment[],
  callLogs: CallLog[],
  manualTasks: ManualTask[],
  courseDealSizes?: readonly CourseDealSizeRule[],
): SalesTask[] {
  const tasks: SalesTask[] = [];
  const leadMap = new Map(leads.map((lead) => [lead.id, lead]));

  leads.forEach((lead) => {
    if (!ACTIVE_STATUSES.includes(lead.status)) return;
    const assignedTo = lead.assignedTo || '';
    const assignedToName = lead.assignedToName || lead.assignedTo || '';
    const displayName = leadName(lead);

    if (lead.followUpDate) {
      tasks.push({
        id: `follow-${lead.id}`,
        type: 'follow_up',
        title: `Gọi lại ${displayName}`,
        detail: lead.initialNote || 'Follow-up theo lịch đã lưu trên lead.',
        dueAt: lead.followUpDate,
        leadId: lead.id,
        leadName: displayName,
        parentName: lead.parentName,
        phone: lead.phone,
        assignedTo,
        assignedToName,
        assigneeIds: assignedTo ? [assignedTo] : [],
        assignees: makeTaskAssignees(assignedTo, assignedToName),
        status: 'open',
        priority: inferPriority({ type: 'follow_up', dueAt: lead.followUpDate, lead }),
        category: 'telesales',
        proofImages: [],
      });
    }

    if (lead.status === leadStatuses[2]) {
      const latest = latestLeadCall(callLogs, lead.id);
      const dueAt = retryDueAt(lead, callLogs);
      tasks.push({
        id: `retry-${lead.id}`,
        type: 'retry_call',
        title: `Gọi lại ${displayName}`,
        detail: latest ? `Last call: ${formatDate(latest.startedAt, true)}${latest.durationSec ? ` · ${latest.durationSec}s` : ''}` : 'Chưa có call log, ưu tiên gọi thử lần đầu.',
        dueAt,
        leadId: lead.id,
        leadName: displayName,
        parentName: lead.parentName,
        phone: lead.phone,
        assignedTo,
        assignedToName,
        assigneeIds: assignedTo ? [assignedTo] : [],
        assignees: makeTaskAssignees(assignedTo, assignedToName),
        status: 'open',
        priority: inferPriority({ type: 'retry_call', dueAt, lead }),
        category: 'telesales',
        proofImages: [],
      });
    }

    if (lead.status === DEAL_QUOTED_STATUS) {
      const dueAt = lead.expectedCloseDate || addHours(lead.updatedAt || lead.createdAt, 24);
      tasks.push({
        id: `quote-${lead.id}`,
        type: 'quote',
        title: `Follow báo phí / chờ chốt`,
        detail: `${lead.pendingReason || 'Chưa có lý do pending'} · Expected ${formatCurrency(expectedRevenueAmount(lead, courseDealSizes), lead.dealCurrency)}`,
        dueAt,
        leadId: lead.id,
        leadName: displayName,
        parentName: lead.parentName,
        phone: lead.phone,
        assignedTo,
        assignedToName,
        assigneeIds: assignedTo ? [assignedTo] : [],
        assignees: makeTaskAssignees(assignedTo, assignedToName),
        status: 'open',
        priority: inferPriority({ type: 'quote', dueAt, lead, warmth: lead.pendingWarmthPercent }),
        category: 'telesales',
        proofImages: [],
      });
    }
  });

  appointments.filter((item) => item.status === 'upcoming' || item.status === 'overdue').forEach((item) => {
    const lead = item.leadId ? leadMap.get(item.leadId) : undefined;
    tasks.push({
      id: `appointment-${item.id}`,
      type: 'appointment',
      title: item.title,
      detail: `${item.type} · ${item.notes || 'Không có note'}`,
      dueAt: item.startTime,
      leadId: item.leadId,
      leadName: leadName(lead) || item.title.replace(/\s*-\s*0\d+.*$/, ''),
      parentName: lead?.parentName,
      phone: lead?.phone || item.title.match(/0\d{8,}/)?.[0],
      assignedTo: item.assignedTo,
      assignedToName: item.assignedToName || item.assignedTo,
      assigneeIds: item.assignedTo ? [item.assignedTo] : [],
      assignees: makeTaskAssignees(item.assignedTo, item.assignedToName || item.assignedTo),
      status: 'open',
      priority: inferPriority({ type: 'appointment', dueAt: item.startTime, lead, appointmentStatus: item.status }),
      category: 'center_consulting',
      proofImages: [],
    });
  });

  manualTasks.forEach((item) => {
    const lead = item.leadId ? leadMap.get(item.leadId) : undefined;
    tasks.push({
      id: item.id,
      type: 'manual',
      title: item.title,
      detail: item.notes,
      dueAt: item.dueAt,
      leadId: item.leadId,
      leadName: leadName(lead) || item.leadId,
      parentName: lead?.parentName,
      phone: lead?.phone,
      assignedTo: item.assignedTo,
      assignedToName: item.assignedToName,
      assigneeIds: item.assigneeIds || (item.assignedTo ? [item.assignedTo] : []),
      assignees: item.assignees || makeTaskAssignees(item.assignedTo, item.assignedToName, item.proofImages || [], item.status),
      status: item.status,
      priority: item.priority,
      category: item.category || 'telesales',
      proofImages: item.proofImages || [],
      completedAt: item.completedAt,
      completedByName: item.completedByName,
      createdBy: item.createdBy,
      createdByName: item.createdByName,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  });

  return tasks;
}

function isTaskInDatePreset(task: SalesTask, datePreset: string, dateFrom: string, dateTo: string) {
  if (datePreset === 'all') return true;
  const due = new Date(task.dueAt);
  if (Number.isNaN(due.getTime())) return false;
  const now = new Date();
  const dueMs = due.getTime();
  if (datePreset === 'today') return dateKey(task.dueAt) === dateKey(nowIso());
  if (datePreset === 'tomorrow') {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return dateKey(task.dueAt) === dateKey(tomorrow.toISOString());
  }
  if (datePreset === 'this_week') return due >= startOfWeek(now) && due <= endOfWeek(now);
  if (datePreset === 'this_month') return due >= startOfMonth(now) && due <= endOfMonth(now);
  if (datePreset === 'overdue') return dueMs < Date.now() && task.status === 'open';
  if (datePreset === 'upcoming') return dueMs >= Date.now() && task.status === 'open';
  if (datePreset === 'range') {
    const fromOk = !dateFrom || dateKey(task.dueAt) >= dateFrom;
    const toOk = !dateTo || dateKey(task.dueAt) <= dateTo;
    return fromOk && toOk;
  }
  return true;
}

function dueBucket(task: SalesTask) {
  const due = new Date(task.dueAt);
  if (task.status === 'done') return 'done';
  if (Number.isNaN(due.getTime())) return 'later';
  if (due.getTime() < Date.now()) return 'overdue';
  if (dateKey(task.dueAt) === dateKey(nowIso())) return 'today';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateKey(task.dueAt) === dateKey(tomorrow.toISOString())) return 'tomorrow';
  if (due <= endOfWeek(new Date())) return 'week';
  return 'later';
}

export default function SalesTasksPage() {
  const { user } = useAuth();
  const { startOutboundCall } = useCallCenter();
  const { leads, refresh: refreshLeads, loadMore, hasMore, loadingMore } = useLeads({
    realtime: false,
    mode: 'paged',
    pageSize: 100,
    sinceDays: 30,
  });
  const { courseDealSizes } = useCourseCatalog();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [centerConfigs, setCenterConfigs] = useState<LeadCenterConfig[]>([]);
  const [manualTasks, setManualTasks] = useState<ManualTask[]>([]);
  const [manualTaskHasMore, setManualTaskHasMore] = useState(false);
  const [manualTaskLoadingMore, setManualTaskLoadingMore] = useState(false);
  const [quickTaskBusy, setQuickTaskBusy] = useState(false);
  const [quickTaskError, setQuickTaskError] = useState('');
  const [taskActionError, setTaskActionError] = useState('');
  const [taskBusyId, setTaskBusyId] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [sales, setSales] = useState('');
  const [priority, setPriority] = useState('');
  const [datePreset, setDatePreset] = useState('today');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [view, setView] = useState<ViewMode>('list');
  const [sortField, setSortField] = useState<SortField>('due');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [activeLeadId, setActiveLeadId] = useState('');
  const [draft, setDraft] = useState({
    title: '',
    notes: '',
    dueAt: localInputValue(addHours(nowIso(), 2)),
    assigneeIds: [] as string[],
    leadIds: [] as string[],
    priority: 'normal' as TaskPriority,
    category: 'telesales' as TaskCategory,
  });
  const [activeTaskId, setActiveTaskId] = useState('');

  const canViewAll = Boolean(user && ['admin', 'manager'].includes(user.role));

  async function refresh() {
    const [nextLogs, nextUsers] = await Promise.all([
      callCenterService.getLogs().catch(() => []),
      userService.getUsers().catch(() => []),
    ]);
    setCallLogs(nextLogs);
    setUsers(nextUsers);
  }

  useEffect(() => {
    void refresh();
    centerConfigService.getConfigs().then(setCenterConfigs).catch(() => setCenterConfigs([]));
    const applyManualTasks = (tasks: ManualTask[]) => {
      setManualTasks(tasks);
      setManualTaskHasMore(tasks.length >= MANUAL_TASK_PAGE_SIZE);
    };
    const unsubAppointments = appointmentService.subscribeAppointments(setAppointments, () => {
      void appointmentService.getAppointments().then(setAppointments).catch(() => {});
    });
    const unsubTasks = salesTaskService.subscribeTasks(applyManualTasks, () => {
      void salesTaskService.getTasks().then(applyManualTasks).catch(() => {});
    });
    const onUpdate = () => void refresh();
    window.addEventListener('metta-call-logs-updated', onUpdate);
    return () => {
      unsubAppointments();
      unsubTasks();
      window.removeEventListener('metta-call-logs-updated', onUpdate);
    };
  }, []);

  const salesOptions = useMemo(() => users.filter((item) => item.role === 'sales' && item.active), [users]);
  const taskAssigneeOptions = useMemo(() => {
    if (canViewAll) return salesOptions;
    return user?.role === 'sales' && user.active ? [user] : [];
  }, [canViewAll, salesOptions, user]);
  const defaultTaskAssigneeId = taskAssigneeOptions[0]?.id || '';
  useEffect(() => {
    setDraft((item) => {
      if (!defaultTaskAssigneeId) return item;
      const validIds = item.assigneeIds.filter((id) => taskAssigneeOptions.some((option) => option.id === id));
      if (validIds.length) return validIds.length === item.assigneeIds.length ? item : { ...item, assigneeIds: validIds };
      return { ...item, assigneeIds: [defaultTaskAssigneeId] };
    });
  }, [defaultTaskAssigneeId, taskAssigneeOptions]);
  const leadOptions = useMemo(() => ({
    sources: Array.from(new Set(leads.map((lead) => lead.source).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi')),
    centers: centerConfigs.filter((center) => center.active).map((center) => center.name).filter(Boolean),
    courses: Array.from(new Set(leads.map((lead) => lead.interestedCourse || '').filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi')),
  }), [centerConfigs, leads]);
  const allTasks = useMemo(() => buildTasks(leads, appointments, callLogs, manualTasks, courseDealSizes), [appointments, callLogs, courseDealSizes, leads, manualTasks]);
  const activeTask = useMemo(() => allTasks.find((task) => task.id === activeTaskId), [activeTaskId, allTasks]);
  const filteredTasks = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return allTasks.filter((task) => {
      const assignees = normalizeTaskAssignees(task);
      const assigneeIds = assignees.map((assignee) => assignee.id);
      const assigneeNames = assignees.map((assignee) => assignee.name);
      if (!canViewAll && !assigneeIds.includes(user?.id || '') && task.assignedTo !== user?.id) return false;
      if (sales && !assigneeIds.includes(sales) && task.assignedTo !== sales && task.assignedToName !== sales) return false;
      if (status && task.status !== status) return false;
      if (type && task.type !== type && task.category !== type) return false;
      if (priority && task.priority !== priority) return false;
      if (!isTaskInDatePreset(task, datePreset, dateFrom, dateTo)) return false;
      if (keyword && !`${task.title} ${task.detail} ${taskCategoryLabel(task.category)} ${task.leadName || ''} ${task.parentName || ''} ${task.phone || ''} ${task.assignedToName} ${assigneeNames.join(' ')}`.toLowerCase().includes(keyword)) return false;
      return true;
    });
  }, [allTasks, canViewAll, dateFrom, datePreset, dateTo, priority, query, sales, status, type, user?.id]);
  const visibleTasks = useMemo(() => {
    return [...filteredTasks].sort((a, b) => {
      const multiplier = sortDirection === 'asc' ? 1 : -1;
      if (sortField === 'priority') {
        const diff = priorityWeight[a.priority] - priorityWeight[b.priority];
        if (diff) return diff * multiplier;
      }
      const diff = new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      if (Number.isFinite(diff) && diff) return diff * multiplier;
      return a.title.localeCompare(b.title, 'vi');
    });
  }, [filteredTasks, sortDirection, sortField]);
  const activeLead = useMemo(() => leads.find((lead) => lead.id === activeLeadId), [activeLeadId, leads]);

  const metrics = useMemo(() => {
    const open = filteredTasks.filter((task) => task.status === 'open');
    const today = open.filter((task) => dateKey(task.dueAt) === dateKey(nowIso()));
    const overdue = open.filter((task) => new Date(task.dueAt).getTime() < Date.now());
    const high = open.filter((task) => task.priority === 'high');
    return { open: open.length, today: today.length, overdue: overdue.length, high: high.length };
  }, [filteredTasks]);

  const report = useMemo(() => {
    const total = filteredTasks.length;
    const done = filteredTasks.filter((task) => task.status === 'done').length;
    const bySales = new Map<string, { id: string; label: string; total: number; open: number; done: number }>();
    const byCategory = new Map<string, { id: string; label: string; total: number; open: number; done: number }>();
    const byStatus = new Map<TaskStatus, { id: TaskStatus; label: string; total: number }>();

    filteredTasks.forEach((task) => {
      const assignees = normalizeTaskAssignees(task);
      (assignees.length ? assignees : [{ id: 'unassigned', name: 'Chưa có sales', proofImages: [], status: task.status }]).forEach((assignee) => {
        const salesId = assignee.id || 'unassigned';
        const salesLabel = assignee.name || salesId;
        const salesItem = bySales.get(salesId) || { id: salesId, label: salesLabel, total: 0, open: 0, done: 0 };
        salesItem.total += 1;
        salesItem[assignee.status] += 1;
        bySales.set(salesId, salesItem);
      });

      const categoryId = task.category || 'telesales';
      const categoryItem = byCategory.get(categoryId) || { id: categoryId, label: taskCategoryLabel(categoryId), total: 0, open: 0, done: 0 };
      categoryItem.total += 1;
      categoryItem[task.status] += 1;
      byCategory.set(categoryId, categoryItem);

      const statusItem = byStatus.get(task.status) || { id: task.status, label: TASK_STATUS_LABELS[task.status], total: 0 };
      statusItem.total += 1;
      byStatus.set(task.status, statusItem);
    });

    return {
      total,
      done,
      open: total - done,
      completionRate: percent(done, total),
      bySales: Array.from(bySales.values()).sort((a, b) => b.total - a.total),
      byCategory: Array.from(byCategory.values()).sort((a, b) => b.total - a.total),
      byStatus: Array.from(byStatus.values()).sort((a, b) => b.total - a.total),
    };
  }, [filteredTasks]);

  function cycleSort(field: SortField) {
    if (sortField === field) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
    else {
      setSortField(field);
      setSortDirection(field === 'priority' ? 'desc' : 'asc');
    }
  }

  async function loadMoreManualTasks() {
    if (manualTaskLoadingMore || !manualTaskHasMore) return;
    const cursorUpdatedAt = manualTasks[manualTasks.length - 1]?.updatedAt;
    if (!cursorUpdatedAt) return;
    setManualTaskLoadingMore(true);
    try {
      const page = await salesTaskService.getTasksPage({ pageSize: MANUAL_TASK_PAGE_SIZE, cursorUpdatedAt });
      setManualTasks((current) => {
        const byId = new Map(current.map((task) => [task.id, task]));
        page.forEach((task) => byId.set(task.id, task));
        return Array.from(byId.values()).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
      });
      setManualTaskHasMore(page.length >= MANUAL_TASK_PAGE_SIZE);
    } finally {
      setManualTaskLoadingMore(false);
    }
  }

  async function saveManualTask() {
    setQuickTaskError('');
    if (!draft.title.trim()) return setQuickTaskError('Vui lòng nhập nội dung task.');
    if (!draft.dueAt) return setQuickTaskError('Vui lòng chọn hạn xử lý.');
    const assignedUsers = draft.assigneeIds
      .map((id) => taskAssigneeOptions.find((item) => item.id === id))
      .filter(Boolean) as AdminUser[];
    if (!assignedUsers.length) return setQuickTaskError('Vui lòng chọn ít nhất 1 sales phụ trách task.');

    setQuickTaskBusy(true);
    try {
      const timestamp = nowIso();
      const leadIds = draft.leadIds.length ? draft.leadIds : [''];
      const primaryAssignee = assignedUsers[0];
      const tasks = leadIds.map((leadId, index) => ({
        id: `task-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        title: draft.title.trim(),
        notes: draft.notes.trim(),
        dueAt: fromLocalInput(draft.dueAt),
        assignedTo: primaryAssignee.id,
        assignedToName: primaryAssignee.fullName,
        assigneeIds: assignedUsers.map((item) => item.id),
        assignees: assignedUsers.map((item) => ({
          id: item.id,
          name: item.fullName,
          proofImages: [],
          status: 'open' as TaskStatus,
        })),
        leadId,
        category: draft.category,
        priority: draft.priority,
        status: 'open' as TaskStatus,
        proofImages: [],
        createdAt: timestamp,
        updatedAt: timestamp,
        createdBy: user?.id || '',
        createdByName: user?.fullName || '',
      }));
      const next = await salesTaskService.saveTasks(tasks);
      setManualTasks(next);
      setDraft({
        title: '',
        notes: '',
        dueAt: localInputValue(addHours(nowIso(), 2)),
        assigneeIds: assignedUsers.map((item) => item.id),
        leadIds: [],
        priority: 'normal',
        category: draft.category,
      });
    } catch (error) {
      setQuickTaskError(error instanceof Error ? error.message : 'Không tạo được task.');
    } finally {
      setQuickTaskBusy(false);
    }
  }

  async function updateManual(id: string, patch: Partial<ManualTask>) {
    setManualTasks(await salesTaskService.updateTask(id, patch));
  }

  async function addProofImages(task: SalesTask, assigneeId: string, files: FileList | File[]) {
    if (task.type !== 'manual') return;
    setTaskActionError('');
    const selected = Array.from(files).filter((file) => file.type.startsWith('image/'));
    if (!selected.length) return;
    const assignee = normalizeTaskAssignees(task).find((item) => item.id === assigneeId);
    const currentImages = assignee?.proofImages || [];
    const slots = Math.max(0, MAX_TASK_PROOF_IMAGES - currentImages.length);
    if (!slots) {
      setTaskActionError('Task này đã đủ số ảnh minh chứng tối đa.');
      return;
    }
    setTaskBusyId(task.id);
    try {
      const urls = await Promise.all(selected.slice(0, slots).map(uploadTaskProofAsset));
      await updateManual(task.id, { assigneeId, proofImages: [...currentImages, ...urls] } as Partial<ManualTask> & { assigneeId: string });
    } catch (error) {
      setTaskActionError(error instanceof Error ? error.message : 'Không upload được ảnh minh chứng.');
    } finally {
      setTaskBusyId('');
    }
  }

  async function removeProofImage(task: SalesTask, assigneeId: string, index: number) {
    if (task.type !== 'manual') return;
    setTaskActionError('');
    setTaskBusyId(task.id);
    try {
      const assignee = normalizeTaskAssignees(task).find((item) => item.id === assigneeId);
      await updateManual(task.id, { assigneeId, proofImages: (assignee?.proofImages || []).filter((_, itemIndex) => itemIndex !== index) } as Partial<ManualTask> & { assigneeId: string });
    } catch (error) {
      setTaskActionError(error instanceof Error ? error.message : 'Không xóa được ảnh minh chứng.');
    } finally {
      setTaskBusyId('');
    }
  }

  async function completeManualTask(task: SalesTask, assigneeId: string) {
    if (task.type !== 'manual') return;
    setTaskActionError('');
    const assignee = normalizeTaskAssignees(task).find((item) => item.id === assigneeId);
    if (!assignee?.proofImages?.length) {
      setTaskActionError('Sales cần upload ít nhất 1 ảnh minh chứng trước khi xác nhận hoàn thành task.');
      return;
    }
    setTaskBusyId(task.id);
    try {
      await updateManual(task.id, {
        assigneeId,
        status: 'done',
        completedAt: nowIso(),
        completedBy: user?.id || '',
        completedByName: user?.fullName || '',
      } as Partial<ManualTask> & { assigneeId: string });
    } catch (error) {
      setTaskActionError(error instanceof Error ? error.message : 'Không xác nhận hoàn thành task.');
    } finally {
      setTaskBusyId('');
    }
  }

  async function deleteManual(id: string) {
    setManualTasks(await salesTaskService.deleteTask(id));
  }

  async function saveLeadFromModal(lead: Lead) {
    await leadService.saveLead({ ...lead, fullName: leadName(lead) || lead.fullName, updatedAt: nowIso() });
    await refreshLeads();
    await refresh();
  }

  async function callLeadFromModal(lead: Lead) {
    await startOutboundCall(lead);
    await refresh();
  }

  const groupedTasks = useMemo(() => {
    const groups: Record<string, SalesTask[]> = { overdue: [], today: [], tomorrow: [], week: [], later: [], done: [] };
    visibleTasks.forEach((task) => groups[dueBucket(task)].push(task));
    return groups;
  }, [visibleTasks]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-950">Task Management</h1>
        <p className="text-slate-500">Follow-up, reminder và to-do hằng ngày cho team Sales.</p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-7">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={18} />
            <Input className="pl-10" placeholder="Tìm task, lead, phụ huynh, SĐT..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>
          <Select value={datePreset} onChange={(event) => setDatePreset(event.target.value)}>
            <option value="today">Hôm nay</option>
            <option value="tomorrow">Ngày mai</option>
            <option value="this_week">Tuần này</option>
            <option value="this_month">Tháng này</option>
            <option value="range">Khoảng ngày</option>
            <option value="overdue">Quá hạn</option>
            <option value="upcoming">Sắp tới</option>
            <option value="all">Tất cả thời gian</option>
          </Select>
          <Select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Tất cả trạng thái</option>
            <option value="open">Đang mở</option>
            <option value="done">Đã xong</option>
          </Select>
          <Select value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">Tất cả nhóm công việc</option>
            {TASK_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            <option value="follow_up">Auto: Follow-up</option>
            <option value="retry_call">Auto: Gọi lại</option>
            <option value="quote">Auto: Báo giá/chốt</option>
            <option value="appointment">Auto: Lịch hẹn</option>
            <option value="manual">Task tự tạo</option>
          </Select>
          <Select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="">Tất cả priority</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </Select>
          {canViewAll && (
            <Select value={sales} onChange={(event) => setSales(event.target.value)}>
              <option value="">Tất cả sales</option>
              {salesOptions.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
            </Select>
          )}
          {datePreset === 'range' && (
            <>
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
            </>
          )}
          <div className="flex rounded-lg border border-slate-200 bg-white p-1 xl:col-start-7">
            <Button type="button" size="sm" variant={view === 'list' ? 'secondary' : 'ghost'} onClick={() => setView('list')} aria-label="List view"><List size={16} /> List</Button>
            <Button type="button" size="sm" variant={view === 'kanban' ? 'secondary' : 'ghost'} onClick={() => setView('kanban')} aria-label="Kanban view"><LayoutGrid size={16} /> Kanban</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <MetricCard label="Task mở" value={metrics.open} />
        <MetricCard label="Đến hạn hôm nay" value={metrics.today} tone="blue" />
        <MetricCard label="Quá hạn" value={metrics.overdue} tone="red" />
        <MetricCard label="Ưu tiên cao" value={metrics.high} tone="orange" />
      </div>

      <TaskReportCard report={report} canViewAll={canViewAll} />

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus size={18} /> Tạo to-do nhanh</CardTitle></CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[1.1fr_210px_minmax(260px,1fr)_210px_180px_150px_auto]">
          <Input placeholder="Ví dụ: Seeding 5 nhóm hàng ngày" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <Select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as TaskCategory })}>
            {TASK_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
          <LeadMultiSelect leads={leads} selectedIds={draft.leadIds} onChange={(leadIds) => setDraft({ ...draft, leadIds })} />
          <Input type="datetime-local" value={draft.dueAt} onChange={(event) => setDraft({ ...draft, dueAt: event.target.value })} />
          <SalesMultiSelect
            salesOptions={taskAssigneeOptions}
            selectedIds={draft.assigneeIds}
            disabled={!canViewAll}
            onChange={(assigneeIds) => setDraft({ ...draft, assigneeIds })}
          />
          <Select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as TaskPriority })}>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="low">Low</option>
          </Select>
          <Button onClick={() => void saveManualTask()} disabled={quickTaskBusy || !taskAssigneeOptions.length}><Plus /> {quickTaskBusy ? 'Đang thêm' : 'Thêm'}</Button>
          <Textarea className="lg:col-span-7" rows={2} placeholder="Note chi tiết: yêu cầu, địa điểm, nội dung seeding, checklist ảnh minh chứng..." value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
          {quickTaskError && <p className="lg:col-span-7 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{quickTaskError}</p>}
          {hasMore && (
            <div className="lg:col-span-7">
              <Button type="button" variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>
                <RefreshCcw className={loadingMore ? 'animate-spin' : ''} /> {loadingMore ? 'Đang tải thêm lead' : 'Tải thêm lead cho task'}
              </Button>
            </div>
          )}
          {manualTaskHasMore && (
            <div className="lg:col-span-7">
              <Button type="button" variant="outline" onClick={() => void loadMoreManualTasks()} disabled={manualTaskLoadingMore}>
                <RefreshCcw className={manualTaskLoadingMore ? 'animate-spin' : ''} /> {manualTaskLoadingMore ? 'Đang tải thêm task' : 'Tải thêm manual task'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ListTodo size={18} /> Danh sách task</CardTitle>
        </CardHeader>
        <CardContent>
          {taskActionError && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{taskActionError}</p>}
          {view === 'list' ? (
            <TaskTable
              tasks={visibleTasks}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={cycleSort}
              onOpenLead={setActiveLeadId}
              onOpenTask={setActiveTaskId}
              onDelete={(id) => void deleteManual(id)}
              busyTaskId={taskBusyId}
            />
          ) : (
            <TaskKanban
              groups={groupedTasks}
              onOpenLead={setActiveLeadId}
              onOpenTask={setActiveTaskId}
              onDelete={(id) => void deleteManual(id)}
              busyTaskId={taskBusyId}
            />
          )}
        </CardContent>
      </Card>

      {activeLead && (
        <TaskLeadModal
          lead={activeLead}
          callLogs={callLogs.filter((log) => log.leadId === activeLead.id)}
          salesOptions={salesOptions}
          sourceOptions={leadOptions.sources}
          centerOptions={leadOptions.centers}
          courseOptions={leadOptions.courses}
          courseDealSizes={courseDealSizes}
          busy={false}
          onClose={() => setActiveLeadId('')}
          onSave={saveLeadFromModal}
          onCall={callLeadFromModal}
        />
      )}

      {activeTask && (
        <TaskDetailModal
          task={activeTask}
          leads={leads}
          salesOptions={taskAssigneeOptions}
          canViewAll={canViewAll}
          currentUserId={user?.id || ''}
          busy={taskBusyId === activeTask.id}
          onClose={() => setActiveTaskId('')}
          onSave={(id, patch) => updateManual(id, patch)}
          onDelete={(id) => {
            void deleteManual(id);
            setActiveTaskId('');
          }}
          onOpenLead={setActiveLeadId}
          onAddProof={(task, assigneeId, files) => void addProofImages(task, assigneeId, files)}
          onRemoveProof={(task, assigneeId, index) => void removeProofImage(task, assigneeId, index)}
          onComplete={(task, assigneeId) => void completeManualTask(task, assigneeId)}
        />
      )}
    </div>
  );
}

function SalesMultiSelect({
  salesOptions,
  selectedIds,
  disabled = false,
  onChange,
}: {
  salesOptions: AdminUser[];
  selectedIds: string[];
  disabled?: boolean;
  onChange: (salesIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedSales = useMemo(() => selectedIds.map((id) => salesOptions.find((item) => item.id === id)).filter(Boolean) as AdminUser[], [salesOptions, selectedIds]);

  function toggleSales(id: string) {
    if (disabled) return;
    onChange(selectedSet.has(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  }

  const summary = selectedSales.length
    ? selectedSales.length === 1
      ? selectedSales[0].fullName
      : `${selectedSales.length} sales đã chọn`
    : 'Chọn sales';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((value) => !value)}
        disabled={disabled}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-left text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 focus:border-[#003B7A] focus:outline-none focus:ring-2 focus:ring-[#003B7A]/15 disabled:bg-slate-50 disabled:text-slate-500"
      >
        <span className={`truncate ${selectedSales.length ? 'text-slate-900' : 'text-slate-400'}`}>{summary}</span>
        <Users size={16} className="shrink-0 text-slate-400" />
      </button>
      {selectedSales.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {selectedSales.slice(0, 3).map((item) => (
            <span key={item.id} className="inline-flex max-w-[160px] items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
              <span className="truncate">{item.fullName}</span>
              {!disabled && (
                <button type="button" onClick={() => toggleSales(item.id)} aria-label="Bỏ chọn sales">
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
          {selectedSales.length > 3 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">+{selectedSales.length - 3}</span>}
        </div>
      )}
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="max-h-72 overflow-y-auto p-1">
            {salesOptions.map((item) => {
              const checked = selectedSet.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleSales(item.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50 ${checked ? 'bg-blue-50' : ''}`}
                >
                  <input type="checkbox" checked={checked} readOnly />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold text-slate-900">{item.fullName}</span>
                    <span className="block truncate text-xs text-slate-500">{item.email}</span>
                  </span>
                </button>
              );
            })}
            {!salesOptions.length && <p className="py-6 text-center text-xs font-semibold text-slate-400">Chưa có sales active.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function LeadMultiSelect({
  leads,
  selectedIds,
  onChange,
}: {
  leads: Lead[];
  selectedIds: string[];
  onChange: (leadIds: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedLeads = useMemo(() => selectedIds.map((id) => leads.find((lead) => lead.id === id)).filter(Boolean) as Lead[], [leads, selectedIds]);
  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return [...leads]
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .filter((lead) => {
        if (!keyword) return true;
        return `${lead.id} ${leadName(lead)} ${lead.parentName || ''} ${lead.phone || ''} ${lead.assignedToName || ''}`.toLowerCase().includes(keyword);
      })
      .slice(0, 80);
  }, [leads, search]);

  function toggleLead(id: string) {
    onChange(selectedSet.has(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  }

  function selectFiltered() {
    onChange(Array.from(new Set([...selectedIds, ...filtered.map((lead) => lead.id)])));
  }

  const summary = selectedLeads.length
    ? selectedLeads.length === 1
      ? leadName(selectedLeads[0]) || selectedLeads[0].phone || selectedLeads[0].id
      : `${selectedLeads.length} lead đã chọn`
    : 'Chọn lead để link task';

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 text-left text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 focus:border-[#003B7A] focus:outline-none focus:ring-2 focus:ring-[#003B7A]/15"
      >
        <span className={`truncate ${selectedLeads.length ? 'text-slate-900' : 'text-slate-400'}`}>{summary}</span>
        <span className="text-xs font-extrabold text-slate-400">{selectedLeads.length || ''}</span>
      </button>
      {selectedLeads.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {selectedLeads.slice(0, 3).map((lead) => (
            <span key={lead.id} className="inline-flex max-w-[170px] items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700">
              <span className="truncate">{leadName(lead) || lead.phone || lead.id}</span>
              <button type="button" onClick={() => toggleLead(lead.id)} aria-label="Bỏ chọn lead">
                <X size={12} />
              </button>
            </span>
          ))}
          {selectedLeads.length > 3 && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">+{selectedLeads.length - 3}</span>}
        </div>
      )}
      {open && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 text-slate-400" size={15} />
              <Input className="h-9 pl-8" placeholder="Tìm tên / SĐT / ID lead" value={search} onChange={(event) => setSearch(event.target.value)} autoFocus />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <button type="button" className="text-xs font-bold text-[#003B7A] hover:underline" onClick={selectFiltered}>
                Chọn tất cả kết quả
              </button>
              <button type="button" className="text-xs font-bold text-slate-500 hover:text-slate-800" onClick={() => onChange([])}>
                Bỏ chọn
              </button>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {filtered.map((lead) => {
              const checked = selectedSet.has(lead.id);
              return (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => toggleLead(lead.id)}
                  className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left hover:bg-slate-50 ${checked ? 'bg-blue-50' : ''}`}
                >
                  <input className="mt-1" type="checkbox" checked={checked} readOnly />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-extrabold text-slate-900">{leadName(lead) || lead.phone || lead.id}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {lead.parentName ? `PH: ${lead.parentName} · ` : ''}{lead.phone || '-'} · {lead.assignedToName || 'Chưa có sales'}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-400">{lead.id}</span>
                  </span>
                </button>
              );
            })}
            {!filtered.length && <p className="py-6 text-center text-xs font-semibold text-slate-400">Không tìm thấy lead.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

function TaskProofPanel({
  proofImages,
  busy,
  compact = false,
  disabled = false,
  onAddProof,
  onRemoveProof,
}: {
  proofImages: string[];
  busy: boolean;
  compact?: boolean;
  disabled?: boolean;
  onAddProof: (files: FileList | File[]) => void;
  onRemoveProof: (index: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canAddMore = !disabled && proofImages.length < MAX_TASK_PROOF_IMAGES;
  return (
    <div className={`w-full ${compact ? '' : 'min-w-[260px]'}`}>
      <div className="flex flex-wrap gap-2">
        {proofImages.map((src, index) => (
          <div key={`${src}-${index}`} className={`${compact ? 'h-12 w-12' : 'h-20 w-20'} group relative overflow-hidden rounded-md border border-slate-200 bg-slate-100`}>
            <a href={src} target="_blank" rel="noreferrer" title="Mở ảnh minh chứng">
              <img src={src} alt={`Ảnh minh chứng ${index + 1}`} className="h-full w-full object-cover" />
            </a>
            {!disabled && (
              <button
                type="button"
                onClick={() => onRemoveProof(index)}
                className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                aria-label="Xóa ảnh minh chứng"
              >
                <X size={10} />
              </button>
            )}
          </div>
        ))}
        {canAddMore && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="flex h-12 w-12 items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-slate-500 transition hover:border-[#003B7A] hover:text-[#003B7A] disabled:opacity-50"
            title="Upload ảnh minh chứng"
          >
            {busy ? <RefreshCcw size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files?.length) onAddProof(event.target.files);
          event.target.value = '';
        }}
      />
      {!compact && !disabled && (
        <p className="mt-1 text-[11px] font-semibold text-slate-400">
          Cần ít nhất 1 ảnh để xác nhận hoàn thành.
        </p>
      )}
      {!proofImages.length && disabled && (
        <p className="rounded-lg border border-dashed border-slate-200 py-5 text-center text-xs font-semibold text-slate-400">Chưa có ảnh minh chứng.</p>
      )}
    </div>
  );
}

type ReportGroup = { id: string; label: string; total: number; open?: number; done?: number };

function TaskReportCard({
  report,
  canViewAll,
}: {
  report: {
    total: number;
    done: number;
    open: number;
    completionRate: number;
    bySales: ReportGroup[];
    byCategory: ReportGroup[];
    byStatus: Array<{ id: TaskStatus; label: string; total: number }>;
  };
  canViewAll: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 size={18} /> {canViewAll ? 'Báo cáo task team Sales' : 'Báo cáo task cá nhân'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <ReportMetric label="Tổng task" value={report.total} />
          <ReportMetric label="Đang mở" value={report.open} tone="blue" />
          <ReportMetric label="Hoàn thành" value={report.done} tone="green" />
          <ReportMetric label="Tỷ lệ hoàn thành" value={`${report.completionRate}%`} tone="orange" />
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <ReportBreakdown title="Theo sales" rows={report.bySales} total={report.total} showCompletion />
          <ReportBreakdown title="Theo nhóm công việc" rows={report.byCategory} total={report.total} showCompletion />
          <ReportBreakdown title="Theo trạng thái" rows={report.byStatus.map((item) => ({ ...item, open: item.id === 'open' ? item.total : 0, done: item.id === 'done' ? item.total : 0 }))} total={report.total} />
        </div>
      </CardContent>
    </Card>
  );
}

function ReportMetric({ label, value, tone = 'slate' }: { label: string; value: number | string; tone?: 'slate' | 'blue' | 'green' | 'orange' }) {
  const toneClass = {
    slate: 'text-slate-950',
    blue: 'text-blue-700',
    green: 'text-emerald-700',
    orange: 'text-orange-600',
  }[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold ${toneClass}`}>{value}</p>
    </div>
  );
}

function ReportBreakdown({ title, rows, total, showCompletion = false }: { title: string; rows: ReportGroup[]; total: number; showCompletion?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <p className="mb-3 text-xs font-extrabold uppercase text-slate-500">{title}</p>
      <div className="space-y-3">
        {rows.slice(0, 8).map((row) => {
          const share = percent(row.total, total);
          const completion = percent(row.done || 0, row.total);
          return (
            <div key={row.id}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate font-bold text-slate-800">{row.label}</span>
                <span className="shrink-0 text-xs font-extrabold text-slate-500">{row.total} task · {share}%</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-[#003B7A]" style={{ width: `${share}%` }} />
              </div>
              {showCompletion && (
                <p className="mt-1 text-[11px] font-semibold text-slate-500">
                  Mở {row.open || 0} · Hoàn thành {row.done || 0} · Tỷ lệ xong {completion}%
                </p>
              )}
            </div>
          );
        })}
        {!rows.length && <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs font-semibold text-slate-400">Chưa có dữ liệu task.</p>}
      </div>
    </div>
  );
}

function TaskDetailModal({
  task,
  leads,
  salesOptions,
  canViewAll,
  currentUserId,
  busy,
  onClose,
  onSave,
  onDelete,
  onOpenLead,
  onAddProof,
  onRemoveProof,
  onComplete,
}: {
  task: SalesTask;
  leads: Lead[];
  salesOptions: AdminUser[];
  canViewAll: boolean;
  currentUserId: string;
  busy: boolean;
  onClose: () => void;
  onSave: (id: string, patch: Partial<ManualTask>) => Promise<void>;
  onDelete: (id: string) => void;
  onOpenLead: (leadId: string) => void;
  onAddProof: (task: SalesTask, assigneeId: string, files: FileList | File[]) => void;
  onRemoveProof: (task: SalesTask, assigneeId: string, index: number) => void;
  onComplete: (task: SalesTask, assigneeId: string) => void;
}) {
  const editable = task.type === 'manual';
  const assignees = normalizeTaskAssignees(task);
  const assigneeSelectOptions = useMemo(() => {
    const map = new Map(salesOptions.map((item) => [item.id, item]));
    assignees.forEach((assignee) => {
      if (!map.has(assignee.id)) {
        map.set(assignee.id, {
          id: assignee.id,
          fullName: assignee.name || assignee.id,
          email: '',
          role: 'sales',
          active: true,
          createdAt: '',
        });
      }
    });
    return Array.from(map.values());
  }, [assignees, salesOptions]);
  const [draft, setDraft] = useState({
    title: task.title,
    notes: task.detail || '',
    dueAt: localInputValue(task.dueAt),
    leadId: task.leadId || '',
    category: task.category,
    priority: task.priority,
    assigneeIds: assignees.map((item) => item.id),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const nextAssignees = normalizeTaskAssignees(task);
    setDraft({
      title: task.title,
      notes: task.detail || '',
      dueAt: localInputValue(task.dueAt),
      leadId: task.leadId || '',
      category: task.category,
      priority: task.priority,
      assigneeIds: nextAssignees.map((item) => item.id),
    });
    setError('');
  }, [task]);

  async function save() {
    if (!editable) return;
    setError('');
    if (!draft.title.trim()) return setError('Vui lòng nhập nội dung task.');
    if (!draft.dueAt) return setError('Vui lòng chọn hạn xử lý.');
    const selectedSales = draft.assigneeIds.map((id) => assigneeSelectOptions.find((item) => item.id === id)).filter(Boolean) as AdminUser[];
    if (!selectedSales.length) return setError('Vui lòng chọn ít nhất 1 sales phụ trách.');

    setSaving(true);
    try {
      await onSave(task.id, {
        title: draft.title.trim(),
        notes: draft.notes.trim(),
        dueAt: fromLocalInput(draft.dueAt),
        leadId: draft.leadId,
        category: draft.category,
        priority: draft.priority,
        assignedTo: selectedSales[0].id,
        assignedToName: selectedSales[0].fullName,
        assigneeIds: selectedSales.map((item) => item.id),
      });
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không cập nhật được task.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete() {
    if (!editable) return;
    if (window.confirm('Xóa task này?')) onDelete(task.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-extrabold text-slate-950">{task.title || 'Task'}</h2>
              <Badge tone={task.status === 'done' ? 'green' : taskDueTone(task.dueAt)}>{task.status === 'done' ? 'Hoàn thành' : 'Đang mở'}</Badge>
              <Badge tone="purple">{taskCategoryLabel(task.category)}</Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {taskAssigneeSummary(task)} · {formatDate(task.dueAt, true)} · {taskProofCount(task)} ảnh minh chứng
            </p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Đóng popup"><X size={18} /></Button>
        </div>

        <div className="grid max-h-[calc(92vh-146px)] gap-5 overflow-y-auto p-5 xl:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            {!editable && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                Task này được sinh tự động từ lead/lịch hẹn, có thể xem chi tiết tại đây nhưng không sửa trực tiếp trong task.
              </div>
            )}
            <div className="grid gap-3 md:grid-cols-2">
              <Field className="md:col-span-2" label="Nội dung task">
                <Input value={draft.title} disabled={!editable} onChange={(event) => setDraft((item) => ({ ...item, title: event.target.value }))} />
              </Field>
              <Field label="Nhóm công việc">
                <Select value={draft.category} disabled={!editable} onChange={(event) => setDraft((item) => ({ ...item, category: event.target.value as TaskCategory }))}>
                  {TASK_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </Select>
              </Field>
              <Field label="Priority">
                <Select value={draft.priority} disabled={!editable} onChange={(event) => setDraft((item) => ({ ...item, priority: event.target.value as TaskPriority }))}>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="low">Low</option>
                </Select>
              </Field>
              <Field label="Hạn xử lý">
                <Input type="datetime-local" value={draft.dueAt} disabled={!editable} onChange={(event) => setDraft((item) => ({ ...item, dueAt: event.target.value }))} />
              </Field>
              <Field label="Lead liên quan">
                <Select value={draft.leadId} disabled={!editable} onChange={(event) => setDraft((item) => ({ ...item, leadId: event.target.value }))}>
                  <option value="">Không link lead</option>
                  {leads.slice(0, 200).map((lead) => (
                    <option key={lead.id} value={lead.id}>{leadName(lead) || lead.phone || lead.id}</option>
                  ))}
                </Select>
              </Field>
              <Field className="md:col-span-2" label="Sales phụ trách">
                <SalesMultiSelect
                  salesOptions={assigneeSelectOptions}
                  selectedIds={draft.assigneeIds}
                  disabled={!editable || !canViewAll}
                  onChange={(assigneeIds) => setDraft((item) => ({ ...item, assigneeIds }))}
                />
              </Field>
              <Field className="md:col-span-2" label="Note chi tiết">
                <Textarea rows={5} value={draft.notes} disabled={!editable} onChange={(event) => setDraft((item) => ({ ...item, notes: event.target.value }))} />
              </Field>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-xs font-extrabold uppercase text-slate-500">Thông tin task</p>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">Tạo bởi</p>
                  <p className="font-semibold text-slate-800">{task.createdByName || '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">Hoàn thành</p>
                  <p className="font-semibold text-slate-800">{task.completedAt ? formatDate(task.completedAt, true) : '-'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">Lead</p>
                  {task.leadId ? (
                    <button type="button" className="font-bold text-[#003B7A] hover:underline" onClick={() => onOpenLead(task.leadId!)}>
                      {task.leadName || task.parentName || task.phone || task.leadId}
                    </button>
                  ) : <p className="font-semibold text-slate-800">-</p>}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">Trạng thái sales</p>
                  <p className="font-semibold text-slate-800">{taskDoneCount(task)}/{assignees.length || 1} hoàn thành</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h3 className="font-extrabold text-slate-950">Bằng chứng kết quả</h3>
              <p className="text-sm text-slate-500">Mỗi sales có khu vực ảnh minh chứng và nút xác nhận riêng.</p>
            </div>
            {assignees.map((assignee) => {
              const canEditProof = editable && canEditAssigneeProof(assignee.id, currentUserId, canViewAll);
              const locked = !canEditProof || assignee.status === 'done';
              return (
                <div key={assignee.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-extrabold text-slate-900">{assignee.name || assignee.id}</p>
                      <p className="text-xs font-semibold text-slate-500">{assignee.proofImages.length} ảnh minh chứng</p>
                    </div>
                    <Badge tone={assignee.status === 'done' ? 'green' : 'orange'}>{assignee.status === 'done' ? 'Hoàn thành' : 'To-do'}</Badge>
                  </div>
                  <TaskProofPanel
                    proofImages={assignee.proofImages}
                    busy={busy}
                    disabled={locked}
                    onAddProof={(files) => onAddProof(task, assignee.id, files)}
                    onRemoveProof={(index) => onRemoveProof(task, assignee.id, index)}
                  />
                  {assignee.completedAt && (
                    <p className="mt-2 text-xs font-semibold text-emerald-700">
                      Xác nhận: {formatDate(assignee.completedAt, true)}{assignee.completedByName ? ` · ${assignee.completedByName}` : ''}
                    </p>
                  )}
                  {canEditProof && assignee.status !== 'done' && (
                    <Button className="mt-3 w-full" size="sm" variant="secondary" onClick={() => onComplete(task, assignee.id)} disabled={busy || !assignee.proofImages.length}>
                      <CheckCircle2 size={16} /> Xác nhận đã hoàn thành
                    </Button>
                  )}
                </div>
              );
            })}
            {!assignees.length && (
              <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-sm font-semibold text-slate-400">
                Chưa có sales phụ trách task.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <div>
            {editable && (
              <Button type="button" variant="destructive" onClick={confirmDelete} disabled={busy || saving}><Trash2 size={16} /> Xóa task</Button>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {error && <p className="self-center rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>}
            <Button type="button" variant="outline" onClick={onClose} disabled={busy || saving}>Đóng</Button>
            {editable && (
              <Button type="button" onClick={() => void save()} disabled={busy || saving}>
                <Save size={16} /> {saving ? 'Đang lưu' : 'Lưu task'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TaskTable({
  tasks,
  sortField,
  sortDirection,
  onSort,
  onOpenLead,
  onOpenTask,
  onDelete,
  busyTaskId,
}: {
  tasks: SalesTask[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onOpenLead: (leadId: string) => void;
  onOpenTask: (taskId: string) => void;
  onDelete: (id: string) => void;
  busyTaskId: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase text-slate-400">
            <th className="py-2 pr-3">Task</th>
            <th className="px-3 py-2">Lead</th>
            <th className="px-3 py-2">Sales</th>
            <th className="px-3 py-2">
              <button type="button" className="inline-flex items-center gap-1 font-bold uppercase hover:text-slate-700" onClick={() => onSort('due')}>
                Due {sortField === 'due' ? (sortDirection === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />) : <ArrowUp size={13} className="opacity-30" />}
              </button>
            </th>
            <th className="px-3 py-2">
              <button type="button" className="inline-flex items-center gap-1 font-bold uppercase hover:text-slate-700" onClick={() => onSort('priority')}>
                Priority {sortField === 'priority' ? (sortDirection === 'asc' ? <ArrowUp size={13} /> : <ArrowDown size={13} />) : <ArrowDown size={13} className="opacity-30" />}
              </button>
            </th>
            <th className="px-3 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onOpenLead={onOpenLead}
              onOpenTask={onOpenTask}
              onDelete={onDelete}
              busy={busyTaskId === task.id}
            />
          ))}
          {!tasks.length && (
            <tr><td colSpan={6} className="py-10 text-center text-sm font-semibold text-slate-400">Không có task phù hợp.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TaskRow({
  task,
  onOpenLead,
  onOpenTask,
  onDelete,
  busy,
}: {
  task: SalesTask;
  onOpenLead: (leadId: string) => void;
  onOpenTask: (taskId: string) => void;
  onDelete: (id: string) => void;
  busy: boolean;
}) {
  const proofCount = taskProofCount(task);
  const assignees = normalizeTaskAssignees(task);
  return (
    <tr className="cursor-pointer border-b border-slate-100 align-top transition hover:bg-slate-50" onClick={() => onOpenTask(task.id)}>
      <td className="py-3 pr-3">
        <div className="flex items-start gap-3">
          <TaskIcon type={task.type} />
          <div>
            <p className="font-extrabold text-slate-900">{task.title}</p>
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{task.detail || '-'}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              <Badge tone={task.status === 'done' ? 'green' : taskDueTone(task.dueAt)}>{task.status === 'done' ? 'Hoàn thành' : taskLabel(task.type)}</Badge>
              <Badge tone="purple">{taskCategoryLabel(task.category)}</Badge>
              {assignees.length > 1 && <Badge tone="blue">{taskDoneCount(task)}/{assignees.length} sales xong</Badge>}
              {task.createdByName && <Badge tone="gray">Tạo bởi {task.createdByName}</Badge>}
              {proofCount > 0 && <Badge tone="green">{proofCount} ảnh</Badge>}
            </div>
            {task.completedAt && <p className="mt-1 text-[11px] font-semibold text-emerald-700">Hoàn thành: {formatDate(task.completedAt, true)}{task.completedByName ? ` · ${task.completedByName}` : ''}</p>}
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        {task.leadId ? (
          <button type="button" className="font-bold text-[#003B7A] hover:underline" onClick={(event) => { event.stopPropagation(); onOpenLead(task.leadId!); }}>
            {task.leadName || task.parentName || task.phone || 'Mở lead'}
          </button>
        ) : '-'}
        {task.phone && <p className="mt-1 text-xs text-slate-500">{task.phone}</p>}
      </td>
      <td className="px-3 py-3 font-semibold text-slate-700">{taskAssigneeSummary(task)}</td>
      <td className="px-3 py-3">
        <p className={`font-bold ${taskDueTone(task.dueAt) === 'red' ? 'text-red-600' : 'text-slate-800'}`}>{formatDate(task.dueAt, true)}</p>
      </td>
      <td className="px-3 py-3"><PriorityBadge value={task.priority} /></td>
      <td className="px-3 py-3">
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); onOpenTask(task.id); }}><Eye /> Chi tiết</Button>
          {task.type === 'manual' && (
            <Button size="sm" variant="outline" disabled={busy} onClick={(event) => { event.stopPropagation(); onDelete(task.id); }}><Trash2 /> Xóa</Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function TaskKanban({
  groups,
  onOpenLead,
  onOpenTask,
  onDelete,
  busyTaskId,
}: {
  groups: Record<string, SalesTask[]>;
  onOpenLead: (leadId: string) => void;
  onOpenTask: (taskId: string) => void;
  onDelete: (id: string) => void;
  busyTaskId: string;
}) {
  const columns = [
    ['overdue', 'Quá hạn'],
    ['today', 'Hôm nay'],
    ['tomorrow', 'Ngày mai'],
    ['week', 'Tuần này'],
    ['later', 'Sau đó'],
    ['done', 'Đã xong'],
  ] as const;
  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid min-w-[1180px] grid-cols-6 gap-3">
        {columns.map(([key, label]) => (
          <div key={key} className="min-h-[320px] rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-extrabold uppercase text-slate-500">{label}</p>
              <Badge tone={key === 'overdue' ? 'red' : key === 'today' ? 'orange' : 'gray'}>{groups[key].length}</Badge>
            </div>
            <div className="space-y-3">
              {groups[key].map((task) => (
                <TaskKanbanCard
                  key={task.id}
                  task={task}
                  onOpenLead={onOpenLead}
                  onOpenTask={onOpenTask}
                  onDelete={onDelete}
                  busy={busyTaskId === task.id}
                />
              ))}
              {!groups[key].length && <div className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-xs font-semibold text-slate-400">Trống</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskKanbanCard({
  task,
  onOpenLead,
  onOpenTask,
  onDelete,
  busy,
}: {
  task: SalesTask;
  onOpenLead: (leadId: string) => void;
  onOpenTask: (taskId: string) => void;
  onDelete: (id: string) => void;
  busy: boolean;
}) {
  const proofCount = taskProofCount(task);
  const assignees = normalizeTaskAssignees(task);
  return (
    <div className="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-[#003B7A]/40 hover:shadow-md" onClick={() => onOpenTask(task.id)}>
      <div className="flex items-start gap-2">
        <TaskIcon type={task.type} />
        <div className="min-w-0">
          <p className="line-clamp-2 text-sm font-extrabold text-slate-900">{task.title}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{formatDate(task.dueAt, true)}</p>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-xs text-slate-500">{task.detail || '-'}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        <PriorityBadge value={task.priority} />
        <Badge tone="gray">{taskLabel(task.type)}</Badge>
        <Badge tone="purple">{taskCategoryLabel(task.category)}</Badge>
        {assignees.length > 1 && <Badge tone="blue">{taskDoneCount(task)}/{assignees.length} sales</Badge>}
        {proofCount > 0 && <Badge tone="green">{proofCount} ảnh</Badge>}
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3">
        {task.leadId && (
          <button type="button" className="block text-left text-sm font-bold text-[#003B7A] hover:underline" onClick={(event) => { event.stopPropagation(); onOpenLead(task.leadId!); }}>
            {task.leadName || task.parentName || task.phone || 'Mở lead'}
          </button>
        )}
        <p className="mt-1 text-xs text-slate-500">{taskAssigneeSummary(task)}</p>
      </div>
      {task.completedAt && <p className="mt-2 text-[11px] font-semibold text-emerald-700">Hoàn thành: {formatDate(task.completedAt, true)}</p>}
      {task.type === 'manual' && (
        <div className="mt-3 space-y-2">
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); onOpenTask(task.id); }}><Eye /> Chi tiết</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={(event) => { event.stopPropagation(); onDelete(task.id); }}><Trash2 /> Xóa</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function TaskLeadModal({
  lead,
  callLogs,
  salesOptions,
  sourceOptions,
  centerOptions,
  courseOptions,
  courseDealSizes,
  busy,
  onClose,
  onSave,
  onCall,
}: {
  lead: Lead;
  callLogs: CallLog[];
  salesOptions: AdminUser[];
  sourceOptions: string[];
  centerOptions: string[];
  courseOptions: string[];
  courseDealSizes: readonly CourseDealSizeRule[];
  busy: boolean;
  onClose: () => void;
  onSave: (lead: Lead) => Promise<void>;
  onCall: (lead: Lead) => Promise<void>;
}) {
  const [draft, setDraft] = useState<Lead>(lead);
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(lead), [lead]);

  function set<K extends keyof Lead>(key: K, value: Lead[K]) {
    setDraft((item) => ({ ...item, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function callLead() {
    if (!draft.phone) return;
    await onCall(draft);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-950">{leadName(draft) || 'Lead'}</h2>
            <p className="mt-1 text-sm text-slate-500">PH: {draft.parentName || '-'} · {draft.phone || '-'} · {draft.centerName || '-'}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void callLead()} disabled={!draft.phone || busy || saving}>
              <PhoneCall size={16} /> Gọi lead
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Đóng popup"><X size={18} /></Button>
          </div>
        </div>
        <div className="grid max-h-[calc(92vh-140px)] gap-4 overflow-y-auto p-5 lg:grid-cols-[320px_1fr]">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-extrabold text-slate-950">{leadName(draft) || '-'}</p>
                  <p className="text-sm text-slate-500">PH: {draft.parentName || '-'}</p>
                </div>
                <Badge tone={taskDueTone(draft.followUpDate || draft.updatedAt)}>{draft.status}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-1">
                <Badge tone={Number(draft.priorityLevel || 0) >= 5 ? 'red' : 'orange'}>P{draft.priorityLevel || '-'}</Badge>
                <Badge tone="blue">{draft.assignedToName || draft.assignedTo || 'Chưa có sales'}</Badge>
                <Badge tone="purple">{draft.interestedCourse || 'Chưa chọn khóa'}</Badge>
                <Badge tone="gray">{draft.source || 'Chưa có source'}</Badge>
              </div>
              <p className="mt-3 line-clamp-4 text-xs text-slate-500">{draft.initialNote || 'Chưa có ghi chú ban đầu.'}</p>
              {draft.status === DEAL_QUOTED_STATUS && (
                <div className="mt-3 rounded-md bg-orange-50 p-2 text-xs font-bold text-orange-700">
                  Expected: {formatCurrency(expectedRevenueAmount(draft, courseDealSizes), draft.dealCurrency)}
                </div>
              )}
              {draft.status === WON_LEAD_STATUS && (
                <div className="mt-3 rounded-md bg-emerald-50 p-2 text-xs font-bold text-emerald-700">
                  Revenue: {formatCurrency(revenueAmount(draft, courseDealSizes), draft.dealCurrency)}
                </div>
              )}
            </div>
            <div className="mt-4">
              <p className="text-xs font-extrabold uppercase text-slate-500">Call gần đây</p>
              <div className="mt-2 space-y-2">
                {callLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="rounded-md border border-slate-200 bg-white p-2 text-xs">
                    <p className="font-bold text-slate-800">{log.direction === 'outbound' ? 'Outbound' : 'Inbound'} · {log.disposition || log.status}</p>
                    <p className="mt-1 text-slate-500">{formatDate(log.startedAt, true)}{log.durationSec ? ` · ${log.durationSec}s` : ''}</p>
                    <CallRecordingButton log={log} className="mt-1 text-xs" />
                  </div>
                ))}
                {!callLogs.length && <p className="rounded-md border border-dashed border-slate-200 py-4 text-center text-xs font-semibold text-slate-400">Chưa có call log.</p>}
              </div>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Tên phụ huynh"><Input value={draft.parentName || ''} onChange={(event) => set('parentName', event.target.value)} /></Field>
            <Field label="Tên học sinh"><Input value={draft.studentName || ''} onChange={(event) => set('studentName', event.target.value)} /></Field>
            <Field label="Số điện thoại"><Input value={draft.phone || ''} onChange={(event) => set('phone', event.target.value)} /></Field>
            <Field label="Email"><Input value={draft.email || ''} onChange={(event) => set('email', event.target.value)} /></Field>
            <Field label="Tuổi"><Input value={draft.age || ''} onChange={(event) => set('age', event.target.value)} /></Field>
            <Field label="Trường"><Input value={draft.school || ''} onChange={(event) => set('school', event.target.value)} /></Field>
            <Field label="Khóa học">
              <Select value={draft.interestedCourse || ''} onChange={(event) => set('interestedCourse', event.target.value)}>
                <option value="">Chưa chọn</option>
                {courseOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </Field>
            <Field label="Source">
              <Select value={draft.source || ''} onChange={(event) => set('source', event.target.value)}>
                <option value="">Chưa chọn</option>
                {sourceOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </Field>
            <Field label="SĐT referral"><Input value={draft.referralPhone || ''} onChange={(event) => set('referralPhone', event.target.value)} /></Field>
            <Field label="Trung tâm">
              <Select value={draft.centerName || ''} onChange={(event) => set('centerName', event.target.value)}>
                <option value="">Chưa chọn</option>
                {centerOptions.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </Field>
            <Field label="Sales">
              <Select value={draft.assignedTo || ''} onChange={(event) => {
                const selected = salesOptions.find((item) => item.id === event.target.value);
                setDraft((item) => ({ ...item, assignedTo: event.target.value, assignedToName: selected?.fullName || item.assignedToName || '' }));
              }}>
                <option value="">Chưa chọn</option>
                {salesOptions.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={draft.status || ''} onChange={(event) => set('status', event.target.value as Lead['status'])}>
                {leadStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
              </Select>
            </Field>
            <Field label="Ưu tiên">
              <Select value={String(draft.priorityLevel || '')} onChange={(event) => set('priorityLevel', Number(event.target.value) as Lead['priorityLevel'])}>
                {[5, 4, 3, 2, 1].map((item) => <option key={item} value={item}>P{item}</option>)}
              </Select>
            </Field>
            <Field label="Follow-up"><Input type="datetime-local" value={localInputValue(draft.followUpDate)} onChange={(event) => set('followUpDate', fromLocalInput(event.target.value))} /></Field>
            <Field label="Deal size"><Input type="number" value={draft.dealSize || ''} onChange={(event) => set('dealSize', Number(event.target.value) || undefined)} /></Field>
            <Field label="% discount"><Input type="number" value={draft.discountPercent || ''} onChange={(event) => set('discountPercent', Number(event.target.value) || undefined)} /></Field>
            <Field label="Expected close"><Input type="date" value={dateKey(draft.expectedCloseDate)} onChange={(event) => set('expectedCloseDate', event.target.value)} /></Field>
            <Field className="md:col-span-3" label="Ghi chú ban đầu"><Textarea rows={4} value={draft.initialNote || ''} onChange={(event) => set('initialNote', event.target.value)} /></Field>
            <Field className="md:col-span-3" label="Note deal / pending"><Textarea rows={3} value={draft.dealNote || draft.pendingReasonNote || ''} onChange={(event) => set('dealNote', event.target.value)} /></Field>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy || saving}>Hủy</Button>
          <Button type="button" onClick={() => void save()} disabled={busy || saving}><Save size={16} /> Lưu lead</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, className = '', children }: { label: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <label className="text-xs font-extrabold uppercase text-slate-500">{label}</label>
      {children}
    </div>
  );
}

function MetricCard({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'blue' | 'red' | 'orange' }) {
  const toneClass = {
    slate: 'text-slate-950',
    blue: 'text-blue-700',
    red: 'text-red-600',
    orange: 'text-orange-600',
  }[tone];
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
        <p className={`mt-2 text-3xl font-extrabold ${toneClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function TaskIcon({ type }: { type: TaskType }) {
  const cls = 'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg';
  if (type === 'follow_up') return <span className={`${cls} bg-amber-50 text-amber-700`}><Phone size={16} /></span>;
  if (type === 'retry_call') return <span className={`${cls} bg-red-50 text-red-600`}><Phone size={16} /></span>;
  if (type === 'quote') return <span className={`${cls} bg-orange-50 text-orange-700`}><Send size={16} /></span>;
  if (type === 'appointment') return <span className={`${cls} bg-violet-50 text-violet-700`}><CalendarCheck size={16} /></span>;
  return <span className={`${cls} bg-blue-50 text-blue-700`}><Clock size={16} /></span>;
}

function taskLabel(type: TaskType) {
  if (type === 'follow_up') return 'Follow-up';
  if (type === 'retry_call') return 'Gọi lại';
  if (type === 'quote') return 'Báo giá/chốt';
  if (type === 'appointment') return 'Lịch hẹn';
  return 'To-do';
}

function PriorityBadge({ value }: { value: TaskPriority }) {
  if (value === 'high') return <Badge tone="red">High</Badge>;
  if (value === 'low') return <Badge tone="gray">Low</Badge>;
  return <Badge tone="blue">Normal</Badge>;
}
