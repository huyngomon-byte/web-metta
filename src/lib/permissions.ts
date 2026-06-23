import type { Lead } from '@/types/crm';
import type { AdminUser, UserRole } from '@/types/user';

const DAY_MS = 24 * 60 * 60 * 1000;

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  sales: 'Sales',
  ads: 'Ads',
  design: 'Design',
};

export function isAdmin(user?: AdminUser | null) {
  return user?.active === true && user.role === 'admin';
}

export function isManager(user?: AdminUser | null) {
  return user?.active === true && user.role === 'manager';
}

export function canAssignLead(user?: AdminUser | null) {
  return isAdmin(user) || isManager(user);
}

export function canCreateLead(user?: AdminUser | null) {
  return !!user?.active && ['admin', 'manager', 'sales'].includes(user.role);
}

export function canDeleteLead(user?: AdminUser | null) {
  return isAdmin(user) || isManager(user);
}

export function canViewAllLeads(user?: AdminUser | null) {
  return isAdmin(user) || isManager(user);
}

export function leadAssignmentExpiresAtMs(lead: Partial<Lead>) {
  const explicitExpiresAt = Number(lead.assignedExpiresAtMs || 0);
  if (explicitExpiresAt) return explicitExpiresAt;
  const assignedAtMs = Number(lead.assignedAtMs || 0);
  return assignedAtMs ? assignedAtMs + DAY_MS : 0;
}

export function leadAssignmentExpired(lead: Partial<Lead>, nowMs = Date.now()) {
  if (!lead.assignedTo || lead.assignedStatus === 'returned') return false;
  if (lead.assignedStatus === 'accepted') return false;
  const expiresAtMs = leadAssignmentExpiresAtMs(lead);
  if (!expiresAtMs) return false;
  return nowMs >= expiresAtMs;
}

export function canViewLead(user: AdminUser | null | undefined, lead: Partial<Lead>) {
  if (!user?.active) return false;
  if (canViewAllLeads(user)) return true;
  if (user.role !== 'sales') return false;
  return lead.assignedTo === user.id && !leadAssignmentExpired(lead);
}

export function canUpdateLead(user: AdminUser | null | undefined, lead: Partial<Lead>) {
  if (!user?.active) return false;
  if (canViewAllLeads(user)) return true;
  if (user.role !== 'sales') return false;
  return lead.assignedTo === user.id && !leadAssignmentExpired(lead);
}

export function canManageCms(user?: AdminUser | null) {
  return !!user?.active && ['admin', 'manager', 'design'].includes(user.role);
}

export function canManageMarketing(user?: AdminUser | null) {
  return !!user?.active && ['admin', 'manager', 'ads'].includes(user.role);
}

export function canManageUsers(user?: AdminUser | null) {
  return isAdmin(user);
}

export function canViewReports(user?: AdminUser | null) {
  return !!user?.active && ['admin', 'manager', 'ads'].includes(user.role);
}

export function canAccessPath(user: AdminUser | null | undefined, path: string) {
  if (!user?.active) return false;
  if (user.role === 'admin') return true;
  if (path === '/dashboard') return user.role !== 'design';
  if (path.startsWith('/cms') || path === '/media') return canManageCms(user);
  if (path.startsWith('/crm/lead-assignment')) return canAssignLead(user);
  if (path.startsWith('/crm/tasks')) return ['admin', 'manager', 'sales'].includes(user.role);
  if (path.startsWith('/crm/database')) return canViewAllLeads(user);
  if (path.startsWith('/crm/calls')) return canViewAllLeads(user);
  if (path.startsWith('/crm/leads')) return ['manager', 'sales'].includes(user.role);
  if (path === '/appointments') return ['manager', 'sales'].includes(user.role);
  if (path.startsWith('/capi') || path.startsWith('/marketing') || path === '/reports') return canManageMarketing(user);
  if (path === '/users') return canManageUsers(user);
  if (path === '/settings') return ['manager', 'ads'].includes(user.role);
  return false;
}
