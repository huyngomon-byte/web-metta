import { Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { siteSettings as seedSettings } from '@/data/seed';
import { cmsService } from '@/services/cmsService';
import { useThemeSettings } from '@/hooks/useCms';
import type { SiteSettings } from '@/types/cms';

type FooterColumn = NonNullable<SiteSettings['footerColumns']>[number];
type NavLink = { label: string; href: string };

function withDefaults(s: SiteSettings): SiteSettings {
  return {
    ...seedSettings,
    ...s,
    socials: { ...seedSettings.socials, messenger: 'https://www.facebook.com/messages/t/anhngumetta', ...s.socials },
    headerLinks: s.headerLinks?.length ? s.headerLinks : seedSettings.headerLinks,
    headerCtaText: s.headerCtaText || seedSettings.headerCtaText,
    headerCtaLink: s.headerCtaLink || seedSettings.headerCtaLink,
    footerColumns: s.footerColumns?.length ? s.footerColumns : seedSettings.footerColumns,
  };
}

export default function FooterPage() {
  const { settings, setSettings } = useThemeSettings();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!settings) return <p className="p-8 text-slate-500">Đang tải...</p>;
  const current = withDefaults(settings);

  function update(patch: Partial<SiteSettings>) {
    setSettings({ ...current, ...patch });
  }

  function updateSocial(key: string, value: string) {
    update({ socials: { ...current.socials, [key]: value } });
  }

  function updateColumn(colIdx: number, patch: Partial<FooterColumn>) {
    const columns = [...(current.footerColumns || [])];
    columns[colIdx] = { ...columns[colIdx], ...patch };
    update({ footerColumns: columns });
  }

  function updateColumnLink(colIdx: number, linkIdx: number, patch: Partial<NavLink>) {
    const columns = [...(current.footerColumns || [])];
    const links = [...columns[colIdx].links];
    links[linkIdx] = { ...links[linkIdx], ...patch };
    columns[colIdx] = { ...columns[colIdx], links };
    update({ footerColumns: columns });
  }

  function addColumnLink(colIdx: number) {
    const columns = [...(current.footerColumns || [])];
    columns[colIdx] = { ...columns[colIdx], links: [...columns[colIdx].links, { label: 'Link mới', href: '#' }] };
    update({ footerColumns: columns });
  }

  function removeColumnLink(colIdx: number, linkIdx: number) {
    const columns = [...(current.footerColumns || [])];
    columns[colIdx] = { ...columns[colIdx], links: columns[colIdx].links.filter((_, i) => i !== linkIdx) };
    update({ footerColumns: columns });
  }

  function addColumn() {
    update({ footerColumns: [...(current.footerColumns || []), { title: 'Cột mới', links: [{ label: 'Link mới', href: '#' }] }] });
  }

  function removeColumn(colIdx: number) {
    update({ footerColumns: (current.footerColumns || []).filter((_, i) => i !== colIdx) });
  }

  async function save() {
    setSaving(true);
    await cmsService.saveSettings(current);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-950">Footer</h1>
        <p className="text-slate-500 mt-1">Chỉnh nội dung footer, thông tin liên hệ, mạng xã hội và các cột link.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Thông tin liên hệ & mạng xã hội</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field label="Footer text">
            <Textarea value={current.footerText} onChange={(e) => update({ footerText: e.target.value })} className="min-h-24" />
          </Field>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Hotline"><Input value={current.hotline} onChange={(e) => update({ hotline: e.target.value })} /></Field>
            <Field label="Email"><Input value={current.email} onChange={(e) => update({ email: e.target.value })} /></Field>
            <Field label="Địa chỉ"><Input value={current.address} onChange={(e) => update({ address: e.target.value })} /></Field>
          </div>
          <Field label="Google Maps URL">
            <Input
              value={current.mapUrl || ''}
              onChange={(e) => update({ mapUrl: e.target.value })}
              placeholder="https://www.google.com/maps/place/Metta+Academy/@20.9664565,105.7732044,17z/..."
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="Facebook"><Input value={current.socials.facebook || ''} onChange={(e) => updateSocial('facebook', e.target.value)} /></Field>
            <Field label="TikTok"><Input value={current.socials.tiktok || ''} onChange={(e) => updateSocial('tiktok', e.target.value)} /></Field>
            <Field label="YouTube"><Input value={current.socials.youtube || ''} onChange={(e) => updateSocial('youtube', e.target.value)} /></Field>
          </div>
          <Field label="Messenger floating button link">
            <Input
              value={current.socials.messenger || ''}
              onChange={(e) => updateSocial('messenger', e.target.value)}
              placeholder="https://www.facebook.com/messages/t/anhngumetta"
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Cột link footer</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          {(current.footerColumns || []).map((col, colIdx) => (
            <div key={`fc-${colIdx}`} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <Input value={col.title} onChange={(e) => updateColumn(colIdx, { title: e.target.value })} className="font-bold" placeholder="Tên cột" />
                <Button variant="destructive" size="icon" onClick={() => removeColumn(colIdx)}><Trash2 size={15} /></Button>
              </div>
              <div className="space-y-2">
                {col.links.map((link, linkIdx) => (
                  <div key={`fl-${colIdx}-${linkIdx}`} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                    <Input value={link.label} onChange={(e) => updateColumnLink(colIdx, linkIdx, { label: e.target.value })} placeholder="Tên link" />
                    <Input value={link.href} onChange={(e) => updateColumnLink(colIdx, linkIdx, { href: e.target.value })} placeholder="# hoặc URL" />
                    <Button variant="outline" size="icon" onClick={() => removeColumnLink(colIdx, linkIdx)}><Trash2 size={15} /></Button>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => addColumnLink(colIdx)}><Plus size={14} /> Thêm link</Button>
            </div>
          ))}
          <Button variant="outline" className="w-fit" onClick={addColumn}><Plus size={15} /> Thêm cột footer</Button>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
        <Button className="w-fit" onClick={save} disabled={saving}>
          <Save size={15} /> {saving ? 'Đang lưu...' : 'Lưu Footer'}
        </Button>
        {saved && <span className="text-sm font-semibold text-green-600">Đã lưu. Website public sẽ cập nhật ngay.</span>}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
