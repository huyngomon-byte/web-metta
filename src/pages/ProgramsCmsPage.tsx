import { Activity, Brain, BookOpen, CheckCircle2, ChevronDown, ChevronUp, Cpu, Eye, EyeOff, FlaskConical, GraduationCap, Globe, Hand, Layers, Lightbulb, MessageCircle, Mic, Music, Plus, Save, Star, Target, Trash2, Trophy, Upload, Users, Zap, type LucideIcon } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PUBLIC_PROGRAMS } from '@/lib/constants';
import { useThemeSettings } from '@/hooks/useCms';
import { cmsService } from '@/services/cmsService';
import type { HighlightCard, ProgramCms, RoadmapCard, SkillPetal } from '@/types/cms';

const DEFAULT_PROGRAMS: ProgramCms[] = PUBLIC_PROGRAMS.map((program) => ({
  ...program,
  highlights: [...program.highlights],
  methodology: [...program.methodology],
  outcomes: [...program.outcomes],
  roadmap: [...program.roadmap],
}));

function ArrayEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onChange([...items, ''])}
        >
          <Plus size={14} /> Thêm
        </Button>
      </div>
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={item}
            onChange={(e) => {
              const updated = [...items];
              updated[i] = e.target.value;
              onChange(updated);
            }}
            placeholder={`${label} ${i + 1}`}
          />
          <button
            className="text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
          >
            <Trash2 size={16} />
          </button>
        </div>
      ))}
    </div>
  );
}

const PRESET_COLORS = ['#16A9D8', '#003B7A', '#F45A0A', '#16A34A', '#8B5CF6', '#EC4899', '#F59E0B', '#0EA5E9'];
const SAVED_COLORS_KEY = 'metta_program_saved_colors';

function normalizeHex(color: string) {
  const value = color.trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : '';
}

function readSavedColors() {
  if (typeof window === 'undefined') return PRESET_COLORS;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SAVED_COLORS_KEY) || '[]') as string[];
    const colors = parsed.map(normalizeHex).filter(Boolean);
    return colors.length ? colors : PRESET_COLORS;
  } catch {
    return PRESET_COLORS;
  }
}

function rememberColor(color: string) {
  const hex = normalizeHex(color);
  if (!hex || typeof window === 'undefined') return;
  const next = [hex, ...readSavedColors().filter((c) => c !== hex)].slice(0, 12);
  window.localStorage.setItem(SAVED_COLORS_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('metta:saved-colors', { detail: next }));
}

function SavedColorPalette({ value, onSelect }: { value: string; onSelect: (color: string) => void }) {
  const [colors, setColors] = useState<string[]>(readSavedColors);

  useEffect(() => {
    const sync = (event?: Event) => {
      const detail = event instanceof CustomEvent ? event.detail : null;
      setColors(Array.isArray(detail) ? detail : readSavedColors());
    };
    window.addEventListener('metta:saved-colors', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('metta:saved-colors', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  return (
    <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
      <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-400">Màu đã lưu</p>
      <div className="flex flex-wrap gap-1">
        {colors.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onSelect(color)}
            title={color}
            className={`h-5 w-5 rounded border transition-transform ${normalizeHex(value) === color ? 'scale-110 border-slate-900' : 'border-white shadow-sm hover:scale-105'}`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}

const SKILL_EMOJIS: Record<string, string> = { Social: '🤝', Physical: '🏃', Intellectual: '🧠', Creative: '🎨', Emotional: '💛' };

/* ── Icon registry for highlight/outcome card editor ── */
const HIGHLIGHT_ICONS: { name: string; label: string; Icon: LucideIcon }[] = [
  { name: 'Music', label: 'Âm nhạc', Icon: Music },
  { name: 'BookOpen', label: 'Sách', Icon: BookOpen },
  { name: 'Eye', label: 'Nhìn', Icon: Eye },
  { name: 'Brain', label: 'Tư duy', Icon: Brain },
  { name: 'Globe', label: 'Toàn cầu', Icon: Globe },
  { name: 'Zap', label: 'Phản xạ', Icon: Zap },
  { name: 'Mic', label: 'Phát âm', Icon: Mic },
  { name: 'MessageCircle', label: 'Giao tiếp', Icon: MessageCircle },
  { name: 'GraduationCap', label: 'Tốt nghiệp', Icon: GraduationCap },
  { name: 'Star', label: 'Nổi bật', Icon: Star },
  { name: 'Cpu', label: 'AI / Tech', Icon: Cpu },
  { name: 'FlaskConical', label: 'Khoa học', Icon: FlaskConical },
  { name: 'Trophy', label: 'Thành tích', Icon: Trophy },
  { name: 'Target', label: 'Mục tiêu', Icon: Target },
  { name: 'Lightbulb', label: 'Ý tưởng', Icon: Lightbulb },
  { name: 'Users', label: 'Nhóm', Icon: Users },
  { name: 'Hand', label: 'Thao tác', Icon: Hand },
  { name: 'Activity', label: 'Hoạt động', Icon: Activity },
  { name: 'Layers', label: 'Đa tầng', Icon: Layers },
  { name: 'CheckCircle2', label: 'Đạt được', Icon: CheckCircle2 },
];

function initHighlightCards(highlights: string[], colors: string[]): HighlightCard[] {
  const icons = ['Music', 'BookOpen', 'Eye', 'Brain', 'Globe', 'Star', 'Cpu', 'Lightbulb'];
  return highlights.map((text, i) => {
    const colonIdx = text.indexOf(':');
    let title = text, description = '';
    if (colonIdx > 0 && colonIdx < 50) {
      title = text.slice(0, colonIdx).trim();
      description = text.slice(colonIdx + 1).trim();
    } else {
      const words = text.split(' ');
      title = words.slice(0, 4).join(' ');
      description = words.slice(4).join(' ');
    }
    return { icon: icons[i % icons.length], color: colors[i % colors.length], title, description };
  });
}

function initOutcomeCards(outcomes: string[], colors: string[]): HighlightCard[] {
  const icons = ['Zap', 'Mic', 'MessageCircle', 'GraduationCap', 'Trophy', 'Target'];
  return outcomes.map((text, i) => {
    const colonIdx = text.indexOf(':');
    let title = text, description = '';
    if (colonIdx > 0 && colonIdx < 50) {
      title = text.slice(0, colonIdx).trim();
      description = text.slice(colonIdx + 1).trim();
    } else {
      const words = text.split(' ');
      title = words.slice(0, 4).join(' ');
      description = words.slice(4).join(' ');
    }
    return { icon: icons[i % icons.length], color: colors[i % colors.length], title, description };
  });
}

function HighlightCardsEditor({
  label,
  cards,
  onChange,
  defaultColors,
}: {
  label: string;
  cards: HighlightCard[];
  onChange: (cards: HighlightCard[]) => void;
  defaultColors: string[];
}) {
  function update(i: number, field: keyof HighlightCard, value: string) {
    if (field === 'color') rememberColor(value);
    const copy = [...cards];
    copy[i] = { ...copy[i], [field]: value };
    onChange(copy);
  }

  function add() {
    const idx = cards.length;
    onChange([...cards, {
      icon: HIGHLIGHT_ICONS[idx % HIGHLIGHT_ICONS.length].name,
      color: defaultColors[idx % defaultColors.length],
      title: '',
      description: '',
    }]);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
        <Button variant="outline" size="sm" onClick={add}><Plus size={14} /> Thêm</Button>
      </div>

      {/* Live preview */}
      {cards.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
          {cards.map((card, i) => {
            const iconItem = HIGHLIGHT_ICONS.find((ic) => ic.name === card.icon) ?? HIGHLIGHT_ICONS[0];
            const { Icon } = iconItem;
            return (
              <div key={i} className="rounded-xl p-3 text-white flex flex-col gap-2 relative overflow-hidden" style={{ backgroundColor: card.color || '#0EA5E9' }}>
                <div className="w-8 h-8 rounded-lg bg-white/25 flex items-center justify-center flex-shrink-0">
                  <Icon size={16} />
                </div>
                <p className="text-[12px] font-extrabold leading-snug">{card.title || '(Tiêu đề)'}</p>
                {card.description && <p className="text-[10px] text-white/75 leading-snug">{card.description}</p>}
              </div>
            );
          })}
        </div>
      )}

      {/* Editor rows */}
      <div className="flex flex-col gap-3">
        {cards.map((card, i) => {
          const iconItem = HIGHLIGHT_ICONS.find((ic) => ic.name === card.icon) ?? HIGHLIGHT_ICONS[0];
          const { Icon: CurrentIcon } = iconItem;
          return (
            <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                {/* Color picker column */}
                <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                  <div
                    className="w-10 h-10 rounded-lg border-2 border-slate-200 relative overflow-hidden cursor-pointer"
                    style={{ backgroundColor: card.color }}
                    title="Chọn màu"
                  >
                    <input
                      type="color"
                      value={card.color}
                      onChange={(e) => update(i, 'color', e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-wrap gap-[3px] w-[42px]">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c} type="button"
                        onClick={() => update(i, 'color', c)}
                        title={c}
                        className={`w-[18px] h-[18px] rounded-sm border transition-transform ${card.color === c ? 'border-slate-800 scale-110' : 'border-slate-200 hover:scale-105'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <SavedColorPalette value={card.color} onSelect={(c) => update(i, 'color', c)} />
                </div>

                {/* Fields */}
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  {/* Icon grid */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">Icon</label>
                    <div className="flex flex-wrap gap-1">
                      {HIGHLIGHT_ICONS.map((ic) => (
                        <button
                          key={ic.name}
                          type="button"
                          title={ic.label}
                          onClick={() => update(i, 'icon', ic.name)}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                            card.icon === ic.name
                              ? 'bg-[#003B7A] text-white shadow-md scale-110'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          <ic.Icon size={15} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Title + description */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Tiêu đề</label>
                      <Input
                        className="text-xs mt-0.5"
                        value={card.title}
                        onChange={(e) => update(i, 'title', e.target.value)}
                        placeholder="3E Method"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Mô tả ngắn</label>
                      <Input
                        className="text-xs mt-0.5"
                        value={card.description}
                        onChange={(e) => update(i, 'description', e.target.value)}
                        placeholder="Học qua âm nhạc & vận động"
                      />
                    </div>
                  </div>
                </div>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => onChange(cards.filter((_, j) => j !== i))}
                  className="text-slate-400 hover:text-red-500 transition flex-shrink-0 mt-1"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              {/* Preview chip */}
              <div className="flex items-center gap-2 text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                <div className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: card.color }}>
                  <CurrentIcon size={12} className="text-white" />
                </div>
                <span className="font-semibold text-slate-700">{card.title || '—'}</span>
                {card.description && <span className="text-slate-400 truncate">· {card.description}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SkillsEditor({ skills, onChange }: { skills: SkillPetal[]; onChange: (s: SkillPetal[]) => void }) {
  function update(i: number, field: keyof SkillPetal, value: string) {
    if (field === 'color') rememberColor(value);
    const copy = [...skills];
    copy[i] = { ...copy[i], [field]: value };
    onChange(copy);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Kỹ năng tích hợp (The Metta 5)</p>
        <Button variant="outline" size="sm" onClick={() => onChange([...skills, { name: '', label: '', description: '', color: PRESET_COLORS[skills.length % PRESET_COLORS.length] }])}>
          <Plus size={14} /> Thêm
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {skills.map((s, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
            {/* Color */}
            <div className="flex w-[150px] flex-shrink-0 flex-col">
              <div className="w-10 h-10 rounded-lg border-2 border-slate-200 relative overflow-hidden mt-4" style={{ backgroundColor: s.color }}>
                <input type="color" value={s.color} onChange={(e) => update(i, 'color', e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
              </div>
              <SavedColorPalette value={s.color} onSelect={(c) => update(i, 'color', c)} />
            </div>
            {/* Emoji */}
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-xl flex-shrink-0 mt-4">
              {SKILL_EMOJIS[s.name] || '⭐'}
            </div>
            {/* Fields */}
            <div className="flex-1 grid gap-2 md:grid-cols-4">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Tên EN</label>
                <Input className="text-xs" value={s.name} onChange={(e) => update(i, 'name', e.target.value)} placeholder="Social" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Tên VN</label>
                <Input className="text-xs" value={s.label} onChange={(e) => update(i, 'label', e.target.value)} placeholder="Xã hội" />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Mô tả</label>
                <Input className="text-xs" value={s.description} onChange={(e) => update(i, 'description', e.target.value)} placeholder="Phát triển khả năng..." />
              </div>
            </div>
            <button type="button" onClick={() => onChange(skills.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500 transition flex-shrink-0 mt-5">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function RoadmapCardsEditor({ cards, onChange }: { cards: RoadmapCard[]; onChange: (cards: RoadmapCard[]) => void }) {
  function update(i: number, field: keyof RoadmapCard, value: string) {
    if (field === 'color') rememberColor(value);
    const copy = [...cards];
    copy[i] = { ...copy[i], [field]: value };
    onChange(copy);
  }

  function add() {
    onChange([...cards, { label: `Level ${cards.length + 1}`, title: '', description: '', color: PRESET_COLORS[cards.length % PRESET_COLORS.length] }]);
  }

  function remove(i: number) {
    onChange(cards.filter((_, j) => j !== i));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Lộ trình học (từng cấp độ)</p>
        <Button variant="outline" size="sm" onClick={add}><Plus size={14} /> Thêm level</Button>
      </div>

      {/* Preview */}
      <div className="flex items-end gap-2 mb-4 overflow-x-auto pb-2">
        {cards.map((card, i) => {
          const h = 80 + i * 20;
          return (
            <div key={i} className="flex-shrink-0 w-[120px] rounded-xl p-3 flex flex-col justify-end" style={{ height: h, backgroundColor: card.color || '#003B7A' }}>
              <span className="text-[8px] font-bold uppercase tracking-widest text-white/70">{card.label}</span>
              {card.title && <p className="text-[10px] font-bold text-white leading-tight mt-0.5">{card.title}</p>}
            </div>
          );
        })}
      </div>

      {/* Editor rows */}
      <div className="flex flex-col gap-3">
        {cards.map((card, i) => (
          <div key={i} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
            {/* Color picker */}
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className="w-10 h-10 rounded-lg border-2 border-slate-200 relative overflow-hidden" style={{ backgroundColor: card.color }}>
                <input
                  type="color"
                  value={card.color}
                  onChange={(e) => update(i, 'color', e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
              </div>
              <div className="flex gap-0.5 flex-wrap w-[42px]">
                {PRESET_COLORS.slice(0, 4).map((c) => (
                  <button key={c} type="button" onClick={() => update(i, 'color', c)}
                    className={`w-[18px] h-[18px] rounded-sm border ${card.color === c ? 'border-slate-800 scale-110' : 'border-slate-200'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
              <SavedColorPalette value={card.color} onSelect={(c) => update(i, 'color', c)} />
            </div>

            {/* Fields */}
            <div className="flex-1 grid gap-2 md:grid-cols-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Nhãn (vd: Level 1)</label>
                <Input className="text-xs" value={card.label} onChange={(e) => update(i, 'label', e.target.value)} placeholder="Level 1" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Tiêu đề</label>
                <Input className="text-xs" value={card.title} onChange={(e) => update(i, 'title', e.target.value)} placeholder="Foundation" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Mô tả</label>
                <Input className="text-xs" value={card.description} onChange={(e) => update(i, 'description', e.target.value)} placeholder="Nội dung level này..." />
              </div>
            </div>

            <button type="button" onClick={() => remove(i)} className="text-slate-400 hover:text-red-500 transition flex-shrink-0 mt-5">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function EditorSection({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <div>
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-600">{title}</p>
          {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
        </div>
        <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          {open ? 'Thu gọn' : 'Mở rộng'}
        </span>
      </button>
      {open && <div className="border-t border-slate-100 p-4">{children}</div>}
    </div>
  );
}

function ProgramSliderEditor({ images, onChange }: { images: string[]; onChange: (imgs: string[]) => void }) {
  async function addImages(files: FileList) {
    const urls: string[] = [];
    for (const file of Array.from(files)) {
      const url = await uploadProgramImage(file);
      if (url) urls.push(url);
    }
    onChange([...images, ...urls]);
  }

  function addUrl() {
    const url = prompt('Nhập URL ảnh:');
    if (url?.trim()) onChange([...images, url.trim()]);
  }

  function replaceImage(i: number, url: string) {
    const copy = [...images];
    copy[i] = url;
    onChange(copy);
  }

  function clearSlot(i: number) {
    replaceImage(i, '');
  }

  return (
    <div>
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">Ảnh Slider <span className="normal-case font-semibold text-slate-400">· Khuyến nghị 1920×800px (tỉ lệ 12:5, ngang)</span></p>
      <div className="flex gap-3 flex-wrap">
        {images.map((img, i) => (
          <div key={i} className="relative aspect-[12/5] w-full max-w-[360px] min-w-[260px] rounded-xl border-2 border-dashed border-slate-200 overflow-hidden group flex-shrink-0 bg-slate-100">
            {/* Number badge */}
            <div className="absolute top-2 left-2 z-10 w-7 h-7 bg-[#003B7A] text-white rounded-md flex items-center justify-center text-xs font-bold shadow">{i + 1}</div>
            {/* Delete button */}
            <button
              type="button"
              onClick={() => clearSlot(i)}
              className="absolute top-2 right-2 z-10 w-7 h-7 bg-black/50 hover:bg-red-500 text-white rounded-full flex items-center justify-center text-sm font-bold transition"
            >✕</button>
            {/* Image */}
            {img ? (
              <img src={img} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white text-center text-xs font-bold text-slate-400">
                Slot {i + 1}<br />Chưa có ảnh
              </div>
            )}
            {/* Bottom controls */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 flex gap-2">
              <label className="inline-flex items-center gap-1 bg-white/90 text-slate-700 px-2 py-1 rounded text-[10px] font-bold cursor-pointer hover:bg-white">
                <Upload size={12} /> Thay ảnh {i + 1}
                <input type="file" className="hidden" accept="image/*" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = await uploadProgramImage(file);
                  if (url) replaceImage(i, url);
                }} />
              </label>
              <button type="button" onClick={() => {
                const url = prompt('URL ảnh mới:', img);
                if (url?.trim()) {
                  replaceImage(i, url.trim());
                }
              }} className="bg-white/90 text-slate-700 px-2 py-1 rounded text-[10px] font-bold hover:bg-white">URL</button>
            </div>
          </div>
        ))}

        {/* Add new slot */}
        <label className="aspect-[12/5] w-full max-w-[360px] min-w-[260px] rounded-xl border-2 border-dashed border-slate-300 hover:border-[#003B7A] transition cursor-pointer flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-[#003B7A] flex-shrink-0 bg-white">
          <Plus size={32} />
          <span className="text-xs font-bold">Thêm ảnh</span>
          <input type="file" className="hidden" accept="image/*" multiple onChange={(e) => {
            if (e.target.files?.length) addImages(e.target.files);
          }} />
        </label>
      </div>
      <p className="mt-2 text-[11px] text-slate-400">Tự động chuyển ảnh mỗi <strong>4 giây</strong> · Tự động lướt từ phải sang trái</p>
    </div>
  );
}

async function uploadProgramImage(file: File): Promise<string | null> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  if (cloudName && uploadPreset) {
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', uploadPreset);
    form.append('folder', 'metta-programs');
    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: 'POST', body: form });
      const data = await res.json();
      if (data.secure_url) return data.secure_url;
    } catch {}
  }
  // Fallback: data URL
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

function ProgramCard({
  program,
  index,
  total,
  onChange,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  program: ProgramCms;
  index: number;
  total: number;
  onChange: (p: ProgramCms) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(index === 0);

  const set = (field: keyof ProgramCms, value: unknown) =>
    onChange({ ...program, [field]: value });

  return (
    <Card className={`${open ? 'border-[#003B7A]/30 shadow-md' : ''} ${program.visible === false ? 'opacity-60 grayscale-[0.2]' : ''}`}>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={(e) => { if (!(e.target as HTMLElement).closest('button')) setOpen(!open); }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <span className="text-xs font-bold text-slate-400 bg-slate-100 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0">{index + 1}</span>
            <CardTitle className="text-lg truncate">{program.title || `Chương trình ${index + 1}`}</CardTitle>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => set('visible', program.visible === false)}
              className={`p-1.5 rounded transition ${program.visible === false ? 'bg-slate-100 text-slate-400 hover:text-[#003B7A]' : 'text-[#003B7A] hover:bg-blue-50'}`}
              title={program.visible === false ? 'Hiện chương trình' : 'Ẩn chương trình'}
            >
              {program.visible === false ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
            <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-1">
              <button type="button" disabled={index === 0} onClick={onMoveUp} className="p-1.5 rounded hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed" title="Di chuyển lên">
                <ChevronUp size={16} className="text-slate-500" />
              </button>
              <button type="button" disabled={index === total - 1} onClick={onMoveDown} className="p-1.5 rounded hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed" title="Di chuyển xuống">
                <ChevronDown size={16} className="text-slate-500" />
              </button>
            </div>
            <button type="button" onClick={onDelete} className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500" title="Xóa chương trình">
              <Trash2 size={16} />
            </button>
            <button
              type="button"
              onClick={() => setOpen(!open)}
              className="inline-flex min-w-[96px] items-center justify-center gap-1.5 rounded-lg border border-[#003B7A]/15 bg-[#003B7A]/5 px-3 py-1.5 text-xs font-bold text-[#003B7A] hover:bg-[#003B7A] hover:text-white transition-colors"
              title={open ? 'Thu gọn chương trình' : 'Mở rộng chương trình'}
            >
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {open ? 'Thu gọn' : 'Mở rộng'}
            </button>
          </div>
        </div>
        {!open && (
          <p className="text-sm text-slate-500 ml-10">
            {program.visible === false && <span className="mr-2 rounded bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">Đang ẩn</span>}
            {program.eyebrow} · {program.ageRange} · {program.duration}
          </p>
        )}
      </CardHeader>

      {open && (
        <CardContent className="flex flex-col gap-5">
          {/* Basic info */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Tên chương trình</label>
              <Input value={program.title} onChange={(e) => set('title', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Eyebrow (dòng phụ nhỏ)</label>
              <Input value={program.eyebrow} onChange={(e) => set('eyebrow', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Độ tuổi</label>
              <Input value={program.ageRange} onChange={(e) => set('ageRange', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Thời lượng</label>
              <Input value={program.duration} onChange={(e) => set('duration', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Nhóm khóa</label>
              <Input value={program.courseName} onChange={(e) => set('courseName', e.target.value)} />
            </div>
          </div>

          <EditorSection
            title="Ảnh slider"
            subtitle="Upload hoặc dán URL ảnh dùng ở trang chi tiết chương trình."
          >
            <ProgramSliderEditor
              images={program.images?.length ? program.images : program.image ? [program.image] : []}
              onChange={(imgs) => {
                onChange({ ...program, images: imgs, image: imgs[0] || '' });
              }}
            />
          </EditorSection>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Mô tả chi tiết</label>
            <Textarea
              value={program.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
            />
          </div>

          {/* Tiêu đề section "Điểm nổi bật" */}
          <EditorSection
            title="Điểm nổi bật"
            subtitle="Tiêu đề section và các card màu ở phần điểm nổi bật."
          >
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Tiêu đề section "Điểm nổi bật"</p>
            <div className="grid gap-2 md:grid-cols-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase">Eyebrow (chữ nhỏ)</label>
                <Input className="text-xs" value={program.highlightsEyebrow ?? 'Điểm nổi bật'} onChange={(e) => set('highlightsEyebrow', e.target.value)} placeholder="Điểm nổi bật" />
              </div>
              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Tiêu đề chính (xuống dòng bằng Enter)</label>
                <Textarea className="text-xs" rows={2} value={program.highlightsTitle ?? 'Học qua trải nghiệm,\nphát triển năng lực thật'} onChange={(e) => set('highlightsTitle', e.target.value)} />
              </div>
              <div className="md:col-span-3">
                <label className="text-[10px] font-bold text-slate-400 uppercase">Phụ đề</label>
                <Input className="text-xs" value={program.highlightsSubtitle ?? 'Phương pháp hiện đại – Trẻ hứng thú – Tiến bộ mỗi ngày'} onChange={(e) => set('highlightsSubtitle', e.target.value)} />
              </div>
            </div>
          </div>

          <HighlightCardsEditor
            label="Điểm nổi bật (Highlights)"
            cards={program.highlightCards?.length
              ? program.highlightCards
              : initHighlightCards(program.highlights, ['#0EA5E9', '#F45A0A', '#8B5CF6', '#16A34A', '#EC4899', '#F59E0B'])}
            onChange={(cards) => onChange({
              ...program,
              highlightCards: cards,
              highlights: cards.map((c) => c.description ? `${c.title}: ${c.description}` : c.title),
            })}
            defaultColors={['#0EA5E9', '#F45A0A', '#8B5CF6', '#16A34A', '#EC4899', '#F59E0B']}
          />
          </EditorSection>

          <EditorSection
            title="Phương pháp"
            subtitle="Các tag phương pháp hiển thị trên trang chi tiết."
          >
          <ArrayEditor
            label="Phương pháp (Methodology tags)"
            items={program.methodology}
            onChange={(v) => set('methodology', v)}
          />
          </EditorSection>

          {/* Eyebrow section "Kết quả đầu ra" */}
          <EditorSection
            title="Kết quả đầu ra"
            subtitle="Eyebrow và các card kết quả đầu ra."
          >
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 flex flex-col gap-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase">Eyebrow section "Kết quả đầu ra"</label>
            <Input className="text-xs" value={program.outcomesEyebrow ?? 'Kết quả đầu ra'} onChange={(e) => set('outcomesEyebrow', e.target.value)} placeholder="Kết quả đầu ra" />
          </div>

          <HighlightCardsEditor
            label="Kết quả đầu ra (Outcomes)"
            cards={program.outcomeCards?.length
              ? program.outcomeCards
              : initOutcomeCards(program.outcomes, ['#0EA5E9', '#F45A0A', '#16A34A', '#8B5CF6', '#EC4899', '#F59E0B'])}
            onChange={(cards) => onChange({
              ...program,
              outcomeCards: cards,
              outcomes: cards.map((c) => c.description ? `${c.title}: ${c.description}` : c.title),
            })}
            defaultColors={['#0EA5E9', '#F45A0A', '#16A34A', '#8B5CF6', '#EC4899', '#F59E0B']}
          />
          </EditorSection>

          <EditorSection
            title="Lộ trình học"
            subtitle="Các level/cấp độ hiển thị dạng bậc thang."
          >
          <RoadmapCardsEditor
            cards={program.roadmapCards || program.roadmap.map((item, i) => ({
              label: `Level ${i + 1}`,
              title: '',
              description: item,
              color: ['#16A9D8', '#003B7A', '#F45A0A', '#16A34A', '#8B5CF6'][i % 5],
            }))}
            onChange={(cards) => onChange({ ...program, roadmapCards: cards, roadmap: cards.map((c) => c.description) })}
          />
          </EditorSection>

          {/* Skills - The Metta 5 */}
          <EditorSection
            title="Kỹ năng tích hợp (The Metta 5)"
            subtitle="Mở ra khi cần chỉnh tên, màu và mô tả từng kỹ năng."
          >
          <SkillsEditor
            skills={program.skills || [
              { name: 'Social', label: 'Xã hội', description: '', color: '#0EA5E9' },
              { name: 'Physical', label: 'Thể chất', description: '', color: '#F97316' },
              { name: 'Intellectual', label: 'Nhận thức', description: '', color: '#1E3A5F' },
              { name: 'Creative', label: 'Sáng tạo', description: '', color: '#8B5CF6' },
              { name: 'Emotional', label: 'Tình cảm', description: '', color: '#16A34A' },
            ]}
            onChange={(skills) => onChange({ ...program, skills })}
          />
          </EditorSection>
        </CardContent>
      )}
    </Card>
  );
}

export default function ProgramsCmsPage() {
  const { settings } = useThemeSettings();
  const [programs, setPrograms] = useState<ProgramCms[]>(DEFAULT_PROGRAMS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings?.programs?.length) {
      setPrograms(settings.programs);
    }
  }, [settings]);

  function updateProgram(index: number, updated: ProgramCms) {
    const copy = [...programs];
    copy[index] = updated;
    setPrograms(copy);
  }

  function moveProgram(from: number, to: number) {
    if (to < 0 || to >= programs.length) return;
    const copy = [...programs];
    const [moved] = copy.splice(from, 1);
    copy.splice(to, 0, moved);
    setPrograms(copy);
  }

  function deleteProgram(index: number) {
    if (!confirm(`Xóa chương trình "${programs[index].title}"?`)) return;
    setPrograms(programs.filter((_, i) => i !== index));
  }

  function addProgram() {
    setPrograms([...programs, {
      slug: `program-${Date.now()}`,
      visible: true,
      title: '',
      eyebrow: '',
      ageRange: '',
      duration: '',
      courseName: '',
      image: '',
      summary: '',
      description: '',
      highlights: [''],
      methodology: [''],
      outcomes: [''],
      roadmap: [''],
      roadmapCards: [{ label: 'Level 1', title: '', description: '', color: '#16A9D8' }],
    }]);
  }

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    try {
      await cmsService.saveSettings({ ...settings, programs });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-950">Chương trình học</h1>
          <p className="text-slate-500">Chỉnh sửa nội dung, hình ảnh và thông tin 4 chương trình học.</p>
        </div>
        <Button onClick={handleSave} disabled={saving || !settings}>
          <Save /> {saving ? 'Đang lưu...' : saved ? '✓ Đã lưu' : 'Lưu thay đổi'}
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        {programs.map((program, i) => (
          <ProgramCard
            key={program.slug}
            program={program}
            index={i}
            total={programs.length}
            onChange={(updated) => updateProgram(i, updated)}
            onMoveUp={() => moveProgram(i, i - 1)}
            onMoveDown={() => moveProgram(i, i + 1)}
            onDelete={() => deleteProgram(i)}
          />
        ))}
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={addProgram}><Plus /> Thêm chương trình</Button>
        <Button onClick={handleSave} disabled={saving || !settings}>
          <Save /> {saving ? 'Đang lưu...' : saved ? '✓ Đã lưu' : 'Lưu thay đổi'}
        </Button>
      </div>
    </div>
  );
}
