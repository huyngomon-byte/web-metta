import { publicCmsService } from '@/services/publicCmsService';
import type { BlogPost } from '@/types/cms';

const DEFAULT_PUBLIC_NEWS_LIMIT = 12;
const publishedPagePromises = new Map<string, Promise<PublicBlogPage>>();
const postBySlugPromises = new Map<string, Promise<BlogPost | undefined>>();

export type PublicBlogPage = {
  posts: BlogPost[];
  page: number;
  pageSize: number;
  hasNext: boolean;
};

type SeedNewsItem = {
  title: string;
  date: string;
  category: string;
  image: string;
  excerpt: string;
  link?: string;
};

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function dateFromVN(value: string) {
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

async function seedPosts(): Promise<BlogPost[]> {
  const sections = await publicCmsService.getVisibleSections('page-home');
  const news = sections.find((section) => section.type === 'News');
  return parseNewsItems(news?.extraData).map((item, index) => ({
    id: `seed-news-${index + 1}`,
    title: item.title,
    slug: slugify(item.title),
    category: item.category || 'Tin tức',
    author: 'METTA Academy',
    excerpt: item.excerpt || '',
    metaTitle: item.title,
    metaDescription: item.excerpt || '',
    content: `<p>${item.excerpt || ''}</p>`,
    coverImage: item.image || '',
    status: 'published',
    publishedAt: dateFromVN(item.date),
    createdAt: dateFromVN(item.date),
    updatedAt: dateFromVN(item.date),
  }));
}

async function fetchPublicPage(page: number, pageSize: number): Promise<PublicBlogPage> {
  try {
    const params = new URLSearchParams({
      id: 'publicBlogPosts',
      limit: String(pageSize),
      page: String(page),
    });
    const response = await fetch(`/api/app-config?${params.toString()}`);
    if (!response.ok) return { posts: [], page, pageSize, hasNext: false };
    const payload = await response.json() as Partial<PublicBlogPage> & { limit?: number; posts?: BlogPost[] };
    return {
      posts: Array.isArray(payload.posts) ? payload.posts : [],
      page: Number(payload.page || page),
      pageSize: Number(payload.pageSize || payload.limit || pageSize),
      hasNext: Boolean(payload.hasNext),
    };
  } catch (error) {
    console.warn('[PublicBlog] Cannot read public blog API, using CMS news fallback:', error);
    return { posts: [], page, pageSize, hasNext: false };
  }
}

async function fetchPublicPostBySlug(slug: string): Promise<BlogPost | undefined> {
  try {
    const params = new URLSearchParams({
      id: 'publicBlogPost',
      slug,
    });
    const response = await fetch(`/api/app-config?${params.toString()}`);
    if (!response.ok) return undefined;
    const payload = await response.json() as { post?: BlogPost };
    return payload.post;
  } catch (error) {
    console.warn('[PublicBlog] Cannot read public blog post API, using CMS news fallback:', error);
    return undefined;
  }
}

async function publishedPage(page = 1, pageSize = DEFAULT_PUBLIC_NEWS_LIMIT): Promise<PublicBlogPage> {
  const safePage = Math.max(1, Math.round(page));
  const safePageSize = Math.max(1, Math.min(50, Math.round(pageSize)));
  const cacheKey = `${safePage}:${safePageSize}`;
  if (!publishedPagePromises.has(cacheKey)) {
    publishedPagePromises.set(cacheKey, (async () => {
      const remote = await fetchPublicPage(safePage, safePageSize);
      if (remote.posts.length) return remote;
      const seeds = await seedPosts();
      const startIndex = (safePage - 1) * safePageSize;
      const endIndex = startIndex + safePageSize;
      return {
        posts: seeds.slice(startIndex, endIndex),
        page: safePage,
        pageSize: safePageSize,
        hasNext: seeds.length > endIndex,
      };
    })());
  }
  return publishedPagePromises.get(cacheKey) as Promise<PublicBlogPage>;
}

async function publishedPosts(limit = DEFAULT_PUBLIC_NEWS_LIMIT): Promise<BlogPost[]> {
  return (await publishedPage(1, limit)).posts;
}

export const publicBlogService = {
  getPublished: publishedPosts,
  getPage: publishedPage,
  getBySlug: async (slug: string) => {
    const normalizedSlug = slug.trim();
    if (!normalizedSlug) return undefined;
    if (!postBySlugPromises.has(normalizedSlug)) {
      postBySlugPromises.set(normalizedSlug, (async () => {
        const remote = await fetchPublicPostBySlug(normalizedSlug);
        if (remote) return remote;
        const posts = await seedPosts();
        return posts.find((post) => post.slug === normalizedSlug);
      })());
    }
    return postBySlugPromises.get(normalizedSlug);
  },
};
