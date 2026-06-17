import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { publicCmsService } from '@/services/publicCmsService';
import type { CmsPage, SiteSettings } from '@/types/cms';

const DEFAULT_TITLE = 'METTA ACADEMY – Giỏi ngoại ngữ, giàu kỹ năng, lãnh đạo tương lai';
const DEFAULT_DESCRIPTION = 'Trung tâm Anh ngữ quốc tế METTA Academy – chương trình tiếng Anh hiện đại giúp trẻ phát triển ngôn ngữ, tư duy phản biện và sự tự tin.';

function isAdminPath(pathname: string) {
  return pathname === '/login'
    || pathname === '/admin'
    || pathname === '/dashboard'
    || pathname === '/appointments'
    || pathname === '/media'
    || pathname === '/reports'
    || pathname === '/users'
    || pathname === '/settings'
    || pathname.startsWith('/crm')
    || pathname.startsWith('/cms')
    || pathname.startsWith('/capi')
    || pathname.startsWith('/marketing');
}

function pageSlugForPath(pathname: string) {
  if (pathname === '/') return 'homepage';
  if (pathname === '/metta-plus' || pathname === '/lp/metta-plus' || pathname === '/p/metta-plus') return 'metta-plus';
  if (pathname === '/p/landing-page-phonics' || pathname === '/p/ebook-mam-non' || pathname === '/lp/sach-tien-tieu-hoc') return 'ebook-mam-non';
  const publicPageMatch = pathname.match(/^\/p\/([^/]+)/);
  return publicPageMatch?.[1] || '';
}

function seoForPath(pathname: string, settings: SiteSettings, pages: CmsPage[]) {
  const homeTitle = settings.seoTitle || DEFAULT_TITLE;
  const homeDescription = settings.seoDescription || DEFAULT_DESCRIPTION;
  const slug = pageSlugForPath(pathname);
  const page = slug ? pages.find((item) => item.slug === slug) : undefined;

  if (pathname === '/') {
    return {
      title: homeTitle || page?.metaTitle || page?.title || DEFAULT_TITLE,
      description: homeDescription || page?.metaDescription || DEFAULT_DESCRIPTION,
    };
  }

  if (page) {
    return {
      title: page.metaTitle || page.title || homeTitle || DEFAULT_TITLE,
      description: page.metaDescription || homeDescription || DEFAULT_DESCRIPTION,
    };
  }

  const programSlug = pathname.match(/^\/programs\/([^/]+)/)?.[1];
  const program = programSlug ? settings.programs?.find((item) => item.slug === programSlug) : undefined;
  if (program) {
    return {
      title: `${program.title} | METTA Academy`,
      description: program.summary || program.description || homeDescription || DEFAULT_DESCRIPTION,
    };
  }

  return { title: homeTitle || DEFAULT_TITLE, description: homeDescription || DEFAULT_DESCRIPTION };
}

function upsertMeta(key: string, value: string, attr: 'name' | 'property' = 'name') {
  if (!value) return null;
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', value);
  return element;
}

function upsertCanonical(url: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', 'canonical');
    document.head.appendChild(element);
  }
  element.setAttribute('href', url);
}

export function PublicSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (isAdminPath(pathname)) {
      document.title = 'METTA Admin';
      return;
    }
    let active = true;

    Promise.all([publicCmsService.getSettings(), publicCmsService.getPages()])
      .then(([settings, pages]) => {
        if (!active) return;
        const seo = seoForPath(pathname, settings, pages);
        const canonical = `${window.location.origin}${pathname}`;
        document.title = seo.title;
        upsertMeta('description', seo.description);
        upsertMeta('og:title', seo.title, 'property');
        upsertMeta('og:description', seo.description, 'property');
        upsertMeta('og:url', canonical, 'property');
        upsertMeta('twitter:title', seo.title);
        upsertMeta('twitter:description', seo.description);
        upsertCanonical(canonical);
      })
      .catch(() => {
        if (!active) return;
        document.title = DEFAULT_TITLE;
        upsertMeta('description', DEFAULT_DESCRIPTION);
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  return null;
}
