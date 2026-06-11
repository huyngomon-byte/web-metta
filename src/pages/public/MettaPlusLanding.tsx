import { useEffect, useMemo, useState } from 'react';
import {
  BadgeCheck,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Compass,
  FileBadge2,
  GraduationCap,
  Lightbulb,
  MapPin,
  Mic2,
  Palette,
  Phone,
  Rocket,
  Send,
  Sparkles,
  Star,
  Trophy,
  Users,
} from 'lucide-react';
import { leadService } from '@/services/leadService';
import { cmsService } from '@/services/cmsService';
import { useThemeSettings } from '@/hooks/useCms';
import { pages as seedPages, sections as seedSections, siteSettings as seedSettings } from '@/data/seed';
import type { PageSection } from '@/types/cms';

const LOGO = '/brand/logo.png';
const HERO_IMAGE = '/brand/hero-classroom.png';
const SLOGAN = 'Giỏi ngoại ngữ, giàu kỹ năng, lãnh đạo tương lai';

const METTA_PLUS_SECTION_TYPES = [
  'Metta+ Hero',
  'Metta+ Benefits',
  'Metta+ Age Clubs',
  'Metta+ Pass',
  'Metta+ Journey',
  'Metta+ Reasons',
  'Metta+ Form',
] as const;

type MettaPlusSectionType = (typeof METTA_PLUS_SECTION_TYPES)[number];
type IconType = typeof Rocket;
type IconName =
  | 'BadgeCheck'
  | 'Bot'
  | 'CalendarCheck'
  | 'CheckCircle2'
  | 'ClipboardList'
  | 'Compass'
  | 'FileBadge2'
  | 'GraduationCap'
  | 'Lightbulb'
  | 'Mic2'
  | 'Palette'
  | 'Rocket'
  | 'Send'
  | 'Sparkles'
  | 'Star'
  | 'Trophy'
  | 'Users';
type ColorKey = 'orange' | 'green' | 'purple' | 'yellow' | 'blue' | 'pink';
type MettaPlusCard = { title: string; desc: string; icon: IconName; color: ColorKey };

type MettaPlusConfig = {
  heroBadge: string;
  headline: string;
  subHeadline: string;
  shortDescription: string;
  heroTags: string[];
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  heroImage: string;
  heroImageAlt: string;
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
  formTitle: string;
  formDesc: string;
  formHighlights: string[];
  formCta: string;
  formId: string;
};

const phoneRegex = /^0(3|5|7|8|9|1[2689])\d{8}$/;

function normalizePhone(phone: string) {
  return phone.replace(/[\s.\-()]/g, '').replace(/^\+84/, '0');
}

function scrollToForm() {
  document.getElementById('metta-plus-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

const iconMap: Record<IconName, IconType> = {
  BadgeCheck,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Compass,
  FileBadge2,
  GraduationCap,
  Lightbulb,
  Mic2,
  Palette,
  Rocket,
  Send,
  Sparkles,
  Star,
  Trophy,
  Users,
};

function getIcon(name?: string): IconType {
  return iconMap[(name || 'Star') as IconName] || Star;
}

const colorClasses: Record<ColorKey, string> = {
  orange: 'bg-[#FFF0E6] text-[#E85D12] ring-[#FFD2B4]',
  green: 'bg-[#EAF8EC] text-[#16833A] ring-[#BDEBC8]',
  purple: 'bg-[#F0ECFF] text-[#6B45D9] ring-[#D8CBFF]',
  yellow: 'bg-[#FFF7D7] text-[#B27600] ring-[#FFE891]',
  blue: 'bg-[#EAF5FF] text-[#1268C4] ring-[#B8DFFF]',
  pink: 'bg-[#FFEAF4] text-[#D82975] ring-[#FFC3DE]',
};

const solidClasses: Record<ColorKey, string> = {
  orange: 'bg-[#F37021] text-white shadow-[#F37021]/25',
  green: 'bg-[#32B45F] text-white shadow-[#32B45F]/25',
  purple: 'bg-[#7B61FF] text-white shadow-[#7B61FF]/25',
  yellow: 'bg-[#FFC83D] text-[#1E2B45] shadow-[#FFC83D]/25',
  blue: 'bg-[#1B8DF2] text-white shadow-[#1B8DF2]/25',
  pink: 'bg-[#FF5A9B] text-white shadow-[#FF5A9B]/25',
};

const DEFAULT_METTA_PLUS_CONFIG: MettaPlusConfig = {
  heroBadge: 'METTA+ PASS',
  headline: 'Mở khóa mùa hè quốc tế cho con',
  subHeadline: 'Trải nghiệm CLB Tiếng Anh, Kỹ năng và STEM Robotics tại Metta Academy.',
  shortDescription: 'Học vui - làm thật - tự tin thể hiện bản thân.',
  heroTags: ['4-15 tuổi', 'GVNN', 'STEM Robotics', 'Metta Passport'],
  heroPrimaryCta: 'Đăng ký tư vấn ngay',
  heroSecondaryCta: 'Giữ suất trải nghiệm cho bé',
  heroImage: HERO_IMAGE,
  heroImageAlt: 'Học sinh Metta Academy học tập vui vẻ',
  benefitsTitle: 'Con nhận được gì tại Metta+?',
  benefitsDesc: 'Một chương trình - nhiều kỹ năng nền tảng.',
  benefits: [
    { title: 'GVNN 100%', desc: 'Phản xạ tự nhiên.', icon: 'Users', color: 'blue' },
    { title: 'STEM & Robotics', desc: 'Học bằng thực hành.', icon: 'Bot', color: 'green' },
    { title: 'Tự tin thuyết trình', desc: 'Dám nói, dám thể hiện.', icon: 'Mic2', color: 'pink' },
    { title: 'Học qua dự án', desc: 'Có sản phẩm thật.', icon: 'Lightbulb', color: 'yellow' },
    { title: 'Metta Passport', desc: 'Lưu dấu tiến bộ.', icon: 'FileBadge2', color: 'purple' },
    { title: 'Trải nghiệm trước', desc: 'Dễ chọn lộ trình.', icon: 'CalendarCheck', color: 'orange' },
  ],
  agesTitle: 'Chọn CLB theo độ tuổi của bé',
  agesDesc: 'Mỗi độ tuổi có một hành trình khám phá riêng.',
  ageGroups: [
    { title: 'Mầm non', desc: 'Show & Tell, Phonics, Tiny Builders.', icon: 'Star', color: 'orange' },
    { title: 'Tiểu học bé', desc: 'Storytelling, Writing, Robo Code.', icon: 'Palette', color: 'green' },
    { title: 'Tiểu học lớn', desc: 'Public Speaking, Grammar, STEM.', icon: 'Rocket', color: 'blue' },
    { title: 'THCS', desc: 'Debate, Essay, AI & Robotics.', icon: 'GraduationCap', color: 'purple' },
  ],
  passTitle: 'Một chiếc Pass - nhiều trải nghiệm',
  passDesc: 'Cho con thử môi trường học thật trước khi đăng ký khóa dài hạn.',
  passCardTitle: 'Summer Club',
  passCardMeta: '4-15 tuổi · CLB hè · Showcase Day',
  passItems: ['Tham gia CLB phù hợp độ tuổi', 'Học kỹ năng với GVNN', 'Thực hành STEM Robotics', 'Có Metta Passport cá nhân', 'Tham gia Showcase cuối khóa'],
  passCta: 'Nhận tư vấn Metta+ Pass',
  journeyTitle: 'Hành trình Metta+ của bé',
  journeyDesc: 'Từ trải nghiệm đến tự tin thể hiện.',
  journey: [
    { title: 'Đăng ký Pass', desc: 'Nhận tư vấn lộ trình.', icon: 'ClipboardList', color: 'orange' },
    { title: 'Chọn CLB', desc: 'Theo tuổi và sở thích.', icon: 'Compass', color: 'blue' },
    { title: 'Học & thực hành', desc: 'Làm dự án thật.', icon: 'Bot', color: 'green' },
    { title: 'Showcase Day', desc: 'Tỏa sáng trước bố mẹ.', icon: 'Trophy', color: 'pink' },
  ],
  reasonsTitle: 'Vì sao phụ huynh chọn Metta+?',
  reasonsDesc: 'Trải nghiệm gọn, đầu ra rõ, con học thật.',
  reasons: [
    { title: 'Môi trường quốc tế', desc: 'Học tập chủ động.', icon: 'Sparkles', color: 'blue' },
    { title: 'Giáo viên chất lượng', desc: 'Đồng hành sát sao.', icon: 'BadgeCheck', color: 'green' },
    { title: 'Nội dung thực tế', desc: 'Không học chay.', icon: 'Lightbulb', color: 'yellow' },
    { title: 'Có đầu ra rõ ràng', desc: 'Dự án, chứng chỉ, passport.', icon: 'Trophy', color: 'purple' },
    { title: 'Phụ huynh dễ quyết định', desc: 'Trải nghiệm trước, chọn sau.', icon: 'CheckCircle2', color: 'orange' },
  ],
  formTitle: 'Đăng ký tư vấn Metta+ Pass',
  formDesc: 'Để lại thông tin, Metta Academy sẽ tư vấn CLB phù hợp cho bé.',
  formHighlights: ['Tư vấn CLB theo tuổi', 'Giữ suất trải nghiệm', 'Gợi ý lộ trình hè'],
  formCta: 'Nhận tư vấn ngay',
  formId: 'metta-plus-pass',
};

function parseObj<T extends object>(json: string | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? { ...fallback, ...parsed } : fallback;
  } catch {
    return fallback;
  }
}

function parseArr<T>(json: string | undefined, fallback: T[]): T[] {
  if (!json) return fallback;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) && parsed.length ? parsed as T[] : fallback;
  } catch {
    return fallback;
  }
}

function isMettaPlusSectionType(type: PageSection['type']): type is MettaPlusSectionType {
  return METTA_PLUS_SECTION_TYPES.includes(type as MettaPlusSectionType);
}

function fallbackSections() {
  return seedSections
    .filter((section) => section.pageId === 'page-metta-plus' && section.visible && isMettaPlusSectionType(section.type))
    .sort((a, b) => a.order - b.order);
}

function parseLegacyConfig(section?: PageSection) {
  if (!section?.extraData) return {};
  try {
    return JSON.parse(section.extraData) as Partial<MettaPlusConfig>;
  } catch {
    return {};
  }
}

function buildMettaPlusConfig(sections: PageSection[]): MettaPlusConfig {
  const legacy = sections.find((section) => section.type === 'Metta+ Landing');
  const config: MettaPlusConfig = { ...DEFAULT_METTA_PLUS_CONFIG, ...parseLegacyConfig(legacy) };

  sections.forEach((section) => {
    switch (section.type) {
      case 'Metta+ Hero': {
        const extra = parseObj(section.extraData, { badge: config.heroBadge, tags: config.heroTags, imageAlt: config.heroImageAlt });
        config.heroBadge = extra.badge || config.heroBadge;
        config.heroTags = extra.tags?.length ? extra.tags : config.heroTags;
        config.heroImageAlt = extra.imageAlt || config.heroImageAlt;
        config.headline = section.title || config.headline;
        config.subHeadline = section.subtitle || config.subHeadline;
        config.shortDescription = section.description || config.shortDescription;
        config.heroImage = section.imageUrl || config.heroImage;
        config.heroPrimaryCta = section.buttonText || config.heroPrimaryCta;
        config.heroSecondaryCta = section.button2Text || config.heroSecondaryCta;
        config.formId = section.formId || config.formId;
        break;
      }
      case 'Metta+ Benefits':
        config.benefitsTitle = section.title || config.benefitsTitle;
        config.benefitsDesc = section.subtitle || section.description || config.benefitsDesc;
        config.benefits = parseArr<MettaPlusCard>(section.extraData, config.benefits);
        break;
      case 'Metta+ Age Clubs':
        config.agesTitle = section.title || config.agesTitle;
        config.agesDesc = section.subtitle || section.description || config.agesDesc;
        config.ageGroups = parseArr<MettaPlusCard>(section.extraData, config.ageGroups);
        break;
      case 'Metta+ Pass': {
        const extra = parseObj(section.extraData, {
          passCardTitle: config.passCardTitle,
          passCardMeta: config.passCardMeta,
          passItems: config.passItems,
        });
        config.passTitle = section.title || config.passTitle;
        config.passDesc = section.subtitle || section.description || config.passDesc;
        config.passCta = section.buttonText || config.passCta;
        config.passCardTitle = extra.passCardTitle || config.passCardTitle;
        config.passCardMeta = extra.passCardMeta || config.passCardMeta;
        config.passItems = extra.passItems?.length ? extra.passItems : config.passItems;
        break;
      }
      case 'Metta+ Journey':
        config.journeyTitle = section.title || config.journeyTitle;
        config.journeyDesc = section.subtitle || section.description || config.journeyDesc;
        config.journey = parseArr<MettaPlusCard>(section.extraData, config.journey);
        break;
      case 'Metta+ Reasons':
        config.reasonsTitle = section.title || config.reasonsTitle;
        config.reasonsDesc = section.subtitle || section.description || config.reasonsDesc;
        config.reasons = parseArr<MettaPlusCard>(section.extraData, config.reasons);
        break;
      case 'Metta+ Form': {
        const extra = parseObj(section.extraData, { highlights: config.formHighlights });
        config.formTitle = section.title || config.formTitle;
        config.formDesc = section.subtitle || section.description || config.formDesc;
        config.formCta = section.buttonText || config.formCta;
        config.formId = section.formId || config.formId;
        config.formHighlights = extra.highlights?.length ? extra.highlights : config.formHighlights;
        break;
      }
    }
  });

  return config;
}

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mx-auto mb-8 max-w-2xl text-center sm:mb-10">
      <h2 className="font-montserrat text-[28px] font-extrabold leading-tight text-[#08244A] sm:text-[38px]">
        {title}
      </h2>
      <p className="mt-3 text-[15px] font-semibold leading-6 text-[#5D6B82] sm:text-[17px]">{desc}</p>
    </div>
  );
}

function MiniCard({ title, desc, icon, color }: MettaPlusCard) {
  const Icon = getIcon(icon);
  return (
    <article className={`rounded-[28px] p-5 shadow-[0_18px_42px_-24px_rgba(8,36,74,.35)] ring-1 ${colorClasses[color] || colorClasses.orange}`}>
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80 shadow-sm">
        <Icon className="h-6 w-6" strokeWidth={2.4} />
      </div>
      <h3 className="font-montserrat text-[18px] font-extrabold leading-tight">{title}</h3>
      <p className="mt-2 text-[14px] font-semibold leading-5 opacity-75">{desc}</p>
    </article>
  );
}

function MettaPlusForm({ ctaText, formId }: { ctaText: string; formId: string }) {
  const [form, setForm] = useState({ parentName: '', studentName: '', phone: '', age: '' });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const set = (key: keyof typeof form, value: string) => {
    if (error) setError('');
    setForm((current) => ({ ...current, [key]: value }));
  };

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setDone(false);
    const formData = new FormData(event.currentTarget);
    if (formData.get('company') || formData.get('website')) return;

    const parentName = form.parentName.trim();
    const studentName = form.studentName.trim();
    const phone = normalizePhone(form.phone);

    if (!parentName) return setError('Vui lòng nhập họ tên phụ huynh.');
    if (!studentName) return setError('Vui lòng nhập họ tên bé.');
    if (!phoneRegex.test(phone)) return setError('Số điện thoại chưa hợp lệ.');
    if (!form.age) return setError('Vui lòng chọn độ tuổi của bé.');

    setLoading(true);
    try {
      await leadService.publicSubmit(
        {
          fullName: studentName,
          parentName,
          studentName,
          phone,
          age: form.age,
          contactType: 'parent',
          source: 'Landing Page',
          interestedCourse: 'Metta+ Pass',
          initialNote: `Metta+ Pass · Độ tuổi: ${form.age}`,
          company: String(formData.get('company') || ''),
          website: String(formData.get('website') || ''),
        },
        formId || 'metta-plus-pass',
      );
      (window as any).fbq?.('track', 'Lead', { content_name: 'Metta+ Pass' });
      setForm({ parentName: '', studentName: '', phone: '', age: '' });
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không gửi được thông tin. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }

  const fieldClass =
    'h-[50px] w-full rounded-2xl border border-[#C8DAF1] bg-white px-4 text-[15px] font-semibold text-[#08244A] outline-none transition placeholder:text-[#9AA8B9] focus:border-[#F37021] focus:ring-4 focus:ring-[#F37021]/15';

  return (
    <form onSubmit={submit} className="relative grid gap-3.5" noValidate>
      <input className="hidden" name="company" tabIndex={-1} autoComplete="off" aria-hidden />
      <input className="hidden" name="website" tabIndex={-1} autoComplete="off" aria-hidden />
      {done ? (
        <div className="grid min-h-[300px] place-items-center text-center">
          <div>
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[28px] bg-[#EAF8EC] text-[#16833A]">
              <CheckCircle2 className="h-10 w-10" />
            </div>
            <h3 className="font-montserrat text-2xl font-extrabold text-[#08244A]">Metta đã nhận thông tin!</h3>
            <p className="mt-2 text-[15px] font-semibold leading-6 text-[#5D6B82]">
              Tư vấn viên sẽ liên hệ để gợi ý CLB phù hợp cho bé.
            </p>
          </div>
        </div>
      ) : (
        <>
          <label className="grid gap-1.5">
            <span className="text-[13px] font-extrabold text-[#08244A]">Họ tên phụ huynh *</span>
            <input className={fieldClass} value={form.parentName} onChange={(e) => set('parentName', e.target.value)} placeholder="VD: Nguyễn Thị Hương" autoComplete="name" required />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[13px] font-extrabold text-[#08244A]">Họ tên bé *</span>
            <input className={fieldClass} value={form.studentName} onChange={(e) => set('studentName', e.target.value)} placeholder="VD: Nguyễn Minh Anh" required />
          </label>
          <div className="grid gap-3.5 sm:grid-cols-[minmax(0,1fr)_150px]">
            <label className="grid min-w-0 gap-1.5">
              <span className="text-[13px] font-extrabold text-[#08244A]">Số điện thoại *</span>
              <input className={fieldClass} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="090 123 4567" inputMode="tel" autoComplete="tel" required />
            </label>
            <label className="grid min-w-0 gap-1.5">
              <span className="text-[13px] font-extrabold text-[#08244A]">Độ tuổi của bé *</span>
              <select className={`${fieldClass} pr-8`} value={form.age} onChange={(e) => set('age', e.target.value)} required>
                <option value="">Chọn tuổi</option>
                <option>4-6 tuổi</option>
                <option>7-9 tuổi</option>
                <option>10-12 tuổi</option>
                <option>13-15 tuổi</option>
              </select>
            </label>
          </div>
          <button type="submit" disabled={loading} className="mt-2 inline-flex h-[56px] items-center justify-center gap-2 rounded-2xl bg-[#F37021] px-6 text-[16px] font-extrabold text-white shadow-[0_18px_36px_-18px_rgba(243,112,33,.9)] transition hover:-translate-y-0.5 hover:bg-[#E85D12] disabled:opacity-60">
            {loading ? <Sparkles className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            {loading ? 'Đang gửi...' : ctaText}
          </button>
          {error && <p className="rounded-2xl bg-red-50 px-4 py-3 text-center text-[14px] font-bold text-red-600">{error}</p>}
        </>
      )}
    </form>
  );
}

function MiniFooter() {
  const { settings } = useThemeSettings();
  const s = settings || seedSettings;
  const hotline = s.hotline;
  const address = s.address;
  const fanpage = s.socials?.facebook;

  return (
    <footer className="bg-[#08244A] text-white">
      <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-white p-1.5">
              <img src={s.logoUrl || LOGO} alt="METTA Academy" className="h-9 w-auto object-contain" />
            </span>
            <span className="font-montserrat text-lg font-extrabold tracking-tight">METTA Academy</span>
          </div>
          <p className="text-[14px] font-medium text-white/80">{s.footerText || SLOGAN}</p>
          <div className="flex flex-col items-center gap-2 text-[14px] text-white/85 sm:flex-row sm:gap-6">
            {hotline && (
              <a href={`tel:${hotline.replace(/\s/g, '')}`} className="inline-flex items-center gap-2 hover:text-[#FFC83D]">
                <Phone className="h-[18px] w-[18px]" /> {hotline}
              </a>
            )}
            {address && (
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-[18px] w-[18px]" /> {address}
              </span>
            )}
          </div>
          {fanpage && (
            <a href={fanpage} target="_blank" rel="noreferrer" aria-label="Fanpage" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 transition hover:bg-[#F37021]">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7h-2.54v-2.9h2.54v-2.2c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.77l-.44 2.9h-2.33v7c4.78-.75 8.44-4.9 8.44-9.9 0-5.53-4.5-10.02-10-10.02z" /></svg>
            </a>
          )}
        </div>
        <div className="mt-8 border-t border-white/10 pt-5 text-center text-[12.5px] text-white/55">
          © {new Date().getFullYear()} METTA Academy. {SLOGAN}.
        </div>
      </div>
    </footer>
  );
}

export default function MettaPlusLanding() {
  const [sections, setSections] = useState<PageSection[]>(fallbackSections);
  const config = useMemo(() => buildMettaPlusConfig(sections), [sections]);
  const heroTags = useMemo(() => config.heroTags, [config.heroTags]);

  useEffect(() => {
    let active = true;
    async function load() {
      const page = await cmsService.getPageBySlug('metta-plus')
        || await cmsService.getPage('page-metta-plus')
        || seedPages.find((item) => item.id === 'page-metta-plus');
      if (!page) return;
      const items = await cmsService.getVisibleSections(page.id);
      const split = items.filter((item) => isMettaPlusSectionType(item.type)).sort((a, b) => a.order - b.order);
      if (active) setSections(split.length ? split : fallbackSections());
    }
    load().catch(() => {
      if (active) setSections(fallbackSections());
    });
    return () => { active = false; };
  }, []);

  const renderSection = (type: MettaPlusSectionType) => {
    switch (type) {
      case 'Metta+ Hero':
        return (
          <section id="top" className="relative">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_12%,rgba(255,200,61,.26),transparent_28%),radial-gradient(circle_at_92%_10%,rgba(123,97,255,.16),transparent_30%),linear-gradient(180deg,#FFFFFF_0%,#FFF7EC_100%)]" />
            <div className="relative mx-auto grid max-w-[1180px] items-center gap-10 px-5 py-12 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:py-16">
              <div>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#08244A] px-4 py-2 text-[12px] font-extrabold tracking-[0.16em] text-white shadow-lg shadow-[#08244A]/15">
                  <Sparkles className="h-4 w-4 text-[#FFC83D]" />
                  {config.heroBadge}
                </div>
                <h1 className="font-montserrat text-[42px] font-black leading-[1.04] tracking-normal text-[#08244A] sm:text-[56px] lg:text-[68px]">
                  {config.headline}
                </h1>
                <p className="mt-5 max-w-[620px] text-[18px] font-bold leading-8 text-[#31435F] sm:text-[21px]">
                  {config.subHeadline}
                </p>
                <p className="mt-3 text-[16px] font-extrabold text-[#F37021] sm:text-[18px]">
                  {config.shortDescription}
                </p>
                <div className="mt-6 flex flex-wrap gap-2.5">
                  {heroTags.map((tag, index) => {
                    const colors: ColorKey[] = ['orange', 'green', 'blue', 'purple'];
                    return (
                      <span key={tag} className={`rounded-full px-4 py-2 text-[13px] font-extrabold ring-1 ${colorClasses[colors[index % colors.length]]}`}>
                        {tag}
                      </span>
                    );
                  })}
                </div>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={scrollToForm} className="inline-flex h-[56px] items-center justify-center gap-2 rounded-2xl bg-[#F37021] px-7 text-[16px] font-extrabold text-white shadow-[0_20px_40px_-20px_rgba(243,112,33,.9)] transition hover:-translate-y-0.5 hover:bg-[#E85D12]">
                    {config.heroPrimaryCta}
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={scrollToForm} className="inline-flex h-[56px] items-center justify-center rounded-2xl border-2 border-[#08244A] bg-white px-7 text-[16px] font-extrabold text-[#08244A] transition hover:-translate-y-0.5 hover:bg-[#EAF5FF]">
                    {config.heroSecondaryCta}
                  </button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-5 top-10 z-10 hidden rotate-[-10deg] rounded-[24px] bg-[#FFC83D] px-4 py-3 text-[14px] font-black text-[#08244A] shadow-xl sm:block">
                  <span className="mr-1">★</span> Passport ready
                </div>
                <div className="absolute -right-2 top-2 z-10 rounded-[22px] bg-[#EAF8EC] p-3 text-[#16833A] shadow-xl">
                  <Bot className="h-8 w-8" />
                </div>
                <div className="absolute -bottom-3 left-8 z-10 rounded-[22px] bg-[#FFEAF4] p-3 text-[#D82975] shadow-xl">
                  <Mic2 className="h-8 w-8" />
                </div>
                <div className="relative overflow-hidden rounded-[38px] bg-white p-3 shadow-[0_34px_70px_-36px_rgba(8,36,74,.65)] ring-1 ring-[#E2EAF5]">
                  <img src={config.heroImage || HERO_IMAGE} alt={config.heroImageAlt} className="aspect-[4/3] w-full rounded-[30px] object-cover object-center" />
                </div>
              </div>
            </div>
          </section>
        );
      case 'Metta+ Benefits':
        return (
          <section className="bg-white px-5 py-14 sm:px-6 lg:py-18">
            <div className="mx-auto max-w-[1180px]">
              <SectionHeader title={config.benefitsTitle} desc={config.benefitsDesc} />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {config.benefits.map((card) => <MiniCard key={card.title} {...card} />)}
              </div>
            </div>
          </section>
        );
      case 'Metta+ Age Clubs':
        return (
          <section className="bg-[#F6FAFF] px-5 py-14 sm:px-6 lg:py-18">
            <div className="mx-auto max-w-[1180px]">
              <SectionHeader title={config.agesTitle} desc={config.agesDesc} />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {config.ageGroups.map((card) => {
                  const Icon = getIcon(card.icon);
                  return (
                    <article key={card.title} className={`min-h-[210px] rounded-[32px] p-6 shadow-[0_18px_42px_-24px_rgba(8,36,74,.35)] ${solidClasses[card.color] || solidClasses.orange}`}>
                      <div className="mb-7 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/24">
                        <Icon className="h-7 w-7" strokeWidth={2.4} />
                      </div>
                      <h3 className="font-montserrat text-[24px] font-extrabold leading-tight">{card.title}</h3>
                      <p className="mt-3 text-[15px] font-bold leading-6 opacity-85">{card.desc}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        );
      case 'Metta+ Pass':
        return (
          <section className="bg-white px-5 py-14 sm:px-6 lg:py-18">
            <div className="mx-auto max-w-[1060px]">
              <SectionHeader title={config.passTitle} desc={config.passDesc} />
              <div className="relative rounded-[38px] bg-[#08244A] p-5 text-white shadow-[0_32px_70px_-34px_rgba(8,36,74,.8)] sm:p-8 lg:p-10">
                <div className="absolute -right-4 -top-4 rounded-[28px] bg-[#FFC83D] p-4 text-[#08244A] shadow-xl">
                  <FileBadge2 className="h-9 w-9" />
                </div>
                <div className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-[30px] bg-white p-6 text-[#08244A] shadow-2xl">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[12px] font-black tracking-[0.18em] text-[#F37021]">{config.heroBadge}</p>
                        <h3 className="mt-4 font-montserrat text-[34px] font-black leading-none">{config.passCardTitle}</h3>
                      </div>
                      <img src={LOGO} alt="METTA Academy" className="h-10 w-auto" />
                    </div>
                    <div className="mt-8 grid grid-cols-3 gap-2">
                      {['ENG', 'STEM', 'SHOW'].map((label, index) => (
                        <div key={label} className={`rounded-2xl px-3 py-4 text-center text-[12px] font-black ${colorClasses[(['blue', 'green', 'orange'] as ColorKey[])[index]]}`}>
                          {label}
                        </div>
                      ))}
                    </div>
                    <p className="mt-7 rounded-2xl bg-[#F6FAFF] px-4 py-3 text-[14px] font-bold text-[#5D6B82]">
                      {config.passCardMeta}
                    </p>
                  </div>
                  <div>
                    <div className="grid gap-3">
                      {config.passItems.map((item) => (
                        <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-[15px] font-bold ring-1 ring-white/10">
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#FFC83D]" />
                          {item}
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={scrollToForm} className="mt-7 inline-flex h-[54px] items-center justify-center gap-2 rounded-2xl bg-[#FFC83D] px-6 text-[15px] font-black text-[#08244A] shadow-lg transition hover:-translate-y-0.5">
                      {config.passCta}
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        );
      case 'Metta+ Journey':
        return (
          <section className="bg-[#FFF7EC] px-5 py-14 sm:px-6 lg:py-18">
            <div className="mx-auto max-w-[1180px]">
              <SectionHeader title={config.journeyTitle} desc={config.journeyDesc} />
              <div className="grid gap-4 lg:grid-cols-4">
                {config.journey.map((step, index) => {
                  const Icon = getIcon(step.icon);
                  return (
                    <article key={step.title} className="relative rounded-[28px] bg-white p-5 shadow-[0_18px_42px_-24px_rgba(8,36,74,.35)] ring-1 ring-[#E8EEF7]">
                      <div className={`mb-5 flex h-[52px] w-[52px] items-center justify-center rounded-2xl ${colorClasses[step.color] || colorClasses.orange}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <span className="absolute right-5 top-5 font-montserrat text-[34px] font-black text-[#E8EEF7]">0{index + 1}</span>
                      <h3 className="font-montserrat text-[19px] font-extrabold text-[#08244A]">{step.title}</h3>
                      <p className="mt-2 text-[14px] font-semibold leading-5 text-[#5D6B82]">{step.desc}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        );
      case 'Metta+ Reasons':
        return (
          <section className="bg-white px-5 py-14 sm:px-6 lg:py-18">
            <div className="mx-auto max-w-[1180px]">
              <SectionHeader title={config.reasonsTitle} desc={config.reasonsDesc} />
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {config.reasons.map((card) => <MiniCard key={card.title} {...card} />)}
              </div>
            </div>
          </section>
        );
      case 'Metta+ Form':
        return (
          <section id="metta-plus-form" className="relative bg-[#EAF5FF] px-5 py-14 sm:px-6 lg:py-18">
            <div className="absolute left-8 top-10 hidden rounded-[24px] bg-[#FFC83D] p-4 text-[#08244A] shadow-xl md:block">
              <Star className="h-8 w-8" />
            </div>
            <div className="absolute bottom-10 right-8 hidden rounded-[24px] bg-[#F0ECFF] p-4 text-[#6B45D9] shadow-xl md:block">
              <FileBadge2 className="h-8 w-8" />
            </div>
            <div className="relative mx-auto grid max-w-[1060px] items-center gap-8 rounded-[40px] bg-white p-5 shadow-[0_34px_70px_-36px_rgba(8,36,74,.65)] ring-1 ring-[#DCE9F8] sm:p-8 lg:grid-cols-[0.88fr_1.12fr] lg:p-10">
              <div>
                <div className="mb-5 inline-flex rounded-full bg-[#FFF0E6] px-4 py-2 text-[12px] font-black tracking-[0.16em] text-[#E85D12]">
                  {config.heroBadge}
                </div>
                <h2 className="font-montserrat text-[31px] font-black leading-tight text-[#08244A] sm:text-[42px]">
                  {config.formTitle}
                </h2>
                <p className="mt-4 text-[16px] font-semibold leading-7 text-[#5D6B82]">
                  {config.formDesc}
                </p>
                <div className="mt-7 grid gap-3">
                  {config.formHighlights.map((item, index) => (
                    <div key={item} className="flex items-center gap-3 text-[15px] font-bold text-[#31435F]">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${colorClasses[(['green', 'yellow', 'pink'] as ColorKey[])[index % 3]]}`}>
                        <CheckCircle2 className="h-5 w-5" />
                      </span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-[30px] bg-[#F8FBFF] p-5 ring-1 ring-[#DCE9F8] sm:p-6">
                <MettaPlusForm ctaText={config.formCta} formId={config.formId} />
              </div>
            </div>
          </section>
        );
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#FFFDF8] font-inter text-[#08244A] antialiased">
      <header className="sticky top-0 z-40 border-b border-[#E8EEF7] bg-white/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-3 sm:px-6">
          <a href="#top" className="flex items-center gap-3">
            <img src={LOGO} alt="METTA Academy" className="h-10 w-auto object-contain" />
            <span className="hidden font-montserrat text-[15px] font-extrabold tracking-tight text-[#08244A] sm:block">METTA Academy</span>
          </a>
          <button type="button" onClick={scrollToForm} className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#F37021] px-5 text-[14px] font-extrabold text-white shadow-[0_16px_28px_-18px_rgba(243,112,33,.95)] transition hover:-translate-y-0.5 hover:bg-[#E85D12]">
            {config.heroPrimaryCta}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main>
        {sections
          .filter((section) => isMettaPlusSectionType(section.type))
          .map((section) => <div key={section.id}>{renderSection(section.type)}</div>)}
      </main>

      <MiniFooter />
    </div>
  );
}
