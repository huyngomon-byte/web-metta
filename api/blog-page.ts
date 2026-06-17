import { adminDb } from './_firebaseAdmin.js';

type HeaderValue = string | string[] | undefined;

type VercelRequest = {
  method?: string;
  headers: Record<string, HeaderValue>;
  query?: Record<string, HeaderValue>;
};

type VercelResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => VercelResponse;
  send: (body: string) => void;
};

type BlogPost = {
  id?: string;
  title?: string;
  slug?: string;
  category?: string;
  author?: string;
  excerpt?: string;
  metaTitle?: string;
  metaDescription?: string;
  coverImage?: string;
  status?: string;
  publishedAt?: string;
  updatedAt?: string;
};

type SeedNewsItem = {
  title?: string;
  date?: string;
  category?: string;
  image?: string;
  excerpt?: string;
};

const ORGANIZATION_URL = 'https://metta.edu.vn';
const LOGO_URL = `${ORGANIZATION_URL}/logo.png`;
const DEFAULT_TITLE = 'METTA ACADEMY – Giỏi ngoại ngữ, giàu kỹ năng, lãnh đạo tương lai';
const DEFAULT_DESCRIPTION = 'Trung tâm Anh ngữ quốc tế METTA Academy – chương trình tiếng Anh hiện đại giúp trẻ phát triển ngôn ngữ, tư duy phản biện và sự tự tin.';

function firstHeader(value: HeaderValue) {
  return Array.isArray(value) ? value[0] : value;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function dateFromVN(value?: string) {
  if (!value) return new Date().toISOString();
  const [day, month, year] = value.split('/').map((part) => Number(part));
  if (!day || !month || !year) return new Date().toISOString();
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

function parseNewsItems(extraData?: string): SeedNewsItem[] {
  if (!extraData) return [];
  try {
    const items = JSON.parse(extraData) as SeedNewsItem[];
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function canonicalOrigin(req: VercelRequest) {
  const host = firstHeader(req.headers['x-forwarded-host']) || firstHeader(req.headers.host) || 'www.metta.edu.vn';
  const proto = firstHeader(req.headers['x-forwarded-proto']) || 'https';
  return `${proto}://${host}`;
}

function absoluteUrl(value: string | undefined, origin: string) {
  const raw = String(value || '').trim();
  if (!raw || raw.startsWith('data:')) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  try {
    return new URL(raw, origin).href;
  } catch {
    return '';
  }
}

function seoForPost(post: BlogPost) {
  return {
    title: String(post.metaTitle || post.title || DEFAULT_TITLE),
    description: String(post.metaDescription || post.excerpt || DEFAULT_DESCRIPTION),
  };
}

async function readSeedNewsPosts(): Promise<BlogPost[]> {
  const snap = await adminDb().collection('pageSections').where('pageId', '==', 'page-home').get();
  const news = snap.docs
    .map((doc) => doc.data())
    .find((section) => section.visible !== false && section.type === 'News');

  return parseNewsItems(String(news?.extraData || '')).map((item, index) => ({
    id: `seed-news-${index + 1}`,
    title: item.title || '',
    slug: slugify(String(item.title || '')),
    category: item.category || 'Tin tức',
    author: 'METTA Academy',
    excerpt: item.excerpt || '',
    metaTitle: item.title || '',
    metaDescription: item.excerpt || '',
    coverImage: item.image || '',
    status: 'published',
    publishedAt: dateFromVN(item.date),
    updatedAt: dateFromVN(item.date),
  })).filter((post) => post.slug);
}

async function readPost(slug: string): Promise<BlogPost | null> {
  const snap = await adminDb().collection('blogPosts').get();
  const remote = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as BlogPost))
    .find((post) => post.status === 'published' && post.slug === slug);
  if (remote) return remote;

  const seedPosts = await readSeedNewsPosts();
  return seedPosts.find((post) => post.slug === slug) || null;
}

async function readIndexHtml(origin: string) {
  const response = await fetch(`${origin}/index.html`);
  if (!response.ok) throw new Error(`Cannot read index.html: ${response.status}`);
  return response.text();
}

function buildBlogPosting(post: BlogPost, canonical: string, image: string) {
  const seo = seoForPost(post);
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${ORGANIZATION_URL}/#organization`,
        name: 'METTA ACADEMY',
        url: ORGANIZATION_URL,
        logo: LOGO_URL,
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
          url: ORGANIZATION_URL,
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

function metaTag(name: string, content: string) {
  if (!content) return '';
  return `<meta name="${escapeHtml(name)}" content="${escapeHtml(content)}" />`;
}

function propertyTag(property: string, content: string) {
  if (!content) return '';
  return `<meta property="${escapeHtml(property)}" content="${escapeHtml(content)}" />`;
}

function injectBlogSeo(html: string, post: BlogPost, canonical: string, image: string) {
  const seo = seoForPost(post);
  const schema = JSON.stringify(buildBlogPosting(post, canonical, image));
  const extraHead = [
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    propertyTag('og:type', 'article'),
    propertyTag('og:title', seo.title),
    propertyTag('og:description', seo.description),
    propertyTag('og:url', canonical),
    propertyTag('og:image', image),
    propertyTag('article:published_time', String(post.publishedAt || '')),
    propertyTag('article:modified_time', String(post.updatedAt || post.publishedAt || '')),
    propertyTag('article:author', 'METTA ACADEMY'),
    propertyTag('article:section', String(post.category || 'Tin tức')),
    metaTag('twitter:card', image ? 'summary_large_image' : 'summary'),
    metaTag('twitter:title', seo.title),
    metaTag('twitter:description', seo.description),
    metaTag('twitter:image', image),
  ].filter(Boolean).join('\n    ');

  return html
    .replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(seo.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/?>/i, `<meta name="description" content="${escapeHtml(seo.description)}" />`)
    .replace(/<script id="metta-jsonld" type="application\/ld\+json">[\s\S]*?<\/script>/i, `<script id="metta-jsonld" type="application/ld+json">${schema}</script>`)
    .replace('</head>', `    ${extraHead}\n  </head>`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method not allowed');
  }

  const slug = String(firstHeader(req.query?.slug) || '').trim();
  const origin = canonicalOrigin(req);
  const indexHtml = await readIndexHtml(origin);
  const post = slug ? await readPost(slug).catch((error) => {
    console.warn('[BlogPage] Cannot read blog post:', error);
    return null;
  }) : null;

  if (!post) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(indexHtml);
  }

  const canonical = `${origin}/tin-tuc/${encodeURIComponent(String(post.slug || slug))}`;
  const image = absoluteUrl(post.coverImage, origin);
  const html = injectBlogSeo(indexHtml, post, canonical, image);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
  return res.status(200).send(html);
}
