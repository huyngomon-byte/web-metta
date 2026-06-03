import { CalendarDays, Download, GripVertical, LayoutGrid, List, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useCourseOptions } from '@/hooks/useCms';
import { useLeads } from '@/hooks/useLeads';
import { DEFAULT_DEAL_CURRENCY, LOST_LEAD_STATUS, leadSources, leadStatuses, lostReasons } from '@/lib/constants';
import { canAssignLead } from '@/lib/permissions';
import { exportCsv, formatCurrency, formatDate } from '@/lib/utils';
import { appointmentService } from '@/services/appointmentService';
import { leadService } from '@/services/leadService';
import { sourceConfigService, sourcePriority } from '@/services/sourceConfigService';
import { userService } from '@/services/userService';
import type { Appointment, Lead, LeadPriorityLevel, LeadSourceConfig } from '@/types/crm';
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
  priorityLevel: 1,
  status: leadStatuses[0],
  assignedTo: '',
  assignedToName: '',
  dealCurrency: DEFAULT_DEAL_CURRENCY,
  dealPackage: '',
  dealNote: '',
  expectedCloseDate: '',
  enrollmentType: 'new',
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

function numericInputValue(value?: number) {
  return value === undefined || value === null ? '' : String(value);
}

function parseMoneyInput(value: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function dealValue(lead: Partial<Lead>) {
  return lead.expectedRevenue ?? lead.dealSize;
}

function buildLostReasonPatch(lead: Lead, patch: Partial<Lead>) {
  const nextStatus = patch.status || lead.status;
  if (nextStatus !== LOST_LEAD_STATUS) return patch;
  if (String(patch.lostReason || lead.lostReason || '').trim()) return patch;
  const reason = window.prompt('Nhập lý do mất lead trước khi chuyển trạng thái:');
  if (!reason?.trim()) return null;
  return { ...patch, lostReason: reason.trim() };
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

export default function LeadsPage() {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { leads, refresh } = useLeads();
  const courseOptions = useCourseOptions();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [sourceConfigs, setSourceConfigs] = useState<LeadSourceConfig[]>([]);
  const [filters, setFilters] = useState({ search: '', status: '', source: '', priorityLevel: '', course: '', assignedTo: '', dateFrom: '', dateTo: '' });
  const [view, setView] = useState<'table' | 'kanban'>(searchParams.get('view') === 'table' ? 'table' : 'kanban');
  const [editing, setEditing] = useState<LeadDraft | null>(null);
  const [quickLead, setQuickLead] = useState({ parentName: '', studentName: '', phone: '', assignedTo: '' });
  const [showSourceSettings, setShowSourceSettings] = useState(false);
  const [error, setError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const canAssign = canAssignLead(user);

  useEffect(() => {
    userService.getUsers().then(setUsers);
    sourceConfigService.getConfigs().then(setSourceConfigs);
  }, []);

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

  function priorityForSource(source?: string, fallback?: number) {
    return sourcePriority(sourceConfigs, source, fallback);
  }

  function newLeadDraft(): LeadDraft {
    const source = sourceOptions[0] || leadSources[0];
    return { ...emptyLead, source, priorityLevel: priorityForSource(source) };
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
    if (editing.appointmentKind && !editing.appointmentTime) {
      setError('Vui lòng chọn ngày giờ lịch hẹn.');
      return;
    }
    if (editing.status === LOST_LEAD_STATUS && !String(editing.lostReason || '').trim()) {
      setError('Vui lòng chọn lý do mất lead.');
      return;
    }

    const selectedSales = salesOptions.find((sales) => sales.id === editing.assignedTo);
    const payload: LeadDraft = {
      ...editing,
      fullName: displayName,
      assignedToName: canAssign ? (selectedSales?.fullName || '') : editing.assignedToName,
      priorityLevel: priorityForSource(editing.source, editing.priorityLevel),
      followUpDate: editing.appointmentKind === APPT_CALLBACK ? editing.appointmentTime : '',
      consultationDate: editing.appointmentKind === APPT_CONSULTATION || editing.appointmentKind === APPT_TEST ? editing.appointmentTime : '',
    };
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
      refresh();
    } catch (err) {
      setError(err instanceof Error ? `Không ghi được Firestore: ${err.message}` : 'Không lưu được lead.');
    }
  }

  async function removeLead(id: string) {
    if (!confirm('Xóa lead này?')) return;
    await leadService.deleteLead(id);
    refresh();
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
    try {
      await leadService.saveLead({
        ...emptyLead,
        fullName,
        parentName,
        studentName,
        phone,
        source,
        priorityLevel: priorityForSource(source),
        assignedTo: selectedSales?.id || '',
        assignedToName: selectedSales?.fullName || '',
        assignedBy: selectedSales ? user?.id : '',
        assignedAt: selectedSales ? timestamp : '',
        assignedStatus: selectedSales ? 'active' : 'unassigned',
        ...(selectedSales ? { assignedAtMs: Date.now() } : {}),
      });
      setQuickLead({ parentName: '', studentName: '', phone: '', assignedTo: '' });
      setSaveMessage('Đã thêm lead mới.');
      refresh();
    } catch (err) {
      setError(err instanceof Error ? `Không ghi được Firestore: ${err.message}` : 'Không thêm được lead.');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-950">Leads CRM</h1>
          <p className="text-slate-500">Quản lý lead tuyển sinh, phân sale và lịch follow-up.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            <button type="button" onClick={() => setView('table')} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold ${view === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <List size={15} /> Table
            </button>
            <button type="button" onClick={() => setView('kanban')} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold ${view === 'kanban' ? 'bg-[#003B7A] text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <LayoutGrid size={15} /> Kanban
            </button>
          </div>
          <Button variant="outline" onClick={() => exportCsv('metta-leads.csv', filtered as unknown as Record<string, unknown>[])}>
            <Download /> Export CSV
          </Button>
          {canAssign && <Button variant="outline" onClick={() => setShowSourceSettings((current) => !current)}>
            Source priority
          </Button>}
          {canAssign && <Button onClick={() => setEditing(newLeadDraft())}><Plus /> Thêm lead</Button>}
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-6">
          {canAssign && <div className="md:col-span-6">
            <div className="mb-1 text-xs font-bold uppercase text-slate-500">Nhập lead nhanh</div>
            <div className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3 md:grid-cols-[1fr_1fr_1fr_220px_auto]">
              <Input placeholder="Tên phụ huynh" value={quickLead.parentName} onChange={(event) => setQuickLead({ ...quickLead, parentName: event.target.value })} />
              <Input placeholder="Tên học sinh" value={quickLead.studentName} onChange={(event) => setQuickLead({ ...quickLead, studentName: event.target.value })} />
              <Input placeholder="Số điện thoại" value={quickLead.phone} onChange={(event) => setQuickLead({ ...quickLead, phone: event.target.value })} />
              <Select value={quickLead.assignedTo} onChange={(event) => setQuickLead({ ...quickLead, assignedTo: event.target.value })}>
                <option value="">PIC --</option>
                {salesOptions.map((sales) => <option key={sales.id} value={sales.id}>{sales.fullName}</option>)}
              </Select>
              <Button onClick={addQuickLead}><Plus /> Thêm lead</Button>
            </div>
          </div>}
          <Input placeholder="Search học sinh / phụ huynh / SĐT / email" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
          <Select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            <option value="">Tất cả status</option>
            {leadStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </Select>
          <Select value={filters.source} onChange={(event) => setFilters({ ...filters, source: event.target.value })}>
            <option value="">Tất cả source</option>
            {sourceOptions.map((source) => <option key={source} value={source}>{sourceLabel(source)}</option>)}
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
        </CardContent>
      </Card>

      {saveMessage && <div className="rounded-lg bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{saveMessage}</div>}
      {showSourceSettings && (
        <SourcePriorityPanel
          configs={sourceConfigs}
          onSave={async (configs) => {
            const saved = await sourceConfigService.saveConfigs(configs);
            setSourceConfigs(saved);
            setSaveMessage('Đã lưu cấu hình source và cấp độ ưu tiên.');
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
          priorityForSource={priorityForSource}
        />
      )}

      {view === 'table' ? (
        <LeadsTable leads={filtered} canAssign={canAssign} onEdit={(lead) => setEditing(toDraft(lead))} onDelete={removeLead} sourceConfigs={sourceConfigs} />
      ) : (
        <Kanban leads={filtered} salesOptions={salesOptions} canAssign={canAssign} refresh={refresh} sourceConfigs={sourceConfigs} sourceOptions={sourceOptions} />
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
  priorityForSource: (source?: string, fallback?: number) => LeadPriorityLevel;
}) {
  const set = (key: keyof LeadDraft, val: string) => setValue({ ...value, [key]: val });
  const isConsultation = value.status === CONSULTATION_STATUS;
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
          <Select value={value.interestedCourse || ''} onChange={(event) => set('interestedCourse', event.target.value)}>
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
          <Select value={value.status || leadStatuses[0]} onChange={(event) => set('status', event.target.value)}>
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

        <FormSection title="Finance / enrollment">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Deal size</label>
            <Input
              type="number"
              min="0"
              step="100000"
              placeholder="VD: 12000000"
              value={numericInputValue(value.dealSize)}
              onChange={(event) => setValue({ ...value, dealSize: parseMoneyInput(event.target.value), expectedRevenue: parseMoneyInput(event.target.value), dealCurrency: value.dealCurrency || DEFAULT_DEAL_CURRENCY })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Currency</label>
            <Select value={value.dealCurrency || DEFAULT_DEAL_CURRENCY} onChange={(event) => set('dealCurrency', event.target.value)}>
              <option value="VND">VND</option>
              <option value="USD">USD</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase text-slate-500">Expected revenue</label>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800">
              {formatCurrency(dealValue(value), value.dealCurrency || DEFAULT_DEAL_CURRENCY)}
            </div>
          </div>
          <Input placeholder="Gói học / học phí dự kiến" value={value.dealPackage || ''} onChange={(event) => set('dealPackage', event.target.value)} />
          <Input type="date" value={value.expectedCloseDate || ''} onChange={(event) => set('expectedCloseDate', event.target.value)} />
          {value.status === LOST_LEAD_STATUS && (
            <Select value={value.lostReason || ''} onChange={(event) => set('lostReason', event.target.value)}>
              <option value="">Chọn lý do mất lead</option>
              {lostReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
            </Select>
          )}
          <Textarea className="md:col-span-3" placeholder="Note deal / báo phí / điều kiện chốt" value={value.dealNote || ''} onChange={(event) => set('dealNote', event.target.value)} />
          {value.status === LOST_LEAD_STATUS && (
            <Textarea className="md:col-span-3" placeholder="Ghi chú thêm về lý do mất lead" value={value.lostNote || ''} onChange={(event) => set('lostNote', event.target.value)} />
          )}
        </FormSection>

        <div className="flex gap-2">
          <Button onClick={onSave}><Save /> Lưu lead</Button>
          <Button variant="outline" onClick={onCancel}>Hủy</Button>
        </div>
      </CardContent>
    </Card>
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

function LeadsTable({
  leads,
  canAssign,
  onEdit,
  onDelete,
  sourceConfigs,
}: {
  leads: Lead[];
  canAssign: boolean;
  onEdit: (lead: Lead) => void;
  onDelete: (id: string) => void;
  sourceConfigs: LeadSourceConfig[];
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <THead>
            <TR><TH>Lead</TH><TH>SĐT</TH><TH>Email</TH><TH>Khóa quan tâm</TH><TH>Ưu tiên</TH><TH>Trạng thái</TH><TH>Deal</TH><TH>Nguồn</TH><TH>Người phụ trách</TH><TH>Follow-up</TH><TH>Ngày tạo</TH><TH>Action</TH></TR>
          </THead>
          <TBody>
            {leads.map((lead) => (
              <TR key={lead.id}>
                <TD>
                  <Link to={`/crm/leads/${lead.id}`} className="font-semibold text-slate-900">{lead.studentName || lead.fullName}</Link>
                  {lead.parentName && <p className="text-xs text-slate-500">PH: {lead.parentName}</p>}
                </TD>
                <TD>{lead.phone}</TD>
                <TD>{lead.email}</TD>
                <TD>{lead.interestedCourse}</TD>
                <TD><span className={`rounded border px-2 py-0.5 text-xs font-bold ${priorityTone(priorityForLead(sourceConfigs, lead))}`}>{priorityLabel(priorityForLead(sourceConfigs, lead))}</span></TD>
                <TD><Badge tone={statusTone[statusIndex(lead.status)]}>{statusLabel(lead.status)}</Badge></TD>
                <TD className="font-semibold text-slate-800">{formatCurrency(dealValue(lead), lead.dealCurrency || DEFAULT_DEAL_CURRENCY)}</TD>
                <TD>{sourceLabel(lead.source)}</TD>
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

function Kanban({
  leads,
  salesOptions,
  canAssign,
  refresh,
  sourceConfigs,
  sourceOptions,
}: {
  leads: Lead[];
  salesOptions: AdminUser[];
  canAssign: boolean;
  refresh: () => void;
  sourceConfigs: LeadSourceConfig[];
  sourceOptions: string[];
}) {
  const [dragOverStatus, setDragOverStatus] = useState('');
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

  async function updateLead(lead: Lead, patch: Partial<Lead>) {
    const confirmedPatch = buildLostReasonPatch(lead, patch);
    if (!confirmedPatch) return;
    await leadService.saveLead({ ...lead, ...confirmedPatch });
    await leadService.addActivity({ leadId: lead.id, type: 'update', content: `Cập nhật ${Object.keys(confirmedPatch).join(', ')}` });
    refresh();
  }

  async function moveLead(leadId: string, status: Lead['status']) {
    const lead = leads.find((item) => item.id === leadId);
    if (!lead || lead.status === status) return;
    await updateLead(lead, { status });
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
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
                />
              ))}
            </div>
          </div>
        );
      })}
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
}: {
  lead: Lead;
  salesOptions: AdminUser[];
  canAssign: boolean;
  onSave: (lead: Lead, patch: Partial<Lead>) => void | Promise<void>;
  knownApptType?: Appointment['type'];
  appointmentsLoaded: boolean;
  sourceConfigs: LeadSourceConfig[];
  sourceOptions: string[];
}) {
  const courseOptions = useCourseOptions();
  const [draft, setDraft] = useState(lead);
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
      className="cursor-grab rounded-lg border border-slate-200 bg-white shadow-sm transition hover:shadow-md active:cursor-grabbing"
    >
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
          <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">{statusLabel(draft.status)}</span>
          {draft.interestedCourse && <span className="rounded bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">{draft.interestedCourse}</span>}
          {draft.source && <span className="rounded bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-700">{sourceLabel(draft.source)}</span>}
          {dealValue(draft) ? <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">{formatCurrency(dealValue(draft), draft.dealCurrency || DEFAULT_DEAL_CURRENCY)}</span> : null}
        </div>

        {/* Ghi chú preview khi thu lại */}
        {!expanded && draft.initialNote && (
          <p className="mt-2 line-clamp-2 rounded bg-slate-50 px-2 py-1 text-[11px] leading-snug text-slate-600 italic">
            "{draft.initialNote}"
          </p>
        )}

        {/* Cập nhật lần cuối */}
        {!expanded && (
          <p className="mt-2 text-[10px] text-slate-400">
            Cập nhật: {formatUpdatedAt(draft.updatedAt)}
          </p>
        )}
      </button>
      {expanded && (
        <div className="flex flex-col gap-2 border-t border-slate-100 p-3">
          <Input value={draft.parentName || ''} placeholder="Tên phụ huynh" onChange={(event) => setDraft({ ...draft, parentName: event.target.value })} onBlur={() => commitText('parentName')} />
          <Input value={draft.studentName || ''} placeholder="Tên học sinh" onChange={(event) => setDraft({ ...draft, studentName: event.target.value })} onBlur={() => commitText('studentName')} />
          <Input value={draft.phone || ''} placeholder="SĐT" onChange={(event) => setDraft({ ...draft, phone: event.target.value })} onBlur={() => commitText('phone')} />
          <div className="grid grid-cols-2 gap-2">
            <Input value={draft.age || ''} placeholder="Tuổi" onChange={(event) => setDraft({ ...draft, age: event.target.value })} onBlur={() => commitText('age')} />
            <Select value={draft.interestedCourse || ''} onChange={(event) => commit({ interestedCourse: event.target.value })}>
              <option value="">Khóa --</option>
              {courseOptions.map((course) => <option key={course} value={course}>{course}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="number"
              min="0"
              step="100000"
              value={numericInputValue(draft.dealSize)}
              placeholder="Deal size"
              onChange={(event) => setDraft({ ...draft, dealSize: parseMoneyInput(event.target.value), expectedRevenue: parseMoneyInput(event.target.value), dealCurrency: draft.dealCurrency || DEFAULT_DEAL_CURRENCY })}
              onBlur={() => {
                if (draft.dealSize !== lead.dealSize) commit({ dealSize: draft.dealSize, expectedRevenue: draft.dealSize, dealCurrency: draft.dealCurrency || DEFAULT_DEAL_CURRENCY });
              }}
            />
            <Input value={draft.dealPackage || ''} placeholder="Gói học" onChange={(event) => setDraft({ ...draft, dealPackage: event.target.value })} onBlur={() => commitText('dealPackage')} />
          </div>
          <Input
            type="date"
            value={draft.expectedCloseDate || ''}
            onChange={(event) => commit({ expectedCloseDate: event.target.value })}
          />
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
          <div className="grid grid-cols-2 gap-2">
            <Select value={draft.source || sourceOptions[0] || leadSources[0]} onChange={(event) => {
              const source = event.target.value as Lead['source'];
              commit({ source, priorityLevel: sourcePriority(sourceConfigs, source, draft.priorityLevel) });
            }}>
              {sourceOptions.map((source) => <option key={source} value={source}>{sourceLabel(source)}</option>)}
            </Select>
            <Select value={draft.status} onChange={(event) => commit({ status: event.target.value as Lead['status'] })}>
              {leadStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </Select>
          </div>
          {draft.status === LOST_LEAD_STATUS && (
            <Select value={draft.lostReason || ''} onChange={(event) => commit({ lostReason: event.target.value })}>
              <option value="">Chọn lý do mất lead</option>
              {lostReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
            </Select>
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
            <Link to={`/crm/leads/${lead.id}?from=kanban`} className="text-xs font-semibold text-[#003B7A] hover:underline">
              Xem chi tiết →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
