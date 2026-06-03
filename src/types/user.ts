import type { roles } from '@/lib/constants';

export type UserRole = (typeof roles)[number];

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  avatarUrl?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}
