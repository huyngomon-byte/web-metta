import {
  ArrowDown,
  ArrowUp,
  CalendarCheck,
  CheckCircle2,
  Clock,
  LayoutGrid,
  List,
  ListTodo,
  Phone,
  PhoneCall,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCallCenter } from '@/context/CallCenterContext';
import { DEAL_QUOTED_STATUS, LOST_LEAD_STATUS, WON_LEAD_STATUS, leadStatuses } from '@/lib/constants';
import { expectedRevenueAmount, revenueAmount } from '@/lib/leadFinance';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useLeads } from '@/hooks/useLeads';
import { appointmentService } from '@/services/appointmentService';
import { callCenterService } from '@/services/callCenterService';
import { leadService } from '@/services/leadService';
import { salesTaskService, type ManualTask, type TaskPriority } from '@/services/salesTaskService';
import { userService } from '@/services/userService';
import type { CallLog } from '@/types/call';
import type { Appointment, Lead } from '@/types/crm';
import type { AdminUser } from '@/types/user';

type TaskType = 'follow_up' | 'appointment' | 'retry_call' | 'quote' | 'manual';
type TaskStatus = 'open' | 'done';
type ViewMode = 'list' | 'kanban';
type SortField = 'due' | 'priority';
type SortDirection = 'asc' | 'desc';

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
  status: TaskStatus;
  priority: TaskPriority;
};

const ACTIVE_STATUSES = leadStatuses.filter((status) => ![WON_LEAD_STATUS, LOST_LEAD_STATUS].includes(status));
const priorityWeight: Record<TaskPriority, number> = { high: 3, normal: 2, low: 1 };

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

function buildTasks(leads: Lead[], appointments: Appointment[], callLogs: CallLog[], manualTasks: ManualTask[]): SalesTask[] {
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
        status: 'open',
        priority: inferPriority({ type: 'follow_up', dueAt: lead.followUpDate, lead }),
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
        status: 'open',
        priority: inferPriority({ type: 'retry_call', dueAt, lead }),
      });
    }

    if (lead.status === DEAL_QUOTED_STATUS) {
      const dueAt = lead.expectedCloseDate || addHours(lead.updatedAt || lead.createdAt, 24);
      tasks.push({
        id: `quote-${lead.id}`,
        type: 'quote',
        title: `Follow báo phí / chờ chốt`,
        detail: `${lead.pendingReason || 'Chưa có lý do pending'} · Expected ${formatCurrency(expectedRevenueAmount(lead), lead.dealCurrency)}`,
        dueAt,
        leadId: lead.id,
        leadName: displayName,
        parentName: lead.parentName,
        phone: lead.phone,
        assignedTo,
        assignedToName,
        status: 'open',
        priority: inferPriority({ type: 'quote', dueAt, lead, warmth: lead.pendingWarmthPercent }),
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
      status: 'open',
      priority: inferPriority({ type: 'appointment', dueAt: item.startTime, lead, appointmentStatus: item.status }),
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
      status: item.status,
      priority: item.priority,
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
  const { leads, refresh: refreshLeads } = useLeads();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [manualTasks, setManualTasks] = useState<ManualTask[]>([]);
  const [quickTaskBusy, setQuickTaskBusy] = useState(false);
  const [quickTaskError, setQuickTaskError] = useState('');
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
    assignedTo: '',
    leadIds: [] as string[],
    priority: 'normal' as TaskPriority,
  });

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
    const unsubAppointments = appointmentService.subscribeAppointments(setAppointments, () => {
      void appointmentService.getAppointments().then(setAppointments).catch(() => {});
    });
    const unsubTasks = salesTaskService.subscribeTasks(setManualTasks, () => {
      void salesTaskService.getTasks().then(setManualTasks).catch(() => {});
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
      if (taskAssigneeOptions.some((option) => option.id === item.assignedTo)) return item;
      return { ...item, assignedTo: defaultTaskAssigneeId };
    });
  }, [defaultTaskAssigneeId, taskAssigneeOptions]);
  const leadOptions = useMemo(() => ({
    sources: Array.from(new Set(leads.map((lead) => lead.source).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi')),
    centers: Array.from(new Set(leads.map((lead) => lead.centerName || '').filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi')),
    courses: Array.from(new Set(leads.map((lead) => lead.interestedCourse || '').filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi')),
  }), [leads]);
  const allTasks = useMemo(() => buildTasks(leads, appointments, callLogs, manualTasks), [appointments, callLogs, leads, manualTasks]);
  const filteredTasks = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return allTasks.filter((task) => {
      if (!canViewAll && task.assignedTo !== user?.id) return false;
      if (sales && task.assignedTo !== sales && task.assignedToName !== sales) return false;
      if (status && task.status !== status) return false;
      if (type && task.type !== type) return false;
      if (priority && task.priority !== priority) return false;
      if (!isTaskInDatePreset(task, datePreset, dateFrom, dateTo)) return false;
      if (keyword && !`${task.title} ${task.detail} ${task.leadName || ''} ${task.parentName || ''} ${task.phone || ''} ${task.assignedToName}`.toLowerCase().includes(keyword)) return false;
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

  function cycleSort(field: SortField) {
    if (sortField === field) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc');
    else {
      setSortField(field);
      setSortDirection(field === 'priority' ? 'desc' : 'asc');
    }
  }

  async function saveManualTask() {
    setQuickTaskError('');
    if (!draft.title.trim()) return setQuickTaskError('Vui lòng nhập nội dung task.');
    if (!draft.dueAt) return setQuickTaskError('Vui lòng chọn hạn xử lý.');
    const assignedUser = taskAssigneeOptions.find((item) => item.id === draft.assignedTo);
    if (!assignedUser) return setQuickTaskError('Vui lòng chọn sales phụ trách task.');

    setQuickTaskBusy(true);
    try {
      const timestamp = nowIso();
      const leadIds = draft.leadIds.length ? draft.leadIds : [''];
      const tasks = leadIds.map((leadId, index) => ({
        id: `task-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
        title: draft.title.trim(),
        notes: draft.notes.trim(),
        dueAt: fromLocalInput(draft.dueAt),
        assignedTo: assignedUser.id,
        assignedToName: assignedUser.fullName,
        leadId,
        priority: draft.priority,
        status: 'open' as TaskStatus,
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
        assignedTo: assignedUser.id,
        leadIds: [],
        priority: 'normal',
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
            <option value="">Tất cả loại task</option>
            <option value="follow_up">Follow-up</option>
            <option value="retry_call">Gọi lại</option>
            <option value="quote">Báo giá/chốt</option>
            <option value="appointment">Lịch hẹn</option>
            <option value="manual">To-do</option>
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

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Plus size={18} /> Tạo to-do nhanh</CardTitle></CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[1.2fr_minmax(280px,1fr)_220px_180px_150px_auto]">
          <Input placeholder="Ví dụ: gửi báo giá cho phụ huynh" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <LeadMultiSelect leads={leads} selectedIds={draft.leadIds} onChange={(leadIds) => setDraft({ ...draft, leadIds })} />
          <Input type="datetime-local" value={draft.dueAt} onChange={(event) => setDraft({ ...draft, dueAt: event.target.value })} />
          <Select value={draft.assignedTo} onChange={(event) => setDraft({ ...draft, assignedTo: event.target.value })} disabled={!canViewAll}>
            <option value="">Chọn sales</option>
            {taskAssigneeOptions.map((item) => <option key={item.id} value={item.id}>{item.fullName}</option>)}
          </Select>
          <Select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as TaskPriority })}>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="low">Low</option>
          </Select>
          <Button onClick={() => void saveManualTask()} disabled={quickTaskBusy || !taskAssigneeOptions.length}><Plus /> {quickTaskBusy ? 'Đang thêm' : 'Thêm'}</Button>
          <Textarea className="lg:col-span-6" rows={2} placeholder="Note chi tiết" value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
          {quickTaskError && <p className="lg:col-span-6 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{quickTaskError}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ListTodo size={18} /> Danh sách task</CardTitle>
        </CardHeader>
        <CardContent>
          {view === 'list' ? (
            <TaskTable
              tasks={visibleTasks}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={cycleSort}
              onOpenLead={setActiveLeadId}
              onDone={(id, patch) => void updateManual(id, patch)}
              onDelete={(id) => void deleteManual(id)}
            />
          ) : (
            <TaskKanban
              groups={groupedTasks}
              onOpenLead={setActiveLeadId}
              onDone={(id, patch) => void updateManual(id, patch)}
              onDelete={(id) => void deleteManual(id)}
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
          busy={false}
          onClose={() => setActiveLeadId('')}
          onSave={saveLeadFromModal}
          onCall={callLeadFromModal}
        />
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

function TaskTable({
  tasks,
  sortField,
  sortDirection,
  onSort,
  onOpenLead,
  onDone,
  onDelete,
}: {
  tasks: SalesTask[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onOpenLead: (leadId: string) => void;
  onDone: (id: string, patch: Partial<ManualTask>) => void;
  onDelete: (id: string) => void;
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
            <TaskRow key={task.id} task={task} onOpenLead={onOpenLead} onDone={onDone} onDelete={onDelete} />
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
  onDone,
  onDelete,
}: {
  task: SalesTask;
  onOpenLead: (leadId: string) => void;
  onDone: (id: string, patch: Partial<ManualTask>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <tr className="border-b border-slate-100 align-top">
      <td className="py-3 pr-3">
        <div className="flex items-start gap-3">
          <TaskIcon type={task.type} />
          <div>
            <p className="font-extrabold text-slate-900">{task.title}</p>
            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{task.detail || '-'}</p>
            <Badge tone={task.status === 'done' ? 'green' : taskDueTone(task.dueAt)} className="mt-2">{task.status === 'done' ? 'Đã xong' : taskLabel(task.type)}</Badge>
          </div>
        </div>
      </td>
      <td className="px-3 py-3">
        {task.leadId ? (
          <button type="button" className="font-bold text-[#003B7A] hover:underline" onClick={() => onOpenLead(task.leadId!)}>
            {task.leadName || task.parentName || task.phone || 'Mở lead'}
          </button>
        ) : '-'}
        {task.phone && <p className="mt-1 text-xs text-slate-500">{task.phone}</p>}
      </td>
      <td className="px-3 py-3 font-semibold text-slate-700">{task.assignedToName || task.assignedTo || '-'}</td>
      <td className="px-3 py-3">
        <p className={`font-bold ${taskDueTone(task.dueAt) === 'red' ? 'text-red-600' : 'text-slate-800'}`}>{formatDate(task.dueAt, true)}</p>
      </td>
      <td className="px-3 py-3"><PriorityBadge value={task.priority} /></td>
      <td className="px-3 py-3">
        <div className="flex justify-end gap-2">
          {task.type === 'manual' && (
            <>
              {task.status !== 'done' && <Button size="sm" variant="outline" onClick={() => onDone(task.id, { status: 'done' })}><CheckCircle2 /> Done</Button>}
              <Button size="sm" variant="outline" onClick={() => onDelete(task.id)}><Trash2 /> Xóa</Button>
            </>
          )}
          {task.leadId && (
            <Button size="sm" variant="outline" onClick={() => onOpenLead(task.leadId!)}>Mở lead</Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function TaskKanban({
  groups,
  onOpenLead,
  onDone,
  onDelete,
}: {
  groups: Record<string, SalesTask[]>;
  onOpenLead: (leadId: string) => void;
  onDone: (id: string, patch: Partial<ManualTask>) => void;
  onDelete: (id: string) => void;
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
                <TaskKanbanCard key={task.id} task={task} onOpenLead={onOpenLead} onDone={onDone} onDelete={onDelete} />
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
  onDone,
  onDelete,
}: {
  task: SalesTask;
  onOpenLead: (leadId: string) => void;
  onDone: (id: string, patch: Partial<ManualTask>) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
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
      </div>
      <div className="mt-3 border-t border-slate-100 pt-3">
        {task.leadId && (
          <button type="button" className="block text-left text-sm font-bold text-[#003B7A] hover:underline" onClick={() => onOpenLead(task.leadId!)}>
            {task.leadName || task.parentName || task.phone || 'Mở lead'}
          </button>
        )}
        <p className="mt-1 text-xs text-slate-500">{task.assignedToName || task.assignedTo || '-'}</p>
      </div>
      {task.type === 'manual' && (
        <div className="mt-3 flex gap-2">
          {task.status !== 'done' && <Button size="sm" variant="outline" onClick={() => onDone(task.id, { status: 'done' })}><CheckCircle2 /> Done</Button>}
          <Button size="sm" variant="outline" onClick={() => onDelete(task.id)}><Trash2 /> Xóa</Button>
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
                  Expected: {formatCurrency(expectedRevenueAmount(draft), draft.dealCurrency)}
                </div>
              )}
              {draft.status === WON_LEAD_STATUS && (
                <div className="mt-3 rounded-md bg-emerald-50 p-2 text-xs font-bold text-emerald-700">
                  Revenue: {formatCurrency(revenueAmount(draft), draft.dealCurrency)}
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
                    {log.recordingUrl && <a className="mt-1 inline-block font-bold text-[#003B7A] hover:underline" href={callCenterService.recordingProxyUrl(log)} target="_blank" rel="noreferrer">Recording</a>}
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
