import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  BadgeCheck,
  Bot,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ClipboardList,
  Compass,
  FileBadge2,
  GraduationCap,
  Globe,
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
  X,
} from 'lucide-react';
import { usePublicThemeSettings } from '@/hooks/usePublicCms';
import { publicCmsService } from '@/services/publicCmsService';
import { publicLeadService } from '@/services/publicLeadService';
import { pages as seedPages, sections as seedSections, siteSettings as seedSettings } from '@/data/seed';
import type { MettaPlusPricingOffer, PageSection } from '@/types/cms';
import {
  BRAND_LOGOS,
  DEFAULT_DEAL_CURRENCY,
  PUBLIC_PROGRAMS,
  SUMMER_ENGLISH_WARMUP_ACTIVITIES,
  SUMMER_ENGLISH_WARMUP_NOTE,
  WON_LEAD_STATUS,
  leadStatuses,
  resolveCourseDealSizeForProgram,
  summerWeeklyColumnSchedule,
} from '@/lib/constants';
import { formatCurrency } from '@/lib/utils';

const HEADER_LOGO = BRAND_LOGOS.onWhite;
const FOOTER_LOGO = BRAND_LOGOS.onBlue;
const HERO_IMAGE = '/brand/hero-classroom.png';
const SLOGAN = 'Giỏi ngoại ngữ, giàu kỹ năng, lãnh đạo tương lai';
const SUMMER_HERO_IMAGE = '/brand/metta-summer-hero-4x3.jpg';
const SUMMER_QR_IMAGE = '/brand/metta-summer-2026-qr.jpg';
const SUMMER_PROGRAM = PUBLIC_PROGRAMS.find((program) => program.slug === 'metta-summer-2026');
const SUMMER_COURSE_NAME = SUMMER_PROGRAM?.title || 'METTA Summer 2026';
const SUMMER_COURSE_PACKAGE = SUMMER_PROGRAM?.courseName || 'Summer Camp · Đa bộ môn';
const SUMMER_DEAL_SIZE = resolveCourseDealSizeForProgram(SUMMER_PROGRAM);
const SUMMER_DEAL_CURRENCY = SUMMER_PROGRAM?.dealCurrency || DEFAULT_DEAL_CURRENCY;
const METTA_SUMMER_SLUG = 'metta-summer';
const LEGACY_METTA_PLUS_SLUG = 'metta-plus';
const DEFAULT_OFFER_ORIGINAL_PRICE = 2499000;
const DEFAULT_OFFER_SALE_PRICE = SUMMER_DEAL_SIZE || 1999000;
const DEFAULT_OFFER_DISCOUNT_PERCENT = 20;

const METTA_PLUS_SECTION_TYPES = [
  'Metta+ Hero',
  'Metta+ Benefits',
  'Metta+ Age Clubs',
  'Metta+ Pass',
  'Metta+ Journey',
  'Metta+ Weekly Plan',
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
type HeroTag = { label: string; color?: ColorKey };
type SummerLandingHeroSlide = { src: string; title: string; alt: string };
type SummerLandingPricing = Required<MettaPlusPricingOffer>;
type SummerWeeklyPlanExtra = {
  warmupNote?: string;
  warmupActivities?: string[];
  columns?: string[];
  rows?: string[][];
};

type MettaPlusConfig = {
  heroBadge: string;
  headline: string;
  subHeadline: string;
  shortDescription: string;
  heroTags: HeroTag[];
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  heroImage: string;
  heroImageAlt: string;
  heroSlides: SummerLandingHeroSlide[];
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
  passCardImage: string;
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
  offerOriginalPrice: number;
  offerSalePrice: number;
  offerDiscountPercent: number;
  offerCurrency: string;
};

const phoneRegex = /^0(3|5|7|8|9|1[2689])\d{8}$/;

function normalizePhone(phone: string) {
  return phone.replace(/[\s.\-()]/g, '').replace(/^\+84/, '0');
}

function formatCountdown(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((part) => String(part).padStart(2, '0')).join(':');
}

function secondsUntilEndOfDay() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  return Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
}

function useDailyCountdown() {
  const [countdown, setCountdown] = useState(() => formatCountdown(secondsUntilEndOfDay()));

  useEffect(() => {
    const update = () => setCountdown(formatCountdown(secondsUntilEndOfDay()));
    update();
    const interval = window.setInterval(update, 1000);
    return () => window.clearInterval(interval);
  }, []);

  return countdown;
}

function normalizeNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function normalizePricingOffer(offer: MettaPlusPricingOffer): Required<MettaPlusPricingOffer> {
  const originalPrice = normalizeNumber(offer.originalPrice, DEFAULT_OFFER_ORIGINAL_PRICE);
  const salePrice = normalizeNumber(offer.salePrice, DEFAULT_OFFER_SALE_PRICE);
  const computedDiscount = originalPrice > salePrice && originalPrice > 0
    ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
    : 0;
  return {
    originalPrice,
    salePrice,
    discountPercent: normalizeNumber(offer.discountPercent, computedDiscount || DEFAULT_OFFER_DISCOUNT_PERCENT),
    currency: offer.currency || SUMMER_DEAL_CURRENCY,
  };
}

function scrollToForm() {
  document.getElementById('metta-plus-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function scrollToRoadmap() {
  document.getElementById('metta-summer-roadmap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

const DEFAULT_SUMMER_HERO_SLIDES: SummerLandingHeroSlide[] = [
  { src: SUMMER_HERO_IMAGE, title: 'Mỹ thuật', alt: 'Học viên METTA Summer 2026 trong hoạt động mỹ thuật' },
  { src: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?auto=format&fit=crop&w=1200&q=80', title: 'Cờ vua', alt: 'Hoạt động cờ vua trong METTA Summer 2026' },
  { src: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=80', title: 'Thanh nhạc', alt: 'Hoạt động thanh nhạc trong METTA Summer 2026' },
  { src: 'https://images.unsplash.com/photo-1547153760-18fc86324498?auto=format&fit=crop&w=1200&q=80', title: 'Nhảy & Múa', alt: 'Hoạt động nhảy múa trong METTA Summer 2026' },
];

const DEFAULT_SUMMER_WEEKLY_PLAN: Required<SummerWeeklyPlanExtra> = {
  warmupNote: SUMMER_ENGLISH_WARMUP_NOTE,
  warmupActivities: [...SUMMER_ENGLISH_WARMUP_ACTIVITIES],
  columns: ['Tuần', 'Mỹ thuật', 'Cờ vua', 'Thanh nhạc', 'Nhảy & Múa'],
  rows: [
    ['Tuần 1', 'Làm quen màu sắc, hình khối và chất liệu mùa hè', 'Nhận biết bàn cờ, quân cờ và cách di chuyển cơ bản', 'Cảm thụ giai điệu, tư thế hát và luyện hơi nhẹ', 'Nhịp điệu cơ bản, làm quen chuyển động theo nhạc'],
    ['Tuần 2', 'Vẽ tranh chủ đề mùa hè và hoàn thiện sản phẩm nhỏ', 'Luật chơi, cách bảo vệ quân và bài tập quan sát', 'Hát nhóm, giữ nhịp và phát âm lời bài hát rõ ràng', 'Động tác tay chân cơ bản và phối hợp theo nhóm'],
    ['Tuần 3', 'Thủ công sáng tạo, phối màu và bố cục đơn giản', 'Chiến thuật khai cuộc đơn giản và tình huống mini', 'Luyện câu hát, biểu cảm và nghe bạn trong nhóm', 'Tổ hợp động tác ngắn và ghi nhớ đội hình'],
    ['Tuần 4', 'Dự án tranh cá nhân hoặc sản phẩm thủ công nâng cao', 'Mini game, xử lý nước đi và rèn tinh thần fair-play', 'Chọn tiết mục, luyện đoạn biểu diễn chính', 'Ráp bài nhóm, nhịp chuyển đoạn và tương tác sân khấu'],
    ['Tuần 5', 'Hoàn thiện sản phẩm trưng bày và đặt tên tác phẩm', 'Luyện mini tournament và cách bắt tay sau ván đấu', 'Tổng duyệt tiết mục hát nhóm hoặc cá nhân', 'Tổng duyệt bài nhảy/múa và biểu cảm trình diễn'],
    ['Tuần 6', 'Chuẩn bị góc triển lãm và chia sẻ về sản phẩm', 'Giải cờ vua mini trong không khí vui vẻ', 'Biểu diễn trong METTA Summer Showcase 2026', 'Trình diễn nhóm, nhận chứng nhận và chụp ảnh cùng phụ huynh'],
  ],
};

const DEFAULT_METTA_PLUS_CONFIG: MettaPlusConfig = {
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
  heroImage: SUMMER_HERO_IMAGE,
  heroImageAlt: 'Học viên METTA Summer 2026 trong hoạt động mùa hè',
  heroSlides: DEFAULT_SUMMER_HERO_SLIDES,
  benefitsTitle: 'Con nhận được gì trong mùa hè này?',
  benefitsDesc: 'Một chương trình hè cân bằng giữa nghệ thuật, tư duy, âm nhạc và vận động.',
  benefits: [
    { title: 'Mỹ thuật sáng tạo', desc: 'Vẽ, phối màu, thủ công và hoàn thiện sản phẩm trưng bày.', icon: 'Palette', color: 'orange' },
    { title: 'Cờ vua tư duy', desc: 'Làm quen luật chơi, nước đi và mini tournament vui vẻ.', icon: 'Compass', color: 'blue' },
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
  passCardImage: '',
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
  formTitle: 'Đăng ký tư vấn METTA Summer 2026',
  formDesc: 'Để lại thông tin, METTA Academy sẽ tư vấn lớp hè phù hợp và hướng dẫn phụ huynh hoàn tất đăng ký.',
  formHighlights: ['Tư vấn lớp hè theo tuổi', 'Gửi lịch học chi tiết', 'Hỗ trợ đăng ký và thanh toán QR'],
  formCta: 'Đăng ký tư vấn',
  formId: 'metta-summer-2026-landing',
  offerOriginalPrice: DEFAULT_OFFER_ORIGINAL_PRICE,
  offerSalePrice: DEFAULT_OFFER_SALE_PRICE,
  offerDiscountPercent: DEFAULT_OFFER_DISCOUNT_PERCENT,
  offerCurrency: SUMMER_DEAL_CURRENCY,
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

function isMettaPlusSection(section: PageSection): section is PageSection & { type: MettaPlusSectionType } {
  return isMettaPlusSectionType(section.type);
}

function fallbackSections() {
  return seedSections
    .filter((section) => section.pageId === 'page-metta-plus' && section.visible && isMettaPlusSection(section))
    .sort((a, b) => a.order - b.order);
}

function landingSlugFromPath(pathname: string) {
  const publicPageMatch = pathname.match(/^\/p\/([^/]+)/);
  if (publicPageMatch?.[1]) return publicPageMatch[1];
  if (pathname.includes(LEGACY_METTA_PLUS_SLUG)) return LEGACY_METTA_PLUS_SLUG;
  return METTA_SUMMER_SLUG;
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
        const extra = parseObj(section.extraData, {
          badge: config.heroBadge,
          tags: config.heroTags as (string | HeroTag)[],
          imageAlt: config.heroImageAlt,
          slides: config.heroSlides,
          offerOriginalPrice: config.offerOriginalPrice,
          offerSalePrice: config.offerSalePrice,
          offerDiscountPercent: config.offerDiscountPercent,
          offerCurrency: config.offerCurrency,
        });
        // Dùng ?? (nullish) thay || để admin xóa thành chuỗi rỗng vẫn được tôn trọng
        // (nếu dùng ||, "" sẽ rơi về default seed → field không bao giờ ẩn được).
        config.heroBadge = extra.badge ?? config.heroBadge;
        if (extra.tags?.length) {
          config.heroTags = extra.tags.map((tag) => typeof tag === 'string' ? { label: tag } : tag);
        }
        config.heroImageAlt = extra.imageAlt ?? config.heroImageAlt;
        config.offerOriginalPrice = normalizeNumber(extra.offerOriginalPrice, config.offerOriginalPrice);
        config.offerSalePrice = normalizeNumber(extra.offerSalePrice, config.offerSalePrice);
        config.offerDiscountPercent = normalizeNumber(extra.offerDiscountPercent, config.offerDiscountPercent);
        config.offerCurrency = extra.offerCurrency || config.offerCurrency;
        if (extra.slides?.length) {
          config.heroSlides = extra.slides
            .filter((slide) => slide?.src)
            .map((slide) => ({
              src: slide.src,
              title: slide.title || config.heroBadge,
              alt: slide.alt || config.heroImageAlt,
            }));
        }
        config.headline = section.title ?? config.headline;
        config.subHeadline = section.subtitle ?? config.subHeadline;
        config.shortDescription = section.description ?? config.shortDescription;
        config.heroImage = section.imageUrl ?? config.heroImage;
        config.heroPrimaryCta = section.buttonText ?? config.heroPrimaryCta;
        config.heroSecondaryCta = section.button2Text ?? config.heroSecondaryCta;
        config.formId = section.formId ?? config.formId;
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
        config.passCardImage = section.imageUrl || config.passCardImage;
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

function SectionHeader({ title, desc, wide = false }: { title: string; desc: string; wide?: boolean }) {
  return (
    <div className={`mx-auto mb-8 text-center sm:mb-10 ${wide ? 'max-w-4xl' : 'max-w-2xl'}`}>
      <h2 className={`font-montserrat text-[28px] font-extrabold leading-tight text-[#08244A] sm:text-[38px] ${wide ? 'lg:whitespace-nowrap' : ''}`}>
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

function normalizeWeeklyPlan(section: PageSection): Required<SummerWeeklyPlanExtra> {
  const extra = parseObj<SummerWeeklyPlanExtra>(section.extraData, DEFAULT_SUMMER_WEEKLY_PLAN);
  const columns = extra.columns?.length ? extra.columns : DEFAULT_SUMMER_WEEKLY_PLAN.columns;
  const rows = (extra.rows?.length ? extra.rows : DEFAULT_SUMMER_WEEKLY_PLAN.rows)
    .map((row) => columns.map((_, index) => row[index] || ''));
  return {
    warmupNote: extra.warmupNote ?? DEFAULT_SUMMER_WEEKLY_PLAN.warmupNote,
    warmupActivities: extra.warmupActivities?.length ? extra.warmupActivities : DEFAULT_SUMMER_WEEKLY_PLAN.warmupActivities,
    columns,
    rows,
  };
}

function SummerWeeklyPlanTable({ section }: { section: PageSection }) {
  const [open, setOpen] = useState(true);
  const plan = normalizeWeeklyPlan(section);

  if (!plan.rows.length) return null;

  return (
    <section id="metta-summer-weekly-plan" className="bg-[#FFF7EC] px-5 pb-14 sm:px-6 lg:pb-18">
      <div className="mx-auto max-w-[1180px]">
        <div className="overflow-hidden rounded-[34px] bg-white shadow-[0_26px_65px_-36px_rgba(8,36,74,.42)] ring-1 ring-[#E8EEF7]">
          <div className="flex flex-col gap-4 border-b border-[#E8EEF7] bg-white px-5 py-5 sm:px-7 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.16em] text-[#F37021]">METTA Summer 2026</p>
              <h2 className="mt-2 font-montserrat text-[26px] font-black leading-tight text-[#08244A] sm:text-[36px]">
                {section.title || 'Lộ trình chi tiết từng tuần'}
              </h2>
              {(section.subtitle || section.description) && (
                <p className="mt-2 max-w-3xl text-[15px] font-semibold leading-6 text-[#5D6B82] sm:text-[16px]">
                  {section.subtitle || section.description}
                </p>
              )}
            </div>
            <button
              type="button"
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-2xl border border-[#DCE9F8] bg-[#F6FAFF] px-4 text-sm font-extrabold text-[#08244A] transition hover:border-[#F37021]/35 hover:bg-[#FFF0E6]"
              onClick={() => setOpen((current) => !current)}
              aria-expanded={open}
            >
              {open ? 'Thu gọn' : 'Xem chi tiết'}
              <span className="ml-2 text-xl leading-none">{open ? '−' : '+'}</span>
            </button>
          </div>
          {open && (
            <div>
              <div className="border-b border-[#E8EEF7] bg-[#FFF9F2] px-5 py-4 sm:px-7">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FFF0E6] text-[#F37021] ring-1 ring-[#FFD2B4]">
                    <Globe size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-[#08244A]">{plan.warmupNote}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {plan.warmupActivities.map((activity) => (
                        <span key={activity} className="rounded-full border border-[#DCE9F8] bg-white px-3 py-1 text-xs font-bold text-[#31435F]">
                          {activity}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] table-fixed text-sm">
                  <colgroup>
                    {plan.columns.map((column, index) => (
                      <col key={`${column}-${index}`} className={index === 0 ? 'w-[118px]' : undefined} />
                    ))}
                  </colgroup>
                  <thead className="bg-[#F6FAFF] text-[12px] tracking-[0.08em] text-[#31435F]">
                    <tr>
                      {plan.columns.map((col, index) => {
                        const schedule = summerWeeklyColumnSchedule(col);
                        return (
                          <th key={`${col}-${index}`} className="px-4 py-4 text-center align-top">
                            <span className="block whitespace-nowrap font-black uppercase">{col}</span>
                            {schedule && (
                              <span className="mt-1.5 block whitespace-nowrap text-[12px] font-extrabold leading-5 tracking-normal text-[#F37021]">
                                {schedule}
                              </span>
                            )}
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {plan.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="border-t border-[#E8EEF7] even:bg-[#FFFCF8]">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className={cellIndex === 0 ? 'whitespace-nowrap px-4 py-5 text-center font-black text-[#F37021]' : 'px-4 py-5 text-center font-semibold leading-6 text-[#31435F]'}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function MettaPlusForm({ ctaText, formId, pricing }: { ctaText: string; formId: string; pricing: SummerLandingPricing }) {
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
      await publicLeadService.submit(
        {
          fullName: studentName,
          parentName,
          studentName,
          phone,
          age: form.age,
          contactType: 'parent',
          source: 'Landing Page - METTA Summer 2026',
          interestedCourse: SUMMER_COURSE_NAME,
          status: leadStatuses[0],
          dealSize: pricing.salePrice,
          dealCurrency: pricing.currency,
          expectedRevenue: pricing.salePrice,
          dealPackage: SUMMER_COURSE_PACKAGE,
          initialNote: `METTA Summer 2026 landing page · Độ tuổi: ${form.age}`,
          company: String(formData.get('company') || ''),
          website: String(formData.get('website') || ''),
        },
        formId || 'metta-summer-2026-landing',
      );
      (window as any).fbq?.('track', 'Lead', { content_name: SUMMER_COURSE_NAME });
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
              Tư vấn viên sẽ liên hệ để gợi ý lớp hè phù hợp cho bé.
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
                <option>6-8 tuổi</option>
                <option>9-11 tuổi</option>
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

function SummerLandingRegistrationModal({ onClose, pricing }: { onClose: () => void; pricing: SummerLandingPricing }) {
  const [parentName, setParentName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loadingAction, setLoadingAction] = useState<'consult' | 'paid' | null>(null);

  const normalizedPhone = normalizePhone(phone);
  const transferName = parentName.trim() || 'Tên phụ huynh';
  const transferPhone = normalizedPhone || 'SĐT';
  const transferContent = `${transferName} - ${transferPhone}`;
  const originalPriceLabel = formatCurrency(pricing.originalPrice, pricing.currency);
  const salePriceLabel = formatCurrency(pricing.salePrice, pricing.currency);
  const discountLabel = `-${Math.round(pricing.discountPercent)}%`;

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  async function submitRegistration(action: 'consult' | 'paid') {
    setError('');
    setSuccessMessage('');

    const cleanParentName = parentName.replace(/\s+/g, ' ').trim();
    const cleanStudentName = studentName.replace(/\s+/g, ' ').trim();
    const cleanPhone = normalizePhone(phone);

    if (!cleanParentName || !cleanStudentName || !cleanPhone) {
      setError('Vui lòng nhập tên phụ huynh, tên bé và số điện thoại.');
      return;
    }

    if (!phoneRegex.test(cleanPhone)) {
      setError('Số điện thoại chưa đúng định dạng.');
      return;
    }

    const paid = action === 'paid';
    setLoadingAction(action);
    try {
      await publicLeadService.submit({
        fullName: cleanStudentName,
        parentName: cleanParentName,
        studentName: cleanStudentName,
        phone: cleanPhone,
        contactType: 'parent',
        source: paid ? 'Landing Page - METTA Summer 2026 QR chuyển khoản' : 'Landing Page - METTA Summer 2026 đăng ký ngay',
        interestedCourse: SUMMER_COURSE_NAME,
        status: paid ? WON_LEAD_STATUS : leadStatuses[0],
        tags: paid ? ['Cần check CK'] : undefined,
        dealSize: pricing.salePrice,
        dealCurrency: pricing.currency,
        expectedRevenue: pricing.salePrice,
        revenue: paid ? pricing.salePrice : undefined,
        dealPackage: SUMMER_COURSE_PACKAGE,
        dealNote: `ND CK: ${cleanParentName} - ${cleanPhone}`,
        initialNote: paid
          ? `Phụ huynh chọn Đã chuyển khoản trên landing page METTA Summer 2026. ND CK: ${cleanParentName} - ${cleanPhone}. Sales kiểm tra giao dịch Techcombank.`
          : `Phụ huynh chọn Cần tư vấn thêm trên landing page METTA Summer 2026. ND CK gợi ý: ${cleanParentName} - ${cleanPhone}.`,
      }, paid ? 'metta-summer-2026-landing-paid-popup' : 'metta-summer-2026-landing-consult-popup');

      setSuccessMessage(paid
        ? 'Đã ghi nhận đăng ký học METTA Summer 2026. Sales METTA sẽ kiểm tra chuyển khoản.'
        : 'METTA đã nhận thông tin. Tư vấn viên sẽ liên hệ để hỗ trợ phụ huynh đăng ký lớp hè.');
      (window as any).fbq?.('track', 'Lead', { content_name: SUMMER_COURSE_NAME });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không gửi được thông tin. Vui lòng thử lại.');
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/60 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="summer-landing-registration-title">
      <div className="mx-auto flex min-h-full max-w-5xl items-center justify-center">
        <div className="relative w-full overflow-hidden rounded-3xl bg-white shadow-2xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 transition-colors hover:text-slate-900"
            aria-label="Đóng form đăng ký"
          >
            <X size={20} />
          </button>

          <div className="grid lg:grid-cols-[1fr_0.95fr]">
            <div className="p-5 sm:p-7 lg:p-8">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#F37021]">METTA Summer 2026</p>
              <h2 id="summer-landing-registration-title" className="mt-3 text-2xl font-extrabold leading-tight text-[#08244A] sm:text-3xl">
                Đăng ký ngay
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Điền thông tin để METTA ghi nhận đăng ký và hỗ trợ phụ huynh hoàn tất lớp hè cho con.
              </p>

              <div className="mt-6 grid gap-4">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Tên phụ huynh</span>
                  <input
                    value={parentName}
                    onChange={(event) => setParentName(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#1B8DF2] focus:ring-4 focus:ring-[#1B8DF2]/15"
                    placeholder="Ví dụ: Nguyễn Minh Anh"
                    autoFocus
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Tên bé</span>
                  <input
                    value={studentName}
                    onChange={(event) => setStudentName(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#1B8DF2] focus:ring-4 focus:ring-[#1B8DF2]/15"
                    placeholder="Ví dụ: Minh Khôi"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Số điện thoại</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#1B8DF2] focus:ring-4 focus:ring-[#1B8DF2]/15"
                    placeholder="Ví dụ: 0912345678"
                    inputMode="tel"
                  />
                </label>
              </div>

              <div className="mt-5 rounded-2xl border border-[#FFC83D]/45 bg-[#FFF8EA] p-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#F37021]">Nội dung chuyển khoản</p>
                <p className="mt-2 break-words text-lg font-extrabold text-slate-950">{transferContent}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-400 line-through">{originalPriceLabel}</span>
                  <span className="text-lg font-extrabold text-[#F37021]">{salePriceLabel}</span>
                  <span className="rounded-full bg-[#F37021]/10 px-2.5 py-1 text-xs font-extrabold text-[#F37021]">{discountLabel}</span>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-600">Trọn khóa METTA Summer 2026</p>
              </div>

              {error && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}
              {successMessage && (
                <div className="mt-4 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => submitRegistration('consult')}
                  disabled={Boolean(loadingAction)}
                  className="inline-flex items-center justify-center rounded-2xl border-2 border-[#08244A]/15 bg-white px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-[#08244A] transition-all hover:-translate-y-0.5 hover:bg-[#F6FAFF] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingAction === 'consult' ? 'Đang gửi...' : 'Cần tư vấn thêm'}
                </button>
                <button
                  type="button"
                  onClick={() => submitRegistration('paid')}
                  disabled={Boolean(loadingAction)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F37021] px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-white shadow-lg shadow-orange-600/25 transition-all hover:-translate-y-0.5 hover:bg-[#E85D12] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingAction === 'paid' ? 'Đang ghi nhận...' : 'Đã chuyển khoản'} <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#EAF5FF] via-white to-[#FFF8EA] p-5 sm:p-7 lg:p-8">
              <div className="rounded-3xl bg-white p-4 shadow-xl shadow-[#08244A]/10">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-400">Thanh toán</p>
                    <p className="mt-1 text-lg font-extrabold text-[#08244A]">Mã QR METTA Summer</p>
                  </div>
                  <span className="rounded-full bg-[#F37021]/10 px-3 py-1 text-xs font-extrabold text-[#F37021]">{salePriceLabel}</span>
                </div>

                <img
                  src={SUMMER_QR_IMAGE}
                  alt="Mã QR thanh toán METTA Summer 2026"
                  className="mx-auto mt-5 w-full max-w-[300px] rounded-2xl border border-slate-100 object-contain"
                />

                <div className="mt-5 rounded-2xl bg-[#FFF8EA] p-4 text-center">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#F37021]">ND CK</p>
                  <p className="mt-2 break-words text-base font-extrabold text-slate-950">{transferContent}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniFooter() {
  const { settings, loading } = usePublicThemeSettings();
  if (loading && !settings) return null;

  const s = settings || seedSettings;
  const hotline = s.hotline;
  const address = s.address;
  const fanpage = s.socials?.facebook;

  return (
    <footer className="bg-[#08244A] text-white">
      <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex items-center gap-3">
            <img src={FOOTER_LOGO} alt="METTA Academy" className="h-[58px] w-auto max-w-[230px] object-contain sm:h-16" />
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
  const location = useLocation();
  // null = chưa load xong (hiện skeleton để tránh "flash" bản cũ).
  const [sections, setSections] = useState<PageSection[] | null>(null);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const config = useMemo(() => buildMettaPlusConfig(sections ?? []), [sections]);
  const countdown = useDailyCountdown();
  const pricing = useMemo(() => normalizePricingOffer({
    originalPrice: config.offerOriginalPrice,
    salePrice: config.offerSalePrice,
    discountPercent: config.offerDiscountPercent,
    currency: config.offerCurrency,
  }), [config.offerCurrency, config.offerDiscountPercent, config.offerOriginalPrice, config.offerSalePrice]);
  const heroTags = useMemo(() => config.heroTags, [config.heroTags]);
  const heroSlides = useMemo<SummerLandingHeroSlide[]>(() => {
    const editableSlides = config.heroSlides?.length ? config.heroSlides : [];
    const slides: SummerLandingHeroSlide[] = editableSlides.length
      ? editableSlides
      : (config.heroImage ? [{ src: config.heroImage, title: config.heroBadge, alt: config.heroImageAlt }] : DEFAULT_SUMMER_HERO_SLIDES);

    return slides
      .filter((slide) => slide.src)
      .map((slide) => ({ src: slide.src, title: slide.title || config.heroBadge, alt: slide.alt || config.heroImageAlt }))
      .filter((slide, index, allSlides) => allSlides.findIndex((item) => item.src === slide.src) === index);
  }, [config.heroBadge, config.heroImage, config.heroImageAlt, config.heroSlides]);
  const activeHeroIndex = heroSlides.length ? Math.min(heroSlideIndex, heroSlides.length - 1) : 0;
  const activeHeroSlide = heroSlides[activeHeroIndex] || { src: config.heroImage || HERO_IMAGE, title: config.heroBadge, alt: config.heroImageAlt };
  const offerOriginalPriceLabel = formatCurrency(pricing.originalPrice, pricing.currency);
  const offerSalePriceLabel = formatCurrency(pricing.salePrice, pricing.currency);
  const offerDiscountLabel = `-${Math.round(pricing.discountPercent)}%`;
  const openRegistration = () => setRegistrationOpen(true);

  useEffect(() => {
    if (heroSlides.length > 0 && heroSlideIndex >= heroSlides.length) setHeroSlideIndex(0);
  }, [heroSlideIndex, heroSlides.length]);

  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setHeroSlideIndex((current) => (current + 1) % heroSlides.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  const moveHeroSlide = (direction: number) => {
    setHeroSlideIndex((current) => {
      if (!heroSlides.length) return 0;
      return (current + direction + heroSlides.length) % heroSlides.length;
    });
  };

  useEffect(() => {
    let active = true;
    async function load() {
      const slug = landingSlugFromPath(location.pathname);
      const page = await publicCmsService.getPageBySlug(slug)
        || await publicCmsService.getPageBySlug(METTA_SUMMER_SLUG)
        || await publicCmsService.getPageBySlug(LEGACY_METTA_PLUS_SLUG)
        || await publicCmsService.getPage('page-metta-plus')
        || seedPages.find((item) => item.id === 'page-metta-plus');
      if (!page) {
        if (active) setSections(fallbackSections());
        return;
      }
      const items = await publicCmsService.getVisibleSections(page.id);
      const split = items.filter((item) => isMettaPlusSectionType(item.type)).sort((a, b) => a.order - b.order);
      if (active) setSections(split.length ? split : fallbackSections());
    }
    load().catch(() => {
      if (active) setSections(fallbackSections());
    });
    return () => { active = false; };
  }, [location.pathname]);

  if (sections === null) return <MettaPlusSkeleton />;

  const renderSection = (section: PageSection & { type: MettaPlusSectionType }) => {
    switch (section.type) {
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
                {config.subHeadline && (
                  <p className="mt-5 max-w-[620px] text-[18px] font-bold leading-8 text-[#31435F] sm:text-[21px]">
                    {config.subHeadline}
                  </p>
                )}
                {config.shortDescription && (
                  <p className="mt-3 text-[16px] font-extrabold text-[#F37021] sm:text-[18px]">
                    {config.shortDescription}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap gap-2.5">
                  {heroTags.map((tag, index) => {
                    const cycle: ColorKey[] = ['orange', 'green', 'blue', 'purple'];
                    const color = tag.color || cycle[index % cycle.length];
                    return (
                      <span key={`${tag.label}-${index}`} className={`rounded-full px-4 py-2 text-[13px] font-extrabold ring-1 ${colorClasses[color]}`}>
                        {tag.label}
                      </span>
                    );
                  })}
                </div>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <button type="button" onClick={openRegistration} className="pulse-cta inline-flex h-[56px] items-center justify-center gap-2 rounded-2xl bg-[#F37021] px-7 text-[16px] font-extrabold text-white shadow-[0_20px_40px_-20px_rgba(243,112,33,.9)] transition hover:-translate-y-0.5 hover:bg-[#E85D12]">
                    {config.heroPrimaryCta}
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  {config.heroSecondaryCta && (
                    <button type="button" onClick={scrollToRoadmap} className="inline-flex h-[56px] items-center justify-center rounded-2xl border-2 border-[#08244A] bg-white px-7 text-[16px] font-extrabold text-[#08244A] transition hover:-translate-y-0.5 hover:bg-[#EAF5FF]">
                      {config.heroSecondaryCta}
                    </button>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2 text-[13px] font-extrabold">
                  <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[#08244A] shadow-sm ring-1 ring-[#E8EEF7]">
                    <span className="text-slate-400 line-through">{offerOriginalPriceLabel}</span>
                    <span className="text-[#F37021]">{offerSalePriceLabel}</span>
                    <span className="rounded-full bg-[#F37021]/10 px-2 py-0.5 text-[11px] text-[#F37021]">{offerDiscountLabel}</span>
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#FFF0E6] px-4 py-2 text-[#E85D12] ring-1 ring-[#FFD2B4]">
                    <Clock className="h-4 w-4" />
                    Ưu đãi kết thúc sau <span className="font-black tabular-nums">{countdown}</span>
                  </span>
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-5 top-10 z-10 hidden rotate-[-10deg] rounded-[24px] bg-[#FFC83D] px-4 py-3 text-[14px] font-black text-[#08244A] shadow-xl sm:block">
                  <span className="mr-1">★</span> Showcase ready
                </div>
                <div className="absolute -right-2 top-2 z-10 rounded-[22px] bg-[#EAF8EC] p-3 text-[#16833A] shadow-xl">
                  <Palette className="h-8 w-8" />
                </div>
                <div className="absolute -bottom-3 left-8 z-10 rounded-[22px] bg-[#FFEAF4] p-3 text-[#D82975] shadow-xl">
                  <Trophy className="h-8 w-8" />
                </div>
                <div className="relative overflow-hidden rounded-[38px] bg-white p-3 shadow-[0_34px_70px_-36px_rgba(8,36,74,.65)] ring-1 ring-[#E2EAF5]">
                  <div className="relative aspect-[4/3] overflow-hidden rounded-[30px] bg-[#EAF5FF]">
                    {heroSlides.map((slide, index) => (
                      <img
                        key={slide.src}
                        src={slide.src}
                        alt={slide.alt}
                        className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-500 ${index === activeHeroIndex ? 'opacity-100' : 'opacity-0'}`}
                      />
                    ))}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#08244A]/82 via-[#08244A]/32 to-transparent px-5 pb-5 pt-12">
                      <p className="text-sm font-black uppercase tracking-[0.18em] text-white/75">METTA Summer 2026</p>
                      <p className="mt-1 font-montserrat text-2xl font-black text-white">{activeHeroSlide.title}</p>
                    </div>
                    {heroSlides.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={() => moveHeroSlide(-1)}
                          className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-[#08244A] shadow-lg transition hover:bg-white"
                          aria-label="Ảnh hero trước"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveHeroSlide(1)}
                          className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-[#F37021] text-white shadow-lg transition hover:bg-[#E85D12]"
                          aria-label="Ảnh hero tiếp theo"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </button>
                      </>
                    )}
                  </div>
                  {heroSlides.length > 1 && (
                    <div className="mt-3 grid grid-cols-4 gap-2">
                      {heroSlides.slice(0, 4).map((slide, index) => (
                        <button
                          key={`preview-${slide.src}`}
                          type="button"
                          onClick={() => setHeroSlideIndex(index)}
                          className={`group aspect-[4/3] overflow-hidden rounded-2xl ring-2 transition ${index === activeHeroIndex ? 'ring-[#F37021]' : 'ring-transparent hover:ring-[#F37021]/45'}`}
                          aria-label={`Xem ảnh ${slide.title}`}
                        >
                          <img src={slide.src} alt="" className="h-full w-full object-cover object-center transition group-hover:scale-105" />
                        </button>
                      ))}
                    </div>
                  )}
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
            <div className="mx-auto max-w-[1200px]">
              <SectionHeader title={config.passTitle} desc={config.passDesc} wide />
              <div className="relative rounded-[38px] bg-[#08244A] p-5 text-white shadow-[0_32px_70px_-34px_rgba(8,36,74,.8)] sm:p-8 lg:p-12">
                <div className="absolute -right-4 -top-4 rounded-[28px] bg-[#FFC83D] p-4 text-[#08244A] shadow-xl">
                  <FileBadge2 className="h-9 w-9" />
                </div>
                <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
                  {config.passCardImage ? (
                    <img
                      src={config.passCardImage}
                      alt={config.passCardTitle}
                      loading="lazy"
                      decoding="async"
                      className="w-full rounded-[30px] object-cover shadow-2xl"
                    />
                  ) : (
                    <div className="rounded-[30px] bg-white p-8 text-[#08244A] shadow-2xl">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[12px] font-black tracking-[0.18em] text-[#F37021]">{config.heroBadge}</p>
                          <h3 className="mt-4 font-montserrat text-[38px] font-black leading-none">{config.passCardTitle}</h3>
                        </div>
                        <img src={HEADER_LOGO} alt="METTA Academy" className="h-10 w-auto" />
                      </div>
                      <div className="mt-8 grid grid-cols-3 gap-2.5">
                        {['ART', 'CHESS', 'SHOW'].map((label, index) => (
                          <div key={label} className={`rounded-2xl px-3 py-5 text-center text-[13px] font-black ${colorClasses[(['blue', 'green', 'orange'] as ColorKey[])[index]]}`}>
                            {label}
                          </div>
                        ))}
                      </div>
                      <p className="mt-7 rounded-2xl bg-[#F6FAFF] px-4 py-3 text-[14px] font-bold text-[#5D6B82]">
                        {config.passCardMeta}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl bg-[#FFF8EA] px-4 py-3 text-[14px] font-black">
                        <span className="text-slate-400 line-through">{offerOriginalPriceLabel}</span>
                        <span className="text-[#F37021]">{offerSalePriceLabel}</span>
                        <span className="rounded-full bg-[#F37021]/10 px-2.5 py-1 text-[11px] text-[#F37021]">{offerDiscountLabel}</span>
                      </div>
                    </div>
                  )}
                  <div>
                    <div className="grid gap-3">
                      {config.passItems.map((item) => (
                        <div key={item} className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 text-[15px] font-bold ring-1 ring-white/10">
                          <CheckCircle2 className="h-5 w-5 shrink-0 text-[#FFC83D]" />
                          {item}
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={openRegistration} className="mt-7 inline-flex h-[54px] items-center justify-center gap-2 rounded-2xl bg-[#FFC83D] px-6 text-[15px] font-black text-[#08244A] shadow-lg transition hover:-translate-y-0.5">
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
          <section id="metta-summer-roadmap" className="bg-[#FFF7EC] px-5 py-14 sm:px-6 lg:py-18">
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
      case 'Metta+ Weekly Plan':
        return <SummerWeeklyPlanTable section={section} />;
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
                <MettaPlusForm ctaText={config.formCta} formId={config.formId} pricing={pricing} />
              </div>
            </div>
          </section>
        );
    }
  };

  return (
    <div className="min-h-screen overflow-hidden bg-[#FFFDF8] font-inter text-[#08244A] antialiased">
      <header className="sticky top-0 z-50 border-b border-[#E8EEF7] bg-white/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-3 sm:px-6">
          <a href="#top" className="flex items-center gap-2.5">
            <img src={HEADER_LOGO} alt="METTA Academy" className="h-[52px] w-auto object-contain sm:h-[58px]" />
          </a>
          <button type="button" onClick={openRegistration} className="pulse-cta inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#F37021] px-5 text-[14px] font-extrabold text-white shadow-[0_16px_28px_-18px_rgba(243,112,33,.95)] transition hover:-translate-y-0.5 hover:bg-[#E85D12]">
            {config.heroPrimaryCta}
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main>
        {sections
          .filter(isMettaPlusSection)
          .map((section) => <div key={section.id}>{renderSection(section)}</div>)}
      </main>

      {registrationOpen && <SummerLandingRegistrationModal onClose={() => setRegistrationOpen(false)} pricing={pricing} />}

      <MiniFooter />
    </div>
  );
}

// Skeleton hiển thị trong lúc fetch CMS, đồng tone Metta+ (kem/trắng) để
// trang load lại không bị "flash" nội dung seed cũ trước khi đè bằng dữ liệu mới.
function MettaPlusSkeleton() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#FFFDF8] font-inter text-[#08244A] antialiased">
      <header className="sticky top-0 z-50 border-b border-[#E8EEF7] bg-white/88 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-5 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <img src={HEADER_LOGO} alt="METTA Academy" className="h-[52px] w-auto object-contain sm:h-[58px]" />
          </div>
          <div className="h-11 w-40 animate-pulse rounded-full bg-orange-100" />
        </div>
      </header>
      <main>
        <section className="relative">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_8%_12%,rgba(255,200,61,.26),transparent_28%),radial-gradient(circle_at_92%_10%,rgba(123,97,255,.16),transparent_30%),linear-gradient(180deg,#FFFFFF_0%,#FFF7EC_100%)]" />
          <div className="relative mx-auto grid max-w-[1180px] items-center gap-10 px-5 py-12 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:py-16">
            <div className="space-y-5">
              <div className="h-9 w-40 animate-pulse rounded-full bg-[#E8EEF7]" />
              <div className="space-y-3">
                <div className="h-14 w-full animate-pulse rounded-2xl bg-[#E8EEF7]" />
                <div className="h-14 w-4/5 animate-pulse rounded-2xl bg-[#E8EEF7]" />
                <div className="h-14 w-3/5 animate-pulse rounded-2xl bg-[#E8EEF7]" />
              </div>
              <div className="h-6 w-3/4 animate-pulse rounded-lg bg-[#E8EEF7]" />
              <div className="flex flex-wrap gap-2.5">
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className="h-10 w-32 animate-pulse rounded-full bg-[#E8EEF7]" />
                ))}
              </div>
              <div className="h-[56px] w-56 animate-pulse rounded-2xl bg-orange-100" />
            </div>
            <div className="aspect-[4/3] w-full max-w-[560px] animate-pulse justify-self-center rounded-[28px] bg-[#E8EEF7]" />
          </div>
        </section>
      </main>
    </div>
  );
}
