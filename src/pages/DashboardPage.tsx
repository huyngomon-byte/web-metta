import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  CircleDollarSign,
  Clock,
  ClipboardList,
  Phone,
  PhoneOff,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { DEAL_QUOTED_STATUS, LOST_LEAD_STATUS, WON_LEAD_STATUS, leadSources, leadStatuses, STAFF_OPTIONS } from '@/lib/constants';
import { expectedRevenueAmount, revenueAmount } from '@/lib/leadFinance';
import { formatCurrency } from '@/lib/utils';
import { useCourseOptions } from '@/hooks/useCms';
import { useLeads } from '@/hooks/useLeads';
import { appointmentService } from '@/services/appointmentService';
import { userService } from '@/services/userService';
import type { Appointment, Lead } from '@/types/crm';
import type { AdminUser } from '@/types/user';

/* ── Colors ──────────────────────────────────────────────────────────── */

const STATUS_COLORS: Record<string, string> = {
  'Lead mới': '#3B82F6',
  'Đã liên hệ': '#06B6D4',
  'Chưa nghe máy': '#F59E0B',
  'Đã hẹn tư vấn': '#8B5CF6',
  'Đã tư vấn/Đặt lịch test': '#6366F1',
  'Đã test/Học thử': '#F97316',
  [DEAL_QUOTED_STATUS]: '#EA580C',
  [WON_LEAD_STATUS]: '#16A34A',
  [LOST_LEAD_STATUS]: '#EF4444',
};

const COURSE_COLORS = ['#3B82F6', '#06B6D4', '#8B5CF6', '#F59E0B', '#EC4899', '#16A34A'];
const SOURCE_COLORS = ['#1267AE', '#16A9D8', '#F45A0A', '#16A34A', '#F59E0B', '#DC2626', '#8B5CF6', '#EC4899', '#6366F1', '#64748b'];
const FOLLOW_UP_OPEN_STATUSES: readonly string[] = [leadStatuses[0], leadStatuses[1], leadStatuses[2]];
const UNCONTACTED_STATUSES: readonly string[] = [leadStatuses[0], leadStatuses[2]];

/* ── Helpers ──────────────────────────────────────────────────────────── */

function todayStr() { return new Date().toISOString().slice(0, 10); }

function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function formatVN(dateStr: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isConverted(l: Lead) { return Boolean(l.convertedToStudentId || l.status === WON_LEAD_STATUS); }

function expectedAmount(l: Lead) { return expectedRevenueAmount(l); }
function closedRevenueAmount(l: Lead) { return revenueAmount(l); }

function inRange(dateStr: string, from: string, to: string) {
  if (!dateStr) return false;
  const d = dateStr.slice(0, 10);
  return d >= from && d <= to;
}

function isNonEmptyString(value?: string): value is string {
  return Boolean(value);
}

function ageGroup(age?: string) {
  const v = Number.parseInt(age || '', 10);
  if (!Number.isFinite(v)) return 'Chưa rõ';
  if (v <= 5) return '3–5 tuổi';
  if (v <= 8) return '6–8 tuổi';
  if (v <= 11) return '9–11 tuổi';
  return '12+ tuổi';
}

/* ── Date presets ─────────────────────────────────────────────────────── */

type Preset = 'today' | '7d' | '30d' | 'thisMonth' | 'lastMonth' | 'custom';

function presetRange(p: Preset): [string, string] {
  const t = todayStr();
  if (p === 'today') return [t, t];
  if (p === '7d') return [daysAgo(6), t];
  if (p === '30d') return [daysAgo(29), t];
  if (p === 'thisMonth') {
    const d = new Date();
    return [`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`, t];
  }
  if (p === 'lastMonth') {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0');
    const last = new Date(y, d.getMonth() + 1, 0).getDate();
    return [`${y}-${m}-01`, `${y}-${m}-${String(last).padStart(2, '0')}`];
  }
  return [daysAgo(29), t];
}

/* ══════════════════════════════════════════════════════════════════════ */

export default function DashboardPage() {
  const { leads } = useLeads();
  const COURSE_OPTIONS = useCourseOptions();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);

  // ── Filters ──
  const [preset, setPreset] = useState<Preset>('30d');
  const [dateFrom, setDateFrom] = useState(() => presetRange('30d')[0]);
  const [dateTo, setDateTo] = useState(() => presetRange('30d')[1]);
  const [fSales, setFSales] = useState('');
  const [fSource, setFSource] = useState('');
  const [fCourse, setFCourse] = useState('');

  useEffect(() => { if (preset !== 'custom') { const [f, t] = presetRange(preset); setDateFrom(f); setDateTo(t); } }, [preset]);
  useEffect(() => { appointmentService.getAppointments().then(setAppointments); }, []);
  useEffect(() => { userService.getUsers().then(setUsers).catch(() => setUsers([])); }, []);

  const today = todayStr();

  const salesNameById = useMemo(() => {
    const map = new Map<string, string>();
    users.forEach((item) => {
      if (item.id && item.fullName) map.set(item.id, item.fullName);
    });
    leads.forEach((lead) => {
      if (lead.assignedTo && lead.assignedToName) map.set(lead.assignedTo, lead.assignedToName);
      if (lead.failedAssignedTo && lead.failedAssignedToName) map.set(lead.failedAssignedTo, lead.failedAssignedToName);
    });
    return map;
  }, [leads, users]);

  const salesLabel = useCallback((idOrName: string) => salesNameById.get(idOrName) || idOrName, [salesNameById]);

  // ── Filtered leads ──
  const rangeLeads = useMemo(() => leads.filter((l) => {
    if (!inRange(l.createdAt, dateFrom, dateTo)) return false;
    if (fSales && l.assignedTo !== fSales) return false;
    if (fSource && l.source !== fSource) return false;
    if (fCourse && l.interestedCourse !== fCourse) return false;
    return true;
  }), [leads, dateFrom, dateTo, fSales, fSource, fCourse]);

  const salesOptions = useMemo(() => {
    // Same logic as LeadsPage: STAFF_OPTIONS + assigned + custom - hidden
    let custom: string[] = [], hidden: string[] = [];
    try { custom = JSON.parse(localStorage.getItem('metta_sales_staff') || '[]'); } catch {}
    try { hidden = JSON.parse(localStorage.getItem('metta_hidden_sales_staff') || '[]'); } catch {}
    const salesIds = users.filter((item) => item.role === 'sales' && item.active).map((item) => item.id);
    const all = new Set([...salesIds, ...STAFF_OPTIONS, ...leads.map((l) => l.assignedTo).filter(isNonEmptyString), ...custom]);
    return Array.from(all).filter((n) => n && !hidden.includes(n));
  }, [leads, users]);

  /* ── KPI ── */
  const kpi = useMemo(() => {
    const total = rangeLeads.length;
    const newToday = leads.filter((l) => l.createdAt?.startsWith(today)).length;
    const untouched = leads.filter((l) => l.status === leadStatuses[0]).length;
    const overdueFollowUp = leads.filter((l) => {
      if (!l.followUpDate) return false;
      return l.followUpDate.slice(0, 10) < today && FOLLOW_UP_OPEN_STATUSES.includes(l.status);
    }).length;
    const followUpToday = leads.filter((l) => l.followUpDate?.startsWith(today)).length;
    const contacted = rangeLeads.filter((l) => !UNCONTACTED_STATUSES.includes(l.status)).length;
    const contactRate = total ? Math.round((contacted / total) * 100) : 0;
    const ttStatuses = [leadStatuses[4], leadStatuses[5], DEAL_QUOTED_STATUS, WON_LEAD_STATUS];
    const testTrial = rangeLeads.filter((l) => ttStatuses.includes(l.status)).length;
    const testTrialRate = total ? Math.round((testTrial / total) * 100) : 0;
    const converted = rangeLeads.filter(isConverted).length;
    const lost = rangeLeads.filter((l) => l.status === LOST_LEAD_STATUS).length;
    const expectedRevenue = rangeLeads
      .filter((l) => l.status === DEAL_QUOTED_STATUS)
      .reduce((sum, lead) => sum + expectedAmount(lead), 0);
    const revenue = rangeLeads
      .filter((l) => isConverted(l))
      .reduce((sum, lead) => sum + closedRevenueAmount(lead), 0);
    const convRate = total ? Math.round((converted / total) * 100) : 0;
    const lostRate = total ? Math.round((lost / total) * 100) : 0;
    // trend vs previous period
    const days = Math.max(1, Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000) + 1);
    const off = Math.round((new Date(today).getTime() - new Date(dateTo).getTime()) / 86400000);
    const pFrom = daysAgo(days * 2 - 1 + off), pTo = daysAgo(days + off);
    const prev = leads.filter((l) => inRange(l.createdAt, pFrom, pTo)).length;
    const trend = prev ? Math.round(((total - prev) / prev) * 100) : 0;
    return { total, newToday, untouched, overdueFollowUp, followUpToday, contacted, contactRate, testTrial, testTrialRate, converted, lost, expectedRevenue, revenue, convRate, lostRate, trend };
  }, [rangeLeads, leads, today, dateFrom, dateTo]);

  /* ── PIC table ── */
  const picData = useMemo(() => {
    const pics = new Set([
      ...users.filter((item) => item.role === 'sales' && item.active).map((item) => item.id),
      ...STAFF_OPTIONS,
      ...rangeLeads.map((l) => l.assignedTo).filter(isNonEmptyString),
      ...rangeLeads.map((l) => l.failedAssignedTo).filter(isNonEmptyString),
    ]);
    const cStatuses = [leadStatuses[1], leadStatuses[3], leadStatuses[4], leadStatuses[5], DEAL_QUOTED_STATUS, WON_LEAD_STATUS, LOST_LEAD_STATUS];
    const tStatuses = [leadStatuses[4], leadStatuses[5], DEAL_QUOTED_STATUS, WON_LEAD_STATUS];
    return Array.from(pics).map((pic) => {
      const pl = rangeLeads.filter((l) => l.assignedTo === pic);
      const returned = rangeLeads.filter((l) => l.failedAssignedTo === pic || (l.assignedTo === pic && l.assignedStatus === 'returned')).length;
      const t = pl.length, c = pl.filter((l) => cStatuses.includes(l.status)).length;
      const tt = pl.filter((l) => tStatuses.includes(l.status)).length;
      const cv = pl.filter(isConverted).length, lo = pl.filter((l) => l.status === LOST_LEAD_STATUS).length;
      const expectedRevenue = pl.filter((l) => l.status === DEAL_QUOTED_STATUS).reduce((sum, lead) => sum + expectedAmount(lead), 0);
      const revenue = pl.filter(isConverted).reduce((sum, lead) => sum + closedRevenueAmount(lead), 0);
      return { id: pic, name: salesLabel(pic), total: t, contacted: c, cRate: t ? Math.round((c / t) * 100) : 0, testTrial: tt, converted: cv, cvRate: t ? Math.round((cv / t) * 100) : 0, expectedRevenue, revenue, lost: lo, returned, pending: t - cv - lo };
    }).filter((d) => d.total > 0 || d.returned > 0).sort((a, b) => (b.total + b.returned) - (a.total + a.returned));
  }, [rangeLeads, salesLabel, users]);

  /* ── Trend ── */
  const trendData = useMemo(() => {
    const days = Math.min(Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000) + 1, 30);
    const r = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(dateTo); d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      const dl = leads.filter((l) => l.createdAt?.startsWith(k));
      r.push({ day: `${d.getDate()}/${d.getMonth() + 1}`, 'Lead mới': dl.length, 'Chuyển đổi': dl.filter(isConverted).length });
    }
    return r;
  }, [leads, dateFrom, dateTo]);

  /* ── Status stacked bar ── */
  const statusBarData = useMemo(() => {
    const result: Record<string, number> = {};
    for (const s of leadStatuses) result[s] = rangeLeads.filter((l) => l.status === s).length;
    return [result];
  }, [rangeLeads]);

  /* ── Source data ── */
  const sourceData = useMemo(
    () => leadSources.map((s) => ({ name: s, value: rangeLeads.filter((l) => l.source === s).length })).filter((d) => d.value > 0),
    [rangeLeads],
  );

  /* ── Course data with conversion ── */
  const courseData = useMemo(
    () => COURSE_OPTIONS.map((c) => {
      const cl = rangeLeads.filter((l) => l.interestedCourse === c);
      return { name: c.replace('METTA ', ''), total: cl.length, converted: cl.filter(isConverted).length, cvRate: cl.length ? Math.round((cl.filter(isConverted).length / cl.length) * 100) : 0 };
    }).filter((d) => d.total > 0),
    [COURSE_OPTIONS, rangeLeads],
  );

  /* ── Age data ── */
  const ageData = useMemo(() => {
    const groups = ['3–5 tuổi', '6–8 tuổi', '9–11 tuổi', '12+ tuổi', 'Chưa rõ'];
    return groups.map((g) => ({ name: g, value: rangeLeads.filter((l) => ageGroup(l.age) === g).length })).filter((d) => d.value > 0);
  }, [rangeLeads]);

  /* ── Alerts / Warnings ── */
  const alerts = useMemo(() => {
    const items: { type: 'danger' | 'warning' | 'info'; icon: string; title: string; leads: { id: string; name: string; phone: string; pic: string }[] }[] = [];

    // 1. Duplicate phone numbers
    const phoneMap = new Map<string, Lead[]>();
    for (const l of leads) {
      if (!l.phone) continue;
      const p = l.phone.replace(/\D/g, '');
      if (!p) continue;
      phoneMap.set(p, [...(phoneMap.get(p) || []), l]);
    }
    const dupes = Array.from(phoneMap.values()).filter((g) => g.length > 1);
    if (dupes.length > 0) {
      const dupLeads = dupes.flatMap((g) => g.map((l) => ({ id: l.id, name: l.fullName, phone: l.phone, pic: l.assignedTo })));
      items.push({ type: 'danger', icon: '📞', title: `${dupes.length} số điện thoại bị trùng (${dupLeads.length} lead)`, leads: dupLeads });
    }

    // 2. No PIC assigned
    const noPic = leads.filter((l) => !l.assignedTo && l.status !== LOST_LEAD_STATUS);
    if (noPic.length > 0) {
      items.push({ type: 'warning', icon: '👤', title: `${noPic.length} lead chưa có PIC`, leads: noPic.map((l) => ({ id: l.id, name: l.fullName, phone: l.phone, pic: '' })) });
    }

    // 3. Overdue follow-up
    const overdue = leads.filter((l) => {
      if (!l.followUpDate) return false;
      return l.followUpDate.slice(0, 10) < today && FOLLOW_UP_OPEN_STATUSES.includes(l.status);
    });
    if (overdue.length > 0) {
      items.push({ type: 'danger', icon: '⏰', title: `${overdue.length} lead quá hạn follow-up`, leads: overdue.map((l) => ({ id: l.id, name: l.fullName, phone: l.phone, pic: l.assignedTo })) });
    }

    // 4. Forgotten leads (no update > 3 days, still active)
    const threeDaysAgo = daysAgo(3);
    const forgotten = leads.filter((l) => {
      if ([WON_LEAD_STATUS, LOST_LEAD_STATUS].includes(l.status)) return false;
      return l.updatedAt.slice(0, 10) < threeDaysAgo;
    });
    if (forgotten.length > 0) {
      items.push({ type: 'warning', icon: '💤', title: `${forgotten.length} lead bị bỏ quên > 3 ngày`, leads: forgotten.map((l) => ({ id: l.id, name: l.fullName, phone: l.phone, pic: l.assignedTo })) });
    }

    return items;
  }, [leads, today]);

  /* ── Upcoming test/trial appointments ── */
  const upcomingTests = useMemo(() =>
    appointments
      .filter((a) => a.startTime >= today && ['Tư vấn', 'Test đầu vào'].includes(a.type) && a.status === 'upcoming')
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .slice(0, 6),
    [appointments, today],
  );

  /* ── Tasks today ── */
  const tasks = useMemo(() => [
    ...leads.filter((l) => l.followUpDate?.startsWith(today)).map((l) => ({ type: 'follow-up' as const, title: l.fullName, detail: l.phone, pic: l.assignedTo })),
    ...appointments.filter((a) => a.startTime.startsWith(today) && a.status === 'upcoming').map((a) => ({ type: 'appointment' as const, title: a.title, detail: a.startTime.slice(11, 16), pic: a.assignedTo })),
    ...leads.filter((l) => l.status === leadStatuses[2] && l.updatedAt < daysAgo(1)).map((l) => ({ type: 'retry' as const, title: l.fullName, detail: l.phone, pic: l.assignedTo })),
  ], [leads, appointments, today]);

  /* ── Recent leads ── */
  const recentLeads = useMemo(() => [...leads].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8), [leads]);

  const hasFilter = fSales || fSource || fCourse;

  /* ══════════════════════════════════════════════════════════════════════ */

  return (
    <div className="flex flex-col gap-5">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Tổng quan CRM tuyển sinh METTA Academy</p>
      </div>

      {/* ── Filters bar ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-2">
        {/* Date preset buttons */}
        {([['today', 'Hôm nay'], ['7d', '7 ngày'], ['30d', '30 ngày'], ['thisMonth', 'Tháng này'], ['lastMonth', 'Tháng trước']] as [Preset, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPreset(key)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${preset === key ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setPreset('custom')}
          className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${preset === 'custom' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          Tùy chọn
        </button>
        {preset === 'custom' && (
          <>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-semibold cursor-pointer w-[120px]" />
            <span className="text-slate-400 text-xs">→</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
              className="border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-semibold cursor-pointer w-[120px]" />
          </>
        )}

        <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />

        <Select value={fSales} onChange={(e) => setFSales(e.target.value)} className="text-xs w-auto min-w-[100px]">
          <option value="">Tất cả Sales</option>
          {salesOptions.map((s) => <option key={s} value={s}>{salesLabel(s)}</option>)}
        </Select>
        <Select value={fSource} onChange={(e) => setFSource(e.target.value)} className="text-xs w-auto min-w-[100px]">
          <option value="">Tất cả nguồn</option>
          {leadSources.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={fCourse} onChange={(e) => setFCourse(e.target.value)} className="text-xs w-auto min-w-[100px]">
          <option value="">Tất cả khóa</option>
          {COURSE_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>

        {hasFilter && (
          <button onClick={() => { setFSales(''); setFSource(''); setFCourse(''); }}
            className="text-xs text-red-500 font-semibold hover:text-red-700 ml-1">✕ Xóa filter</button>
        )}

        <span className="ml-auto text-[11px] text-slate-400 hidden sm:block">{formatVN(dateFrom)} – {formatVN(dateTo)} • {rangeLeads.length} lead</span>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-3">
        <KpiCard label="Lead mới hôm nay" value={kpi.newToday} icon={UserPlus} color="bg-blue-500" trend={kpi.trend} sub="Từ ads / form" />
        <KpiCard label="Chưa xử lý" value={kpi.untouched} icon={PhoneOff} color="bg-orange-500" sub="Chưa ai gọi" alert={kpi.untouched > 0} />
        <KpiCard label="Quá hạn follow-up" value={kpi.overdueFollowUp} icon={AlertTriangle} color="bg-red-500" sub={`${kpi.followUpToday} gọi hôm nay`} alert={kpi.overdueFollowUp > 0} />
        <KpiCard label="Liên hệ thành công" value={`${kpi.contactRate}%`} icon={Phone} color="bg-cyan-500" sub={`${kpi.contacted}/${kpi.total} lead`} />
        <KpiCard label="Test / Học thử" value={`${kpi.testTrialRate}%`} icon={ClipboardList} color="bg-violet-500" sub={`${kpi.testTrial} lead`} />
        <KpiCard label="Expected revenue" value={formatCurrency(kpi.expectedRevenue)} icon={CircleDollarSign} color="bg-orange-500" sub={DEAL_QUOTED_STATUS} />
        <KpiCard label="Revenue" value={formatCurrency(kpi.revenue)} icon={CircleDollarSign} color="bg-emerald-500" sub={WON_LEAD_STATUS} />
        <KpiCard label="Đã chuyển đổi" value={kpi.converted} icon={UserCheck} color="bg-emerald-500" sub={`Tỷ lệ ${kpi.convRate}%`} />
        <KpiCard label="Mất lead" value={kpi.lost} icon={AlertTriangle} color="bg-red-400" sub={`Tỷ lệ ${kpi.lostRate}%`} />
      </div>

      {/* ── Alerts ── */}
      {alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          {alerts.map((a, i) => (
            <AlertRow key={i} alert={a} />
          ))}
        </div>
      )}

      {/* ── Row: Status (left) + PIC table (right) ── */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,5fr)]">
        {/* Status - compact */}
        <Card>
          <CardHeader className="pb-1">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold text-slate-700">Trạng thái</CardTitle>
              <span className="text-xs font-extrabold text-slate-800">{rangeLeads.length} lead</span>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            {rangeLeads.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                <div className="h-8 flex rounded-lg overflow-hidden">
                  {leadStatuses.map((s) => {
                    const count = rangeLeads.filter((l) => l.status === s).length;
                    if (!count) return null;
                    const pct = (count / rangeLeads.length) * 100;
                    return (
                      <div key={s} className="h-full flex items-center justify-center text-white text-[9px] font-bold transition-all" title={`${s}: ${count}`}
                        style={{ width: `${pct}%`, backgroundColor: STATUS_COLORS[s], minWidth: count > 0 ? 16 : 0 }}>
                        {pct > 10 ? count : ''}
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-col gap-0.5">
                  {leadStatuses.map((s) => {
                    const count = rangeLeads.filter((l) => l.status === s).length;
                    if (!count) return null;
                    return (
                      <div key={s} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-slate-50 text-[11px]">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[s] }} />
                        <span className="text-slate-600 flex-1 truncate">{s}</span>
                        <span className="font-bold text-slate-800">{count}</span>
                        <span className="text-[10px] text-slate-400 w-7 text-right">{Math.round((count / rangeLeads.length) * 100)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : <EmptyState />}
          </CardContent>
        </Card>

        {/* PIC Table - compact */}
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-bold text-slate-700">
              <Users size={14} className="inline mr-1.5 -mt-0.5" />
              Hiệu suất theo Sales (PIC)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {picData.length > 0 ? (
              <div className="overflow-x-auto -mx-4 px-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b-2 border-slate-200">
                      {['Sales', 'Nhận', 'Đã gọi', '% LH', 'Test/HT', 'Chốt', '% Chốt', 'Expected', 'Revenue', 'Mất', 'Bị trả về', 'Tiến độ'].map((h) => (
                        <th key={h} className={`py-2 px-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider ${h === 'Sales' || h === 'Tiến độ' ? 'text-left' : 'text-center'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {picData.map((p, i) => {
                      const top = picData.length > 1 && i === 0;
                      return (
                        <tr key={p.id} className={`border-b border-slate-100 hover:bg-blue-50/30 transition ${top ? 'bg-emerald-50/30' : ''}`}>
                          <td className="py-2 px-1.5">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${top ? 'bg-emerald-500 text-white' : 'bg-blue-100 text-blue-700'}`}>
                                {p.name.split(' ').pop()?.charAt(0) || p.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800 text-xs">{p.name}</p>
                                {top && <span className="text-[8px] font-bold text-emerald-600">Top</span>}
                              </div>
                            </div>
                          </td>
                          <td className="text-center py-2 px-1.5 text-sm font-extrabold text-slate-800">{p.total}</td>
                          <td className="text-center py-2 px-1.5 font-bold text-cyan-600">{p.contacted}</td>
                          <td className="text-center py-2 px-1.5">
                            <RateBadge value={p.cRate} good={70} warn={40} />
                          </td>
                          <td className="text-center py-2 px-1.5 font-bold text-violet-600">{p.testTrial}</td>
                          <td className="text-center py-2 px-1.5 text-sm font-extrabold text-emerald-600">{p.converted}</td>
                          <td className="text-center py-2 px-1.5">
                            <RateBadge value={p.cvRate} good={30} warn={15} />
                          </td>
                          <td className="text-center py-2 px-1.5 text-[11px] font-bold text-orange-600">{formatCurrency(p.expectedRevenue)}</td>
                          <td className="text-center py-2 px-1.5 text-[11px] font-bold text-emerald-600">{formatCurrency(p.revenue)}</td>
                          <td className="text-center py-2 px-1.5 font-bold text-red-500">{p.lost}</td>
                          <td className="text-center py-2 px-1.5 font-bold text-orange-600">{p.returned}</td>
                          <td className="py-2 px-1.5 min-w-[100px]">
                            <ProgressBar parts={[
                              { value: p.converted, color: '#16A34A' },
                              { value: p.pending, color: '#3B82F6' },
                              { value: p.lost, color: '#EF4444' },
                            ]} total={p.total} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="flex items-center gap-4 mt-1.5 pt-1.5 border-t border-slate-100 text-[9px] text-slate-400 font-semibold">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded bg-emerald-500" /> Chốt</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded bg-blue-500" /> Đang xử lý</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded bg-red-500" /> Mất</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-1.5 rounded bg-orange-500" /> Bị trả về</span>
                </div>
              </div>
            ) : <EmptyState />}
          </CardContent>
        </Card>
      </div>

      {/* ── Row: Trend + Source ── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm font-bold text-slate-700">Xu hướng Lead theo ngày</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, fontWeight: 600 }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 11 }} />
                <Line dataKey="Lead mới" stroke="#3B82F6" strokeWidth={2.5} dot={{ r: 3, fill: '#3B82F6' }} activeDot={{ r: 5 }} />
                <Line dataKey="Chuyển đổi" stroke="#16A34A" strokeWidth={2.5} dot={{ r: 3, fill: '#16A34A' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm font-bold text-slate-700">Lead theo nguồn</CardTitle></CardHeader>
          <CardContent className="h-72">
            {sourceData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sourceData} margin={{ top: 5, right: 5, left: -20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-35} textAnchor="end" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
                  <Bar dataKey="value" name="Lead" radius={[6, 6, 0, 0]}>
                    {sourceData.map((_, i) => <Cell key={i} fill={SOURCE_COLORS[i % SOURCE_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : <EmptyState />}
          </CardContent>
        </Card>
      </div>

      {/* ── Row: Course + Age ── */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm font-bold text-slate-700">Lead & tỷ lệ chốt theo khóa</CardTitle></CardHeader>
          <CardContent>
            {courseData.length > 0 ? (
              <div className="flex flex-col gap-2.5 pt-1">
                {courseData.map((c, i) => (
                  <div key={c.name}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-bold text-slate-700">{c.name}</span>
                      <span className="text-xs text-slate-500">{c.total} lead • <span className="font-bold text-emerald-600">{c.cvRate}% chốt</span></span>
                    </div>
                    <div className="h-6 bg-slate-100 rounded-lg overflow-hidden flex">
                      <div className="h-full rounded-lg transition-all duration-500 flex items-center" style={{ width: `${Math.max((c.total / (courseData[0]?.total || 1)) * 100, 5)}%`, backgroundColor: COURSE_COLORS[i % COURSE_COLORS.length] }}>
                        {c.total > 0 && <span className="text-white text-[10px] font-bold ml-2">{c.total}</span>}
                      </div>
                      {c.converted > 0 && (
                        <div className="h-full bg-emerald-500 flex items-center" style={{ width: `${(c.converted / (courseData[0]?.total || 1)) * 100}%`, minWidth: 18 }}>
                          <span className="text-white text-[10px] font-bold ml-1">✓{c.converted}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : <EmptyState />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm font-bold text-slate-700">Lead theo độ tuổi</CardTitle></CardHeader>
          <CardContent>
            {ageData.length > 0 ? (
              <div className="flex flex-col gap-2.5 pt-1">
                {ageData.map((a, i) => {
                  const max = Math.max(...ageData.map((d) => d.value));
                  const colors = ['#3B82F6', '#06B6D4', '#8B5CF6', '#F97316', '#94a3b8'];
                  return (
                    <div key={a.name}>
                      <div className="flex justify-between mb-1">
                        <span className="text-xs font-bold text-slate-700">{a.name}</span>
                        <span className="text-sm font-extrabold text-slate-800">{a.value}</span>
                      </div>
                      <div className="h-6 bg-slate-100 rounded-lg overflow-hidden">
                        <div className="h-full rounded-lg transition-all duration-500 flex items-center"
                          style={{ width: `${Math.max((a.value / max) * 100, 5)}%`, backgroundColor: colors[i % colors.length] }}>
                          {a.value > 0 && <span className="text-white text-[10px] font-bold ml-2">{a.value}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : <EmptyState />}
          </CardContent>
        </Card>
      </div>

      {/* ── Row: Upcoming + Tasks + Recent ── */}
      <div className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-bold text-slate-700">
              <CalendarCheck size={14} className="inline mr-1.5 -mt-0.5" />
              Lịch test/tư vấn sắp tới
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingTests.length > 0 ? (
              <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                {upcomingTests.map((a) => (
                  <div key={a.id} className="flex items-center gap-2.5 bg-violet-50/50 border border-violet-100 rounded-lg px-2.5 py-2">
                    <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-600 flex items-center justify-center flex-shrink-0">
                      <CalendarCheck size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{a.title}</p>
                      <p className="text-[10px] text-slate-500">{a.assignedTo} • {a.type}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[11px] font-bold text-violet-700">
                        {new Date(a.startTime).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                      </p>
                      <p className="text-[10px] text-slate-500">{a.startTime.slice(11, 16)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                <CalendarCheck size={24} className="mb-1.5 opacity-30" />
                <p className="text-[11px] font-semibold">Không có lịch sắp tới</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-bold text-slate-700">
              <Clock size={14} className="inline mr-1.5 -mt-0.5" />
              Việc cần làm hôm nay
              {tasks.length > 0 && <span className="ml-2 text-[10px] font-bold text-white bg-red-500 rounded-full px-1.5 py-0.5">{tasks.length}</span>}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {tasks.length > 0 ? (
              <div className="flex flex-col gap-1.5 max-h-64 overflow-y-auto">
                {tasks.map((t, i) => (
                  <div key={i} className="flex items-center gap-2.5 bg-slate-50 rounded-lg px-2.5 py-2 border border-slate-100">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      t.type === 'follow-up' ? 'bg-amber-100 text-amber-600' : t.type === 'appointment' ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {t.type === 'follow-up' ? <Phone size={12} /> : t.type === 'appointment' ? <CalendarCheck size={12} /> : <AlertTriangle size={12} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{t.title}</p>
                      <p className="text-[10px] text-slate-500">{t.detail} • {t.pic || 'Chưa gán'}</p>
                    </div>
                    <Badge tone={t.type === 'follow-up' ? 'orange' : t.type === 'appointment' ? 'cyan' : 'red'} className="text-[9px] flex-shrink-0">
                      {t.type === 'follow-up' ? 'Follow-up' : t.type === 'appointment' ? 'Lịch hẹn' : 'Gọi lại'}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                <Clock size={24} className="mb-1.5 opacity-30" />
                <p className="text-[11px] font-semibold">Không có việc cần làm</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-bold text-slate-700">
              <UserPlus size={14} className="inline mr-1.5 -mt-0.5" />
              Lead mới nhất
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentLeads.length > 0 ? (
              <div className="flex flex-col gap-0.5 max-h-64 overflow-y-auto">
                {recentLeads.map((l) => (
                  <div key={l.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 transition">
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                      {l.fullName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-700 truncate">{l.fullName}</p>
                      <p className="text-[10px] text-slate-400">{l.phone} • {l.source}</p>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: `${STATUS_COLORS[l.status]}15`, color: STATUS_COLORS[l.status] }}>
                      {l.status}
                    </span>
                  </div>
                ))}
              </div>
            ) : <EmptyState />}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────────────────── */

function KpiCard({ label, value, icon: Icon, color, trend, sub, alert }: {
  label: string; value: string | number; icon: React.ElementType; color: string; trend?: number; sub?: string; alert?: boolean;
}) {
  return (
    <Card className={`overflow-hidden ${alert ? 'ring-2 ring-red-200 bg-red-50/40' : ''}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider leading-tight">{label}</p>
            <p className={`mt-1.5 whitespace-nowrap text-lg font-extrabold leading-tight sm:text-xl ${alert ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              {trend !== undefined && trend !== 0 && (
                <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${trend > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {trend > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                  {Math.abs(trend)}%
                </span>
              )}
              {sub && <span className="text-[10px] text-slate-400 truncate">{sub}</span>}
            </div>
          </div>
          <div className={`w-10 h-10 rounded-xl ${color} text-white flex items-center justify-center flex-shrink-0 shadow-sm`}>
            <Icon size={20} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RateBadge({ value, good, warn, label }: { value: number; good: number; warn: number; label?: string }) {
  const cls = value >= good ? 'bg-emerald-100 text-emerald-700' : value >= warn ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-600';
  return <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{label ? `${label} ` : ''}{value}%</span>;
}

function ProgressBar({ parts, total }: { parts: { value: number; color: string }[]; total: number }) {
  return (
    <div className="flex h-6 rounded-full overflow-hidden bg-slate-100 text-[9px] font-bold">
      {parts.map((p, i) => p.value > 0 ? (
        <div key={i} className="h-full flex items-center justify-center text-white transition-all"
          style={{ width: `${(p.value / total) * 100}%`, backgroundColor: p.color, minWidth: 16 }}>
          {p.value}
        </div>
      ) : null)}
    </div>
  );
}

function AlertRow({ alert }: { alert: { type: 'danger' | 'warning' | 'info'; icon: string; title: string; leads: { id: string; name: string; phone: string; pic: string }[] } }) {
  const [open, setOpen] = useState(false);
  const styles = {
    danger: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  const badgeStyles = {
    danger: 'bg-red-500',
    warning: 'bg-amber-500',
    info: 'bg-blue-500',
  };
  return (
    <div className={`border rounded-xl overflow-hidden ${styles[alert.type]}`}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left cursor-pointer hover:opacity-80 transition"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-lg">{alert.icon}</span>
        <span className="text-sm font-bold flex-1">{alert.title}</span>
        <span className={`text-[10px] font-bold text-white px-2 py-0.5 rounded-full ${badgeStyles[alert.type]}`}>
          {alert.leads.length}
        </span>
        <span className={`text-xs transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open && (
        <div className="px-4 pb-3 border-t border-inherit">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1.5 mt-2">
            {alert.leads.slice(0, 20).map((l) => (
              <div key={l.id} className="flex items-center gap-2 bg-white/70 rounded-lg px-2.5 py-1.5 text-xs">
                <span className="font-bold text-slate-700 truncate flex-1">{l.name}</span>
                <span className="text-slate-500 flex-shrink-0">{l.phone}</span>
                {l.pic && <span className="text-[10px] bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded flex-shrink-0">{l.pic}</span>}
                {!l.pic && <span className="text-[10px] bg-red-200 text-red-700 px-1.5 py-0.5 rounded flex-shrink-0">Chưa gán</span>}
              </div>
            ))}
            {alert.leads.length > 20 && (
              <div className="text-xs text-slate-500 font-semibold px-2.5 py-1.5">+{alert.leads.length - 20} lead khác...</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[80px] items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs font-semibold text-slate-400">
      Chưa có dữ liệu
    </div>
  );
}
