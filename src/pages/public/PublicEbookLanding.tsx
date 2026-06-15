/**
 * Trang công khai cho landing "Sách tiền tiểu học" — slug: ebook-mam-non.
 * KHÔNG dùng header/footer + menu dài của site. Có mini-header (logo + CTA),
 * sticky CTA mobile, mini-footer. Nội dung các section lấy từ CMS (page-phonics)
 * nên admin sửa được trong Website CMS (nội dung/ảnh, ẩn/hiện, đổi thứ tự).
 */
import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { SectionRenderer } from '@/components/public/SectionRenderer';
import { cmsService } from '@/services/cmsService';
import { useThemeSettings } from '@/hooks/useCms';
import { pages as seedPages, sections as seedSections, siteSettings as seedSettings } from '@/data/seed';
import type { CmsPage, PageSection } from '@/types/cms';
import { BRAND_LOGOS } from '@/lib/constants';

const FALLBACK_SLUG = 'ebook-mam-non';
const LEGACY_SLUG = 'landing-page-phonics';
const HEADER_LOGO = BRAND_LOGOS.onWhite;
const FOOTER_LOGO = BRAND_LOGOS.onBlue;
const SLOGAN = 'Giỏi ngoại ngữ, giàu kỹ năng, lãnh đạo tương lai';

function hasEbookHero(items: PageSection[]) {
  return items.some((s) => s.type === 'Ebook Hero');
}

function normalizeEbookPage(page: CmsPage | null | undefined, requestedSlug: string) {
  if (!page || page.id !== 'page-phonics') return page;
  const seed = seedPages.find((item) => item.id === 'page-phonics');
  if (!seed) return page;
  const isLegacyMeta = page.slug === LEGACY_SLUG || page.metaTitle === 'Phonics METTA' || page.title === 'Landing Page Phonics';
  if (!isLegacyMeta) return page;
  return {
    ...page,
    title: seed.title,
    slug: requestedSlug === LEGACY_SLUG ? LEGACY_SLUG : seed.slug,
    metaTitle: seed.metaTitle,
    metaDescription: seed.metaDescription,
  };
}

function scrollToForm() {
  document.getElementById('dangky')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export default function PublicEbookLanding() {
  const { pathname } = useLocation();
  const slug = pathname.replace(/^\/p\//, '').replace(/\/+$/, '') || FALLBACK_SLUG;
  const [page, setPage] = useState<CmsPage | null | undefined>(undefined);
  const [sections, setSections] = useState<PageSection[]>([]);

  useEffect(() => {
    let active = true;
    cmsService.getPages()
      .then((all) => {
        // Ưu tiên page đúng slug; nếu không có thì lấy page landing ebook (chứa block Ebook Hero).
        const found = all.find((p) => p.slug === slug)
          || seedPages.find((p) => p.slug === slug)
          || all.find((p) => p.slug === FALLBACK_SLUG)
          || seedPages.find((p) => p.slug === FALLBACK_SLUG)
          || all.find((p) => p.slug === LEGACY_SLUG)
          || null;
        if (!active) return;
        const pageToRender = normalizeEbookPage(found, slug);
        setPage(pageToRender);
        if (pageToRender) {
          cmsService.getVisibleSections(pageToRender.id).then((items) => {
            if (!active) return;
            const fallback = seedSections.filter((s) => s.pageId === pageToRender.id && s.visible).sort((a, b) => a.order - b.order);
            setSections(items.length && hasEbookHero(items) ? items : fallback);
          });
        }
      })
      .catch(() => {
        const fallback = seedPages.find((p) => p.slug === slug) || seedPages.find((p) => p.slug === FALLBACK_SLUG) || seedPages.find((p) => p.slug === LEGACY_SLUG) || null;
        if (!active) return;
        const pageToRender = normalizeEbookPage(fallback, slug);
        setPage(pageToRender);
        if (pageToRender) setSections(seedSections.filter((s) => s.pageId === pageToRender.id && s.visible).sort((a, b) => a.order - b.order));
      });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!page) return;
    const prev = document.title;
    document.title = page.metaTitle || page.title || 'Sách tiền tiểu học | METTA Academy';
    (window as any).fbq?.('track', 'ViewContent', { content_name: 'Preschool Ebook Landing' });
    return () => { document.title = prev; };
  }, [page]);

  if (page === undefined || (page && !sections.length)) {
    return <div className="grid min-h-screen place-items-center text-slate-400">Đang tải...</div>;
  }
  if (page === null) return <Navigate to="/" replace />;

  return (
    <div className="lp-root min-h-screen bg-[var(--lp-surface-dim)] font-inter text-[var(--lp-ink)] antialiased">
      <MiniHeader />
      {sections.map((section) => <SectionRenderer key={section.id} section={section} />)}
      <MiniFooter />
      <StickyMobileCta />
      <div className="h-20 lg:hidden" aria-hidden />
    </div>
  );
}

/* ── Mini header ─────────────────────────────────────────────────────────── */
function MiniHeader() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <header className={`sticky top-0 z-50 transition-all ${scrolled ? 'bg-white/95 shadow-[0_8px_30px_-12px_rgba(0,47,95,.35)] backdrop-blur' : 'bg-white/80 backdrop-blur'}`}>
      <div className="mx-auto flex max-w-[1220px] items-center justify-between gap-3 px-5 py-2.5 sm:px-6">
        <a href="#top" className="flex items-center gap-2.5">
          <img src={HEADER_LOGO} alt="METTA Academy" className="h-[52px] w-auto object-contain sm:h-[58px]" />
        </a>
        <button type="button" onClick={scrollToForm} className="lp-cta inline-flex h-[44px] items-center gap-1.5 rounded-full px-[22px] text-[13px] sm:px-[26px] sm:text-sm">
          <span className="material-symbols-outlined text-[18px]">download</span>
          Tải sách miễn phí
        </button>
      </div>
    </header>
  );
}

/* ── Mini footer ─────────────────────────────────────────────────────────── */
function MiniFooter() {
  const { settings } = useThemeSettings();
  const s = settings || seedSettings;
  const hotline = s.hotline;
  const address = s.address;
  const fanpage = s.socials?.facebook;
  return (
    <footer className="bg-[var(--lp-navy-700)] text-white">
      <div className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6">
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex items-center gap-3">
            <img src={FOOTER_LOGO} alt="METTA Academy" className="h-[58px] w-auto max-w-[230px] object-contain sm:h-16" />
          </div>
          <p className="text-[14px] font-medium text-white/80">{s.footerText || SLOGAN}</p>
          <div className="flex flex-col items-center gap-2 text-[14px] text-white/85 sm:flex-row sm:gap-6">
            {hotline && <a href={`tel:${hotline.replace(/\s/g, '')}`} className="inline-flex items-center gap-2 hover:text-[var(--lp-amber)]"><span className="material-symbols-outlined text-[18px]">call</span> {hotline}</a>}
            {address && <span className="inline-flex items-center gap-2"><span className="material-symbols-outlined text-[18px]">location_on</span> {address}</span>}
          </div>
          {fanpage && (
            <a href={fanpage} target="_blank" rel="noreferrer" aria-label="Fanpage" className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 transition hover:bg-[var(--lp-cta)]">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7h-2.54v-2.9h2.54v-2.2c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.77l-.44 2.9h-2.33v7c4.78-.75 8.44-4.9 8.44-9.9 0-5.53-4.5-10.02-10-10.02z" /></svg>
            </a>
          )}
        </div>
        <div className="mt-8 border-t border-white/10 pt-5 text-center text-[12.5px] text-white/55">© {new Date().getFullYear()} METTA Academy. {SLOGAN}.</div>
      </div>
    </footer>
  );
}

/* ── Sticky mobile CTA ───────────────────────────────────────────────────── */
function StickyMobileCta() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 480);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return useMemo(() => (
    <div
      className={`fixed inset-x-0 bottom-0 z-50 border-t border-[var(--lp-sky)] bg-white/95 p-3 backdrop-blur transition-transform duration-300 lg:hidden ${show ? 'translate-y-0' : 'translate-y-full'}`}
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <button type="button" onClick={scrollToForm} className="lp-cta flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-[16px]">
        <span className="material-symbols-outlined text-[22px]">download</span>
        Tải sách miễn phí
      </button>
    </div>
  ), [show]);
}
