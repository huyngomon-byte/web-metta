import { ChevronDown, ChevronUp, Plus, Save, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { siteSettings as seedSettings } from '@/data/seed';
import { cmsService } from '@/services/cmsService';
import { useThemeSettings } from '@/hooks/useCms';
import type { SiteSettings } from '@/types/cms';

type NavChild = { label: string; href: string };
type HeaderLink = { label: string; href: string; children?: NavChild[] };

function withDefaults(s: SiteSettings): SiteSettings {
  return {
    ...seedSettings,
    ...s,
    socials: { ...seedSettings.socials, ...s.socials },
    headerLinks: s.headerLinks?.length ? s.headerLinks : seedSettings.headerLinks,
    headerCtaText: s.headerCtaText || seedSettings.headerCtaText,
    headerCtaLink: s.headerCtaLink || seedSettings.headerCtaLink,
    footerColumns: s.footerColumns?.length ? s.footerColumns : seedSettings.footerColumns,
  };
}

export default function HeaderMenuPage() {
  const { settings, setSettings } = useThemeSettings();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [openChildren, setOpenChildren] = useState<Record<number, boolean>>({});

  if (!settings) return <p className="p-8 text-slate-500">Đang tải...</p>;
  const current = withDefaults(settings);
  const links = (current.headerLinks || []) as HeaderLink[];

  function update(patch: Partial<SiteSettings>) {
    setSettings({ ...current, ...patch });
  }

  function setLinks(next: HeaderLink[]) {
    update({ headerLinks: next });
  }

  function updateLink(i: number, patch: Partial<HeaderLink>) {
    setLinks(links.map((l, idx) => idx === i ? { ...l, ...patch } : l));
  }

  function removeLink(i: number) {
    setLinks(links.filter((_, idx) => idx !== i));
  }

  function addLink() {
    setLinks([...links, { label: 'Menu mới', href: '#' }]);
  }

  // Sub-link helpers
  function updateChild(li: number, ci: number, patch: Partial<NavChild>) {
    const children = [...(links[li].children || [])];
    children[ci] = { ...children[ci], ...patch };
    updateLink(li, { children });
  }

  function removeChild(li: number, ci: number) {
    updateLink(li, { children: (links[li].children || []).filter((_, idx) => idx !== ci) });
  }

  function addChild(li: number) {
    updateLink(li, { children: [...(links[li].children || []), { label: 'Sub-menu mới', href: '#' }] });
    setOpenChildren((prev) => ({ ...prev, [li]: true }));
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
        <h1 className="text-3xl font-extrabold text-slate-950">Header Menu</h1>
        <p className="text-slate-500 mt-1">Chỉnh menu điều hướng và nút CTA. Bấm mũi tên để thêm sub-menu (dropdown).</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Nút CTA trên header</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <Field label="Text nút CTA">
            <Input value={current.headerCtaText || ''} onChange={(e) => update({ headerCtaText: e.target.value })} />
          </Field>
          <Field label="Link nút CTA">
            <Input value={current.headerCtaLink || ''} onChange={(e) => update({ headerCtaLink: e.target.value })} placeholder="#lead-form" />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Các mục menu</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3">
          {links.map((link, li) => (
            <div key={li} className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
              {/* Main link row */}
              <div className="grid gap-2 p-3 md:grid-cols-[1fr_1fr_auto_auto]">
                <Input value={link.label} onChange={(e) => updateLink(li, { label: e.target.value })} placeholder="Tên menu" />
                <Input value={link.href} onChange={(e) => updateLink(li, { href: e.target.value })} placeholder="#section hoặc /path" />
                <Button
                  variant="outline" size="icon"
                  title={openChildren[li] ? 'Ẩn sub-menu' : 'Thêm / xem sub-menu'}
                  onClick={() => setOpenChildren((prev) => ({ ...prev, [li]: !prev[li] }))}
                  className={link.children?.length ? 'border-cta-orange text-cta-orange' : ''}
                >
                  {openChildren[li] ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </Button>
                <Button variant="destructive" size="icon" onClick={() => removeLink(li)}><Trash2 size={15} /></Button>
              </div>

              {/* Sub-links */}
              {openChildren[li] && (
                <div className="border-t border-slate-200 bg-white px-4 py-3 flex flex-col gap-2">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1">Sub-menu (dropdown)</p>
                  {(link.children || []).map((child, ci) => (
                    <div key={ci} className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                      <Input value={child.label} onChange={(e) => updateChild(li, ci, { label: e.target.value })} placeholder="Tên sub-menu" className="h-8 text-sm" />
                      <Input value={child.href} onChange={(e) => updateChild(li, ci, { href: e.target.value })} placeholder="/programs/phonics" className="h-8 text-sm font-mono" />
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => removeChild(li, ci)}><Trash2 size={13} /></Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-fit mt-1" onClick={() => addChild(li)}>
                    <Plus size={13} /> Thêm sub-menu
                  </Button>
                </div>
              )}
            </div>
          ))}

          <Button variant="outline" className="w-fit" onClick={addLink}><Plus size={15} /> Thêm menu</Button>
        </CardContent>
      </Card>

      <div className="sticky bottom-4 z-10 flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
        <Button className="w-fit" onClick={save} disabled={saving}>
          <Save size={15} /> {saving ? 'Đang lưu...' : 'Lưu Header Menu'}
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
