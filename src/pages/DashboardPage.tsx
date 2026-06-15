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
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { DEAL_QUOTED_STATUS, LOST_LEAD_STATUS, WON_LEAD_STATUS, leadSources, leadStatuses, STAFF_OPTIONS } from '@/lib/constants';
import { buildReasonShareData, buildStageCohortData, formatDurationHours } from '@/lib/leadAnalytics';
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
const REASON_COLORS = ['#EF4444', '#F97316', '#F59E0B', '#8B5CF6', '#3B82F6', '#06B6D4', '#10B981', '#64748B', '#EC4899', '#14B8A6', '#A855F7'];
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

function addDays(dateStr: string, delta: number) {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

function periodDays(from: string, to: string) {
  return Math.max(1, Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86400000) + 1);
}

function previousPeriod(from: string, to: string): [string, string] {
  const days = periodDays(from, to);
  return [addDays(from, -days), addDays(to, -days)];
}

function trendPercent(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function leadMetricSummary(items: Lead[]) {
  const total = items.length;
  const contacted = items.filter((l) => !UNCONTACTED_STATUSES.includes(l.status)).length;
  const ttStatuses = [leadStatuses[4], leadStatuses[5], DEAL_QUOTED_STATUS, WON_LEAD_STATUS];
  const testTrial = items.filter((l) => ttStatuses.includes(l.status)).length;
  const converted = items.filter(isConverted).length;
  const lost = items.filter((l) => l.status === LOST_LEAD_STATUS).length;
  const expectedRevenue = items
    .filter((l) => l.status === DEAL_QUOTED_STATUS)
    .reduce((sum, lead) => sum + expectedAmount(lead), 0);
  const revenue = items
    .filter((l) => isConverted(l))
    .reduce((sum, lead) => sum + closedRevenueAmount(lead), 0);

  return {
    total,
    contacted,
    contactRate: total ? Math.round((contacted / total) * 100) : 0,
    testTrial,
    testTrialRate: total ? Math.round((testTrial / total) * 100) : 0,
    converted,
    lost,
    expectedRevenue,
    revenue,
    convRate: total ? Math.round((converted / total) * 100) : 0,
    lostRate: total ? Math.round((lost / total) * 100) : 0,
  };
}

export default function DashboardPage() {
  const { leads } = useLeads({ realtime: false, pollMs: 60000 });
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
  const [fCenter, setFCenter] = useState('');

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

  const salesIdByName = useMemo(() => {
    const map = new Map<string, string>();
    users.filter((item) => item.role === 'sales' && item.active).forEach((item) => {
      if (item.fullName && item.id) map.set(item.fullName, item.id);
    });
    return map;
  }, [users]);

  const canonicalSalesKey = useCallback((idOrName?: string) => {
    if (!idOrName) return '';
    return salesIdByName.get(idOrName) || idOrName;
  }, [salesIdByName]);

  const salesLabel = useCallback((idOrName: string) => salesNameById.get(idOrName) || idOrName, [salesNameById]);

  // ── Filtered leads ──
  const baseLeads = useMemo(() => leads.filter((l) => {
    if (fSales && canonicalSalesKey(l.assignedTo || l.assignedToName) !== fSales) return false;
    if (fSource && l.source !== fSource) return false;
    if (fCourse && l.interestedCourse !== fCourse) return false;
    if (fCenter && l.centerName !== fCenter) return false;
    return true;
  }), [canonicalSalesKey, leads, fSales, fSource, fCourse, fCenter]);

  const rangeLeads = useMemo(() => baseLeads.filter((l) => inRange(l.createdAt, dateFrom, dateTo)), [baseLeads, dateFrom, dateTo]);

  const [previousFrom, previousTo] = useMemo(() => previousPeriod(dateFrom, dateTo), [dateFrom, dateTo]);
  const previousRangeLeads = useMemo(() => baseLeads.filter((l) => inRange(l.createdAt, previousFrom, previousTo)), [baseLeads, previousFrom, previousTo]);

  const pipelineLeads = baseLeads;

  const salesOptions = useMemo(() => {
    // Same logic as LeadsPage: active CRM users + assigned sales in Firestore data.
    const salesIds = users.filter((item) => item.role === 'sales' && item.active).map((item) => item.id);
    const all = new Set([
      ...salesIds,
      ...STAFF_OPTIONS.map((item) => canonicalSalesKey(item)),
      ...leads.map((l) => canonicalSalesKey(l.assignedTo || l.assignedToName)).filter(isNonEmptyString),
    ]);
    return Array.from(all).filter(Boolean);
  }, [canonicalSalesKey, leads, users]);

  const centerOptions = useMemo(() => Array.from(new Set(leads.map((lead) => lead.centerName || '').filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi')), [leads]);

  /* ── KPI ── */
  const kpi = useMemo(() => {
    const current = leadMetricSummary(rangeLeads);
    const previous = leadMetricSummary(previousRangeLeads);
    const newToday = pipelineLeads.filter((l) => l.createdAt?.startsWith(today)).length;
    const untouched = pipelineLeads.filter((l) => l.status === leadStatuses[0]).length;
    const overdueFollowUp = pipelineLeads.filter((l) => {
      if (!l.followUpDate) return false;
      return l.followUpDate.slice(0, 10) < today && FOLLOW_UP_OPEN_STATUSES.includes(l.status);
    }).length;
    const followUpToday = pipelineLeads.filter((l) => l.followUpDate?.startsWith(today)).length;
    return {
      ...current,
      newToday,
      untouched,
      overdueFollowUp,
      followUpToday,
      trend: trendPercent(current.total, previous.total),
      contactTrend: trendPercent(current.contacted, previous.contacted),
      testTrialTrend: trendPercent(current.testTrial, previous.testTrial),
      convertedTrend: trendPercent(current.converted, previous.converted),
      lostTrend: trendPercent(current.lost, previous.lost),
      expectedTrend: trendPercent(current.expectedRevenue, previous.expectedRevenue),
      revenueTrend: trendPercent(current.revenue, previous.revenue),
    };
  }, [rangeLeads, previousRangeLeads, pipelineLeads, today]);

  /* ── PIC table ── */
  const picData = useMemo(() => {
    const pics = new Set([
      ...users.filter((item) => item.role === 'sales' && item.active).map((item) => item.id),
      ...STAFF_OPTIONS.map((item) => canonicalSalesKey(item)),
      ...rangeLeads.map((l) => canonicalSalesKey(l.assignedTo || l.assignedToName)).filter(isNonEmptyString),
      ...rangeLeads.map((l) => canonicalSalesKey(l.failedAssignedTo || l.failedAssignedToName)).filter(isNonEmptyString),
    ]);
    const cStatuses = [leadStatuses[1], leadStatuses[3], leadStatuses[4], leadStatuses[5], DEAL_QUOTED_STATUS, WON_LEAD_STATUS, LOST_LEAD_STATUS];
    const tStatuses = [leadStatuses[4], leadStatuses[5], DEAL_QUOTED_STATUS, WON_LEAD_STATUS];
    return Array.from(pics).map((pic) => {
      const pl = rangeLeads.filter((l) => canonicalSalesKey(l.assignedTo || l.assignedToName) === pic);
      const returned = rangeLeads.filter((l) =>
        canonicalSalesKey(l.failedAssignedTo || l.failedAssignedToName) === pic ||
        (canonicalSalesKey(l.assignedTo || l.assignedToName) === pic && l.assignedStatus === 'returned'),
      ).length;
      const t = pl.length, c = pl.filter((l) => cStatuses.includes(l.status)).length;
      const tt = pl.filter((l) => tStatuses.includes(l.status)).length;
      const cv = pl.filter(isConverted).length, lo = pl.filter((l) => l.status === LOST_LEAD_STATUS).length;
      const expectedRevenue = pl.filter((l) => l.status === DEAL_QUOTED_STATUS).reduce((sum, lead) => sum + expectedAmount(lead), 0);
      const revenue = pl.filter(isConverted).reduce((sum, lead) => sum + closedRevenueAmount(lead), 0);
      return { id: pic, name: salesLabel(pic), total: t, contacted: c, cRate: t ? Math.round((c / t) * 100) : 0, testTrial: tt, converted: cv, cvRate: t ? Math.round((cv / t) * 100) : 0, expectedRevenue, revenue, lost: lo, returned, pending: t - cv - lo };
    }).filter((d) => d.total > 0 || d.returned > 0).sort((a, b) => (b.total + b.returned) - (a.total + a.returned));
  }, [canonicalSalesKey, rangeLeads, salesLabel, users]);

  const salesContributionData = useMemo(() => {
    const totalExpected = picData.reduce((sum, item) => sum + item.expectedRevenue, 0);
    const totalRevenue = picData.reduce((sum, item) => sum + item.revenue, 0);
    return picData
      .map((item) => ({
        ...item,
        expectedShare: totalExpected ? Math.round((item.expectedRevenue / totalExpected) * 100) : 0,
        revenueShare: totalRevenue ? Math.round((item.revenue / totalRevenue) * 100) : 0,
      }))
      .filter((item) => item.expectedRevenue || item.revenue);
  }, [picData]);

  /* ── Trend ── */
  const trendData = useMemo(() => {
    const days = Math.min(Math.round((new Date(dateTo).getTime() - new Date(dateFrom).getTime()) / 86400000) + 1, 30);
    const r = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(dateTo); d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      const dl = baseLeads.filter((l) => l.createdAt?.startsWith(k));
      r.push({ day: `${d.getDate()}/${d.getMonth() + 1}`, 'Lead mới': dl.length, 'Chuyển đổi': dl.filter(isConverted).length });
    }
    return r;
  }, [baseLeads, dateFrom, dateTo]);

  /* ── Status stacked bar ── */
  const statusBarData = useMemo(() => {
    const result: Record<string, number> = {};
    for (const s of leadStatuses) result[s] = pipelineLeads.filter((l) => l.status === s).length;
    return [result];
  }, [pipelineLeads]);

  const stageCohortData = useMemo(() => buildStageCohortData(pipelineLeads), [pipelineLeads]);
  const pendingReasonData = useMemo(() => buildReasonShareData(pipelineLeads, 'pendingReason'), [pipelineLeads]);
  const lostReasonData = useMemo(() => buildReasonShareData(pipelineLeads, 'lostReason'), [pipelineLeads]);

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
    for (const l of pipelineLeads) {
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
    const noPic = pipelineLeads.filter((l) => !l.assignedTo && l.status !== LOST_LEAD_STATUS);
    if (noPic.length > 0) {
      items.push({ type: 'warning', icon: '👤', title: `${noPic.length} lead chưa có PIC`, leads: noPic.map((l) => ({ id: l.id, name: l.fullName, phone: l.phone, pic: '' })) });
    }

    // 3. Overdue follow-up
    const overdue = pipelineLeads.filter((l) => {
      if (!l.followUpDate) return false;
      return l.followUpDate.slice(0, 10) < today && FOLLOW_UP_OPEN_STATUSES.includes(l.status);
    });
    if (overdue.length > 0) {
      items.push({ type: 'danger', icon: '⏰', title: `${overdue.length} lead quá hạn follow-up`, leads: overdue.map((l) => ({ id: l.id, name: l.fullName, phone: l.phone, pic: l.assignedTo })) });
    }

    // 4. Forgotten leads (no update > 3 days, still active)
    const threeDaysAgo = daysAgo(3);
    const forgotten = pipelineLeads.filter((l) => {
      if ([WON_LEAD_STATUS, LOST_LEAD_STATUS].includes(l.status)) return false;
      return l.updatedAt.slice(0, 10) < threeDaysAgo;
    });
    if (forgotten.length > 0) {
      items.push({ type: 'warning', icon: '💤', title: `${forgotten.length} lead bị bỏ quên > 3 ngày`, leads: forgotten.map((l) => ({ id: l.id, name: l.fullName, phone: l.phone, pic: l.assignedTo })) });
    }

    return items;
  }, [pipelineLeads, today]);

  /* ── Upcoming test/trial appointments ── */
  const pipelineLeadIds = useMemo(() => new Set(pipelineLeads.map((lead) => lead.id)), [pipelineLeads]);

  const upcomingTests = useMemo(() =>
    appointments
      .filter((a) => a.startTime >= today && ['Tư vấn', 'Test đầu vào'].includes(a.type) && a.status === 'upcoming')
      .filter((a) => !a.leadId || pipelineLeadIds.has(a.leadId))
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .slice(0, 6),
    [appointments, pipelineLeadIds, today],
  );

  /* ── Tasks today ── */
  const tasks = useMemo(() => [
    ...pipelineLeads.filter((l) => l.followUpDate?.startsWith(today)).map((l) => ({ type: 'follow-up' as const, title: l.fullName, detail: l.phone, pic: l.assignedTo })),
    ...appointments.filter((a) => a.startTime.startsWith(today) && a.status === 'upcoming' && (!a.leadId || pipelineLeadIds.has(a.leadId))).map((a) => ({ type: 'appointment' as const, title: a.title, detail: a.startTime.slice(11, 16), pic: a.assignedTo })),
    ...pipelineLeads.filter((l) => l.status === leadStatuses[2] && l.updatedAt < daysAgo(1)).map((l) => ({ type: 'retry' as const, title: l.fullName, detail: l.phone, pic: l.assignedTo })),
  ], [pipelineLeads, appointments, pipelineLeadIds, today]);

  /* ── Recent leads ── */
  const recentLeads = useMemo(() => [...pipelineLeads].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8), [pipelineLeads]);

  const hasFilter = fSales || fSource || fCourse || fCenter;

  /* ══════════════════════════════════════════════════════════════════════ */

  return (
    <div className="flex min-w-0 flex-col gap-4 sm:gap-5">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">Tổng quan CRM tuyển sinh METTA Academy</p>
      </div>

      {/* ── Filters bar ── */}
      <div className="flex items-center gap-2 overflow-x-auto rounded-xl border border-slate-200 bg-white p-3 [scrollbar-width:none] sm:flex-wrap [&::-webkit-scrollbar]:hidden">
        {/* Date preset buttons */}
        {([['today', 'Hôm nay'], ['7d', '7 ngày'], ['30d', '30 ngày'], ['thisMonth', 'Tháng này'], ['lastMonth', 'Tháng trước']] as [Preset, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPreset(key)}
            className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${preset === key ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            {label}
          </button>
        ))}
        <button
          onClick={() => setPreset('custom')}
          className={`shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${preset === 'custom' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
        >
          Tùy chọn
        </button>
        {preset === 'custom' && (
          <>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
              className="w-[120px] shrink-0 cursor-pointer rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold" />
            <span className="text-slate-400 text-xs">→</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
              className="w-[120px] shrink-0 cursor-pointer rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold" />
          </>
        )}

        <div className="w-px h-6 bg-slate-200 mx-1 hidden sm:block" />

        <Select value={fSales} onChange={(e) => setFSales(e.target.value)} className="w-auto min-w-[118px] shrink-0 text-xs">
          <option value="">Tất cả Sales</option>
          {salesOptions.map((s) => <option key={s} value={s}>{salesLabel(s)}</option>)}
        </Select>
        <Select value={fSource} onChange={(e) => setFSource(e.target.value)} className="w-auto min-w-[118px] shrink-0 text-xs">
          <option value="">Tất cả nguồn</option>
          {leadSources.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select value={fCenter} onChange={(e) => setFCenter(e.target.value)} className="w-auto min-w-[140px] shrink-0 text-xs">
          <option value="">Tất cả trung tâm</option>
          {centerOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>
        <Select value={fCourse} onChange={(e) => setFCourse(e.target.value)} className="w-auto min-w-[132px] shrink-0 text-xs">
          <option value="">Tất cả khóa</option>
          {COURSE_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
        </Select>

        {hasFilter && (
          <button onClick={() => { setFSales(''); setFSource(''); setFCourse(''); setFCenter(''); }}
            className="ml-1 shrink-0 whitespace-nowrap text-xs font-semibold text-red-500 hover:text-red-700">✕ Xóa filter</button>
        )}

        <span className="ml-auto hidden shrink-0 text-[11px] text-slate-400 sm:block">{formatVN(dateFrom)} - {formatVN(dateTo)} • {rangeLeads.length} lead theo kỳ • {pipelineLeads.length} lead pipeline</span>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(auto-fit,minmax(220px,1fr))] sm:gap-3">
        <KpiCard label="Lead theo kỳ" value={kpi.total} icon={UserPlus} color="bg-blue-500" trend={kpi.trend} sub={`Hôm nay ${kpi.newToday} lead`} />
        <KpiCard label="Chưa xử lý" value={kpi.untouched} icon={PhoneOff} color="bg-orange-500" sub="Chưa ai gọi" alert={kpi.untouched > 0} />
        <KpiCard label="Quá hạn follow-up" value={kpi.overdueFollowUp} icon={AlertTriangle} color="bg-red-500" sub={`${kpi.followUpToday} gọi hôm nay`} alert={kpi.overdueFollowUp > 0} />
        <KpiCard label="Liên hệ thành công" value={`${kpi.contactRate}%`} icon={Phone} color="bg-cyan-500" trend={kpi.contactTrend} sub={`${kpi.contacted}/${kpi.total} lead`} />
        <KpiCard label="Test / Học thử" value={`${kpi.testTrialRate}%`} icon={ClipboardList} color="bg-violet-500" trend={kpi.testTrialTrend} sub={`${kpi.testTrial} lead`} />
        <KpiCard label="Expected revenue" value={formatCurrency(kpi.expectedRevenue)} icon={CircleDollarSign} color="bg-orange-500" trend={kpi.expectedTrend} sub={DEAL_QUOTED_STATUS} />
        <KpiCard label="Revenue" value={formatCurrency(kpi.revenue)} icon={CircleDollarSign} color="bg-emerald-500" trend={kpi.revenueTrend} sub={WON_LEAD_STATUS} />
        <KpiCard label="Đã chuyển đổi" value={kpi.converted} icon={UserCheck} color="bg-emerald-500" trend={kpi.convertedTrend} sub={`Tỷ lệ ${kpi.convRate}%`} />
        <KpiCard label="Mất lead" value={kpi.lost} icon={AlertTriangle} color="bg-red-400" trend={kpi.lostTrend} sub={`Tỷ lệ ${kpi.lostRate}%`} />
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
              <span className="text-xs font-extrabold text-slate-800">{pipelineLeads.length} lead</span>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="-mx-3 overflow-x-auto px-3 sm:mx-0 sm:px-0">
              {pipelineLeads.length > 0 ? (
              <div className="flex min-w-[340px] flex-col gap-1.5 sm:min-w-0">
                <div className="h-8 flex rounded-lg overflow-hidden">
                  {leadStatuses.map((s) => {
                    const count = pipelineLeads.filter((l) => l.status === s).length;
                    if (!count) return null;
                    const pct = (count / pipelineLeads.length) * 100;
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
                    const count = pipelineLeads.filter((l) => l.status === s).length;
                    if (!count) return null;
                    return (
                      <div key={s} className="flex items-center gap-1.5 px-1.5 py-0.5 rounded bg-slate-50 text-[11px]">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLORS[s] }} />
                        <span className="text-slate-600 flex-1 truncate">{s}</span>
                        <span className="font-bold text-slate-800">{count}</span>
                        <span className="text-[10px] text-slate-400 w-7 text-right">{Math.round((count / pipelineLeads.length) * 100)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              ) : <EmptyState />}
            </div>
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
                <table className="w-full min-w-[980px] text-xs">
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

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-slate-700">Cohort stage & tốc độ chuyển trạng thái</CardTitle>
          <p className="text-xs text-slate-500">Tỷ lệ lead đang ở từng stage, tỷ lệ từng đi qua stage và thời gian trung bình trước khi chuyển tiếp.</p>
        </CardHeader>
        <CardContent>
          {pipelineLeads.length > 0 ? <StageCohortTable data={stageCohortData} /> : <EmptyState />}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <ReasonShareCard title="Tỷ lệ lý do pending" data={pendingReasonData} color="#F97316" empty="Chưa có lead báo phí/pending trong filter." />
        <ReasonShareCard title="Tỷ lệ lý do mất lead" data={lostReasonData} color="#EF4444" empty="Chưa có lead mất trong filter." />
      </div>

      {/* ── Row: Trend + Source ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold text-slate-700">
            <CircleDollarSign size={14} className="inline mr-1.5 -mt-0.5" />
            Contribution doanh thu theo Sales
          </CardTitle>
          <p className="text-xs text-slate-500">Theo filter thời gian hiện tại: Expected revenue và revenue thực tế.</p>
        </CardHeader>
        <CardContent>
          {salesContributionData.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {salesContributionData.map((item) => (
                <div key={item.id} className="min-w-0 rounded-lg border border-slate-100 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.total} lead • {item.converted} chốt</p>
                    </div>
                    <div className="max-w-[46%] shrink-0 break-words text-right text-xs">
                      <p className="font-extrabold text-emerald-600">{formatCurrency(item.revenue)}</p>
                      <p className="font-bold text-orange-600">{formatCurrency(item.expectedRevenue)}</p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] font-bold text-slate-500">
                        <span>Expected contribution</span><span>{item.expectedShare}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-orange-50">
                        <div className="h-2 rounded-full bg-orange-500" style={{ width: `${item.expectedShare}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-[11px] font-bold text-slate-500">
                        <span>Revenue contribution</span><span>{item.revenueShare}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-emerald-50">
                        <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${item.revenueShare}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyState />}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm font-bold text-slate-700">Xu hướng Lead theo ngày</CardTitle></CardHeader>
          <CardContent>
            <div className="-mx-3 overflow-x-auto overscroll-x-contain px-3 pb-2 [scrollbar-width:thin] sm:mx-0 sm:px-0">
              <div className="h-72 min-w-[640px] md:min-w-0">
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
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1"><CardTitle className="text-sm font-bold text-slate-700">Lead theo nguồn</CardTitle></CardHeader>
          <CardContent>
            {sourceData.length > 0 ? (
              <div className="-mx-3 overflow-x-auto overscroll-x-contain px-3 pb-2 [scrollbar-width:thin] sm:mx-0 sm:px-0">
                <div className="h-72 min-w-[620px] md:min-w-0">
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
                </div>
              </div>
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
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <span className="min-w-0 truncate text-xs font-bold text-slate-700">{c.name}</span>
                      <span className="shrink-0 text-right text-xs text-slate-500">{c.total} lead • <span className="font-bold text-emerald-600">{c.cvRate}% chốt</span></span>
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
                      <div className="mb-1 flex items-start justify-between gap-3">
                        <span className="min-w-0 truncate text-xs font-bold text-slate-700">{a.name}</span>
                        <span className="shrink-0 text-sm font-extrabold text-slate-800">{a.value}</span>
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
                      <p className="truncate text-[10px] text-slate-500">{a.assignedTo} • {a.type}</p>
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
                      <p className="truncate text-[10px] text-slate-500">{t.detail} • {t.pic || 'Chưa gán'}</p>
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
                      <p className="truncate text-[10px] text-slate-400">{l.phone} • {l.source}</p>
                    </div>
                    <span className="max-w-[112px] truncate rounded-full px-1.5 py-0.5 text-[9px] font-bold flex-shrink-0" style={{ backgroundColor: `${STATUS_COLORS[l.status]}15`, color: STATUS_COLORS[l.status] }}>
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

function StageCohortTable({ data }: { data: ReturnType<typeof buildStageCohortData> }) {
  return (
    <div className="-mx-3 overflow-x-auto overscroll-x-contain px-3 pb-2 [scrollbar-width:thin] sm:mx-0 sm:px-0">
      <table className="w-full min-w-[760px] text-xs">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[10px] uppercase text-slate-400">
            <th className="py-2 pr-3">Stage</th>
            <th className="py-2 px-3 text-center">Đang ở stage</th>
            <th className="py-2 px-3 text-center">% hiện tại</th>
            <th className="py-2 px-3 text-center">Từng đi qua</th>
            <th className="py-2 px-3 text-center">% cohort</th>
            <th className="py-2 px-3 text-center">Avg time</th>
            <th className="py-2 px-3 text-center">Median</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.status} className="border-b border-slate-100">
              <td className="py-2.5 pr-3">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-extrabold text-slate-600">{item.index}</span>
                  <span className="font-bold text-slate-800">{item.status}</span>
                </div>
              </td>
              <td className="px-3 py-2.5 text-center font-extrabold text-slate-900">{item.current}</td>
              <td className="px-3 py-2.5"><MiniRateBar value={item.currentRate} color="#3B82F6" /></td>
              <td className="px-3 py-2.5 text-center font-bold text-slate-700">{item.reached}</td>
              <td className="px-3 py-2.5"><MiniRateBar value={item.reachedRate} color="#16A34A" /></td>
              <td className="px-3 py-2.5 text-center font-bold text-orange-600">{formatDurationHours(item.avgHours)}</td>
              <td className="px-3 py-2.5 text-center font-semibold text-slate-600">{item.samples ? formatDurationHours(item.medianHours) : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MiniRateBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex min-w-[120px] items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }} />
      </div>
      <span className="w-9 text-right text-[11px] font-bold text-slate-700">{value}%</span>
    </div>
  );
}

function ReasonShareCard({
  title,
  data,
  color,
  empty,
}: {
  title: string;
  data: ReturnType<typeof buildReasonShareData>;
  color: string;
  empty: string;
}) {
  const palette = [color, ...REASON_COLORS.filter((item) => item !== color)];
  return (
    <Card>
      <CardHeader className="pb-1">
        <CardTitle className="text-sm font-bold text-slate-700">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="-mx-3 overflow-x-auto overscroll-x-contain px-3 pb-2 [scrollbar-width:thin] sm:mx-0 sm:px-0">
            <div className="grid min-w-[540px] grid-cols-[190px_1fr] gap-3 lg:min-w-0 lg:grid-cols-[220px_1fr]">
            <div className="h-56 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={54}
                    outerRadius={88}
                    paddingAngle={2}
                  >
                    {data.map((item, index) => (
                      <Cell key={item.name} fill={palette[index % palette.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value} lead`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex min-w-0 flex-col justify-center gap-2.5">
              {data.map((item, index) => (
                <div key={item.name} className="min-w-0 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="mb-1 flex items-start justify-between gap-3">
                    <span className="flex min-w-0 items-start gap-2 text-xs font-bold text-slate-700">
                      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: palette[index % palette.length] }} />
                      <span className="min-w-0 break-words">{item.name}</span>
                    </span>
                    <span className="shrink-0 text-xs font-extrabold text-slate-900">{item.rate}%</span>
                  </div>
                  <p className="pl-4 text-[10px] font-semibold text-slate-400">{item.value} lead</p>
                </div>
              ))}
            </div>
            </div>
          </div>
        ) : (
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-200 text-xs font-semibold text-slate-400">{empty}</div>
        )}
      </CardContent>
    </Card>
  );
}

function KpiCard({ label, value, icon: Icon, color, trend, sub, alert }: {
  label: string; value: string | number; icon: React.ElementType; color: string; trend?: number; sub?: string; alert?: boolean;
}) {
  return (
    <Card className={`overflow-hidden ${alert ? 'ring-2 ring-red-200 bg-red-50/40' : ''}`}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider leading-tight">{label}</p>
            <p className={`mt-1.5 break-words text-base font-extrabold leading-tight sm:text-xl ${alert ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
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
          <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-white shadow-sm sm:h-10 sm:w-10 ${color}`}>
            <Icon size={18} />
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
