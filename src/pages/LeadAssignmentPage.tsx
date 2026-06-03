import { RefreshCcw, Search, Trash2, UserCheck } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { LOST_LEAD_STATUS, WON_LEAD_STATUS, leadStatuses } from '@/lib/constants';
import { canDeleteLead } from '@/lib/permissions';
import { formatDate } from '@/lib/utils';
import { leadService } from '@/services/leadService';
import { userService } from '@/services/userService';
import type { Lead } from '@/types/crm';
import type { AdminUser } from '@/types/user';

type GroupKey = 'unassigned' | 'returned' | 'assigned';

const groupTabs: { key: GroupKey; title: string }[] = [
  { key: 'unassigned', title: 'Chưa phân sale' },
  { key: 'returned', title: 'Bị trả về' },
  { key: 'assigned', title: 'Đã phân sale' },
];

function statusLabel(status: string) {
  return status;
}

function groupLead(lead: Lead): GroupKey {
  if (lead.assignedStatus === 'returned' || lead.failedReason) return 'returned';
  if (!lead.assignedTo) return 'unassigned';
  return 'assigned';
}

function returnedReason(lead: Lead) {
  if (lead.failedReason === 'no_status_update_24h') return 'Không cập nhật status sau 24h';
  return lead.failedReason || '-';
}

export default function LeadAssignmentPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [salesId, setSalesId] = useState('');
  const [activeGroup, setActiveGroup] = useState<GroupKey>('unassigned');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const salesUsers = useMemo(() => users.filter((item) => item.role === 'sales' && item.active), [users]);
  const salesNameById = useMemo(() => new Map(salesUsers.map((sales) => [sales.id, sales.fullName])), [salesUsers]);

  const groups = useMemo(() => {
    const result: Record<GroupKey, Lead[]> = { unassigned: [], returned: [], assigned: [] };
    leads.forEach((lead) => result[groupLead(lead)].push(lead));
    return result;
  }, [leads]);

  const visibleLeads = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return groups[activeGroup].filter((lead) => {
      if (!keyword) return true;
      return `${lead.fullName} ${lead.phone} ${lead.email} ${lead.assignedToName}`.toLowerCase().includes(keyword);
    });
  }, [activeGroup, groups, search]);

  const selectedVisibleIds = useMemo(() => visibleLeads.map((lead) => lead.id), [visibleLeads]);
  const allVisibleSelected = selectedVisibleIds.length > 0 && selectedVisibleIds.every((id) => selected.includes(id));

  const performance = useMemo(() => salesUsers.map((sales) => {
    const assigned = leads.filter((lead) => lead.assignedTo === sales.id);
    const returned = leads.filter((lead) => lead.failedAssignedTo === sales.id || (lead.assignedTo === sales.id && lead.assignedStatus === 'returned'));
    const contacted = assigned.filter((lead) => lead.status !== leadStatuses[0] && lead.status !== leadStatuses[2]).length;
    const converted = assigned.filter((lead) => lead.status === WON_LEAD_STATUS || lead.convertedToStudentId).length;
    const lost = assigned.filter((lead) => lead.status === LOST_LEAD_STATUS).length;
    return {
      id: sales.id,
      name: sales.fullName,
      assigned: assigned.length,
      returned: returned.length,
      contacted,
      converted,
      lost,
    };
  }).filter((item) => item.assigned || item.returned), [leads, salesUsers]);

  const refresh = async () => {
    setLoading(true);
    try {
      const [leadItems, userItems] = await Promise.all([leadService.getLeads(), userService.getUsers()]);
      setLeads(leadItems);
      setUsers(userItems);
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

  const canDelete = canDeleteLead(user);

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
      setMessage(`Đã phân ${selected.length} lead cho ${sales.fullName}.`);
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
          <p className="mt-1 text-slate-500">Gán hàng loạt lead chưa phân và kiểm soát lead bị trả về sau 24 giờ không cập nhật trạng thái.</p>
        </div>
        <Button variant="outline" onClick={() => refresh()} disabled={loading}>
          <RefreshCcw className={loading ? 'animate-spin' : ''} /> Làm mới
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {groupTabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => { setActiveGroup(tab.key); setSelected([]); }}
            className={`rounded-xl border p-4 text-left shadow-sm transition ${activeGroup === tab.key ? 'border-[#003B7A] bg-[#003B7A] text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-[#003B7A]/40'}`}
          >
            <p className="text-sm font-bold">{tab.title}</p>
            <p className="mt-2 text-3xl font-extrabold">{groups[tab.key].length}</p>
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <Input className="pl-10" placeholder="Tìm tên / SĐT / email / sales" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Select className="lg:max-w-xs" value={salesId} onChange={(event) => setSalesId(event.target.value)}>
            <option value="">Chọn sales nhận lead</option>
            {salesUsers.map((sales) => <option key={sales.id} value={sales.id}>{sales.fullName}</option>)}
          </Select>
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
              {visibleLeads.map((lead) => (
                <TR key={lead.id}>
                  <TD><input type="checkbox" checked={selected.includes(lead.id)} onChange={() => toggle(lead.id)} /></TD>
                  <TD className="font-semibold text-slate-900">{lead.fullName}</TD>
                  <TD>{lead.phone}</TD>
                  <TD><Badge tone="blue">{statusLabel(lead.status)}</Badge></TD>
                  <TD>{lead.source}</TD>
                  <TD>{lead.assignedToName || salesNameById.get(lead.assignedTo) || 'Chưa phân'}</TD>
                  <TD>{lead.assignedAt ? formatDate(lead.assignedAt, true) : '-'}</TD>
                  <TD>{activeGroup === 'returned' ? returnedReason(lead) : (lead.failedAt ? formatDate(lead.failedAt, true) : '-')}</TD>
                  {canDelete && (
                    <TD className="text-right">
                      <button
                        type="button"
                        onClick={() => deleteOne(lead)}
                        className="text-slate-400 hover:text-red-500 transition"
                        title="Xóa lead"
                      >
                        <Trash2 size={16} />
                      </button>
                    </TD>
                  )}
                </TR>
              ))}
              {!visibleLeads.length && (
                <TR><TD colSpan={canDelete ? 9 : 8} className="py-10 text-center font-semibold text-slate-400">Không có lead trong nhóm này.</TD></TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <UserCheck size={18} className="text-[#003B7A]" />
            <h2 className="font-extrabold text-slate-950">Hiệu suất theo Sales</h2>
          </div>
          <Table>
            <THead>
              <TR><TH>Sales</TH><TH>Đang nhận</TH><TH>Đã liên hệ</TH><TH>Chốt</TH><TH>Mất</TH><TH>Bị trả về</TH></TR>
            </THead>
            <TBody>
              {performance.map((item) => (
                <TR key={item.id}>
                  <TD className="font-bold text-slate-900">{item.name}</TD>
                  <TD>{item.assigned}</TD>
                  <TD>{item.contacted}</TD>
                  <TD className="font-bold text-green-600">{item.converted}</TD>
                  <TD className="font-bold text-red-600">{item.lost}</TD>
                  <TD className="font-bold text-orange-600">{item.returned}</TD>
                </TR>
              ))}
              {!performance.length && (
                <TR><TD colSpan={6} className="py-8 text-center text-slate-400">Chưa có dữ liệu hiệu suất sales.</TD></TR>
              )}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
