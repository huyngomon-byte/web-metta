import { Save } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { siteSettings as seedSettings } from '@/data/seed';
import { cmsService } from '@/services/cmsService';
import { useThemeSettings } from '@/hooks/useCms';
import type { SiteSettings } from '@/types/cms';

function withDefaults(settings: SiteSettings): SiteSettings {
  return {
    ...seedSettings,
    ...settings,
    socials: { ...seedSettings.socials, ...settings.socials },
    headerLinks: settings.headerLinks?.length ? settings.headerLinks : seedSettings.headerLinks,
    headerCtaText: settings.headerCtaText || seedSettings.headerCtaText,
    headerCtaLink: settings.headerCtaLink || seedSettings.headerCtaLink,
    footerColumns: settings.footerColumns?.length ? settings.footerColumns : seedSettings.footerColumns,
  };
}

export default function ThemeSettingsPage() {
  const { settings, setSettings } = useThemeSettings();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!settings) return <p>Đang tải...</p>;
  const current = withDefaults(settings);

  function update(patch: Partial<SiteSettings>) {
    setSettings({ ...current, ...patch });
  }

  async function saveSettings() {
    setSaving(true);
    await cmsService.saveSettings(current);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-extrabold text-slate-950">Giao diện / Theme</h1>
        <p className="text-slate-500 mt-1">Chỉnh logo, màu sắc và font chữ hiển thị trên website.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Thông tin thương hiệu</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Brand name"><Input value={current.brandName} onChange={(e) => update({ brandName: e.target.value })} /></Field>
          <Field label="Logo URL · 📐 240 × 104 px (PNG nền trong suốt)"><Input value={current.logoUrl} onChange={(e) => update({ logoUrl: e.target.value })} /></Field>
          <Field label="Favicon URL · 📐 64 × 64 px (PNG/ICO vuông)"><Input value={current.faviconUrl} onChange={(e) => update({ faviconUrl: e.target.value })} /></Field>
          <Field label="Font family"><Input value={current.fontFamily} onChange={(e) => update({ fontFamily: e.target.value })} /></Field>
          <Field label="Primary color"><Input type="color" value={current.primaryColor} onChange={(e) => update({ primaryColor: e.target.value })} /></Field>
          <Field label="Secondary color"><Input type="color" value={current.secondaryColor} onChange={(e) => update({ secondaryColor: e.target.value })} /></Field>
          <Field label="Accent color"><Input type="color" value={current.accentColor} onChange={(e) => update({ accentColor: e.target.value })} /></Field>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
        <Button className="w-fit" onClick={saveSettings} disabled={saving}><Save size={15} /> {saving ? 'Đang lưu...' : 'Lưu settings'}</Button>
        {saved && <span className="text-sm font-semibold text-green-600">Đã lưu. Website public sẽ cập nhật theo Firestore.</span>}
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
