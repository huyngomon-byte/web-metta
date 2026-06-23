import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
} from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { DEFAULT_DEAL_CURRENCY, PUBLIC_PROGRAMS, resolveCourseDealSizeForProgram } from '@/lib/constants';
import { normalizeHomepageContentSection } from '@/lib/publicCmsTextRepair';
import { delay, persistCMS, store } from '@/services/store';
import {
  pages as seedPages,
  sections as seedSections,
  siteSettings as seedSettings,
} from '@/data/seed';
import type { CmsPage, PageSection, SiteSettings } from '@/types/cms';

const now = () => new Date().toISOString();

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefined(item)) as T;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, stripUndefined(item)]),
    ) as T;
  }
  return value;
}

const COL_PAGES = 'pages';
const COL_SECTIONS = 'pageSections';
const DOC_SETTINGS = 'siteSettings/main';
const DOC_INIT = 'cms_meta/init';
const USE_FIREBASE = isFirebaseConfigured && !!db;
const FIRESTORE_TIMEOUT_MS = 2500;

let lastWriteError: string | null = null;
let lastPublishError: string | null = null;
let publishTimer: number | null = null;

type PublicCmsSnapshotPayload = {
  pages: CmsPage[];
  sections: PageSection[];
  settings: SiteSettings;
  generatedAt: string;
  schemaVersion: number;
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
const CANONICAL_HEADER_LABELS: Record<string, string> = {
  '/#about': 'Giới thiệu',
  '/#programs': 'Chương trình học',
  '/#teachers': 'Đội ngũ giáo viên',
  '/tin-tuc': 'Tin tức',
  '/#lead-form': 'Liên hệ',
  '/#contact': 'Liên hệ',
  '#about': 'Giới thiệu',
  '#programs': 'Chương trình học',
  '#teachers': 'Đội ngũ giáo viên',
  '#lead-form': 'Liên hệ',
  '#contact': 'Liên hệ',
};
const CANONICAL_FOOTER_LABELS: Record<string, string> = {
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

function suspiciousScore(value: string) {
  return value.match(SUSPECT_TEXT)?.length ?? 0;
}

function encodeWindows1252(value: string) {
  const bytes: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0xff) {
      bytes.push(code);
    } else if (CP1252_EXTENSIONS[code]) {
      bytes.push(CP1252_EXTENSIONS[code]);
    } else {
      return null;
    }
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

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(`${label} timed out`)), FIRESTORE_TIMEOUT_MS);
    }),
  ]);
}

function sortSections(items: PageSection[]) {
  return [...items].sort((a, b) => a.order - b.order);
}

const CURRENT_HOME_HERO = {
  title: 'Learn with Mind.\nLead with Heart.',
  subtitle: 'Giỏi ngoại ngữ, giàu kỹ năng, lãnh đạo tương lai',
  description: 'Hành trình tiếng Anh toàn diện cho trẻ 3–15 tuổi.\n100% Giáo viên nước ngoài có chứng chỉ quốc tế (TESOL/CELTA)\nLớp học nhỏ 10–12 học viên và lộ trình cá nhân hóa theo từng độ tuổi.',
  buttonText: 'Đăng ký tư vấn miễn phí',
  button2Text: 'Xem chương trình học',
};

function isLegacyHomeHeroTitle(value?: string) {
  const normalized = normalizeText(value || '').replace(/\s+/g, ' ').trim();
  return /Giỏi ngoại ngữ, giàu kỹ năng, lãnh .*ạo tương lai/i.test(normalized);
}

function normalizeHomepageHeroSection(section: PageSection): PageSection {
  const isHomeHero = section.pageId === 'page-home' && (section.id === 'sec-1' || section.type === 'Hero');
  if (!isHomeHero || !isLegacyHomeHeroTitle(section.title)) return section;
  return {
    ...section,
    ...CURRENT_HOME_HERO,
  };
}

function normalizeCmsSections(items: PageSection[]) {
  return sortSections(
    normalizeCmsValue(items)
      .map(normalizeHomepageHeroSection)
      .map(normalizeHomepageContentSection),
  );
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

function normalizeProgramSettings(programs: NonNullable<SiteSettings['programs']>) {
  return programs.map((program) => {
    return {
      ...program,
      dealSize: resolveCourseDealSizeForProgram(program),
      dealCurrency: program.dealCurrency || DEFAULT_DEAL_CURRENCY,
    };
  });
}

function normalizeFooterColumns(columns: SiteSettings['footerColumns']) {
  return (columns || []).map((column, index) => ({
    ...column,
    title: index === 0 ? 'Khám phá' : index === 1 ? 'Thông tin' : normalizeText(column.title),
    links: column.links.map((link) => ({
      ...link,
      label: CANONICAL_FOOTER_LABELS[link.href] || normalizeText(link.label),
    })),
  }));
}

function normalizeHeaderLinks(
  links: NonNullable<SiteSettings['headerLinks']>,
  programs: NonNullable<SiteSettings['programs']>,
) {
  return links.map((link) => {
    const label = CANONICAL_HEADER_LABELS[link.href] || normalizeText(link.label);
    const isProgramMenu = link.href?.includes('programs') || link.href === '/#programs' || label.toLowerCase().includes('chương trình');
    if (!isProgramMenu) {
      return {
        ...link,
        label,
        children: link.children?.map((child) => ({
          ...child,
          label: normalizeText(child.label),
        })),
      };
    }
    return {
      ...link,
      label: 'Chương trình học',
      href: '/#programs',
      children: programs
        .filter((program) => program.visible !== false)
        .map((program) => ({
          label: program.title,
          href: `/programs/${program.slug}`,
        })),
    };
  });
}

function normalizeCourseSettings(settings: SiteSettings): SiteSettings {
  const normalizedSettings = normalizeCmsValue(settings);
  const programs = normalizeProgramSettings(normalizeCmsValue(
    Array.isArray(normalizedSettings.programs) ? normalizedSettings.programs : currentProgramSettings(),
  ) as NonNullable<SiteSettings['programs']>);
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

function markLocalSectionEdited() {
  // Local edit markers caused browser-specific CMS state. Firestore is the source of truth.
}

function hasLocalSectionEdits() {
  return false;
}

function timestamp(value?: string) {
  const time = value ? Date.parse(value) : 0;
  return Number.isFinite(time) ? time : 0;
}

function mergeRemoteWithLocalEdits(remote: PageSection[], pageId: string) {
  if (!hasLocalSectionEdits()) return remote;
  const local = sortSections(store.sections.filter((section) => section.pageId === pageId));
  if (!local.length) return remote;

  const byId = new Map(remote.map((section) => [section.id, section]));
  local.forEach((localSection) => {
    const remoteSection = byId.get(localSection.id);
    if (!remoteSection || timestamp(localSection.updatedAt) >= timestamp(remoteSection.updatedAt)) {
      byId.set(localSection.id, localSection);
    }
  });
  return sortSections(Array.from(byId.values()));
}

function mergeSeedPages(remote: CmsPage[]) {
  return remote.map((page) => normalizeLegacyCmsPage(normalizeCmsValue(page)));
}

function normalizeLegacyCmsPage(page: CmsPage) {
  if (page.id !== 'page-phonics') return page;
  const currentSeed = seedPages.find((item) => item.id === 'page-phonics');
  if (!currentSeed) return page;
  const isLegacyEbookPage = page.slug === 'landing-page-phonics'
    || page.metaTitle === 'Phonics METTA'
    || page.title === 'Landing Page Phonics';
  if (!isLegacyEbookPage) return page;
  return {
    ...page,
    title: currentSeed.title,
    slug: currentSeed.slug,
    metaTitle: currentSeed.metaTitle,
    metaDescription: currentSeed.metaDescription,
  };
}

function readDeletedPages() {
  return [];
}

function markPageDeleted(id: string) {
  void id;
}

function hasUsableHomepageSections(items: PageSection[]) {
  const visibleTypes = new Set(items.filter((section) => section.visible).map((section) => section.type));
  return visibleTypes.has('Hero') && visibleTypes.has('Courses') && visibleTypes.has('Lead Form');
}

// Landing "Sách tiền tiểu học": nếu dữ liệu cũ chưa có block Ebook thì dùng seed mới.
function hasEbookLanding(items: PageSection[]) {
  return items.some((section) => section.type === 'Ebook Hero');
}

const METTA_PLUS_SPLIT_TYPES = new Set([
  'Metta+ Hero',
  'Metta+ Benefits',
  'Metta+ Age Clubs',
  'Metta+ Pass',
  'Metta+ Journey',
  'Metta+ Reasons',
  'Metta+ Form',
]);

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

function fallbackSectionsForPage(pageId: string) {
  return normalizeCmsSections(seedSections.filter((section) => section.pageId === pageId));
}

// Tự chèn section "Cơ sở vật chất" vào homepage nếu dữ liệu hiện tại chưa có
// (để hiển thị ngay + xuất hiện trong editor như section #8 quản lý được).
function ensureFacilitiesSection(items: PageSection[]) {
  if (items.some((section) => section.type === 'Facilities')) return items;
  const seed = seedSections.find((section) => section.id === 'sec-facilities');
  if (!seed) return items;
  return sortSections([...items, { ...seed, updatedAt: now() }]);
}

function mergeHomepageDefaults(items: PageSection[]) {
  if (!items.length) return fallbackSectionsForPage('page-home');
  const seedHero = seedSections.find((section) => section.id === 'sec-1');
  if (!seedHero) return items;
  return items.map((section) => {
    if (section.id !== 'sec-1' && section.type !== 'Hero') return section;
    if (section.imageUrl && section.imageUrl !== '/brand/workshop-kids.jpg' && !section.imageUrl.startsWith('blob:')) return section;
    return { ...section, imageUrl: seedHero.imageUrl, updatedAt: now() };
  });
}

function ensureLocalSeed() {
  if (!store.pages.length) store.pages = normalizeCmsValue([...seedPages]);
  else store.pages = normalizeCmsValue(store.pages);
  if (!store.sections.length) store.sections = normalizeCmsSections([...seedSections]);
  else store.sections = normalizeCmsSections(store.sections);
  if (!store.siteSettings) store.siteSettings = normalizeCourseSettings({ ...seedSettings });
  else store.siteSettings = normalizeCourseSettings(store.siteSettings);
  persistCMS();
}

function publicSnapshotFromStore(): PublicCmsSnapshotPayload {
  ensureLocalSeed();
  const pages = mergeSeedPages(store.pages.length ? store.pages : normalizeCmsValue([...seedPages]))
    .filter((page) => page.status === 'published');
  const publishedPageIds = new Set(pages.map((page) => page.id));
  const sections = normalizeCmsSections(store.sections.length ? store.sections : [...seedSections])
    .filter((section) => section.visible && publishedPageIds.has(section.pageId));
  const settings = normalizeCourseSettings(store.siteSettings ?? seedSettings);

  return {
    pages,
    sections,
    settings,
    generatedAt: now(),
    schemaVersion: 1,
  };
}

async function publishPublicSnapshotNow() {
  lastPublishError = null;
  const user = auth?.currentUser;
  if (!user) {
    lastPublishError = 'Chua dang nhap Firebase nen chua publish duoc public CMS snapshot.';
    return null;
  }

  const token = await user.getIdToken();
  const response = await fetch('/api/app-config?id=publicCms', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ snapshot: publicSnapshotFromStore() }),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || 'Khong publish duoc public CMS snapshot.');
  }
  return payload;
}

function schedulePublicSnapshotPublish() {
  if (typeof window === 'undefined') return;
  if (publishTimer) window.clearTimeout(publishTimer);
  publishTimer = window.setTimeout(() => {
    publishPublicSnapshotNow().catch((error) => {
      lastPublishError = error instanceof Error ? error.message : 'Khong publish duoc public CMS snapshot.';
      console.warn('[CMS] Cannot publish public snapshot:', error);
    });
  }, 700);
}

async function tryWriteSeedData() {
  if (!USE_FIREBASE) return;
  try {
    await Promise.all([
      ...normalizeCmsValue([...seedPages]).map((page) => setDoc(doc(db!, COL_PAGES, page.id), stripUndefined(page))),
      ...normalizeCmsSections([...seedSections]).map((section) => setDoc(doc(db!, COL_SECTIONS, section.id), stripUndefined(section))),
      setDoc(doc(db!, DOC_SETTINGS), stripUndefined(normalizeCourseSettings(seedSettings))),
      setDoc(doc(db!, DOC_INIT), { seededAt: now(), repairedAt: now() }),
    ]);
  } catch (error) {
    console.warn('[CMS] Cannot seed Firestore, using local fallback:', error);
  }
}

async function readRemotePages() {
  if (!USE_FIREBASE) return null;
  try {
    const snap = await withTimeout(getDocs(collection(db!, COL_PAGES)), 'Firestore pages read');
    if (snap.empty) {
      return null;
    }
    return mergeSeedPages(normalizeCmsValue(snap.docs.map((item) => item.data() as CmsPage)));
  } catch (error) {
    try {
      const snap = await withTimeout(
        getDocs(query(collection(db!, COL_PAGES), where('status', '==', 'published'))),
        'Firestore published pages read',
      );
      if (!snap.empty) {
        return mergeSeedPages(normalizeCmsValue(snap.docs.map((item) => item.data() as CmsPage)));
      }
    } catch (publicError) {
      console.warn('[CMS] Cannot read published Firestore pages, using local fallback:', publicError);
    }
    console.warn('[CMS] Cannot read Firestore pages, using local fallback:', error);
    return null;
  }
}

async function readRemoteSections(pageId: string) {
  if (!USE_FIREBASE) return null;
  try {
    const q = query(collection(db!, COL_SECTIONS), where('pageId', '==', pageId));
    const snap = await withTimeout(getDocs(q), 'Firestore sections read');
    if (snap.empty) {
      return null;
    }
    let remote = mergeRemoteWithLocalEdits(
      normalizeCmsSections(snap.docs.map((item) => item.data() as PageSection)),
      pageId,
    );
    if (pageId === 'page-home') remote = mergeHomepageDefaults(remote);
    if (pageId === 'page-home' && !hasUsableHomepageSections(remote)) {
      return fallbackSectionsForPage(pageId);
    }
    return remote;
  } catch (error) {
    console.warn('[CMS] Cannot read Firestore sections, using local fallback:', error);
    return null;
  }
}

async function readRemoteSettings() {
  if (!USE_FIREBASE) return null;
  try {
    const snap = await withTimeout(getDoc(doc(db!, DOC_SETTINGS)), 'Firestore settings read');
    if (!snap.exists()) return null;
    const remote = snap.data() as SiteSettings;
    return normalizeCourseSettings(remote);
  } catch (error) {
    console.warn('[CMS] Cannot read Firestore settings, using local fallback:', error);
    return null;
  }
}

function describeFirestoreError(error: unknown, what: string) {
  const err = error as { code?: string; message?: string } | undefined;
  const code = err?.code || '';
  const msg = err?.message || '';
  if (code === 'permission-denied' || /missing or insufficient permissions/i.test(msg)) {
    return `Không đủ quyền ghi ${what} vào Firestore. Hãy đăng xuất rồi đăng nhập lại bằng tài khoản admin (đã được cấp role admin).`;
  }
  if (code === 'unavailable' || /offline|network/i.test(msg)) {
    return `Không kết nối được Firestore (mạng yếu hoặc bị chặn). Thử lại sau ít phút.`;
  }
  if (code === 'invalid-argument' || /invalid|undefined/i.test(msg)) {
    return `Dữ liệu ${what} không hợp lệ khi ghi Firestore: ${msg || code}.`;
  }
  return `Không ghi được ${what} vào Firestore${code ? ` (${code})` : ''}.`;
}

async function writeRemotePage(page: CmsPage) {
  lastWriteError = null;
  if (!USE_FIREBASE) return true;
  try {
    await setDoc(doc(db!, COL_PAGES, page.id), stripUndefined(page));
    return true;
  } catch (error) {
    lastWriteError = describeFirestoreError(error, 'page');
    console.warn('[CMS] Cannot write Firestore page:', error);
    return false;
  }
}

async function writeRemoteSection(section: PageSection) {
  lastWriteError = null;
  if (!USE_FIREBASE) return true;
  try {
    await setDoc(doc(db!, COL_SECTIONS, section.id), stripUndefined(section));
    return true;
  } catch (error) {
    lastWriteError = describeFirestoreError(error, 'section');
    console.warn('[CMS] Cannot write Firestore section:', error);
    return false;
  }
}

async function writeRemoteSettings(settings: SiteSettings) {
  lastWriteError = null;
  if (!USE_FIREBASE) return true;
  try {
    await setDoc(doc(db!, DOC_SETTINGS), stripUndefined(settings));
    return true;
  } catch (error) {
    lastWriteError = describeFirestoreError(error, 'site settings');
    console.warn('[CMS] Cannot write Firestore settings:', error);
    return false;
  }
}

export const cmsService = {
  getLastWriteError: () => lastWriteError,
  getLastPublishError: () => lastPublishError,
  publishPublicSnapshot: publishPublicSnapshotNow,

  getPages: async () => {
    ensureLocalSeed();
    const remote = await readRemotePages();
    if (remote?.length) {
      store.pages = mergeSeedPages(remote);
      persistCMS();
      return delay(store.pages);
    }
    // No Firebase: keep the in-memory seed normalized.
    store.pages = (store.pages.length ? store.pages : seedPages).map(normalizeLegacyCmsPage);
    persistCMS();
    return delay(store.pages);
  },

  getPage: async (id: string) => {
    const pages = await cmsService.getPages();
    return pages.find((page) => page.id === id) || seedPages.find((page) => page.id === id);
  },

  getPageBySlug: async (slug: string) => {
    const pages = await cmsService.getPages();
    return pages.find((page) => page.slug === slug && page.status === 'published')
      || seedPages.find((page) => page.slug === slug && page.status === 'published');
  },

  savePage: async (page: Partial<CmsPage>) => {
    ensureLocalSeed();
    const existing = page.id ? store.pages.find((item) => item.id === page.id) : undefined;
    const saved: CmsPage = {
      id: page.id ?? `page-${Date.now()}`,
      title: page.title ?? existing?.title ?? 'Untitled',
      slug: page.slug ?? existing?.slug ?? 'untitled',
      metaTitle: page.metaTitle ?? existing?.metaTitle ?? page.title ?? '',
      metaDescription: page.metaDescription ?? existing?.metaDescription ?? '',
      status: page.status ?? existing?.status ?? 'draft',
      createdAt: existing?.createdAt ?? now(),
      updatedAt: now(),
    };

    const pageOk = await writeRemotePage(saved);
    if (USE_FIREBASE && !pageOk) throw new Error(lastWriteError || 'Không ghi được page vào Firestore.');

    store.pages = existing
      ? store.pages.map((item) => (item.id === saved.id ? saved : item))
      : [saved, ...store.pages];
    persistCMS();
    schedulePublicSnapshotPublish();
    return delay(store.pages);
  },

  // Sao chép 1 page (kèm toàn bộ section) sang page mới với title/slug riêng.
  // Dùng để tạo nhanh các landing tương tự (vd: nhân bản trang Ebook mầm non).
  duplicatePage: async (sourceId: string, override?: { title?: string; slug?: string }) => {
    ensureLocalSeed();
    // Đảm bảo có dữ liệu mới nhất cho page nguồn + section của nó
    await cmsService.getPages();
    const source = store.pages.find((page) => page.id === sourceId);
    if (!source) throw new Error('Không tìm thấy page nguồn để sao chép.');
    const sourceSections = await cmsService.getSections(sourceId);

    const baseTitle = (override?.title?.trim()) || `${source.title} (bản sao)`;
    const baseSlug = (override?.slug?.trim()) || `${source.slug}-copy`;
    const existingSlugs = new Set(store.pages.map((page) => page.slug));
    let finalSlug = baseSlug;
    let i = 2;
    while (existingSlugs.has(finalSlug)) {
      finalSlug = `${baseSlug}-${i++}`;
    }

    const newPageId = `page-${Date.now()}`;
    const timestamp = now();
    const newPage: CmsPage = {
      id: newPageId,
      title: baseTitle,
      slug: finalSlug,
      metaTitle: baseTitle,
      metaDescription: source.metaDescription || '',
      status: 'draft',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    const newSections: PageSection[] = sourceSections.map((section, index) => ({
      ...section,
      id: `sec-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
      pageId: newPageId,
      createdAt: timestamp,
      updatedAt: timestamp,
    }));

    store.pages = [newPage, ...store.pages];
    store.sections = [...store.sections, ...newSections];
    markLocalSectionEdited();
    persistCMS();

    // Ghi vào Firestore. Nếu một trong các write fail thì throw để UI hiển thị lỗi cụ thể
    // (vd: permission-denied -> nhắc admin đăng nhập lại) thay vì dắt user vào editor "ma".
    const pageOk = await writeRemotePage(newPage);
    const sectionResults = await Promise.all(newSections.map((section) => writeRemoteSection(section)));
    if (USE_FIREBASE && (!pageOk || sectionResults.some((ok) => !ok))) {
      throw new Error(lastWriteError || 'Không ghi được Firestore khi sao chép trang.');
    }
    schedulePublicSnapshotPublish();
    return delay(newPage);
  },

  deletePage: async (id: string) => {
    if (USE_FIREBASE) {
      try {
        await deleteDoc(doc(db!, COL_PAGES, id));
        const q = query(collection(db!, COL_SECTIONS), where('pageId', '==', id));
        const snap = await getDocs(q);
        await Promise.all(snap.docs.map((item) => deleteDoc(item.ref)));
      } catch (error) {
        throw new Error(describeFirestoreError(error, 'page'));
      }
    }
    markPageDeleted(id);
    store.pages = store.pages.filter((page) => page.id !== id);
    store.sections = store.sections.filter((section) => section.pageId !== id);
    persistCMS();
    schedulePublicSnapshotPublish();
    return true;
  },

  getSections: async (pageId: string) => {
    ensureLocalSeed();
    const remote = await readRemoteSections(pageId);
    if (remote?.length) {
      let nextRemote = remote;
      if (pageId === 'page-phonics' && !hasEbookLanding(nextRemote)) nextRemote = fallbackSectionsForPage(pageId);
      if (shouldUseMettaPlusFallback(pageId, nextRemote)) nextRemote = fallbackSectionsForPage(pageId);
      const otherSections = store.sections.filter((section) => section.pageId !== pageId);
      store.sections = [...otherSections, ...nextRemote];
      persistCMS();
      return delay(pageId === 'page-home' ? ensureFacilitiesSection(nextRemote) : nextRemote);
    }
    const local = sortSections(store.sections.filter((section) => section.pageId === pageId));
    const mergedLocal = pageId === 'page-home' ? ensureFacilitiesSection(mergeHomepageDefaults(local)) : local;
    if (pageId === 'page-home' && !hasUsableHomepageSections(mergedLocal)) return delay(fallbackSectionsForPage(pageId));
    if (pageId === 'page-phonics' && !hasEbookLanding(mergedLocal)) return delay(fallbackSectionsForPage(pageId));
    if (shouldUseMettaPlusFallback(pageId, mergedLocal)) {
      const fallback = fallbackSectionsForPage(pageId);
      const otherSections = store.sections.filter((section) => section.pageId !== pageId);
      store.sections = [...otherSections, ...fallback];
      persistCMS();
      return delay(fallback);
    }
    return delay(mergedLocal);
  },

  getVisibleSections: async (pageId: string) => {
    const sections = await cmsService.getSections(pageId);
    const visible = sections.filter((section) => section.visible);
    if (pageId === 'page-home' && !hasUsableHomepageSections(visible)) {
      return fallbackSectionsForPage(pageId).filter((section) => section.visible);
    }
    if (pageId === 'page-phonics' && !hasEbookLanding(visible)) {
      return fallbackSectionsForPage(pageId).filter((section) => section.visible);
    }
    if (shouldUseMettaPlusFallback(pageId, visible)) {
      return fallbackSectionsForPage(pageId).filter((section) => section.visible);
    }
    if (visible.length) return visible;
    return fallbackSectionsForPage(pageId).filter((section) => section.visible);
  },

  getSeedVisibleSections: (pageId: string) => {
    return fallbackSectionsForPage(pageId).filter((section) => section.visible);
  },

  saveSection: async (section: Partial<PageSection>) => {
    ensureLocalSeed();
    const existing = section.id ? store.sections.find((item) => item.id === section.id) : undefined;
    const pageSections = store.sections.filter((item) => item.pageId === (section.pageId ?? existing?.pageId));
    const saved: PageSection = {
      id: section.id ?? `sec-${Date.now()}`,
      pageId: section.pageId ?? existing?.pageId ?? '',
      type: section.type ?? existing?.type ?? 'Hero',
      title: section.title ?? existing?.title ?? 'Section mới',
      subtitle: section.subtitle ?? existing?.subtitle ?? '',
      description: section.description ?? existing?.description ?? '',
      content: section.content ?? existing?.content ?? '',
      imageUrl: section.imageUrl ?? existing?.imageUrl ?? '',
      buttonText: section.buttonText ?? existing?.buttonText ?? '',
      buttonLink: section.buttonLink ?? existing?.buttonLink ?? '',
      formId: section.formId ?? existing?.formId ?? '',
      order: section.order ?? existing?.order ?? pageSections.length + 1,
      visible: section.visible ?? existing?.visible ?? true,
      createdAt: existing?.createdAt ?? now(),
      ...section,
      updatedAt: now(),
    };

    const sectionOk = await writeRemoteSection(saved);
    if (USE_FIREBASE && !sectionOk) throw new Error(lastWriteError || 'Không ghi được section vào Firestore.');

    store.sections = existing
      ? store.sections.map((item) => (item.id === saved.id ? saved : item))
      : [...store.sections, saved];
    markLocalSectionEdited();
    persistCMS();
    schedulePublicSnapshotPublish();
    return delay(sortSections(store.sections.filter((item) => item.pageId === saved.pageId)));
  },

  deleteSection: async (id: string) => {
    if (USE_FIREBASE) {
      try {
        await deleteDoc(doc(db!, COL_SECTIONS, id));
      } catch (error) {
        throw new Error(describeFirestoreError(error, 'section'));
      }
    }
    store.sections = store.sections.filter((section) => section.id !== id);
    markLocalSectionEdited();
    persistCMS();
    schedulePublicSnapshotPublish();
    return true;
  },

  moveSection: async (id: string, direction: 'up' | 'down') => {
    const section = store.sections.find((item) => item.id === id);
    if (!section) return delay(store.sections);
    const siblings = sortSections(store.sections.filter((item) => item.pageId === section.pageId));
    const index = siblings.findIndex((item) => item.id === id);
    const swap = direction === 'up' ? siblings[index - 1] : siblings[index + 1];
    if (!swap) return delay(siblings);

    const sectionOrder = section.order;
    section.order = swap.order;
    swap.order = sectionOrder;
    section.updatedAt = now();
    swap.updatedAt = now();
    const [sectionOk, swapOk] = await Promise.all([writeRemoteSection(section), writeRemoteSection(swap)]);
    if (USE_FIREBASE && (!sectionOk || !swapOk)) throw new Error(lastWriteError || 'Không ghi được thứ tự section vào Firestore.');
    markLocalSectionEdited();
    persistCMS();
    schedulePublicSnapshotPublish();
    return delay(sortSections(store.sections.filter((item) => item.pageId === section.pageId)));
  },

  getSettings: async () => {
    ensureLocalSeed();
    const remote = await readRemoteSettings();
    if (remote) {
      store.siteSettings = normalizeCourseSettings(remote);
      persistCMS();
      return delay(store.siteSettings);
    }
    return delay(normalizeCourseSettings(store.siteSettings ?? seedSettings));
  },

  saveSettings: async (settings: SiteSettings) => {
    const saved = normalizeCourseSettings({ ...settings, updatedAt: now() });
    const settingsOk = await writeRemoteSettings(saved);
    if (USE_FIREBASE && !settingsOk) throw new Error(lastWriteError || 'Không ghi được site settings vào Firestore.');
    store.siteSettings = saved;
    persistCMS();
    schedulePublicSnapshotPublish();
    return delay(saved);
  },

  resetToSeed: async () => {
    store.pages = normalizeCmsValue([...seedPages]);
    store.sections = normalizeCmsSections([...seedSections]);
    store.siteSettings = normalizeCourseSettings({ ...seedSettings });
    persistCMS();
    await tryWriteSeedData();
    await publishPublicSnapshotNow().catch((error) => {
      lastPublishError = error instanceof Error ? error.message : 'Khong publish duoc public CMS snapshot.';
      console.warn('[CMS] Cannot publish public snapshot after reset:', error);
    });
    window.location.reload();
  },
};
