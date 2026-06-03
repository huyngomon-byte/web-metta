import { ArrowLeft, CalendarPlus, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { useCourseOptions } from '@/hooks/useCms';
import { leadSources, leadStatuses } from '@/lib/constants';
import { canAssignLead } from '@/lib/permissions';
import { formatDate } from '@/lib/utils';
import { appointmentService } from '@/services/appointmentService';
import { leadService } from '@/services/leadService';
import { userService } from '@/services/userService';
import type { Appointment, InterestedCourse, Lead, LeadActivity } from '@/types/crm';
import type { AdminUser } from '@/types/user';

type AppointmentKind = '' | Appointment['type'];
type LeadDetailDraft = Lead & { appointmentKind?: AppointmentKind; appointmentTime?: string; appointmentNote?: string };

const STATUS_LABELS = [
  'Lead mới',
  'Đã liên hệ',
  'Chưa nghe máy',
  'Đã hẹn tư vấn',
  'Đã tư vấn/Đặt lịch test',
  'Đã test/Học thử',
  'Đã đăng ký học',
  'Mất lead',
];

const SOURCE_LABELS = [
  'Website',
  'Landing Page',
  'Facebook Ads',
  'Instagram Ads',
  'TikTok Ads',
  'Google Ads',
  'Zalo',
  'Referral',
  'Walk-in',
  'Khác',
];

const APPT_CALLBACK = 'Gọi lại' as Appointment['type'];
const APPT_CONSULTATION = 'Tư vấn' as Appointment['type'];
const APPT_TEST = 'Test đầu vào' as Appointment['type'];

function statusIndex(status: string) {
  const idx = (leadStatuses as readonly string[]).indexOf(status);
  return idx >= 0 ? idx : 0;
}

function statusLabel(status: string) {
  return STATUS_LABELS[statusIndex(status)] || status;
}

function sourceLabel(source: string) {
  const idx = (leadSources as readonly string[]).indexOf(source);
  return SOURCE_LABELS[idx] || source;
}

function toDetailDraft(lead: Lead): LeadDetailDraft {
  return {
    ...lead,
    appointmentKind: lead.consultationDate ? APPT_CONSULTATION : lead.followUpDate ? APPT_CALLBACK : '',
    appointmentTime: lead.consultationDate || lead.followUpDate || '',
    appointmentNote: '',
  };
}

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const courseOptions = useCourseOptions();
  const [lead, setLead] = useState<LeadDetailDraft | undefined>();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [tab, setTab] = useState('overview');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const canAssign = canAssignLead(user);

  const salesOptions = useMemo(() => users.filter((item) => item.role === 'sales' && item.active), [users]);
  const backPath = searchParams.get('from') === 'kanban' ? '/crm/leads?view=kanban' : '/crm/leads?view=table';

  const refresh = useCallback(() => {
    if (!id) return;
    leadService.getLead(id).then((item) => {
      if (item) setLead(toDetailDraft(item));
    });
    leadService.getActivities(id).then(setActivities);
    appointmentService.getByLead(id).then(setAppointments);
    userService.getUsers().then(setUsers);
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!lead || !id) return <p>Đang tải...</p>;

  function set(field: keyof LeadDetailDraft, value: string) {
    setLead((prev) => prev ? { ...prev, [field]: value } as LeadDetailDraft : prev);
  }

  async function save() {
    if (saving) return;
    setError('');
    const currentLead = lead;
    if (!currentLead) return;
    if (!currentLead.fullName || !currentLead.phone) {
      setError('Họ tên và số điện thoại là bắt buộc.');
      return;
    }
    if (currentLead.appointmentKind && !currentLead.appointmentTime) {
      setError('Vui lòng chọn ngày giờ lịch hẹn.');
      return;
    }

    const selectedSales = salesOptions.find((sales) => sales.id === currentLead.assignedTo);
    const normalizedLead: LeadDetailDraft = {
      ...currentLead,
      assignedToName: canAssign ? (selectedSales?.fullName || '') : currentLead.assignedToName,
      followUpDate: currentLead.appointmentKind === APPT_CALLBACK ? currentLead.appointmentTime : '',
      consultationDate: currentLead.appointmentKind === APPT_CONSULTATION || currentLead.appointmentKind === APPT_TEST ? currentLead.appointmentTime : '',
    } as LeadDetailDraft;
    const { appointmentKind, appointmentTime, appointmentNote, ...leadPayload } = normalizedLead;
    void appointmentKind;
    void appointmentTime;
    void appointmentNote;

    setSaving(true);
    try {
      const savedLeads = await leadService.saveLead(leadPayload);
      const savedLead = savedLeads.find((item) => item.id === id) || leadPayload;

      if (normalizedLead.appointmentKind && normalizedLead.appointmentTime) {
        const appointment = await appointmentService.upsertLeadAppointment({
          leadId: savedLead.id,
          leadName: savedLead.fullName,
          phone: savedLead.phone,
          type: normalizedLead.appointmentKind,
          startTime: normalizedLead.appointmentTime,
          assignedTo: savedLead.assignedTo,
          assignedToName: savedLead.assignedToName,
          notes: currentLead.appointmentNote || (normalizedLead.appointmentKind === APPT_CALLBACK
            ? 'Cần gọi lại / follow-up lead.'
            : `${normalizedLead.appointmentKind} - ${savedLead.interestedCourse || 'Chưa chọn khóa'}`),
        });
        await appointmentService.deleteOtherForLead(savedLead.id, appointment.id);
      } else {
        await appointmentService.deleteAllForLead(savedLead.id);
      }

      await leadService.addActivity({
        leadId: id,
        type: 'update',
        content: `Cập nhật lead lúc ${new Date().toLocaleString('vi-VN')}`,
      });

      navigate(backPath);
    } catch (err) {
      setError(err instanceof Error ? `Không lưu được lead: ${err.message}` : 'Không lưu được lead.');
    } finally {
      setSaving(false);
    }
  }

  const apptStatusColor: Record<string, 'blue' | 'green' | 'red' | 'orange'> = {
    upcoming: 'blue',
    done: 'green',
    cancelled: 'red',
    overdue: 'orange',
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate(backPath)}>
            <ArrowLeft /> Quay lại
          </Button>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-950">{lead.fullName}</h1>
            <p className="text-slate-500">{lead.phone}{lead.email ? ` · ${lead.email}` : ''}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setTab('appointments')}><CalendarPlus /> Lịch hẹn</Button>
      </div>

      <TabsList>
        <TabsTrigger active={tab === 'overview'} onClick={() => setTab('overview')}>Tổng quan</TabsTrigger>
        <TabsTrigger active={tab === 'activities'} onClick={() => setTab('activities')}>Lịch sử chăm sóc</TabsTrigger>
        <TabsTrigger active={tab === 'appointments'} onClick={() => setTab('appointments')}>Lịch hẹn</TabsTrigger>
        <TabsTrigger active={tab === 'notes'} onClick={() => setTab('notes')}>Ghi chú</TabsTrigger>
        <TabsTrigger active={tab === 'tracking'} onClick={() => setTab('tracking')}>Event tracking</TabsTrigger>
      </TabsList>

      {tab === 'overview' && (
        <Card>
          <CardHeader><CardTitle>Thông tin lead</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-5">
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div>}
            <FormSection title="Thông tin liên hệ">
              <Field label="Họ tên"><Input value={lead.fullName} onChange={(event) => set('fullName', event.target.value)} /></Field>
              <Field label="Số điện thoại"><Input value={lead.phone} onChange={(event) => set('phone', event.target.value)} /></Field>
              <Field label="Email"><Input value={lead.email} onChange={(event) => set('email', event.target.value)} /></Field>
              <Field label="Tuổi học sinh"><Input value={lead.age} onChange={(event) => set('age', event.target.value)} /></Field>
              <Field label="Trường"><Input value={lead.school} onChange={(event) => set('school', event.target.value)} /></Field>
              <Field label="Lớp hiện tại"><Input value={lead.currentClass} onChange={(event) => set('currentClass', event.target.value)} /></Field>
            </FormSection>

            <FormSection title="Nhu cầu học">
              <Field label="Khóa học quan tâm">
                <Select value={lead.interestedCourse} onChange={(event) => setLead({ ...lead, interestedCourse: event.target.value as InterestedCourse })}>
                  <option value="">Chưa chọn khóa</option>
                  {courseOptions.map((course) => <option key={course}>{course}</option>)}
                </Select>
              </Field>
              <Field label="Trình độ hiện tại"><Input value={lead.currentLevel} onChange={(event) => set('currentLevel', event.target.value)} /></Field>
              <Field label="Mục tiêu"><Input value={lead.targetGoal} onChange={(event) => set('targetGoal', event.target.value)} /></Field>
              <Textarea className="md:col-span-3" value={lead.initialNote} onChange={(event) => set('initialNote', event.target.value)} placeholder="Ghi chú ban đầu..." />
            </FormSection>

            <FormSection title="CRM & lịch hẹn">
              <Field label="Nguồn">
                <Select value={lead.source} onChange={(event) => set('source', event.target.value)}>
                  {leadSources.map((source) => <option key={source} value={source}>{sourceLabel(source)}</option>)}
                </Select>
              </Field>
              <Field label="Trạng thái">
                <Select value={lead.status} onChange={(event) => setLead({ ...lead, status: event.target.value as Lead['status'] })}>
                  {leadStatuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                </Select>
              </Field>
              <Field label="Người phụ trách">
                <Select
                  value={lead.assignedTo || ''}
                  disabled={!canAssign}
                  onChange={(event) => {
                    const sales = salesOptions.find((item) => item.id === event.target.value);
                    setLead({ ...lead, assignedTo: sales?.id || '', assignedToName: sales?.fullName || '' });
                  }}
                >
                  <option value="">Chọn sales phụ trách</option>
                  {salesOptions.map((sales) => <option key={sales.id} value={sales.id}>{sales.fullName}</option>)}
                </Select>
              </Field>
              <Field label="Loại lịch">
                <Select value={lead.appointmentKind || ''} onChange={(event) => {
                  const nextKind = event.target.value as AppointmentKind;
                  setLead({
                    ...lead,
                    appointmentKind: nextKind,
                    appointmentTime: nextKind === APPT_CONSULTATION || nextKind === APPT_TEST
                      ? lead.consultationDate || lead.appointmentTime || ''
                      : nextKind === APPT_CALLBACK
                        ? lead.followUpDate || lead.appointmentTime || ''
                        : '',
                    followUpDate: nextKind === APPT_CALLBACK ? lead.followUpDate : '',
                    consultationDate: nextKind === APPT_CONSULTATION || nextKind === APPT_TEST ? lead.consultationDate : '',
                  });
                }}>
                  <option value="">Không đặt lịch</option>
                  <option value={APPT_CALLBACK}>Gọi lại / follow-up</option>
                  <option value={APPT_CONSULTATION}>Hẹn lịch tư vấn</option>
                  <option value={APPT_TEST}>Hẹn lịch test đầu vào</option>
                </Select>
              </Field>
              <Field label="Ngày giờ lịch hẹn">
                <Input
                  type="datetime-local"
                  value={lead.appointmentTime?.slice(0, 16) || ''}
                  onChange={(event) => {
                    const time = event.target.value;
                    setLead({
                      ...lead,
                      appointmentTime: time,
                      followUpDate: lead.appointmentKind === APPT_CALLBACK ? time : '',
                      consultationDate: lead.appointmentKind === APPT_CONSULTATION || lead.appointmentKind === APPT_TEST ? time : '',
                    });
                  }}
                  disabled={!lead.appointmentKind}
                />
              </Field>
              <Textarea className="md:col-span-3" value={lead.appointmentNote || ''} onChange={(event) => set('appointmentNote', event.target.value)} placeholder="Note appointment hiển thị trong Appointments" />
            </FormSection>

            <Button className="w-fit" onClick={save} disabled={saving}><Save /> {saving ? 'Đang lưu...' : 'Lưu lead'}</Button>
          </CardContent>
        </Card>
      )}

      {tab === 'activities' && (
        <Card>
          <CardHeader><CardTitle>Timeline chăm sóc</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {activities.length === 0 && <p className="text-sm text-slate-500">Chưa có hoạt động nào.</p>}
            {activities.map((activity) => (
              <div key={activity.id} className="rounded-r-lg border-l-4 border-[#F45A0A] bg-slate-50 p-4">
                <Badge tone="cyan">{activity.type}</Badge>
                <p className="mt-2 font-semibold text-slate-950">{activity.content}</p>
                <p className="text-xs text-slate-500">{activity.createdBy} · {formatDate(activity.createdAt, true)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {tab === 'appointments' && (
        <Card>
          <CardHeader><CardTitle>Lịch hẹn đã tạo</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {appointments.length === 0 && <p className="text-sm text-slate-500">Chưa có lịch hẹn nào.</p>}
            {appointments.map((appointment) => (
              <div key={appointment.id} className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{appointment.title}</span>
                  <Badge tone={apptStatusColor[appointment.status] || 'blue'}>{appointment.status}</Badge>
                </div>
                <p className="text-sm text-slate-600">{formatDate(appointment.startTime, true)}</p>
                {appointment.assignedTo && <p className="text-sm text-slate-500">PIC: {appointment.assignedToName || appointment.assignedTo}</p>}
                {appointment.notes && <p className="text-sm italic text-slate-500">{appointment.notes}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(tab === 'notes' || tab === 'tracking') && (
        <Card>
          <CardContent className="p-6 text-sm text-slate-500">Module này đang ở mức MVP.</CardContent>
        </Card>
      )}
    </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase text-slate-500">{label}</span>
      {children}
    </label>
  );
}
