import { Database, Download, Edit3, FileSpreadsheet, RefreshCcw, Save, Search, Trash2, Upload, Users, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { DEAL_QUOTED_STATUS, DEFAULT_DEAL_CURRENCY, WON_LEAD_STATUS, leadStatuses } from '@/lib/constants';
import {
  downloadWorkbook,
  makeLeadTemplateWorkbook,
  makeLeadWorkbook,
  parseLeadWorkbook,
  type ParsedLeadImportResult,
} from '@/lib/leadExcel';
import { buildReferralStats } from '@/lib/leadAnalytics';
import { expectedRevenueAmount, revenueAmount } from '@/lib/leadFinance';
import { formatCurrency, formatDate } from '@/lib/utils';
import { appointmentService } from '@/services/appointmentService';
import { leadService } from '@/services/leadService';
import { normalizeParentPhone, parentProfileService, type ParentProfile } from '@/services/parentProfileService';
import { useLeads } from '@/hooks/useLeads';
import type { Lead } from '@/types/crm';

function timestampFileName(prefix: string) {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${prefix}-${stamp}.xlsx`;
}

function leadDisplayName(lead: Partial<Lead>) {
  return String(lead.studentName || lead.parentName || lead.fullName || '').trim() || '-';
}

function statusTone(status: string): Parameters<typeof Badge>[0]['tone'] {
  if (status === WON_LEAD_STATUS) return 'green';
  if (status === DEAL_QUOTED_STATUS) return 'orange';
  if (status === leadStatuses[0]) return 'blue';
  return 'gray';
}

function pct(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

function uniqueLeadValues(leads: Lead[], getter: (lead: Lead) => string | undefined) {
  return Array.from(new Set(leads.map((lead) => String(getter(lead) || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi'));
}

function dateKey(value?: string) {
  return String(value || '').slice(0, 10);
}

function isReferralLead(lead: Lead) {
  return String(lead.source || '').trim().toLowerCase() === 'referral';
}

type ParentRow = ParentProfile & {
  leadIds: string[];
  leadCount: number;
  children: string[];
  courses: string[];
  sources: string[];
  centers: string[];
};

export default function LeadDatabasePage() {
  const { leads, refresh } = useLeads({ realtime: false });
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [source, setSource] = useState('');
  const [center, setCenter] = useState('');
  const [sales, setSales] = useState('');
  const [course, setCourse] = useState('');
  const [priority, setPriority] = useState('');
  const [referralFilter, setReferralFilter] = useState('');
  const [financeFilter, setFinanceFilter] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [importFileName, setImportFileName] = useState('');
  const [parsed, setParsed] = useState<ParsedLeadImportResult | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [parentProfiles, setParentProfiles] = useState<ParentProfile[]>([]);
  const [parentQuery, setParentQuery] = useState('');
  const [parentIncome, setParentIncome] = useState('');
  const [parentKnownFrom, setParentKnownFrom] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [selectedParentIds, setSelectedParentIds] = useState<string[]>([]);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editingParent, setEditingParent] = useState<ParentProfile | null>(null);

  const refreshParents = useCallback(async () => {
    setParentProfiles(await parentProfileService.seedFromLeads(leads));
  }, [leads]);

  useEffect(() => {
    void refreshParents();
    const onUpdate = () => void refreshParents();
    window.addEventListener('metta-parent-profiles-updated', onUpdate);
    return () => window.removeEventListener('metta-parent-profiles-updated', onUpdate);
  }, [refreshParents]);

  const referralStats = useMemo(() => buildReferralStats(leads), [leads]);
  const filterOptions = useMemo(() => ({
    sources: uniqueLeadValues(leads, (lead) => lead.source),
    centers: uniqueLeadValues(leads, (lead) => lead.centerName),
    sales: uniqueLeadValues(leads, (lead) => lead.assignedToName || lead.assignedTo),
    courses: uniqueLeadValues(leads, (lead) => lead.interestedCourse),
    priorities: Array.from(new Set(leads.map((lead) => Number(lead.priorityLevel || 0)).filter(Boolean))).sort((a, b) => b - a),
  }), [leads]);
  const parentRows = useMemo<ParentRow[]>(() => {
    const map = new Map<string, ParentRow>();
    parentProfiles.forEach((profile) => {
      const phone = normalizeParentPhone(profile.phone);
      if (!phone) return;
      map.set(phone, { ...profile, phone, leadIds: [], leadCount: 0, children: [], courses: [], sources: [], centers: [] });
    });
    leads.forEach((lead) => {
      const phone = normalizeParentPhone(lead.phone);
      if (!phone) return;
      const existing = map.get(phone) || {
        id: `parent-${phone}`,
        phone,
        parentName: lead.parentName || lead.fullName || '',
        email: lead.email || '',
        occupation: '',
        workplace: '',
        incomeRange: '',
        knownFrom: lead.source || '',
        numberOfChildren: '',
        address: '',
        preferredContactChannel: 'Phone/Zalo',
        notes: '',
        createdAt: lead.createdAt,
        updatedAt: lead.updatedAt,
        leadIds: [],
        leadCount: 0,
        children: [],
        courses: [],
        sources: [],
        centers: [],
      };
      existing.leadIds.push(lead.id);
      existing.leadCount = existing.leadIds.length;
      if (lead.studentName && !existing.children.includes(lead.studentName)) existing.children.push(lead.studentName);
      if (lead.interestedCourse && !existing.courses.includes(lead.interestedCourse)) existing.courses.push(lead.interestedCourse);
      if (lead.source && !existing.sources.includes(lead.source)) existing.sources.push(lead.source);
      if (lead.centerName && !existing.centers.includes(lead.centerName)) existing.centers.push(lead.centerName);
      if (!existing.parentName) existing.parentName = lead.parentName || lead.fullName || '';
      if (!existing.email) existing.email = lead.email || '';
      map.set(phone, existing);
    });
    return Array.from(map.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [leads, parentProfiles]);
  const parentFilterOptions = useMemo(() => ({
    incomeRanges: Array.from(new Set(parentRows.map((item) => item.incomeRange || '').filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi')),
    knownFrom: Array.from(new Set(parentRows.map((item) => item.knownFrom || '').filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi')),
  }), [parentRows]);
  const hasAdvancedFilters = Boolean(source || center || sales || course || priority || referralFilter || financeFilter || createdFrom || createdTo);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return leads.filter((lead) => {
      const haystack = `${lead.id} ${lead.fullName} ${lead.studentName || ''} ${lead.parentName || ''} ${lead.phone} ${lead.email} ${lead.source} ${lead.centerName || ''} ${lead.assignedToName || ''} ${lead.interestedCourse || ''}`.toLowerCase();
      const leadSales = lead.assignedToName || lead.assignedTo || '';
      const created = dateKey(lead.createdAt || lead.updatedAt);
      const stats = referralStats.get(lead.id);
      const leadIsReferral = isReferralLead(lead);
      const missingReferralPhone = leadIsReferral && !String(lead.referralPhone || '').trim();
      const hasExpected = lead.status === DEAL_QUOTED_STATUS && expectedRevenueAmount(lead) > 0;
      const hasRevenue = lead.status === WON_LEAD_STATUS && revenueAmount(lead) > 0;

      if (keyword && !haystack.includes(keyword)) return false;
      if (status && lead.status !== status) return false;
      if (source && lead.source !== source) return false;
      if (center && lead.centerName !== center) return false;
      if (sales && leadSales !== sales) return false;
      if (course && lead.interestedCourse !== course) return false;
      if (priority && String(lead.priorityLevel || '') !== priority) return false;
      if (createdFrom && (!created || created < createdFrom)) return false;
      if (createdTo && (!created || created > createdTo)) return false;
      if (financeFilter === 'expected' && !hasExpected) return false;
      if (financeFilter === 'revenue' && !hasRevenue) return false;
      if (financeFilter === 'no-value' && (hasExpected || hasRevenue)) return false;
      if (referralFilter === 'from-referral' && !leadIsReferral) return false;
      if (referralFilter === 'missing-referral-phone' && !missingReferralPhone) return false;
      if (referralFilter === 'has-referred' && !(stats?.total)) return false;
      if (referralFilter === 'no-referred' && (stats?.total || 0) > 0) return false;
      return true;
    });
  }, [center, course, createdFrom, createdTo, financeFilter, leads, priority, query, referralFilter, referralStats, sales, source, status]);

  const filteredParents = useMemo(() => {
    const keyword = parentQuery.trim().toLowerCase();
    return parentRows.filter((parent) => {
      const haystack = `${parent.parentName} ${parent.phone} ${parent.email || ''} ${parent.occupation || ''} ${parent.workplace || ''} ${parent.children.join(' ')} ${parent.courses.join(' ')} ${parent.sources.join(' ')} ${parent.centers.join(' ')}`.toLowerCase();
      if (keyword && !haystack.includes(keyword)) return false;
      if (parentIncome && parent.incomeRange !== parentIncome) return false;
      if (parentKnownFrom && parent.knownFrom !== parentKnownFrom) return false;
      return true;
    });
  }, [parentIncome, parentKnownFrom, parentQuery, parentRows]);

  const metrics = useMemo(() => {
    const withPhone = leads.filter((lead) => lead.phone).length;
    const expected = leads.reduce((sum, lead) => sum + (lead.status === DEAL_QUOTED_STATUS ? expectedRevenueAmount(lead) : 0), 0);
    const revenue = leads.reduce((sum, lead) => sum + (lead.status === WON_LEAD_STATUS ? revenueAmount(lead) : 0), 0);
    const updated = leads.map((lead) => lead.updatedAt).filter(Boolean).sort().pop();
    return { total: leads.length, withPhone, expected, revenue, updated };
  }, [leads]);

  const referralTotals = useMemo(() => {
    const referredLeads = leads.filter((lead) => String(lead.source || '').toLowerCase() === 'referral');
    const referrers = Array.from(referralStats.values()).filter((item) => item.total > 0).length;
    return { referredLeads: referredLeads.length, referrers };
  }, [leads, referralStats]);

  async function exportDatabase() {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const activities = (await Promise.all(leads.map((lead) => leadService.getActivities(lead.id)))).flat();
      const appointments = await appointmentService.getAppointments();
      downloadWorkbook(makeLeadWorkbook(leads, activities, appointments), timestampFileName('metta-lead-database'));
      setMessage('Đã tạo file export gồm Leads, Lead Activities và Appointments.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không export được database.');
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    setError('');
    setMessage('');
    downloadWorkbook(makeLeadTemplateWorkbook(), 'metta-lead-import-template.xlsx');
    setMessage('Đã tải file mẫu import leads.');
  }

  async function parseFile(file?: File) {
    if (!file) return;
    setError('');
    setMessage('');
    setParsed(null);
    setImportFileName(file.name);
    setBusy(true);
    try {
      const result = await parseLeadWorkbook(file, leads);
      setParsed(result);
      if (result.errors.length) setError(`File có ${result.errors.length} lỗi cần xử lý trước khi import.`);
      else setMessage(`Đã đọc ${result.rows.length} dòng hợp lệ từ file.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đọc được file Excel.');
    } finally {
      setBusy(false);
    }
  }

  async function importParsedRows() {
    if (!parsed?.rows.length) return;
    setBusy(true);
    setError('');
    setMessage('');
    const failures: string[] = [];
    let created = 0;
    let updated = 0;
    try {
      for (const row of parsed.rows) {
        try {
          await leadService.saveLead(row.lead);
          if (row.mode === 'create') created += 1;
          else updated += 1;
        } catch (err) {
          failures.push(`Dòng ${row.rowNumber}: ${err instanceof Error ? err.message : 'Không import được.'}`);
        }
      }
      await refresh();
      if (failures.length) setError(failures.slice(0, 5).join('\n'));
      setMessage(`Import xong: tạo mới ${created}, cập nhật ${updated}, lỗi ${failures.length}.`);
      if (!failures.length) {
        setParsed(null);
        setImportFileName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    } finally {
      setBusy(false);
    }
  }

  function toggleLeadSelection(id: string) {
    setSelectedLeadIds((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  }

  function toggleParentSelection(id: string) {
    setSelectedParentIds((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  }

  async function deleteLeads(ids: string[]) {
    if (!ids.length) return;
    if (!window.confirm(`Xóa ${ids.length} lead đã chọn? Dữ liệu appointment/timeline liên quan cũng sẽ bị xóa.`)) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      for (const id of ids) await leadService.deleteLead(id);
      setSelectedLeadIds([]);
      await refresh();
      setMessage(`Đã xóa ${ids.length} lead.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không xóa được lead.');
    } finally {
      setBusy(false);
    }
  }

  async function saveEditingLead() {
    if (!editingLead) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await leadService.saveLead(editingLead);
      setEditingLead(null);
      await refresh();
      setMessage('Đã cập nhật lead.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không cập nhật được lead.');
    } finally {
      setBusy(false);
    }
  }

  async function saveEditingParent() {
    if (!editingParent) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await parentProfileService.saveProfile(editingParent);
      setEditingParent(null);
      await refreshParents();
      setMessage('Đã lưu hồ sơ phụ huynh. Dữ liệu lead không bị thay đổi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được hồ sơ phụ huynh.');
    } finally {
      setBusy(false);
    }
  }

  async function deleteParentProfiles(ids: string[]) {
    if (!ids.length) return;
    if (!window.confirm(`Xóa ${ids.length} hồ sơ phụ huynh đã chọn? Lead liên quan vẫn được giữ nguyên.`)) return;
    for (const id of ids) await parentProfileService.deleteProfile(id);
    setSelectedParentIds([]);
    await refreshParents();
    setMessage(`Đã xóa ${ids.length} hồ sơ phụ huynh. Lead liên quan vẫn còn trong database.`);
  }

  const createCount = parsed?.rows.filter((row) => row.mode === 'create').length || 0;
  const updateCount = parsed?.rows.filter((row) => row.mode === 'update').length || 0;
  const warningCount = parsed?.rows.reduce((sum, row) => sum + row.warnings.length, 0) || 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-950">Lead Database</h1>
          <p className="text-slate-500">Kho dữ liệu leads, timeline và appointments để backup, kiểm tra và import/export Excel.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void refresh()} disabled={busy}><RefreshCcw /> Làm mới</Button>
          <Button variant="outline" onClick={downloadTemplate} disabled={busy}><FileSpreadsheet /> Tải file mẫu</Button>
          <Button onClick={() => void exportDatabase()} disabled={busy}><Download /> Export database</Button>
        </div>
      </div>

      {(message || error) && (
        <div className={`whitespace-pre-line rounded-xl px-4 py-3 text-sm font-semibold ${error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
          {error || message}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard label="Tổng leads" value={metrics.total.toLocaleString('vi-VN')} />
        <MetricCard label="Có số điện thoại" value={metrics.withPhone.toLocaleString('vi-VN')} />
        <MetricCard label="Lead referral" value={referralTotals.referredLeads.toLocaleString('vi-VN')} />
        <MetricCard label="Phụ huynh có refer" value={referralTotals.referrers.toLocaleString('vi-VN')} />
        <MetricCard label="Expected revenue" value={formatCurrency(metrics.expected, DEFAULT_DEAL_CURRENCY)} />
        <MetricCard label="Revenue" value={formatCurrency(metrics.revenue, DEFAULT_DEAL_CURRENCY)} sub={metrics.updated ? `Update cuối: ${formatDate(metrics.updated, true)}` : ''} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload size={18} /> Import Excel</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 p-5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(event) => void parseFile(event.target.files?.[0])}
            />
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-bold text-slate-950">{importFileName || 'Chọn file Excel để import leads'}</p>
                <p className="mt-1 text-sm text-slate-500">Sheet tên "Leads" sẽ được đọc. Dùng Lead ID hoặc SĐT để cập nhật dữ liệu cũ.</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={busy}><Upload /> Chọn file</Button>
                <Button onClick={() => void importParsedRows()} disabled={busy || !parsed?.rows.length || Boolean(parsed.errors.length)}>
                  Import {parsed?.rows.length ? `${parsed.rows.length} dòng` : ''}
                </Button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <MiniStat label="Tạo mới" value={createCount} />
            <MiniStat label="Cập nhật" value={updateCount} />
            <MiniStat label="Cảnh báo" value={warningCount} />
          </div>
          {parsed && (
            <div className="lg:col-span-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-bold text-slate-700">Preview import</p>
                <p className="text-xs font-semibold text-slate-400">{parsed.rows.length} dòng hợp lệ</p>
              </div>
              <Table>
                <THead>
                  <TR><TH>Dòng</TH><TH>Mode</TH><TH>Lead</TH><TH>SĐT</TH><TH>Status</TH><TH>Cảnh báo</TH></TR>
                </THead>
                <TBody>
                  {parsed.rows.slice(0, 8).map((row) => (
                    <TR key={`${row.rowNumber}-${row.lead.phone}`}>
                      <TD>{row.rowNumber}</TD>
                      <TD><Badge tone={row.mode === 'create' ? 'green' : 'blue'}>{row.mode === 'create' ? 'Create' : 'Update'}</Badge></TD>
                      <TD className="font-semibold text-slate-900">{leadDisplayName(row.lead)}</TD>
                      <TD>{row.lead.phone}</TD>
                      <TD>{row.lead.status}</TD>
                      <TD className="max-w-md text-xs text-amber-700">{row.warnings.join(' ') || '-'}</TD>
                    </TR>
                  ))}
                  {!parsed.rows.length && <TR><TD colSpan={6} className="py-8 text-center text-slate-400">Không có dòng import hợp lệ.</TD></TR>}
                </TBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <CardTitle className="flex items-center gap-2"><Users size={18} /> Parent Database</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void refreshParents()} disabled={busy}><RefreshCcw /> Refresh</Button>
              <Button variant="outline" onClick={() => setEditingParent({
                id: '',
                phone: '',
                parentName: '',
                email: '',
                occupation: '',
                workplace: '',
                incomeRange: '',
                knownFrom: '',
                numberOfChildren: '',
                address: '',
                preferredContactChannel: 'Phone/Zalo',
                notes: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              })}><Edit3 /> Thêm hồ sơ</Button>
              <Button variant="destructive" disabled={!selectedParentIds.length || busy} onClick={() => void deleteParentProfiles(selectedParentIds)}><Trash2 /> Xóa đã chọn</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={18} />
              <Input className="pl-10" placeholder="Tìm phụ huynh, SĐT, nghề nghiệp, học sinh..." value={parentQuery} onChange={(event) => setParentQuery(event.target.value)} />
            </div>
            <Select value={parentIncome} onChange={(event) => setParentIncome(event.target.value)}>
              <option value="">Tất cả thu nhập</option>
              {parentFilterOptions.incomeRanges.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <Select value={parentKnownFrom} onChange={(event) => setParentKnownFrom(event.target.value)}>
              <option value="">Tất cả nguồn biết đến</option>
              {parentFilterOptions.knownFrom.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <THead>
                <TR><TH><input type="checkbox" checked={Boolean(filteredParents.length && selectedParentIds.length === filteredParents.length)} onChange={(event) => setSelectedParentIds(event.target.checked ? filteredParents.map((item) => item.id) : [])} /></TH><TH>Phụ huynh</TH><TH>Học sinh/lead</TH><TH>Thông tin sâu</TH><TH>Nguồn/trung tâm</TH><TH>Updated</TH><TH></TH></TR>
              </THead>
              <TBody>
                {filteredParents.slice(0, 80).map((parent) => (
                  <TR key={parent.id}>
                    <TD><input type="checkbox" checked={selectedParentIds.includes(parent.id)} onChange={() => toggleParentSelection(parent.id)} /></TD>
                    <TD>
                      <p className="font-bold text-slate-950">{parent.parentName || '-'}</p>
                      <p className="text-xs text-slate-500">{parent.phone}</p>
                      {parent.email && <p className="text-xs text-slate-400">{parent.email}</p>}
                    </TD>
                    <TD>
                      <p className="font-semibold text-slate-800">{parent.leadCount} lead</p>
                      <p className="max-w-xs truncate text-xs text-slate-500">{parent.children.join(', ') || '-'}</p>
                      <p className="max-w-xs truncate text-xs text-slate-400">{parent.courses.join(', ') || '-'}</p>
                    </TD>
                    <TD>
                      <p className="text-xs"><span className="font-bold">Nghề:</span> {parent.occupation || '-'}</p>
                      <p className="text-xs"><span className="font-bold">Thu nhập:</span> {parent.incomeRange || '-'}</p>
                      <p className="text-xs"><span className="font-bold">Số con:</span> {parent.numberOfChildren || '-'}</p>
                    </TD>
                    <TD>
                      <p className="text-xs font-semibold text-slate-700">{parent.knownFrom || parent.sources.join(', ') || '-'}</p>
                      <p className="text-xs text-slate-500">{parent.centers.join(', ') || '-'}</p>
                    </TD>
                    <TD>{formatDate(parent.updatedAt, true)}</TD>
                    <TD>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditingParent(parent)}><Edit3 /> Edit</Button>
                        <Button size="sm" variant="outline" onClick={() => void deleteParentProfiles([parent.id])}><Trash2 /> Xóa</Button>
                      </div>
                    </TD>
                  </TR>
                ))}
                {!filteredParents.length && <TR><TD colSpan={7} className="py-8 text-center text-slate-400">Không có hồ sơ phụ huynh phù hợp.</TD></TR>}
              </TBody>
            </Table>
          </div>
          {filteredParents.length > 80 && <p className="mt-3 text-xs font-semibold text-slate-400">Đang hiển thị 80/{filteredParents.length} hồ sơ đầu.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Database size={18} /> Dữ liệu leads</CardTitle>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" disabled={!selectedLeadIds.length || busy} onClick={() => void deleteLeads(selectedLeadIds)}><Trash2 /> Xóa lead đã chọn</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="relative xl:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={18} />
              <Input className="pl-10" placeholder="Tìm theo tên, SĐT, email, source, trung tâm, sales..." value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <Select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Tất cả status</option>
              {leadStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <Select value={source} onChange={(event) => setSource(event.target.value)}>
              <option value="">Tất cả source</option>
              {filterOptions.sources.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <Select value={center} onChange={(event) => setCenter(event.target.value)}>
              <option value="">Tất cả trung tâm</option>
              {filterOptions.centers.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <Select value={sales} onChange={(event) => setSales(event.target.value)}>
              <option value="">Tất cả sales</option>
              {filterOptions.sales.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <Select value={course} onChange={(event) => setCourse(event.target.value)}>
              <option value="">Tất cả khóa</option>
              {filterOptions.courses.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <Select value={priority} onChange={(event) => setPriority(event.target.value)}>
              <option value="">Tất cả ưu tiên</option>
              {filterOptions.priorities.map((item) => <option key={item} value={item}>P{item}</option>)}
            </Select>
            <Select value={referralFilter} onChange={(event) => setReferralFilter(event.target.value)}>
              <option value="">Referral: tất cả</option>
              <option value="from-referral">Lead từ Referral</option>
              <option value="missing-referral-phone">Referral thiếu SĐT</option>
              <option value="has-referred">Phụ huynh đã refer lead</option>
              <option value="no-referred">Chưa refer lead</option>
            </Select>
            <Select value={financeFilter} onChange={(event) => setFinanceFilter(event.target.value)}>
              <option value="">Finance: tất cả</option>
              <option value="expected">Có expected revenue</option>
              <option value="revenue">Có revenue</option>
              <option value="no-value">Chưa có value</option>
            </Select>
            <Input type="date" value={createdFrom} onChange={(event) => setCreatedFrom(event.target.value)} />
            <Input type="date" value={createdTo} onChange={(event) => setCreatedTo(event.target.value)} />
            <div className="flex items-center justify-between gap-2 xl:col-span-2">
              <p className="text-xs font-semibold text-slate-500">Hiển thị {filtered.length}/{leads.length} lead</p>
              {hasAdvancedFilters && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSource('');
                    setCenter('');
                    setSales('');
                    setCourse('');
                    setPriority('');
                    setReferralFilter('');
                    setFinanceFilter('');
                    setCreatedFrom('');
                    setCreatedTo('');
                  }}
                >
                  Xóa filter
                </Button>
              )}
            </div>
          </div>
          <Table>
            <THead>
              <TR><TH><input type="checkbox" checked={Boolean(filtered.length && selectedLeadIds.length === filtered.length)} onChange={(event) => setSelectedLeadIds(event.target.checked ? filtered.map((item) => item.id) : [])} /></TH><TH>Lead</TH><TH>SĐT</TH><TH>Status</TH><TH>Source</TH><TH>Referral</TH><TH>Trung tâm</TH><TH>Sales</TH><TH>Expected/Revenue</TH><TH>Updated</TH><TH></TH></TR>
            </THead>
            <TBody>
              {filtered.slice(0, 80).map((lead) => (
                <TR key={lead.id}>
                  <TD><input type="checkbox" checked={selectedLeadIds.includes(lead.id)} onChange={() => toggleLeadSelection(lead.id)} /></TD>
                  <TD>
                    <p className="font-bold text-slate-950">{leadDisplayName(lead)}</p>
                    <p className="text-xs text-slate-500">{lead.id}</p>
                  </TD>
                  <TD>{lead.phone}</TD>
                  <TD><Badge tone={statusTone(lead.status)}>{lead.status}</Badge></TD>
                  <TD>{lead.source}</TD>
                  <TD><ReferralSummary lead={lead} stats={referralStats.get(lead.id)} /></TD>
                  <TD>{lead.centerName || '-'}</TD>
                  <TD>{lead.assignedToName || lead.assignedTo || '-'}</TD>
                  <TD className="font-semibold text-slate-800">
                    {lead.status === WON_LEAD_STATUS
                      ? formatCurrency(revenueAmount(lead), lead.dealCurrency || DEFAULT_DEAL_CURRENCY)
                      : lead.status === DEAL_QUOTED_STATUS
                        ? formatCurrency(expectedRevenueAmount(lead), lead.dealCurrency || DEFAULT_DEAL_CURRENCY)
                        : '-'}
                  </TD>
                  <TD>{formatDate(lead.updatedAt, true)}</TD>
                  <TD>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditingLead(lead)}><Edit3 /> Edit</Button>
                      <Button size="sm" variant="outline" onClick={() => void deleteLeads([lead.id])}><Trash2 /> Xóa</Button>
                    </div>
                  </TD>
                </TR>
              ))}
              {!filtered.length && <TR><TD colSpan={11} className="py-8 text-center text-slate-400">Không tìm thấy lead phù hợp.</TD></TR>}
            </TBody>
          </Table>
          {filtered.length > 80 && <p className="mt-3 text-xs font-semibold text-slate-400">Đang hiển thị 80/{filtered.length} dòng đầu. Dùng search/filter hoặc export Excel để xem toàn bộ.</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cấu trúc export</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {[
            ['Leads', 'Toàn bộ trường thông tin chính của lead, finance, pending, lost, assignment.'],
            ['Lead Activities', 'Timeline chăm sóc, status change, notes, assignment log.'],
            ['Appointments', 'Lịch gọi lại, tư vấn, test đầu vào liên kết với lead.'],
          ].map(([title, desc]) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="font-bold text-slate-950">{title}</p>
              <p className="mt-1 text-sm text-slate-500">{desc}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {editingLead && (
        <LeadEditModal
          lead={editingLead}
          sources={filterOptions.sources}
          centers={filterOptions.centers}
          sales={filterOptions.sales}
          courses={filterOptions.courses}
          busy={busy}
          onChange={setEditingLead}
          onClose={() => setEditingLead(null)}
          onSave={() => void saveEditingLead()}
        />
      )}

      {editingParent && (
        <ParentEditModal
          profile={editingParent}
          busy={busy}
          onChange={setEditingParent}
          onClose={() => setEditingParent(null)}
          onSave={() => void saveEditingParent()}
        />
      )}
    </div>
  );
}

function ReferralSummary({
  lead,
  stats,
}: {
  lead: Lead;
  stats?: { total: number; won: number; quoted: number; lost: number; active: number };
}) {
  const isReferral = String(lead.source || '').toLowerCase() === 'referral';
  const total = stats?.total || 0;
  return (
    <div className="min-w-[180px] text-xs">
      {isReferral && (
        <p className="mb-1 font-semibold text-emerald-700">
          Từ: {lead.referralPhone || 'Thiếu SĐT referral'}
        </p>
      )}
      {total > 0 ? (
        <div>
          <p className="font-bold text-slate-900">{total} lead được giới thiệu</p>
          <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-slate-100">
            <div className="bg-emerald-500" style={{ width: `${pct(stats?.won || 0, total)}%` }} />
            <div className="bg-orange-500" style={{ width: `${pct(stats?.quoted || 0, total)}%` }} />
            <div className="bg-blue-500" style={{ width: `${pct(stats?.active || 0, total)}%` }} />
            <div className="bg-red-500" style={{ width: `${pct(stats?.lost || 0, total)}%` }} />
          </div>
          <p className="mt-1 text-[10px] text-slate-500">
            Chốt {pct(stats?.won || 0, total)}% · Báo phí {pct(stats?.quoted || 0, total)}% · Mất {pct(stats?.lost || 0, total)}%
          </p>
        </div>
      ) : (
        <p className="text-slate-400">Chưa refer lead</p>
      )}
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
        <p className="mt-2 text-2xl font-extrabold text-slate-950">{value}</p>
        {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xl font-extrabold text-slate-950">{value}</p>
      <p className="text-xs font-bold uppercase text-slate-400">{label}</p>
    </div>
  );
}

function ModalShell({
  title,
  description,
  children,
  busy,
  onClose,
  onSave,
}: {
  title: string;
  description: string;
  children: ReactNode;
  busy: boolean;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} disabled={busy} aria-label="Close">
            <X size={18} />
          </Button>
        </div>
        <div className="max-h-[calc(92vh-140px)] overflow-y-auto px-5 py-4">
          {children}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>Hủy</Button>
          <Button type="button" onClick={onSave} disabled={busy}><Save size={16} /> Lưu</Button>
        </div>
      </div>
    </div>
  );
}

function FormLabel({ children }: { children: ReactNode }) {
  return <label className="text-xs font-extrabold uppercase text-slate-500">{children}</label>;
}

function LeadEditModal({
  lead,
  sources,
  centers,
  sales,
  courses,
  busy,
  onChange,
  onClose,
  onSave,
}: {
  lead: Lead;
  sources: string[];
  centers: string[];
  sales: string[];
  courses: string[];
  busy: boolean;
  onChange: (lead: Lead) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  function set<K extends keyof Lead>(key: K, value: Lead[K]) {
    onChange({ ...lead, [key]: value });
  }

  return (
    <ModalShell
      title={`Sửa lead: ${leadDisplayName(lead)}`}
      description="Cập nhật dữ liệu lead tuyển sinh. Các thay đổi này đồng bộ về Kanban Leads."
      busy={busy}
      onClose={onClose}
      onSave={onSave}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <FormLabel>Tên phụ huynh</FormLabel>
          <Input value={lead.parentName || ''} onChange={(event) => set('parentName', event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <FormLabel>Tên học sinh</FormLabel>
          <Input value={lead.studentName || ''} onChange={(event) => set('studentName', event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <FormLabel>Số điện thoại</FormLabel>
          <Input value={lead.phone || ''} onChange={(event) => set('phone', event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <FormLabel>Email</FormLabel>
          <Input value={lead.email || ''} onChange={(event) => set('email', event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <FormLabel>Tuổi học sinh</FormLabel>
          <Input value={lead.age || ''} onChange={(event) => set('age', event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <FormLabel>Trường</FormLabel>
          <Input value={lead.school || ''} onChange={(event) => set('school', event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <FormLabel>Khóa học</FormLabel>
          <Select value={lead.interestedCourse || ''} onChange={(event) => set('interestedCourse', event.target.value)}>
            <option value="">Chưa chọn</option>
            {courses.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <FormLabel>Source</FormLabel>
          <Select value={lead.source || ''} onChange={(event) => set('source', event.target.value)}>
            <option value="">Chưa chọn</option>
            {sources.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <FormLabel>SĐT người referral</FormLabel>
          <Input value={lead.referralPhone || ''} onChange={(event) => set('referralPhone', event.target.value)} placeholder="Bắt buộc nếu source = Referral" />
        </div>
        <div className="space-y-1.5">
          <FormLabel>Trung tâm</FormLabel>
          <Select value={lead.centerName || ''} onChange={(event) => set('centerName', event.target.value)}>
            <option value="">Chưa chọn</option>
            {centers.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <FormLabel>Sales phụ trách</FormLabel>
          <Select value={lead.assignedToName || lead.assignedTo || ''} onChange={(event) => {
            set('assignedToName', event.target.value);
            set('assignedTo', event.target.value);
          }}>
            <option value="">Chưa chọn</option>
            {sales.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <FormLabel>Trạng thái</FormLabel>
          <Select value={lead.status || ''} onChange={(event) => set('status', event.target.value as Lead['status'])}>
            {leadStatuses.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <FormLabel>Ưu tiên</FormLabel>
          <Select value={String(lead.priorityLevel || '')} onChange={(event) => set('priorityLevel', Number(event.target.value) as Lead['priorityLevel'])}>
            {[5, 4, 3, 2, 1].map((item) => <option key={item} value={item}>P{item}</option>)}
          </Select>
        </div>
        <div className="space-y-1.5">
          <FormLabel>Ngày follow-up</FormLabel>
          <Input type="datetime-local" value={(lead.followUpDate || '').slice(0, 16)} onChange={(event) => set('followUpDate', event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <FormLabel>Deal size</FormLabel>
          <Input type="number" value={lead.dealSize || ''} onChange={(event) => set('dealSize', Number(event.target.value) || undefined)} />
        </div>
        <div className="space-y-1.5 md:col-span-3">
          <FormLabel>Ghi chú ban đầu</FormLabel>
          <Textarea rows={4} value={lead.initialNote || ''} onChange={(event) => set('initialNote', event.target.value)} />
        </div>
        <div className="space-y-1.5 md:col-span-3">
          <FormLabel>Note deal / pending / lost</FormLabel>
          <Textarea rows={3} value={lead.dealNote || lead.pendingReasonNote || lead.lostNote || ''} onChange={(event) => set('dealNote', event.target.value)} />
        </div>
      </div>
    </ModalShell>
  );
}

function ParentEditModal({
  profile,
  busy,
  onChange,
  onClose,
  onSave,
}: {
  profile: ParentProfile;
  busy: boolean;
  onChange: (profile: ParentProfile) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  function set<K extends keyof ParentProfile>(key: K, value: ParentProfile[K]) {
    onChange({ ...profile, [key]: value });
  }

  return (
    <ModalShell
      title={profile.id ? `Sửa hồ sơ phụ huynh: ${profile.parentName || profile.phone || 'Chưa đặt tên'}` : 'Thêm hồ sơ phụ huynh'}
      description="Thông tin enrich chỉ lưu trong Parent Database, không ghi đè dữ liệu lead đang đồng bộ ở Kanban."
      busy={busy}
      onClose={onClose}
      onSave={onSave}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-1.5">
          <FormLabel>Tên phụ huynh</FormLabel>
          <Input value={profile.parentName || ''} onChange={(event) => set('parentName', event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <FormLabel>Số điện thoại</FormLabel>
          <Input value={profile.phone || ''} onChange={(event) => set('phone', event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <FormLabel>Email</FormLabel>
          <Input value={profile.email || ''} onChange={(event) => set('email', event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <FormLabel>Nghề nghiệp</FormLabel>
          <Input value={profile.occupation || ''} onChange={(event) => set('occupation', event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <FormLabel>Nơi làm việc</FormLabel>
          <Input value={profile.workplace || ''} onChange={(event) => set('workplace', event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <FormLabel>Khoảng thu nhập</FormLabel>
          <Select value={profile.incomeRange || ''} onChange={(event) => set('incomeRange', event.target.value)}>
            <option value="">Chưa chọn</option>
            <option value="< 20 triệu">&lt; 20 triệu</option>
            <option value="20-40 triệu">20-40 triệu</option>
            <option value="40-70 triệu">40-70 triệu</option>
            <option value="70-100 triệu">70-100 triệu</option>
            <option value="> 100 triệu">&gt; 100 triệu</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <FormLabel>Nguồn biết đến</FormLabel>
          <Input value={profile.knownFrom || ''} onChange={(event) => set('knownFrom', event.target.value)} placeholder="Referral, Meta, Website..." />
        </div>
        <div className="space-y-1.5">
          <FormLabel>Số con</FormLabel>
          <Input value={profile.numberOfChildren || ''} onChange={(event) => set('numberOfChildren', event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <FormLabel>Kênh liên hệ ưu tiên</FormLabel>
          <Select value={profile.preferredContactChannel || ''} onChange={(event) => set('preferredContactChannel', event.target.value)}>
            <option value="">Chưa chọn</option>
            <option value="Phone/Zalo">Phone/Zalo</option>
            <option value="Zalo">Zalo</option>
            <option value="Phone">Phone</option>
            <option value="Email">Email</option>
            <option value="Offline tại trung tâm">Offline tại trung tâm</option>
          </Select>
        </div>
        <div className="space-y-1.5 md:col-span-3">
          <FormLabel>Địa chỉ</FormLabel>
          <Input value={profile.address || ''} onChange={(event) => set('address', event.target.value)} />
        </div>
        <div className="space-y-1.5 md:col-span-3">
          <FormLabel>Ghi chú nội bộ</FormLabel>
          <Textarea rows={5} value={profile.notes || ''} onChange={(event) => set('notes', event.target.value)} />
        </div>
      </div>
    </ModalShell>
  );
}
