import { publicCmsService } from '@/services/publicCmsService';
import type { BlogPost } from '@/types/cms';

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
    content: `<p>${item.excerpt || ''}</p>`,
    coverImage: item.image || '',
    status: 'published',
    publishedAt: dateFromVN(item.date),
    createdAt: dateFromVN(item.date),
    updatedAt: dateFromVN(item.date),
  }));
}

export const publicBlogService = {
  getPublished: async () => seedPosts(),
  getBySlug: async (slug: string) => {
    const posts = await seedPosts();
    return posts.find((post) => post.slug === slug);
  },
};
