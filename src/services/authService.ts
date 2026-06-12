import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
  updatePassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { adminEmails, auth, db, isFirebaseConfigured } from '@/lib/firebase';
import type { AdminUser } from '@/types/user';

const KEY = 'metta_internal_admin';
const SESSION_CACHE_KEYS = [
  KEY,
  'metta_leads',
  'metta_lead_activities',
  'metta_appointments',
  'metta_sales_manual_tasks',
];

function persistUser(user: AdminUser) {
  localStorage.setItem(KEY, JSON.stringify(user));
  return user;
}

function makeUser(uid: string, email: string, displayName?: string, role: AdminUser['role'] = 'sales'): AdminUser {
  return {
    id: uid,
    fullName: displayName || email.split('@')[0],
    email,
    role,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function isAdminEmail(email: string) {
  return !adminEmails.length || adminEmails.includes(email.toLowerCase().trim());
}

async function loadOrCreateUserProfile(uid: string, email: string, displayName?: string, fallbackRole: AdminUser['role'] = 'sales') {
  const emailNorm = email.toLowerCase().trim();
  if (db) {
    const ref = doc(db, 'users', uid);
    const snap = await getDoc(ref).catch(() => null);
    if (snap?.exists()) {
      const profile = { id: uid, ...snap.data() } as AdminUser;
      if (!profile.active) throw new Error('Tài khoản này đang bị khóa.');
      return profile;
    }
    const user = makeUser(uid, emailNorm, displayName, fallbackRole);
    await setDoc(ref, user).catch(() => {});
    return user;
  }
  return makeUser(uid, emailNorm, displayName, fallbackRole);
}

async function loginWithAdminToken(email: string, password: string) {
  if (!auth) throw new Error('Firebase Auth chưa được cấu hình.');
  const response = await fetch('/api/admin-login-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json().catch(() => ({})) as { token?: string; error?: string };
  if (!response.ok || !payload.token) {
    throw new Error(payload.error || 'Không tạo được phiên đăng nhập Firebase.');
  }
  const credential = await signInWithCustomToken(auth, payload.token);
  return persistUser(await loadOrCreateUserProfile(
    credential.user.uid,
    credential.user.email || email,
    credential.user.displayName || undefined,
    'admin',
  ));
}

export async function login(email: string, password: string) {
  const emailNorm = email.toLowerCase().trim();

  if (isFirebaseConfigured && auth) {
    // Email admin/bootstrap: xac thuc qua server endpoint - mat khau chi kiem tra phia
    // server (ADMIN_PASSWORD), KHONG con nhung vao bundle client. Neu khong khop master
    // password thi roi xuong dang nhap Firebase thuong ben duoi.
    if (isAdminEmail(emailNorm)) {
      try {
        return await loginWithAdminToken(emailNorm, password);
      } catch {
        /* khong phai master password -> thu signInWithEmailAndPassword */
      }
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, emailNorm, password);
      const userEmail = (credential.user.email || '').toLowerCase();
      const fallbackRole: AdminUser['role'] = isAdminEmail(userEmail) ? 'admin' : 'sales';
      return persistUser(await loadOrCreateUserProfile(
        credential.user.uid,
        userEmail,
        credential.user.displayName || undefined,
        fallbackRole,
      ));
    } catch (error) {
      const code = (error as { code?: string })?.code ?? '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        throw new Error('Sai email hoặc mật khẩu.');
      }
      throw new Error('Đăng nhập thất bại: ' + (error instanceof Error ? error.message : code));
    }
  }

  throw new Error('Chưa cấu hình Firebase Auth.');
}

export async function changeCurrentPassword(currentPassword: string, newPassword: string) {
  if (!isFirebaseConfigured || !auth) throw new Error('Chưa cấu hình Firebase Auth.');
  const firebaseUser = auth.currentUser;
  const email = firebaseUser?.email;
  if (!firebaseUser || !email) throw new Error('Bạn cần đăng nhập lại để đổi mật khẩu.');
  if (!currentPassword || !newPassword) throw new Error('Vui lòng nhập đủ mật khẩu hiện tại và mật khẩu mới.');
  const credential = EmailAuthProvider.credential(email, currentPassword);
  await reauthenticateWithCredential(firebaseUser, credential);
  await updatePassword(firebaseUser, newPassword);
}

export function currentUser() {
  const raw = localStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as AdminUser) : null;
}

export async function logout() {
  SESSION_CACHE_KEYS.forEach((key) => localStorage.removeItem(key));
  if (isFirebaseConfigured && auth) await signOut(auth).catch(() => {});
}
