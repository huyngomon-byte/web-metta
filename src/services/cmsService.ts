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
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { PUBLIC_PROGRAMS } from '@/lib/constants';
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
const LOCAL_SECTION_EDIT_MARKER = 'metta_cms_sections_edited';
const DELETED_PAGES_KEY = 'metta_cms_deleted_pages';
const CURRENT_PROGRAM_SLUGS = PUBLIC_PROGRAMS.map((program) => program.slug);

let lastWriteError: string | null = null;

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

function normalizeCourseSettings(settings: SiteSettings): SiteSettings {
  const hasCurrentPrograms = CURRENT_PROGRAM_SLUGS.every((slug) =>
    settings.programs?.some((program) => program.slug === slug),
  );
  const headerLinks = (settings.headerLinks || []).map((link) => {
    const isProgramMenu = link.href?.includes('programs') || link.label?.toLowerCase().includes('chương trình');
    if (!isProgramMenu) return link;
    return {
      ...link,
      href: '/#programs',
      children: (settings.programs?.length ? settings.programs : PUBLIC_PROGRAMS)
        .filter((program) => (program as { visible?: boolean }).visible !== false)
        .map((program) => ({
        label: program.title,
        href: `/programs/${program.slug}`,
      })),
    };
  });

  if (hasCurrentPrograms) {
    return { ...settings, headerLinks };
  }

  return {
    ...settings,
    programs: currentProgramSettings(),
    headerLinks,
  };
}

function markLocalSectionEdited() {
  try {
    localStorage.setItem(LOCAL_SECTION_EDIT_MARKER, now());
  } catch {
    // localStorage can be unavailable in restricted browsers. The in-memory store still updates.
  }
}

function hasLocalSectionEdits() {
  try {
    return Boolean(localStorage.getItem(LOCAL_SECTION_EDIT_MARKER));
  } catch {
    return false;
  }
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
  const deleted = readDeletedPages();
  const byId = new Map(remote.filter((page) => !deleted.includes(page.id)).map((page) => [page.id, normalizeLegacyCmsPage(page)]));
  seedPages.forEach((page) => {
    if (!deleted.includes(page.id) && !byId.has(page.id)) byId.set(page.id, page);
  });
  return Array.from(byId.values());
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
  try {
    const raw = localStorage.getItem(DELETED_PAGES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function markPageDeleted(id: string) {
  try {
    const next = Array.from(new Set([...readDeletedPages(), id]));
    localStorage.setItem(DELETED_PAGES_KEY, JSON.stringify(next));
  } catch {
    // Keep in-memory deletion even if localStorage is unavailable.
  }
}

function hasUsableHomepageSections(items: PageSection[]) {
  const visibleTypes = new Set(items.filter((section) => section.visible).map((section) => section.type));
  return visibleTypes.has('Hero') && visibleTypes.has('Courses') && visibleTypes.has('Lead Form');
}

// Landing "Sách tiền tiểu học": nếu dữ liệu cũ chưa có block Ebook thì dùng seed mới.
function hasEbookLanding(items: PageSection[]) {
  return items.some((section) => section.type === 'Ebook Hero');
}

function fallbackSectionsForPage(pageId: string) {
  return sortSections(seedSections.filter((section) => section.pageId === pageId));
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
  if (!store.pages.length) store.pages = [...seedPages];
  if (!store.sections.length) store.sections = [...seedSections];
  if (!store.siteSettings) store.siteSettings = normalizeCourseSettings({ ...seedSettings });
  else store.siteSettings = normalizeCourseSettings(store.siteSettings);
  persistCMS();
}

async function tryWriteSeedData() {
  if (!USE_FIREBASE) return;
  try {
    await Promise.all([
      ...seedPages.map((page) => setDoc(doc(db!, COL_PAGES, page.id), stripUndefined(page))),
      ...seedSections.map((section) => setDoc(doc(db!, COL_SECTIONS, section.id), stripUndefined(section))),
      setDoc(doc(db!, DOC_SETTINGS), stripUndefined(seedSettings)),
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
    return mergeSeedPages(snap.docs.map((item) => item.data() as CmsPage));
  } catch (error) {
    try {
      const snap = await withTimeout(
        getDocs(query(collection(db!, COL_PAGES), where('status', '==', 'published'))),
        'Firestore published pages read',
      );
      if (!snap.empty) {
        return mergeSeedPages(snap.docs.map((item) => item.data() as CmsPage));
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
      sortSections(snap.docs.map((item) => item.data() as PageSection)),
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

  getPages: async () => {
    ensureLocalSeed();
    const remote = await readRemotePages();
    if (remote?.length) {
      store.pages = mergeSeedPages(remote);
      persistCMS();
      return delay(store.pages);
    }
    // Không có Firebase (localStorage-only): vẫn chuẩn hoá page ebook cũ về seed mới
    // để mọi profile/máy không bị rơi về landing-page-phonics cũ.
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

    store.pages = existing
      ? store.pages.map((item) => (item.id === saved.id ? saved : item))
      : [saved, ...store.pages];
    try {
      const deleted = readDeletedPages().filter((item) => item !== saved.id);
      localStorage.setItem(DELETED_PAGES_KEY, JSON.stringify(deleted));
    } catch {}
    persistCMS();
    await writeRemotePage(saved);
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
    return delay(newPage);
  },

  deletePage: async (id: string) => {
    markPageDeleted(id);
    store.pages = store.pages.filter((page) => page.id !== id);
    store.sections = store.sections.filter((section) => section.pageId !== id);
    persistCMS();
    if (USE_FIREBASE) {
      try {
        await deleteDoc(doc(db!, COL_PAGES, id));
        const q = query(collection(db!, COL_SECTIONS), where('pageId', '==', id));
        const snap = await getDocs(q);
        await Promise.all(snap.docs.map((item) => deleteDoc(item.ref)));
      } catch (error) {
        console.warn('[CMS] Cannot delete Firestore page, local fallback updated:', error);
      }
    }
    return true;
  },

  getSections: async (pageId: string) => {
    ensureLocalSeed();
    const remote = await readRemoteSections(pageId);
    if (remote?.length) {
      const otherSections = store.sections.filter((section) => section.pageId !== pageId);
      store.sections = [...otherSections, ...remote];
      persistCMS();
      if (pageId === 'page-phonics' && !hasEbookLanding(remote)) return delay(fallbackSectionsForPage(pageId));
      return delay(pageId === 'page-home' ? ensureFacilitiesSection(remote) : remote);
    }
    const local = sortSections(store.sections.filter((section) => section.pageId === pageId));
    const mergedLocal = pageId === 'page-home' ? ensureFacilitiesSection(mergeHomepageDefaults(local)) : local;
    if (pageId === 'page-home' && !hasUsableHomepageSections(mergedLocal)) return delay(fallbackSectionsForPage(pageId));
    if (pageId === 'page-phonics' && !hasEbookLanding(mergedLocal)) return delay(fallbackSectionsForPage(pageId));
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
    if (visible.length) return visible;
    return sortSections(seedSections.filter((section) => section.pageId === pageId && section.visible));
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

    store.sections = existing
      ? store.sections.map((item) => (item.id === saved.id ? saved : item))
      : [...store.sections, saved];
    markLocalSectionEdited();
    persistCMS();
    await writeRemoteSection(saved);
    return delay(sortSections(store.sections.filter((item) => item.pageId === saved.pageId)));
  },

  deleteSection: async (id: string) => {
    store.sections = store.sections.filter((section) => section.id !== id);
    markLocalSectionEdited();
    persistCMS();
    if (USE_FIREBASE) {
      try {
        await deleteDoc(doc(db!, COL_SECTIONS, id));
      } catch (error) {
        console.warn('[CMS] Cannot delete Firestore section, local fallback updated:', error);
      }
    }
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
    markLocalSectionEdited();
    persistCMS();
    await Promise.all([writeRemoteSection(section), writeRemoteSection(swap)]);
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
    const saved = { ...settings, updatedAt: now() };
    store.siteSettings = saved;
    persistCMS();
    await writeRemoteSettings(saved);
    return delay(saved);
  },

  resetToSeed: async () => {
    store.pages = [...seedPages];
    store.sections = [...seedSections];
    store.siteSettings = { ...seedSettings };
    persistCMS();
    await tryWriteSeedData();
    window.location.reload();
  },
};
