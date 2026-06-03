import { Bug, RefreshCcw, Save } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Table, TBody, TD, TH, THead, TR } from '@/components/ui/table';
import { capiEvents } from '@/lib/constants';
import { capiService } from '@/services/capiService';
import { useCapi } from '@/hooks/useCapi';

export default function CapiSettingsPage() {
  const { settings, setSettings, mappings, events, refresh } = useCapi();
  const [testEvent, setTestEvent] = useState('Lead');
  if (!settings) return <p>Đang tải...</p>;
  const currentSettings = settings;
  const set = (key: keyof typeof currentSettings, value: string | boolean) => setSettings?.({ ...currentSettings, [key]: value });
  async function saveSettings() {
    await capiService.saveSettings(currentSettings);
    refresh();
  }
  async function sendTest() {
    await capiService.sendTestEvent(testEvent);
    refresh();
  }
  return (
    <div className="flex flex-col gap-6">
      <div><h1 className="text-3xl font-extrabold text-slate-950">CAPI Manager</h1><p className="text-slate-500">Meta Pixel + Conversions API settings, mapping và debug.</p></div>
      <div className="grid gap-6 xl:grid-cols-[1fr_0.8fr]">
        <Card>
          <CardHeader><CardTitle>CAPI Settings</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <Input value={settings.pixelId} onChange={(e) => set('pixelId', e.target.value)} placeholder="Meta Pixel ID" />
            <Input value={settings.testEventCode} onChange={(e) => set('testEventCode', e.target.value)} placeholder="Test Event Code" />
            <Input value={settings.defaultSourceUrl} onChange={(e) => set('defaultSourceUrl', e.target.value)} placeholder="Default source URL" />
            {(['enableBrowserPixel', 'enableServerCapi', 'enableDeduplication'] as const).map((key) => <label key={key} className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={settings[key]} onChange={(e) => set(key, e.target.checked)} /> {key}</label>)}
            <p className="text-sm text-slate-500 md:col-span-2">Meta Access Token được đọc từ server environment, không lưu trong client.</p>
            <Button className="md:w-fit" onClick={saveSettings}><Save /> Lưu CAPI</Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Test Event Panel</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Select value={testEvent} onChange={(e) => setTestEvent(e.target.value)}>{capiEvents.map((e) => <option key={e}>{e}</option>)}</Select>
            <Button onClick={sendTest}><Bug /> Gửi test event</Button>
            <p className="text-sm text-slate-500">Event test gửi qua `/api/capi-send-event` và ghi log vào Firestore.</p>
          </CardContent>
        </Card>
      </div>
      <Card><CardHeader><CardTitle>Form Event Mapping</CardTitle></CardHeader><CardContent className="p-0"><Table><THead><TR><TH>Form</TH><TH>Event</TH><TH>Page</TH><TH>Browser</TH><TH>Server</TH><TH>Enabled</TH></TR></THead><TBody>{mappings.map((m) => <TR key={m.id}><TD>{m.formName}<p className="text-xs text-slate-500">{m.formId}</p></TD><TD><Badge tone="cyan">{m.eventName}</Badge></TD><TD>{m.landingPageSlug}</TD><TD>{m.sendBrowserEvent ? 'On' : 'Off'}</TD><TD>{m.sendServerEvent ? 'On' : 'Off'}</TD><TD><Badge tone={m.enabled ? 'green' : 'gray'}>{m.enabled ? 'Enabled' : 'Disabled'}</Badge></TD></TR>)}</TBody></Table></CardContent></Card>
      <Card><CardHeader className="flex-row items-center justify-between"><CardTitle>Recent CAPI Logs</CardTitle><Button variant="outline" onClick={refresh}><RefreshCcw /> Refresh</Button></CardHeader><CardContent className="p-0"><Table><THead><TR><TH>Event</TH><TH>Event ID</TH><TH>Status</TH><TH>Source</TH><TH>Response</TH></TR></THead><TBody>{events.slice(0, 6).map((e) => <TR key={e.id}><TD>{e.eventName}</TD><TD className="font-mono text-xs">{e.eventId}</TD><TD><Badge tone={e.status === 'success' ? 'green' : e.status === 'failed' ? 'red' : 'amber'}>{e.status}</Badge></TD><TD>{e.source}</TD><TD>{e.responseMessage}</TD></TR>)}</TBody></Table></CardContent></Card>
    </div>
  );
}
