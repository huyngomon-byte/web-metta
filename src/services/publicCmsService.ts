import { pages as seedPages, sections as seedSections, siteSettings as seedSettings } from '@/data/seed';
import { PUBLIC_PROGRAMS } from '@/lib/constants';
import { normalizeHomepageContentSection } from '@/lib/publicCmsTextRepair';
import type { CmsPage, PageSection, SiteSettings } from '@/types/cms';

type PublicCmsSnapshot = {
  pages: CmsPage[];
  sections: PageSection[];
  settings: SiteSettings;
};

const CP1252_EXTENSIONS: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

const CLASSIC_MOJIBAKE = /(?:Ã|Ä|Å|Æ|Â|áº|á»|â)/;
const SUSPECT_TEXT = /(?:Ã|Ä|Å|Æ|Â|áº|á»|â|�|Ē)/g;
const METTA_PLUS_SPLIT_TYPES = new Set([
  'Metta+ Hero',
  'Metta+ Skills',
  'Metta+ Benefits',
  'Metta+ Age Clubs',
  'Metta+ Pass',
  'Metta+ Journey',
  'Metta+ Weekly Plan',
  'Metta+ Reasons',
  'Metta+ Video',
  'Metta+ Form',
]);

const METTA_PLUS_DEFAULT_SECTION_IDS = [
  'sec-metta-plus-skills',
  'sec-metta-plus-weekly-plan',
  'sec-metta-plus-video',
];

const METTA_PLUS_CANONICAL_TYPE_ORDER: Record<string, number> = {
  'Metta+ Hero': 1,
  'Metta+ Skills': 2,
  'Metta+ Benefits': 3,
  'Metta+ Age Clubs': 4,
  'Metta+ Pass': 5,
  'Metta+ Journey': 6,
  'Metta+ Weekly Plan': 7,
  'Metta+ Reasons': 8,
  'Metta+ Video': 9,
  'Metta+ Form': 10,
  'Metta+ Landing': 99,
};

const CANONICAL_HOME_BENEFITS = {
  title: 'Tại sao ba mẹ chọn METTA Academy?',
  subtitle: 'Hơn 10 năm kiến tạo tương lai thế hệ trẻ',
  description: '',
  extraData: JSON.stringify([
    { icon: 'school', color: '#F45A0A', title: 'Giáo trình chuẩn quốc tế Oxford & Cambridge' },
    { icon: 'verified', color: '#16A34A', title: '100% Giáo viên bản ngữ & CELTA/TESOL' },
    { icon: 'groups', color: '#8B5CF6', title: 'Lớp học sĩ số nhỏ tối đa 12-15 học viên' },
    { icon: 'psychology', color: '#F59E0B', title: 'Phương pháp tư duy phản biện' },
    { icon: 'workspace_premium', color: '#16A9D8', title: 'Cơ sở hiện đại 5 sao tiêu chuẩn quốc tế' },
    { icon: 'monitoring', color: '#EC4899', title: 'Báo cáo tiến độ định kỳ cho phụ huynh' },
  ]),
};

const HEADER_LABELS: Record<string, string> = {
  '/#about': 'Giới thiệu',
  '#about': 'Giới thiệu',
  '/#programs': 'Chương trình học',
  '#programs': 'Chương trình học',
  '/#teachers': 'Đội ngũ giáo viên',
  '#teachers': 'Đội ngũ giáo viên',
  '/tin-tuc': 'Tin tức',
  '/#lead-form': 'Liên hệ',
  '#lead-form': 'Liên hệ',
  '/#contact': 'Liên hệ',
  '#contact': 'Liên hệ',
};

const FOOTER_LABELS: Record<string, string> = {
  '/#about': 'Về chúng tôi',
  '#about': 'Về chúng tôi',
  '/#programs': 'Chương trình học',
  '#programs': 'Chương trình học',
  '/#method': 'Phương pháp',
  '#method': 'Phương pháp',
  '/tin-tuc': 'Tin tức',
  '/chinh-sach-bao-mat': 'Chính sách bảo mật',
  '/dieu-khoan-su-dung': 'Điều khoản sử dụng',
};

function clone<T>(value: T): T {
  if (value === undefined) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function suspiciousScore(value: string) {
  return value.match(SUSPECT_TEXT)?.length ?? 0;
}

function encodeWindows1252(value: string) {
  const bytes: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0xff) bytes.push(code);
    else if (CP1252_EXTENSIONS[code]) bytes.push(CP1252_EXTENSIONS[code]);
    else return null;
  }
  return new Uint8Array(bytes);
}

function repairClassicMojibake(value: string) {
  if (!CLASSIC_MOJIBAKE.test(value)) return value;
  const bytes = encodeWindows1252(value);
  if (!bytes) return value;
  const decoded = new TextDecoder('utf-8').decode(bytes);
  return suspiciousScore(decoded) < suspiciousScore(value) ? decoded : value;
}

function repairKnownBrokenText(value: string) {
  return value
    .replace(/Giỏi ngoại ngữ,\s*giàu kỹ n.ng,\s*lãnh .*?ạo tương lai/g, 'Giỏi ngoại ngữ, giàu kỹ năng, lãnh đạo tương lai')
    .replace(/Hành trình tiếng Anh .*?ẳng cấp qu.*?c tế/g, 'Hành trình tiếng Anh đẳng cấp quốc tế')
    .replace(/Chương trình tiếng Anh hi.*?n .*?ại cho trẻ 3.*?18 tu.*?i\. Chuẩn Cambridge, giáo viên bản ngữ, cam kết .*?ầu ra rõ ràng\./g, 'Chương trình tiếng Anh hiện đại cho trẻ 3-18 tuổi. Chuẩn Cambridge, giáo viên bản ngữ, cam kết đầu ra rõ ràng.')
    .replace(/Đ.ng ký tư vấn mi.*?n phí/g, 'Đăng ký tư vấn miễn phí')
    .replace(/Khám phá ch.*?ng trình/g, 'Khám phá chương trình')
    .replace(/Gi�[:›]i thi�[!‡]u/g, 'Giới thiệu')
    .replace(/Đ�["™]i ngũ giáo viên/g, 'Đội ngũ giáo viên')
    .replace(/Liên h�[!‡]/g, 'Liên hệ')
    .replace(/ĐĒng ký/g, 'Đăng ký')
    .replace(/mi�&n/g, 'miễn')
    .replace(new RegExp(`quÃ¯Â¿Â½${String.fromCharCode(0x18)}c`, 'g'), 'quÃ¡Â»â€˜c')
    .replace(/tu�"i/g, 'tuổi')
    .replace(/bu�"i/g, 'buổi')
    .replace(/l�:p/g, 'lớp')
    .replace(/NĒm/g, 'Năm')
    .replace(/nĒm/g, 'năm')
    .replace(/kỹ nĒng/g, 'kỹ năng')
    .replace(/d�9ch/g, 'dịch')
    .replace(/bảo v�!/g, 'bảo vệ');
}

function normalizeText(value: string) {
  return repairKnownBrokenText(repairClassicMojibake(value));
}

function normalizeCmsValue<T>(value: T): T {
  if (typeof value === 'string') return normalizeText(value) as T;
  if (Array.isArray(value)) return value.map((item) => normalizeCmsValue(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, normalizeCmsValue(item)]),
    ) as T;
  }
  return value;
}

function parseJsonArray(value?: string) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeHomepageBenefitsSection(section: PageSection): PageSection {
  const isHomeBenefits = section.pageId === 'page-home' && section.type === 'Benefits';
  if (!isHomeBenefits) return section;

  const items = parseJsonArray(section.extraData);
  const raw = JSON.stringify(section);
  const hasLegacyDescriptions = items.some((item) => typeof item?.desc === 'string' && item.desc.trim());
  const hasBrokenEncoding = /�|ï¿½|Ä’/.test(raw);

  if (!hasLegacyDescriptions && !hasBrokenEncoding) return section;

  return {
    ...section,
    ...CANONICAL_HOME_BENEFITS,
  };
}

function normalizeSections(items: PageSection[]) {
  return sortSections(
    normalizeCmsValue(items)
      .map(normalizeHomepageBenefitsSection)
      .map(normalizeHomepageContentSection),
  );
}

function sortSections(items: PageSection[]) {
  return [...items].sort((a, b) => a.order - b.order);
}

function currentProgramSettings() {
  return PUBLIC_PROGRAMS.map((program) => ({
    ...program,
    visible: true,
    highlights: [...program.highlights],
    methodology: [...program.methodology],
    outcomes: [...program.outcomes],
    roadmap: [...program.roadmap],
  }));
}

function normalizeFooterColumns(columns: SiteSettings['footerColumns']) {
  return (columns || []).map((column, index) => ({
    ...column,
    title: index === 0 ? 'Khám phá' : index === 1 ? 'Thông tin' : normalizeText(column.title),
    links: column.links.map((link) => ({
      ...link,
      label: FOOTER_LABELS[link.href] || normalizeText(link.label),
    })),
  }));
}

function normalizeHeaderLinks(
  links: NonNullable<SiteSettings['headerLinks']>,
  programs: NonNullable<SiteSettings['programs']>,
) {
  return links.map((link) => {
    const label = HEADER_LABELS[link.href] || normalizeText(link.label);
    const isProgramMenu = link.href?.includes('programs') || link.href === '/#programs' || label.toLowerCase().includes('chương trình');
    if (!isProgramMenu) {
      return {
        ...link,
        label,
        children: link.children?.map((child) => ({ ...child, label: normalizeText(child.label) })),
      };
    }
    return {
      ...link,
      label: 'Chương trình học',
      href: '/#programs',
      children: programs
        .filter((program) => program.visible !== false)
        .map((program) => ({ label: program.title, href: `/programs/${program.slug}` })),
    };
  });
}

function normalizeSettings(settings: SiteSettings): SiteSettings {
  const normalizedSettings = normalizeCmsValue(settings);
  const programs = normalizeCmsValue(
    Array.isArray(normalizedSettings.programs) ? normalizedSettings.programs : currentProgramSettings(),
  ) as NonNullable<SiteSettings['programs']>;
  const rawHeaderLinks = normalizedSettings.headerLinks?.length
    ? normalizedSettings.headerLinks
    : normalizeCmsValue(seedSettings.headerLinks || []);
  const rawFooterColumns = normalizedSettings.footerColumns?.length
    ? normalizedSettings.footerColumns
    : normalizeCmsValue(seedSettings.footerColumns || []);

  return {
    ...normalizedSettings,
    brandName: normalizeText(normalizedSettings.brandName || seedSettings.brandName),
    seoTitle: normalizeText(normalizedSettings.seoTitle || seedSettings.seoTitle || seedSettings.brandName),
    seoDescription: normalizeText(normalizedSettings.seoDescription || seedSettings.seoDescription || ''),
    footerText: normalizeText(normalizedSettings.footerText || seedSettings.footerText),
    headerCtaText: normalizeText(normalizedSettings.headerCtaText || seedSettings.headerCtaText || 'Đăng ký tư vấn'),
    address: normalizeText(normalizedSettings.address),
    mapUrl: normalizeText(normalizedSettings.mapUrl || seedSettings.mapUrl || ''),
    programs,
    headerLinks: normalizeHeaderLinks(rawHeaderLinks, programs),
    footerColumns: normalizeFooterColumns(rawFooterColumns),
  };
}

const PUBLIC_SETTINGS = normalizeSettings(clone(seedSettings));
const PUBLIC_PAGES = normalizeCmsValue(clone(seedPages));
const PUBLIC_SECTIONS = normalizeSections(clone(seedSections));
const LOCAL_SNAPSHOT: PublicCmsSnapshot = {
  pages: PUBLIC_PAGES,
  sections: PUBLIC_SECTIONS,
  settings: PUBLIC_SETTINGS,
};

const PUBLIC_CMS_FETCH_TIMEOUT_MS = 6000;
const SNAPSHOT_REQUEST_DEDUPE_MS = 500;
const SNAPSHOT_MEMORY_TTL_MS = 5 * 60 * 1000;
let snapshotCache: { snapshot: PublicCmsSnapshot; expiresAt: number } | null = null;
let snapshotRequest: Promise<PublicCmsSnapshot> | null = null;

function hasUsableHomepageSections(items: PageSection[]) {
  const visibleTypes = new Set(items.filter((section) => section.visible).map((section) => section.type));
  return visibleTypes.has('Hero') && visibleTypes.has('Courses') && visibleTypes.has('Lead Form');
}

function hasEbookLanding(items: PageSection[]) {
  return items.some((section) => section.type === 'Ebook Hero');
}

function hasMettaPlusLanding(items: PageSection[]) {
  return items.some((section) => METTA_PLUS_SPLIT_TYPES.has(section.type));
}

const LEGACY_METTA_PLUS_COPY = /(?:METTA\+ PASS|Metta\+ Pass|STEM Robotics|Metta Passport|metta-plus-pass|4[-–]15|Passport ready|Con nhận được gì tại Metta\+|Hành trình Metta\+|Vì sao phụ huynh chọn Metta\+|Summer Club)/i;

function mettaPlusSearchText(items: PageSection[]) {
  return items
    .map((section) => [
      section.title,
      section.subtitle,
      section.description,
      section.content,
      section.buttonText,
      section.button2Text,
      section.formId,
      section.imageUrl,
      section.extraData,
    ].filter((value): value is string => Boolean(value)).join(' '))
    .join(' ');
}

function isLegacyMettaPlusLanding(items: PageSection[]) {
  return hasMettaPlusLanding(items) && LEGACY_METTA_PLUS_COPY.test(mettaPlusSearchText(items));
}

function shouldUseMettaPlusFallback(pageId: string, items: PageSection[]) {
  return pageId === 'page-metta-plus' && (!hasMettaPlusLanding(items) || isLegacyMettaPlusLanding(items));
}

function fallbackSectionsForPage(pageId: string, sections = PUBLIC_SECTIONS) {
  return sortSections(sections.filter((section) => section.pageId === pageId));
}

function ensureFacilitiesSection(items: PageSection[]) {
  if (items.some((section) => section.type === 'Facilities')) return items;
  const seed = PUBLIC_SECTIONS.find((section) => section.id === 'sec-facilities');
  if (!seed) return items;
  return sortSections([...items, seed]);
}

function ensureMettaPlusDefaultSections(items: PageSection[]) {
  const existingTypes = new Set(items.map((section) => section.type));
  const additions = METTA_PLUS_DEFAULT_SECTION_IDS
    .map((id) => PUBLIC_SECTIONS.find((section) => section.id === id))
    .filter((section): section is PageSection => Boolean(section) && !existingTypes.has(section.type));
  const combined = [...items, ...additions].filter((section) => METTA_PLUS_SPLIT_TYPES.has(section.type));
  return combined
    .sort((a, b) => {
      const orderA = METTA_PLUS_CANONICAL_TYPE_ORDER[a.type] ?? a.order;
      const orderB = METTA_PLUS_CANONICAL_TYPE_ORDER[b.type] ?? b.order;
      return orderA - orderB || a.order - b.order;
    })
    .map((section, index) => ({ ...section, order: index + 1 }));
}

function sectionsForPage(pageId: string, sections = PUBLIC_SECTIONS) {
  const local = fallbackSectionsForPage(pageId, sections);
  if (pageId === 'page-home' && !hasUsableHomepageSections(local)) return fallbackSectionsForPage(pageId);
  if (pageId === 'page-phonics' && !hasEbookLanding(local)) return fallbackSectionsForPage(pageId);
  if (shouldUseMettaPlusFallback(pageId, local)) return fallbackSectionsForPage(pageId);
  if (pageId === 'page-metta-plus') return ensureMettaPlusDefaultSections(local);
  return pageId === 'page-home' ? ensureFacilitiesSection(local) : local;
}

function normalizeRemoteSnapshot(input: Partial<PublicCmsSnapshot>): PublicCmsSnapshot {
  const pages = normalizeCmsValue(clone(input.pages || []));
  const sections = normalizeSections(clone(input.sections || []));
  const settings = normalizeSettings(clone(input.settings || seedSettings));

  return {
    pages: pages.length ? pages : PUBLIC_PAGES,
    sections: sections.length ? sections : PUBLIC_SECTIONS,
    settings,
  };
}

async function loadRemoteSnapshot() {
  if (typeof window === 'undefined') return null;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), PUBLIC_CMS_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch('/api/app-config?id=publicCms', {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    return normalizeRemoteSnapshot(await response.json());
  } catch (error) {
    console.warn('[PublicCMS] Cannot load remote CMS snapshot, using local fallback:', error);
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function getSnapshot() {
  if (typeof window === 'undefined') return LOCAL_SNAPSHOT;
  const now = Date.now();
  if (snapshotCache && snapshotCache.expiresAt > now) return snapshotCache.snapshot;
  if (!snapshotRequest) {
    snapshotRequest = loadRemoteSnapshot()
      .then((snapshot) => {
        const resolved = snapshot || snapshotCache?.snapshot || LOCAL_SNAPSHOT;
        snapshotCache = { snapshot: resolved, expiresAt: Date.now() + SNAPSHOT_MEMORY_TTL_MS };
        return resolved;
      })
      .finally(() => {
        window.setTimeout(() => {
          snapshotRequest = null;
        }, SNAPSHOT_REQUEST_DEDUPE_MS);
      });
  }
  return snapshotRequest;
}

export const publicCmsService = {
  getPages: async () => clone((await getSnapshot()).pages),
  getPage: async (id: string) => clone((await getSnapshot()).pages.find((page) => page.id === id)),
  getPageBySlug: async (slug: string) => clone((await getSnapshot()).pages.find((page) => page.slug === slug && page.status === 'published')),
  getVisibleSections: async (pageId: string) => clone(sectionsForPage(pageId, (await getSnapshot()).sections).filter((section) => section.visible)),
  getSeedVisibleSections: (pageId: string) => clone(sectionsForPage(pageId).filter((section) => section.visible)),
  getSettings: async () => clone((await getSnapshot()).settings),
  getSettingsSync: () => clone(PUBLIC_SETTINGS),
};
