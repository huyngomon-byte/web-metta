import { adminDb } from './_firebaseAdmin.js';

type VercelRequest = {
  method?: string;
};

type VercelResponse = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => VercelResponse;
  send: (body: string) => void;
};

type BlogPost = {
  slug?: string;
  title?: string;
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

const SITE_URL = 'https://www.metta.edu.vn';

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

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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

async function readSeedNewsPosts(): Promise<BlogPost[]> {
  const snap = await adminDb().collection('pageSections').where('pageId', '==', 'page-home').get();
  const news = snap.docs
    .map((doc) => doc.data())
    .find((section) => section.visible !== false && section.type === 'News');

  return parseNewsItems(String(news?.extraData || '')).map((item) => ({
    slug: slugify(String(item.title || '')),
    title: item.title,
    status: 'published',
    publishedAt: dateFromVN(item.date),
    updatedAt: dateFromVN(item.date),
  })).filter((post) => post.slug);
}

async function readBlogPosts(): Promise<BlogPost[]> {
  const snap = await adminDb().collection('blogPosts').get();
  const posts = snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as BlogPost))
    .filter((post) => post.status === 'published' && post.slug)
    .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));

  return posts.length ? posts : readSeedNewsPosts();
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method && req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).send('Method not allowed');
  }

  const today = new Date().toISOString().slice(0, 10);
  let blogPosts: BlogPost[] = [];
  try {
    blogPosts = await readBlogPosts();
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

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
  return res.status(200).send(xml);
}
