/**
 * Các block dành cho landing "Sách tiền tiểu học" (ebook mầm non).
 * Render theo dữ liệu CMS (PageSection) — admin sửa nội dung/ảnh, ẩn/hiện,
 * đổi thứ tự ngay trong Website CMS giống trang chủ.
 *
 * Bảng màu navy METTA, CTA cam. Ảnh nhiều -> tự thành slider (ảnh thuần,
 * không chữ đè lên ảnh).
 */
import { useEffect, useState } from 'react';
import { leadService } from '@/services/leadService';
import type { PageSection } from '@/types/cms';

/* ── helpers ─────────────────────────────────────────────────────────────── */
function parseJson<T>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <span className={`material-symbols-outlined ${className}`}>{name}</span>;
}

// Trên mobile/tablet, headline ebook tự xuống dòng trước từ "Cho" để break đẹp:
// "Sách Tiền Tiểu Học" / "Cho Mầm Non". Desktop (lg+) giữ flow tự nhiên.
function renderTitleWithMobileBreak(title: string) {
  const match = title.match(/^(.*?)\s+(Cho|cho)\s+(.+)$/);
  if (!match) return title;
  const [, before, choWord, after] = match;
  return (
    <>
      {before}
      <br className="lg:hidden" />
      <span>{choWord} {after}</span>
    </>
  );
}

function scrollToForm() {
  document.getElementById('dangky')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

const AGE_OPTIONS = ['Dưới 4 tuổi', '4 tuổi', '5 tuổi', '6 tuổi', 'Trên 6 tuổi'];

/* Bảng màu + class .lp-* đã khai báo global trong src/index.css để render đúng ở mọi route. */

/* ── ImageSlider (ảnh thuần, nhiều ảnh -> auto slider + chấm) ─────────────── */
function ImageSlider({ images, alt, ratio = 'aspect-[4/3]', sizeLabel, label = 'Ảnh minh hoạ' }: { images: string[]; alt: string; ratio?: string; sizeLabel?: string; label?: string }) {
  const list = images.filter(Boolean);
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (list.length <= 1) return;
    const t = setInterval(() => setIdx((c) => (c + 1) % list.length), 4000);
    return () => clearInterval(t);
  }, [list.length]);

  if (!list.length) {
    return (
      <div className={`relative ${ratio} w-full overflow-hidden rounded-[28px] border-2 border-dashed border-[var(--lp-navy)]/30 bg-[var(--lp-sky-2)]`}>
        <div className="absolute inset-0 grid place-items-center px-4 text-center text-[var(--lp-navy)]/70">
          <div>
            <Icon name="image" className="text-[44px]" />
            <p className="mt-2 font-montserrat text-[13px] font-extrabold">{label}</p>
            {sizeLabel && <p className="mt-1 text-[11px] font-semibold">{sizeLabel}</p>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${ratio} w-full overflow-hidden rounded-[28px] shadow-[0_30px_60px_-30px_rgba(0,47,95,.55)]`}>
      <div
        className="flex h-full transition-transform duration-700 ease-out"
        style={{ width: `${list.length * 100}%`, transform: `translateX(-${idx * (100 / list.length)}%)` }}
      >
        {list.map((src, i) => (
          <img
            key={i}
            src={src}
            alt={`${alt} ${i + 1}`}
            loading="lazy"
            decoding="async"
            className="h-full w-full flex-shrink-0 object-cover"
            style={{ width: `${100 / list.length}%` }}
          />
        ))}
      </div>
      {list.length > 1 && (
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {list.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Ảnh ${i + 1}`}
              onClick={() => setIdx(i)}
              className={`h-2 rounded-full transition-all ${i === idx ? 'w-5 bg-white' : 'w-2 bg-white/60'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Lead form (hero) ────────────────────────────────────────────────────── */
type HeroFormConfig = {
  formId?: string;
  selectLabel?: string;       // VD: "Độ tuổi của bé", "Lớp của bé"
  selectPlaceholder?: string; // VD: "Chọn độ tuổi", "Chọn lớp"
  selectOptions?: string[];   // danh sách tuỳ chọn dropdown
  buttonText?: string;        // text nút submit
  noteLabel?: string;         // prefix initialNote gửi về CRM
  pixelContent?: string;      // content_name cho Meta Pixel
};

function HeroLeadForm({ formId = 'preschool-ebook-hero', selectLabel = 'Độ tuổi của bé', selectPlaceholder = 'Chọn độ tuổi', selectOptions = AGE_OPTIONS, buttonText = 'Tải sách miễn phí', noteLabel = 'Tải sách tiền tiểu học (CCSS)', pixelContent = 'Preschool Ebook' }: HeroFormConfig) {
  const [form, setForm] = useState({ parentName: '', studentName: '', phone: '', age: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const set = (k: keyof typeof form, v: string) => setForm((s) => ({ ...s, [k]: v }));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const fd = new FormData(e.currentTarget);
    if (fd.get('company') || fd.get('website')) return;
    if (!form.parentName.trim()) return setError('Vui lòng nhập họ tên phụ huynh.');
    if (!form.studentName.trim()) return setError('Vui lòng nhập họ tên bé.');
    const phone = form.phone.replace(/[\s.\-()]/g, '').replace(/^\+84/, '0');
    if (!/^0(3|5|7|8|9|1[2689])\d{8}$/.test(phone)) return setError('Số điện thoại chưa hợp lệ.');
    setLoading(true);
    try {
      await leadService.publicSubmit(
        {
          fullName: form.studentName.trim(),
          parentName: form.parentName.trim(),
          studentName: form.studentName.trim(),
          contactType: 'parent',
          phone,
          age: form.age,
          source: 'Landing Page',
          initialNote: [noteLabel, form.age && `${selectLabel}: ${form.age}`].filter(Boolean).join(' · '),
          company: String(fd.get('company') || ''),
          website: String(fd.get('website') || ''),
        },
        formId,
      );
      (window as any).fbq?.('track', 'Lead', { content_name: pixelContent });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không gửi được thông tin. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-3xl bg-white p-7 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--lp-sky)]">
          <Icon name="check_circle" className="text-[40px] text-[var(--lp-navy)]" />
        </div>
        <h3 className="font-montserrat text-xl font-extrabold text-[var(--lp-ink)]">Đã nhận thông tin của ba mẹ!</h3>
        <p className="mt-2 text-[14px] leading-6 text-[var(--lp-ink)]/70">
          METTA Academy sẽ gửi tài liệu và tư vấn lộ trình phù hợp với độ tuổi của bé trong thời gian sớm nhất.
        </p>
      </div>
    );
  }

  const inputCls =
    'h-[46px] w-full rounded-xl border border-[#CFE0F2] bg-white px-3.5 text-[14.5px] text-[var(--lp-ink)] outline-none transition focus:border-[var(--lp-navy)] focus:ring-2 focus:ring-[var(--lp-navy)]/20';
  const selectCls = `${inputCls} pr-8`;

  return (
    <form onSubmit={submit} className="grid gap-2.5 sm:gap-3" noValidate>
      <input className="hidden" name="company" tabIndex={-1} autoComplete="off" aria-hidden />
      <input className="hidden" name="website" tabIndex={-1} autoComplete="off" aria-hidden />
      <label className="block">
        <span className="mb-1 block text-[13px] font-semibold text-[var(--lp-navy-700)]">Họ tên phụ huynh *</span>
        <input className={inputCls} placeholder="VD: Nguyễn Thị Hương" value={form.parentName} onChange={(e) => set('parentName', e.target.value)} required />
      </label>
      <label className="block">
        <span className="mb-1 block text-[13px] font-semibold text-[var(--lp-navy-700)]">Họ tên bé *</span>
        <input className={inputCls} placeholder="VD: Nguyễn Minh Anh" value={form.studentName} onChange={(e) => set('studentName', e.target.value)} required />
      </label>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(112px,128px)] gap-2.5 sm:gap-3">
        <label className="block min-w-0">
          <span className="mb-1 block text-[13px] font-semibold text-[var(--lp-navy-700)]">Số điện thoại *</span>
          <input className={inputCls} placeholder="VD: 090 123 4567" inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} required />
        </label>
        <label className="block min-w-0">
          <span className="mb-1 block text-[13px] font-semibold text-[var(--lp-navy-700)]">{selectLabel}</span>
          <select className={selectCls} value={form.age} onChange={(e) => set('age', e.target.value)}>
            <option value="">{selectPlaceholder}</option>
            {selectOptions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
      </div>
      <button type="submit" disabled={loading} className="lp-cta mt-1 inline-flex h-[52px] items-center justify-center gap-2 rounded-xl px-6 text-[16px] disabled:opacity-60">
        <Icon name={loading ? 'progress_activity' : 'download'} className={`text-[20px] ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Đang gửi...' : buttonText}
      </button>
      {error && <p className="rounded-xl bg-red-50 px-3.5 py-2.5 text-[13px] font-medium text-red-600">{error}</p>}
    </form>
  );
}

/* ── Ảnh bìa sách (3:4). Chưa có ảnh -> placeholder ghi kích thước cho designer ── */
function BookImage({ src }: { src?: string }) {
  if (src) {
    return (
      <div className="relative mx-auto w-[240px] sm:w-[290px] lg:w-[310px]">
        <img
          src={src}
          alt="Sách tiền tiểu học METTA Academy"
          loading="eager"
          decoding="async"
          className="w-full rounded-[14px] object-cover shadow-[0_24px_50px_-18px_rgba(0,0,0,.45)]"
          style={{ aspectRatio: '3 / 4' }}
        />
      </div>
    );
  }
  return (
    <div className="relative mx-auto w-[240px] sm:w-[290px] lg:w-[310px]">
      <div
        className="grid w-full place-items-center rounded-[14px] border-2 border-dashed border-white/35 bg-white/8 text-center text-white/80 shadow-[0_30px_60px_-24px_rgba(0,0,0,.55)] backdrop-blur"
        style={{ aspectRatio: '3 / 4' }}
      >
        <div className="px-4">
          <Icon name="auto_stories" className="text-[52px]" />
          <p className="mt-2 font-montserrat text-[14px] font-extrabold">Ảnh bìa sách</p>
          <p className="mt-1 text-[12px] font-semibold leading-4">Tỷ lệ 3:4<br />đề xuất 900 × 1200px</p>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  BLOCK: Ebook Hero                                                          */
/* ════════════════════════════════════════════════════════════════════════ */
type HeroExtra = {
  badges?: string[];
  bullets?: string[];
  titleAccent?: string;        // phần headline màu cam (xuống dòng, đứng dưới phần trắng)
  formTitle?: string;
  formSubtitle?: string;
  formBadge?: string;
  selectLabel?: string;
  selectPlaceholder?: string;
  selectOptions?: string[];
  submitText?: string;
};

export function EbookHeroBlock({ section }: { section: PageSection }) {
  const extra = parseJson<HeroExtra>(section.extraData, {});
  const badges = extra.badges || [];
  const bullets = extra.bullets || [];
  const formTitle = extra.formTitle || 'Nhận sách miễn phí ngay';
  const formSubtitle = extra.formSubtitle || 'METTA Academy sẽ gửi tài liệu và tư vấn lộ trình phù hợp với độ tuổi của bé.';

  return (
    <section id="top" className="relative overflow-hidden bg-[var(--lp-navy)]">
      <div className="relative mx-auto grid max-w-[1220px] grid-cols-1 items-center gap-8 px-5 py-6 sm:px-6 lg:grid-cols-[38fr_28fr_34fr] lg:gap-7 lg:py-6 lg:min-h-[600px]">
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          {badges.length > 0 && (
            <div className="mb-4 flex flex-wrap justify-center gap-2 lg:justify-start">
              {badges.map((b) => (
                <span key={b} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12px] font-semibold leading-none text-white ring-1 ring-white/15">
                  <Icon name="check_circle" className="text-[15px] text-[var(--lp-cta)]" />
                  {b}
                </span>
              ))}
            </div>
          )}
          <h1 className="font-montserrat text-[28px] font-extrabold leading-[1.15] tracking-tight text-white sm:text-[36px] lg:text-[44px]">
            {renderTitleWithMobileBreak(section.title || 'Tải miễn phí sách tiền tiểu học cho bé mầm non')}
            {extra.titleAccent && (
              <span className="mt-1.5 block text-[22px] leading-[1.2] text-[var(--lp-cta)] [text-wrap:balance] sm:text-[28px] lg:text-[32px]">{extra.titleAccent}</span>
            )}
          </h1>
          {section.subtitle && (
            <p className="mt-4 max-w-xl text-[15px] leading-7 text-white/80 sm:text-[16px]">{section.subtitle}</p>
          )}
          {bullets.length > 0 && (
            <ul className="mt-6 grid gap-y-3 gap-x-6 text-left sm:grid-cols-2 sm:gap-x-7">
              {bullets.map((b) => (
                <li key={b} className="flex items-start gap-2.5 text-[15px] leading-6 text-white/90 sm:text-[16px]">
                  <span className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-[var(--lp-cta)]"><Icon name="check" className="text-[18px] text-white" /></span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-center">
          <BookImage src={section.imageUrl} />
        </div>

        <div id="dangky" className="lp-card relative z-10 mx-auto w-full max-w-[400px] p-7 sm:p-8">
            <h2 className="font-montserrat text-[22px] font-extrabold text-[var(--lp-ink)]">{formTitle}</h2>
            <p className="mb-4 mt-1.5 text-[13px] leading-5 text-[var(--lp-ink)]/65">
              {formSubtitle}
            </p>
            <HeroLeadForm
              formId={section.formId || 'preschool-ebook-hero'}
              selectLabel={extra.selectLabel}
              selectPlaceholder={extra.selectPlaceholder}
              selectOptions={extra.selectOptions && extra.selectOptions.length ? extra.selectOptions : undefined}
              buttonText={extra.submitText}
              noteLabel={section.title || formTitle}
              pixelContent={formTitle}
            />
          </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  BLOCK: Ebook Skills — "Bên trong sách có gì?" (ảnh + lưới icon)            */
/* ════════════════════════════════════════════════════════════════════════ */
const ebookCardColorMap: Record<string, string> = {
  'text-cta-orange': '#F45A0A',
  'text-accent-cyan': '#0EA5E9',
  'text-navy-deep': '#003B7A',
};

function ebookCardColor(value: string | undefined, index: number) {
  if (value?.startsWith('#')) return value;
  return ebookSkillPalette[index % ebookSkillPalette.length];
}

const ebookSkillPalette = ['#F45A0A', '#16A34A', '#8B5CF6', '#F59E0B', '#0EA5E9', '#EC4899'];

export function EbookSkillsBlock({ section }: { section: PageSection }) {
  const extra = parseJson<{ images?: string[]; cards?: { icon: string; title: string; desc: string; iconColor?: string; cardColor?: string; borderColor?: string }[] }>(section.extraData, {});
  const images = (extra.images && extra.images.length ? extra.images : [section.imageUrl]).filter(Boolean) as string[];
  const cards = extra.cards || [];

  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="relative">
            <ImageSlider images={images} alt={section.title || 'Bên trong sách'} sizeLabel="Ngang 4:3 · 1200×900px" />
          </div>
          <div>
            {section.subtitle && (
              <span className="lp-chip mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold uppercase tracking-wider">{section.subtitle}</span>
            )}
            <h2 className="font-montserrat text-[26px] font-extrabold leading-snug text-[var(--lp-ink)] sm:text-[32px]">{section.title}</h2>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {cards.map((c, i) => {
                const cardColor = c.cardColor && c.cardColor !== '#FFFFFF'
                  ? ebookCardColor(c.cardColor, i)
                  : ebookSkillPalette[i % ebookSkillPalette.length];
                return (
                  <div
                    key={c.title}
                    className="group relative flex min-h-[96px] items-center gap-3 overflow-hidden rounded-2xl p-4 text-white shadow-[0_18px_36px_-24px_rgba(0,47,95,.75)] transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
                    style={{ backgroundColor: cardColor }}
                  >
                    <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/10" />
                    <div className="absolute -bottom-4 -left-4 h-12 w-12 rounded-full bg-white/10" />
                    <span
                      className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white"
                    >
                      <Icon name={c.icon} className="text-[22px]" />
                    </span>
                    <div className="relative">
                      <h3 className="font-montserrat text-[15px] font-extrabold leading-tight text-white">{c.title}</h3>
                      {c.desc && <p className="mt-1 text-[12.5px] leading-5 text-white/82">{c.desc}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════════════════ */
/*  BLOCK: Ebook Why — "Vì sao nên tải?" (checklist + ảnh/slider)             */
/* ════════════════════════════════════════════════════════════════════════ */
export function EbookWhyBlock({ section }: { section: PageSection }) {
  const extra = parseJson<{ points?: string[]; images?: string[] }>(section.extraData, {});
  const points = extra.points || [];
  const images = (extra.images || []).filter(Boolean);

  return (
    <section className="bg-[var(--lp-sky-2)]">
      <div className="mx-auto max-w-[1240px] px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            {section.subtitle && (
              <span className="lp-chip mb-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold uppercase tracking-wider">{section.subtitle}</span>
            )}
            <h2 className="font-montserrat text-[26px] font-extrabold leading-snug text-[var(--lp-ink)] sm:text-[32px]">{section.title}</h2>
            {points.length > 0 && (
              <ul className="mt-6 space-y-3">
                {points.map((p) => (
                  <li key={p} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--lp-navy)] text-white">
                      <Icon name="check" className="text-[18px]" />
                    </span>
                    <span className="text-[15px] font-semibold leading-7 text-[var(--lp-ink)]">{p}</span>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={scrollToForm} className="lp-cta mt-7 inline-flex items-center justify-center gap-2 rounded-full px-7 py-4 text-[16px]">
              <Icon name="download" className="text-[20px]" />
              {section.buttonText || 'Tải ngay để xem đầy đủ'}
            </button>
          </div>
          <ImageSlider images={images} alt={section.title || 'Xem trước sách'} sizeLabel="Ngang 4:3 · 1200×900px" />
        </div>
      </div>
    </section>
  );
}
