import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { publicCmsService } from '@/services/publicCmsService';
import { publicBlogService } from '@/services/publicBlogService';
import type { BlogPost, CmsPage, SiteSettings } from '@/types/cms';

const DEFAULT_TITLE = 'METTA ACADEMY – Giỏi ngoại ngữ, giàu kỹ năng, lãnh đạo tương lai';
const DEFAULT_DESCRIPTION = 'Trung tâm Anh ngữ quốc tế METTA Academy – chương trình tiếng Anh hiện đại giúp trẻ phát triển ngôn ngữ, tư duy phản biện và sự tự tin.';
const SITE_URL = 'https://metta.edu.vn';
const PUBLIC_SITE_URL = 'https://www.metta.edu.vn';
const LOGO_URL = `${SITE_URL}/logo.png`;
const DEFAULT_MAP_URL = 'https://share.google/w0414JKEjY3GoBG0F';
const JSONLD_SCRIPT_ID = 'metta-jsonld';

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

function blogSlugForPath(pathname: string) {
  return pathname.match(/^\/tin-tuc\/([^/]+)$/)?.[1] || '';
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

function seoForBlogPost(post: BlogPost) {
  return {
    title: post.metaTitle || post.title || DEFAULT_TITLE,
    description: post.metaDescription || post.excerpt || DEFAULT_DESCRIPTION,
  };
}

function upsertMeta(key: string, value: string, attr: 'name' | 'property' = 'name') {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!value) {
    element?.remove();
    return null;
  }
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attr, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', value);
  return element;
}

function removeMeta(key: string, attr: 'name' | 'property' = 'name') {
  document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)?.remove();
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

function canonicalUrl(pathname: string) {
  return `${window.location.origin}${pathname === '/' ? '/' : pathname}`;
}

function absoluteUrl(value?: string, baseUrl = PUBLIC_SITE_URL) {
  const raw = String(value || '').trim();
  if (!raw || raw.startsWith('data:')) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  try {
    return new URL(raw, baseUrl).href;
  } catch {
    return '';
  }
}

function structuredPageUrl(pathname: string) {
  return `${SITE_URL}${pathname === '/' ? '' : pathname}`;
}

function buildStructuredData(
  pathname: string,
  seo: { title: string; description: string },
  organizationDescription = DEFAULT_DESCRIPTION,
  mapUrl = DEFAULT_MAP_URL,
) {
  const pageUrl = structuredPageUrl(pathname);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'EducationalOrganization',
        '@id': `${SITE_URL}/#organization`,
        name: 'METTA ACADEMY',
        alternateName: [
          'Metta Academy',
          'Trung tâm Anh ngữ quốc tế METTA Academy',
          'Trung tâm tiếng Anh Metta Academy',
        ],
        url: SITE_URL,
        logo: LOGO_URL,
        description: organizationDescription,
        slogan: 'Giỏi ngoại ngữ, giàu kỹ năng, lãnh đạo tương lai',
        foundingLocation: {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressCountry: 'VN',
          },
        },
        hasMap: mapUrl,
        sameAs: [
          'https://www.facebook.com/anhngumetta',
          mapUrl,
        ],
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: 'METTA ACADEMY',
        alternateName: 'Metta Academy',
        publisher: {
          '@id': `${SITE_URL}/#organization`,
        },
      },
      {
        '@type': 'WebPage',
        '@id': `${pageUrl}#webpage`,
        url: pageUrl,
        name: seo.title,
        description: seo.description,
        isPartOf: {
          '@id': `${SITE_URL}/#website`,
        },
        about: {
          '@id': `${SITE_URL}/#organization`,
        },
      },
    ],
  };
}

function buildBlogPostingStructuredData(post: BlogPost, canonical: string, image: string) {
  const seo = seoForBlogPost(post);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'METTA ACADEMY',
        url: SITE_URL,
        logo: LOGO_URL,
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: SITE_URL,
        name: 'METTA ACADEMY',
        alternateName: 'Metta Academy',
        publisher: {
          '@id': `${SITE_URL}/#organization`,
        },
      },
      {
        '@type': 'BlogPosting',
        '@id': `${canonical}#blogposting`,
        headline: seo.title,
        description: seo.description,
        ...(image ? { image } : {}),
        datePublished: post.publishedAt,
        dateModified: post.updatedAt || post.publishedAt,
        author: {
          '@type': 'Organization',
          name: 'METTA ACADEMY',
          url: SITE_URL,
        },
        publisher: {
          '@type': 'Organization',
          name: 'METTA ACADEMY',
          logo: LOGO_URL,
        },
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': canonical,
        },
      },
    ],
  };
}

function upsertStructuredData(data: unknown) {
  let element = document.getElementById(JSONLD_SCRIPT_ID) as HTMLScriptElement | null;
  if (!element) {
    element = document.createElement('script');
    element.id = JSONLD_SCRIPT_ID;
    element.type = 'application/ld+json';
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify(data);
}

function applyCommonSeo(seo: { title: string; description: string }, canonical: string) {
  document.title = seo.title;
  upsertMeta('description', seo.description);
  upsertMeta('og:title', seo.title, 'property');
  upsertMeta('og:description', seo.description, 'property');
  upsertMeta('og:url', canonical, 'property');
  upsertMeta('og:type', 'website', 'property');
  upsertMeta('twitter:title', seo.title);
  upsertMeta('twitter:description', seo.description);
  removeMeta('og:image', 'property');
  removeMeta('twitter:image');
  removeMeta('twitter:card');
  removeMeta('article:published_time', 'property');
  removeMeta('article:modified_time', 'property');
  removeMeta('article:author', 'property');
  removeMeta('article:section', 'property');
  upsertCanonical(canonical);
}

function applyBlogSeo(post: BlogPost, canonical: string) {
  const seo = seoForBlogPost(post);
  const image = absoluteUrl(post.coverImage, window.location.origin);
  document.title = seo.title;
  upsertMeta('description', seo.description);
  upsertMeta('og:title', seo.title, 'property');
  upsertMeta('og:description', seo.description, 'property');
  upsertMeta('og:url', canonical, 'property');
  upsertMeta('og:type', 'article', 'property');
  upsertMeta('og:image', image, 'property');
  upsertMeta('article:published_time', post.publishedAt, 'property');
  upsertMeta('article:modified_time', post.updatedAt || post.publishedAt, 'property');
  upsertMeta('article:author', 'METTA ACADEMY', 'property');
  upsertMeta('article:section', post.category || 'Tin tức', 'property');
  upsertMeta('twitter:card', image ? 'summary_large_image' : 'summary');
  upsertMeta('twitter:title', seo.title);
  upsertMeta('twitter:description', seo.description);
  upsertMeta('twitter:image', image);
  upsertCanonical(canonical);
  upsertStructuredData(buildBlogPostingStructuredData(post, canonical, image));
}

export function PublicSeo() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (isAdminPath(pathname)) {
      document.title = 'METTA Admin';
      document.getElementById(JSONLD_SCRIPT_ID)?.remove();
      return;
    }
    let active = true;
    const blogSlug = blogSlugForPath(pathname);

    if (blogSlug) {
      publicBlogService.getBySlug(blogSlug)
        .then((post) => {
          if (!active || !post) return;
          applyBlogSeo(post, canonicalUrl(pathname));
        })
        .catch(() => undefined);

      return () => {
        active = false;
      };
    }

    Promise.all([publicCmsService.getSettings(), publicCmsService.getPages()])
      .then(([settings, pages]) => {
        if (!active) return;
        const seo = seoForPath(pathname, settings, pages);
        const canonical = canonicalUrl(pathname);
        applyCommonSeo(seo, canonical);
        upsertStructuredData(buildStructuredData(pathname, seo, settings.seoDescription || DEFAULT_DESCRIPTION, settings.mapUrl || DEFAULT_MAP_URL));
      })
      .catch(() => {
        if (!active) return;
        document.title = DEFAULT_TITLE;
        upsertMeta('description', DEFAULT_DESCRIPTION);
        upsertStructuredData(buildStructuredData(pathname, { title: DEFAULT_TITLE, description: DEFAULT_DESCRIPTION }));
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  return null;
}
