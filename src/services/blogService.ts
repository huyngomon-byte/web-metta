import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';

const USE_FIREBASE = isFirebaseConfigured && !!db;
import type { BlogPost } from '@/types/cms';

const COL = 'blogPosts';
let cachedPosts: BlogPost[] = [];

function readCache(): BlogPost[] {
  return cachedPosts;
}

function saveCache(posts: BlogPost[]) {
  cachedPosts = posts;
}

function genId() {
  return `blog-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd').replace(/Đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export const blogService = {
  getPosts: async (): Promise<BlogPost[]> => {
    if (USE_FIREBASE && db) {
      const q = query(collection(db, COL), orderBy('publishedAt', 'desc'));
      const snap = await getDocs(q);
      const remote = snap.docs.map((d) => ({ id: d.id, ...d.data() } as BlogPost));
      saveCache(remote);
      return remote;
    }
    return readCache().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  },

  getPublished: async (): Promise<BlogPost[]> => {
    const all = await blogService.getPosts();
    return all.filter((p) => p.status === 'published');
  },

  getBySlug: async (slug: string): Promise<BlogPost | undefined> => {
    const all = await blogService.getPosts();
    return all.find((p) => p.slug === slug);
  },

  save: async (post: Partial<BlogPost>): Promise<BlogPost> => {
    const now = new Date().toISOString();
    const existing = readCache().find((p) => p.id === post.id);
    const saved: BlogPost = {
      id: post.id || genId(),
      title: post.title || '',
      slug: post.slug || slugify(post.title || ''),
      category: post.category || 'Tin tức',
      author: post.author || '',
      excerpt: post.excerpt || '',
      content: post.content || '',
      coverImage: post.coverImage || '',
      status: post.status || 'draft',
      publishedAt: post.publishedAt || now,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    if (USE_FIREBASE && db) {
      await setDoc(doc(db, COL, saved.id), saved);
    }
    const local = readCache().filter((p) => p.id !== saved.id);
    saveCache([saved, ...local]);
    return saved;
  },

  delete: async (id: string): Promise<void> => {
    if (USE_FIREBASE && db) {
      await deleteDoc(doc(db, COL, id));
    }
    saveCache(readCache().filter((p) => p.id !== id));
  },
};
