import {
  collection,
  getDocs,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { publicCmsService } from '@/services/publicCmsService';
import type { BlogPost } from '@/types/cms';

const USE_FIREBASE = isFirebaseConfigured && !!db;

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

async function firestorePosts(): Promise<BlogPost[]> {
  if (!USE_FIREBASE || !db) return [];
  try {
    const snap = await getDocs(collection(db, 'blogPosts'));
    return snap.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as BlogPost))
      .filter((post) => post.status === 'published')
      .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));
  } catch (error) {
    console.warn('[PublicBlog] Cannot read Firestore blog posts, using CMS news fallback:', error);
    return [];
  }
}

export const publicBlogService = {
  getPublished: async () => {
    const remote = await firestorePosts();
    return remote.length ? remote : seedPosts();
  },
  getBySlug: async (slug: string) => {
    const remote = await firestorePosts();
    const posts = remote.length ? remote : await seedPosts();
    return posts.find((post) => post.slug === slug);
  },
};
