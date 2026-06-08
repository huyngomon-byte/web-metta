import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';

const USE_FIREBASE = !!db;
import type { BlogPost } from '@/types/cms';

const COL = 'blogPosts';
const LS_KEY = 'metta_blog_posts';

function readLocal(): BlogPost[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; }
}

function saveLocal(posts: BlogPost[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(posts));
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
      try {
        const q = query(collection(db, COL), orderBy('publishedAt', 'desc'));
        const snap = await getDocs(q);
        const remote = snap.docs.map((d) => ({ id: d.id, ...d.data() } as BlogPost));
        if (remote.length) { saveLocal(remote); return remote; }
      } catch (e) {
        console.warn('[Blog] Firestore read failed, using local:', e);
      }
    }
    return readLocal().sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
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
    const existing = readLocal().find((p) => p.id === post.id);
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

    const local = readLocal();
    const idx = local.findIndex((p) => p.id === saved.id);
    if (idx >= 0) local[idx] = saved; else local.unshift(saved);
    saveLocal(local);

    if (USE_FIREBASE && db) {
      try { await setDoc(doc(db, COL, saved.id), saved); }
      catch (e) { console.warn('[Blog] Firestore write failed:', e); }
    }
    return saved;
  },

  delete: async (id: string): Promise<void> => {
    const local = readLocal().filter((p) => p.id !== id);
    saveLocal(local);
    if (USE_FIREBASE && db) {
      try { await deleteDoc(doc(db, COL, id)); }
      catch (e) { console.warn('[Blog] Firestore delete failed:', e); }
    }
  },
};
