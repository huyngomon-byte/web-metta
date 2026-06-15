import { ArrowDownRight, ArrowUpRight, RefreshCcw, Save, Search, Settings2, Trash2, UserCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { DEAL_QUOTED_STATUS, LOST_LEAD_STATUS, WON_LEAD_STATUS, leadStatuses } from '@/lib/constants';
import { expectedRevenueAmount, revenueAmount } from '@/lib/leadFinance';
import { canDeleteLead } from '@/lib/permissions';
import { formatCurrency, formatDate } from '@/lib/utils';
import { assignmentRuleService, assignmentRulesTotal } from '@/services/assignmentRuleService';
import { leadService } from '@/services/leadService';
import { userService } from '@/services/userService';
import type { SalesAssignmentRule } from '@/types/assignment';
import type { Lead } from '@/types/crm';
import type { AdminUser } from '@/types/user';

type GroupKey = 'all' | 'unassigned' | 'stale' | 'returned' | 'assigned';

const groupTabs: { key: GroupKey; title: string }[] = [
  { key: 'all', title: 'Tất cả lead' },
  { key: 'unassigned', title: 'Chưa phân sale' },
  { key: 'stale', title: 'Sales cũ/đã xóa' },
  { key: 'returned', title: 'Bị trả về' },
  { key: 'assigned', title: 'Đã phân sale' },
];

const FILTER_UNASSIGNED = '__unassigned__';
const FILTER_STALE = '__stale__';
const FILTER_LEGACY_PREFIX = 'legacy:';

const CONTACTED_STATUSES: readonly string[] = [leadStatuses[1], leadStatuses[3], leadStatuses[4], leadStatuses[5], DEAL_QUOTED_STATUS, WON_LEAD_STATUS, LOST_LEAD_STATUS];
const TEST_STATUSES: readonly string[] = [leadStatuses[4], leadStatuses[5], DEAL_QUOTED_STATUS, WON_LEAD_STATUS];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function inRange(value: string | undefined, from: string, to: string) {
  const date = value?.slice(0, 10);
  if (!date) return false;
  return date >= from && date <= to;
}

function previousRange(from: string, to: string) {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const days = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / 86400000) + 1);
  const prevTo = new Date(fromDate);
  prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - days + 1);
  return [prevFrom.toISOString().slice(0, 10), prevTo.toISOString().slice(0, 10)] as const;
}

function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function deltaPct(value: number, previous: number) {
  if (!previous && value) return 100;
  if (!previous) return 0;
  return Math.round(((value - previous) / previous) * 100);
}

function hasAssignment(lead: Lead) {
  return Boolean(lead.assignedTo || lead.assignedToName);
}

function leadAssignedToActiveSales(lead: Lead, salesUsers: AdminUser[]) {
  return salesUsers.some((sales) => leadBelongsToSales(lead, sales));
}

function groupLead(lead: Lead, salesUsers: AdminUser[]): GroupKey {
  if (lead.assignedStatus === 'returned' || lead.failedReason) return 'returned';
  if (!hasAssignment(lead)) return 'unassigned';
  if (!leadAssignedToActiveSales(lead, salesUsers)) return 'stale';
  return 'assigned';
}

function returnedReason(lead: Lead) {
  if (lead.failedReason === 'no_status_update_24h') return 'Không cập nhật status sau 24h';
  return lead.failedReason || '-';
}

function leadBelongsToSales(lead: Lead, sales: AdminUser) {
  return lead.assignedTo === sales.id || lead.assignedTo === sales.fullName || lead.assignedToName === sales.fullName;
}

function leadReturnedToSales(lead: Lead, sales: AdminUser) {
  return lead.failedAssignedTo === sales.id || lead.failedAssignedTo === sales.fullName || lead.failedAssignedToName === sales.fullName || (leadBelongsToSales(lead, sales) && lead.assignedStatus === 'returned');
}

function compareBadge(value: number, previous: number) {
  const delta = deltaPct(value, previous);
  const positive = delta >= 0;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${positive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
      {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {delta > 0 ? '+' : ''}{delta}%
    </span>
  );
}

export default function LeadAssignmentPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [assignmentRules, setAssignmentRules] = useState<SalesAssignmentRule[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [salesId, setSalesId] = useState('');
  const [activeGroup, setActiveGroup] = useState<GroupKey>('unassigned');
  const [search, setSearch] = useState('');
  const [currentSalesFilter, setCurrentSalesFilter] = useState('');
  const [dateFrom, setDateFrom] = useState(daysAgo(29));
  const [dateTo, setDateTo] = useState(todayStr());
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const salesUsers = useMemo(() => users.filter((item) => item.role === 'sales' && item.active), [users]);
  const salesNameById = useMemo(() => new Map(salesUsers.map((sales) => [sales.id, sales.fullName])), [salesUsers]);
  const rulesTotal = useMemo(() => assignmentRulesTotal(assignmentRules), [assignmentRules]);
  const rulesValid = rulesTotal === 100;

  const groups = useMemo(() => {
    const result: Record<GroupKey, Lead[]> = { all: [], unassigned: [], stale: [], returned: [], assigned: [] };
    leads.forEach((lead) => {
      result.all.push(lead);
      result[groupLead(lead, salesUsers)].push(lead);
    });
    return result;
  }, [leads, salesUsers]);

  const legacySalesOptions = useMemo(() => {
    const activeNames = new Set(salesUsers.map((sales) => sales.fullName.toLowerCase()));
    const activeIds = new Set(salesUsers.map((sales) => sales.id));
    return Array.from(new Set(leads
      .filter((lead) => hasAssignment(lead) && !leadAssignedToActiveSales(lead, salesUsers))
      .map((lead) => String(lead.assignedToName || lead.assignedTo || '').trim())
      .filter((name) => name && !activeNames.has(name.toLowerCase()) && !activeIds.has(name))))
      .sort((a, b) => a.localeCompare(b, 'vi'));
  }, [leads, salesUsers]);

  const visibleLeads = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return groups[activeGroup].filter((lead) => {
      const matchesKeyword = !keyword
        || `${lead.fullName} ${lead.studentName} ${lead.parentName} ${lead.phone} ${lead.email} ${lead.assignedTo} ${lead.assignedToName}`.toLowerCase().includes(keyword);
      if (!matchesKeyword) return false;
      if (!currentSalesFilter) return true;
      if (currentSalesFilter === FILTER_UNASSIGNED) return !hasAssignment(lead);
      if (currentSalesFilter === FILTER_STALE) return hasAssignment(lead) && !leadAssignedToActiveSales(lead, salesUsers);
      if (currentSalesFilter.startsWith(FILTER_LEGACY_PREFIX)) {
        const legacyName = currentSalesFilter.slice(FILTER_LEGACY_PREFIX.length);
        return String(lead.assignedToName || lead.assignedTo || '') === legacyName;
      }
      const sales = salesUsers.find((item) => item.id === currentSalesFilter);
      return sales ? leadBelongsToSales(lead, sales) : true;
    });
  }, [activeGroup, currentSalesFilter, groups, salesUsers, search]);

  const rangeLeads = useMemo(() => leads.filter((lead) => inRange(lead.createdAt, dateFrom, dateTo)), [dateFrom, dateTo, leads]);
  const [prevFrom, prevTo] = useMemo(() => previousRange(dateFrom, dateTo), [dateFrom, dateTo]);
  const previousLeads = useMemo(() => leads.filter((lead) => inRange(lead.createdAt, prevFrom, prevTo)), [leads, prevFrom, prevTo]);
  const selectedVisibleIds = useMemo(() => visibleLeads.map((lead) => lead.id), [visibleLeads]);
  const allVisibleSelected = selectedVisibleIds.length > 0 && selectedVisibleIds.every((id) => selected.includes(id));
  const canDelete = canDeleteLead(user);

  const performance = useMemo(() => {
    const totalAssigned = salesUsers.reduce((sum, sales) => sum + rangeLeads.filter((lead) => leadBelongsToSales(lead, sales)).length, 0);
    return salesUsers.map((sales) => {
      const assigned = rangeLeads.filter((lead) => leadBelongsToSales(lead, sales));
      const returned = rangeLeads.filter((lead) => leadReturnedToSales(lead, sales));
      const contacted = assigned.filter((lead) => CONTACTED_STATUSES.includes(lead.status)).length;
      const testTrial = assigned.filter((lead) => TEST_STATUSES.includes(lead.status)).length;
      const converted = assigned.filter((lead) => lead.status === WON_LEAD_STATUS || lead.convertedToStudentId).length;
      const lost = assigned.filter((lead) => lead.status === LOST_LEAD_STATUS).length;
      const expectedRevenue = assigned.filter((lead) => lead.status === DEAL_QUOTED_STATUS).reduce((sum, lead) => sum + expectedRevenueAmount(lead), 0);
      const revenue = assigned.filter((lead) => lead.status === WON_LEAD_STATUS || lead.convertedToStudentId).reduce((sum, lead) => sum + revenueAmount(lead), 0);
      return {
        id: sales.id,
        name: sales.fullName,
        assigned: assigned.length,
        assignedShare: pct(assigned.length, totalAssigned),
        returned: returned.length,
        returnedRate: pct(returned.length, assigned.length + returned.length),
        contacted,
        contactedRate: pct(contacted, assigned.length),
        testTrial,
        testRate: pct(testTrial, assigned.length),
        converted,
        convertedRate: pct(converted, assigned.length),
        lost,
        lostRate: pct(lost, assigned.length),
        expectedRevenue,
        revenue,
      };
    }).filter((item) => item.assigned || item.returned);
  }, [rangeLeads, salesUsers]);

  const ranking = useMemo(() => {
    return salesUsers.map((sales) => {
      const current = rangeLeads.filter((lead) => leadBelongsToSales(lead, sales));
      const previous = previousLeads.filter((lead) => leadBelongsToSales(lead, sales));
      const revenue = current.filter((lead) => lead.status === WON_LEAD_STATUS || lead.convertedToStudentId).reduce((sum, lead) => sum + revenueAmount(lead), 0);
      const previousRevenue = previous.filter((lead) => lead.status === WON_LEAD_STATUS || lead.convertedToStudentId).reduce((sum, lead) => sum + revenueAmount(lead), 0);
      const expectedRevenue = current.filter((lead) => lead.status === DEAL_QUOTED_STATUS).reduce((sum, lead) => sum + expectedRevenueAmount(lead), 0);
      const previousExpectedRevenue = previous.filter((lead) => lead.status === DEAL_QUOTED_STATUS).reduce((sum, lead) => sum + expectedRevenueAmount(lead), 0);
      const converted = current.filter((lead) => lead.status === WON_LEAD_STATUS || lead.convertedToStudentId).length;
      return {
        id: sales.id,
        name: sales.fullName,
        assigned: current.length,
        converted,
        revenue,
        previousRevenue,
        expectedRevenue,
        previousExpectedRevenue,
      };
    }).filter((item) => item.assigned || item.revenue || item.expectedRevenue || item.previousRevenue || item.previousExpectedRevenue)
      .sort((a, b) => b.revenue - a.revenue || b.expectedRevenue - a.expectedRevenue || b.converted - a.converted);
  }, [previousLeads, rangeLeads, salesUsers]);

  const refresh = async () => {
    setLoading(true);
    try {
      const [leadItems, userItems] = await Promise.all([leadService.getLeads(), userService.getUsers()]);
      setLeads(leadItems);
      setUsers(userItems);
      setAssignmentRules(await assignmentRuleService.getRules(userItems));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  function toggle(id: string) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function toggleAllVisible() {
    setSelected((current) => {
      if (allVisibleSelected) return current.filter((id) => !selectedVisibleIds.includes(id));
      return Array.from(new Set([...current, ...selectedVisibleIds]));
    });
  }

  function updateRule(salesIdValue: string, patch: Partial<SalesAssignmentRule>) {
    setAssignmentRules((current) => current.map((rule) => (rule.salesId === salesIdValue ? { ...rule, ...patch } : rule)));
  }

  async function saveRules() {
    setError('');
    setMessage('');
    try {
      const saved = await assignmentRuleService.saveRules(users, assignmentRules);
      setAssignmentRules(saved);
      setMessage('Đã lưu rule auto chia lead. Rule áp dụng ngay khi tạo lead mới; lead đã phân có thời hạn xử lý 24 giờ.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được rule chia lead.');
    }
  }

  async function deleteOne(lead: Lead) {
    if (!canDelete) return;
    if (!confirm(`Xóa lead "${lead.fullName}" (${lead.phone})? Toàn bộ lịch hẹn liên quan cũng sẽ bị xóa.`)) return;
    setError('');
    setMessage('');
    try {
      await leadService.deleteLead(lead.id);
      setMessage(`Đã xóa lead "${lead.fullName}".`);
      setSelected((current) => current.filter((id) => id !== lead.id));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xóa được lead.');
    }
  }

  async function deleteSelected() {
    if (!canDelete || !selected.length) return;
    if (!confirm(`Xóa ${selected.length} lead đã chọn? Toàn bộ lịch hẹn liên quan cũng sẽ bị xóa.`)) return;
    setError('');
    setMessage('');
    try {
      await Promise.all(selected.map((id) => leadService.deleteLead(id)));
      setMessage(`Đã xóa ${selected.length} lead.`);
      setSelected([]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xóa được lead.');
    }
  }

  async function assignSelected() {
    setError('');
    setMessage('');
    const sales = salesUsers.find((item) => item.id === salesId);
    if (!user || !sales) {
      setError('Vui lòng chọn sales nhận lead.');
      return;
    }
    if (!selected.length) {
      setError('Vui lòng chọn ít nhất 1 lead.');
      return;
    }
    try {
      await leadService.assignLeads(selected, sales, user);
      setMessage(`Đã phân ${selected.length} lead cho ${sales.fullName}. Sales sẽ nhận notification trên thanh noti.`);
      setSelected([]);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không phân được lead.');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-950">Phân lead</h1>
          <p className="mt-1 text-slate-500">Tự động chia lead theo tỷ lệ leader setup, theo dõi lead bị trả về và ranking sales.</p>
        </div>
        <Button variant="outline" onClick={() => refresh()} disabled={loading}>
          <RefreshCcw className={loading ? 'animate-spin' : ''} /> Làm mới
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Settings2 size={18} className="text-[#003B7A]" /> Rule auto chia lead
              </CardTitle>
              <p className="mt-1 text-sm text-slate-500">
                Rule chạy ngay khi tạo lead mới trong CRM, không có timer 30 phút. Lead đã phân sẽ giữ trong 24 giờ; nếu sales không cập nhật status thì tự trả về.
                Tổng tỷ lệ active phải bằng 100%.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={rulesValid ? 'green' : 'red'}>Tổng {rulesTotal}%</Badge>
              <Button onClick={saveRules} disabled={!rulesValid || !assignmentRules.length}>
                <Save /> Lưu rule
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2">Sales</th>
                  <th className="py-2 text-center">Active</th>
                  <th className="py-2 text-center">Tỷ lệ assign</th>
                  <th className="py-2 text-center">Đang nhận</th>
                  <th className="py-2 text-center">Share thực tế</th>
                </tr>
              </thead>
              <tbody>
                {assignmentRules.map((rule) => {
                  const assigned = leads.filter((lead) => lead.assignedTo === rule.salesId || lead.assignedToName === rule.salesName || lead.assignedTo === rule.salesName).length;
                  const assignedTotal = leads.filter((lead) => lead.assignedTo || lead.assignedToName).length;
                  return (
                    <tr key={rule.salesId} className="border-b border-slate-50">
                      <td className="py-2 font-bold text-slate-900">{rule.salesName}</td>
                      <td className="py-2 text-center">
                        <input type="checkbox" checked={rule.active} onChange={(event) => updateRule(rule.salesId, { active: event.target.checked })} />
                      </td>
                      <td className="py-2">
                        <div className="mx-auto flex max-w-32 items-center gap-2">
                          <Input
                            type="number"
                            min={0}
                            max={100}
                            value={rule.percent}
                            onChange={(event) => updateRule(rule.salesId, { percent: Number(event.target.value) })}
                            className="text-center"
                          />
                          <span className="text-xs font-bold text-slate-400">%</span>
                        </div>
                      </td>
                      <td className="py-2 text-center font-bold text-slate-800">{assigned}</td>
                      <td className="py-2 text-center">
                        <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-700">{pct(assigned, assignedTotal)}%</span>
                      </td>
                    </tr>
                  );
                })}
                {!assignmentRules.length && (
                  <tr><td colSpan={5} className="py-8 text-center font-semibold text-slate-400">Chưa có sales active để setup rule.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {groupTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { setActiveGroup(tab.key); setSelected([]); }}
            className={`rounded-xl border p-4 text-left shadow-sm transition ${activeGroup === tab.key ? 'border-[#003B7A] bg-[#003B7A] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-[#003B7A]/40'}`}
          >
            <p className="text-sm font-bold">{tab.title}</p>
            <div className="mt-2 flex items-end justify-between gap-2">
              <p className="text-3xl font-extrabold">{groups[tab.key].length}</p>
              <p className={`text-sm font-bold ${activeGroup === tab.key ? 'text-blue-100' : 'text-slate-400'}`}>{pct(groups[tab.key].length, leads.length)}%</p>
            </div>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 xl:grid-cols-[minmax(260px,1fr)_240px_240px_auto_auto_auto] xl:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input className="pl-10" placeholder="Tìm tên / SĐT / email / sales" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Select value={currentSalesFilter} onChange={(event) => setCurrentSalesFilter(event.target.value)}>
            <option value="">Lọc PIC hiện tại: tất cả</option>
            <option value={FILTER_UNASSIGNED}>Chưa có PIC</option>
            <option value={FILTER_STALE}>Sales cũ/đã xóa</option>
            {salesUsers.map((sales) => <option key={sales.id} value={sales.id}>PIC: {sales.fullName}</option>)}
            {legacySalesOptions.map((name) => <option key={name} value={`${FILTER_LEGACY_PREFIX}${name}`}>PIC cũ: {name}</option>)}
          </Select>
          <Select value={salesId} onChange={(event) => setSalesId(event.target.value)}>
            <option value="">Assign sang sales...</option>
            {salesUsers.map((sales) => <option key={sales.id} value={sales.id}>{sales.fullName}</option>)}
          </Select>
          <Button variant="outline" onClick={toggleAllVisible} disabled={!visibleLeads.length}>
            {allVisibleSelected ? 'Bỏ chọn kết quả' : `Chọn ${visibleLeads.length} kết quả`}
          </Button>
          <Button onClick={assignSelected} disabled={!selected.length || !salesId}>
            <UserCheck /> Phân {selected.length ? `${selected.length} lead` : 'lead'}
          </Button>
          {canDelete && (
            <Button variant="destructive" onClick={deleteSelected} disabled={!selected.length}>
              <Trash2 /> Xóa {selected.length ? `${selected.length} lead` : ''}
            </Button>
          )}
        </CardContent>
      </Card>

      {(message || error) && (
        <div className={`rounded-lg px-4 py-3 text-sm font-semibold ${message ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message || error}
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between border-b border-slate-100 p-4">
            <div>
              <p className="text-lg font-extrabold text-slate-950">{visibleLeads.length} lead</p>
              <p className="text-sm text-slate-500">{groupTabs.find((item) => item.key === activeGroup)?.title}</p>
            </div>
            <Badge tone={activeGroup === 'returned' ? 'red' : activeGroup === 'assigned' ? 'green' : 'blue'}>
              Đã chọn {selected.length}
            </Badge>
          </div>
          <Table>
            <THead>
              <TR>
                <TH className="w-12">
                  <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} />
                </TH>
                <TH>Lead</TH>
                <TH>SĐT</TH>
                <TH>Status</TH>
                <TH>Nguồn</TH>
                <TH>Sales</TH>
                <TH>Lần phân gần nhất</TH>
                <TH>Trả về</TH>
                {canDelete && <TH className="w-12 text-right">Xóa</TH>}
              </TR>
            </THead>
            <TBody>
              {visibleLeads.map((lead) => {
                const currentSalesName = lead.assignedToName || salesNameById.get(lead.assignedTo) || lead.assignedTo || '';
                const isStaleSales = hasAssignment(lead) && !leadAssignedToActiveSales(lead, salesUsers);
                return (
                  <TR key={lead.id}>
                    <TD><input type="checkbox" checked={selected.includes(lead.id)} onChange={() => toggle(lead.id)} /></TD>
                    <TD className="font-semibold text-slate-900">{lead.studentName || lead.fullName}</TD>
                    <TD>{lead.phone}</TD>
                    <TD><Badge tone="blue">{lead.status}</Badge></TD>
                    <TD>{lead.source}</TD>
                    <TD>
                      {currentSalesName || 'Chưa phân'}
                      {isStaleSales && <span className="ml-2 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-bold text-orange-700">Sales cũ</span>}
                    </TD>
                    <TD>{lead.assignedAt ? formatDate(lead.assignedAt, true) : '-'}</TD>
                    <TD>{activeGroup === 'returned' ? returnedReason(lead) : (lead.failedAt ? formatDate(lead.failedAt, true) : '-')}</TD>
                    {canDelete && (
                      <TD className="text-right">
                        <button
                          type="button"
                          onClick={() => deleteOne(lead)}
                          className="text-slate-400 transition hover:text-red-500"
                          title="Xóa lead"
                        >
                          <Trash2 size={16} />
                        </button>
                      </TD>
                    )}
                  </TR>
                );
              })}
              {!visibleLeads.length && (
                <TR><TD colSpan={canDelete ? 9 : 8} className="py-10 text-center font-semibold text-slate-400">Không có lead trong nhóm này.</TD></TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(360px,1fr)]">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserCheck size={18} className="text-[#003B7A]" /> Report hiệu suất theo Sales
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="w-40" />
                <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="w-40" />
              </div>
            </div>
            <p className="text-sm text-slate-500">{dateFrom} - {dateTo} • So sánh kỳ trước {prevFrom} - {prevTo}</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH>Sales</TH>
                    <TH>Nhận</TH>
                    <TH>Share</TH>
                    <TH>Đã liên hệ</TH>
                    <TH>Test/HT</TH>
                    <TH>Chốt</TH>
                    <TH>Mất</TH>
                    <TH>Expected</TH>
                    <TH>Revenue</TH>
                    <TH>Bị trả</TH>
                  </TR>
                </THead>
                <TBody>
                  {performance.map((item) => (
                    <TR key={item.id}>
                      <TD className="font-bold text-slate-900">{item.name}</TD>
                      <TD>{item.assigned}</TD>
                      <TD><RateBadge value={item.assignedShare} /></TD>
                      <TD>{item.contacted} <RateBadge value={item.contactedRate} /></TD>
                      <TD>{item.testTrial} <RateBadge value={item.testRate} /></TD>
                      <TD className="font-bold text-green-600">{item.converted} <RateBadge value={item.convertedRate} tone="green" /></TD>
                      <TD className="font-bold text-red-600">{item.lost} <RateBadge value={item.lostRate} tone="red" /></TD>
                      <TD className="font-bold text-orange-600">{formatCurrency(item.expectedRevenue)}</TD>
                      <TD className="font-bold text-emerald-600">{formatCurrency(item.revenue)}</TD>
                      <TD className="font-bold text-orange-600">{item.returned} <RateBadge value={item.returnedRate} tone="orange" /></TD>
                    </TR>
                  ))}
                  {!performance.length && (
                    <TR><TD colSpan={10} className="py-8 text-center text-slate-400">Chưa có dữ liệu hiệu suất sales trong giai đoạn này.</TD></TR>
                  )}
                </TBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ranking sales</CardTitle>
            <p className="text-sm text-slate-500">Xếp hạng theo revenue, kèm same period trước đó.</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {ranking.map((item, index) => (
              <div key={item.id} className="rounded-lg border border-slate-100 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex size-9 items-center justify-center rounded-full text-sm font-extrabold ${index === 0 ? 'bg-emerald-500 text-white' : 'bg-blue-50 text-blue-700'}`}>
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-extrabold text-slate-900">{item.name}</p>
                      <p className="text-xs text-slate-500">{item.assigned} lead • {item.converted} chốt</p>
                    </div>
                  </div>
                  {compareBadge(item.revenue, item.previousRevenue)}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded bg-emerald-50 px-2 py-1.5">
                    <p className="font-semibold text-emerald-700">Revenue</p>
                    <p className="font-extrabold text-emerald-700">{formatCurrency(item.revenue)}</p>
                    <p className="text-emerald-500">Trước: {formatCurrency(item.previousRevenue)}</p>
                  </div>
                  <div className="rounded bg-orange-50 px-2 py-1.5">
                    <p className="font-semibold text-orange-700">Expected</p>
                    <p className="font-extrabold text-orange-700">{formatCurrency(item.expectedRevenue)}</p>
                    <p className="text-orange-500">Trước: {formatCurrency(item.previousExpectedRevenue)}</p>
                  </div>
                </div>
              </div>
            ))}
            {!ranking.length && (
              <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center font-semibold text-slate-400">
                Chưa có dữ liệu ranking.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function RateBadge({ value, tone = 'blue' }: { value: number; tone?: 'blue' | 'green' | 'red' | 'orange' }) {
  const classes = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-600',
    orange: 'bg-orange-50 text-orange-700',
  };
  return <span className={`ml-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-bold ${classes[tone]}`}>{value}%</span>;
}
