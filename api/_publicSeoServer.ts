import { adminDb } from './_firebaseAdmin.js';

type HeaderValue = string | string[] | undefined;

export type PublicSeoRequest = {
  method?: string;
  headers: Record<string, HeaderValue>;
  query?: Record<string, HeaderValue>;
};

export type PublicSeoResponse = {
  setHeader?: (name: string, value: string) => void;
  status: (code: number) => PublicSeoResponse;
  send?: (body: string) => void;
  json: (body: unknown) => void;
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
const SITE_URL = 'https://www.metta.edu.vn';
const LOGO_URL = `${ORGANIZATION_URL}/logo.png`;
const DEFAULT_TITLE = 'METTA ACADEMY – Giỏi ngoại ngữ, giàu kỹ năng, lãnh đạo tương lai';
const DEFAULT_DESCRIPTION = 'Trung tâm Anh ngữ quốc tế METTA Academy – chương trình tiếng Anh hiện đại giúp trẻ phát triển ngôn ngữ, tư duy phản biện và sự tự tin.';

const BLOG_PAGE_CACHE_HEADER = 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400';
const BLOG_LIST_CACHE_HEADER = 'public, max-age=60, s-maxage=900, stale-while-revalidate=3600';
const SITEMAP_CACHE_HEADER = 'public, max-age=300, s-maxage=21600, stale-while-revalidate=86400';
const PUBLIC_BLOG_LIST_CACHE_MS = 5 * 60 * 1000;
const SITEMAP_MEMORY_CACHE_MS = 6 * 60 * 60 * 1000;
const SITEMAP_BLOG_LIMIT = 100;
const DEFAULT_PUBLIC_BLOG_LIMIT = 12;
let sitemapCache: { expiresAt: number; xml: string } | null = null;
const publicBlogListCache = new Map<string, { expiresAt: number; posts: BlogPost[]; hasNext: boolean }>();

type PublicBlogPage = {
  posts: BlogPost[];
  page: number;
  pageSize: number;
  hasNext: boolean;
};

const STATIC_ROUTES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/programs/metta-kiddies', priority: '0.9', changefreq: 'monthly' },
  { path: '/programs/metta-on-phonics', priority: '0.9', changefreq: 'monthly' },
  { path: '/programs/metta-young-learner', priority: '0.9', changefreq: 'monthly' },
  { path: '/programs/ielts-junior', priority: '0.9', changefreq: 'monthly' },
  { path: '/tin-tuc', priority: '0.8', changefreq: 'weekly' },
  { path: '/contact', priority: '0.7', changefreq: 'monthly' },
  { path: '/p/landing-page-phonics', priority: '0.7', changefreq: 'monthly' },
];

function firstValue(value: HeaderValue) {
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

function escapeXml(value: string) {
  return escapeHtml(value).replace(/&#39;/g, '&apos;');
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
  if (!value) return '';
  const [day, month, year] = value.split('/').map((part) => Number(part));
  if (!day || !month || !year) return '';
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

function dateOnly(value?: string) {
  const timestamp = Date.parse(String(value || ''));
  if (!Number.isFinite(timestamp)) return new Date().toISOString().slice(0, 10);
  return new Date(timestamp).toISOString().slice(0, 10);
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

function sendText(res: PublicSeoResponse, status: number, body: string) {
  const response = res.status(status);
  if (response.send) return response.send(body);
  return response.json(body);
}

function canonicalOrigin(req: PublicSeoRequest) {
  const host = firstValue(req.headers['x-forwarded-host']) || firstValue(req.headers.host) || 'www.metta.edu.vn';
  const proto = firstValue(req.headers['x-forwarded-proto']) || 'https';
  return `${proto}://${host}`;
}

function numberFromQuery(value: HeaderValue, fallback: number, max: number) {
  const raw = firstValue(value);
  const parsed = Number.parseInt(String(raw || ''), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(max, Math.max(1, parsed));
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

function sortPublishedPosts(posts: BlogPost[]) {
  return posts
    .filter((post) => post.status === 'published' && post.slug)
    .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
}

async function readPublishedBlogPage(page = 1, pageSize = DEFAULT_PUBLIC_BLOG_LIMIT): Promise<PublicBlogPage> {
  const safePage = Math.max(1, Math.round(page));
  const safePageSize = Math.max(1, Math.min(100, Math.round(pageSize)));
  const startIndex = (safePage - 1) * safePageSize;
  const endIndex = startIndex + safePageSize;
  const readThrough = endIndex + 1;
  let snap: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;

  try {
    snap = await adminDb()
      .collection('blogPosts')
      .where('status', '==', 'published')
      .orderBy('publishedAt', 'desc')
      .limit(readThrough)
      .get();
  } catch (error) {
    console.warn('[PublicBlogPosts] Cannot use status/publishedAt query, falling back to bounded scan:', error);
    const fallbackReadLimit = Math.min(300, readThrough * 3);
    snap = await adminDb()
      .collection('blogPosts')
      .orderBy('publishedAt', 'desc')
      .limit(fallbackReadLimit)
      .get();
  }

  const posts = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as BlogPost))
    .filter((post) => post.status === 'published' && post.slug);

  const sortedPosts = sortPublishedPosts(posts);
  const pagePosts = sortedPosts.slice(startIndex, endIndex);
  if (pagePosts.length) {
    return {
      posts: pagePosts,
      page: safePage,
      pageSize: safePageSize,
      hasNext: sortedPosts.length > endIndex,
    };
  }

  const seedPosts = await readSeedNewsPosts();
  const seedPagePosts = seedPosts.slice(startIndex, endIndex);
  return {
    posts: seedPagePosts,
    page: safePage,
    pageSize: safePageSize,
    hasNext: seedPosts.length > endIndex,
  };
}

async function readPublishedBlogPosts(maxPosts = DEFAULT_PUBLIC_BLOG_LIMIT): Promise<BlogPost[]> {
  return (await readPublishedBlogPage(1, maxPosts)).posts;
}

async function readPost(slug: string): Promise<BlogPost | null> {
  const normalizedSlug = slug.trim();
  if (!normalizedSlug) return null;

  try {
    const snap = await adminDb()
      .collection('blogPosts')
      .where('slug', '==', normalizedSlug)
      .limit(1)
      .get();
    const remotePost = snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as BlogPost))
      .find((post) => post.status === 'published' && post.slug);
    if (remotePost) return remotePost;
  } catch (error) {
    console.warn('[BlogPage] Cannot read blog post by slug:', error);
  }

  const seedPosts = await readSeedNewsPosts();
  return seedPosts.find((post) => post.slug === normalizedSlug) || null;
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

function renderUrl(path: string, lastmod: string, changefreq: string, priority: string) {
  return [
    '  <url>',
    `    <loc>${escapeXml(`${SITE_URL}${path === '/' ? '/' : path}`)}</loc>`,
    `    <lastmod>${escapeXml(lastmod)}</lastmod>`,
    `    <changefreq>${escapeXml(changefreq)}</changefreq>`,
    `    <priority>${escapeXml(priority)}</priority>`,
    '  </url>',
  ].join('\n');
}

export async function sendSitemap(req: PublicSeoRequest, res: PublicSeoResponse) {
  if (req.method && req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return sendText(res, 405, 'Method not allowed');
  }

  res.setHeader?.('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader?.('Cache-Control', SITEMAP_CACHE_HEADER);

  if (sitemapCache && sitemapCache.expiresAt > Date.now()) {
    res.setHeader?.('X-METTA-Sitemap-Cache', 'memory-hit');
    return sendText(res, 200, sitemapCache.xml);
  }

  const today = new Date().toISOString().slice(0, 10);
  let blogPosts: BlogPost[] = [];
  try {
    blogPosts = await readPublishedBlogPosts(SITEMAP_BLOG_LIMIT);
  } catch (error) {
    console.warn('[Sitemap] Cannot read blog posts:', error);
  }

  const staticUrls = STATIC_ROUTES.map((route) => renderUrl(route.path, today, route.changefreq, route.priority));
  const blogUrls = blogPosts.map((post) => renderUrl(
    `/tin-tuc/${post.slug}`,
    dateOnly(post.updatedAt || post.publishedAt),
    'monthly',
    '0.7',
  ));

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticUrls,
    ...blogUrls,
    '</urlset>',
    '',
  ].join('\n');

  sitemapCache = {
    xml,
    expiresAt: Date.now() + SITEMAP_MEMORY_CACHE_MS,
  };
  res.setHeader?.('X-METTA-Sitemap-Cache', 'generated');
  return sendText(res, 200, xml);
}

export async function sendPublicBlogPosts(req: PublicSeoRequest, res: PublicSeoResponse) {
  if (req.method && req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const limit = numberFromQuery(req.query?.limit, DEFAULT_PUBLIC_BLOG_LIMIT, 50);
  const page = numberFromQuery(req.query?.page, 1, 1000);
  const cacheKey = `${page}:${limit}`;
  const cached = publicBlogListCache.get(cacheKey);

  res.setHeader?.('Cache-Control', BLOG_LIST_CACHE_HEADER);
  if (cached && cached.expiresAt > Date.now()) {
    res.setHeader?.('X-METTA-Public-Blog-Cache', 'memory-hit');
    return res.status(200).json({ posts: cached.posts, limit, page, hasNext: cached.hasNext, source: 'cache' });
  }

  try {
    const pageResult = await readPublishedBlogPage(page, limit);
    publicBlogListCache.set(cacheKey, {
      posts: pageResult.posts,
      hasNext: pageResult.hasNext,
      expiresAt: Date.now() + PUBLIC_BLOG_LIST_CACHE_MS,
    });
    res.setHeader?.('X-METTA-Public-Blog-Cache', 'generated');
    return res.status(200).json({ ...pageResult, limit, source: 'firestore' });
  } catch (error) {
    console.warn('[PublicBlogPosts] Cannot read blog posts:', error);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const seedPosts = await readSeedNewsPosts().catch(() => []);
    const posts = seedPosts.slice(startIndex, endIndex);
    return res.status(200).json({ posts, limit, page, hasNext: seedPosts.length > endIndex, source: 'seed' });
  }
}

export async function sendPublicBlogPost(req: PublicSeoRequest, res: PublicSeoResponse) {
  if (req.method && req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const slug = String(firstValue(req.query?.slug) || '').trim();
  res.setHeader?.('Cache-Control', BLOG_PAGE_CACHE_HEADER);
  const post = slug ? await readPost(slug).catch((error) => {
    console.warn('[PublicBlogPost] Cannot read blog post:', error);
    return null;
  }) : null;

  if (!post) return res.status(404).json({ error: 'Blog post not found' });
  return res.status(200).json({ post });
}

export async function sendBlogPage(req: PublicSeoRequest, res: PublicSeoResponse) {
  if (req.method && req.method !== 'GET') {
    res.setHeader?.('Allow', 'GET');
    return sendText(res, 405, 'Method not allowed');
  }

  const slug = String(firstValue(req.query?.slug) || '').trim();
  const origin = canonicalOrigin(req);
  const indexHtml = await readIndexHtml(origin);
  const post = slug ? await readPost(slug).catch((error) => {
    console.warn('[BlogPage] Cannot read blog post:', error);
    return null;
  }) : null;

  res.setHeader?.('Content-Type', 'text/html; charset=utf-8');
  res.setHeader?.('Cache-Control', BLOG_PAGE_CACHE_HEADER);
  if (!post) return sendText(res, 200, indexHtml);

  const canonical = `${origin}/tin-tuc/${encodeURIComponent(String(post.slug || slug))}`;
  const image = absoluteUrl(post.coverImage, origin);
  const html = injectBlogSeo(indexHtml, post, canonical, image);

  return sendText(res, 200, html);
}
