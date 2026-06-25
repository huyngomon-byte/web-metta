import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';
import { delay, store } from '@/services/store';
import type { AdminUser } from '@/types/user';

const USE_FIREBASE = isFirebaseConfigured && !!db;
const USERS_TTL_MS = 2 * 60_000;

let usersCache: { at: number; data: AdminUser[] } | null = null;

export const userService = {
  getUsers: async (force = false) => {
    if (!force && usersCache && Date.now() - usersCache.at < USERS_TTL_MS) {
      return delay(usersCache.data);
    }
    if (USE_FIREBASE) {
      try {
        const snap = await getDocs(query(collection(db!, 'users'), orderBy('fullName', 'asc')));
        store.users = snap.docs.map((item) => ({ id: item.id, ...item.data() }) as AdminUser);
      } catch (error) {
        console.warn('[Users] Firestore read failed, using local:', error);
      }
    }
    usersCache = { at: Date.now(), data: store.users };
    return delay(store.users);
  },

  saveUser: async (user: Partial<AdminUser> & { password?: string }) => {
    const token = await auth?.currentUser?.getIdToken();
    const response = await fetch('/api/admin-users', {
      method: user.id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(user),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Không lưu được user.');
    await userService.getUsers(true);
    return payload.user as AdminUser;
  },

  deleteUser: async (id: string) => {
    const token = await auth?.currentUser?.getIdToken();
    const response = await fetch('/api/admin-users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ id }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Không xóa được user.');
    store.users = store.users.filter((user) => user.id !== id);
    await userService.getUsers(true);
    return true;
  },
};
