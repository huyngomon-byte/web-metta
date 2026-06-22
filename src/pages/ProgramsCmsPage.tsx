import { Activity, Brain, BookOpen, CheckCircle2, ChevronDown, ChevronUp, Cpu, Eye, EyeOff, FlaskConical, GraduationCap, Globe, Hand, Layers, Lightbulb, MessageCircle, Mic, Music, Plus, Save, Sparkles, Star, Target, Trash2, Trophy, Upload, Users, Zap, type LucideIcon } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DEFAULT_COURSE_DEAL_SIZE, DEFAULT_DEAL_CURRENCY, PUBLIC_PROGRAMS, SUMMER_DEFAULTS, defaultCourseDealSizeForProgram, resolveCourseDealSizeForProgram } from '@/lib/constants';
import { useThemeSettings } from '@/hooks/useCms';
import { formatCurrency } from '@/lib/utils';
import { cmsService } from '@/services/cmsService';
import type { HighlightCard, ProgramCms, ProgramTemplate, RoadmapCard, SkillPetal, SummerStat, SummerAudienceItem, SummerModule, SummerShowcaseItem, SummerClassInfoRow, SummerGalleryImage, SummerSectionKey } from '@/types/cms';

const DEFAULT_PROGRAMS: ProgramCms[] = PUBLIC_PROGRAMS.map((program) => ({
  ...program,
  images: 'images' in program ? [...program.images] : undefined,
  highlights: [...program.highlights],
  highlightCards: 'highlightCards' in program ? program.highlightCards.map((card) => ({ ...card })) : undefined,
  methodology: [...program.methodology],
  outcomes: [...program.outcomes],
  outcomeCards: 'outcomeCards' in program ? program.outcomeCards.map((card) => ({ ...card })) : undefined,
  roadmap: [...program.roadmap],
  roadmapCards: 'roadmapCards' in program ? program.roadmapCards.map((card) => ({ ...card })) : undefined,
  skills: 'skills' in program ? program.skills.map((skill) => ({ ...skill })) : undefined,
}));

function programTemplateOf(program: Pick<ProgramCms, 'programTemplate' | 'slug'>): ProgramTemplate {
  return program.programTemplate || (program.slug === 'metta-summer-2026' ? 'skills' : 'course');
}

function programTemplateLabel(template: ProgramTemplate) {
  return template === 'skills' ? 'Chương trình kỹ năng' : 'Chương trình học';
}

function cloneSummerDefaults(): Partial<ProgramCms> {
  const D = SUMMER_DEFAULTS;
  return {
    summerSubtitle: D.subtitle,
    summerChips: [...D.chips],
    summerHeroStats: D.heroStats.map((item) => ({ ...item })),
    summerSectionVisibility: { ...D.sectionVisibility },
    summerOverviewEyebrow: D.overviewEyebrow,
    summerOverviewTitle: D.overviewTitle,
    summerOverviewBody: D.overviewBody,
    summerAudienceTitle: D.audienceTitle,
    summerAudience: D.audience.map((item) => ({ ...item })),
    summerModulesEyebrow: D.modulesEyebrow,
    summerModulesTitle: D.modulesTitle,
    summerModules: D.modules.map((item) => ({ ...item })),
    summerRoadmapEyebrow: D.roadmapEyebrow,
    summerRoadmapTitle: D.roadmapTitle,
    summerStages: D.stages.map((item) => ({ ...item })),
    summerWeeklyColumns: [...D.weeklyColumns],
    summerWeeklyPlan: D.weeklyPlan.map((row) => [...row]),
    summerOutcomesTitle: D.outcomesTitle,
    summerOutcomesList: [...D.outcomes],
    summerShowcaseEyebrow: D.showcaseEyebrow,
    summerShowcaseTitle: D.showcaseTitle,
    summerShowcaseBody: D.showcaseBody,
    summerShowcaseImage: D.showcaseImage,
    summerShowcaseImages: D.showcaseImages.map((item) => ({ ...item })),
    summerShowcaseItems: D.showcaseItems.map((item) => ({ ...item })),
    summerClassInfoTitle: D.classInfoTitle,
    summerClassInfoBody: D.classInfoBody,
    summerClassInfo: D.classInfo.map((item) => ({ ...item })),
    summerGalleryTitle: D.galleryTitle,
    summerGallery: D.gallery.map((item) => ({ ...item })),
    summerCtaTitle: D.ctaTitle,
    summerCtaBody: D.ctaBody,
  };
}

function createCourseProgram(): ProgramCms {
  return {
    slug: `program-${Date.now()}`,
    visible: true,
    programTemplate: 'course',
    title: '',
    eyebrow: '',
    ageRange: '',
    duration: '',
    courseName: '',
    dealSize: DEFAULT_COURSE_DEAL_SIZE,
    dealCurrency: DEFAULT_DEAL_CURRENCY,
    image: '',
    summary: '',
    description: '',
    highlights: [''],
    methodology: [''],
    outcomes: [''],
    roadmap: [''],
    roadmapCards: [{ label: 'Level 1', title: '', description: '', color: '#16A9D8' }],
  };
}

function createSkillsProgram(): ProgramCms {
  const timestamp = Date.now();
  return {
    ...createCourseProgram(),
    slug: `skills-${timestamp}`,
    programTemplate: 'skills',
    eyebrow: 'Chương trình kỹ năng',
    courseName: 'Kỹ năng · Đa bộ môn',
    dealSize: DEFAULT_COURSE_DEAL_SIZE,
    highlights: [],
    methodology: [],
    outcomes: [],
    roadmap: [],
    roadmapCards: [],
    ...cloneSummerDefaults(),
  };
}

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
let savedColors = PRESET_COLORS;

function normalizeHex(color: string) {
  const value = color.trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : '';
}

function readSavedColors() {
  return savedColors.length ? savedColors : PRESET_COLORS;
}

function rememberColor(color: string) {
  const hex = normalizeHex(color);
  if (!hex || typeof window === 'undefined') return;
  const next = [hex, ...readSavedColors().filter((c) => c !== hex)].slice(0, 12);
  savedColors = next;
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
    return () => {
      window.removeEventListener('metta:saved-colors', sync);
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
  { name: 'Sparkles', label: 'Sáng tạo', Icon: Sparkles },
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
  visible,
  onVisibleChange,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  visible?: boolean;
  onVisibleChange?: (visible: boolean) => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasVisibilityToggle = typeof visible === 'boolean' && Boolean(onVisibleChange);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left">
          <p className="text-xs font-extrabold uppercase tracking-wide text-slate-600">{title}</p>
          {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {hasVisibilityToggle && (
            <button
              type="button"
              aria-pressed={visible}
              onClick={() => onVisibleChange?.(!visible)}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors ${visible ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}
            >
              {visible ? <Eye size={14} /> : <EyeOff size={14} />}
              {visible ? 'Đang hiện' : 'Đang ẩn'}
            </button>
          )}
          <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-600">
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            {open ? 'Thu gọn' : 'Mở rộng'}
          </button>
        </div>
      </div>
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

function HomeDisplayEditor({ program, onChange }: { program: ProgramCms; onChange: (p: ProgramCms) => void }) {
  const set = (field: keyof ProgramCms, value: unknown) => onChange({ ...program, [field]: value });
  const fallbackImage = program.images?.find(Boolean) || program.image || '';
  const previewImage = program.homeImage || fallbackImage;
  const homeHighlights = program.homeHighlights !== undefined ? program.homeHighlights : program.highlights;

  return (
    <EditorSection
      title="Hiển thị trên trang chủ"
      subtitle="Các nội dung dùng cho card chương trình ở section Chương trình học trên trang chủ."
    >
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="flex flex-col gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Ảnh card trang chủ</span>
          <div className="aspect-[4/3] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            {previewImage ? (
              <img src={previewImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">Chưa có ảnh</div>
            )}
          </div>
          <label className="inline-flex w-fit cursor-pointer items-center gap-1 rounded border px-2 py-1 text-xs font-bold hover:bg-slate-50">
            <Upload size={12} /> Upload ảnh
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const url = await uploadProgramImage(file);
                if (url) set('homeImage', url);
              }}
            />
          </label>
          <Input
            className="text-xs"
            value={program.homeImage ?? ''}
            onChange={(e) => set('homeImage', e.target.value)}
            placeholder={fallbackImage || 'URL ảnh hiển thị trên trang chủ'}
          />
          <p className="text-[11px] font-semibold text-slate-400">Để trống sẽ dùng ảnh đầu tiên của slider/ảnh chính.</p>
        </div>

        <div className="grid gap-3">
          <div className="grid gap-2 md:grid-cols-2">
            <LabeledInput label="Tiêu đề trên card" value={program.homeTitle ?? ''} onChange={(v) => set('homeTitle', v)} placeholder={program.title || 'Tên chương trình'} />
            <LabeledInput label="Badge độ tuổi" value={program.homeAgeLabel ?? ''} onChange={(v) => set('homeAgeLabel', v)} placeholder={program.ageRange || '4–11 tuổi'} />
            <LabeledInput label="Eyebrow / nhóm chương trình" value={program.homeEyebrow ?? ''} onChange={(v) => set('homeEyebrow', v)} placeholder={program.eyebrow || 'Chương trình hè đa bộ môn'} />
            <LabeledInput label="Thời lượng dưới card" value={program.homeDuration ?? ''} onChange={(v) => set('homeDuration', v)} placeholder={program.duration || '6 tuần · 24 buổi · 1h30/buổi'} />
          </div>

          <LabeledTextarea
            label="Mô tả ngắn trên card"
            value={program.homeSummary ?? ''}
            onChange={(v) => set('homeSummary', v)}
            placeholder={program.summary || 'Mô tả ngắn hiển thị trên trang chủ'}
          />

          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Gạch đầu dòng trên card</p>
                <p className="mt-1 text-[11px] font-semibold text-slate-400">Trang chủ chỉ hiển thị 3 dòng đầu tiên.</p>
              </div>
            </div>
            <ArrayEditor
              label="Gạch đầu dòng"
              items={homeHighlights}
              onChange={(items) => set('homeHighlights', items)}
            />
          </div>
        </div>
      </div>
    </EditorSection>
  );
}

/* ── Helpers & editors riêng cho trang Summer ── */
function LabeledInput({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <Input className="text-sm" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

function LabeledTextarea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <Textarea className="text-sm" rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}

function SummerImageField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <div className="flex items-center gap-3">
        <div className="h-[72px] w-24 flex-shrink-0 overflow-hidden rounded-lg border bg-slate-100">{value && <img src={value} alt="" className="h-full w-full object-cover" />}</div>
        <div className="flex flex-1 flex-col gap-1">
          <label className="inline-flex w-fit cursor-pointer items-center gap-1 rounded border px-2 py-1 text-xs font-bold hover:bg-slate-50">
            <Upload size={12} /> Upload
            <input type="file" className="hidden" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const u = await uploadProgramImage(f); if (u) onChange(u); } }} />
          </label>
          <Input className="text-xs" value={value} onChange={(e) => onChange(e.target.value)} placeholder="URL ảnh" />
        </div>
      </div>
    </div>
  );
}

function SummerStatsEditor({ stats, onChange }: { stats: SummerStat[]; onChange: (s: SummerStat[]) => void }) {
  const update = (i: number, field: keyof SummerStat, val: string) => { const c = [...stats]; c[i] = { ...c[i], [field]: val }; onChange(c); };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Số liệu nổi (hero)</span>
        <Button variant="outline" size="sm" onClick={() => onChange([...stats, { value: '', label: '', color: '#003B7A' }])}><Plus size={14} /> Thêm</Button>
      </div>
      {stats.map((s, i) => (
        <div key={i} className="flex items-center gap-2">
          <input type="color" value={s.color || '#003B7A'} onChange={(e) => update(i, 'color', e.target.value)} className="h-9 w-9 flex-shrink-0 cursor-pointer rounded border" />
          <Input className="w-24" value={s.value} onChange={(e) => update(i, 'value', e.target.value)} placeholder="6" />
          <Input value={s.label} onChange={(e) => update(i, 'label', e.target.value)} placeholder="tuần" />
          <button type="button" onClick={() => onChange(stats.filter((_, j) => j !== i))} className="flex-shrink-0 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
        </div>
      ))}
    </div>
  );
}

function SummerAudienceEditor({ items, onChange }: { items: SummerAudienceItem[]; onChange: (s: SummerAudienceItem[]) => void }) {
  const update = (i: number, field: keyof SummerAudienceItem, val: string) => { const c = [...items]; c[i] = { ...c[i], [field]: val }; onChange(c); };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Đối tượng phù hợp</span>
        <Button variant="outline" size="sm" onClick={() => onChange([...items, { title: '', description: '' }])}><Plus size={14} /> Thêm</Button>
      </div>
      {items.map((it, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center gap-2">
            <Input value={it.title} onChange={(e) => update(i, 'title', e.target.value)} placeholder="Tên nhóm" />
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="flex-shrink-0 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
          </div>
          <Textarea className="text-sm" rows={2} value={it.description} onChange={(e) => update(i, 'description', e.target.value)} placeholder="Mô tả" />
        </div>
      ))}
    </div>
  );
}

function SummerModulesEditor({ modules, onChange }: { modules: SummerModule[]; onChange: (items: SummerModule[]) => void }) {
  const update = (i: number, field: keyof SummerModule, val: string) => {
    if (field === 'color') rememberColor(val);
    const copy = [...modules];
    copy[i] = { ...copy[i], [field]: val };
    onChange(copy);
  };

  const add = () => {
    const idx = modules.length;
    const fallback = SUMMER_DEFAULTS.modules[idx % SUMMER_DEFAULTS.modules.length];
    onChange([...modules, {
      icon: fallback.icon,
      color: fallback.color,
      title: '',
      description: '',
      image: fallback.image,
      tag: fallback.tag,
    }]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Thông tin bộ môn + ảnh hero slider</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-400">Ảnh dùng ở hero slider. Kích thước đề xuất: 1440 x 1080 px, tỷ lệ ngang 4:3, JPG/PNG.</p>
        </div>
        <Button variant="outline" size="sm" onClick={add}><Plus size={14} /> Thêm</Button>
      </div>
      {modules.map((mod, i) => {
        const iconItem = HIGHLIGHT_ICONS.find((ic) => ic.name === mod.icon) ?? HIGHLIGHT_ICONS[0];
        const imageValue = mod.image ?? SUMMER_DEFAULTS.modules[i % SUMMER_DEFAULTS.modules.length]?.image ?? '';
        return (
          <div key={i} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 lg:grid-cols-[260px_1fr]">
            <SummerImageField
              label={`Ảnh bộ môn ${i + 1}`}
              value={imageValue}
              onChange={(value) => update(i, 'image', value)}
            />
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap gap-1">
                {HIGHLIGHT_ICONS.map((ic) => (
                  <button key={ic.name} type="button" title={ic.label} onClick={() => update(i, 'icon', ic.name)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${mod.icon === ic.name ? 'scale-110 bg-[#003B7A] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    <ic.Icon size={15} />
                  </button>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                <Input value={mod.title} onChange={(e) => update(i, 'title', e.target.value)} placeholder="Tên bộ môn" />
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border" style={{ color: mod.color, backgroundColor: `${mod.color}1A` }}>
                    <iconItem.Icon size={16} />
                  </div>
                  <input type="color" value={mod.color || '#003B7A'} onChange={(e) => update(i, 'color', e.target.value)} className="h-9 w-10 cursor-pointer rounded border" />
                  <button type="button" onClick={() => onChange(modules.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
                </div>
              </div>
              <Input value={mod.tag ?? mod.title} onChange={(e) => update(i, 'tag', e.target.value)} placeholder="Tag hiển thị trên ảnh hero" />
              <Textarea rows={3} value={mod.description} onChange={(e) => update(i, 'description', e.target.value)} placeholder="Mô tả bộ môn" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SummerWeeklyEditor({ columns, rows, onColumns, onRows }: { columns: string[]; rows: string[][]; onColumns: (c: string[]) => void; onRows: (r: string[][]) => void }) {
  const setCol = (ci: number, val: string) => { const c = [...columns]; c[ci] = val; onColumns(c); };
  const setCell = (ri: number, ci: number, val: string) => { const c = rows.map((r) => [...r]); if (!c[ri]) return; c[ri][ci] = val; onRows(c); };
  const addRow = () => onRows([...rows, Array.from({ length: columns.length }, () => '')]);
  const addCol = () => { onColumns([...columns, '']); onRows(rows.map((r) => [...r, ''])); };
  const removeCol = (ci: number) => { onColumns(columns.filter((_, j) => j !== ci)); onRows(rows.map((r) => r.filter((_, j) => j !== ci))); };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Lịch học từng tuần</span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addCol}><Plus size={14} /> Cột</Button>
          <Button variant="outline" size="sm" onClick={addRow}><Plus size={14} /> Dòng</Button>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {columns.map((c, ci) => (
          <div key={ci} className="flex min-w-[150px] items-center gap-1">
            <Input className="text-xs font-bold" value={c} onChange={(e) => setCol(ci, e.target.value)} placeholder={`Cột ${ci + 1}`} />
            <button type="button" onClick={() => removeCol(ci)} className="flex-shrink-0 text-slate-300 hover:text-red-500"><Trash2 size={13} /></button>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {rows.map((row, ri) => (
          <div key={ri} className="flex items-start gap-2 overflow-x-auto rounded-lg border border-slate-100 bg-white p-2">
            {columns.map((_, ci) => (
              <Textarea key={ci} className="min-w-[150px] text-xs" rows={2} value={row[ci] ?? ''} onChange={(e) => setCell(ri, ci, e.target.value)} />
            ))}
            <button type="button" onClick={() => onRows(rows.filter((_, j) => j !== ri))} className="mt-1 flex-shrink-0 text-slate-400 hover:text-red-500"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummerShowcaseEditor({ items, onChange }: { items: SummerShowcaseItem[]; onChange: (s: SummerShowcaseItem[]) => void }) {
  const update = (i: number, field: keyof SummerShowcaseItem, val: string) => { const c = [...items]; c[i] = { ...c[i], [field]: val }; onChange(c); };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Hạng mục Showcase</span>
        <Button variant="outline" size="sm" onClick={() => onChange([...items, { icon: 'Star', title: '', description: '' }])}><Plus size={14} /> Thêm</Button>
      </div>
      {items.map((it, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap gap-1">
            {HIGHLIGHT_ICONS.map((ic) => (
              <button key={ic.name} type="button" title={ic.label} onClick={() => update(i, 'icon', ic.name)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all ${it.icon === ic.name ? 'scale-110 bg-[#003B7A] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                <ic.Icon size={15} />
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input value={it.title} onChange={(e) => update(i, 'title', e.target.value)} placeholder="Tiêu đề" />
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} className="flex-shrink-0 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
          </div>
          <Input value={it.description} onChange={(e) => update(i, 'description', e.target.value)} placeholder="Mô tả" />
        </div>
      ))}
    </div>
  );
}

function SummerClassInfoEditor({ rows, onChange }: { rows: SummerClassInfoRow[]; onChange: (r: SummerClassInfoRow[]) => void }) {
  const update = (i: number, field: keyof SummerClassInfoRow, val: string) => { const c = [...rows]; c[i] = { ...c[i], [field]: val }; onChange(c); };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Bảng thông tin lớp học</span>
        <Button variant="outline" size="sm" onClick={() => onChange([...rows, { label: '', value: '' }])}><Plus size={14} /> Thêm</Button>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input className="w-1/3" value={r.label} onChange={(e) => update(i, 'label', e.target.value)} placeholder="Nhãn" />
          <Input value={r.value} onChange={(e) => update(i, 'value', e.target.value)} placeholder="Giá trị" />
          <button type="button" onClick={() => onChange(rows.filter((_, j) => j !== i))} className="flex-shrink-0 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
        </div>
      ))}
    </div>
  );
}

function SummerGalleryEditor({
  images,
  onChange,
  label = 'Ảnh thư viện',
  sizeNote,
}: {
  images: SummerGalleryImage[];
  onChange: (g: SummerGalleryImage[]) => void;
  label?: string;
  sizeNote?: string;
}) {
  const update = (i: number, field: keyof SummerGalleryImage, val: string) => { const c = [...images]; c[i] = { ...c[i], [field]: val }; onChange(c); };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
          {sizeNote && <p className="mt-1 text-[11px] font-semibold text-slate-400">{sizeNote}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={() => onChange([...images, { src: '', title: '', alt: '' }])}><Plus size={14} /> Thêm</Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {images.map((img, i) => (
          <div key={i} className="flex gap-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border bg-slate-100">{img.src && <img src={img.src} alt="" className="h-full w-full object-cover" />}</div>
            <div className="flex flex-1 flex-col gap-1.5">
              <label className="inline-flex w-fit cursor-pointer items-center gap-1 rounded border px-2 py-1 text-[10px] font-bold hover:bg-slate-50">
                <Upload size={11} /> Upload
                <input type="file" className="hidden" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const u = await uploadProgramImage(f); if (u) update(i, 'src', u); } }} />
              </label>
              <Input className="text-xs" value={img.src} onChange={(e) => update(i, 'src', e.target.value)} placeholder="URL ảnh" />
              <Input className="text-xs" value={img.title} onChange={(e) => update(i, 'title', e.target.value)} placeholder="Tiêu đề (caption)" />
            </div>
            <button type="button" onClick={() => onChange(images.filter((_, j) => j !== i))} className="flex-shrink-0 text-slate-400 hover:text-red-500"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}

function summerClassInfoRowsForProgram(program: ProgramCms, rows: SummerClassInfoRow[]) {
  const price = `${formatCurrency(resolveCourseDealSizeForProgram(program), program.dealCurrency || DEFAULT_DEAL_CURRENCY)} / trọn khóa`;
  return rows.map((row) => {
    if (row.label === 'Tên chương trình') return { ...row, value: program.title || row.value };
    if (row.label === 'Độ tuổi') return { ...row, value: program.ageRange || row.value };
    if (row.label === 'Thời lượng') return { ...row, value: program.duration || row.value };
    if (row.label === 'Học phí') return { ...row, value: price };
    return row;
  });
}

function SummerContentEditor({ program, onChange }: { program: ProgramCms; onChange: (p: ProgramCms) => void }) {
  const set = (field: keyof ProgramCms, value: unknown) => onChange({ ...program, [field]: value });
  const D = SUMMER_DEFAULTS;
  const classInfoRows = summerClassInfoRowsForProgram(program, program.summerClassInfo ?? D.classInfo);
  const sectionVisibility = { ...D.sectionVisibility, ...program.summerSectionVisibility };
  const sectionControl = (section: SummerSectionKey) => ({
    visible: sectionVisibility[section] !== false,
    onVisibleChange: (visible: boolean) => set('summerSectionVisibility', { ...program.summerSectionVisibility, [section]: visible }),
  });
  return (
    <div className="flex flex-col gap-4 rounded-xl border-2 border-dashed border-[#F45A0A]/30 bg-[#FFF7ED]/50 p-4">
      <div className="flex items-center gap-2 text-sm font-extrabold text-[#9A3412]">
        <Sparkles size={16} /> Nội dung chương trình kỹ năng
      </div>

      <EditorSection title="Hero chương trình kỹ năng" subtitle="Dòng phụ, chip, số liệu nổi và ảnh slider ở đầu trang." defaultOpen {...sectionControl('hero')}>
        <div className="flex flex-col gap-3">
          <LabeledInput label="Dòng phụ dưới tiêu đề" value={program.summerSubtitle ?? D.subtitle} onChange={(v) => set('summerSubtitle', v)} />
          <ArrayEditor label="Chip (hero)" items={program.summerChips ?? D.chips} onChange={(v) => set('summerChips', v)} />
          <SummerStatsEditor stats={program.summerHeroStats ?? D.heroStats} onChange={(v) => set('summerHeroStats', v)} />
          <p className="rounded-lg bg-[#EAF7FF] px-3 py-2 text-xs font-semibold text-[#003B7A]">
            Ảnh hero slider và tag trên ảnh nằm trong từng bộ môn ở section "4 bộ môn".
          </p>
        </div>
      </EditorSection>

      <EditorSection title="Tổng quan chương trình" {...sectionControl('overview')}>
        <div className="grid gap-2">
          <LabeledInput label="Eyebrow" value={program.summerOverviewEyebrow ?? D.overviewEyebrow} onChange={(v) => set('summerOverviewEyebrow', v)} />
          <LabeledInput label="Tiêu đề" value={program.summerOverviewTitle ?? D.overviewTitle} onChange={(v) => set('summerOverviewTitle', v)} />
          <LabeledTextarea label="Nội dung" value={program.summerOverviewBody ?? D.overviewBody} onChange={(v) => set('summerOverviewBody', v)} />
        </div>
      </EditorSection>

      <EditorSection title="Đối tượng phù hợp" {...sectionControl('audience')}>
        <LabeledInput label="Tiêu đề section" value={program.summerAudienceTitle ?? D.audienceTitle} onChange={(v) => set('summerAudienceTitle', v)} />
        <div className="mt-3"><SummerAudienceEditor items={program.summerAudience ?? D.audience} onChange={(v) => set('summerAudience', v)} /></div>
      </EditorSection>

      <EditorSection title="4 bộ môn" {...sectionControl('modules')}>
        <div className="mb-3 grid gap-2 md:grid-cols-2">
          <LabeledInput label="Eyebrow" value={program.summerModulesEyebrow ?? D.modulesEyebrow} onChange={(v) => set('summerModulesEyebrow', v)} />
          <LabeledInput label="Tiêu đề" value={program.summerModulesTitle ?? D.modulesTitle} onChange={(v) => set('summerModulesTitle', v)} />
        </div>
        <SummerModulesEditor modules={program.summerModules ?? D.modules} onChange={(items) => set('summerModules', items)} />
      </EditorSection>

      <EditorSection title="Lộ trình & lịch tuần" {...sectionControl('roadmap')}>
        <div className="mb-3 grid gap-2 md:grid-cols-2">
          <LabeledInput label="Eyebrow" value={program.summerRoadmapEyebrow ?? D.roadmapEyebrow} onChange={(v) => set('summerRoadmapEyebrow', v)} />
          <LabeledInput label="Tiêu đề" value={program.summerRoadmapTitle ?? D.roadmapTitle} onChange={(v) => set('summerRoadmapTitle', v)} />
        </div>
        <RoadmapCardsEditor cards={program.summerStages ?? D.stages} onChange={(cards) => set('summerStages', cards)} />
        <div className="mt-4"><SummerWeeklyEditor columns={program.summerWeeklyColumns ?? D.weeklyColumns} rows={program.summerWeeklyPlan ?? D.weeklyPlan} onColumns={(v) => set('summerWeeklyColumns', v)} onRows={(v) => set('summerWeeklyPlan', v)} /></div>
      </EditorSection>

      <EditorSection title="Kết quả (Sau 6 tuần)" {...sectionControl('outcomes')}>
        <LabeledInput label="Tiêu đề" value={program.summerOutcomesTitle ?? D.outcomesTitle} onChange={(v) => set('summerOutcomesTitle', v)} />
        <div className="mt-2"><ArrayEditor label="Danh sách kết quả" items={program.summerOutcomesList ?? D.outcomes} onChange={(v) => set('summerOutcomesList', v)} /></div>
      </EditorSection>

      <EditorSection title="Showcase cuối khóa" {...sectionControl('showcase')}>
        <div className="mb-3 grid gap-2">
          <LabeledInput label="Eyebrow" value={program.summerShowcaseEyebrow ?? D.showcaseEyebrow} onChange={(v) => set('summerShowcaseEyebrow', v)} />
          <LabeledInput label="Tiêu đề" value={program.summerShowcaseTitle ?? D.showcaseTitle} onChange={(v) => set('summerShowcaseTitle', v)} />
          <LabeledTextarea label="Nội dung" value={program.summerShowcaseBody ?? D.showcaseBody} onChange={(v) => set('summerShowcaseBody', v)} />
          <SummerGalleryEditor
            label="Ảnh slider showcase"
            sizeNote="Kích thước ảnh đề xuất: 1200 x 800 px, tỷ lệ 3:2. Phần này không hiển thị tag trên ảnh."
            images={program.summerShowcaseImages?.length ? program.summerShowcaseImages : (program.summerShowcaseImage ? [{ src: program.summerShowcaseImage, title: program.summerShowcaseTitle ?? D.showcaseTitle, alt: program.summerShowcaseTitle ?? D.showcaseTitle }] : D.showcaseImages)}
            onChange={(v) => set('summerShowcaseImages', v)}
          />
        </div>
        <SummerShowcaseEditor items={program.summerShowcaseItems ?? D.showcaseItems} onChange={(v) => set('summerShowcaseItems', v)} />
      </EditorSection>

      <EditorSection title="Thông tin lớp học" {...sectionControl('classInfo')}>
        <div className="mb-3 grid gap-2">
          <LabeledInput label="Tiêu đề" value={program.summerClassInfoTitle ?? D.classInfoTitle} onChange={(v) => set('summerClassInfoTitle', v)} />
          <LabeledTextarea label="Mô tả" value={program.summerClassInfoBody ?? D.classInfoBody} onChange={(v) => set('summerClassInfoBody', v)} />
        </div>
        <SummerClassInfoEditor rows={classInfoRows} onChange={(v) => set('summerClassInfo', v)} />
      </EditorSection>

      <EditorSection title="Thư viện ảnh" {...sectionControl('gallery')}>
        <LabeledInput label="Tiêu đề" value={program.summerGalleryTitle ?? D.galleryTitle} onChange={(v) => set('summerGalleryTitle', v)} />
        <div className="mt-2"><SummerGalleryEditor images={program.summerGallery ?? D.gallery} onChange={(v) => set('summerGallery', v)} /></div>
      </EditorSection>

      <EditorSection title="CTA cuối trang" {...sectionControl('cta')}>
        <div className="grid gap-2">
          <LabeledInput label="Tiêu đề" value={program.summerCtaTitle ?? D.ctaTitle} onChange={(v) => set('summerCtaTitle', v)} />
          <LabeledTextarea label="Nội dung" value={program.summerCtaBody ?? D.ctaBody} onChange={(v) => set('summerCtaBody', v)} />
        </div>
      </EditorSection>

      <EditorSection title="Form tư vấn cuối trang" subtitle="Ẩn/hiện form tư vấn ở cuối trang chương trình kỹ năng." {...sectionControl('leadForm')}>
        <p className="text-sm font-semibold text-slate-500">Form sử dụng chung component lead form của website. Nội dung form được đồng bộ theo chương trình.</p>
      </EditorSection>
    </div>
  );
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
  const defaultDealSize = defaultCourseDealSizeForProgram(program);
  const effectiveDealSize = resolveCourseDealSizeForProgram(program);
  const template = programTemplateOf(program);
  const isCourseTemplate = template === 'course';
  const isSkillsTemplate = template === 'skills';

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
            <span className={`hidden rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide sm:inline-flex ${isSkillsTemplate ? 'bg-orange-50 text-[#C2410C]' : 'bg-blue-50 text-[#003B7A]'}`}>
              {programTemplateLabel(template)}
            </span>
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
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Mẫu hiển thị</p>
            <div className="flex flex-wrap gap-2">
              {(['course', 'skills'] as ProgramTemplate[]).map((item) => {
                const active = template === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => set('programTemplate', item)}
                    className={`rounded-lg border px-3 py-2 text-sm font-bold transition-colors ${active ? 'border-[#003B7A] bg-[#003B7A] text-white shadow-sm' : 'border-slate-200 bg-white text-slate-600 hover:border-[#003B7A]/40 hover:text-[#003B7A]'}`}
                  >
                    {programTemplateLabel(item)}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-400">
              {isSkillsTemplate
                ? 'Mẫu kỹ năng dùng layout kỹ năng/Summer và chỉ hiện các mục có tác dụng trên trang đó.'
                : 'Mẫu chương trình học dùng layout chương trình chính quy với điểm nổi bật, phương pháp, kết quả và lộ trình.'}
            </p>
          </div>

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
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold uppercase tracking-wide text-slate-500">Deal size mặc định (VND)</label>
              <Input
                type="number"
                min={0}
                step={100000}
                placeholder={String(defaultDealSize)}
                value={program.dealSize ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  const parsed = Number(raw);
                  onChange({
                    ...program,
                    dealSize: raw !== '' && Number.isFinite(parsed) && parsed > 0 ? parsed : undefined,
                    dealCurrency: DEFAULT_DEAL_CURRENCY,
                  });
                }}
              />
              <p className="text-[11px] font-semibold text-slate-400">
                Lead sẽ lấy: {formatCurrency(effectiveDealSize, program.dealCurrency || DEFAULT_DEAL_CURRENCY)}
              </p>
            </div>
          </div>

          <HomeDisplayEditor program={program} onChange={onChange} />

          {isCourseTemplate && (
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
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-500">
              {isSkillsTemplate ? 'Mô tả ngắn trên hero' : 'Mô tả chi tiết'}
            </label>
            <Textarea
              value={program.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
            />
          </div>

          {isCourseTemplate && (
          <>
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

          </>
          )}

          {isSkillsTemplate && (
            <SummerContentEditor program={program} onChange={onChange} />
          )}
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
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  useEffect(() => {
    if (settings?.programs?.length) {
      setPrograms(settings.programs.map((program) => ({
        ...program,
        programTemplate: programTemplateOf(program),
      })));
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

  function addProgram(template: ProgramTemplate) {
    setPrograms([...programs, template === 'skills' ? createSkillsProgram() : createCourseProgram()]);
    setAddMenuOpen(false);
  }

  async function handleSave() {
    if (!settings) return;
    const programsForSave = programs.map((program) => ({
      ...program,
      programTemplate: programTemplateOf(program),
    }));
    setSaving(true);
    try {
      await cmsService.saveSettings({ ...settings, programs: programsForSave });
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
          <p className="text-slate-500">Chỉnh sửa nội dung, hình ảnh và thông tin các chương trình học/kỹ năng.</p>
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
        <div className="relative">
          <Button variant="outline" onClick={() => setAddMenuOpen((open) => !open)}><Plus /> Thêm chương trình</Button>
          {addMenuOpen && (
            <div className="absolute bottom-full left-0 z-20 mb-2 w-72 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              <button
                type="button"
                onClick={() => addProgram('course')}
                className="block w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-blue-50"
              >
                <span className="block text-sm font-extrabold text-[#003B7A]">Chương trình học</span>
                <span className="mt-1 block text-xs font-semibold text-slate-500">Dùng layout chương trình chính quy.</span>
              </button>
              <button
                type="button"
                onClick={() => addProgram('skills')}
                className="block w-full px-4 py-3 text-left hover:bg-orange-50"
              >
                <span className="block text-sm font-extrabold text-[#C2410C]">Chương trình kỹ năng</span>
                <span className="mt-1 block text-xs font-semibold text-slate-500">Dùng layout kỹ năng/Summer với các section ẩn hiện riêng.</span>
              </button>
            </div>
          )}
        </div>
        <Button onClick={handleSave} disabled={saving || !settings}>
          <Save /> {saving ? 'Đang lưu...' : saved ? '✓ Đã lưu' : 'Lưu thay đổi'}
        </Button>
      </div>
    </div>
  );
}
