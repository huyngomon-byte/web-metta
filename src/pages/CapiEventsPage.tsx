import { RefreshCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useCapi } from '@/hooks/useCapi';
import { formatDate } from '@/lib/utils';
import { capiService } from '@/services/capiService';

export default function CapiEventsPage() {
  const { events, refresh } = useCapi();
  const [filter, setFilter] = useState({ eventName: '', status: '', page: '' });
  const [retryingId, setRetryingId] = useState('');

  const filtered = useMemo(() => events.filter((event) =>
    (!filter.eventName || event.eventName.toLowerCase().includes(filter.eventName.toLowerCase()))
    && (!filter.status || event.status === filter.status)
    && (!filter.page || event.sourceUrl.toLowerCase().includes(filter.page.toLowerCase())),
  ), [events, filter]);

  async function retry(id: string) {
    setRetryingId(id);
    try {
      await capiService.retryEvent(id);
      refresh();
    } finally {
      setRetryingId('');
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-950">CAPI Event Logs</h1>
        <p className="text-slate-500">Lọc event name, status, page và retry event pending/failed.</p>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-3">
          <Input
            placeholder="Event name"
            value={filter.eventName}
            onChange={(event) => setFilter({ ...filter, eventName: event.target.value })}
          />
          <Select value={filter.status} onChange={(event) => setFilter({ ...filter, status: event.target.value })}>
            <option value="">Tất cả status</option>
            <option value="success">success</option>
            <option value="failed">failed</option>
            <option value="pending">pending</option>
          </Select>
          <Input
            placeholder="Page / slug"
            value={filter.page}
            onChange={(event) => setFilter({ ...filter, page: event.target.value })}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <THead>
              <TR>
                <TH>Event</TH>
                <TH>Event ID</TH>
                <TH>Form</TH>
                <TH>Lead</TH>
                <TH>Status</TH>
                <TH>Attempts</TH>
                <TH>Response</TH>
                <TH>Created</TH>
                <TH>Action</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((event) => {
                const canRetry = event.status === 'failed' || event.status === 'pending';
                return (
                  <TR key={event.id}>
                    <TD>{event.eventName}</TD>
                    <TD className="max-w-[220px] truncate font-mono text-xs">{event.eventId}</TD>
                    <TD>{event.formId}</TD>
                    <TD>{event.leadId || '-'}</TD>
                    <TD>
                      <Badge tone={event.status === 'success' ? 'green' : event.status === 'failed' ? 'red' : 'amber'}>
                        {event.status}
                      </Badge>
                    </TD>
                    <TD>{event.attempts || 1}</TD>
                    <TD className="max-w-[320px] truncate text-xs text-slate-500" title={event.responseMessage}>
                      {event.responseMessage || '-'}
                    </TD>
                    <TD>{formatDate(event.createdAt, true)}</TD>
                    <TD>
                      {canRetry && (
                        <Button size="sm" variant="outline" disabled={retryingId === event.id} onClick={() => retry(event.id)}>
                          <RefreshCcw />
                          {retryingId === event.id ? 'Retrying' : 'Retry'}
                        </Button>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
