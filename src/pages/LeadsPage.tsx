import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Clock, Download, GripVertical, LayoutGrid, List, PhoneCall, Plus, RefreshCcw, Save, Trash2, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useCallCenter } from '@/context/CallCenterContext';
import { useAuth } from '@/hooks/useAuth';
import { useCourseOptions } from '@/hooks/useCms';
import { useLeads } from '@/hooks/useLeads';
import { DEAL_QUOTED_STATUS, DEFAULT_DEAL_CURRENCY, LOST_LEAD_STATUS, WON_LEAD_STATUS, discountPercentOptions, leadSources, leadStatuses, lostReasons, pendingReasonOptions } from '@/lib/constants';
import { expectedRevenueAmount, financeDefaultsForLead, revenueAmount } from '@/lib/leadFinance';
import { buildLeadTimeline } from '@/lib/leadTimeline';
import { canAssignLead } from '@/lib/permissions';
import { exportCsv, formatCurrency, formatDate } from '@/lib/utils';
import { appointmentService } from '@/services/appointmentService';
import { callCenterService } from '@/services/callCenterService';
import { centerConfigService } from '@/services/centerConfigService';
import { leadService } from '@/services/leadService';
import { sourceConfigService, sourcePriority } from '@/services/sourceConfigService';
import { userService } from '@/services/userService';
import type { CallLog } from '@/types/call';
import type { Appointment, Lead, LeadActivity, LeadCenterConfig, LeadPriorityLevel, LeadSourceConfig } from '@/types/crm';
import type { AdminUser } from '@/types/user';

type AppointmentKind = '' | Appointment['type'];
type LeadDraft = Partial<Lead> & {
  appointmentKind?: AppointmentKind;
  appointmentTime?: string;
  appointmentNote?: string;
};

const APPT_CALLBACK = 'Gọi lại' as Appointment['type'];
const APPT_CONSULTATION = 'Tư vấn' as Appointment['type'];
const APPT_TEST = 'Test đầu vào' as Appointment['type'];
const APPOINTMENT_TYPES = [APPT_CALLBACK, APPT_CONSULTATION, APPT_TEST] as Appointment['type'][];
const CONSULTATION_STATUS = leadStatuses[3];
const CONSULTATION_STATUS_INDEX = 3;

const emptyLead: LeadDraft = {
  fullName: '',
  parentName: '',
  studentName: '',
  phone: '',
  email: '',
  contactType: 'parent',
  age: '',
  school: '',
  currentClass: '',
  interestedCourse: '',
  currentLevel: '',
  targetGoal: '',
  source: leadSources[0],
  referralPhone: '',
  centerName: '',
  priorityLevel: 1,
  status: leadStatuses[0],
  assignedTo: '',
  assignedToName: '',
  dealCurrency: DEFAULT_DEAL_CURRENCY,
  dealPackage: '',
  dealNote: '',
  expectedCloseDate: '',
  enrollmentType: 'new',
  pendingReason: '',
  pendingReasonNote: '',
  pendingWarmthPercent: 0,
  lostReason: '',
  lostNote: '',
  initialNote: '',
  appointmentKind: '',
  appointmentTime: '',
  appointmentNote: '',
};

const statusTone: Record<number, Parameters<typeof Badge>[0]['tone']> = {
  0: 'blue',
  1: 'cyan',
  2: 'gray',
  3: 'orange',
  4: 'purple',
  5: 'amber',
  6: 'orange',
  7: 'green',
  8: 'red',
};

const columnStyles = [
  'bg-blue-50/75 border-blue-200/70',
  'bg-cyan-50/75 border-cyan-200/70',
  'bg-slate-50/90 border-slate-200/80',
  'bg-orange-50/75 border-orange-200/70',
  'bg-violet-50/75 border-violet-200/70',
  'bg-amber-50/75 border-amber-200/70',
  'bg-orange-50/75 border-orange-200/70',
  'bg-emerald-50/75 border-emerald-200/70',
  'bg-red-50/75 border-red-200/70',
];

function statusIndex(status: string) {
  const idx = (leadStatuses as readonly string[]).indexOf(status);
  return idx >= 0 ? idx : 0;
}

function isConsultationStatus(status?: string) {
  return statusIndex(status || '') === CONSULTATION_STATUS_INDEX;
}

function statusLabel(status: string) {
  return status;
}

function sourceLabel(source: string) {
  return source;
}

function leadDisplayName(lead: Partial<Lead>) {
  return String(lead.studentName || lead.parentName || lead.fullName || '').trim();
}

function priorityLabel(level?: number) {
  const value = Number(level || 1);
  return `P${value}`;
}

function priorityTone(level?: number) {
  const value = Number(level || 1);
  if (value >= 5) return 'bg-red-50 text-red-700 border-red-200';
  if (value === 4) return 'bg-orange-50 text-orange-700 border-orange-200';
  if (value === 3) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (value === 2) return 'bg-cyan-50 text-cyan-700 border-cyan-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function priorityForLead(configs: LeadSourceConfig[], lead: Partial<Lead>) {
  return sourcePriority(configs, lead.source, lead.priorityLevel);
}

function pendingOption(reason?: string) {
  return pendingReasonOptions.find((item) => item.reason === reason);
}

function warmthPercent(lead: Partial<Lead>) {
  return lead.pendingWarmthPercent || pendingOption(lead.pendingReason)?.warmthPercent || 0;
}

function lostReasonDefaultNote(reason?: string) {
  switch (reason) {
    case 'Không liên lạc được sau nhiều lần gọi':
      return 'Đã gọi nhiều lần ở các khung giờ khác nhau nhưng phụ huynh không nghe máy/không phản hồi. Cần ghi rõ số lần gọi và kênh đã follow.';
    case 'Sai số / số không tồn tại':
      return 'Số điện thoại sai, không tồn tại hoặc không thuộc phụ huynh/học sinh. Cần kiểm tra lại nguồn data trước khi loại lead.';
    case 'Phụ huynh từ chối, không có nhu cầu học':
      return 'Phụ huynh xác nhận không còn nhu cầu học ở thời điểm hiện tại. Cần ghi rõ lý do từ chối nếu có.';
    case 'Học phí vượt ngân sách':
      return 'Phụ huynh quan tâm nhưng học phí vượt ngân sách dự kiến. Cần ghi mức học phí đã báo và mức ngân sách phụ huynh chia sẻ.';
    case 'Lịch học không phù hợp':
      return 'Không có ca/lớp phù hợp với lịch của học sinh. Cần ghi rõ khung giờ phụ huynh mong muốn để cân nhắc mở lớp/ca mới.';
    case 'Địa điểm xa / di chuyển bất tiện':
      return 'Phụ huynh thấy trung tâm xa hoặc khó di chuyển. Cần ghi khu vực nhà/trường và cơ sở đã tư vấn.';
    case 'Chọn trung tâm hoặc đối thủ khác':
      return 'Phụ huynh đã chọn trung tâm khác hoặc giải pháp học khác. Cần ghi nếu biết tên đối thủ/lý do lựa chọn.';
    case 'Học viên chưa đúng độ tuổi / chưa phù hợp chương trình':
      return 'Học viên chưa phù hợp độ tuổi, level hoặc mục tiêu chương trình hiện tại. Cần ghi hướng follow-up phù hợp về sau.';
    case 'Chưa sẵn sàng, hẹn liên hệ lại dài hạn':
      return 'Phụ huynh chưa sẵn sàng đăng ký trong ngắn hạn. Cần ghi mốc thời gian nên liên hệ lại và lý do trì hoãn.';
    case 'Trùng lead / data không hợp lệ':
      return 'Lead bị trùng, thiếu dữ liệu quan trọng hoặc không đủ điều kiện xử lý. Cần ghi lead/data tham chiếu nếu có.';
    case 'Khác':
      return 'Lý do mất lead ngoài danh sách chuẩn. Sales cần mô tả rõ bối cảnh để leader có thể phân tích lại.';
    default:
      return '';
  }
}

function isReferralLead(lead: Partial<Lead>) {
  return String(lead.source || '').trim().toLowerCase() === 'referral';
}

function warmthTone(percent: number) {
  if (percent >= 75) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (percent >= 45) return 'bg-amber-50 text-amber-700 border-amber-200';
  if (percent >= 25) return 'bg-orange-50 text-orange-700 border-orange-200';
  return 'bg-red-50 text-red-700 border-red-200';
}

function quoteValue(lead: Partial<Lead>) {
  return expectedRevenueAmount(lead);
}

function wonValue(lead: Partial<Lead>) {
  return revenueAmount(lead);
}

function applyFinanceDefaults<T extends Partial<Lead>>(lead: T): T {
  if (lead.status !== DEAL_QUOTED_STATUS && lead.status !== WON_LEAD_STATUS) return lead;
  const finance = financeDefaultsForLead(lead);
  return {
    ...lead,
    ...finance,
    ...(lead.status === WON_LEAD_STATUS ? { revenue: lead.revenue || finance.expectedRevenue } : {}),
  };
}

function buildLostReasonPatch(lead: Lead, patch: Partial<Lead>) {
  const nextStatus = patch.status || lead.status;
  if (nextStatus !== LOST_LEAD_STATUS) return patch;
  if (String(patch.lostReason || lead.lostReason || '').trim()) return patch;
  return null;
}

function toDraft(lead: Lead): LeadDraft {
  return {
    ...lead,
    appointmentKind: lead.consultationDate ? APPT_CONSULTATION : lead.followUpDate ? APPT_CALLBACK : '',
    appointmentTime: lead.consultationDate || lead.followUpDate || '',
    appointmentNote: '',
  };
}

function localDateLabel(value?: string) {
  if (!value) return 'Không rõ ngày';
  return new Date(value).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function localDateTimeInput(value?: string) {
  return value?.slice(0, 16) || '';
}

function defaultAppointmentInput() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatApptTime(value?: string) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('vi-VN', {
    day: '2-digit', month: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
}

function formatUpdatedAt(value?: string) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm} ${hh}:${mi}`;
}

function latestCallForLead(logs: CallLog[], leadId?: string) {
  return callLogsForLead(logs, leadId)[0];
}

function callLogsForLead(logs: CallLog[], leadId?: string) {
  if (!leadId) return [];
  return logs
    .filter((log) => log.leadId === leadId)
    .sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
}

function callLogTime(log?: CallLog) {
  if (!log?.startedAt) return '';
  const d = new Date(log.startedAt);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
}

function callLogText(log?: CallLog) {
  if (!log) return '';
  const direction = log.direction === 'inbound' ? 'Inbound' : 'Outbound';
  const disposition = log.disposition ? ` · ${log.disposition}` : '';
  const duration = log.durationSec ? ` · ${Math.round(log.durationSec)}s` : '';
  return `${direction} ${callLogTime(log)}${disposition}${duration}`;
}

export default function LeadsPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { leads, refresh, loadMore, hasMore, loadingMore } = useLeads({ pageSize: 500 });
  const { startOutboundCall } = useCallCenter();
  const courseOptions = useCourseOptions();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [sourceConfigs, setSourceConfigs] = useState<LeadSourceConfig[]>([]);
  const [centerConfigs, setCenterConfigs] = useState<LeadCenterConfig[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [filters, setFilters] = useState({ search: '', status: '', source: '', centerName: '', priorityLevel: '', course: '', assignedTo: '', dateFrom: '', dateTo: '' });
  const [view, setView] = useState<'table' | 'kanban'>(searchParams.get('view') === 'table' ? 'table' : 'kanban');
  const focusLeadId = searchParams.get('leadId') || '';
  const [editing, setEditing] = useState<LeadDraft | null>(null);
  const [detailLead, setDetailLead] = useState<Lead | null>(null);
  const [quickLead, setQuickLead] = useState({ parentName: '', studentName: '', phone: '', centerName: '', assignedTo: '' });
  const [quickLeadOpen, setQuickLeadOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [showSourceSettings, setShowSourceSettings] = useState(false);
  const [showCenterSettings, setShowCenterSettings] = useState(false);
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const canAssign = canAssignLead(user);
  const activeFilterCount = useMemo(() => {
    const dateRangeActive = Boolean(filters.dateFrom || filters.dateTo);
    return [
      filters.search,
      filters.status,
      filters.source,
      filters.centerName,
      filters.priorityLevel,
      filters.course,
      filters.assignedTo,
    ].filter(Boolean).length + (dateRangeActive ? 1 : 0);
  }, [filters]);
  const resetFilters = () => setFilters({ search: '', status: '', source: '', centerName: '', priorityLevel: '', course: '', assignedTo: '', dateFrom: '', dateTo: '' });

  const refreshCallLogs = useCallback(async () => {
    setCallLogs(await callCenterService.getLogs());
  }, []);

  useEffect(() => {
    userService.getUsers().then(setUsers);
    sourceConfigService.getConfigs().then(setSourceConfigs);
    centerConfigService.getConfigs().then(setCenterConfigs);
  }, []);

  useEffect(() => {
    void refreshCallLogs();
    const onUpdate = () => void refreshCallLogs();
    window.addEventListener('metta-call-logs-updated', onUpdate);
    window.addEventListener('focus', onUpdate);
    return () => {
      window.removeEventListener('metta-call-logs-updated', onUpdate);
      window.removeEventListener('focus', onUpdate);
    };
  }, [refreshCallLogs]);

  useEffect(() => {
    if (!detailLead) return;
    const freshLead = leads.find((lead) => lead.id === detailLead.id);
    if (freshLead && freshLead.updatedAt !== detailLead.updatedAt) setDetailLead(freshLead);
  }, [detailLead, leads]);

  const salesOptions = useMemo(
    () => users.filter((item) => item.role === 'sales' && item.active),
    [users],
  );

  const filtered = useMemo(() => leads.filter((lead) => {
    const haystack = `${lead.fullName} ${lead.parentName || ''} ${lead.studentName || ''} ${lead.phone} ${lead.email}`.toLowerCase();
    const createdDate = lead.createdAt?.slice(0, 10) || '';
    const priority = priorityForLead(sourceConfigs, lead);
    return (
      (!filters.search || haystack.includes(filters.search.toLowerCase())) &&
      (!filters.status || lead.status === filters.status) &&
      (!filters.source || lead.source === filters.source) &&
      (!filters.centerName || lead.centerName === filters.centerName) &&
      (!filters.priorityLevel || String(priority) === filters.priorityLevel) &&
      (!filters.course || lead.interestedCourse === filters.course) &&
      (!filters.assignedTo || lead.assignedTo === filters.assignedTo) &&
      (!filters.dateFrom || createdDate >= filters.dateFrom) &&
      (!filters.dateTo || createdDate <= filters.dateTo)
    );
  }), [filters, leads, sourceConfigs]);

  const sourceOptions = useMemo(() => {
    const names = new Set([
      ...sourceConfigs.filter((source) => source.active).map((source) => source.name),
      ...leads.map((lead) => lead.source).filter(Boolean),
    ]);
    return Array.from(names);
  }, [leads, sourceConfigs]);

  const centerOptions = useMemo(() => {
    const names = new Set([
      ...centerConfigs.filter((center) => center.active).map((center) => center.name),
      ...leads.map((lead) => lead.centerName).filter((name): name is string => Boolean(name)),
    ]);
    return Array.from(names);
  }, [centerConfigs, leads]);

  function priorityForSource(source?: string, fallback?: number) {
    return sourcePriority(sourceConfigs, source, fallback);
  }

  function newLeadDraft(): LeadDraft {
    const source = sourceOptions[0] || leadSources[0];
    return { ...emptyLead, source, centerName: centerOptions[0] || '', priorityLevel: priorityForSource(source) };
  }

  async function saveLead() {
    setError('');
    setSaveMessage('');
    const displayName = leadDisplayName(editing || {});
    if (!displayName || !editing?.phone) {
      setError('Tên phụ huynh hoặc tên học sinh và số điện thoại là bắt buộc.');
      return;
    }
    if (editing.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editing.email)) {
      setError('Email không hợp lệ.');
      return;
    }
    if (isReferralLead(editing) && !String(editing.referralPhone || '').trim()) {
      setError('Lead source Referral cần có SĐT phụ huynh/người giới thiệu.');
      return;
    }
    if (editing.appointmentKind && !editing.appointmentTime) {
      setError('Vui lòng chọn ngày giờ lịch hẹn.');
      return;
    }
    if (isConsultationStatus(editing.status) && (editing.appointmentKind !== APPT_CONSULTATION || !editing.appointmentTime)) {
      setError('Lead ở trạng thái Đã hẹn tư vấn cần có lịch tư vấn ngày + giờ.');
      return;
    }
    if (editing.status === LOST_LEAD_STATUS && !String(editing.lostReason || '').trim()) {
      setError('Vui lòng chọn lý do mất lead.');
      return;
    }
    if (editing.status === DEAL_QUOTED_STATUS && !String(editing.pendingReason || '').trim()) {
      setError('Vui lòng chọn lý do pending khi chuyển sang Đã báo phí/Chờ chốt.');
      return;
    }

    const selectedSales = salesOptions.find((sales) => sales.id === editing.assignedTo);
    let payload: LeadDraft = {
      ...editing,
      fullName: displayName,
      assignedToName: canAssign ? (selectedSales?.fullName || '') : editing.assignedToName,
      priorityLevel: priorityForSource(editing.source, editing.priorityLevel),
      pendingWarmthPercent: warmthPercent(editing),
      pendingReasonNote: editing.pendingReasonNote || pendingOption(editing.pendingReason)?.defaultNote || '',
      lostNote: editing.lostNote || lostReasonDefaultNote(editing.lostReason),
      followUpDate: editing.appointmentKind === APPT_CALLBACK ? editing.appointmentTime : '',
      consultationDate: editing.appointmentKind === APPT_CONSULTATION || editing.appointmentKind === APPT_TEST ? editing.appointmentTime : '',
    };
    payload = applyFinanceDefaults(payload);
    const { appointmentKind, appointmentTime, appointmentNote, ...leadPayload } = payload;
    void appointmentKind;
    void appointmentTime;
    void appointmentNote;

    try {
      const savedLeads = await leadService.saveLead(leadPayload as Partial<Lead>);
      const savedLead =
        savedLeads.find((lead) => payload.id && lead.id === payload.id) ||
        savedLeads.find((lead) => lead.fullName === payload.fullName && lead.phone === payload.phone);

      if (savedLead && payload.appointmentKind && payload.appointmentTime) {
        const appointment = await appointmentService.upsertLeadAppointment({
          leadId: savedLead.id,
          leadName: savedLead.fullName,
          phone: savedLead.phone,
          type: payload.appointmentKind,
          startTime: payload.appointmentTime,
          assignedTo: savedLead.assignedTo,
          assignedToName: savedLead.assignedToName,
          notes: editing.appointmentNote || (payload.appointmentKind === APPT_CALLBACK
            ? 'Cần gọi lại / follow-up lead.'
            : `${payload.appointmentKind} - ${savedLead.interestedCourse || 'Chưa chọn khóa'}`),
        });
        await appointmentService.deleteOtherForLead(savedLead.id, appointment.id);
      }
      if (savedLead && !payload.appointmentKind) {
        await appointmentService.deleteAllForLead(savedLead.id);
      }

      setEditing(null);
      setSaveMessage('Đã lưu lead thành công.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? `Không ghi được Firestore: ${err.message}` : 'Không lưu được lead.');
    }
  }

  async function removeLead(id: string) {
    if (!confirm('Xóa lead này?')) return;
    await leadService.deleteLead(id);
    await refresh();
  }

  async function callLead(lead: Lead) {
    await startOutboundCall(lead);
    await refreshCallLogs();
  }

  async function addQuickLead() {
    setError('');
    setSaveMessage('');
    const parentName = quickLead.parentName.trim();
    const studentName = quickLead.studentName.trim();
    const fullName = studentName || parentName;
    const phone = quickLead.phone.trim();
    if (!fullName || !phone) {
      setError('Vui lòng nhập tên phụ huynh hoặc tên học sinh và số điện thoại.');
      return;
    }
    const selectedSales = salesOptions.find((sales) => sales.id === quickLead.assignedTo);
    const timestamp = new Date().toISOString();
    const source = sourceOptions[0] || leadSources[0];
    const centerName = quickLead.centerName || centerOptions[0] || '';
    try {
      await leadService.saveLead({
        ...emptyLead,
        fullName,
        parentName,
        studentName,
        phone,
        source,
        centerName,
        priorityLevel: priorityForSource(source),
        assignedTo: selectedSales?.id || '',
        assignedToName: selectedSales?.fullName || '',
        assignedBy: selectedSales ? user?.id : '',
        assignedAt: selectedSales ? timestamp : '',
        assignedStatus: selectedSales ? 'active' : 'unassigned',
        ...(selectedSales ? { assignedAtMs: Date.now() } : {}),
      });
      setQuickLead({ parentName: '', studentName: '', phone: '', centerName: '', assignedTo: '' });
      setSaveMessage('Đã thêm lead mới.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? `Không ghi được Firestore: ${err.message}` : 'Không thêm được lead.');
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold text-slate-950 sm:text-3xl">Leads CRM</h1>
          <p className="text-sm text-slate-500 sm:text-base">Quản lý lead tuyển sinh, phân sale và lịch follow-up.</p>
        </div>
        <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
          <div className="col-span-2 inline-flex w-full rounded-lg border border-slate-200 bg-slate-50 p-1 sm:col-span-1 sm:w-auto">
            <button type="button" onClick={() => setView('table')} className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold sm:flex-none ${view === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <List size={15} /> Table
            </button>
            <button type="button" onClick={() => setView('kanban')} className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold sm:flex-none ${view === 'kanban' ? 'bg-[#003B7A] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <LayoutGrid size={15} /> Kanban
            </button>
          </div>
          <Button variant="outline" className="w-full sm:w-auto" onClick={() => exportCsv('metta-leads.csv', filtered as unknown as Record<string, unknown>[])}>
            <Download /> Export CSV
          </Button>
          {hasMore && <Button variant="outline" className="w-full sm:w-auto" onClick={() => void loadMore()} disabled={loadingMore}>
            <RefreshCcw className={loadingMore ? 'animate-spin' : ''} /> {loadingMore ? 'Đang tải' : 'Tải thêm lead'}
          </Button>}
          {canAssign && <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowSourceSettings((current) => !current)}>
            Source priority
          </Button>}
          {canAssign && <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowCenterSettings((current) => !current)}>
            Trung tâm
          </Button>}
          {canAssign && <Button className="w-full sm:w-auto" onClick={() => setEditing(newLeadDraft())}><Plus /> Thêm lead</Button>}
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-3 sm:p-4 md:grid-cols-6">
          {canAssign && <div className="md:col-span-6">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-xs font-bold uppercase text-slate-500">Nhập lead nhanh</div>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm md:hidden"
                aria-expanded={quickLeadOpen}
                onClick={() => setQuickLeadOpen((open) => !open)}
              >
                {quickLeadOpen ? 'Thu gọn' : 'Mở'}
                <ChevronDown className={`h-4 w-4 transition-transform ${quickLeadOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
            <div className={`${quickLeadOpen ? 'grid' : 'hidden'} gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 md:grid md:grid-cols-[1fr_1fr_1fr_180px_220px_auto]`}>
              <Input placeholder="Tên phụ huynh" value={quickLead.parentName} onChange={(event) => setQuickLead({ ...quickLead, parentName: event.target.value })} />
              <Input placeholder="Tên học sinh" value={quickLead.studentName} onChange={(event) => setQuickLead({ ...quickLead, studentName: event.target.value })} />
              <Input placeholder="Số điện thoại" value={quickLead.phone} onChange={(event) => setQuickLead({ ...quickLead, phone: event.target.value })} />
              <Select value={quickLead.centerName} onChange={(event) => setQuickLead({ ...quickLead, centerName: event.target.value })}>
                <option value="">Trung tâm --</option>
                {centerOptions.map((center) => <option key={center} value={center}>{center}</option>)}
              </Select>
              <Select value={quickLead.assignedTo} onChange={(event) => setQuickLead({ ...quickLead, assignedTo: event.target.value })}>
                <option value="">PIC --</option>
                {salesOptions.map((sales) => <option key={sales.id} value={sales.id}>{sales.fullName}</option>)}
              </Select>
              <Button onClick={addQuickLead}><Plus /> Thêm lead</Button>
            </div>
          </div>}
          <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2 md:hidden">
            <div className="min-w-0">
              <p className="text-xs font-extrabold uppercase text-slate-500">Bộ lọc leads</p>
              <p className="text-[11px] font-semibold text-slate-400">
                {activeFilterCount ? `${activeFilterCount} filter đang bật` : 'Thu gọn, chỉ mở khi cần lọc'}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {activeFilterCount > 0 && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-600 shadow-sm"
                >
                  Xóa
                </button>
              )}
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-bold text-slate-700 shadow-sm"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((open) => !open)}
              >
                {filtersOpen ? 'Thu gọn' : 'Mở filter'}
                <ChevronDown className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
              </button>
            </div>
          </div>
          <Input placeholder="Search học sinh / phụ huynh / SĐT / email" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
          <div className={`${filtersOpen ? 'grid' : 'hidden'} gap-3 md:contents`}>
          <Select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="">Tất cả status</option>
            {leadStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </Select>
          <Select value={filters.source} onChange={(event) => setFilters({ ...filters, source: event.target.value })}>
            <option value="">Tất cả source</option>
            {sourceOptions.map((source) => <option key={source} value={source}>{sourceLabel(source)}</option>)}
          </Select>
          <Select value={filters.centerName} onChange={(event) => setFilters({ ...filters, centerName: event.target.value })}>
            <option value="">Tất cả trung tâm</option>
            {centerOptions.map((center) => <option key={center} value={center}>{center}</option>)}
          </Select>
          <Select value={filters.priorityLevel} onChange={(event) => setFilters({ ...filters, priorityLevel: event.target.value })}>
            <option value="">Tất cả ưu tiên</option>
            {[5, 4, 3, 2, 1].map((level) => <option key={level} value={level}>P{level}{level === 5 ? ' - cao nhất' : ''}</option>)}
          </Select>
          <Select value={filters.course} onChange={(event) => setFilters({ ...filters, course: event.target.value })}>
            <option value="">Tất cả khóa</option>
            {courseOptions.map((course) => <option key={course} value={course}>{course}</option>)}
          </Select>
          <Select value={filters.assignedTo} onChange={(event) => setFilters({ ...filters, assignedTo: event.target.value })}>
            <option value="">Tất cả sales</option>
            {salesOptions.map((sales) => <option key={sales.id} value={sales.id}>{sales.fullName}</option>)}
          </Select>
          <DateRangePicker
            from={filters.dateFrom}
            to={filters.dateTo}
            onChange={(dateFrom, dateTo) => setFilters({ ...filters, dateFrom, dateTo })}
            placeholder="Khoảng ngày tạo"
          />
          </div>
        </CardContent>
      </Card>

      {saveMessage && <div className="rounded-lg bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{saveMessage}</div>}
      {error && !editing && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}
      {showSourceSettings && (
        <SourcePriorityPanel
          configs={sourceConfigs}
          onSave={async (configs) => {
            setError('');
            setSaveMessage('');
            try {
              const saved = await sourceConfigService.saveConfigs(configs);
              setSourceConfigs(saved);
              setSaveMessage('Đã lưu cấu hình source và cấp độ ưu tiên.');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Không lưu được cấu hình source.');
            }
          }}
        />
      )}
      {showCenterSettings && (
        <CenterSettingsPanel
          configs={centerConfigs}
          onSave={async (configs) => {
            setError('');
            setSaveMessage('');
            try {
              const saved = await centerConfigService.saveConfigs(configs);
              setCenterConfigs(saved);
              setSaveMessage('Đã lưu danh sách trung tâm.');
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Không lưu được danh sách trung tâm.');
            }
          }}
        />
      )}
      {editing && (
        <LeadForm
          value={editing}
          setValue={setEditing}
          onSave={saveLead}
          onCancel={() => setEditing(null)}
          error={error}
          salesOptions={salesOptions}
          canAssign={canAssign}
          courseOptions={courseOptions}
          sourceOptions={sourceOptions}
          centerOptions={centerOptions}
          priorityForSource={priorityForSource}
        />
      )}

      {view === 'table' ? (
        <LeadsTable leads={filtered} canAssign={canAssign} onEdit={(lead) => setEditing(toDraft(lead))} onDetail={setDetailLead} onDelete={removeLead} onCall={callLead} callLogs={callLogs} sourceConfigs={sourceConfigs} />
      ) : (
        <Kanban leads={filtered} salesOptions={salesOptions} canAssign={canAssign} refresh={refresh} sourceConfigs={sourceConfigs} sourceOptions={sourceOptions} centerOptions={centerOptions} focusLeadId={focusLeadId} onOpenDetail={setDetailLead} onCall={callLead} callLogs={callLogs} />
      )}

      {detailLead && (
        <LeadDetailModal
          lead={detailLead}
          onClose={() => setDetailLead(null)}
          refresh={refresh}
          salesOptions={salesOptions}
          canAssign={canAssign}
          courseOptions={courseOptions}
          sourceOptions={sourceOptions}
          centerOptions={centerOptions}
          sourceConfigs={sourceConfigs}
          priorityForSource={priorityForSource}
          onCall={callLead}
          callLogs={callLogs}
        />
      )}
    </div>
  );
}

function LeadForm({
  value,
  setValue,
  onSave,
  onCancel,
  error,
  salesOptions,
  canAssign,
  courseOptions,
  sourceOptions,
  centerOptions,
  priorityForSource,
}: {
  value: LeadDraft;
  setValue: (value: LeadDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  error?: string;
  salesOptions: AdminUser[];
  canAssign: boolean;
  courseOptions: string[];
  sourceOptions: string[];
  centerOptions: string[];
  priorityForSource: (source?: string, fallback?: number) => LeadPriorityLevel;
}) {
  const set = (key: keyof LeadDraft, val: string) => setValue({ ...value, [key]: val });
  const isConsultation = isConsultationStatus(value.status);
  const isQuoted = value.status === DEAL_QUOTED_STATUS;
  const isWon = value.status === WON_LEAD_STATUS;
  const showFinance = isQuoted || isWon;

  function setCourse(course: string) {
    setValue(applyFinanceDefaults({ ...value, interestedCourse: course }));
  }

  function setStatus(status: Lead['status']) {
    const next = applyFinanceDefaults({ ...value, status });
    if (isConsultationStatus(status)) {
      const appointmentTime = value.consultationDate || value.appointmentTime || defaultAppointmentInput();
      setValue({
        ...next,
        appointmentKind: APPT_CONSULTATION,
        appointmentTime,
        consultationDate: appointmentTime,
        followUpDate: '',
      });
      return;
    }
    setValue(next);
  }

  function setDiscount(discountPercent: number) {
    setValue(applyFinanceDefaults({ ...value, discountPercent }));
  }

  return (
    <Card>
      <CardHeader><CardTitle>{value.id ? 'Sửa lead' : 'Thêm lead'}</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-5">
        {error && <div className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
        <FormSection title="Thông tin liên hệ">
          <Input placeholder="Tên phụ huynh" value={value.parentName || ''} onChange={(event) => set('parentName', event.target.value)} />
          <Input placeholder="Tên học sinh" value={value.studentName || ''} onChange={(event) => set('studentName', event.target.value)} />
          <Input placeholder="Số điện thoại" value={value.phone || ''} onChange={(event) => set('phone', event.target.value)} />
          <Input placeholder="Email" value={value.email || ''} onChange={(event) => set('email', event.target.value)} />
          <Select value={value.contactType || 'parent'} onChange={(event) => set('contactType', event.target.value)}>
            <option value="parent">Phụ huynh</option>
            <option value="student">Học sinh</option>
            <option value="other">Khác</option>
          </Select>
          <Input placeholder="Tuổi" value={value.age || ''} onChange={(event) => set('age', event.target.value)} />
          <Input placeholder="Trường" value={value.school || ''} onChange={(event) => set('school', event.target.value)} />
          <Input placeholder="Lớp hiện tại" value={value.currentClass || ''} onChange={(event) => set('currentClass', event.target.value)} />
        </FormSection>

        <FormSection title="Nhu cầu học">
          <Select value={value.interestedCourse || ''} onChange={(event) => setCourse(event.target.value)}>
            <option value="">Chưa chọn khóa</option>
            {courseOptions.map((course) => <option key={course} value={course}>{course}</option>)}
          </Select>
          <Textarea className="md:col-span-3" placeholder="Ghi chú ban đầu" value={value.initialNote || ''} onChange={(event) => set('initialNote', event.target.value)} />
        </FormSection>

        <FormSection title="CRM & lịch hẹn">
          <Select
            value={value.source || sourceOptions[0] || leadSources[0]}
            onChange={(event) => {
              const source = event.target.value;
              setValue({ ...value, source, priorityLevel: priorityForSource(source, value.priorityLevel) });
            }}
          >
            {sourceOptions.map((source) => <option key={source} value={source}>{sourceLabel(source)}</option>)}
          </Select>
          {isReferralLead(value) && (
            <Input
              placeholder="SĐT phụ huynh/người referral"
              value={value.referralPhone || ''}
              onChange={(event) => set('referralPhone', event.target.value)}
            />
          )}
          <Select value={value.centerName || ''} onChange={(event) => set('centerName', event.target.value)}>
            <option value="">Chọn trung tâm/cơ sở</option>
            {centerOptions.map((center) => <option key={center} value={center}>{center}</option>)}
          </Select>
          <Select value={value.status || leadStatuses[0]} onChange={(event) => setStatus(event.target.value as Lead['status'])}>
            {leadStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </Select>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
            Cấp độ ưu tiên: {priorityLabel(priorityForSource(value.source, value.priorityLevel))}
          </div>
          <Select
            value={value.assignedTo || ''}
            disabled={!canAssign}
            onChange={(event) => {
              const sales = salesOptions.find((item) => item.id === event.target.value);
              setValue({ ...value, assignedTo: sales?.id || '', assignedToName: sales?.fullName || '' });
            }}
          >
            <option value="">Chọn sales phụ trách</option>
            {salesOptions.map((sales) => <option key={sales.id} value={sales.id}>{sales.fullName}</option>)}
          </Select>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Loại lịch</label>
            <Select value={value.appointmentKind || ''} onChange={(event) => {
              const nextKind = event.target.value as AppointmentKind;
              setValue({
                ...value,
                appointmentKind: nextKind,
                appointmentTime: nextKind === APPT_CONSULTATION || nextKind === APPT_TEST
                  ? value.consultationDate || value.appointmentTime || ''
                  : nextKind === APPT_CALLBACK
                    ? value.followUpDate || value.appointmentTime || ''
                    : '',
                followUpDate: nextKind === APPT_CALLBACK ? value.followUpDate : '',
                consultationDate: nextKind === APPT_CONSULTATION || nextKind === APPT_TEST ? value.consultationDate : '',
              });
            }}>
              <option value="">Không đặt lịch</option>
              <option value={APPT_CALLBACK}>Gọi lại / follow-up</option>
              <option value={APPT_CONSULTATION}>Tư vấn</option>
              <option value={APPT_TEST}>Test đầu vào</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Ngày giờ lịch hẹn</label>
            <Input
              type="datetime-local"
              value={localDateTimeInput(value.appointmentTime)}
              onChange={(event) => {
                const time = event.target.value;
                setValue({
                  ...value,
                  appointmentTime: time,
                  followUpDate: value.appointmentKind === APPT_CALLBACK ? time : '',
                  consultationDate: value.appointmentKind === APPT_CONSULTATION || value.appointmentKind === APPT_TEST ? time : '',
                });
              }}
              disabled={!value.appointmentKind}
              className={isConsultation && value.appointmentKind !== APPT_CONSULTATION ? 'border-orange-400 bg-orange-50' : ''}
            />
          </div>
          <Textarea className="md:col-span-3" placeholder="Note appointment hiển thị trong Appointments" value={value.appointmentNote || ''} onChange={(event) => set('appointmentNote', event.target.value)} />
        </FormSection>

        {(showFinance || value.status === LOST_LEAD_STATUS) && (
          <FormSection title="Finance / enrollment">
            {isQuoted && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Deal size</label>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800">
                    {formatCurrency(value.dealSize || financeDefaultsForLead(value).dealSize, value.dealCurrency || DEFAULT_DEAL_CURRENCY)}
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">% discount</label>
                  <Select value={String(value.discountPercent || financeDefaultsForLead(value).discountPercent)} onChange={(event) => setDiscount(Number(event.target.value))}>
                    {discountPercentOptions.map((percent) => <option key={percent} value={percent}>{percent}%</option>)}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Expected revenue</label>
                  <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-700">
                    {formatCurrency(quoteValue(value), value.dealCurrency || DEFAULT_DEAL_CURRENCY)}
                  </div>
                </div>
              </>
            )}
            {isWon && (
              <div className="md:col-span-3">
                <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Revenue</label>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
                  {formatCurrency(wonValue(value), value.dealCurrency || DEFAULT_DEAL_CURRENCY)}
                </div>
              </div>
            )}
            {showFinance && (
              <>
                <Input placeholder="Gói học / học phí dự kiến" value={value.dealPackage || ''} onChange={(event) => set('dealPackage', event.target.value)} />
                <Input type="date" value={value.expectedCloseDate || ''} onChange={(event) => set('expectedCloseDate', event.target.value)} />
              </>
            )}
            {value.status === LOST_LEAD_STATUS && (
              <Select
                value={value.lostReason || ''}
                onChange={(event) => {
                  const reason = event.target.value;
                  setValue({
                    ...value,
                    lostReason: reason,
                    lostNote: value.lostNote || lostReasonDefaultNote(reason),
                  });
                }}
              >
                <option value="">Chọn lý do mất lead</option>
                {lostReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
              </Select>
            )}
            {isQuoted && (
              <>
                <Select
                  value={value.pendingReason || ''}
                  onChange={(event) => {
                    const reason = event.target.value;
                    const option = pendingOption(reason);
                    setValue({
                      ...applyFinanceDefaults(value),
                      pendingReason: reason,
                      pendingWarmthPercent: option?.warmthPercent || 0,
                      pendingReasonNote: value.pendingReasonNote || option?.defaultNote || '',
                    });
                  }}
                >
                  <option value="">Chọn lý do pending</option>
                  {pendingReasonOptions.map((option) => (
                    <option key={option.reason} value={option.reason}>{option.reason} ({option.warmthPercent}%)</option>
                  ))}
                </Select>
                <div className={`rounded-lg border px-3 py-2 text-sm font-bold ${warmthTone(warmthPercent(value))}`}>
                  Warmth: {warmthPercent(value)}%
                </div>
                <Textarea className="md:col-span-3" placeholder="Ghi chú pending để sales bổ sung thêm" value={value.pendingReasonNote || pendingOption(value.pendingReason)?.defaultNote || ''} onChange={(event) => set('pendingReasonNote', event.target.value)} />
              </>
            )}
            {showFinance && <Textarea className="md:col-span-3" placeholder="Note deal / báo phí / điều kiện chốt" value={value.dealNote || ''} onChange={(event) => set('dealNote', event.target.value)} />}
            {value.status === LOST_LEAD_STATUS && (
              <Textarea className="md:col-span-3" placeholder="Ghi chú thêm về lý do mất lead" value={value.lostNote || ''} onChange={(event) => set('lostNote', event.target.value)} />
            )}
          </FormSection>
        )}

        <div className="flex gap-2">
          <Button onClick={onSave}><Save /> Lưu lead</Button>
          <Button variant="outline" onClick={onCancel}>Hủy</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LeadDetailModal({
  lead,
  onClose,
  refresh,
  salesOptions,
  canAssign,
  courseOptions,
  sourceOptions,
  centerOptions,
  sourceConfigs,
  priorityForSource,
  onCall,
  callLogs,
}: {
  lead: Lead;
  onClose: () => void;
  refresh: () => Promise<void>;
  salesOptions: AdminUser[];
  canAssign: boolean;
  courseOptions: string[];
  sourceOptions: string[];
  centerOptions: string[];
  sourceConfigs: LeadSourceConfig[];
  priorityForSource: (source?: string, fallback?: number) => LeadPriorityLevel;
  onCall: (lead: Lead) => void | Promise<void>;
  callLogs: CallLog[];
}) {
  const [draft, setDraft] = useState<LeadDraft>(() => toDraft(lead));
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [tab, setTab] = useState<'overview' | 'timeline' | 'appointments' | 'notes'>('overview');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadRelated() {
    const [nextActivities, nextAppointments] = await Promise.all([
      leadService.getActivities(lead.id),
      appointmentService.getByLead(lead.id),
    ]);
    setActivities(nextActivities);
    setAppointments(nextAppointments);
  }

  useEffect(() => {
    setDraft(toDraft(lead));
    setError('');
    setMessage('');
    void loadRelated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id, lead.updatedAt]);

  async function saveDetail() {
    if (saving) return;
    setError('');
    setMessage('');
    const displayName = leadDisplayName(draft);
    if (!displayName || !draft.phone) {
      setError('Tên phụ huynh hoặc tên học sinh và số điện thoại là bắt buộc.');
      return;
    }
    if (draft.appointmentKind && !draft.appointmentTime) {
      setError('Vui lòng chọn ngày giờ lịch hẹn.');
      return;
    }
    if (isReferralLead(draft) && !String(draft.referralPhone || '').trim()) {
      setError('Lead source Referral cần có SĐT phụ huynh/người giới thiệu.');
      return;
    }
    if (isConsultationStatus(draft.status) && (draft.appointmentKind !== APPT_CONSULTATION || !draft.appointmentTime)) {
      setError('Lead ở trạng thái Đã hẹn tư vấn cần có lịch tư vấn ngày + giờ.');
      return;
    }
    if (draft.status === LOST_LEAD_STATUS && !String(draft.lostReason || '').trim()) {
      setError('Vui lòng chọn lý do mất lead.');
      return;
    }
    if (draft.status === DEAL_QUOTED_STATUS && !String(draft.pendingReason || '').trim()) {
      setError('Vui lòng chọn lý do pending khi chuyển sang Đã báo phí/Chờ chốt.');
      return;
    }

    const selectedSales = salesOptions.find((sales) => sales.id === draft.assignedTo);
    let payload: LeadDraft = {
      ...draft,
      fullName: displayName,
      assignedToName: canAssign ? (selectedSales?.fullName || '') : draft.assignedToName,
      priorityLevel: priorityForSource(draft.source, draft.priorityLevel),
      pendingWarmthPercent: warmthPercent(draft),
      pendingReasonNote: draft.pendingReasonNote || pendingOption(draft.pendingReason)?.defaultNote || '',
      lostNote: draft.lostNote || lostReasonDefaultNote(draft.lostReason),
      followUpDate: draft.appointmentKind === APPT_CALLBACK ? draft.appointmentTime : '',
      consultationDate: draft.appointmentKind === APPT_CONSULTATION || draft.appointmentKind === APPT_TEST ? draft.appointmentTime : '',
    };
    payload = applyFinanceDefaults(payload);
    const { appointmentKind, appointmentTime, appointmentNote, ...leadPayload } = payload;
    void appointmentKind;
    void appointmentTime;
    void appointmentNote;

    setSaving(true);
    try {
      const savedLeads = await leadService.saveLead(leadPayload as Partial<Lead>);
      const savedLead = savedLeads.find((item) => item.id === lead.id) || ({ ...lead, ...leadPayload } as Lead);

      if (payload.appointmentKind && payload.appointmentTime) {
        const appointment = await appointmentService.upsertLeadAppointment({
          leadId: savedLead.id,
          leadName: leadDisplayName(savedLead),
          phone: savedLead.phone,
          type: payload.appointmentKind,
          startTime: payload.appointmentTime,
          assignedTo: savedLead.assignedTo,
          assignedToName: savedLead.assignedToName,
          notes: draft.appointmentNote || (payload.appointmentKind === APPT_CALLBACK
            ? 'Cần gọi lại / follow-up lead.'
            : `${payload.appointmentKind} - ${savedLead.interestedCourse || 'Chưa chọn khóa'}`),
        });
        await appointmentService.deleteOtherForLead(savedLead.id, appointment.id);
        await leadService.addActivity({
          leadId: savedLead.id,
          type: payload.appointmentKind === APPT_CONSULTATION ? 'consultation' : 'note',
          content: `Cập nhật lịch ${payload.appointmentKind} ${formatDate(appointment.startTime, true)}.`,
        });
      } else {
        await appointmentService.deleteAllForLead(savedLead.id);
      }

      setDraft(toDraft(savedLead));
      await refresh();
      await loadRelated();
      setMessage('Đã lưu lead và cập nhật timeline.');
    } catch (err) {
      setError(err instanceof Error ? `Không lưu được lead: ${err.message}` : 'Không lưu được lead.');
    } finally {
      setSaving(false);
    }
  }

  async function updateAppointmentStatus(appointment: Appointment, status: Appointment['status']) {
    if (appointment.status === status) return;
    await appointmentService.updateStatus(appointment.id, status);
    await leadService.addActivity({
      leadId: lead.id,
      type: 'note',
      content: `Cập nhật trạng thái appointment "${appointment.type}" thành "${status}".`,
    });
    await loadRelated();
  }

  const timeline = buildLeadTimeline(draft as Lead, activities, appointments);
  const leadCallLogs = useMemo(() => callLogs.filter((log) => log.leadId === lead.id), [callLogs, lead.id]);
  const toneClass: Record<string, string> = {
    blue: 'border-blue-300 bg-blue-50 text-blue-700',
    cyan: 'border-cyan-300 bg-cyan-50 text-cyan-700',
    green: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    orange: 'border-orange-300 bg-orange-50 text-orange-700',
    red: 'border-red-300 bg-red-50 text-red-700',
    purple: 'border-violet-300 bg-violet-50 text-violet-700',
    gray: 'border-slate-300 bg-slate-50 text-slate-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-extrabold text-slate-950">{draft.studentName || draft.fullName}</h2>
            <p className="truncate text-sm text-slate-500">
              {draft.parentName ? `Phụ huynh: ${draft.parentName} · ` : ''}{draft.phone}{draft.email ? ` · ${draft.email}` : ''}{draft.centerName ? ` · ${draft.centerName}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void onCall(draft as Lead)} disabled={!draft.phone}>
              <PhoneCall size={16} /> Gọi
            </Button>
            <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={onClose} title="Đóng">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="border-b border-slate-100 px-5 py-3">
          <TabsList>
            <TabsTrigger active={tab === 'overview'} onClick={() => setTab('overview')}>Tổng quan</TabsTrigger>
            <TabsTrigger active={tab === 'timeline'} onClick={() => setTab('timeline')}>Timeline tư vấn</TabsTrigger>
            <TabsTrigger active={tab === 'appointments'} onClick={() => setTab('appointments')}>Appointments</TabsTrigger>
            <TabsTrigger active={tab === 'notes'} onClick={() => setTab('notes')}>Ghi chú</TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/60 p-5">
          {message && <div className="mb-3 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{message}</div>}
          {tab === 'overview' && (
            <LeadForm
              value={draft}
              setValue={setDraft}
              onSave={saveDetail}
              onCancel={onClose}
              error={error || (saving ? 'Đang lưu...' : '')}
              salesOptions={salesOptions}
              canAssign={canAssign}
              courseOptions={courseOptions}
              sourceOptions={sourceOptions}
              centerOptions={centerOptions}
              priorityForSource={priorityForSource}
            />
          )}

          {tab === 'timeline' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock size={18} /> Timeline tư vấn</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {leadCallLogs.length > 0 && (
                  <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                    <p className="mb-2 text-sm font-extrabold text-blue-800">Call logs Stringee</p>
                    <div className="grid gap-2">
                      {leadCallLogs.slice(0, 6).map((log) => (
                        <div key={log.id} className="flex flex-col justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm md:flex-row md:items-center">
                          <span className="font-semibold text-slate-700">{callLogText(log)}</span>
                          {log.recordingUrl && (
                            <a className="text-xs font-bold text-[#003B7A] hover:underline" href={callCenterService.recordingProxyUrl(log)} target="_blank" rel="noreferrer">
                              Ghi âm
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {timeline.length === 0 && <p className="text-sm text-slate-500">Chưa có dữ liệu timeline.</p>}
                {timeline.map((event) => (
                  <div key={event.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-[150px_1fr]">
                    <div>
                      <p className="text-xs font-bold text-slate-400">{formatDate(event.at, true)}</p>
                      <span className={`mt-2 inline-flex rounded border px-2 py-0.5 text-[11px] font-bold ${toneClass[event.tone] || toneClass.gray}`}>{event.label}</span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-950">{event.title}</p>
                      {event.description && <p className="mt-1 text-sm text-slate-600">{event.description}</p>}
                      {event.meta && <p className="mt-2 text-xs font-semibold italic text-slate-500">{event.meta}</p>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {tab === 'appointments' && (
            <Card>
              <CardHeader><CardTitle>Lịch hẹn của lead</CardTitle></CardHeader>
              <CardContent className="flex flex-col gap-3">
                {appointments.length === 0 && <p className="text-sm text-slate-500">Chưa có appointment nào.</p>}
                {appointments.map((appointment) => (
                  <div key={appointment.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
                      <div>
                        <p className="font-bold text-slate-950">{appointment.type} · {appointment.title}</p>
                        <p className="text-sm text-slate-500">{formatDate(appointment.startTime, true)} · PIC: {appointment.assignedToName || appointment.assignedTo || '-'}</p>
                      </div>
                      <Select className="w-40" value={appointment.status} onChange={(event) => void updateAppointmentStatus(appointment, event.target.value as Appointment['status'])}>
                        <option value="upcoming">Sắp diễn ra</option>
                        <option value="done">Hoàn thành</option>
                        <option value="cancelled">Đã hủy</option>
                        <option value="overdue">Quá hạn</option>
                      </Select>
                    </div>
                    {appointment.notes && <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-600">{appointment.notes}</p>}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {tab === 'notes' && (
            <Card>
              <CardHeader><CardTitle>Ghi chú</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs font-bold uppercase text-slate-500">Ghi chú ban đầu</p>
                  <Textarea rows={6} value={draft.initialNote || ''} onChange={(event) => setDraft({ ...draft, initialNote: event.target.value })} />
                </div>
                <div>
                  <p className="mb-1 text-xs font-bold uppercase text-slate-500">Note deal / pending / mất lead</p>
                  <Textarea rows={6} value={draft.dealNote || draft.pendingReasonNote || draft.lostNote || ''} onChange={(event) => setDraft({ ...draft, dealNote: event.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Button onClick={() => void saveDetail()} disabled={saving}><Save /> {saving ? 'Đang lưu...' : 'Lưu ghi chú'}</Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function SourcePriorityPanel({
  configs,
  onSave,
}: {
  configs: LeadSourceConfig[];
  onSave: (configs: LeadSourceConfig[]) => void | Promise<void>;
}) {
  const [drafts, setDrafts] = useState<LeadSourceConfig[]>(configs);

  useEffect(() => {
    setDrafts(configs);
  }, [configs]);

  function update(id: string, patch: Partial<LeadSourceConfig>) {
    setDrafts((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function addSource() {
    const now = new Date().toISOString();
    setDrafts((current) => [
      ...current,
      {
        id: `source-${Date.now()}`,
        name: '',
        priorityLevel: 3,
        description: '',
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  }

  function removeSource(id: string) {
    setDrafts((current) => current.filter((item) => item.id !== id));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cấu hình source & cấp độ ưu tiên</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 text-xs font-bold uppercase text-slate-500 md:grid-cols-[1.2fr_2fr_150px_90px_48px]">
          <span>Nguồn lead</span>
          <span>Mô tả chi tiết</span>
          <span>Ưu tiên</span>
          <span>Active</span>
          <span />
        </div>
        {drafts.map((source) => (
          <div key={source.id} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2 md:grid-cols-[1.2fr_2fr_150px_90px_48px]">
            <Input value={source.name} placeholder="VD: Meta Lead Form" onChange={(event) => update(source.id, { name: event.target.value })} />
            <Input value={source.description} placeholder="Mô tả cách nhận diện nguồn lead" onChange={(event) => update(source.id, { description: event.target.value })} />
            <Select value={String(source.priorityLevel)} onChange={(event) => update(source.id, { priorityLevel: Number(event.target.value) as LeadPriorityLevel })}>
              {[5, 4, 3, 2, 1].map((level) => <option key={level} value={level}>P{level}{level === 5 ? ' - cao nhất' : ''}</option>)}
            </Select>
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600">
              <input type="checkbox" checked={source.active} onChange={(event) => update(source.id, { active: event.target.checked })} />
              Bật
            </label>
            <button type="button" className="inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => removeSource(source.id)} title="Xóa source">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={addSource}><Plus /> Thêm source</Button>
          <Button onClick={() => onSave(drafts.filter((source) => source.name.trim()))}><Save /> Lưu cấu hình</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CenterSettingsPanel({
  configs,
  onSave,
}: {
  configs: LeadCenterConfig[];
  onSave: (configs: LeadCenterConfig[]) => void | Promise<void>;
}) {
  const [drafts, setDrafts] = useState<LeadCenterConfig[]>(configs);

  useEffect(() => {
    setDrafts(configs);
  }, [configs]);

  function update(id: string, patch: Partial<LeadCenterConfig>) {
    setDrafts((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function addCenter() {
    const now = new Date().toISOString();
    setDrafts((current) => [
      ...current,
      {
        id: `center-${Date.now()}`,
        name: '',
        address: '',
        description: '',
        active: true,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  }

  function removeCenter(id: string) {
    setDrafts((current) => current.filter((item) => item.id !== id));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cấu hình trung tâm / cơ sở</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="grid gap-2 text-xs font-bold uppercase text-slate-500 md:grid-cols-[1fr_1.6fr_1.6fr_90px_48px]">
          <span>Tên trung tâm</span>
          <span>Địa chỉ</span>
          <span>Ghi chú</span>
          <span>Active</span>
          <span />
        </div>
        {drafts.map((center) => (
          <div key={center.id} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2 md:grid-cols-[1fr_1.6fr_1.6fr_90px_48px]">
            <Input value={center.name} placeholder="VD: METTA Quận 1" onChange={(event) => update(center.id, { name: event.target.value })} />
            <Input value={center.address} placeholder="Địa chỉ cơ sở" onChange={(event) => update(center.id, { address: event.target.value })} />
            <Input value={center.description} placeholder="Ghi chú khu vực / tuyến đường / đối tượng phù hợp" onChange={(event) => update(center.id, { description: event.target.value })} />
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600">
              <input type="checkbox" checked={center.active} onChange={(event) => update(center.id, { active: event.target.checked })} />
              Bật
            </label>
            <button type="button" className="inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => removeCenter(center.id)} title="Xóa trung tâm">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={addCenter}><Plus /> Thêm trung tâm</Button>
          <Button onClick={() => onSave(drafts.filter((center) => center.name.trim()))}><Save /> Lưu trung tâm</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LeadsTable({
  leads,
  canAssign,
  onEdit,
  onDetail,
  onDelete,
  onCall,
  callLogs,
  sourceConfigs,
}: {
  leads: Lead[];
  canAssign: boolean;
  onEdit: (lead: Lead) => void;
  onDetail: (lead: Lead) => void;
  onDelete: (id: string) => void;
  onCall: (lead: Lead) => void | Promise<void>;
  callLogs: CallLog[];
  sourceConfigs: LeadSourceConfig[];
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <THead>
            <TR><TH>Lead</TH><TH>SĐT</TH><TH>Email</TH><TH>Khóa quan tâm</TH><TH>Trung tâm</TH><TH>Ưu tiên</TH><TH>Trạng thái</TH><TH>Deal</TH><TH>Nguồn</TH><TH>Người phụ trách</TH><TH>Follow-up</TH><TH>Ngày tạo</TH><TH>Action</TH></TR>
          </THead>
          <TBody>
            {leads.map((lead) => (
              <TR key={lead.id}>
                <TD>
                  <button type="button" className="font-semibold text-slate-900 hover:text-[#003B7A] hover:underline" onClick={() => onDetail(lead)}>
                    {lead.studentName || lead.fullName}
                  </button>
                  {lead.parentName && <p className="text-xs text-slate-500">PH: {lead.parentName}</p>}
                </TD>
                <TD>
                  <div className="flex items-center gap-2">
                    <span>{lead.phone}</span>
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-[#003B7A] hover:bg-blue-50"
                      onClick={() => void onCall(lead)}
                      title="Gọi lead"
                    >
                      <PhoneCall size={14} />
                    </button>
                  </div>
                  <CallLogInline log={latestCallForLead(callLogs, lead.id)} />
                </TD>
                <TD>{lead.email}</TD>
                <TD>{lead.interestedCourse}</TD>
                <TD>{lead.centerName || '-'}</TD>
                <TD><span className={`rounded border px-2 py-0.5 text-xs font-bold ${priorityTone(priorityForLead(sourceConfigs, lead))}`}>{priorityLabel(priorityForLead(sourceConfigs, lead))}</span></TD>
                <TD><Badge tone={statusTone[statusIndex(lead.status)]}>{statusLabel(lead.status)}</Badge></TD>
                <TD className="font-semibold text-slate-800">
                  {lead.status === WON_LEAD_STATUS
                    ? formatCurrency(wonValue(lead), lead.dealCurrency || DEFAULT_DEAL_CURRENCY)
                    : lead.status === DEAL_QUOTED_STATUS
                      ? formatCurrency(quoteValue(lead), lead.dealCurrency || DEFAULT_DEAL_CURRENCY)
                      : '-'}
                </TD>
                <TD>
                  {sourceLabel(lead.source)}
                  {isReferralLead(lead) && lead.referralPhone && <p className="text-xs font-semibold text-emerald-600">Ref: {lead.referralPhone}</p>}
                </TD>
                <TD>{lead.assignedToName || '-'}</TD>
                <TD>{formatDate(lead.followUpDate, true)}</TD>
                <TD>{formatDate(lead.createdAt)}</TD>
                <TD>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => onEdit(lead)}>Edit</Button>
                    {canAssign && <Button variant="destructive" size="sm" onClick={() => onDelete(lead.id)}><Trash2 /></Button>}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 font-bold text-slate-950">{title}</h3>
      <div className="grid gap-3 md:grid-cols-3">{children}</div>
    </section>
  );
}

function CallLogInline({ log }: { log?: CallLog }) {
  if (!log) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
      <span>Call: {callLogText(log)}</span>
      {log.recordingUrl && (
        <a
          className="font-bold text-[#003B7A] hover:underline"
          href={callCenterService.recordingProxyUrl(log)}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
        >
          Ghi âm
        </a>
      )}
    </div>
  );
}

function Kanban({
  leads,
  salesOptions,
  canAssign,
  refresh,
  sourceConfigs,
  sourceOptions,
  centerOptions,
  focusLeadId,
  onOpenDetail,
  onCall,
  callLogs,
}: {
  leads: Lead[];
  salesOptions: AdminUser[];
  canAssign: boolean;
  refresh: () => Promise<void>;
  sourceConfigs: LeadSourceConfig[];
  sourceOptions: string[];
  centerOptions: string[];
  focusLeadId: string;
  onOpenDetail: (lead: Lead) => void;
  onCall: (lead: Lead) => void | Promise<void>;
  callLogs: CallLog[];
}) {
  const [dragOverStatus, setDragOverStatus] = useState('');
  const [pendingQuote, setPendingQuote] = useState<{ lead: Lead; patch: Partial<Lead> } | null>(null);
  const [pendingLost, setPendingLost] = useState<{ lead: Lead; patch: Partial<Lead> } | null>(null);
  const [pendingAppointment, setPendingAppointment] = useState<{ lead: Lead; patch: Partial<Lead> } | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollState, setScrollState] = useState({ left: 0, max: 0 });
  // Map leadId -> actual appointment type (Tư vấn / Test / Gọi lại) — fetched once để tránh flash
  const [apptTypeByLead, setApptTypeByLead] = useState<Map<string, Appointment['type']>>(new Map());
  const [appointmentsLoaded, setAppointmentsLoaded] = useState(false);

  useEffect(() => {
    setAppointmentsLoaded(false);
    void appointmentService.getAppointments().then((items) => {
      const map = new Map<string, Appointment['type']>();
      // Ưu tiên Test > Tư vấn > Gọi lại nếu một lead có nhiều lịch
      const priority: Record<string, number> = { [APPT_TEST]: 3, [APPT_CONSULTATION]: 2, [APPT_CALLBACK]: 1 };
      for (const ap of items) {
        if (!ap.leadId) continue;
        const existing = map.get(ap.leadId);
        if (!existing || (priority[ap.type] || 0) > (priority[existing] || 0)) {
          map.set(ap.leadId, ap.type);
        }
      }
      setApptTypeByLead(map);
      setAppointmentsLoaded(true);
    }).catch(() => setAppointmentsLoaded(true));
  }, [leads]);

  useEffect(() => {
    const updateScrollState = () => {
      const el = scrollRef.current;
      if (!el) return;
      setScrollState({ left: el.scrollLeft, max: Math.max(el.scrollWidth - el.clientWidth, 0) });
    };
    updateScrollState();
    window.addEventListener('resize', updateScrollState);
    return () => window.removeEventListener('resize', updateScrollState);
  }, [leads.length]);

  function scrollKanban(delta: number) {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollBy({ left: delta, behavior: 'smooth' });
  }

  async function applyLeadPatch(lead: Lead, patch: Partial<Lead>) {
    const confirmedPatch = buildLostReasonPatch(lead, patch);
    if (!confirmedPatch) return;
    const savedLeads = await leadService.saveLead({ ...lead, ...confirmedPatch });
    const savedLead = savedLeads.find((item) => item.id === lead.id) || { ...lead, ...confirmedPatch };
    if (isConsultationStatus(confirmedPatch.status || savedLead.status) && confirmedPatch.consultationDate) {
      const appointment = await appointmentService.upsertLeadAppointment({
        leadId: savedLead.id,
        leadName: leadDisplayName(savedLead),
        phone: savedLead.phone,
        type: APPT_CONSULTATION,
        startTime: confirmedPatch.consultationDate,
        assignedTo: savedLead.assignedTo,
        assignedToName: savedLead.assignedToName,
        notes: confirmedPatch.dealNote || `Tư vấn - ${savedLead.interestedCourse || 'Chưa chọn khóa'}`,
      });
      await appointmentService.deleteOtherForLead(savedLead.id, appointment.id);
      await leadService.addActivity({
        leadId: savedLead.id,
        type: 'consultation',
        content: `Tạo lịch tư vấn ${formatDate(appointment.startTime, true)}.`,
      });
    }
    await refresh();
  }

  async function updateLead(lead: Lead, patch: Partial<Lead>) {
    const nextStatus = patch.status || lead.status;
    const nextIsConsultation = isConsultationStatus(nextStatus);
    const wasConsultation = isConsultationStatus(lead.status);
    if (nextIsConsultation && !wasConsultation && !patch.consultationDate) {
      setPendingAppointment({ lead, patch: { ...patch, status: CONSULTATION_STATUS } });
      return;
    }
    if (nextStatus === DEAL_QUOTED_STATUS && !String(patch.pendingReason || lead.pendingReason || '').trim()) {
      setPendingQuote({ lead, patch });
      return;
    }
    if (nextStatus === LOST_LEAD_STATUS && !String(patch.lostReason || lead.lostReason || '').trim()) {
      setPendingLost({ lead, patch });
      return;
    }
    await applyLeadPatch(lead, patch);
  }

  async function moveLead(leadId: string, status: Lead['status']) {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || lead.status === status) return;
    await updateLead(lead, { status });
  }

  return (
    <>
    <div ref={scrollRef} className="kanban-scrollbar flex gap-4 overflow-x-auto pb-16" onScroll={(event) => {
      const el = event.currentTarget;
      setScrollState({ left: el.scrollLeft, max: Math.max(el.scrollWidth - el.clientWidth, 0) });
    }}>
      {leadStatuses.map((status, index) => {
        const colLeads = leads
          .filter((lead) => lead.status === status)
          .sort((a, b) =>
            priorityForLead(sourceConfigs, b) - priorityForLead(sourceConfigs, a) ||
            (b.createdAt || '').localeCompare(a.createdAt || ''),
          );
        const isDropTarget = dragOverStatus === status;

        return (
          <div
            key={status}
            className={`flex w-72 flex-shrink-0 flex-col rounded-xl border p-3 transition ${columnStyles[index] || columnStyles[0]} ${isDropTarget ? 'scale-[1.01] ring-2 ring-[#003B7A]/35' : ''}`}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setDragOverStatus(status);
            }}
            onDragLeave={() => setDragOverStatus('')}
            onDrop={(event) => {
              event.preventDefault();
              const leadId = event.dataTransfer.getData('text/plain');
              setDragOverStatus('');
              if (leadId) void moveLead(leadId, status);
            }}
          >
            <div className="mb-3 flex items-center justify-between">
              <Badge tone={statusTone[index]}>{statusLabel(status)}</Badge>
              <span className="text-xs font-bold text-slate-400">{colLeads.length}</span>
            </div>
            <div className="flex flex-col gap-3">
              {!colLeads.length && (
                <div className="rounded-lg border-2 border-dashed border-slate-200 bg-white/40 p-10 text-center text-xs font-semibold text-slate-400">
                  {isDropTarget ? 'Thả vào đây' : 'Trống'}
                </div>
              )}
              {colLeads.map((lead) => (
                <LeadKanbanCard
                  key={lead.id}
                  lead={lead}
                  salesOptions={salesOptions}
                  canAssign={canAssign}
                  onSave={updateLead}
                  knownApptType={apptTypeByLead.get(lead.id)}
                  appointmentsLoaded={appointmentsLoaded}
                  sourceConfigs={sourceConfigs}
                  sourceOptions={sourceOptions}
                  centerOptions={centerOptions}
                  focused={focusLeadId === lead.id}
                  onOpenDetail={onOpenDetail}
                  onCall={onCall}
                  callLogs={callLogsForLead(callLogs, lead.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
    {pendingAppointment && (
      <AppointmentRequiredModal
        lead={pendingAppointment.lead}
        onCancel={() => {
          setPendingAppointment(null);
          void refresh();
        }}
        onConfirm={async ({ startTime, note }) => {
          const patch: Partial<Lead> = {
            ...pendingAppointment.patch,
            status: CONSULTATION_STATUS,
            consultationDate: startTime,
            followUpDate: '',
            dealNote: note || pendingAppointment.lead.dealNote,
          };
          const lead = pendingAppointment.lead;
          setPendingAppointment(null);
          await applyLeadPatch(lead, patch);
        }}
      />
    )}
    {scrollState.max > 0 && (
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:left-72">
        <div className="flex items-center gap-2">
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" onClick={() => scrollKanban(-420)} title="Cuộn sang trái">
            <ChevronLeft size={16} />
          </button>
          <input
            type="range"
            min={0}
            max={scrollState.max || 0}
            value={Math.min(scrollState.left, scrollState.max)}
            onChange={(event) => {
              const el = scrollRef.current;
              if (!el) return;
              el.scrollLeft = Number(event.target.value);
              setScrollState({ left: el.scrollLeft, max: Math.max(el.scrollWidth - el.clientWidth, 0) });
            }}
            className="h-2 min-w-0 flex-1 cursor-pointer accent-[#003B7A]"
            aria-label="Cuộn ngang Kanban"
          />
          <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" onClick={() => scrollKanban(420)} title="Cuộn sang phải">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    )}
    {pendingQuote && (
      <PendingReasonModal
        lead={pendingQuote.lead}
        onCancel={() => {
          setPendingQuote(null);
          void refresh();
        }}
        onConfirm={async (patch) => {
          const financed = applyFinanceDefaults({ ...pendingQuote.lead, ...pendingQuote.patch, ...patch, status: DEAL_QUOTED_STATUS });
          const nextPatch: Partial<Lead> = {
            ...pendingQuote.patch,
            ...patch,
            status: DEAL_QUOTED_STATUS,
            dealSize: financed.dealSize,
            discountPercent: financed.discountPercent,
            expectedRevenue: financed.expectedRevenue,
            dealCurrency: financed.dealCurrency,
          };
          setPendingQuote(null);
          await applyLeadPatch(pendingQuote.lead, nextPatch);
        }}
      />
    )}
    {pendingLost && (
      <LostReasonModal
        lead={pendingLost.lead}
        onCancel={() => {
          setPendingLost(null);
          void refresh();
        }}
        onConfirm={async (patch) => {
          const nextPatch: Partial<Lead> = {
            ...pendingLost.patch,
            ...patch,
            status: LOST_LEAD_STATUS,
            followUpDate: '',
          };
          setPendingLost(null);
          await applyLeadPatch(pendingLost.lead, nextPatch);
        }}
      />
    )}
    </>
  );
}

function PendingReasonModal({
  lead,
  onCancel,
  onConfirm,
}: {
  lead: Lead;
  onCancel: () => void;
  onConfirm: (patch: Partial<Lead>) => void | Promise<void>;
}) {
  const [reason, setReason] = useState(lead.pendingReason || '');
  const selected = pendingOption(reason);
  const [note, setNote] = useState(lead.pendingReasonNote || selected?.defaultNote || '');
  const percent = selected?.warmthPercent || 0;

  function chooseReason(nextReason: string) {
    const option = pendingOption(nextReason);
    setReason(nextReason);
    setNote((current) => current.trim() ? current : option?.defaultNote || '');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4">
          <h2 className="text-lg font-extrabold text-slate-950">Lý do pending báo phí</h2>
          <p className="mt-1 text-sm text-slate-500">
            {lead.studentName || lead.fullName} {lead.parentName ? `· PH: ${lead.parentName}` : ''}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase text-slate-500">Lý do pending bắt buộc</span>
            <Select value={reason} onChange={(event) => chooseReason(event.target.value)}>
              <option value="">Chọn lý do pending</option>
              {pendingReasonOptions.map((option) => (
                <option key={option.reason} value={option.reason}>
                  {option.reason} ({option.warmthPercent}%)
                </option>
              ))}
            </Select>
          </label>
          {reason && (
            <div className={`rounded-lg border px-3 py-2 text-sm font-bold ${warmthTone(percent)}`}>
              Warmth dự kiến: {percent}%
            </div>
          )}
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase text-slate-500">Ghi chú pending</span>
            <Textarea
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ghi chú mặc định sẽ hiện sau khi chọn lý do; sales bổ sung thêm thông tin thực tế tại đây."
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Hủy</Button>
          <Button
            disabled={!reason}
            onClick={() => onConfirm({
              pendingReason: reason,
              pendingReasonNote: note || selected?.defaultNote || '',
              pendingWarmthPercent: percent,
            })}
          >
            <Save /> Lưu pending
          </Button>
        </div>
      </div>
    </div>
  );
}

function LostReasonModal({
  lead,
  onCancel,
  onConfirm,
}: {
  lead: Lead;
  onCancel: () => void;
  onConfirm: (patch: Partial<Lead>) => void | Promise<void>;
}) {
  const [reason, setReason] = useState(lead.lostReason || '');
  const [note, setNote] = useState(lead.lostNote || lostReasonDefaultNote(lead.lostReason));

  function chooseReason(nextReason: string) {
    setReason(nextReason);
    setNote((current) => current.trim() ? current : lostReasonDefaultNote(nextReason));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-2xl rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4">
          <h2 className="text-lg font-extrabold text-slate-950">Lý do mất lead</h2>
          <p className="mt-1 text-sm text-slate-500">
            {lead.studentName || lead.fullName} {lead.parentName ? `· PH: ${lead.parentName}` : ''}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase text-slate-500">Lý do mất lead bắt buộc</span>
            <Select value={reason} onChange={(event) => chooseReason(event.target.value)}>
              <option value="">Chọn lý do mất lead</option>
              {lostReasons.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase text-slate-500">Ghi chú mất lead</span>
            <Textarea
              rows={4}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ghi chú mặc định sẽ hiện sau khi chọn lý do; sales bổ sung thêm bối cảnh thực tế tại đây."
            />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Hủy</Button>
          <Button
            disabled={!reason}
            onClick={() => onConfirm({
              lostReason: reason,
              lostNote: note || lostReasonDefaultNote(reason),
            })}
          >
            <Save /> Lưu lý do mất lead
          </Button>
        </div>
      </div>
    </div>
  );
}

function AppointmentRequiredModal({
  lead,
  onCancel,
  onConfirm,
}: {
  lead: Lead;
  onCancel: () => void;
  onConfirm: (payload: { startTime: string; note: string }) => void | Promise<void>;
}) {
  const [startTime, setStartTime] = useState(localDateTimeInput(lead.consultationDate) || defaultAppointmentInput());
  const [note, setNote] = useState(`Tư vấn - ${lead.interestedCourse || 'Chưa chọn khóa'}`);
  const [error, setError] = useState('');

  async function submit() {
    if (!startTime) {
      setError('Vui lòng chọn ngày + giờ tư vấn.');
      return;
    }
    setError('');
    await onConfirm({ startTime, note });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-xl">
        <div className="mb-4">
          <h2 className="text-lg font-extrabold text-slate-950">Đặt lịch tư vấn bắt buộc</h2>
          <p className="mt-1 text-sm text-slate-500">
            {lead.studentName || lead.fullName} {lead.parentName ? `· PH: ${lead.parentName}` : ''}
          </p>
        </div>
        {error && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div>}
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase text-slate-500">Ngày + giờ tư vấn</span>
            <Input type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold uppercase text-slate-500">Note appointment</span>
            <Textarea rows={4} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Hủy</Button>
          <Button onClick={() => void submit()}><CalendarDays /> Tạo appointment</Button>
        </div>
      </div>
    </div>
  );
}

function LeadKanbanCard({
  lead,
  salesOptions,
  canAssign,
  onSave,
  knownApptType,
  appointmentsLoaded,
  sourceConfigs,
  sourceOptions,
  centerOptions,
  focused = false,
  onOpenDetail,
  onCall,
  callLogs = [],
}: {
  lead: Lead;
  salesOptions: AdminUser[];
  canAssign: boolean;
  onSave: (lead: Lead, patch: Partial<Lead>) => void | Promise<void>;
  knownApptType?: Appointment['type'];
  appointmentsLoaded: boolean;
  sourceConfigs: LeadSourceConfig[];
  sourceOptions: string[];
  centerOptions: string[];
  focused?: boolean;
  onOpenDetail: (lead: Lead) => void;
  onCall: (lead: Lead) => void | Promise<void>;
  callLogs?: CallLog[];
}) {
  const courseOptions = useCourseOptions();
  const [draft, setDraft] = useState(lead);
  const cardRef = useRef<HTMLDivElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  // Khởi tạo từ knownApptType (đã fetch ở Kanban) → không bị flash giữa Tư vấn ↔ Test
  const initialKind: AppointmentKind = knownApptType
    ? (knownApptType as AppointmentKind)
    : appointmentsLoaded
      ? ''
    : lead.consultationDate
      ? APPT_CONSULTATION
      : lead.followUpDate
        ? APPT_CALLBACK
        : '';
  const [appointmentKind, setAppointmentKind] = useState<AppointmentKind>(initialKind);
  const [appointmentTimeDraft, setAppointmentTimeDraft] = useState(localDateTimeInput(initialKind === APPT_CALLBACK ? lead.followUpDate : lead.consultationDate));
  const [expanded, setExpanded] = useState(false);
  const latestCall = callLogs[0];

  useEffect(() => {
    if (!focused) return;
    setExpanded(true);
    window.setTimeout(() => {
      cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    }, 120);
  }, [focused]);

  useEffect(() => {
    setDraft(lead);
    // Ưu tiên appointment collection. Khi đã load mà không có lịch, không fallback lại consultationDate cũ của lead.
    if (knownApptType) {
      setAppointmentKind(knownApptType as AppointmentKind);
      setAppointmentTimeDraft(localDateTimeInput((knownApptType as AppointmentKind) === APPT_CALLBACK ? lead.followUpDate : lead.consultationDate));
    } else if (appointmentsLoaded) {
      setAppointmentKind('');
      setAppointmentTimeDraft('');
    } else if (lead.consultationDate) {
      setAppointmentKind((current) =>
        current === APPT_TEST || current === APPT_CONSULTATION ? current : APPT_CONSULTATION,
      );
      setAppointmentTimeDraft(localDateTimeInput(lead.consultationDate));
    } else if (lead.followUpDate) {
      setAppointmentKind(APPT_CALLBACK);
      setAppointmentTimeDraft(localDateTimeInput(lead.followUpDate));
    } else {
      setAppointmentKind('');
      setAppointmentTimeDraft('');
    }
  }, [lead, knownApptType, appointmentsLoaded]);

  function openDatePicker() {
    const input = dateInputRef.current;
    if (!input || input.disabled) return;
    input.focus();
    input.showPicker?.();
  }

  function commit(patch: Partial<Lead>) {
    const nextStatus = patch.status || lead.status;
    const nextSource = patch.source || lead.source;
    if (String(nextSource || '').trim().toLowerCase() === 'referral' && !String(patch.referralPhone || lead.referralPhone || '').trim()) {
      const referralPhone = window.prompt('Nhập SĐT phụ huynh/người referral:');
      if (!referralPhone?.trim()) {
        setDraft(lead);
        return;
      }
      patch = { ...patch, referralPhone: referralPhone.trim() };
    }
    if (nextStatus === DEAL_QUOTED_STATUS && !String(patch.pendingReason || lead.pendingReason || '').trim()) {
      void onSave(lead, patch);
      return;
    }
    if (nextStatus === LOST_LEAD_STATUS && !String(patch.lostReason || lead.lostReason || '').trim()) {
      setDraft(lead);
      void onSave(lead, patch);
      return;
    }
    const confirmedPatch = buildLostReasonPatch(lead, patch);
    if (!confirmedPatch) {
      setDraft(lead);
      return;
    }
    setDraft({ ...draft, ...confirmedPatch });
    void onSave(lead, confirmedPatch);
  }

  function commitText(key: keyof Lead) {
    const value = draft[key] as string;
    if (value !== (lead[key] as string)) commit({ [key]: value } as Partial<Lead>);
  }

  function financePatch(next: Partial<Lead>) {
    const financed = applyFinanceDefaults({ ...draft, ...next });
    if (financed.status !== DEAL_QUOTED_STATUS && financed.status !== WON_LEAD_STATUS) return next;
    return {
      ...next,
      dealSize: financed.dealSize,
      discountPercent: financed.discountPercent,
      expectedRevenue: financed.expectedRevenue,
      dealCurrency: financed.dealCurrency,
      ...(financed.status === WON_LEAD_STATUS ? { revenue: financed.revenue || financed.expectedRevenue } : {}),
    };
  }

  async function saveKanbanAppointment(kind: AppointmentKind, time: string) {
    const patch: Partial<Lead> = {
      followUpDate: kind === APPT_CALLBACK ? time : '',
      consultationDate: kind === APPT_CONSULTATION || kind === APPT_TEST ? time : '',
    };
    setAppointmentKind(kind);
    setAppointmentTimeDraft(localDateTimeInput(time));
    setDraft((current) => ({ ...current, ...patch }));
    await onSave(lead, patch);

    if (kind && time) {
      const appointment = await appointmentService.upsertLeadAppointment({
        leadId: lead.id,
        leadName: leadDisplayName(draft) || leadDisplayName(lead),
        phone: draft.phone || lead.phone,
        type: kind,
        startTime: time,
        assignedTo: draft.assignedTo || lead.assignedTo,
        assignedToName: draft.assignedToName || lead.assignedToName,
        notes: kind === APPT_CALLBACK ? 'Cần gọi lại / follow-up lead.' : `${kind} - ${draft.interestedCourse || lead.interestedCourse || 'Chưa chọn khóa'}`,
      });
      await appointmentService.deleteOtherForLead(lead.id, appointment.id);
    } else {
      await appointmentService.deleteAllForLead(lead.id);
    }
  }

  return (
    <div
      ref={cardRef}
      draggable
      onDragStart={(event) => {
        const tag = (event.target as HTMLElement).tagName;
        if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tag)) {
          event.preventDefault();
          return;
        }
        event.dataTransfer.setData('text/plain', lead.id);
        event.dataTransfer.effectAllowed = 'move';
      }}
      className={`relative cursor-grab rounded-lg border bg-white shadow-sm transition hover:shadow-md active:cursor-grabbing ${focused ? 'border-[#F45A0A] ring-2 ring-orange-200' : 'border-slate-200'}`}
    >
      <button
        type="button"
        className="absolute right-8 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#003B7A] shadow-sm hover:bg-blue-50"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void onCall(lead);
        }}
        title="Gọi lead"
      >
        <PhoneCall size={14} />
      </button>
      <button type="button" className="block w-full px-3 py-2 text-left" onClick={() => setExpanded((item) => !item)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-950">{draft.studentName || draft.fullName || 'Chưa có tên học sinh'}</p>
            <p className="truncate text-xs text-slate-500">{draft.parentName ? `PH: ${draft.parentName}` : draft.phone || '-'}</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <GripVertical size={14} />
            {expanded ? 'Thu' : 'Mở'}
          </div>
        </div>

        {/* Lịch hẹn — hiện ngay phía trên badges nếu có */}
        {(() => {
          const apptTime = draft.consultationDate || draft.followUpDate;
          if (!appointmentKind || !apptTime) return null;
          let apptType = 'Lịch hẹn';
          let tone = 'bg-slate-50 text-slate-700 border-slate-200';
          if (appointmentKind === APPT_TEST) { apptType = 'Test đầu vào'; tone = 'bg-blue-50 text-blue-700 border-blue-200'; }
          else if (appointmentKind === APPT_CONSULTATION) { apptType = 'Tư vấn'; tone = 'bg-violet-50 text-violet-700 border-violet-200'; }
          else if (appointmentKind === APPT_CALLBACK) { apptType = 'Gọi lại'; tone = 'bg-amber-50 text-amber-700 border-amber-200'; }
          return (
            <div className={`mt-2 flex items-center gap-1.5 rounded border ${tone} px-2 py-1 text-[11px] font-semibold`}>
              <CalendarDays size={12} className="flex-shrink-0" />
              <span className="truncate">{apptType}: {formatApptTime(apptTime)}</span>
            </div>
          );
        })()}

        <div className="mt-2 flex flex-wrap gap-1">
          <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${priorityTone(priorityForLead(sourceConfigs, draft))}`}>{priorityLabel(priorityForLead(sourceConfigs, draft))}</span>
          {draft.assignedToName && <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{draft.assignedToName}</span>}
          {draft.status === DEAL_QUOTED_STATUS && draft.pendingReason && (
            <span className={`rounded border px-2 py-0.5 text-[10px] font-bold ${warmthTone(warmthPercent(draft))}`}>{warmthPercent(draft)}%</span>
          )}
          {draft.interestedCourse && <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">{draft.interestedCourse}</span>}
          {draft.centerName && <span className="rounded bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-slate-600">{draft.centerName}</span>}
          {draft.source && <span className="rounded bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700">{sourceLabel(draft.source)}</span>}
          {callLogs.length > 0 && <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">Calls: {callLogs.length}</span>}
          {isReferralLead(draft) && draft.referralPhone && <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Ref: {draft.referralPhone}</span>}
          {draft.status === DEAL_QUOTED_STATUS && (
            <span className="rounded bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700">
              Expected: {formatCurrency(quoteValue(draft), draft.dealCurrency || DEFAULT_DEAL_CURRENCY)}
            </span>
          )}
          {draft.status === WON_LEAD_STATUS && (
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              Revenue: {formatCurrency(wonValue(draft), draft.dealCurrency || DEFAULT_DEAL_CURRENCY)}
            </span>
          )}
        </div>

        {/* Ghi chú preview khi thu lại */}
        {/* Cập nhật lần cuối */}
        {!expanded && (
          <p className="mt-2 text-[10px] text-slate-400">
            Cập nhật: {formatUpdatedAt(draft.updatedAt)}
          </p>
        )}
      </button>
      {expanded && (
        <div className="flex flex-col gap-2 border-t border-slate-100 p-3">
          {latestCall && (
            <div className="rounded-lg border border-blue-100 bg-blue-50 px-2 py-2">
              <div className="mb-1 flex items-center justify-between text-[11px] font-extrabold text-blue-800">
                <span>Call history</span>
                <span>{callLogs.length} log</span>
              </div>
              <div className="max-h-28 overflow-y-auto pr-1">
                {callLogs.map((log) => (
                  <CallLogInline key={log.id} log={log} />
                ))}
              </div>
            </div>
          )}
          <Input value={draft.parentName || ''} placeholder="Tên phụ huynh" onChange={(event) => setDraft({ ...draft, parentName: event.target.value })} onBlur={() => commitText('parentName')} />
          <Input value={draft.studentName || ''} placeholder="Tên học sinh" onChange={(event) => setDraft({ ...draft, studentName: event.target.value })} onBlur={() => commitText('studentName')} />
          <Input value={draft.phone || ''} placeholder="SĐT" onChange={(event) => setDraft({ ...draft, phone: event.target.value })} onBlur={() => commitText('phone')} />
          <div className="grid grid-cols-2 gap-2">
            <Input value={draft.age || ''} placeholder="Tuổi" onChange={(event) => setDraft({ ...draft, age: event.target.value })} onBlur={() => commitText('age')} />
            <Select value={draft.interestedCourse || ''} onChange={(event) => commit(financePatch({ interestedCourse: event.target.value }))}>
              <option value="">Khóa --</option>
              {courseOptions.map((course) => <option key={course} value={course}>{course}</option>)}
            </Select>
          </div>
          {draft.status === DEAL_QUOTED_STATUS && (
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-700">
                Deal: {formatCurrency(draft.dealSize || financeDefaultsForLead(draft).dealSize, draft.dealCurrency || DEFAULT_DEAL_CURRENCY)}
              </div>
              <Select value={String(draft.discountPercent || financeDefaultsForLead(draft).discountPercent)} onChange={(event) => commit(financePatch({ discountPercent: Number(event.target.value) }))}>
                {discountPercentOptions.map((percent) => <option key={percent} value={percent}>Discount {percent}%</option>)}
              </Select>
              <div className="col-span-2 rounded-lg border border-orange-200 bg-orange-50 px-2 py-1 text-xs font-bold text-orange-700">
                Expected: {formatCurrency(quoteValue(draft), draft.dealCurrency || DEFAULT_DEAL_CURRENCY)}
              </div>
            </div>
          )}
          {draft.status === WON_LEAD_STATUS && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
              Revenue: {formatCurrency(wonValue(draft), draft.dealCurrency || DEFAULT_DEAL_CURRENCY)}
            </div>
          )}
          {(draft.status === DEAL_QUOTED_STATUS || draft.status === WON_LEAD_STATUS) && (
            <>
              <Input value={draft.dealPackage || ''} placeholder="Gói học" onChange={(event) => setDraft({ ...draft, dealPackage: event.target.value })} onBlur={() => commitText('dealPackage')} />
              <Input
                type="date"
                value={draft.expectedCloseDate || ''}
                onChange={(event) => commit({ expectedCloseDate: event.target.value })}
              />
            </>
          )}
          <Select
            value={draft.assignedTo || ''}
            disabled={!canAssign}
            onChange={(event) => {
              const sales = salesOptions.find((item) => item.id === event.target.value);
              commit({ assignedTo: sales?.id || '', assignedToName: sales?.fullName || '' });
            }}
          >
            <option value="">PIC --</option>
            {salesOptions.map((sales) => <option key={sales.id} value={sales.id}>{sales.fullName}</option>)}
          </Select>
          <Select value={draft.centerName || ''} onChange={(event) => commit({ centerName: event.target.value })}>
            <option value="">Trung tâm --</option>
            {centerOptions.map((center) => <option key={center} value={center}>{center}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Select value={draft.source || sourceOptions[0] || leadSources[0]} onChange={(event) => {
              const source = event.target.value as Lead['source'];
              commit({ source, priorityLevel: sourcePriority(sourceConfigs, source, draft.priorityLevel) });
            }}>
              {sourceOptions.map((source) => <option key={source} value={source}>{sourceLabel(source)}</option>)}
            </Select>
            <Select value={draft.status} onChange={(event) => commit(financePatch({ status: event.target.value as Lead['status'] }))}>
              {leadStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </Select>
          </div>
          {isReferralLead(draft) && (
            <Input
              value={draft.referralPhone || ''}
              placeholder="SĐT người referral"
              onChange={(event) => setDraft({ ...draft, referralPhone: event.target.value })}
              onBlur={() => commitText('referralPhone')}
            />
          )}
          {draft.status === LOST_LEAD_STATUS && (
            <Select
              value={draft.lostReason || ''}
              onChange={(event) => {
                const reason = event.target.value;
                commit({ lostReason: reason, lostNote: draft.lostNote || lostReasonDefaultNote(reason) });
              }}
            >
              <option value="">Chọn lý do mất lead</option>
              {lostReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
            </Select>
          )}
          {draft.status === DEAL_QUOTED_STATUS && draft.pendingReason && (
            <div className={`rounded-lg border px-2 py-1 text-xs font-bold ${warmthTone(warmthPercent(draft))}`}>
              Warmth {warmthPercent(draft)}% · {draft.pendingReason}
            </div>
          )}
          {/* Loại lịch — full width để hiện đủ chữ */}
          <Select
            value={appointmentKind}
            onChange={(event) => {
              const nextKind = event.target.value as AppointmentKind;
              const currentTime = draft.consultationDate || draft.followUpDate || '';
              setAppointmentKind(nextKind);
              setAppointmentTimeDraft(nextKind ? localDateTimeInput(currentTime) : '');
              // Chỉ save khi đã có cả kind + time (hoặc clear khi chọn "Không có lịch hẹn")
              if (!nextKind) {
                void saveKanbanAppointment('', '');
              }
              // Nếu chọn kind mới mà chưa có time → đợi user nhập time mới save
            }}
          >
            <option value="">Không có lịch hẹn</option>
            <option value={APPT_CALLBACK}>Gọi lại / follow-up</option>
            <option value={APPT_CONSULTATION}>Hẹn lịch tư vấn</option>
            <option value={APPT_TEST}>Hẹn lịch test đầu vào</option>
          </Select>
          <Input
            ref={dateInputRef}
            type="datetime-local"
            value={appointmentTimeDraft}
            disabled={!appointmentKind}
            onClick={openDatePicker}
            onFocus={openDatePicker}
            onChange={(event) => {
              const time = event.target.value;
              setAppointmentTimeDraft(time);
              if (appointmentKind && time) void saveKanbanAppointment(appointmentKind, time);
            }}
            className="cursor-pointer pr-2"
          />
          <Textarea
            rows={2}
            placeholder="Ghi chú nhanh..."
            value={draft.initialNote || ''}
            onChange={(event) => setDraft({ ...draft, initialNote: event.target.value })}
            onBlur={() => commitText('initialNote')}
          />
          <Textarea
            rows={2}
            placeholder="Note deal / báo phí..."
            value={draft.dealNote || ''}
            onChange={(event) => setDraft({ ...draft, dealNote: event.target.value })}
            onBlur={() => commitText('dealNote')}
          />
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <span className="text-[10px] text-slate-400">
              Cập nhật: {formatUpdatedAt(draft.updatedAt)}
            </span>
            <button type="button" className="text-xs font-semibold text-[#003B7A] hover:underline" onClick={() => onOpenDetail(lead)}>
              Xem chi tiết →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
