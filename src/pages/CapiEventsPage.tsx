import { RefreshCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { capiService } from '@/services/capiService';
import { useCapi } from '@/hooks/useCapi';
import { formatDate } from '@/lib/utils';

export default function CapiEventsPage() {
  const { events, refresh } = useCapi();
  const [filter, setFilter] = useState({ eventName: '', status: '', page: '' });
  const filtered = useMemo(() => events.filter((e) => (!filter.eventName || e.eventName === filter.eventName) && (!filter.status || e.status === filter.status) && (!filter.page || e.sourceUrl.includes(filter.page))), [events, filter]);
  async function retry(id: string) {
    await capiService.retryEvent(id);
    refresh();
  }
  return <div className="flex flex-col gap-6"><div><h1 className="text-3xl font-extrabold text-slate-950">CAPI Event Logs</h1><p className="text-slate-500">Filter event name, status, page và retry failed event.</p></div><Card><CardContent className="grid gap-3 p-4 md:grid-cols-3"><Input placeholder="Event name" value={filter.eventName} onChange={(e) => setFilter({ ...filter, eventName: e.target.value })} /><Select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}><option value="">Tất cả status</option><option value="success">success</option><option value="failed">failed</option><option value="pending">pending</option></Select><Input placeholder="Page / slug" value={filter.page} onChange={(e) => setFilter({ ...filter, page: e.target.value })} /></CardContent></Card><Card><CardContent className="p-0"><Table><THead><TR><TH>Event</TH><TH>Event ID</TH><TH>Form</TH><TH>Lead</TH><TH>Status</TH><TH>Source URL</TH><TH>Created</TH><TH>Action</TH></TR></THead><TBody>{filtered.map((e) => <TR key={e.id}><TD>{e.eventName}</TD><TD className="font-mono text-xs">{e.eventId}</TD><TD>{e.formId}</TD><TD>{e.leadId || '-'}</TD><TD><Badge tone={e.status === 'success' ? 'green' : e.status === 'failed' ? 'red' : 'amber'}>{e.status}</Badge></TD><TD>{e.sourceUrl}</TD><TD>{formatDate(e.createdAt, true)}</TD><TD>{e.status === 'failed' && <Button size="sm" variant="outline" onClick={() => retry(e.id)}><RefreshCcw /> Retry</Button>}</TD></TR>)}</TBody></Table></CardContent></Card></div>;
}
