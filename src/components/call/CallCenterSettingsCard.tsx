import { Clipboard, PhoneCall, Plus, Save, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { callCenterService, defaultCallCenterSettings } from '@/services/callCenterService';
import { userService } from '@/services/userService';
import type { CallCenterSettings } from '@/types/call';
import type { AdminUser } from '@/types/user';

function originUrl() {
  if (typeof window === 'undefined') return 'https://www.metta.edu.vn';
  return window.location.origin;
}

export function CallCenterSettingsCard() {
  const [settings, setSettings] = useState<CallCenterSettings>(() => defaultCallCenterSettings());
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const salesUsers = useMemo(() => users.filter((user) => user.role === 'sales' && user.active), [users]);
  const pccAgentsUrl = `${originUrl()}/api/call/pcc-agents`;
  const eventUrl = `${originUrl()}/api/call/event`;

  useEffect(() => {
    callCenterService.getSettings().then(setSettings);
    userService.getUsers().then(setUsers);
  }, []);

  function updateMapping(index: number, patch: Partial<CallCenterSettings['userMappings'][number]>) {
    setSettings((current) => ({
      ...current,
      userMappings: current.userMappings.map((mapping, itemIndex) => {
        if (itemIndex !== index) return mapping;
        const selectedUser = patch.crmUserId ? users.find((user) => user.id === patch.crmUserId) : undefined;
        return {
          ...mapping,
          ...patch,
          ...(selectedUser ? { crmName: selectedUser.fullName } : {}),
        };
      }),
    }));
  }

  function addMapping() {
    const first = salesUsers.find((sales) => !settings.userMappings.some((mapping) => mapping.crmUserId === sales.id)) || salesUsers[0];
    setSettings((current) => ({
      ...current,
      userMappings: [
        ...current.userMappings,
        { crmUserId: first?.id || '', crmName: first?.fullName || '', stringeeUserId: '', active: true, routingType: 1, answerTimeoutSec: 15 },
      ],
    }));
  }

  function removeMapping(index: number) {
    setSettings((current) => ({
      ...current,
      userMappings: current.userMappings.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  function updateDisposition(index: number, value: string) {
    setSettings((current) => ({
      ...current,
      dispositions: current.dispositions.map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  }

  function addDisposition() {
    setSettings((current) => ({ ...current, dispositions: [...current.dispositions, ''] }));
  }

  function removeDisposition(index: number) {
    setSettings((current) => ({
      ...current,
      dispositions: current.dispositions.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function copyPccUrl() {
    await navigator.clipboard?.writeText(pccAgentsUrl);
    setMessage('Đã copy URL routing inbound cho Queue PCC.');
  }

  async function copyEventUrl() {
    await navigator.clipboard?.writeText(eventUrl);
    setMessage('Đã copy Event URL cho Stringee Call settings.');
  }

  async function save() {
    setSaving(true);
    setMessage('');
    const cleaned: CallCenterSettings = {
      ...settings,
      userMappings: settings.userMappings
        .filter((mapping) => mapping.crmUserId && mapping.stringeeUserId)
        .map((mapping) => ({
          ...mapping,
          crmName: users.find((user) => user.id === mapping.crmUserId)?.fullName || mapping.crmName,
          routingType: Number(mapping.routingType || 1) as 1 | 2,
          answerTimeoutSec: Number(mapping.answerTimeoutSec || 15),
        })),
      dispositions: settings.dispositions.map((item) => item.trim()).filter(Boolean),
    };
    const saved = await callCenterService.saveSettings(cleaned);
    setSettings(saved);
    setMessage('Đã lưu cấu hình Call Center.');
    setSaving(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PhoneCall className="text-[#F45A0A]" /> Call Center Stringee
        </CardTitle>
        <CardDescription>
          Cấu hình PCC callout, fallback sales lead, mapping CRM user sang Stringee userId và disposition sau cuộc gọi.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {message && <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{message}</div>}

        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="flex flex-1 flex-col gap-1 text-sm font-semibold text-slate-700">
              Queue get_list_agents_url
              <Input value={pccAgentsUrl} readOnly />
            </label>
            <Button type="button" variant="outline" onClick={() => void copyPccUrl()}>
              <Clipboard size={16} /> Copy URL
            </Button>
          </div>
          <p className="mt-2 text-xs font-semibold text-blue-800">
            Dán URL này vào PCC Queue để inbound tự route theo PIC, nếu PIC offline thì fallback về Sales Lead.
          </p>
        </div>

        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
            <label className="flex flex-1 flex-col gap-1 text-sm font-semibold text-slate-700">
              Stringee Event URL
              <Input value={eventUrl} readOnly />
            </label>
            <Button type="button" variant="outline" onClick={() => void copyEventUrl()}>
              <Clipboard size={16} /> Copy URL
            </Button>
          </div>
          <p className="mt-2 text-xs font-semibold text-emerald-800">
            Dán URL này vào Call settings để hệ thống nhận webhook, cập nhật call log, trạng thái và link ghi âm. Callout answer URL có thể để trống với luồng PCC REST hiện tại.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
            Số gọi ra Stringee
            <Input value={settings.fromNumber} onChange={(event) => setSettings({ ...settings, fromNumber: event.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold text-slate-700">
            Fallback sales lead
            <Select
              value={settings.fallbackAgentId}
              onChange={(event) => {
                const sales = salesUsers.find((item) => item.id === event.target.value);
                setSettings({ ...settings, fallbackAgentId: sales?.id || '', fallbackAgentName: sales?.fullName || '' });
              }}
            >
              <option value="">Chọn fallback</option>
              {salesUsers.map((sales) => <option key={sales.id} value={sales.id}>{sales.fullName}</option>)}
            </Select>
          </label>
          <div className="grid gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })}
              />
              Bật softphone cho CRM
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.pccMode !== false}
                onChange={(event) => setSettings({ ...settings, pccMode: event.target.checked })}
              />
              Dùng PCC REST callout
            </label>
          </div>
        </div>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-extrabold text-slate-950">User mapping</h3>
            <Button variant="outline" size="sm" onClick={addMapping}><Plus size={16} /> Thêm mapping</Button>
          </div>
          <div className="grid gap-2">
            {settings.userMappings.map((mapping, index) => (
              <div key={`${mapping.crmUserId}-${index}`} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[1.2fr_1fr_1fr_0.8fr_0.7fr_auto_auto]">
                <Select value={mapping.crmUserId} onChange={(event) => updateMapping(index, { crmUserId: event.target.value })}>
                  <option value="">Chọn sales CRM</option>
                  {salesUsers.map((sales) => <option key={sales.id} value={sales.id}>{sales.fullName}</option>)}
                </Select>
                <Input value={mapping.stringeeUserId} onChange={(event) => updateMapping(index, { stringeeUserId: event.target.value })} placeholder="Stringee userId, ví dụ u2" />
                <Input value={mapping.agentPhoneNumber || ''} onChange={(event) => updateMapping(index, { agentPhoneNumber: event.target.value })} placeholder="SĐT agent nếu route phone" />
                <Select value={String(mapping.routingType || 1)} onChange={(event) => updateMapping(index, { routingType: Number(event.target.value) as 1 | 2 })}>
                  <option value="1">App/SIP</option>
                  <option value="2">SĐT agent</option>
                </Select>
                <Input
                  type="number"
                  min={3}
                  value={mapping.answerTimeoutSec || 15}
                  onChange={(event) => updateMapping(index, { answerTimeoutSec: Number(event.target.value || 15) })}
                  placeholder="Timeout"
                />
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input type="checkbox" checked={mapping.active} onChange={(event) => updateMapping(index, { active: event.target.checked })} />
                  Active
                </label>
                <button type="button" className="inline-flex items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => removeMapping(index)} title="Xóa mapping">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-extrabold text-slate-950">Disposition sau cuộc gọi</h3>
            <Button variant="outline" size="sm" onClick={addDisposition}><Plus size={16} /> Thêm disposition</Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {settings.dispositions.map((item, index) => (
              <div key={`${item}-${index}`} className="flex gap-2">
                <Input value={item} onChange={(event) => updateDisposition(index, event.target.value)} />
                <button type="button" className="inline-flex w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => removeDisposition(index)} title="Xóa disposition">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </section>

        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
          Secret Stringee chỉ đặt trong biến môi trường server. Không lưu SID/secret vào UI hoặc source code.
        </div>
        <Button className="w-fit" onClick={() => void save()} disabled={saving}>
          <Save size={16} /> {saving ? 'Đang lưu...' : 'Lưu Call Center'}
        </Button>
      </CardContent>
    </Card>
  );
}
