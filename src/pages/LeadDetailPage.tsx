import { ArrowLeft, CalendarPlus, PhoneCall, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { CallRecordingButton } from '@/components/call/CallRecordingPlayer';
import { useCallCenter } from '@/context/CallCenterContext';
import { useAuth } from '@/hooks/useAuth';
import { useCourseCatalog } from '@/hooks/useCms';
import { DEAL_QUOTED_STATUS, DEFAULT_DEAL_CURRENCY, LOST_LEAD_STATUS, WON_LEAD_STATUS, discountPercentOptions, leadStatuses, lostReasons, pendingReasonOptions } from '@/lib/constants';
import { expectedRevenueAmount, financeDefaultsForLead, revenueAmount, type CourseDealSizeRule, type FinanceDefaultOptions } from '@/lib/leadFinance';
import { buildLeadTimeline } from '@/lib/leadTimeline';
import { canAssignLead } from '@/lib/permissions';
import { formatCurrency, formatDate } from '@/lib/utils';
import { appointmentService } from '@/services/appointmentService';
import { callCenterService } from '@/services/callCenterService';
import { centerConfigService } from '@/services/centerConfigService';
import { leadService } from '@/services/leadService';
import { sourceConfigService, sourcePriority } from '@/services/sourceConfigService';
import { userService } from '@/services/userService';
import type { CallLog } from '@/types/call';
import type { Appointment, InterestedCourse, Lead, LeadActivity, LeadCenterConfig, LeadSourceConfig } from '@/types/crm';
import type { AdminUser } from '@/types/user';

type AppointmentKind = '' | Appointment['type'];
type LeadDetailDraft = Lead & { appointmentKind?: AppointmentKind; appointmentTime?: string; appointmentNote?: string };

const APPT_CALLBACK = 'Gọi lại' as Appointment['type'];
const APPT_CONSULTATION = 'Tư vấn' as Appointment['type'];
const APPT_TEST = 'Test đầu vào' as Appointment['type'];

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
  return `P${Number(level || 1)}`;
}

function pendingOption(reason?: string) {
  return pendingReasonOptions.find((item) => item.reason === reason);
}

function warmthPercent(lead: Partial<Lead>) {
  return lead.pendingWarmthPercent || pendingOption(lead.pendingReason)?.warmthPercent || 0;
}

function isReferralLead(lead: Partial<Lead>) {
  return String(lead.source || '').trim().toLowerCase() === 'referral';
}

function warmthTone(percent: number) {
  if (percent >= 75) return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (percent >= 45) return 'border-amber-200 bg-amber-50 text-amber-700';
  if (percent >= 25) return 'border-orange-200 bg-orange-50 text-orange-700';
  return 'border-red-200 bg-red-50 text-red-700';
}

function quoteValue(lead: Partial<Lead>, courseDealSizes?: readonly CourseDealSizeRule[]) {
  return expectedRevenueAmount(lead, courseDealSizes);
}

function wonValue(lead: Partial<Lead>, courseDealSizes?: readonly CourseDealSizeRule[]) {
  return revenueAmount(lead, courseDealSizes);
}

function applyFinanceDefaults<T extends Partial<Lead>>(
  lead: T,
  courseDealSizes?: readonly CourseDealSizeRule[],
  options?: FinanceDefaultOptions,
): T {
  if (lead.status !== DEAL_QUOTED_STATUS && lead.status !== WON_LEAD_STATUS) return lead;
  const finance = financeDefaultsForLead(lead, courseDealSizes, options);
  return {
    ...lead,
    ...finance,
    ...(lead.status === WON_LEAD_STATUS ? { revenue: lead.revenue || finance.expectedRevenue } : {}),
  };
}

function appointmentStatusLabel(status: Appointment['status']) {
  if (status === 'done') return 'Hoàn thành';
  if (status === 'cancelled') return 'Đã hủy';
  if (status === 'overdue') return 'Quá hạn';
  return 'Sắp diễn ra';
}

function callLogText(log: CallLog) {
  const direction = log.direction === 'inbound' ? 'Inbound' : 'Outbound';
  const date = log.startedAt ? formatDate(log.startedAt, true) : '';
  const disposition = log.disposition ? ` · ${log.disposition}` : '';
  const duration = log.durationSec ? ` · ${Math.round(log.durationSec)}s` : '';
  return `${direction} ${date}${disposition}${duration}`;
}

function toDetailDraft(lead: Lead): LeadDetailDraft {
  return {
    ...lead,
    appointmentKind: lead.consultationDate ? APPT_CONSULTATION : lead.followUpDate ? APPT_CALLBACK : '',
    appointmentTime: lead.consultationDate || lead.followUpDate || '',
    appointmentNote: '',
  };
}

function defaultAppointmentInput() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { startOutboundCall } = useCallCenter();
  const { courseOptions, courseDealSizes } = useCourseCatalog();
  const [lead, setLead] = useState<LeadDetailDraft | undefined>();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [sourceConfigs, setSourceConfigs] = useState<LeadSourceConfig[]>([]);
  const [centerConfigs, setCenterConfigs] = useState<LeadCenterConfig[]>([]);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [callLogs, setCallLogs] = useState<CallLog[]>([]);
  const [tab, setTab] = useState('overview');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const canAssign = canAssignLead(user);

  const salesOptions = useMemo(() => users.filter((item) => item.role === 'sales' && item.active), [users]);
  const sourceOptions = useMemo(() => {
    const names = new Set([
      ...sourceConfigs.filter((source) => source.active).map((source) => source.name),
      ...(lead?.source ? [lead.source] : []),
    ]);
    return Array.from(names);
  }, [lead?.source, sourceConfigs]);
  const centerOptions = useMemo(() => {
    return centerConfigs
      .filter((center) => center.active)
      .map((center) => center.name)
      .filter(Boolean);
  }, [centerConfigs]);
  const backPath = searchParams.get('from') === 'kanban' ? '/crm/leads?view=kanban' : '/crm/leads?view=table';

  const refresh = useCallback(() => {
    if (!id) return;
    leadService.getLead(id).then((item) => {
      if (item) setLead(toDetailDraft(item));
    });
    leadService.getActivities(id).then(setActivities);
    appointmentService.getByLead(id).then(setAppointments);
    callCenterService.getLogsForLead(id).then(setCallLogs);
    userService.getUsers().then(setUsers);
    sourceConfigService.getConfigs().then(setSourceConfigs);
    centerConfigService.getConfigs().then(setCenterConfigs);
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    if (courseDealSizes.length > 0) refresh();
  }, [courseDealSizes, refresh]);

  if (!lead || !id) return <p>Đang tải...</p>;

  function set(field: keyof LeadDetailDraft, value: string) {
    setLead((prev) => prev ? { ...prev, [field]: value } as LeadDetailDraft : prev);
  }

  async function save() {
    if (saving) return;
    setError('');
    const currentLead = lead;
    if (!currentLead) return;
    const displayName = leadDisplayName(currentLead);
    if (!displayName || !currentLead.phone) {
      setError('Tên phụ huynh hoặc tên học sinh và số điện thoại là bắt buộc.');
      return;
    }
    if (currentLead.appointmentKind && !currentLead.appointmentTime) {
      setError('Vui lòng chọn ngày giờ lịch hẹn.');
      return;
    }
    if (isReferralLead(currentLead) && !String(currentLead.referralPhone || '').trim()) {
      setError('Lead source Referral cần có SĐT phụ huynh/người giới thiệu.');
      return;
    }
    if (currentLead.status === leadStatuses[3] && (currentLead.appointmentKind !== APPT_CONSULTATION || !currentLead.appointmentTime)) {
      setError('Lead ở trạng thái Đã hẹn tư vấn cần có lịch tư vấn ngày + giờ.');
      return;
    }
    if (currentLead.status === LOST_LEAD_STATUS && !String(currentLead.lostReason || '').trim()) {
      setError('Vui lòng chọn lý do mất lead.');
      return;
    }
    if (currentLead.status === DEAL_QUOTED_STATUS && !String(currentLead.pendingReason || '').trim()) {
      setError('Vui lòng chọn lý do pending khi chuyển sang Đã báo phí/Chờ chốt.');
      return;
    }

    const selectedSales = salesOptions.find((sales) => sales.id === currentLead.assignedTo);
    let normalizedLead: LeadDetailDraft = {
      ...currentLead,
      fullName: displayName,
      assignedToName: canAssign ? (selectedSales?.fullName || '') : currentLead.assignedToName,
      priorityLevel: sourcePriority(sourceConfigs, currentLead.source, currentLead.priorityLevel),
      pendingWarmthPercent: warmthPercent(currentLead),
      pendingReasonNote: currentLead.pendingReasonNote || pendingOption(currentLead.pendingReason)?.defaultNote || '',
      followUpDate: currentLead.appointmentKind === APPT_CALLBACK ? currentLead.appointmentTime : '',
      consultationDate: currentLead.appointmentKind === APPT_CONSULTATION || currentLead.appointmentKind === APPT_TEST ? currentLead.appointmentTime : '',
    } as LeadDetailDraft;
    normalizedLead = applyFinanceDefaults(normalizedLead, courseDealSizes);
    const { appointmentKind, appointmentTime, appointmentNote, ...leadPayload } = normalizedLead;
    void appointmentKind;
    void appointmentTime;
    void appointmentNote;

    setSaving(true);
    try {
      const savedLeads = await leadService.saveLead(leadPayload as Partial<Lead>);
      const savedLead = savedLeads.find((item) => item.id === id) || leadPayload;

      if (normalizedLead.appointmentKind && normalizedLead.appointmentTime) {
        const appointment = await appointmentService.upsertLeadAppointment({
          leadId: savedLead.id,
          leadName: leadDisplayName(savedLead),
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
  const timeline = buildLeadTimeline(lead, activities, appointments, courseDealSizes);
  const timelineToneClass: Record<string, string> = {
    blue: 'border-blue-300 bg-blue-50 text-blue-700',
    cyan: 'border-cyan-300 bg-cyan-50 text-cyan-700',
    green: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    orange: 'border-orange-300 bg-orange-50 text-orange-700',
    red: 'border-red-300 bg-red-50 text-red-700',
    purple: 'border-violet-300 bg-violet-50 text-violet-700',
    gray: 'border-slate-300 bg-slate-50 text-slate-700',
  };

  async function updateAppointmentStatus(appointment: Appointment, status: Appointment['status']) {
    if (appointment.status === status) return;
    await appointmentService.updateStatus(appointment.id, status);
    setAppointments((current) => current.map((item) => item.id === appointment.id ? { ...item, status } : item));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate(backPath)}>
            <ArrowLeft /> Quay lại
          </Button>
          <div>
            <h1 className="text-3xl font-extrabold text-slate-950">{lead.studentName || lead.fullName}</h1>
            <p className="text-slate-500">
              {lead.parentName ? `Phụ huynh: ${lead.parentName} · ` : ''}{lead.phone}{lead.email ? ` · ${lead.email}` : ''}{lead.centerName ? ` · Trung tâm: ${lead.centerName}` : ''}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void startOutboundCall(lead)} disabled={!lead.phone}><PhoneCall /> Gọi</Button>
          <Button variant="outline" onClick={() => setTab('appointments')}><CalendarPlus /> Lịch hẹn</Button>
        </div>
      </div>

      <TabsList>
        <TabsTrigger active={tab === 'overview'} onClick={() => setTab('overview')}>Tổng quan</TabsTrigger>
        <TabsTrigger active={tab === 'activities'} onClick={() => setTab('activities')}>Timeline tư vấn</TabsTrigger>
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
              <Field label="Tên phụ huynh"><Input value={lead.parentName || ''} onChange={(event) => set('parentName', event.target.value)} /></Field>
              <Field label="Tên học sinh"><Input value={lead.studentName || ''} onChange={(event) => set('studentName', event.target.value)} /></Field>
              <Field label="Số điện thoại"><Input value={lead.phone} onChange={(event) => set('phone', event.target.value)} /></Field>
              <Field label="Email"><Input value={lead.email} onChange={(event) => set('email', event.target.value)} /></Field>
              <Field label="Tuổi học sinh"><Input value={lead.age} onChange={(event) => set('age', event.target.value)} /></Field>
              <Field label="Trường"><Input value={lead.school} onChange={(event) => set('school', event.target.value)} /></Field>
              <Field label="Lớp hiện tại"><Input value={lead.currentClass} onChange={(event) => set('currentClass', event.target.value)} /></Field>
            </FormSection>

            <FormSection title="Nhu cầu học">
              <Field label="Khóa học quan tâm">
                <Select value={lead.interestedCourse} onChange={(event) => setLead(applyFinanceDefaults({ ...lead, interestedCourse: event.target.value as InterestedCourse }, courseDealSizes, { preferExistingDealSize: false }))}>
                  <option value="">Chưa chọn khóa</option>
                  {courseOptions.map((course) => <option key={course}>{course}</option>)}
                </Select>
              </Field>
              <Textarea className="md:col-span-3" value={lead.initialNote} onChange={(event) => set('initialNote', event.target.value)} placeholder="Ghi chú ban đầu..." />
            </FormSection>

            <FormSection title="CRM & lịch hẹn">
              <Field label="Nguồn">
                <Select value={lead.source} onChange={(event) => {
                  const source = event.target.value;
                  setLead({ ...lead, source, priorityLevel: sourcePriority(sourceConfigs, source, lead.priorityLevel) });
                }}>
                  {sourceOptions.map((source) => <option key={source} value={source}>{sourceLabel(source)}</option>)}
                </Select>
              </Field>
              {isReferralLead(lead) && (
                <Field label="SĐT người referral">
                  <Input value={lead.referralPhone || ''} onChange={(event) => set('referralPhone', event.target.value)} />
                </Field>
              )}
              <Field label="Trung tâm">
                <Select value={lead.centerName || ''} onChange={(event) => set('centerName', event.target.value)}>
                  <option value="">Chọn trung tâm/cơ sở</option>
                  {centerOptions.map((center) => <option key={center} value={center}>{center}</option>)}
                </Select>
              </Field>
              <Field label="Cấp độ ưu tiên">
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                  {priorityLabel(sourcePriority(sourceConfigs, lead.source, lead.priorityLevel))}
                </div>
              </Field>
              <Field label="Trạng thái">
                <Select value={lead.status} onChange={(event) => {
                  const status = event.target.value as Lead['status'];
                  const next = applyFinanceDefaults({ ...lead, status }, courseDealSizes);
                  if (status === leadStatuses[3]) {
                    const appointmentTime = lead.consultationDate || lead.appointmentTime || defaultAppointmentInput();
                    setLead({
                      ...next,
                      appointmentKind: APPT_CONSULTATION,
                      appointmentTime,
                      consultationDate: appointmentTime,
                      followUpDate: '',
                    });
                    return;
                  }
                  setLead(next);
                }}>
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

            {(lead.status === DEAL_QUOTED_STATUS || lead.status === WON_LEAD_STATUS || lead.status === LOST_LEAD_STATUS) && (
              <FormSection title="Finance / enrollment">
                {lead.status === DEAL_QUOTED_STATUS && (
                  <>
                    <Field label="Deal size">
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-800">
                        {formatCurrency(lead.dealSize || financeDefaultsForLead(lead, courseDealSizes).dealSize, lead.dealCurrency || DEFAULT_DEAL_CURRENCY)}
                      </div>
                    </Field>
                    <Field label="% discount">
                      <Select
                        value={String(lead.discountPercent || financeDefaultsForLead(lead, courseDealSizes).discountPercent)}
                        onChange={(event) => setLead(applyFinanceDefaults({ ...lead, discountPercent: Number(event.target.value) }, courseDealSizes))}
                      >
                        {discountPercentOptions.map((percent) => <option key={percent} value={percent}>{percent}%</option>)}
                      </Select>
                    </Field>
                    <Field label="Expected revenue">
                      <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-700">
                        {formatCurrency(quoteValue(lead, courseDealSizes), lead.dealCurrency || DEFAULT_DEAL_CURRENCY)}
                      </div>
                    </Field>
                  </>
                )}
                {lead.status === WON_LEAD_STATUS && (
                  <Field label="Revenue">
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
                      {formatCurrency(wonValue(lead, courseDealSizes), lead.dealCurrency || DEFAULT_DEAL_CURRENCY)}
                    </div>
                  </Field>
                )}
                {(lead.status === DEAL_QUOTED_STATUS || lead.status === WON_LEAD_STATUS) && (
                  <>
                    <Field label="Gói học / báo phí">
                      <Input value={lead.dealPackage || ''} onChange={(event) => set('dealPackage', event.target.value)} />
                    </Field>
                    <Field label="Ngày dự kiến chốt">
                      <Input type="date" value={lead.expectedCloseDate || ''} onChange={(event) => set('expectedCloseDate', event.target.value)} />
                    </Field>
                  </>
                )}
                {lead.status === DEAL_QUOTED_STATUS && (
                  <>
                    <Field label="Lý do pending">
                      <Select
                        value={lead.pendingReason || ''}
                        onChange={(event) => {
                          const reason = event.target.value;
                          const option = pendingOption(reason);
                          setLead({
                            ...applyFinanceDefaults(lead, courseDealSizes),
                            pendingReason: reason,
                            pendingWarmthPercent: option?.warmthPercent || 0,
                            pendingReasonNote: lead.pendingReasonNote || option?.defaultNote || '',
                          });
                        }}
                      >
                        <option value="">Chọn lý do pending</option>
                        {pendingReasonOptions.map((option) => (
                          <option key={option.reason} value={option.reason}>{option.reason} ({option.warmthPercent}%)</option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Warmth">
                      <div className={`rounded-lg border px-3 py-2 text-sm font-bold ${warmthTone(warmthPercent(lead))}`}>
                        {warmthPercent(lead)}%
                      </div>
                    </Field>
                    <Textarea
                      className="md:col-span-3"
                      value={lead.pendingReasonNote || pendingOption(lead.pendingReason)?.defaultNote || ''}
                      onChange={(event) => set('pendingReasonNote', event.target.value)}
                      placeholder="Ghi chú pending để sales bổ sung thêm"
                    />
                  </>
                )}
                {lead.status === LOST_LEAD_STATUS && (
                  <Field label="Lý do mất lead">
                    <Select value={lead.lostReason || ''} onChange={(event) => set('lostReason', event.target.value)}>
                      <option value="">Chọn lý do mất lead</option>
                      {lostReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
                    </Select>
                  </Field>
                )}
                {(lead.status === DEAL_QUOTED_STATUS || lead.status === WON_LEAD_STATUS) && (
                  <Textarea className="md:col-span-3" value={lead.dealNote || ''} onChange={(event) => set('dealNote', event.target.value)} placeholder="Note deal / báo phí / điều kiện chốt" />
                )}
                {lead.status === LOST_LEAD_STATUS && (
                  <Textarea className="md:col-span-3" value={lead.lostNote || ''} onChange={(event) => set('lostNote', event.target.value)} placeholder="Ghi chú thêm về lý do mất lead" />
                )}
              </FormSection>
            )}

            <Button className="w-fit" onClick={save} disabled={saving}><Save /> {saving ? 'Đang lưu...' : 'Lưu lead'}</Button>
          </CardContent>
        </Card>
      )}

      {tab === 'activities' && (
        <Card>
          <CardHeader><CardTitle>Timeline tư vấn</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            {callLogs.length > 0 && (
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                <p className="mb-2 text-sm font-extrabold text-blue-800">Call logs Stringee</p>
                <div className="grid gap-2">
                  {callLogs.slice(0, 8).map((log) => (
                    <div key={log.id} className="flex flex-col justify-between gap-2 rounded-lg bg-white px-3 py-2 text-sm md:flex-row md:items-center">
                      <span className="font-semibold text-slate-700">{callLogText(log)}</span>
                        <CallRecordingButton log={log} className="text-xs" />
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
                  <span className={`mt-2 inline-flex rounded border px-2 py-0.5 text-[11px] font-bold ${timelineToneClass[event.tone] || timelineToneClass.gray}`}>{event.label}</span>
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
          <CardHeader><CardTitle>Lịch hẹn đã tạo</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            {appointments.length === 0 && <p className="text-sm text-slate-500">Chưa có lịch hẹn nào.</p>}
            {appointments.map((appointment) => (
              <div key={appointment.id} className="flex flex-col gap-1 rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{appointment.title}</span>
                  <div className="flex items-center gap-2">
                    <Badge tone={apptStatusColor[appointment.status] || 'blue'}>{appointmentStatusLabel(appointment.status)}</Badge>
                    <Select
                      className="w-36"
                      value={appointment.status}
                      onChange={(event) => void updateAppointmentStatus(appointment, event.target.value as Appointment['status'])}
                    >
                      <option value="upcoming">Sắp diễn ra</option>
                      <option value="done">Hoàn thành</option>
                      <option value="cancelled">Đã hủy</option>
                      <option value="overdue">Quá hạn</option>
                    </Select>
                  </div>
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
