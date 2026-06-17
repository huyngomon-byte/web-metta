import type { Firestore } from 'firebase-admin/firestore';
import { adminAuth } from './_firebaseAdmin.js';

export type VercelRequestLike = {
  headers: Record<string, string | string[] | undefined>;
};

export type ApiUser = {
  id: string;
  email: string;
  fullName: string;
  role: string;
  active: boolean;
};

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function firstHeaderValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function adminEmails() {
  return String(process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export async function requireApiUser(db: Firestore, req: VercelRequestLike): Promise<ApiUser> {
  const authHeader = firstHeaderValue(req.headers.authorization || req.headers.Authorization as string | string[] | undefined);
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) throw new ApiError(401, 'Missing Authorization bearer token.');

  const decoded = await adminAuth().verifyIdToken(token).catch(() => null);
  if (!decoded) throw new ApiError(401, 'Invalid Authorization bearer token.');

  const userSnap = await db.collection('users').doc(decoded.uid).get();
  if (userSnap.exists) {
    const data = userSnap.data() || {};
    if (data.active !== true) throw new ApiError(403, 'User is inactive.');
    return {
      id: decoded.uid,
      email: String(data.email || decoded.email || ''),
      fullName: String(data.fullName || decoded.name || decoded.email || ''),
      role: String(data.role || ''),
      active: true,
    };
  }

  const email = String(decoded.email || '').toLowerCase();
  if (email && adminEmails().includes(email)) {
    return {
      id: decoded.uid,
      email,
      fullName: String(decoded.name || decoded.email || 'Admin'),
      role: 'admin',
      active: true,
    };
  }

  throw new ApiError(403, 'User profile is not allowed.');
}

export function requireAnyRole(user: ApiUser, roles: string[]) {
  if (!roles.includes(user.role)) {
    throw new ApiError(403, 'You do not have permission for this action.');
  }
}
