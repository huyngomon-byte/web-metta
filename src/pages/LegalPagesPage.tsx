import { ChevronDown, ChevronUp, ExternalLink, Eye, EyeOff, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { siteSettings as seedSettings } from '@/data/seed';
import { useThemeSettings } from '@/hooks/useCms';
import { cmsService } from '@/services/cmsService';
import type { LegalPage } from '@/types/cms';

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function migratePages(settings: typeof seedSettings | null): LegalPage[] {
  if (!settings) return seedSettings.legalPages || [];
  if (settings.legalPages?.length) return settings.legalPages;
  // Migrate từ privacyPolicy/termsOfUse cũ nếu có
  const migrated: LegalPage[] = [];
  if (settings.privacyPolicy) {
    migrated.push({ slug: 'chinh-sach-bao-mat', title: 'Chính sách bảo mật', content: settings.privacyPolicy, visible: true });
  }
  if (settings.termsOfUse) {
    migrated.push({ slug: 'dieu-khoan-su-dung', title: 'Điều khoản sử dụng', content: settings.termsOfUse, visible: true });
  }
  return migrated.length ? migrated : (seedSettings.legalPages || []);
}

export default function LegalPagesPage() {
  const { settings, setSettings } = useThemeSettings();
  const [pages, setPages] = useState<LegalPage[]>([]);
  const [openIdx, setOpenIdx] = useState<number | null>(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) setPages(migratePages(settings));
  }, [settings]);

  function updatePage(i: number, patch: Partial<LegalPage>) {
    setPages((current) => current.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function addPage() {
    const i = pages.length + 1;
    setPages([
      ...pages,
      {
        slug: `trang-phap-ly-${i}`,
        title: `Trang pháp lý ${i}`,
        content: '<h2>Tiêu đề trang</h2>\n<p>Nhập nội dung ở đây...</p>',
        visible: true,
      },
    ]);
    setOpenIdx(pages.length);
  }

  function deletePage(i: number) {
    if (!confirm(`Xóa trang "${pages[i].title}"? Không thể khôi phục.`)) return;
    setPages(pages.filter((_, idx) => idx !== i));
    if (openIdx === i) setOpenIdx(null);
  }

  function toggleVisible(i: number) {
    updatePage(i, { visible: pages[i].visible === false });
  }

  function resetSlug(i: number) {
    updatePage(i, { slug: slugify(pages[i].title) || `trang-${i + 1}` });
  }

  async function save() {
    if (!settings) return;
    // Validate slug unique
    const slugs = new Set<string>();
    for (const p of pages) {
      const s = p.slug.trim();
      if (!s) {
        alert(`Trang "${p.title}" chưa có slug.`);
        return;
      }
      if (slugs.has(s)) {
        alert(`Slug "${s}" bị trùng. Mỗi trang phải có slug khác nhau.`);
        return;
      }
      slugs.add(s);
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const stamped = pages.map((p) => ({ ...p, updatedAt: p.updatedAt || now }));
      const next = { ...settings, legalPages: stamped };
      await cmsService.saveSettings(next);
      setSettings(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  function move(from: number, to: number) {
    if (to < 0 || to >= pages.length) return;
    const copy = [...pages];
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    setPages(copy);
    setOpenIdx(to);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-950">Trang pháp lý</h1>
          <p className="text-slate-500 mt-1">
            Quản lý các trang pháp lý (Chính sách bảo mật, Điều khoản sử dụng, FAQ pháp lý, v.v.). Hỗ trợ HTML cơ bản.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={addPage}>
            <Plus size={15} /> Thêm trang
          </Button>
          <Button onClick={save} disabled={saving || !settings}>
            <Save size={15} /> {saving ? 'Đang lưu...' : saved ? '✓ Đã lưu' : 'Lưu tất cả'}
          </Button>
        </div>
      </div>

      {pages.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 bg-white p-12 text-center text-sm font-semibold text-slate-400">
          Chưa có trang pháp lý nào. Bấm "Thêm trang" để bắt đầu.
        </div>
      )}

      <div className="flex flex-col gap-4">
        {pages.map((page, i) => {
          const isOpen = openIdx === i;
          const isHidden = page.visible === false;
          const publicPath = `/phap-ly/${page.slug}`;
          return (
            <Card key={i} className={`${isOpen ? 'border-[#003B7A]/30 shadow-md' : ''} ${isHidden ? 'opacity-60' : ''}`}>
              <CardHeader
                className="cursor-pointer select-none"
                onClick={(e) => {
                  if (!(e.target as HTMLElement).closest('button, a, input')) setOpenIdx(isOpen ? null : i);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <CardTitle className="text-lg truncate">{page.title || `Trang ${i + 1}`}</CardTitle>
                    {isHidden && (
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">
                        Đang ẩn
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleVisible(i); }}
                      className={`p-1.5 rounded transition ${isHidden ? 'bg-slate-100 text-slate-400 hover:text-[#003B7A]' : 'text-[#003B7A] hover:bg-blue-50'}`}
                      title={isHidden ? 'Hiện trang' : 'Ẩn trang'}
                    >
                      {isHidden ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={(e) => { e.stopPropagation(); move(i, i - 1); }}
                      className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Di chuyển lên"
                    >
                      <ChevronUp size={16} className="text-slate-500" />
                    </button>
                    <button
                      type="button"
                      disabled={i === pages.length - 1}
                      onClick={(e) => { e.stopPropagation(); move(i, i + 1); }}
                      className="p-1.5 rounded hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Di chuyển xuống"
                    >
                      <ChevronDown size={16} className="text-slate-500" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); deletePage(i); }}
                      className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                      title="Xóa trang"
                    >
                      <Trash2 size={16} />
                    </button>
                    {isOpen ? <ChevronUp size={18} className="text-slate-400 ml-1" /> : <ChevronDown size={18} className="text-slate-400 ml-1" />}
                  </div>
                </div>
                {!isOpen && (
                  <p className="text-sm text-slate-500 ml-10 truncate">
                    URL: <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{publicPath}</code>
                  </p>
                )}
              </CardHeader>

              {isOpen && (
                <CardContent className="flex flex-col gap-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Tiêu đề trang</label>
                      <Input
                        value={page.title}
                        onChange={(e) => updatePage(i, { title: e.target.value })}
                        placeholder="Chính sách bảo mật"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-bold uppercase tracking-wide text-slate-500 flex items-center justify-between">
                        <span>Slug URL</span>
                        <button
                          type="button"
                          onClick={() => resetSlug(i)}
                          className="text-[10px] font-bold text-[#003B7A] hover:underline normal-case tracking-normal"
                        >
                          Tự sinh từ tiêu đề
                        </button>
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400 font-mono">/phap-ly/</span>
                        <Input
                          value={page.slug}
                          onChange={(e) => updatePage(i, { slug: e.target.value })}
                          placeholder="chinh-sach-bao-mat"
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Nội dung HTML</label>
                      <Link
                        to={publicPath}
                        target="_blank"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#003B7A] hover:underline"
                      >
                        <ExternalLink size={11} /> Xem trang công khai
                      </Link>
                    </div>
                    <Textarea
                      value={page.content}
                      onChange={(e) => updatePage(i, { content: e.target.value })}
                      rows={20}
                      className="font-mono text-xs leading-relaxed"
                      placeholder="<h2>Tiêu đề</h2>&#10;<p>Nội dung...</p>"
                    />
                    <p className="text-[11px] text-slate-400">
                      Tip: dùng <code className="bg-slate-100 px-1 rounded">&lt;h3&gt;</code> cho mục, <code className="bg-slate-100 px-1 rounded">&lt;ul&gt;&lt;li&gt;</code> cho danh sách, <code className="bg-slate-100 px-1 rounded">&lt;strong&gt;</code> cho chữ đậm.
                    </p>
                  </div>

                  {/* Preview */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Xem trước</label>
                    <div
                      className="prose prose-sm prose-slate max-w-none prose-headings:text-[#003B7A] prose-h2:text-xl prose-h2:font-extrabold prose-h2:mt-0 prose-h3:text-base prose-h3:font-bold prose-h3:mt-6 prose-p:text-slate-700 prose-li:text-slate-700 prose-a:text-[#F45A0A] prose-strong:text-slate-900 max-h-[400px] overflow-y-auto p-4 bg-slate-50 rounded-lg border border-slate-200"
                      dangerouslySetInnerHTML={{ __html: page.content }}
                    />
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {pages.length > 0 && (
        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={addPage}>
            <Plus size={15} /> Thêm trang
          </Button>
          <Button onClick={save} disabled={saving || !settings}>
            <Save size={15} /> {saving ? 'Đang lưu...' : saved ? '✓ Đã lưu' : 'Lưu tất cả'}
          </Button>
        </div>
      )}

      <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm text-blue-900">
        <p className="font-bold mb-1">💡 Hướng dẫn</p>
        <ul className="list-disc list-inside space-y-1 text-blue-800">
          <li>Mỗi trang có URL dạng <code className="bg-white px-1 rounded">/phap-ly/&lt;slug&gt;</code> — slug tự sinh từ tiêu đề hoặc tự nhập.</li>
          <li>Bấm icon 👁️ để <strong>ẩn</strong>/<strong>hiện</strong> trang (trang ẩn vẫn còn data nhưng không truy cập được public).</li>
          <li>Bấm 🗑️ để <strong>xóa</strong> hoàn toàn.</li>
          <li>Footer mặc định trỏ tới 2 URL cũ (<code className="bg-white px-1 rounded">/chinh-sach-bao-mat</code>, <code className="bg-white px-1 rounded">/dieu-khoan-su-dung</code>) — vẫn hoạt động. Khi thêm trang mới, vào <strong>Footer</strong> chỉnh link để hiển thị trong footer.</li>
          <li><RotateCcw size={11} className="inline" /> Nhấn "Lưu tất cả" để áp dụng — chỉnh sửa sẽ hiện ngay trên trang công khai, không cần deploy lại.</li>
        </ul>
      </div>
    </div>
  );
}
