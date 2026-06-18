import { Save } from 'lucide-react';
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

      <Card>
        <CardHeader><CardTitle>SEO mặc định</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <Field label="SEO title">
            <Input
              value={current.seoTitle || ''}
              maxLength={90}
              onChange={(e) => update({ seoTitle: e.target.value })}
              placeholder="METTA ACADEMY – Giỏi ngoại ngữ, giàu kỹ năng, lãnh đạo tương lai"
            />
          </Field>
          <Field label="SEO description">
            <Textarea
              value={current.seoDescription || ''}
              maxLength={180}
              onChange={(e) => update({ seoDescription: e.target.value })}
              placeholder="Mô tả ngắn hiển thị trên Google khi trang không có meta riêng."
              className="min-h-24"
            />
          </Field>
          <p className="text-sm leading-6 text-slate-500">
            Áp dụng cho trang chủ và các trang public chưa có meta riêng. Google có thể cần thời gian crawl lại trước khi kết quả tìm kiếm thay đổi.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Thông tin liên hệ</CardTitle></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Hotline">
            <Input value={current.hotline} onChange={(e) => update({ hotline: e.target.value })} />
          </Field>
          <Field label="Email">
            <Input value={current.email} onChange={(e) => update({ email: e.target.value })} />
          </Field>
          <Field label="Địa chỉ">
            <Input value={current.address} onChange={(e) => update({ address: e.target.value })} />
          </Field>
          <Field label="Google Maps URL">
            <Input
              value={current.mapUrl || ''}
              onChange={(e) => update({ mapUrl: e.target.value })}
              placeholder="https://www.google.com/maps/place/Metta+Academy/@20.9664565,105.7732044,17z/..."
            />
          </Field>
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
