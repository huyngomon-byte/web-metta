import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Compass,
  Eye,
  EyeOff,
  FileBadge2,
  GraduationCap,
  ImagePlus,
  Lightbulb,
  Mic2,
  Palette,
  Plus,
  Rocket,
  Save,
  Send,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ChessPieceIcon } from '@/components/icons/ChessPieceIcon';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { pages as seedPages } from '@/data/seed';
import { cmsService } from '@/services/cmsService';
import { usePageSections } from '@/hooks/useCms';
import type { BlockType, CmsPage, MettaPlusPricingOffer, PageSection } from '@/types/cms';
import { SUMMER_DEFAULTS, SUMMER_ENGLISH_WARMUP_ACTIVITIES, SUMMER_ENGLISH_WARMUP_NOTE } from '@/lib/constants';

/* ── constants ────────────────────────────────────────────────────────── */
const BLOCK_TYPES: BlockType[] = [
  'Hero', 'Stats', 'Benefits', 'Courses', 'Facilities', 'Testimonials', 'Teachers', 'News',
  'Lead Form', 'FAQ', 'CTA', 'About', 'Contact', 'Footer',
  'Ebook Hero', 'Ebook Skills', 'Ebook Why',
  'Metta+ Hero', 'Metta+ Skills', 'Metta+ Benefits', 'Metta+ Age Clubs', 'Metta+ Pass',
  'Metta+ Journey', 'Metta+ Weekly Plan', 'Metta+ Reasons', 'Metta+ Video', 'Metta+ Form',
];

/* ── ImageUploader (full-size – dùng cho Hero, About) ───────────────── */
interface ImageUploaderProps {
  value: string;
  onChange: (url: string) => void;
  sizeNote: string;
  label?: string;
}
function ImageUploader({ value, onChange, sizeNote, label = 'Hình ảnh' }: ImageUploaderProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [urlMode, setUrlMode] = useState(false);
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      onChange(await uploadImageAsset(file));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không upload được ảnh.');
    } finally {
      e.target.value = '';
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{label}</label>
        <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded font-mono">📐 {sizeNote}</span>
      </div>
      {value && (
        <div className="relative w-full h-36 overflow-hidden rounded border border-slate-200 bg-slate-50">
          <img src={value} alt="preview" className="w-full h-full object-cover" />
          <button type="button" onClick={() => onChange('')}
            className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-red-500 transition">
            <X size={12} />
          </button>
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        <button type="button" onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 bg-slate-800 text-white text-xs font-semibold px-3 py-2 rounded hover:bg-slate-700 transition">
          <ImagePlus size={14} /> Upload ảnh
        </button>
        <button type="button" onClick={() => setUrlMode((v) => !v)}
          className="inline-flex items-center gap-1.5 border border-slate-300 text-slate-600 text-xs font-semibold px-3 py-2 rounded hover:border-slate-500 transition">
          {urlMode ? 'Đóng URL' : '🔗 Dán URL'}
        </button>
        {value && <a href={value} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 underline py-2">Xem ↗</a>}
      </div>
      {urlMode && <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="https://..." className="text-xs font-mono" />}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

/* ── CompactImagePicker (thumbnail nhỏ gọn – dùng trong card lists) ── */
type PicShape = 'square' | 'portrait' | 'landscape';
interface CompactImagePickerProps {
  value: string; onChange: (url: string) => void;
  shape?: PicShape; sizeNote?: string;
}
function CompactImagePicker({ value, onChange, shape = 'square', sizeNote }: CompactImagePickerProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [urlMode, setUrlMode] = useState(false);
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      onChange(await uploadImageAsset(file));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không upload được ảnh.');
    } finally {
      e.target.value = '';
    }
  }
  const boxCls = shape === 'square'
    ? 'w-16 h-16 rounded-full'
    : shape === 'portrait'
    ? 'w-20 h-24 rounded-lg'
    : 'w-28 h-18 rounded-lg';

  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      {/* Thumbnail preview */}
      <div className={`${boxCls} relative overflow-hidden border-2 border-slate-200 bg-slate-100 flex items-center justify-center flex-shrink-0`}
        style={shape === 'landscape' ? { height: '72px', width: '108px' } : {}}>
        {value
          ? <>
              <img src={value} alt="preview" className="w-full h-full object-cover" />
              <button type="button" onClick={() => onChange('')}
                className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-red-500 transition">
                <X size={10} />
              </button>
            </>
          : <ImagePlus size={20} className="text-slate-300" />
        }
      </div>
      {/* Buttons */}
      <button type="button" onClick={() => fileRef.current?.click()}
        className="text-[11px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded transition whitespace-nowrap">
        Upload
      </button>
      <button type="button" onClick={() => setUrlMode((v) => !v)}
        className="text-[11px] text-slate-400 hover:text-slate-600 transition">
        URL
      </button>
      {sizeNote && <span className="text-[10px] text-slate-300 text-center leading-tight">{sizeNote}</span>}
      {urlMode && (
        <Input value={value} onChange={(e) => onChange(e.target.value)}
          placeholder="https://..." className="text-[11px] font-mono w-28 mt-1" />
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

/* ── PhotoPickerButton (nút Upload nhỏ dùng trong overlay card grid) ── */
function PhotoPickerButton({ onFile, onUrl }: { onFile: (url: string) => void; onUrl: (url: string) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [urlMode, setUrlMode] = useState(false);
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      onFile(await uploadImageAsset(file));
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Không upload được ảnh.');
    } finally {
      e.target.value = '';
    }
  }
  return (
    <>
      <div className="flex gap-1">
        <button type="button" onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1 bg-white/90 text-slate-800 text-[11px] font-bold px-2 py-1 rounded hover:bg-white transition">
          <ImagePlus size={12} /> Upload
        </button>
        <button type="button" onClick={() => setUrlMode((v) => !v)}
          className="inline-flex items-center bg-white/60 text-slate-700 text-[11px] font-bold px-2 py-1 rounded hover:bg-white/90 transition">
          URL
        </button>
      </div>
      {urlMode && (
        <div className="absolute bottom-full left-0 right-0 mb-1 px-2">
          <Input onChange={(e) => { onUrl(e.target.value); setUrlMode(false); }}
            placeholder="https://..." className="text-xs font-mono h-7 bg-white shadow" autoFocus />
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </>
  );
}

/* ── helpers ─────────────────────────────────────────────────────────── */
function parseArr<T>(json: string | undefined, fallback: T[]): T[] {
  if (!json) return fallback;
  try { const v = JSON.parse(json); return Array.isArray(v) ? v : fallback; }
  catch { return fallback; }
}
function Label({ children }: { children: React.ReactNode }) {
  return <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">{children}</label>;
}
function FieldCol({ children, span2 = false }: { children: React.ReactNode; span2?: boolean }) {
  return <div className={span2 ? 'md:col-span-2' : ''}>{children}</div>;
}

async function resizeToDataUrl(file: File, maxWidth = 1600, quality = 0.82): Promise<string> {
  const imageUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = imageUrl;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Không đọc được ảnh.'));
    });

    const ratio = Math.min(1, maxWidth / image.width);
    const width = Math.round(image.width * ratio);
    const height = Math.round(image.height * ratio);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');
    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function uploadImageAsset(file: File): Promise<string> {
  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (cloudName && uploadPreset) {
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', uploadPreset);
    form.append('folder', 'metta-cms');
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) throw new Error('Upload Cloudinary không thành công.');
    const data = await response.json() as { secure_url?: string };
    if (!data.secure_url) throw new Error('Cloudinary không trả về URL ảnh.');
    return data.secure_url;
  }

  return resizeToDataUrl(file);
}

/* ── Hero Slider editor ─────────────────────────────────────────────── */
type HeroSlide = { url: string };
type HeroSliderData = { slides: HeroSlide[]; interval?: number };

function parseHeroData(value: string): HeroSliderData {
  if (!value) return { slides: [{ url: '' }], interval: 4 };
  try {
    const parsed = JSON.parse(value);
    // Backward compat: old format was HeroSlide[] array
    if (Array.isArray(parsed)) return { slides: parsed, interval: 4 };
    return { slides: parsed.slides || [{ url: '' }], interval: parsed.interval ?? 4 };
  } catch { return { slides: [{ url: '' }], interval: 4 }; }
}

function HeroSliderEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [data, setData] = useState<HeroSliderData>(() => parseHeroData(value));
  const items = data.slides;
  const interval = data.interval ?? 4;

  function sync(next: HeroSlide[], newInterval?: number) {
    const updated = { slides: next, interval: newInterval ?? interval };
    setData(updated);
    onChange(JSON.stringify(updated));
  }
  function setInterval2(val: number) {
    const updated = { slides: items, interval: val };
    setData(updated);
    onChange(JSON.stringify(updated));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        {items.map((item, i) => (
          <div key={i} className="relative bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl overflow-hidden aspect-[4/5]">
            {item.url
              ? <img src={item.url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-300">
                  <ImagePlus size={28} />
                  <span className="text-[10px]">Ảnh {i + 1}</span>
                </div>
            }
            {/* Overlay controls */}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2 flex gap-1 justify-between items-end">
              <PhotoPickerButton
                onFile={(url) => sync(items.map((it, idx) => idx === i ? { url } : it))}
                onUrl={(url) => sync(items.map((it, idx) => idx === i ? { url } : it))}
              />
              {item.url && (
                <button type="button"
                  onClick={() => sync(items.map((it, idx) => idx === i ? { url: '' } : it))}
                  className="text-white/70 hover:text-red-400 transition"><X size={14} /></button>
              )}
            </div>
            {/* Remove slide */}
            <button type="button" onClick={() => sync(items.filter((_, idx) => idx !== i))}
              className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-red-500 transition">
              <X size={11} />
            </button>
            <span className="absolute top-1 left-1 bg-black/50 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
              {i + 1}
            </span>
          </div>
        ))}
        {/* Add slide button */}
        <button type="button" onClick={() => sync([...items, { url: '' }])}
          className="aspect-[4/5] border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-cta-orange hover:text-cta-orange transition">
          <Plus size={24} />
          <span className="text-xs font-semibold">Thêm ảnh</span>
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-500">Tự động chuyển ảnh mỗi</span>
        <input
          type="number"
          min={1}
          max={15}
          step={0.5}
          value={interval}
          onChange={(e) => setInterval2(Number(e.target.value))}
          className="w-16 text-center text-[12px] font-semibold border border-slate-300 rounded-md px-1.5 py-1 focus:border-cta-orange focus:ring-1 focus:ring-cta-orange/30 outline-none"
        />
        <span className="text-[11px] text-slate-500">giây • Tự động lướt từ phải sang trái</span>
      </div>
    </div>
  );
}

/* ── Stats structured editor ────────────────────────────────────────── */
type StatItem = { number: string; label: string };
function StatsEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [items, setItems] = useState<StatItem[]>(() =>
    parseArr<StatItem>(value, [{ number: '', label: '' }])
  );
  function sync(next: StatItem[]) { setItems(next); onChange(JSON.stringify(next)); }
  function update(i: number, field: keyof StatItem, v: string) {
    const next = items.map((item, idx) => idx === i ? { ...item, [field]: v } : item);
    sync(next);
  }
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-center bg-slate-50 p-3 rounded border border-slate-200">
          <div className="flex-1">
            <Label>Số liệu (VD: 5.000+)</Label>
            <Input value={item.number} onChange={(e) => update(i, 'number', e.target.value)} placeholder="5.000+" />
          </div>
          <div className="flex-1">
            <Label>Nhãn</Label>
            <Input value={item.label} onChange={(e) => update(i, 'label', e.target.value)} placeholder="Học viên tốt nghiệp" />
          </div>
          <button type="button" onClick={() => sync(items.filter((_, idx) => idx !== i))}
            className="mt-5 text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
        </div>
      ))}
      <button type="button" onClick={() => sync([...items, { number: '', label: '' }])}
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-semibold w-fit">
        <Plus size={13} /> Thêm số liệu
      </button>
    </div>
  );
}

/* ── Benefits structured editor ─────────────────────────────────────── */
type BenefitItem = { icon: string; color: string; title: string; desc: string };
const MATERIAL_ICON_OPTIONS = [
  { name: 'school', label: 'Trường học' },
  { name: 'groups', label: 'Nhóm học viên' },
  { name: 'rocket_launch', label: 'Tăng tốc' },
  { name: 'psychology', label: 'Tư duy' },
  { name: 'dashboard', label: 'Dashboard' },
  { name: 'monitoring', label: 'Theo dõi' },
  { name: 'star', label: 'Nổi bật' },
  { name: 'favorite', label: 'Yêu thích' },
  { name: 'verified', label: 'Xác thực' },
  { name: 'workspace_premium', label: 'Chứng nhận' },
  { name: 'emoji_events', label: 'Thành tích' },
  { name: 'support_agent', label: 'Tư vấn' },
  { name: 'abc', label: 'Chữ cái' },
  { name: 'menu_book', label: 'Sách' },
  { name: 'calculate', label: 'Tính toán' },
  { name: 'category', label: 'Phân loại' },
  { name: 'auto_stories', label: 'Câu chuyện' },
  { name: 'draw', label: 'Sáng tạo' },
];
const COLOR_OPTIONS = [
  { label: 'Cam', value: 'text-cta-orange' },
  { label: 'Xanh dương', value: 'text-accent-cyan' },
  { label: 'Navy', value: 'text-navy-deep' },
  { label: 'Cyan card', value: '#0EA5E9' },
  { label: 'Orange card', value: '#F45A0A' },
  { label: 'Green card', value: '#16A34A' },
  { label: 'Purple card', value: '#8B5CF6' },
  { label: 'Pink card', value: '#EC4899' },
  { label: 'Amber card', value: '#F59E0B' },
];

function benefitColor(value: string) {
  if (value?.startsWith('#')) return value;
  if (value?.includes('cta-orange')) return '#F45A0A';
  if (value?.includes('accent-cyan')) return '#16A9D8';
  return '#003B7A';
}

function MaterialIconPicker({ value, onChange, color = '#003B7A' }: { value: string; onChange: (value: string) => void; color?: string }) {
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {MATERIAL_ICON_OPTIONS.map((option) => {
        const selected = value === option.name;
        return (
          <button
            key={option.name}
            type="button"
            title={`${option.label} (${option.name})`}
            onClick={() => onChange(option.name)}
            className={`flex min-h-[58px] flex-col items-center justify-center rounded-lg border px-1.5 py-2 text-center transition ${selected ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
          >
            <span className="material-symbols-outlined text-[22px]" style={{ color: selected ? undefined : color }}>{option.name}</span>
            <span className="mt-1 max-w-full truncate text-[10px] font-semibold leading-tight">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function BenefitsEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [items, setItems] = useState<BenefitItem[]>(() =>
    parseArr<BenefitItem>(value, [{ icon: 'school', color: 'text-cta-orange', title: '', desc: '' }])
  );
  function sync(next: BenefitItem[]) { setItems(next); onChange(JSON.stringify(next)); }
  function update(i: number, field: keyof BenefitItem, v: string) {
    sync(items.map((item, idx) => idx === i ? { ...item, [field]: v } : item));
  }
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Mục {i + 1}</span>
            <button type="button" onClick={() => sync(items.filter((_, idx) => idx !== i))}
              className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
          </div>
          <div
            className="relative overflow-hidden rounded-xl p-4 text-white"
            style={{ backgroundColor: benefitColor(item.color) }}
          >
            <div className="absolute -right-4 -top-4 h-14 w-14 rounded-full bg-white/12" />
            <div className="relative flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/20">
                <span className="material-symbols-outlined text-[22px] text-white">{item.icon || 'star'}</span>
              </div>
              <div>
                <p className="text-sm font-extrabold">{item.title || 'Tiêu đề lý do'}</p>
                <p className="mt-1 text-xs leading-5 text-white/80">{item.desc || 'Mô tả ngắn cho lý do chọn METTA.'}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Icon (Material Symbols)</Label>
              <MaterialIconPicker value={item.icon || 'school'} color={benefitColor(item.color)} onChange={(icon) => update(i, 'icon', icon)} />
            </div>
            <div>
              <Label>Màu icon</Label>
              <Select value={item.color} onChange={(e) => update(i, 'color', e.target.value)} className="text-xs">
                {COLOR_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <Label>Tiêu đề</Label>
            <Input value={item.title} onChange={(e) => update(i, 'title', e.target.value)} placeholder="Giáo trình chuẩn quốc tế" />
          </div>
          <div>
            <Label>Mô tả ngắn</Label>
            <Textarea value={item.desc} onChange={(e) => update(i, 'desc', e.target.value)} placeholder="Mô tả chi tiết..." className="h-16 text-sm" />
          </div>
        </div>
      ))}
      <button type="button" onClick={() => sync([...items, { icon: 'school', color: 'text-cta-orange', title: '', desc: '' }])}
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-semibold w-fit">
        <Plus size={13} /> Thêm lý do
      </button>
    </div>
  );
}

/* ── Testimonials structured editor ─────────────────────────────────── */
type TestimonialItem = { name: string; role: string; quote: string; avatar: string };
function TestimonialsEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [items, setItems] = useState<TestimonialItem[]>(() =>
    parseArr<TestimonialItem>(value, [{ name: '', role: '', quote: '', avatar: '' }])
  );
  function sync(next: TestimonialItem[]) { setItems(next); onChange(JSON.stringify(next)); }
  function update(i: number, field: keyof TestimonialItem, v: string) {
    sync(items.map((item, idx) => idx === i ? { ...item, [field]: v } : item));
  }
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
        /* Horizontal card: avatar circle bên trái, fields bên phải */
        <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex gap-4 items-start">
          {/* Avatar compact */}
          <CompactImagePicker
            value={item.avatar} onChange={(v) => update(i, 'avatar', v)}
            shape="square" sizeNote="80×80px" />

          {/* Fields */}
          <div className="flex-1 flex flex-col gap-2 min-w-0">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Đánh giá {i + 1}</span>
              <button type="button" onClick={() => sync(items.filter((_, idx) => idx !== i))}
                className="text-red-400 hover:text-red-600"><Trash2 size={13} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Họ tên</Label>
                <Input value={item.name} onChange={(e) => update(i, 'name', e.target.value)} placeholder="Chị Nguyễn Thanh Hà" className="text-sm" />
              </div>
              <div>
                <Label>Vai trò / lớp học</Label>
                <Input value={item.role} onChange={(e) => update(i, 'role', e.target.value)} placeholder="Phụ huynh bé An – Lớp Kiddies" className="text-sm" />
              </div>
            </div>
            <div>
              <Label>Nội dung đánh giá</Label>
              <Textarea value={item.quote} onChange={(e) => update(i, 'quote', e.target.value)}
                placeholder="Nhập lời đánh giá..." className="h-16 text-sm" />
            </div>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => sync([...items, { name: '', role: '', quote: '', avatar: '' }])}
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-semibold w-fit">
        <Plus size={13} /> Thêm đánh giá
      </button>
    </div>
  );
}

/* ── Teachers structured editor ─────────────────────────────────────── */
type TeacherItem = { name: string; role: string; exp: string; nationality: string; photo: string };
function TeachersEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [items, setItems] = useState<TeacherItem[]>(() =>
    parseArr<TeacherItem>(value, [{ name: '', role: '', exp: '', nationality: '', photo: '' }])
  );
  function sync(next: TeacherItem[]) { setItems(next); onChange(JSON.stringify(next)); }
  function update(i: number, field: keyof TeacherItem, v: string) {
    sync(items.map((item, idx) => idx === i ? { ...item, [field]: v } : item));
  }
  return (
    <div className="flex flex-col gap-3">
      {/* Grid 2 cột – mỗi card dạng dọc như trên web */}
      <div className="grid grid-cols-2 gap-3">
        {items.map((item, i) => (
          <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            {/* Photo area – portrait thumbnail full width */}
            <div className="relative w-full aspect-[4/5] bg-slate-200 flex-shrink-0">
              {item.photo
                ? <img src={item.photo} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-slate-300">
                    <ImagePlus size={28} />
                    <span className="text-[10px]">400 × 500 px</span>
                  </div>
              }
              {/* Overlay buttons */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2 flex gap-1 justify-between items-end">
                <PhotoPickerButton onFile={(url) => update(i, 'photo', url)} onUrl={(url) => update(i, 'photo', url)} />
                {item.photo && (
                  <button type="button" onClick={() => update(i, 'photo', '')}
                    className="text-white/70 hover:text-red-400 transition"><X size={14} /></button>
                )}
              </div>
              {/* Delete card */}
              <button type="button" onClick={() => sync(items.filter((_, idx) => idx !== i))}
                className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-red-500 transition">
                <X size={12} />
              </button>
              <span className="absolute top-1.5 left-1.5 bg-black/50 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                GV {i + 1}
              </span>
            </div>
            {/* Fields */}
            <div className="flex flex-col gap-2 p-2.5">
              <div>
                <Label>Họ tên</Label>
                <Input value={item.name} onChange={(e) => update(i, 'name', e.target.value)} placeholder="Ms. Sarah Johnson" className="text-xs h-8" />
              </div>
              <div>
                <Label>Chức danh</Label>
                <Input value={item.role} onChange={(e) => update(i, 'role', e.target.value)} placeholder="Head of Academics" className="text-xs h-8" />
              </div>
              <div>
                <Label>Kinh nghiệm / chứng chỉ</Label>
                <Input value={item.exp} onChange={(e) => update(i, 'exp', e.target.value)} placeholder="CELTA | 8 năm" className="text-xs h-8" />
              </div>
              <div>
                <Label>Quốc tịch</Label>
                <Input value={item.nationality} onChange={(e) => update(i, 'nationality', e.target.value)} placeholder="🇬🇧 British" className="text-xs h-8" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => sync([...items, { name: '', role: '', exp: '', nationality: '', photo: '' }])}
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-semibold w-fit">
        <Plus size={13} /> Thêm giáo viên
      </button>
    </div>
  );
}

/* ── News structured editor ─────────────────────────────────────────── */
type NewsItem = { title: string; date: string; category: string; image: string; excerpt: string; link: string };
function NewsEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [items, setItems] = useState<NewsItem[]>(() =>
    parseArr<NewsItem>(value, [{ title: '', date: '', category: '', image: '', excerpt: '', link: '' }])
  );
  function sync(next: NewsItem[]) { setItems(next); onChange(JSON.stringify(next)); }
  function update(i: number, field: keyof NewsItem, v: string) {
    sync(items.map((item, idx) => idx === i ? { ...item, [field]: v } : item));
  }
  return (
    <div className="flex flex-col gap-3">
      {/* Grid 3 cột – mỗi card bài viết dạng landscape thumbnail trên */}
      <div className="grid grid-cols-3 gap-3">
        {items.map((item, i) => (
          <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            {/* Image thumbnail landscape */}
            <div className="relative w-full aspect-[3/2] bg-slate-200 flex-shrink-0">
              {item.image
                ? <img src={item.image} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-300">
                    <ImagePlus size={24} />
                    <span className="text-[10px]">600 × 400 px</span>
                  </div>
              }
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 flex gap-1 justify-between items-end">
                <PhotoPickerButton onFile={(url) => update(i, 'image', url)} onUrl={(url) => update(i, 'image', url)} />
                {item.image && (
                  <button type="button" onClick={() => update(i, 'image', '')}
                    className="text-white/70 hover:text-red-400 transition"><X size={12} /></button>
                )}
              </div>
              <button type="button" onClick={() => sync(items.filter((_, idx) => idx !== i))}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-red-500 transition">
                <X size={11} />
              </button>
              <span className="absolute top-1 left-1 bg-black/50 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                #{i + 1}
              </span>
            </div>
            {/* Fields */}
            <div className="flex flex-col gap-2 p-2.5">
              <div>
                <Label>Tiêu đề</Label>
                <Textarea value={item.title} onChange={(e) => update(i, 'title', e.target.value)}
                  placeholder="Khai giảng tháng 6..." className="text-xs h-14 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <Label>Ngày đăng</Label>
                  <Input value={item.date} onChange={(e) => update(i, 'date', e.target.value)} placeholder="01/06/2026" className="text-xs h-8" />
                </div>
                <div>
                  <Label>Danh mục</Label>
                  <Input value={item.category} onChange={(e) => update(i, 'category', e.target.value)} placeholder="Tin tức" className="text-xs h-8" />
                </div>
              </div>
              <div>
                <Label>Mô tả ngắn</Label>
                <Textarea value={item.excerpt} onChange={(e) => update(i, 'excerpt', e.target.value)}
                  placeholder="Tóm tắt..." className="h-14 text-xs resize-none" />
              </div>
              <div>
                <Label>Link bài viết</Label>
                <Input value={item.link} onChange={(e) => update(i, 'link', e.target.value)}
                  placeholder="https://... hoặc /blog/ten-bai" className="text-xs h-8 font-mono" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => sync([...items, { title: '', date: '', category: '', image: '', excerpt: '', link: '' }])}
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-semibold w-fit">
        <Plus size={13} /> Thêm bài viết
      </button>
    </div>
  );
}

/* ── Facilities (Cơ sở vật chất) structured editor ──────────────────── */
type FacilityItem = { src: string; alt: string; title: string };

function facilitySizeHint(i: number) {
  return i === 0 ? '1600 × 1000 px · ngang (ảnh lớn)' : '800 × 600 px · ngang';
}

function FacilitiesEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [items, setItems] = useState<FacilityItem[]>(() =>
    parseArr<FacilityItem>(value, [
      { src: '/images/facilities/facility-1.jpg', alt: 'Phòng học hiện đại tại METTA Academy', title: '' },
      { src: '/images/facilities/facility-2.jpg', alt: 'Toà nhà METTA Academy', title: '' },
      { src: '/images/facilities/facility-3.jpg', alt: 'Khu vực lễ tân METTA Academy', title: '' },
    ]),
  );
  function sync(next: FacilityItem[]) { setItems(next); onChange(JSON.stringify(next)); }
  function update(i: number, field: keyof FacilityItem, v: string) {
    sync(items.map((item, idx) => (idx === i ? { ...item, [field]: v } : item)));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-500 bg-blue-50 border border-blue-200 rounded p-3">
        Bố cục <strong>3 ảnh</strong>: ảnh 1 lớn nổi bật bên trái, 2 ảnh nhỏ xếp bên phải. Để trống ô <strong>Caption</strong> nếu không muốn hiện chữ trên ảnh.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((item, i) => (
          <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            {/* Image thumbnail */}
            <div className="relative w-full aspect-[16/10] bg-slate-200 flex-shrink-0">
              {item.src
                ? <img src={item.src} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-300">
                    <ImagePlus size={24} />
                    <span className="text-[10px] text-center px-2">{facilitySizeHint(i)}</span>
                  </div>
              }
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 flex gap-1 justify-between items-end">
                <PhotoPickerButton onFile={(url) => update(i, 'src', url)} onUrl={(url) => update(i, 'src', url)} />
                {item.src && (
                  <button type="button" onClick={() => update(i, 'src', '')}
                    className="text-white/70 hover:text-red-400 transition"><X size={12} /></button>
                )}
              </div>
              <button type="button" onClick={() => sync(items.filter((_, idx) => idx !== i))}
                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-red-500 transition">
                <X size={12} />
              </button>
              <span className="absolute top-1 left-1 bg-black/50 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                #{i + 1}{i === 0 && ' · Lớn'}
              </span>
            </div>
            {/* Fields */}
            <div className="flex flex-col gap-2 p-2.5">
              <span className="text-[10px] font-mono text-slate-400">📐 {facilitySizeHint(i)}</span>
              <div>
                <Label>Caption (tuỳ chọn)</Label>
                <Input value={item.title} onChange={(e) => update(i, 'title', e.target.value)} placeholder="VD: Phòng học hiện đại" className="text-xs h-8" />
              </div>
              <div>
                <Label>Alt text (SEO)</Label>
                <Input value={item.alt} onChange={(e) => update(i, 'alt', e.target.value)} placeholder="Mô tả ảnh..." className="text-xs h-8" />
              </div>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={() => sync([...items, { src: '', alt: '', title: '' }])}
        className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-semibold w-fit">
        <Plus size={13} /> Thêm ảnh
      </button>
    </div>
  );
}

/* ── Ebook landing editors (Sách tiền tiểu học) ─────────────────────── */
function parseObj<T extends object>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    const v = JSON.parse(json);
    return v && typeof v === 'object' && !Array.isArray(v) ? { ...fallback, ...v } : fallback;
  } catch { return fallback; }
}

function StringListEditor({ label, hint, items, onChange, placeholder }: {
  label: string; hint?: string; items: string[]; onChange: (next: string[]) => void; placeholder?: string;
}) {
  return (
    <div>
      <Label>{label} {hint && <span className="text-slate-400 font-normal normal-case">— {hint}</span>}</Label>
      <div className="flex flex-col gap-2">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2">
            <Input value={it} onChange={(e) => onChange(items.map((x, idx) => (idx === i ? e.target.value : x)))} placeholder={placeholder} className="text-sm" />
            <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...items, ''])} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-semibold w-fit"><Plus size={13} /> Thêm dòng</button>
      </div>
    </div>
  );
}

function ImagesGridEditor({ label, images, onChange, sizeNote }: { label: string; images: string[]; onChange: (next: string[]) => void; sizeNote?: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label>{label} <span className="text-slate-400 font-normal normal-case">— nhiều ảnh sẽ tự thành slider</span></Label>
        {sizeNote && <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-mono whitespace-nowrap">📐 {sizeNote}</span>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {images.map((url, i) => (
          <div key={i} className="relative bg-slate-100 border-2 border-dashed border-slate-300 rounded-xl overflow-hidden aspect-[4/3]">
            {url
              ? <img src={url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-300"><ImagePlus size={24} /><span className="text-[10px] text-center px-1 leading-tight">{sizeNote || `Ảnh ${i + 1}`}</span></div>}
            <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent p-2 flex gap-1 justify-between items-end">
              <PhotoPickerButton onFile={(u) => onChange(images.map((x, idx) => (idx === i ? u : x)))} onUrl={(u) => onChange(images.map((x, idx) => (idx === i ? u : x)))} />
            </div>
            <button type="button" onClick={() => onChange(images.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-0.5 hover:bg-red-500 transition"><X size={11} /></button>
            <span className="absolute top-1 left-1 bg-black/50 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">{i + 1}</span>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...images, ''])} className="aspect-[4/3] border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-cta-orange hover:text-cta-orange transition"><Plus size={22} /><span className="text-xs font-semibold">Thêm ảnh</span></button>
      </div>
    </div>
  );
}

type EbookCard = { icon: string; title: string; desc: string; iconColor?: string; cardColor?: string; borderColor?: string };
const DEFAULT_EBOOK_CARD: EbookCard = { icon: 'star', title: '', desc: '' };
const EBOOK_COLOR_OPTIONS = [
  { value: '#F45A0A', label: 'Cam' },
  { value: '#16A34A', label: 'Xanh la' },
  { value: '#8B5CF6', label: 'Tim' },
  { value: '#F59E0B', label: 'Vang' },
  { value: '#0EA5E9', label: 'Cyan' },
  { value: '#EC4899', label: 'Hong' },
];

function ebookEditorCardColor(value: string | undefined, index: number) {
  const selected = EBOOK_COLOR_OPTIONS.find((item) => item.value === value);
  return selected?.value || EBOOK_COLOR_OPTIONS[index % EBOOK_COLOR_OPTIONS.length].value;
}

function EbookCardsEditor({ cards, onChange }: { cards: EbookCard[]; onChange: (next: EbookCard[]) => void }) {
  function update(i: number, field: keyof EbookCard, v: string) {
    onChange(cards.map((c, idx) => (idx === i ? { ...c, [field]: v } : c)));
  }
  return (
    <div>
      <Label>Cac nhom ky nang <span className="text-slate-400 font-normal normal-case">- chon icon va mau ca khung</span></Label>
      <div className="flex flex-col gap-2">
        {cards.map((c, i) => {
          const cardColor = ebookEditorCardColor(c.cardColor, i);
          return (
          <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Muc {i + 1}</span>
              <button type="button" onClick={() => onChange(cards.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
            <div className="relative overflow-hidden rounded-xl p-4 text-white" style={{ backgroundColor: cardColor }}>
              <div className="absolute -right-4 -top-4 h-14 w-14 rounded-full bg-white/12" />
              <div className="absolute -bottom-4 -left-4 h-12 w-12 rounded-full bg-white/12" />
              <div className="relative flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/20">
                  <span className="material-symbols-outlined text-[22px] text-white">{c.icon || 'star'}</span>
                </div>
                <div>
                  <p className="text-sm font-extrabold">{c.title || 'Tieu de ky nang'}</p>
                  <p className="mt-1 text-xs leading-5 text-white/80">{c.desc || 'Mo ta ngan cho nhom ky nang.'}</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Icon (Material Symbols)</Label>
                <MaterialIconPicker value={c.icon || 'star'} color={cardColor} onChange={(icon) => update(i, 'icon', icon)} />
              </div>
              <div>
                <Label>Mau khung</Label>
                <Select value={cardColor} onChange={(e) => update(i, 'cardColor', e.target.value)} className="text-xs">
                  {EBOOK_COLOR_OPTIONS.map((color) => <option key={color.value} value={color.value}>{color.label}</option>)}
                </Select>
              </div>
            </div>
            <div>
              <Label>Tieu de</Label>
              <Input value={c.title} onChange={(e) => update(i, 'title', e.target.value)} placeholder="Chu cai & am thanh" />
            </div>
            <div>
              <Label>Mo ta ngan</Label>
              <Textarea value={c.desc} onChange={(e) => update(i, 'desc', e.target.value)} placeholder="Sight words, doc hieu qua tranh." className="h-16 text-sm" />
            </div>
          </div>
          );
        })}
        <button type="button" onClick={() => onChange([...cards, { ...DEFAULT_EBOOK_CARD }])} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-semibold w-fit"><Plus size={13} /> Them ky nang</button>
      </div>
    </div>
  );
}
type HeroExtraData = {
  badges: string[];
  bullets: string[];
  titleAccent: string;
  formTitle: string;
  formSubtitle: string;
  formBadge: string;
  selectLabel: string;
  selectPlaceholder: string;
  selectOptions: string[];
  submitText: string;
};

function EbookHeroEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [data, setData] = useState<HeroExtraData>(() => parseObj(value, {
    badges: [], bullets: [], titleAccent: '',
    formTitle: '', formSubtitle: '', formBadge: '',
    selectLabel: '', selectPlaceholder: '',
    selectOptions: [], submitText: '',
  }));
  function sync(next: HeroExtraData) { setData(next); onChange(JSON.stringify(next)); }
  return (
    <div className="flex flex-col gap-4 bg-slate-50 border border-slate-200 rounded-xl p-3">
      <div>
        <Label>Phần headline màu cam <span className="text-slate-400 font-normal normal-case">— hiện xuống dòng, dưới phần trắng (Headline)</span></Label>
        <Input value={data.titleAccent} onChange={(e) => sync({ ...data, titleAccent: e.target.value })} placeholder="VD: Chinh Phục Tương Lai" />
      </div>
      <StringListEditor label="Badge (chip nhỏ)" items={data.badges} placeholder="VD: Dành cho bé 4–6 tuổi" onChange={(badges) => sync({ ...data, badges })} />
      <StringListEditor label="Gạch đầu dòng lợi ích" items={data.bullets} placeholder="VD: Giúp bé nhận diện chữ cái..." onChange={(bullets) => sync({ ...data, bullets })} />

      <div className="border-t border-slate-200 pt-3 mt-1">
        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-2">Form đăng ký bên cạnh sách</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label>Text nút gửi</Label>
            <Input value={data.submitText} onChange={(e) => sync({ ...data, submitText: e.target.value })} placeholder="Tải sách miễn phí" />
          </div>
          <FieldCol span2>
            <Label>Tiêu đề form</Label>
            <Input value={data.formTitle} onChange={(e) => sync({ ...data, formTitle: e.target.value })} placeholder="Nhận sách miễn phí ngay" />
          </FieldCol>
          <FieldCol span2>
            <Label>Mô tả nhỏ phía dưới tiêu đề</Label>
            <Textarea value={data.formSubtitle} onChange={(e) => sync({ ...data, formSubtitle: e.target.value })} className="h-14 text-sm" placeholder="METTA Academy sẽ gửi tài liệu và tư vấn..." />
          </FieldCol>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div>
            <Label>Nhãn dropdown <span className="text-slate-400 font-normal normal-case">— vd: "Độ tuổi của bé", "Lớp của bé"</span></Label>
            <Input value={data.selectLabel} onChange={(e) => sync({ ...data, selectLabel: e.target.value })} placeholder="Độ tuổi của bé" />
          </div>
          <div>
            <Label>Placeholder dropdown</Label>
            <Input value={data.selectPlaceholder} onChange={(e) => sync({ ...data, selectPlaceholder: e.target.value })} placeholder="Chọn độ tuổi" />
          </div>
        </div>
        <div className="mt-2">
          <StringListEditor label="Tuỳ chọn dropdown" hint="vd: Lớp 1, Lớp 2, Lớp 3, Lớp 4, Lớp 5" items={data.selectOptions} placeholder="VD: Lớp 1" onChange={(selectOptions) => sync({ ...data, selectOptions })} />
        </div>
      </div>
    </div>
  );
}

function EbookSkillsEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [data, setData] = useState(() => parseObj(value, { images: [] as string[], cards: [] as EbookCard[] }));
  function sync(next: typeof data) { setData(next); onChange(JSON.stringify(next)); }
  return (
    <div className="flex flex-col gap-4 bg-slate-50 border border-slate-200 rounded-xl p-3">
      <ImagesGridEditor label="Ảnh minh hoạ" images={data.images} onChange={(images) => sync({ ...data, images })} sizeNote="Ngang 4:3 · 1200×900px" />
      <EbookCardsEditor cards={data.cards} onChange={(cards) => sync({ ...data, cards })} />
    </div>
  );
}

function EbookWhyEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [data, setData] = useState(() => parseObj(value, { points: [] as string[], images: [] as string[] }));
  function sync(next: typeof data) { setData(next); onChange(JSON.stringify(next)); }
  return (
    <div className="flex flex-col gap-4 bg-slate-50 border border-slate-200 rounded-xl p-3">
      <StringListEditor label="Checklist lợi ích" items={data.points} placeholder="VD: Học nhẹ nhàng qua hình ảnh..." onChange={(points) => sync({ ...data, points })} />
      <ImagesGridEditor label="Ảnh xem trước sách" images={data.images} onChange={(images) => sync({ ...data, images })} sizeNote="Ngang 4:3 · 1200×900px" />
      <p className="text-[11px] text-slate-400">Để trống ảnh → hiển thị khung chờ kèm kích thước đề xuất.</p>
    </div>
  );
}

/* ── Section Editor ─────────────────────────────────────────────────── */
type MettaPlusColor = 'orange' | 'green' | 'purple' | 'yellow' | 'blue' | 'pink';
type MettaPlusIcon =
  | 'BadgeCheck' | 'Bot' | 'CalendarCheck' | 'CheckCircle2' | 'ChessPiece' | 'ClipboardList' | 'Compass'
  | 'FileBadge2' | 'GraduationCap' | 'Lightbulb' | 'Mic2' | 'Palette' | 'Rocket'
  | 'Send' | 'Sparkles' | 'Star' | 'Trophy' | 'Users';
type MettaPlusCard = { title: string; desc: string; icon: MettaPlusIcon; color: MettaPlusColor };
type MettaPlusSkill = { title: string; icon: MettaPlusIcon; color: MettaPlusColor };
type HeroTagItem = { label: string; color?: MettaPlusColor };
type MettaPlusHeroSlide = { src: string; title: string; alt?: string };
type MettaPlusVideoItem = { youtubeUrl: string; poster: string; title: string; caption?: string };
type MettaPlusTestimonial = { name: string; quote: string; image?: string; role?: string };
type MettaPlusOfferFields = {
  offerOriginalPrice?: number;
  offerSalePrice?: number;
  offerDiscountPercent?: number;
  offerCurrency?: string;
};
type MettaPlusWeeklyPlanExtra = {
  warmupNote?: string;
  warmupActivities?: string[];
  columns?: string[];
  rows?: string[][];
};
type MettaPlusData = {
  heroBadge: string;
  headline: string;
  subHeadline: string;
  shortDescription: string;
  heroTags: HeroTagItem[];
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  heroImage: string;
  heroImageAlt: string;
  skillsTitle: string;
  skillsDesc: string;
  skills: MettaPlusSkill[];
  benefitsTitle: string;
  benefitsDesc: string;
  benefits: MettaPlusCard[];
  agesTitle: string;
  agesDesc: string;
  ageGroups: MettaPlusCard[];
  passTitle: string;
  passDesc: string;
  passCardTitle: string;
  passCardMeta: string;
  passItems: string[];
  passCta: string;
  journeyTitle: string;
  journeyDesc: string;
  journey: MettaPlusCard[];
  reasonsTitle: string;
  reasonsDesc: string;
  reasons: MettaPlusCard[];
  videoTitle: string;
  videoDesc: string;
  videos: MettaPlusVideoItem[];
  testimonials: MettaPlusTestimonial[];
  formTitle: string;
  formDesc: string;
  formHighlights: string[];
  formCta: string;
  footerSubtitle: string;
  footerCta: string;
  offerOriginalPrice: number;
  offerSalePrice: number;
  offerDiscountPercent: number;
  offerCurrency: string;
};

const METTA_PLUS_ICON_OPTIONS: { name: MettaPlusIcon; label: string; Icon: LucideIcon }[] = [
  { name: 'Sparkles', label: 'Tỏa sáng', Icon: Sparkles },
  { name: 'Star', label: 'Nổi bật', Icon: Star },
  { name: 'Users', label: 'Nhóm', Icon: Users },
  { name: 'Bot', label: 'AI / Tech', Icon: Bot },
  { name: 'Mic2', label: 'Thanh nhạc', Icon: Mic2 },
  { name: 'Lightbulb', label: 'Ý tưởng', Icon: Lightbulb },
  { name: 'FileBadge2', label: 'Chứng nhận', Icon: FileBadge2 },
  { name: 'CalendarCheck', label: 'Lịch trình', Icon: CalendarCheck },
  { name: 'Palette', label: 'Mỹ thuật', Icon: Palette },
  { name: 'Rocket', label: 'Tăng tốc', Icon: Rocket },
  { name: 'GraduationCap', label: 'Học tập', Icon: GraduationCap },
  { name: 'ClipboardList', label: 'Checklist', Icon: ClipboardList },
  { name: 'ChessPiece', label: 'Cờ vua', Icon: ChessPieceIcon },
  { name: 'Compass', label: 'Tư duy', Icon: Compass },
  { name: 'Trophy', label: 'Thành tích', Icon: Trophy },
  { name: 'BadgeCheck', label: 'Tin cậy', Icon: BadgeCheck },
  { name: 'CheckCircle2', label: 'Hoàn thành', Icon: CheckCircle2 },
  { name: 'Send', label: 'Giao tiếp', Icon: Send },
];
const METTA_PLUS_COLOR_OPTIONS: { value: MettaPlusColor; label: string }[] = [
  { value: 'orange', label: 'Cam' },
  { value: 'green', label: 'Xanh lá' },
  { value: 'purple', label: 'Tím' },
  { value: 'yellow', label: 'Vàng' },
  { value: 'blue', label: 'Xanh dương' },
  { value: 'pink', label: 'Hồng' },
];

function normalizeForSearch(value = '') {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function normalizeMettaPlusChessIcon(cards: MettaPlusCard[]) {
  return cards.map((card) => {
    const isChessCard = normalizeForSearch(card.title).includes('co vua');
    return isChessCard && card.icon === 'Compass' ? { ...card, icon: 'ChessPiece' as MettaPlusIcon } : card;
  });
}

function normalizeMettaPlusVideos(videos: MettaPlusVideoItem[]) {
  return videos.filter((video) => {
    const isLegacySecondaryPlaceholder =
      !video.youtubeUrl?.trim() &&
      video.poster === '/brand/workshop-kids.jpg' &&
      normalizeForSearch(video.title).includes('khong khi lop hoc');
    return !isLegacySecondaryPlaceholder;
  });
}

function normalizeMettaPlusTestimonials(testimonials: MettaPlusTestimonial[]) {
  return testimonials.filter((item) => {
    const normalizedQuote = normalizeForSearch(item.quote);
    const isLegacyPlaceholder =
      normalizeForSearch(item.name).includes('dang cap nhat') &&
      normalizedQuote.includes('metta se cap nhat');
    return !isLegacyPlaceholder;
  });
}

function MettaPlusIconPicker({ value, onChange }: { value: MettaPlusIcon; onChange: (value: MettaPlusIcon) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
      {METTA_PLUS_ICON_OPTIONS.map((option) => {
        const selected = value === option.name;
        const Icon = option.Icon;
        return (
          <button
            key={option.name}
            type="button"
            title={`${option.label} (${option.name})`}
            onClick={() => onChange(option.name)}
            className={`flex min-h-[56px] flex-col items-center justify-center rounded-lg border px-1.5 py-2 text-center transition ${selected ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'}`}
          >
            <Icon size={18} />
            <span className="mt-1 max-w-full truncate text-[10px] font-semibold leading-tight">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const DEFAULT_METTA_PLUS_HERO_SLIDES: MettaPlusHeroSlide[] = [
  { src: '/brand/metta-summer-hero-4x3.jpg', title: 'Mỹ thuật', alt: 'Học viên METTA Summer 2026 trong hoạt động mỹ thuật' },
  { src: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?auto=format&fit=crop&w=1200&q=80', title: 'Cờ vua', alt: 'Hoạt động cờ vua trong METTA Summer 2026' },
  { src: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=80', title: 'Thanh nhạc', alt: 'Hoạt động thanh nhạc trong METTA Summer 2026' },
  { src: 'https://images.unsplash.com/photo-1547153760-18fc86324498?auto=format&fit=crop&w=1200&q=80', title: 'Nhảy & Múa', alt: 'Hoạt động nhảy múa trong METTA Summer 2026' },
];

const DEFAULT_METTA_PLUS_WEEKLY_PLAN_EXTRA: Required<MettaPlusWeeklyPlanExtra> = {
  warmupNote: SUMMER_ENGLISH_WARMUP_NOTE,
  warmupActivities: [...SUMMER_ENGLISH_WARMUP_ACTIVITIES],
  columns: [...SUMMER_DEFAULTS.weeklyColumns],
  rows: SUMMER_DEFAULTS.weeklyPlan.map((row) => [...row]),
};

const DEFAULT_METTA_PLUS_PRICING: Required<MettaPlusPricingOffer> = {
  originalPrice: 2499000,
  salePrice: 1999000,
  discountPercent: 20,
  currency: 'VND',
};

const DEFAULT_METTA_PLUS_DATA: MettaPlusData = {
  heroBadge: 'METTA Summer 2026',
  headline: 'Mùa hè đa bộ môn để con khám phá và tỏa sáng',
  subHeadline: 'Chương trình hè 6 tuần cho trẻ 4–11 tuổi với Mỹ thuật, Cờ vua, Thanh nhạc, Nhảy & Múa.',
  shortDescription: '24 buổi học · 4 bộ môn · Showcase cuối khóa',
  heroTags: [
    { label: '4–11 tuổi', color: 'orange' },
    { label: '6 tuần', color: 'green' },
    { label: '24 buổi', color: 'blue' },
    { label: 'Showcase cuối khóa', color: 'purple' },
  ],
  heroPrimaryCta: 'Đăng ký ngay',
  heroSecondaryCta: 'Xem lộ trình hè',
  heroImage: '/brand/metta-summer-hero-4x3.jpg',
  heroImageAlt: 'Học viên METTA Summer 2026 trong hoạt động mùa hè',
  skillsTitle: 'METTA giúp ba mẹ giải tỏa nỗi lo về kỹ năng của con',
  skillsDesc: 'Mỗi nỗi lo của ba mẹ đều được METTA giải quyết bằng một năng lực con phát triển thật sau mùa hè.',
  skills: [
    { title: 'Tự tin giao tiếp tiếng Anh', icon: 'Send', color: 'orange' },
    { title: 'Tư duy phản xạ & logic', icon: 'Compass', color: 'blue' },
    { title: 'Kỹ năng làm việc nhóm', icon: 'Users', color: 'green' },
    { title: 'Tự tin trước đám đông', icon: 'Mic2', color: 'pink' },
    { title: 'Kỹ năng mềm & tự lập', icon: 'BadgeCheck', color: 'purple' },
    { title: 'Sáng tạo & biểu đạt', icon: 'Palette', color: 'yellow' },
  ],
  offerOriginalPrice: DEFAULT_METTA_PLUS_PRICING.originalPrice,
  offerSalePrice: DEFAULT_METTA_PLUS_PRICING.salePrice,
  offerDiscountPercent: DEFAULT_METTA_PLUS_PRICING.discountPercent,
  offerCurrency: DEFAULT_METTA_PLUS_PRICING.currency,
  benefitsTitle: 'Con nhận được gì trong mùa hè này?',
  benefitsDesc: 'Một chương trình hè cân bằng giữa nghệ thuật, tư duy, âm nhạc và vận động.',
  benefits: [
    { title: 'Mỹ thuật sáng tạo', desc: 'Vẽ, phối màu, thủ công và hoàn thiện sản phẩm trưng bày.', icon: 'Palette', color: 'orange' },
    { title: 'Cờ vua tư duy', desc: 'Làm quen luật chơi, nước đi và mini tournament vui vẻ.', icon: 'ChessPiece', color: 'blue' },
    { title: 'Thanh nhạc tự tin', desc: 'Luyện nhịp, phát âm, hơi thở và biểu diễn trước tập thể.', icon: 'Mic2', color: 'pink' },
    { title: 'Nhảy & Múa', desc: 'Rèn nhịp điệu, đội hình, phối hợp nhóm và biểu cảm sân khấu.', icon: 'Sparkles', color: 'green' },
    { title: 'Hoạt động tiếng Anh', desc: '10–15 phút đầu giờ với greeting, vocabulary và mini game.', icon: 'Users', color: 'purple' },
    { title: 'Showcase cuối khóa', desc: 'Con có sân khấu để trình diễn và chia sẻ thành quả với ba mẹ.', icon: 'Trophy', color: 'yellow' },
  ],
  agesTitle: 'Lộ trình phù hợp cho trẻ 4–11 tuổi',
  agesDesc: 'Nội dung được chia theo nhịp phát triển của trẻ mầm non và tiểu học.',
  ageGroups: [
    { title: 'Mầm non 4–6', desc: 'Hoạt động nhiều hình ảnh, âm nhạc, vận động và sản phẩm thủ công nhỏ.', icon: 'Star', color: 'orange' },
    { title: 'Tiểu học 6–8', desc: 'Tăng trải nghiệm theo nhóm, luyện nhịp, màu sắc, quân cờ và biểu diễn.', icon: 'Palette', color: 'green' },
    { title: 'Tiểu học 9–11', desc: 'Tăng thử thách kỹ thuật, tư duy chiến thuật và hoàn thiện tiết mục.', icon: 'Rocket', color: 'blue' },
    { title: 'Showcase Day', desc: 'Ráp tiết mục, trưng bày sản phẩm và biểu diễn trước phụ huynh.', icon: 'Trophy', color: 'purple' },
  ],
  passTitle: 'METTA Summer 2026 trên một landing page',
  passDesc: 'Tất cả thông tin chính của chương trình hè được gom gọn để phụ huynh xem nhanh và đăng ký ngay.',
  passCardTitle: 'Summer 2026',
  passCardMeta: '4–11 tuổi · 6 tuần · 24 buổi · 4 bộ môn',
  passItems: ['Mỹ thuật: màu sắc, hình khối, tranh và thủ công', 'Cờ vua: luật chơi, quan sát và mini tournament', 'Thanh nhạc: nhịp, hơi thở, phát âm và biểu diễn', 'Nhảy & Múa: động tác, đội hình và tương tác sân khấu', 'Showcase cuối khóa cùng phụ huynh'],
  passCta: 'Đăng ký ngay',
  journeyTitle: 'Lộ trình học 6 tuần',
  journeyDesc: 'Từ làm quen, phát triển kỹ năng đến hoàn thiện sản phẩm và biểu diễn.',
  journey: [
    { title: 'Tuần 1–2', desc: 'Khám phá chất liệu, bàn cờ, giọng hát và nhịp điệu cơ bản.', icon: 'ClipboardList', color: 'orange' },
    { title: 'Tuần 3–4', desc: 'Luyện kỹ thuật, hoàn thiện bài tập nhỏ và phối hợp theo nhóm.', icon: 'Compass', color: 'blue' },
    { title: 'Tuần 5', desc: 'Tổng duyệt sản phẩm, tiết mục và tinh thần trình diễn.', icon: 'CalendarCheck', color: 'green' },
    { title: 'Tuần 6', desc: 'Showcase cuối khóa, trưng bày, biểu diễn và nhận chứng nhận.', icon: 'Trophy', color: 'pink' },
  ],
  reasonsTitle: 'Vì sao phụ huynh chọn METTA Summer?',
  reasonsDesc: 'Lịch học rõ, bộ môn đa dạng, đầu ra có sản phẩm và sân khấu cho con.',
  reasons: [
    { title: 'Đa bộ môn', desc: 'Con thử nhiều năng khiếu trong một chương trình.', icon: 'Sparkles', color: 'blue' },
    { title: 'Lộ trình 6 tuần', desc: 'Mỗi tuần có mục tiêu học tập dễ theo dõi.', icon: 'BadgeCheck', color: 'green' },
    { title: 'Có sản phẩm thật', desc: 'Tranh, thủ công, tiết mục hát và bài nhảy.', icon: 'Lightbulb', color: 'yellow' },
    { title: 'Rèn tự tin', desc: 'Con luyện tương tác, biểu diễn và làm việc nhóm.', icon: 'Trophy', color: 'purple' },
    { title: 'Đăng ký nhanh', desc: 'Form và QR thanh toán ngay trên landing page.', icon: 'CheckCircle2', color: 'orange' },
  ],
  videoTitle: 'Video & Cảm nhận phụ huynh',
  videoDesc: 'Những khoảnh khắc lớp học và chia sẻ thật giúp ba mẹ hình dung rõ hơn về METTA Summer.',
  videos: [
    {
      youtubeUrl: '',
      poster: '/brand/metta-summer-hero-4x3.jpg',
      title: 'Ngày trải nghiệm 21/6',
      caption: 'Poster đã sẵn sàng. Dán link YouTube trong CMS để bật video facade.',
    },
  ],
  testimonials: [],
  formTitle: 'Đăng ký tư vấn METTA Summer 2026',
  formDesc: 'Để lại thông tin, METTA Academy sẽ tư vấn lớp hè phù hợp và hướng dẫn phụ huynh hoàn tất đăng ký.',
  formHighlights: ['Tư vấn lớp hè theo tuổi', 'Gửi lịch học chi tiết', 'Hỗ trợ đăng ký và thanh toán QR'],
  formCta: 'Đăng ký tư vấn',
  footerSubtitle: 'METTA Summer 2026',
  footerCta: 'Đăng ký ngay',
};

function MettaPlusCardsEditor({ label, cards, onChange }: { label: string; cards: MettaPlusCard[]; onChange: (next: MettaPlusCard[]) => void }) {
  function update(index: number, patch: Partial<MettaPlusCard>) {
    onChange(cards.map((card, i) => (i === index ? { ...card, ...patch } : card)));
  }
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex flex-col gap-2">
        {cards.map((card, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Card {index + 1}</span>
              <button type="button" onClick={() => onChange(cards.filter((_, i) => i !== index))} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div><Label>Tiêu đề</Label><Input value={card.title} onChange={(e) => update(index, { title: e.target.value })} /></div>
              <div><Label>Mô tả 1 dòng</Label><Input value={card.desc} onChange={(e) => update(index, { desc: e.target.value })} /></div>
              <div className="md:col-span-2"><Label>Icon</Label><MettaPlusIconPicker value={card.icon} onChange={(icon) => update(index, { icon })} /></div>
              <div><Label>Màu card</Label><Select value={card.color} onChange={(e) => update(index, { color: e.target.value as MettaPlusColor })}>{METTA_PLUS_COLOR_OPTIONS.map((color) => <option key={color.value} value={color.value}>{color.label}</option>)}</Select></div>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...cards, { title: 'Card mới', desc: 'Mô tả ngắn.', icon: 'Star', color: 'orange' }])} className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"><Plus size={13} /> Thêm card</button>
      </div>
    </div>
  );
}

function HeroTagsEditor({ label, items, onChange }: { label: string; items: HeroTagItem[]; onChange: (next: HeroTagItem[]) => void }) {
  function update(i: number, patch: Partial<HeroTagItem>) {
    onChange(items.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  }
  return (
    <div>
      <Label>{label} <span className="text-slate-400 font-normal normal-case">— chọn màu cho từng tag</span></Label>
      <div className="flex flex-col gap-2">
        {items.map((tag, i) => (
          <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded p-2">
            <Input value={tag.label} placeholder="VD: 4–11 tuổi" onChange={(e) => update(i, { label: e.target.value })} className="flex-1 text-sm" />
            <Select value={tag.color || 'orange'} onChange={(e) => update(i, { color: e.target.value as MettaPlusColor })} className="w-[120px] text-xs">
              {METTA_PLUS_COLOR_OPTIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </Select>
            <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...items, { label: '', color: 'orange' }])} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700 font-semibold w-fit">
          <Plus size={13} /> Thêm tag
        </button>
      </div>
    </div>
  );
}

function normalizeMettaPlusHeroSlides(slides?: MettaPlusHeroSlide[]) {
  const clean = Array.isArray(slides)
    ? slides
        .filter(Boolean)
        .map((slide) => ({
          src: slide.src || '',
          title: slide.title || '',
          alt: slide.alt || '',
        }))
    : [];
  return clean.length ? clean : DEFAULT_METTA_PLUS_HERO_SLIDES;
}

function MettaPlusHeroSlidesEditor({ slides, onChange }: { slides?: MettaPlusHeroSlide[]; onChange: (next: MettaPlusHeroSlide[]) => void }) {
  const items = normalizeMettaPlusHeroSlides(slides);
  const update = (index: number, patch: Partial<MettaPlusHeroSlide>) => {
    onChange(items.map((slide, i) => (i === index ? { ...slide, ...patch } : slide)));
  };
  const move = (index: number, direction: -1 | 1) => {
    const next = [...items];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div>
      <Label>Slider ảnh hero <span className="text-slate-400 font-normal normal-case">— preview 4:3, chỉnh được ảnh và chữ overlay</span></Label>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((slide, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-500">Slide {index + 1}</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => move(index, -1)} className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-50" aria-label="Đưa slide lên">
                  <ArrowUp size={13} />
                </button>
                <button type="button" onClick={() => move(index, 1)} className="rounded border border-slate-200 p-1 text-slate-500 hover:bg-slate-50" aria-label="Đưa slide xuống">
                  <ArrowDown size={13} />
                </button>
                <button type="button" onClick={() => onChange(items.filter((_, i) => i !== index))} className="rounded border border-red-100 p-1 text-red-400 hover:bg-red-50" aria-label="Xóa slide">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <CompactImagePicker
                value={slide.src}
                onChange={(src) => update(index, { src })}
                shape="landscape"
                sizeNote="4:3"
              />
              <div className="min-w-0 flex-1 space-y-2">
                <div>
                  <Label>Chữ trên ảnh</Label>
                  <Input value={slide.title} onChange={(e) => update(index, { title: e.target.value })} placeholder="VD: Mỹ thuật" className="text-sm" />
                </div>
                <div>
                  <Label>Alt ảnh</Label>
                  <Input value={slide.alt || ''} onChange={(e) => update(index, { alt: e.target.value })} placeholder="Mô tả ảnh" className="text-xs" />
                </div>
              </div>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...items, { src: '', title: 'Slide mới', alt: '' }])} className="min-h-[176px] rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 transition hover:border-cta-orange hover:text-cta-orange">
          <Plus size={22} className="mx-auto mb-2" />
          <span className="text-xs font-semibold">Thêm slide</span>
        </button>
      </div>
    </div>
  );
}

function normalizeMettaPlusWeeklyPlan(extra: MettaPlusWeeklyPlanExtra): Required<MettaPlusWeeklyPlanExtra> {
  const columns = extra.columns?.length ? extra.columns : DEFAULT_METTA_PLUS_WEEKLY_PLAN_EXTRA.columns;
  const sourceRows = extra.rows?.length ? extra.rows : DEFAULT_METTA_PLUS_WEEKLY_PLAN_EXTRA.rows;
  return {
    warmupNote: extra.warmupNote ?? DEFAULT_METTA_PLUS_WEEKLY_PLAN_EXTRA.warmupNote,
    warmupActivities: extra.warmupActivities?.length ? extra.warmupActivities : DEFAULT_METTA_PLUS_WEEKLY_PLAN_EXTRA.warmupActivities,
    columns,
    rows: sourceRows.map((row) => columns.map((_, index) => row[index] || '')),
  };
}

function MettaPlusWeeklyRowsEditor({
  columns,
  rows,
  onChange,
}: {
  columns: string[];
  rows: string[][];
  onChange: (next: string[][]) => void;
}) {
  const updateCell = (rowIndex: number, cellIndex: number, value: string) => {
    onChange(rows.map((row, i) => (i === rowIndex ? columns.map((_, j) => (j === cellIndex ? value : row[j] || '')) : row)));
  };

  return (
    <div>
      <Label>Nội dung từng tuần</Label>
      <div className="space-y-3">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Dòng {rowIndex + 1}</span>
              <button type="button" onClick={() => onChange(rows.filter((_, i) => i !== rowIndex))} className="text-red-400 hover:text-red-600">
                <Trash2 size={14} />
              </button>
            </div>
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: columns.map((_, index) => (index === 0 ? '92px' : 'minmax(160px, 1fr)')).join(' ') }}
            >
              {columns.map((column, cellIndex) => (
                <div key={`${rowIndex}-${cellIndex}`} className="min-w-0">
                  <Label>{column || `Cột ${cellIndex + 1}`}</Label>
                  {cellIndex === 0 ? (
                    <Input value={row[cellIndex] || ''} onChange={(e) => updateCell(rowIndex, cellIndex, e.target.value)} className="text-xs font-semibold" />
                  ) : (
                    <Textarea value={row[cellIndex] || ''} onChange={(e) => updateCell(rowIndex, cellIndex, e.target.value)} className="h-20 resize-none text-xs leading-5" />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...rows, columns.map((_, index) => (index === 0 ? `Tuần ${rows.length + 1}` : ''))])} className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700">
          <Plus size={13} /> Thêm dòng tuần
        </button>
      </div>
    </div>
  );
}

function MettaPlusEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [data, setData] = useState<MettaPlusData>(() => ({ ...DEFAULT_METTA_PLUS_DATA, ...parseObj(value, DEFAULT_METTA_PLUS_DATA) }));
  function sync(next: MettaPlusData) { setData(next); onChange(JSON.stringify(next)); }
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-orange-200 bg-orange-50/40 p-3">
      <div className="grid gap-3 md:grid-cols-2">
        <FieldCol><Label>Badge hero</Label><Input value={data.heroBadge} onChange={(e) => sync({ ...data, heroBadge: e.target.value })} /></FieldCol>
        <FieldCol><Label>CTA chính hero</Label><Input value={data.heroPrimaryCta} onChange={(e) => sync({ ...data, heroPrimaryCta: e.target.value })} /></FieldCol>
        <FieldCol span2><Label>Headline</Label><Textarea value={data.headline} onChange={(e) => sync({ ...data, headline: e.target.value })} className="h-16" /></FieldCol>
        <FieldCol span2><Label>Sub headline</Label><Textarea value={data.subHeadline} onChange={(e) => sync({ ...data, subHeadline: e.target.value })} className="h-16" /></FieldCol>
        <FieldCol span2><Label>Mô tả ngắn</Label><Input value={data.shortDescription} onChange={(e) => sync({ ...data, shortDescription: e.target.value })} /></FieldCol>
        <FieldCol><Label>CTA phụ hero</Label><Input value={data.heroSecondaryCta} onChange={(e) => sync({ ...data, heroSecondaryCta: e.target.value })} /></FieldCol>
        <FieldCol><Label>Alt ảnh hero</Label><Input value={data.heroImageAlt} onChange={(e) => sync({ ...data, heroImageAlt: e.target.value })} /></FieldCol>
      </div>
      <div className="grid gap-3 rounded-xl border border-orange-200 bg-white p-3 md:grid-cols-4">
        <FieldCol><Label>Giá gốc</Label><Input type="number" min={0} value={data.offerOriginalPrice} onChange={(e) => sync({ ...data, offerOriginalPrice: Number(e.target.value) })} /></FieldCol>
        <FieldCol><Label>Giá bán</Label><Input type="number" min={0} value={data.offerSalePrice} onChange={(e) => sync({ ...data, offerSalePrice: Number(e.target.value) })} /></FieldCol>
        <FieldCol><Label>% giảm</Label><Input type="number" min={0} value={data.offerDiscountPercent} onChange={(e) => sync({ ...data, offerDiscountPercent: Number(e.target.value) })} /></FieldCol>
        <FieldCol><Label>Tiền tệ</Label><Input value={data.offerCurrency} onChange={(e) => sync({ ...data, offerCurrency: e.target.value || DEFAULT_METTA_PLUS_PRICING.currency })} /></FieldCol>
      </div>
      <ImageUploader value={data.heroImage} onChange={(heroImage) => sync({ ...data, heroImage })} sizeNote="Hero ngang 4:3 · 1200 x 900 px" label="Ảnh hero bên phải" />
      <HeroTagsEditor label="Tag nhỏ hero" items={data.heroTags} onChange={(heroTags) => sync({ ...data, heroTags })} />
      <div className="grid gap-3 md:grid-cols-2">
        <FieldCol><Label>Tiêu đề section lợi ích</Label><Input value={data.benefitsTitle} onChange={(e) => sync({ ...data, benefitsTitle: e.target.value })} /></FieldCol>
        <FieldCol><Label>Mô tả section lợi ích</Label><Input value={data.benefitsDesc} onChange={(e) => sync({ ...data, benefitsDesc: e.target.value })} /></FieldCol>
      </div>
      <MettaPlusCardsEditor label="6 card: Con nhận được gì?" cards={data.benefits} onChange={(benefits) => sync({ ...data, benefits })} />
      <div className="grid gap-3 md:grid-cols-2">
        <FieldCol><Label>Tiêu đề section độ tuổi</Label><Input value={data.agesTitle} onChange={(e) => sync({ ...data, agesTitle: e.target.value })} /></FieldCol>
        <FieldCol><Label>Mô tả section độ tuổi</Label><Input value={data.agesDesc} onChange={(e) => sync({ ...data, agesDesc: e.target.value })} /></FieldCol>
      </div>
      <MettaPlusCardsEditor label="4 card: Nhóm tuổi / mốc lộ trình" cards={data.ageGroups} onChange={(ageGroups) => sync({ ...data, ageGroups })} />
      <div className="grid gap-3 md:grid-cols-2">
        <FieldCol><Label>Tiêu đề Summer</Label><Input value={data.passTitle} onChange={(e) => sync({ ...data, passTitle: e.target.value })} /></FieldCol>
        <FieldCol><Label>Mô tả Summer</Label><Input value={data.passDesc} onChange={(e) => sync({ ...data, passDesc: e.target.value })} /></FieldCol>
        <FieldCol><Label>Tên trên card Summer</Label><Input value={data.passCardTitle} onChange={(e) => sync({ ...data, passCardTitle: e.target.value })} /></FieldCol>
        <FieldCol><Label>Meta trên card Summer</Label><Input value={data.passCardMeta} onChange={(e) => sync({ ...data, passCardMeta: e.target.value })} /></FieldCol>
        <FieldCol span2><Label>CTA Summer</Label><Input value={data.passCta} onChange={(e) => sync({ ...data, passCta: e.target.value })} /></FieldCol>
      </div>
      <StringListEditor label="Checklist Summer" items={data.passItems} placeholder="VD: Mỹ thuật: màu sắc, hình khối, tranh và thủ công" onChange={(passItems) => sync({ ...data, passItems })} />
      <div className="grid gap-3 md:grid-cols-2">
        <FieldCol><Label>Tiêu đề hành trình</Label><Input value={data.journeyTitle} onChange={(e) => sync({ ...data, journeyTitle: e.target.value })} /></FieldCol>
        <FieldCol><Label>Mô tả hành trình</Label><Input value={data.journeyDesc} onChange={(e) => sync({ ...data, journeyDesc: e.target.value })} /></FieldCol>
      </div>
      <MettaPlusCardsEditor label="4 bước hành trình" cards={data.journey} onChange={(journey) => sync({ ...data, journey })} />
      <div className="grid gap-3 md:grid-cols-2">
        <FieldCol><Label>Tiêu đề vì sao chọn</Label><Input value={data.reasonsTitle} onChange={(e) => sync({ ...data, reasonsTitle: e.target.value })} /></FieldCol>
        <FieldCol><Label>Mô tả vì sao chọn</Label><Input value={data.reasonsDesc} onChange={(e) => sync({ ...data, reasonsDesc: e.target.value })} /></FieldCol>
      </div>
      <MettaPlusCardsEditor label="5 card: Vì sao phụ huynh chọn?" cards={data.reasons} onChange={(reasons) => sync({ ...data, reasons })} />
      <div className="grid gap-3 md:grid-cols-2">
        <FieldCol><Label>Tiêu đề form</Label><Input value={data.formTitle} onChange={(e) => sync({ ...data, formTitle: e.target.value })} /></FieldCol>
        <FieldCol><Label>CTA form</Label><Input value={data.formCta} onChange={(e) => sync({ ...data, formCta: e.target.value })} /></FieldCol>
        <FieldCol span2><Label>Mô tả form</Label><Textarea value={data.formDesc} onChange={(e) => sync({ ...data, formDesc: e.target.value })} className="h-16" /></FieldCol>
      </div>
      <StringListEditor label="Gạch đầu dòng cạnh form" items={data.formHighlights} placeholder="VD: Tư vấn CLB theo tuổi" onChange={(formHighlights) => sync({ ...data, formHighlights })} />
      <div className="grid gap-3 md:grid-cols-2">
        <FieldCol><Label>Footer subtitle</Label><Input value={data.footerSubtitle} onChange={(e) => sync({ ...data, footerSubtitle: e.target.value })} /></FieldCol>
        <FieldCol><Label>Footer CTA</Label><Input value={data.footerCta} onChange={(e) => sync({ ...data, footerCta: e.target.value })} /></FieldCol>
      </div>
    </div>
  );
}

type MettaPlusHeroExtra = MettaPlusOfferFields & { badge?: string; tags?: (string | HeroTagItem)[]; imageAlt?: string; slides?: MettaPlusHeroSlide[] };
type MettaPlusSkillsExtra = { skills?: MettaPlusSkill[] };
type MettaPlusPassExtra = { passCardTitle?: string; passCardMeta?: string; passItems?: string[] };
type MettaPlusFormExtra = { highlights?: string[] };
type MettaPlusVideoExtra = { videos?: MettaPlusVideoItem[]; testimonials?: MettaPlusTestimonial[] };

function MettaPlusHeroSectionEditor({ section, onChange }: { section: PageSection; onChange: (patch: Partial<PageSection>) => void }) {
  const extra = parseObj<MettaPlusHeroExtra>(section.extraData, {
    badge: 'METTA Summer 2026',
    tags: [],
    imageAlt: '',
    offerOriginalPrice: DEFAULT_METTA_PLUS_PRICING.originalPrice,
    offerSalePrice: DEFAULT_METTA_PLUS_PRICING.salePrice,
    offerDiscountPercent: DEFAULT_METTA_PLUS_PRICING.discountPercent,
    offerCurrency: DEFAULT_METTA_PLUS_PRICING.currency,
  });
  const syncExtra = (patch: Partial<MettaPlusHeroExtra>) => onChange({ extraData: JSON.stringify({ ...extra, ...patch }) });
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <FieldCol><Label>Badge nhỏ</Label><Input value={extra.badge || ''} onChange={(e) => syncExtra({ badge: e.target.value })} placeholder="METTA Summer 2026" /></FieldCol>
        <FieldCol><Label>CTA chính</Label><Input value={section.buttonText || ''} onChange={(e) => onChange({ buttonText: e.target.value })} /></FieldCol>
        <FieldCol span2><Label>Headline *</Label><Textarea value={section.title} onChange={(e) => onChange({ title: e.target.value })} className="h-16" /></FieldCol>
        <FieldCol span2><Label>Sub headline</Label><Textarea value={section.subtitle || ''} onChange={(e) => onChange({ subtitle: e.target.value })} className="h-16" /></FieldCol>
        <FieldCol span2><Label>Mô tả ngắn</Label><Input value={section.description || ''} onChange={(e) => onChange({ description: e.target.value })} /></FieldCol>
        <FieldCol><Label>CTA phụ</Label><Input value={section.button2Text || ''} onChange={(e) => onChange({ button2Text: e.target.value })} /></FieldCol>
        <FieldCol><Label>Alt ảnh hero</Label><Input value={extra.imageAlt || ''} onChange={(e) => syncExtra({ imageAlt: e.target.value })} /></FieldCol>
      </div>
      <div className="grid gap-3 rounded-xl border border-orange-200 bg-orange-50/40 p-3 md:grid-cols-4">
        <FieldCol><Label>Giá gốc</Label><Input type="number" min={0} value={extra.offerOriginalPrice ?? DEFAULT_METTA_PLUS_PRICING.originalPrice} onChange={(e) => syncExtra({ offerOriginalPrice: Number(e.target.value) })} /></FieldCol>
        <FieldCol><Label>Giá bán</Label><Input type="number" min={0} value={extra.offerSalePrice ?? DEFAULT_METTA_PLUS_PRICING.salePrice} onChange={(e) => syncExtra({ offerSalePrice: Number(e.target.value) })} /></FieldCol>
        <FieldCol><Label>% giảm</Label><Input type="number" min={0} value={extra.offerDiscountPercent ?? DEFAULT_METTA_PLUS_PRICING.discountPercent} onChange={(e) => syncExtra({ offerDiscountPercent: Number(e.target.value) })} /></FieldCol>
        <FieldCol><Label>Tiền tệ</Label><Input value={extra.offerCurrency || DEFAULT_METTA_PLUS_PRICING.currency} onChange={(e) => syncExtra({ offerCurrency: e.target.value || DEFAULT_METTA_PLUS_PRICING.currency })} /></FieldCol>
      </div>
      <ImageUploader value={section.imageUrl || ''} onChange={(imageUrl) => onChange({ imageUrl })} sizeNote="Hero ngang 4:3 · 1200 x 900 px" label="Ảnh hero bên phải" />
      <MettaPlusHeroSlidesEditor slides={extra.slides} onChange={(slides) => syncExtra({ slides })} />
      <HeroTagsEditor
        label="Tag nhỏ hero"
        items={(extra.tags || []).map((t) => typeof t === 'string' ? { label: t, color: 'orange' } : t)}
        onChange={(tags) => syncExtra({ tags })}
      />
    </>
  );
}

function MettaPlusCardsSectionEditor({
  section,
  label,
  fallback,
  onChange,
}: {
  section: PageSection;
  label: string;
  fallback: MettaPlusCard[];
  onChange: (patch: Partial<PageSection>) => void;
}) {
  const cards = normalizeMettaPlusChessIcon(parseArr<MettaPlusCard>(section.extraData, fallback));
  return (
    <>
      <FieldCol><Label>Tiêu đề section *</Label><Input value={section.title} onChange={(e) => onChange({ title: e.target.value })} /></FieldCol>
      <FieldCol><Label>Mô tả ngắn</Label><Input value={section.subtitle || section.description || ''} onChange={(e) => onChange({ subtitle: e.target.value, description: e.target.value })} /></FieldCol>
      <MettaPlusCardsEditor label={label} cards={cards} onChange={(next) => onChange({ extraData: JSON.stringify(next) })} />
    </>
  );
}

function MettaPlusSkillsEditor({ skills, onChange }: { skills: MettaPlusSkill[]; onChange: (next: MettaPlusSkill[]) => void }) {
  function update(index: number, patch: Partial<MettaPlusSkill>) {
    onChange(skills.map((skill, i) => (i === index ? { ...skill, ...patch } : skill)));
  }
  return (
    <div>
      <Label>Danh sách năng lực <span className="text-slate-400 font-normal normal-case">— mỗi mục chỉ hiển thị tên + icon</span></Label>
      <div className="flex flex-col gap-2">
        {skills.map((skill, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Năng lực {index + 1}</span>
              <button type="button" onClick={() => onChange(skills.filter((_, i) => i !== index))} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <div><Label>Tên năng lực</Label><Input value={skill.title} onChange={(e) => update(index, { title: e.target.value })} /></div>
              <div><Label>Màu card</Label><Select value={skill.color} onChange={(e) => update(index, { color: e.target.value as MettaPlusColor })}>{METTA_PLUS_COLOR_OPTIONS.map((color) => <option key={color.value} value={color.value}>{color.label}</option>)}</Select></div>
              <div className="md:col-span-2"><Label>Icon</Label><MettaPlusIconPicker value={skill.icon} onChange={(icon) => update(index, { icon })} /></div>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...skills, { title: 'Năng lực mới', icon: 'Star', color: 'orange' }])} className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"><Plus size={13} /> Thêm năng lực</button>
      </div>
    </div>
  );
}

function MettaPlusSkillsSectionEditor({ section, onChange }: { section: PageSection; onChange: (patch: Partial<PageSection>) => void }) {
  const extra = parseObj<MettaPlusSkillsExtra>(section.extraData, {
    skills: DEFAULT_METTA_PLUS_DATA.skills,
  });
  const skills = extra.skills?.length ? extra.skills : DEFAULT_METTA_PLUS_DATA.skills;
  const syncExtra = (patch: Partial<MettaPlusSkillsExtra>) => onChange({ extraData: JSON.stringify({ ...extra, ...patch }) });
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <FieldCol><Label>Tiêu đề section *</Label><Input value={section.title} onChange={(e) => onChange({ title: e.target.value })} /></FieldCol>
        <FieldCol><Label>Mô tả ngắn</Label><Input value={section.subtitle || section.description || ''} onChange={(e) => onChange({ subtitle: e.target.value, description: e.target.value })} /></FieldCol>
      </div>
      <MettaPlusSkillsEditor skills={skills} onChange={(next) => syncExtra({ skills: next })} />
    </>
  );
}

function MettaPlusVideosEditor({ videos, onChange }: { videos: MettaPlusVideoItem[]; onChange: (next: MettaPlusVideoItem[]) => void }) {
  function update(index: number, patch: Partial<MettaPlusVideoItem>) {
    onChange(videos.map((video, i) => (i === index ? { ...video, ...patch } : video)));
  }
  return (
    <div>
      <Label>Video YouTube <span className="text-slate-400 font-normal normal-case">— iframe chỉ tải sau khi khách bấm play</span></Label>
      <div className="flex flex-col gap-3">
        {videos.map((video, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Video {index + 1}</span>
              <button type="button" onClick={() => onChange(videos.filter((_, i) => i !== index))} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
            <div className="flex gap-3">
              <CompactImagePicker value={video.poster} onChange={(poster) => update(index, { poster })} shape="landscape" sizeNote="16:9" />
              <div className="min-w-0 flex-1 space-y-2">
                <div><Label>Tiêu đề video</Label><Input value={video.title} onChange={(e) => update(index, { title: e.target.value })} /></div>
                <div><Label>Link YouTube</Label><Input value={video.youtubeUrl} onChange={(e) => update(index, { youtubeUrl: e.target.value })} placeholder="https://www.youtube.com/watch?v=..." className="font-mono text-xs" /></div>
                <div><Label>Chú thích</Label><Textarea value={video.caption || ''} onChange={(e) => update(index, { caption: e.target.value })} className="h-16 text-sm" /></div>
              </div>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...videos, { youtubeUrl: '', poster: '', title: 'Video mới', caption: '' }])} className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"><Plus size={13} /> Thêm video</button>
      </div>
    </div>
  );
}

function MettaPlusTestimonialsEditor({ testimonials, onChange }: { testimonials: MettaPlusTestimonial[]; onChange: (next: MettaPlusTestimonial[]) => void }) {
  function update(index: number, patch: Partial<MettaPlusTestimonial>) {
    onChange(testimonials.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }
  return (
    <div>
      <Label>Cảm nhận phụ huynh</Label>
      <div className="flex flex-col gap-3">
        {testimonials.map((item, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">Cảm nhận {index + 1}</span>
              <button type="button" onClick={() => onChange(testimonials.filter((_, i) => i !== index))} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
            </div>
            <div className="flex gap-3">
              <CompactImagePicker value={item.image || ''} onChange={(image) => update(index, { image })} shape="square" sizeNote="Avatar" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="grid gap-2 md:grid-cols-2">
                  <div><Label>Tên</Label><Input value={item.name} onChange={(e) => update(index, { name: e.target.value })} /></div>
                  <div><Label>Vai trò</Label><Input value={item.role || ''} onChange={(e) => update(index, { role: e.target.value })} placeholder="VD: Phụ huynh bé An" /></div>
                </div>
                <div><Label>Câu trích</Label><Textarea value={item.quote} onChange={(e) => update(index, { quote: e.target.value })} className="h-20 text-sm" /></div>
              </div>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => onChange([...testimonials, { name: 'Phụ huynh', role: '', image: '', quote: 'Câu cảm nhận mới.' }])} className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-700"><Plus size={13} /> Thêm cảm nhận</button>
      </div>
    </div>
  );
}

function MettaPlusVideoSectionEditor({ section, onChange }: { section: PageSection; onChange: (patch: Partial<PageSection>) => void }) {
  const extra = parseObj<MettaPlusVideoExtra>(section.extraData, {
    videos: DEFAULT_METTA_PLUS_DATA.videos,
    testimonials: DEFAULT_METTA_PLUS_DATA.testimonials,
  });
  const videos = normalizeMettaPlusVideos(extra.videos?.length ? extra.videos : DEFAULT_METTA_PLUS_DATA.videos);
  const testimonials = normalizeMettaPlusTestimonials(extra.testimonials?.length ? extra.testimonials : DEFAULT_METTA_PLUS_DATA.testimonials);
  const syncExtra = (patch: Partial<MettaPlusVideoExtra>) => onChange({ extraData: JSON.stringify({ ...extra, ...patch }) });
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <FieldCol><Label>Tiêu đề section *</Label><Input value={section.title} onChange={(e) => onChange({ title: e.target.value })} /></FieldCol>
        <FieldCol><Label>Mô tả ngắn</Label><Input value={section.subtitle || section.description || ''} onChange={(e) => onChange({ subtitle: e.target.value, description: e.target.value })} /></FieldCol>
      </div>
      <MettaPlusVideosEditor videos={videos} onChange={(next) => syncExtra({ videos: next })} />
      <MettaPlusTestimonialsEditor testimonials={testimonials} onChange={(next) => syncExtra({ testimonials: next })} />
    </>
  );
}

function MettaPlusPassSectionEditor({ section, onChange }: { section: PageSection; onChange: (patch: Partial<PageSection>) => void }) {
  const extra = parseObj<MettaPlusPassExtra>(section.extraData, {
    passCardTitle: DEFAULT_METTA_PLUS_DATA.passCardTitle,
    passCardMeta: DEFAULT_METTA_PLUS_DATA.passCardMeta,
    passItems: DEFAULT_METTA_PLUS_DATA.passItems,
  });
  const syncExtra = (patch: Partial<MettaPlusPassExtra>) => onChange({ extraData: JSON.stringify({ ...extra, ...patch }) });
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <FieldCol><Label>Tiêu đề section *</Label><Input value={section.title} onChange={(e) => onChange({ title: e.target.value })} /></FieldCol>
        <FieldCol><Label>Mô tả ngắn</Label><Input value={section.subtitle || section.description || ''} onChange={(e) => onChange({ subtitle: e.target.value, description: e.target.value })} /></FieldCol>
        <FieldCol><Label>Tên trên card Summer</Label><Input value={extra.passCardTitle || ''} onChange={(e) => syncExtra({ passCardTitle: e.target.value })} /></FieldCol>
        <FieldCol><Label>Meta trên card Summer</Label><Input value={extra.passCardMeta || ''} onChange={(e) => syncExtra({ passCardMeta: e.target.value })} /></FieldCol>
        <FieldCol span2><Label>CTA Summer</Label><Input value={section.buttonText || ''} onChange={(e) => onChange({ buttonText: e.target.value })} /></FieldCol>
      </div>
      <ImageUploader value={section.imageUrl || ''} onChange={(v) => onChange({ imageUrl: v })} sizeNote="Ngang 4:3 · 1200×900px" label="Ảnh thay card Summer (để trống = giữ card mặc định)" />
      <StringListEditor label="Checklist Summer" items={extra.passItems || []} placeholder="VD: Mỹ thuật: màu sắc, hình khối, tranh và thủ công" onChange={(passItems) => syncExtra({ passItems })} />
    </>
  );
}

function MettaPlusFormSectionEditor({ section, onChange }: { section: PageSection; onChange: (patch: Partial<PageSection>) => void }) {
  const extra = parseObj<MettaPlusFormExtra>(section.extraData, { highlights: [] });
  const syncExtra = (patch: Partial<MettaPlusFormExtra>) => onChange({ extraData: JSON.stringify({ ...extra, ...patch }) });
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <FieldCol><Label>Tiêu đề form *</Label><Input value={section.title} onChange={(e) => onChange({ title: e.target.value })} /></FieldCol>
        <FieldCol><Label>CTA form</Label><Input value={section.buttonText || ''} onChange={(e) => onChange({ buttonText: e.target.value })} /></FieldCol>
        <FieldCol><Label>Form ID</Label><Input value={section.formId || ''} onChange={(e) => onChange({ formId: e.target.value })} placeholder="metta-summer-2026-landing" /></FieldCol>
        <FieldCol span2><Label>Mô tả form</Label><Textarea value={section.subtitle || section.description || ''} onChange={(e) => onChange({ subtitle: e.target.value, description: e.target.value })} className="h-16" /></FieldCol>
      </div>
      <StringListEditor label="Gạch đầu dòng cạnh form" items={extra.highlights || []} placeholder="VD: Tư vấn lớp hè theo tuổi" onChange={(highlights) => syncExtra({ highlights })} />
    </>
  );
}

function MettaPlusWeeklyPlanSectionEditor({ section, onChange }: { section: PageSection; onChange: (patch: Partial<PageSection>) => void }) {
  const parsed = parseObj<MettaPlusWeeklyPlanExtra>(section.extraData, DEFAULT_METTA_PLUS_WEEKLY_PLAN_EXTRA);
  const plan = normalizeMettaPlusWeeklyPlan(parsed);
  const syncExtra = (patch: Partial<MettaPlusWeeklyPlanExtra>) => {
    const next = normalizeMettaPlusWeeklyPlan({ ...plan, ...patch });
    onChange({ extraData: JSON.stringify(next) });
  };
  const updateColumns = (columns: string[]) => {
    const nextColumns = columns.length ? columns : DEFAULT_METTA_PLUS_WEEKLY_PLAN_EXTRA.columns;
    syncExtra({ columns: nextColumns, rows: plan.rows.map((row) => nextColumns.map((_, index) => row[index] || '')) });
  };

  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <FieldCol><Label>Tiêu đề bảng *</Label><Input value={section.title} onChange={(e) => onChange({ title: e.target.value })} /></FieldCol>
        <FieldCol><Label>Mô tả ngắn</Label><Input value={section.subtitle || section.description || ''} onChange={(e) => onChange({ subtitle: e.target.value, description: e.target.value })} /></FieldCol>
        <FieldCol span2><Label>Dòng tiếng Anh đầu giờ</Label><Textarea value={plan.warmupNote} onChange={(e) => syncExtra({ warmupNote: e.target.value })} className="h-16" /></FieldCol>
      </div>
      <StringListEditor label="Hoạt động tiếng Anh" items={plan.warmupActivities} placeholder="VD: Greeting Time" onChange={(warmupActivities) => syncExtra({ warmupActivities })} />
      <StringListEditor label="Cột trong bảng" hint="cột đầu tiên nên là Tuần" items={plan.columns} placeholder="VD: Mỹ thuật" onChange={updateColumns} />
      <MettaPlusWeeklyRowsEditor columns={plan.columns} rows={plan.rows} onChange={(rows) => syncExtra({ rows })} />
    </>
  );
}

const TYPE_COLOR: Record<string, string> = {
  Hero: 'bg-orange-100 text-orange-800',
  Stats: 'bg-cyan-100 text-cyan-800',
  Courses: 'bg-blue-100 text-blue-800',
  Facilities: 'bg-teal-100 text-teal-800',
  Benefits: 'bg-indigo-100 text-indigo-800',
  Testimonials: 'bg-amber-100 text-amber-800',
  Teachers: 'bg-green-100 text-green-800',
  News: 'bg-rose-100 text-rose-800',
  'Lead Form': 'bg-violet-100 text-violet-800',
  CTA: 'bg-red-100 text-red-800',
  'Ebook Hero': 'bg-sky-100 text-sky-800',
  'Ebook Skills': 'bg-blue-100 text-blue-800',
  'Ebook Why': 'bg-indigo-100 text-indigo-800',
  'Metta+ Hero': 'bg-orange-100 text-orange-800',
  'Metta+ Benefits': 'bg-green-100 text-green-800',
  'Metta+ Age Clubs': 'bg-purple-100 text-purple-800',
  'Metta+ Pass': 'bg-yellow-100 text-yellow-800',
  'Metta+ Journey': 'bg-blue-100 text-blue-800',
  'Metta+ Weekly Plan': 'bg-cyan-100 text-cyan-800',
  'Metta+ Reasons': 'bg-pink-100 text-pink-800',
  'Metta+ Form': 'bg-red-100 text-red-800',
  'Metta+ Landing': 'bg-orange-100 text-orange-800',
};

function SectionEditor({
  section, onSave, onDelete, onMove, onDraftChange,
}: {
  section: PageSection;
  onSave: (s: PageSection) => Promise<void>;
  onDelete: () => void;
  onMove: (id: string, d: 'up' | 'down') => void;
  onDraftChange: (s: PageSection) => void;
}) {
  const [val, setVal] = useState(section);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveWarning, setSaveWarning] = useState('');
  const [collapsed, setCollapsed] = useState(true);
  useEffect(() => setVal(section), [section]);

  const tc = TYPE_COLOR[val.type] ?? 'bg-slate-100 text-slate-700';
  const set = (patch: Partial<PageSection>) => setVal((v) => {
    const next = { ...v, ...patch };
    onDraftChange(next);
    return next;
  });

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setSaveWarning('');
    try {
      await onSave(val);
      setSaveWarning(cmsService.getLastWriteError() || '');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      setSaveWarning(error instanceof Error ? error.message : 'Không lưu được section.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className={`border-l-4 ${val.visible ? 'border-l-blue-500' : 'border-l-slate-300 opacity-70'}`}>
      <CardHeader
        className="flex-row items-center justify-between flex-wrap gap-2 py-3 cursor-pointer select-none"
        onClick={(e) => {
          // Don't toggle when clicking action buttons
          if ((e.target as HTMLElement).closest('button')) return;
          setCollapsed((c) => !c);
        }}
      >
        <div className="flex items-center gap-2">
          <ChevronDown size={16} className={`text-slate-400 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
          <span className="text-slate-400 font-bold text-sm">#{val.order}</span>
          <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${tc}`}>{val.type}</span>
          <CardTitle className="text-sm font-semibold text-slate-700 truncate max-w-xs">{val.title || '(Chưa có tiêu đề)'}</CardTitle>
        </div>
        <div className="flex gap-1.5">
          <Button variant="outline" size="icon" onClick={() => onMove(val.id, 'up')} title="Di lên" className="h-8 w-8"><ArrowUp size={14} /></Button>
          <Button variant="outline" size="icon" onClick={() => onMove(val.id, 'down')} title="Di xuống" className="h-8 w-8"><ArrowDown size={14} /></Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => set({ visible: !val.visible })} title={val.visible ? 'Ẩn section' : 'Hiện section'}>
            {val.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </Button>
          <Button variant="destructive" size="icon" className="h-8 w-8" onClick={onDelete} title="Xóa"><Trash2 size={14} /></Button>
        </div>
      </CardHeader>

      {!collapsed && <CardContent className="flex flex-col gap-5 pt-0">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Loại section</Label>
            <Select value={val.type} onChange={(e) => set({ type: e.target.value as BlockType })}>
              {BLOCK_TYPES.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </div>
          <div>
            <Label>Anchor ID (slug) <span className="text-slate-400 font-normal normal-case">— dùng cho menu scroll</span></Label>
            <Input
              value={val.anchorId || ''}
              onChange={(e) => set({ anchorId: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
              placeholder="vd: about, teachers, programs..."
              className="font-mono text-sm"
            />
            {val.anchorId && (
              <p className="text-xs text-slate-400 mt-1">Link menu: <code className="bg-slate-100 px-1 rounded">/#{ val.anchorId }</code></p>
            )}
          </div>
        </div>

        {val.type === 'Hero' && (
          <>
            <FieldCol><Label>Tiêu đề chính *</Label><Input value={val.title} onChange={(e) => set({ title: e.target.value })} /></FieldCol>
            <FieldCol><Label>Tiêu đề phụ</Label><Input value={val.subtitle || ''} onChange={(e) => set({ subtitle: e.target.value })} /></FieldCol>
            <FieldCol><Label>Mô tả</Label><Textarea value={val.description || ''} onChange={(e) => set({ description: e.target.value })} className="h-20" /></FieldCol>
            <FieldCol><Label>Ảnh slider</Label><HeroSliderEditor value={val.extraData || ''} onChange={(v) => set({ extraData: v })} /></FieldCol>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FieldCol><Label>Text nút chính</Label><Input value={val.buttonText || ''} onChange={(e) => set({ buttonText: e.target.value })} /></FieldCol>
              <FieldCol><Label>Link nút chính</Label><Input value={val.buttonLink || ''} onChange={(e) => set({ buttonLink: e.target.value })} /></FieldCol>
              <FieldCol><Label>Text nút phụ</Label><Input value={val.button2Text || ''} onChange={(e) => set({ button2Text: e.target.value })} /></FieldCol>
              <FieldCol><Label>Link nút phụ</Label><Input value={val.button2Link || ''} onChange={(e) => set({ button2Link: e.target.value })} /></FieldCol>
            </div>
          </>
        )}

        {val.type === 'Stats' && <><FieldCol><Label>Tiêu đề</Label><Input value={val.title} onChange={(e) => set({ title: e.target.value })} /></FieldCol><StatsEditor value={val.extraData || ''} onChange={(v) => set({ extraData: v })} /></>}

        {val.type === 'Courses' && (
          <>
            <FieldCol><Label>Tiêu đề *</Label><Input value={val.title} onChange={(e) => set({ title: e.target.value })} /></FieldCol>
            <FieldCol><Label>Tiêu đề phụ</Label><Input value={val.subtitle || ''} onChange={(e) => set({ subtitle: e.target.value })} /></FieldCol>
            <FieldCol><Label>Mô tả</Label><Textarea value={val.description || ''} onChange={(e) => set({ description: e.target.value })} className="h-20" /></FieldCol>
            <p className="text-xs text-slate-500 bg-blue-50 border border-blue-200 rounded p-3">Nội dung các khóa học được lấy từ cấu hình chương trình trong website.</p>
          </>
        )}

        {val.type === 'Facilities' && (
          <>
            <FieldCol><Label>Eyebrow (chữ nhỏ phía trên)</Label><Input value={val.subtitle || ''} onChange={(e) => set({ subtitle: e.target.value })} placeholder="Không gian học tập" /></FieldCol>
            <FieldCol><Label>Tiêu đề chính *</Label><Input value={val.title} onChange={(e) => set({ title: e.target.value })} placeholder="Cơ sở vật chất tại METTA Academy" /></FieldCol>
            <FieldCol><Label>Mô tả ngắn</Label><Textarea value={val.description || ''} onChange={(e) => set({ description: e.target.value })} className="h-16" placeholder="Không gian học tập hiện đại, chỉn chu và truyền cảm hứng..." /></FieldCol>
            <FacilitiesEditor value={val.extraData || ''} onChange={(v) => set({ extraData: v })} />
          </>
        )}

        {val.type === 'Benefits' && (
          <>
            <FieldCol><Label>Tiêu đề *</Label><Input value={val.title} onChange={(e) => set({ title: e.target.value })} /></FieldCol>
            <FieldCol><Label>Tiêu đề phụ</Label><Input value={val.subtitle || ''} onChange={(e) => set({ subtitle: e.target.value })} /></FieldCol>
            <FieldCol><Label>Mô tả phụ</Label><Textarea value={val.description || ''} onChange={(e) => set({ description: e.target.value })} className="h-16" /></FieldCol>
            <BenefitsEditor value={val.extraData || ''} onChange={(v) => set({ extraData: v })} />
          </>
        )}

        {val.type === 'Testimonials' && (
          <>
            <FieldCol><Label>Tiêu đề *</Label><Input value={val.title} onChange={(e) => set({ title: e.target.value })} /></FieldCol>
            <FieldCol><Label>Tiêu đề phụ</Label><Input value={val.subtitle || ''} onChange={(e) => set({ subtitle: e.target.value })} /></FieldCol>
            <TestimonialsEditor value={val.extraData || ''} onChange={(v) => set({ extraData: v })} />
          </>
        )}

        {val.type === 'Teachers' && (
          <>
            <FieldCol><Label>Tiêu đề *</Label><Input value={val.title} onChange={(e) => set({ title: e.target.value })} /></FieldCol>
            <FieldCol><Label>Tiêu đề phụ</Label><Input value={val.subtitle || ''} onChange={(e) => set({ subtitle: e.target.value })} /></FieldCol>
            <FieldCol><Label>Mô tả</Label><Textarea value={val.description || ''} onChange={(e) => set({ description: e.target.value })} className="h-16" /></FieldCol>
            <TeachersEditor value={val.extraData || ''} onChange={(v) => set({ extraData: v })} />
          </>
        )}

        {val.type === 'News' && (
          <>
            <FieldCol><Label>Tiêu đề *</Label><Input value={val.title} onChange={(e) => set({ title: e.target.value })} /></FieldCol>
            <FieldCol><Label>Tiêu đề phụ</Label><Input value={val.subtitle || ''} onChange={(e) => set({ subtitle: e.target.value })} /></FieldCol>
            <NewsEditor value={val.extraData || ''} onChange={(v) => set({ extraData: v })} />
          </>
        )}

        {val.type === 'CTA' && (
          <>
            <FieldCol><Label>Tiêu đề *</Label><Input value={val.title} onChange={(e) => set({ title: e.target.value })} /></FieldCol>
            <FieldCol><Label>Mô tả phụ</Label><Textarea value={val.subtitle || ''} onChange={(e) => set({ subtitle: e.target.value })} className="h-16" /></FieldCol>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FieldCol><Label>Text nút chính</Label><Input value={val.buttonText || ''} onChange={(e) => set({ buttonText: e.target.value })} /></FieldCol>
              <FieldCol><Label>Link nút chính</Label><Input value={val.buttonLink || ''} onChange={(e) => set({ buttonLink: e.target.value })} /></FieldCol>
              <FieldCol><Label>Text nút phụ</Label><Input value={val.button2Text || ''} onChange={(e) => set({ button2Text: e.target.value })} /></FieldCol>
              <FieldCol><Label>Link nút phụ</Label><Input value={val.button2Link || ''} onChange={(e) => set({ button2Link: e.target.value })} /></FieldCol>
            </div>
          </>
        )}

        {val.type === 'Lead Form' && (
          <>
            <FieldCol><Label>Tiêu đề form *</Label><Input value={val.title} onChange={(e) => set({ title: e.target.value })} /></FieldCol>
            <FieldCol><Label>Form ID</Label><Input value={val.formId || ''} onChange={(e) => set({ formId: e.target.value })} /></FieldCol>
          </>
        )}

        {val.type === 'Metta+ Hero' && <MettaPlusHeroSectionEditor section={val} onChange={set} />}

        {val.type === 'Metta+ Skills' && <MettaPlusSkillsSectionEditor section={val} onChange={set} />}

        {val.type === 'Metta+ Benefits' && (
          <MettaPlusCardsSectionEditor section={val} label="6 card: Con nhận được gì?" fallback={DEFAULT_METTA_PLUS_DATA.benefits} onChange={set} />
        )}

        {val.type === 'Metta+ Age Clubs' && (
          <MettaPlusCardsSectionEditor section={val} label="4 card: Nhóm tuổi / mốc lộ trình" fallback={DEFAULT_METTA_PLUS_DATA.ageGroups} onChange={set} />
        )}

        {val.type === 'Metta+ Pass' && <MettaPlusPassSectionEditor section={val} onChange={set} />}

        {val.type === 'Metta+ Journey' && (
          <MettaPlusCardsSectionEditor section={val} label="4 bước hành trình" fallback={DEFAULT_METTA_PLUS_DATA.journey} onChange={set} />
        )}

        {val.type === 'Metta+ Weekly Plan' && <MettaPlusWeeklyPlanSectionEditor section={val} onChange={set} />}

        {val.type === 'Metta+ Reasons' && (
          <MettaPlusCardsSectionEditor section={val} label="5 card: Vì sao phụ huynh chọn?" fallback={DEFAULT_METTA_PLUS_DATA.reasons} onChange={set} />
        )}

        {val.type === 'Metta+ Video' && <MettaPlusVideoSectionEditor section={val} onChange={set} />}

        {val.type === 'Metta+ Form' && <MettaPlusFormSectionEditor section={val} onChange={set} />}

        {val.type === 'Metta+ Landing' && (
          <>
            <FieldCol><Label>Tên section trong admin</Label><Input value={val.title} onChange={(e) => set({ title: e.target.value })} /></FieldCol>
            <FieldCol><Label>Form ID</Label><Input value={val.formId || ''} onChange={(e) => set({ formId: e.target.value })} placeholder="metta-summer-2026-landing" /></FieldCol>
            <MettaPlusEditor value={val.extraData || ''} onChange={(v) => set({ extraData: v })} />
          </>
        )}

        {val.type === 'Ebook Hero' && (
          <>
            <FieldCol><Label>Headline (phần chữ trắng) *</Label><Textarea value={val.title} onChange={(e) => set({ title: e.target.value })} className="h-16" /></FieldCol>
            <FieldCol><Label>Mô tả (sub headline)</Label><Textarea value={val.subtitle || ''} onChange={(e) => set({ subtitle: e.target.value })} className="h-16" /></FieldCol>
            <ImageUploader value={val.imageUrl || ''} onChange={(v) => set({ imageUrl: v })} sizeNote="3:4 · 900×1200px" label="Ảnh bìa sách (đứng) — để trống sẽ hiện khung chờ" />
            <FieldCol><Label>Form ID</Label><Input value={val.formId || ''} onChange={(e) => set({ formId: e.target.value })} placeholder="preschool-ebook-hero" /></FieldCol>
            <EbookHeroEditor value={val.extraData || ''} onChange={(v) => set({ extraData: v })} />
          </>
        )}

        {val.type === 'Ebook Skills' && (
          <>
            <FieldCol><Label>Eyebrow (chữ nhỏ phía trên)</Label><Input value={val.subtitle || ''} onChange={(e) => set({ subtitle: e.target.value })} placeholder="Bên trong sách có gì?" /></FieldCol>
            <FieldCol><Label>Tiêu đề chính *</Label><Input value={val.title} onChange={(e) => set({ title: e.target.value })} /></FieldCol>
            <EbookSkillsEditor value={val.extraData || ''} onChange={(v) => set({ extraData: v })} />
          </>
        )}

        {val.type === 'Ebook Why' && (
          <>
            <FieldCol><Label>Eyebrow (chữ nhỏ phía trên)</Label><Input value={val.subtitle || ''} onChange={(e) => set({ subtitle: e.target.value })} placeholder="Vì sao nên tải?" /></FieldCol>
            <FieldCol><Label>Tiêu đề chính *</Label><Input value={val.title} onChange={(e) => set({ title: e.target.value })} /></FieldCol>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <FieldCol><Label>Text nút</Label><Input value={val.buttonText || ''} onChange={(e) => set({ buttonText: e.target.value })} /></FieldCol>
              <FieldCol><Label>Link nút</Label><Input value={val.buttonLink || ''} onChange={(e) => set({ buttonLink: e.target.value })} placeholder="#dangky" /></FieldCol>
            </div>
            <EbookWhyEditor value={val.extraData || ''} onChange={(v) => set({ extraData: v })} />
          </>
        )}

        {['About', 'Contact', 'FAQ', 'Footer'].includes(val.type) && (
          <>
            <FieldCol><Label>Tiêu đề *</Label><Input value={val.title} onChange={(e) => set({ title: e.target.value })} /></FieldCol>
            <FieldCol><Label>Tiêu đề phụ</Label><Input value={val.subtitle || ''} onChange={(e) => set({ subtitle: e.target.value })} /></FieldCol>
            <FieldCol><Label>Mô tả / Nội dung</Label><Textarea value={val.description || val.content || ''} onChange={(e) => set({ description: e.target.value })} className="h-24" /></FieldCol>
            {val.type === 'About' && <ImageUploader value={val.imageUrl || ''} onChange={(v) => set({ imageUrl: v })} sizeNote="800 x 600 px" label="Ảnh minh họa" />}
          </>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-slate-100">
          <Button onClick={handleSave} className="w-fit" disabled={saving}>
            <Save size={15} className="mr-1" /> {saving ? 'Đang lưu...' : 'Lưu section'}
          </Button>
          <span className="text-xs text-slate-400">Có thể bỏ qua nút này và dùng Lưu tất cả ở đầu trang.</span>
          {saved && <span className="text-green-600 text-sm font-semibold">Đã lưu section.</span>}
          {saveWarning && <span className="text-amber-600 text-sm font-semibold">{saveWarning}</span>}
        </div>
      </CardContent>}
    </Card>
  );
}

export default function PageEditorPage() {
  const { id } = useParams();
  const [page, setPage] = useState<CmsPage | null | undefined>();
  const { sections, refresh } = usePageSections(id);
  const [draftSections, setDraftSections] = useState<Record<string, PageSection>>({});
  const [pageSaved, setPageSaved] = useState(false);
  const [saveAllState, setSaveAllState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveAllMessage, setSaveAllMessage] = useState('');

  useEffect(() => {
    if (!id) return;
    const fallbackPage = seedPages.find((item) => item.id === id);
    const timer = window.setTimeout(() => setPage((current) => current === undefined ? (fallbackPage || null) : current), 1800);
    cmsService.getPage(id)
      .then((found) => setPage(found || fallbackPage || null))
      .catch(() => setPage(fallbackPage || null))
      .finally(() => window.clearTimeout(timer));
  }, [id]);

  useEffect(() => {
    setDraftSections(Object.fromEntries(sections.map((section) => [section.id, section])));
  }, [sections]);

  if (!id) return <p className="p-8 text-slate-500">Không tìm thấy ID trang.</p>;
  if (page === undefined) return <p className="p-8 text-slate-500">Đang tải trang...</p>;
  if (page === null) return <p className="p-8 text-slate-500">Không tìm thấy trang. Quay lại Website CMS và khôi phục nội dung mặc định CMS.</p>;

  async function savePage() {
    if (!page) return;
    await cmsService.savePage(page);
    setPageSaved(true);
    setTimeout(() => setPageSaved(false), 2500);
  }

  async function saveAll() {
    if (!page) return;
    setSaveAllState('saving');
    setSaveAllMessage('');
    try {
      await cmsService.savePage(page);
      const drafts = sections.map((section) => draftSections[section.id] || section);
      await Promise.all(drafts.map((section) => cmsService.saveSection(section)));
      const warning = cmsService.getLastWriteError();
      await refresh();
      setPageSaved(true);
      setSaveAllState(warning ? 'error' : 'saved');
      setSaveAllMessage(warning || `Đã lưu ${drafts.length} section và cài đặt trang.`);
      setTimeout(() => {
        setPageSaved(false);
        setSaveAllState('idle');
        setSaveAllMessage('');
      }, 3500);
    } catch (error) {
      setSaveAllState('error');
      setSaveAllMessage(error instanceof Error ? error.message : 'Không lưu được toàn bộ trang.');
    }
  }

  function updateDraft(section: PageSection) {
    setDraftSections((current) => ({ ...current, [section.id]: section }));
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="sticky top-16 z-20 -mx-2 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur md:top-3">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-950">{page.title}</h1>
            <p className="text-slate-500 text-sm mt-1">Chỉnh nội dung, hình ảnh và thứ tự section. Sửa xong bấm Lưu tất cả để cập nhật website.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => cmsService.saveSection({ pageId: id, type: 'Hero', title: 'Section mới' }).then(refresh)} className="md:w-fit">
              <Plus size={15} className="mr-1" /> Thêm section
            </Button>
            <Button onClick={saveAll} disabled={saveAllState === 'saving'} className="md:w-fit">
              <Save size={15} className="mr-1" /> {saveAllState === 'saving' ? 'Đang lưu...' : 'Lưu tất cả'}
            </Button>
          </div>
        </div>
        {saveAllMessage && (
          <div className={`mt-3 rounded-lg px-3 py-2 text-sm font-semibold ${saveAllState === 'error' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
            {saveAllMessage}
          </div>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle>Cài đặt trang & SEO</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <FieldCol><Label>Tiêu đề trang</Label><Input value={page.title} onChange={(e) => setPage({ ...page, title: e.target.value })} /></FieldCol>
          <FieldCol><Label>Slug (URL)</Label><Input value={page.slug} onChange={(e) => setPage({ ...page, slug: e.target.value })} /></FieldCol>
          <FieldCol><Label>Meta title (SEO)</Label><Input value={page.metaTitle} onChange={(e) => setPage({ ...page, metaTitle: e.target.value })} /></FieldCol>
          <FieldCol><Label>Trạng thái</Label><Select value={page.status} onChange={(e) => setPage({ ...page, status: e.target.value as CmsPage['status'] })}><option value="draft">Draft</option><option value="published">Published</option></Select></FieldCol>
          <FieldCol span2><Label>Meta description</Label><Textarea value={page.metaDescription} onChange={(e) => setPage({ ...page, metaDescription: e.target.value })} className="h-16" /></FieldCol>
          <div className="md:col-span-2 flex items-center gap-3">
            <Button className="w-fit" onClick={savePage}><Save size={15} className="mr-1" /> Lưu cài đặt</Button>
            {pageSaved && <span className="text-green-600 text-sm font-semibold">Đã lưu!</span>}
          </div>
        </CardContent>
      </Card>

      {sections.length === 0 && <Card><CardContent className="py-12 text-center text-slate-400">Chưa có section nào. Nhấn Thêm section để bắt đầu.</CardContent></Card>}
      {sections.map((section) => (
        <SectionEditor
          key={section.id}
          section={draftSections[section.id] || section}
          onDraftChange={updateDraft}
          onSave={async (s) => { await cmsService.saveSection(s); refresh(); }}
          onDelete={async () => { await cmsService.deleteSection(section.id); refresh(); }}
          onMove={async (sid, d) => { await cmsService.moveSection(sid, d); refresh(); }}
        />
      ))}
    </div>
  );
}
