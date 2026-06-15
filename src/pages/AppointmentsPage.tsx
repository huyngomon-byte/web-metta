import { CalendarDays, ChevronLeft, ChevronRight, Clock, ListChecks } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { Select } from '@/components/ui/select';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { formatDate } from '@/lib/utils';
import { appointmentService } from '@/services/appointmentService';
import type { Appointment } from '@/types/crm';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TYPE_FILTERS = ['Gọi lại', 'Tư vấn', 'Test đầu vào'] as Appointment['type'][];
const STATUS_FILTERS: Appointment['status'][] = ['upcoming', 'done', 'cancelled', 'overdue'];

function localDateKey(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function monthTitle(value: Date) {
  return value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function sameMonth(a: Date, b: Date) {
  return a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
}

function startOfMonthGrid(value: Date) {
  const first = new Date(value.getFullYear(), value.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  start.setHours(0, 0, 0, 0);
  return start;
}

function buildMonthDays(value: Date) {
  const start = startOfMonthGrid(value);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function monthRealtimeRange(value: Date) {
  const from = new Date(value.getFullYear(), value.getMonth() - 1, 1, 0, 0, 0, 0);
  const to = new Date(value.getFullYear(), value.getMonth() + 2, 0, 23, 59, 59, 999);
  return { dateFrom: from.toISOString(), dateTo: to.toISOString() };
}

function appointmentTypeLabel(type: string) {
  if (type === 'Gọi lại' || type.includes('Gá')) return 'Gọi lại';
  if (type === 'Tư vấn' || type.includes('TÆ')) return 'Tư vấn';
  if (type === 'Test đầu vào' || type.toLowerCase().includes('test')) return 'Test đầu vào';
  return type || 'Khác';
}

function typeTone(type: string): Parameters<typeof Badge>[0]['tone'] {
  const label = appointmentTypeLabel(type);
  if (label === 'Gọi lại') return 'cyan';
  if (label === 'Tư vấn') return 'orange';
  if (label === 'Test đầu vào') return 'purple';
  return 'gray';
}

/** Tailwind class set cho calendar card theo loại lịch — sales dễ nhìn. */
function typeCardStyle(type: string) {
  const label = appointmentTypeLabel(type);
  if (label === 'Gọi lại') return {
    card: 'border-amber-300 bg-amber-50 hover:bg-amber-100',
    accent: 'text-amber-700',
    dot: 'bg-amber-500',
  };
  if (label === 'Tư vấn') return {
    card: 'border-violet-300 bg-violet-50 hover:bg-violet-100',
    accent: 'text-violet-700',
    dot: 'bg-violet-500',
  };
  if (label === 'Test đầu vào') return {
    card: 'border-blue-300 bg-blue-50 hover:bg-blue-100',
    accent: 'text-blue-700',
    dot: 'bg-blue-500',
  };
  return {
    card: 'border-slate-200 bg-white hover:bg-slate-50',
    accent: 'text-slate-700',
    dot: 'bg-slate-400',
  };
}

function statusTone(status: Appointment['status']): Parameters<typeof Badge>[0]['tone'] {
  if (status === 'done') return 'green';
  if (status === 'cancelled') return 'gray';
  if (status === 'overdue') return 'red';
  return 'orange';
}

function statusLabel(status: Appointment['status']) {
  if (status === 'done') return 'Hoàn thành';
  if (status === 'cancelled') return 'Đã hủy';
  if (status === 'overdue') return 'Quá hạn';
  return 'Sắp diễn ra';
}

export default function AppointmentsPage() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [view, setView] = useState<'calendar' | 'list'>('calendar');
  const [month, setMonth] = useState(() => new Date());
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', assignedTo: '', type: '', status: '' });

  async function refresh() {
    const appointments = await appointmentService.getAppointments();
    setItems(appointments);
  }

  useEffect(() => {
    const range = monthRealtimeRange(month);
    return appointmentService.subscribeAppointments(setItems, () => {
      void refresh();
    }, range);
  }, [month]);

  const salesOptions = useMemo(
    () => Array.from(new Map(items
      .filter((item) => item.assignedTo)
      .map((item) => [item.assignedTo, item.assignedToName || item.assignedTo])).entries()),
    [items],
  );

  const filtered = useMemo(() => {
    let result = [...items];
    if (filters.dateFrom) result = result.filter((item) => item.startTime.slice(0, 10) >= filters.dateFrom);
    if (filters.dateTo) result = result.filter((item) => item.startTime.slice(0, 10) <= filters.dateTo);
    if (filters.assignedTo) result = result.filter((item) => item.assignedTo === filters.assignedTo);
    if (filters.type) result = result.filter((item) => appointmentTypeLabel(item.type) === filters.type);
    if (filters.status) result = result.filter((item) => item.status === filters.status);
    return result.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [filters, items]);

  const monthDays = useMemo(() => buildMonthDays(month), [month]);
  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    filtered.forEach((appointment) => {
      const key = appointment.startTime.slice(0, 10);
      map.set(key, [...(map.get(key) || []), appointment]);
    });
    return map;
  }, [filtered]);

  function moveMonth(step: number) {
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + step, 1));
  }

  async function updateStatus(appointment: Appointment, status: Appointment['status']) {
    if (appointment.status === status) return;
    const saved = await appointmentService.updateStatus(appointment.id, status);
    setItems((current) => current.map((item) => item.id === saved.id ? saved : item));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-950">Appointments</h1>
          <p className="text-slate-500">Theo dõi lịch gọi lại, tư vấn và test đầu vào của sales.</p>
        </div>
        <Button variant="outline" onClick={refresh}>
          <CalendarDays /> Làm mới
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <TabsList>
              <TabsTrigger active={view === 'calendar'} onClick={() => setView('calendar')}><CalendarDays size={14} /> Calendar</TabsTrigger>
              <TabsTrigger active={view === 'list'} onClick={() => setView('list')}><ListChecks size={14} /> List</TabsTrigger>
            </TabsList>

            <div className="w-56">
              <DateRangePicker
                from={filters.dateFrom}
                to={filters.dateTo}
                onChange={(dateFrom, dateTo) => setFilters({ ...filters, dateFrom, dateTo })}
                placeholder="Khoảng ngày lịch hẹn"
              />
            </div>
            <Select className="w-44" value={filters.assignedTo} onChange={(event) => setFilters({ ...filters, assignedTo: event.target.value })}>
              <option value="">Tất cả sales</option>
              {salesOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </Select>
            <Select className="w-44" value={filters.type} onChange={(event) => setFilters({ ...filters, type: event.target.value })}>
              <option value="">Tất cả loại lịch</option>
              {TYPE_FILTERS.map((type) => <option key={type} value={type}>{type}</option>)}
            </Select>
            <Select className="w-44" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="">Tất cả trạng thái</option>
              {STATUS_FILTERS.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </Select>
            <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50" onClick={() => setFilters({ dateFrom: '', dateTo: '', assignedTo: '', type: '', status: '' })}>
              Xóa filter
            </button>
          </div>
        </CardContent>
      </Card>

      {view === 'calendar' ? (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="text-lg font-extrabold text-slate-900">{monthTitle(month)}</h2>
              <div className="flex items-center gap-1">
                <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => moveMonth(-1)} aria-label="Tháng trước">
                  <ChevronLeft size={18} />
                </button>
                <button type="button" className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100" onClick={() => setMonth(new Date())}>
                  Today
                </button>
                <button type="button" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" onClick={() => moveMonth(1)} aria-label="Tháng sau">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {WEEKDAYS.map((day) => (
                <div key={day} className="px-3 py-2 text-center text-xs font-semibold text-slate-400">{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {monthDays.map((day) => {
                const key = localDateKey(day);
                const dayItems = byDate.get(key) || [];
                const isCurrentMonth = sameMonth(day, month);
                const isToday = key === localDateKey(new Date());
                return (
                  <div key={key} className={`min-h-[132px] border-b border-r border-slate-200 p-2 ${isCurrentMonth ? 'bg-white' : 'bg-slate-50/70'}`}>
                    <div className="mb-2 flex items-center justify-between">
                      <span className={`text-sm ${isCurrentMonth ? 'text-slate-700' : 'text-slate-400'} ${isToday ? 'rounded-full bg-[#003B7A] px-2 py-0.5 font-bold text-white' : ''}`}>
                        {day.getDate()}
                      </span>
                      {dayItems.length > 0 && <span className="text-[10px] font-bold text-slate-400">{dayItems.length}</span>}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {dayItems.slice(0, 4).map((appointment) => {
                        const style = typeCardStyle(appointment.type);
                        const cardInner = (
                          <>
                            <div className={`flex items-center gap-1 text-[11px] font-bold ${style.accent}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
                              <Clock size={11} className="opacity-60" />
                              <span>{appointment.startTime.slice(11, 16)}</span>
                              <span className="truncate">[{appointmentTypeLabel(appointment.type)}]</span>
                            </div>
                            <p className="mt-0.5 truncate text-xs font-semibold text-slate-800">{appointment.title}</p>
                            <p className="truncate text-[10px] text-slate-500">{appointment.assignedToName || appointment.assignedTo || 'Chưa gán'}</p>
                          </>
                        );
                        const className = `block rounded-md border px-2 py-1.5 shadow-sm transition cursor-pointer ${style.card}`;
                        return appointment.leadId ? (
                          <Link key={appointment.id} to={`/crm/leads/${appointment.leadId}?from=appointments`} className={className}>
                            {cardInner}
                          </Link>
                        ) : (
                          <div key={appointment.id} className={className}>{cardInner}</div>
                        );
                      })}
                      {dayItems.length > 4 && <p className="text-[10px] font-semibold text-slate-400">+{dayItems.length - 4} lịch nữa</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="border-b border-slate-100 p-4">
              <h2 className="font-extrabold text-slate-900">Lịch hẹn</h2>
            </div>
            {filtered.length === 0 ? (
              <div className="m-4 rounded-xl border border-dashed border-slate-200 p-8 text-center text-sm font-semibold text-slate-500">
                Chưa có lịch hẹn trong mục này.
              </div>
            ) : (
              <Table>
                <THead>
                  <TR><TH>Title</TH><TH>Type</TH><TH>Time</TH><TH>Assigned</TH><TH>Status</TH><TH>Notes</TH></TR>
                </THead>
                <TBody>
                  {filtered.map((appointment) => (
                    <TR key={appointment.id}>
                      <TD className="font-semibold">{appointment.title}</TD>
                      <TD><Badge tone={typeTone(appointment.type)}>{appointmentTypeLabel(appointment.type)}</Badge></TD>
                      <TD>{formatDate(appointment.startTime, true)}</TD>
                      <TD>{appointment.assignedToName || appointment.assignedTo}</TD>
                      <TD>
                        <div className="flex min-w-40 items-center gap-2">
                          <Badge tone={statusTone(appointment.status)}>{statusLabel(appointment.status)}</Badge>
                          <Select
                            className="w-32"
                            value={appointment.status}
                            onChange={(event) => void updateStatus(appointment, event.target.value as Appointment['status'])}
                          >
                            {STATUS_FILTERS.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                          </Select>
                        </div>
                      </TD>
                      <TD>{appointment.notes}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
