import { RefreshCcw, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { useCapi } from '@/hooks/useCapi';

function ConfigRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 py-3 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-right text-sm font-semibold text-slate-900">
        {ok === undefined ? value : <Badge tone={ok ? 'green' : 'red'}>{value}</Badge>}
      </span>
    </div>
  );
}

export default function CapiSettingsPage() {
  const { runtimeConfig, events, error, refresh } = useCapi();
  if (!runtimeConfig && !error) return <p>Đang tải cấu hình runtime...</p>;
  if (!runtimeConfig) return <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>;

  const config = runtimeConfig;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-950">CAPI Runtime</h1>
          <p className="text-slate-500">Cấu hình chỉ đọc, lấy trực tiếp từ môi trường server đang chạy.</p>
        </div>
        <Button variant="outline" onClick={() => void refresh()}><RefreshCcw /> Refresh</Button>
      </div>

      {config.mode === 'production' && config.testEventCodeConfigured && (
        <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <ShieldCheck className="mt-0.5 size-5 shrink-0" />
          <p><strong>Production guard đang hoạt động.</strong> META_TEST_EVENT_CODE có tồn tại nhưng bị bỏ qua; payload production không chứa test_event_code.</p>
        </div>
      )}
      {error && <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Lần refresh gần nhất lỗi: {error}</p>}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Server CAPI</CardTitle></CardHeader>
          <CardContent>
            <ConfigRow label="Mode" value={config.mode} ok={config.mode === 'production'} />
            <ConfigRow label="Vercel environment" value={config.vercelEnv} />
            <ConfigRow label="CAPI enabled" value={config.capiEnabled ? 'Enabled' : 'Disabled'} ok={config.capiEnabled} />
            <ConfigRow label="Access token" value={config.accessTokenConfigured ? 'Configured' : 'Missing'} ok={config.accessTokenConfigured} />
            <ConfigRow label="Graph API" value={config.graphVersion} />
            <ConfigRow label="Timeout" value={`${config.timeoutMs} ms`} />
            <ConfigRow label="Test code active" value={config.testEventCodeActive ? config.testEventCodeMasked : 'No'} ok={!config.testEventCodeActive || config.mode === 'test'} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Browser Pixel</CardTitle></CardHeader>
          <CardContent>
            <ConfigRow label="Browser Pixel" value={config.browserPixelEnabled ? 'Enabled' : 'Disabled'} ok={config.browserPixelEnabled} />
            <ConfigRow label="Server Pixel ID" value={config.pixelId || 'Missing'} ok={Boolean(config.pixelId)} />
            <ConfigRow label="Browser Pixel ID" value={config.browserPixelId || 'Missing'} ok={Boolean(config.browserPixelId)} />
            <ConfigRow label="Pixel IDs match" value={config.pixelIdsMatch ? 'Matched' : 'Mismatch'} ok={config.pixelIdsMatch} />
            <ConfigRow label="Manual test events" value={config.manualEventsEnabled ? 'Enabled' : 'Disabled'} ok={!config.manualEventsEnabled || config.mode === 'test'} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Production Event Mapping</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>CRM / Form milestone</TH><TH>Meta event</TH><TH>Destination</TH><TH>Enabled</TH></TR></THead>
            <TBody>{config.statusMappings.map((mapping) => {
              const enabled = config.eventToggles[mapping.eventName as keyof typeof config.eventToggles] ?? true;
              return (
                <TR key={`${mapping.status}-${mapping.eventName}`}>
                  <TD>{mapping.status}</TD>
                  <TD><Badge tone={mapping.eventName === 'LeadFailed' ? 'gray' : 'cyan'}>{mapping.eventName}</Badge></TD>
                  <TD>{mapping.destination}</TD>
                  <TD><Badge tone={enabled ? 'green' : 'gray'}>{enabled ? 'Enabled' : 'Disabled'}</Badge></TD>
                </TR>
              );
            })}</TBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Recent CAPI Logs</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <THead><TR><TH>Event</TH><TH>Event ID</TH><TH>Mode</TH><TH>Status</TH><TH>Customer metadata</TH><TH>Response</TH></TR></THead>
            <TBody>{events.slice(0, 6).map((event) => (
              <TR key={event.id}>
                <TD>{event.eventName}</TD>
                <TD className="max-w-[220px] truncate font-mono text-xs">{event.eventId}</TD>
                <TD><Badge tone={event.mode === 'production' ? 'green' : 'amber'}>{event.mode || 'legacy'}</Badge></TD>
                <TD><Badge tone={event.status === 'success' ? 'green' : event.status === 'failed' ? 'red' : 'amber'}>{event.status}</Badge></TD>
                <TD>{event.usedCustomerMeta ? 'Original customer' : 'Legacy / unavailable'}</TD>
                <TD className="max-w-[320px] truncate text-xs text-slate-500" title={event.responseMessage}>{event.responseMessage || '-'}</TD>
              </TR>
            ))}</TBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
