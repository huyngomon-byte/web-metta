import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, ImagePlus, Plus, Save, Trash2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { pages as seedPages } from '@/data/seed';
import { cmsService } from '@/services/cmsService';
import { usePageSections } from '@/hooks/useCms';
import type { BlockType, CmsPage, PageSection } from '@/types/cms';

/* ── constants ────────────────────────────────────────────────────────── */
const BLOCK_TYPES: BlockType[] = [
  'Hero', 'Stats', 'Benefits', 'Courses', 'Facilities', 'Testimonials', 'Teachers', 'News',
  'Lead Form', 'FAQ', 'CTA', 'About', 'Contact', 'Footer',
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
const ICON_OPTIONS = ['school','groups','rocket_launch','psychology','dashboard','monitoring','star','favorite','verified','workspace_premium','emoji_events','support_agent'];
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
              <div className="flex gap-2 items-center">
                <span className="material-symbols-outlined text-[24px]" style={{ color: benefitColor(item.color) }}>{item.icon || 'school'}</span>
                <Select value={item.icon} onChange={(e) => update(i, 'icon', e.target.value)} className="flex-1 text-xs">
                  {ICON_OPTIONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}
                </Select>
              </div>
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

/* ── Section Editor ─────────────────────────────────────────────────── */
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
  if (page === null) return <p className="p-8 text-slate-500">Không tìm thấy trang. Quay lại Website CMS và khôi phục dữ liệu mẫu CMS.</p>;

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
