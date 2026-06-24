export type SalesImportUser = {
  id: string;
  fullName?: string;
  email?: string;
};

function normalizedIdentity(value: unknown) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function userIdentityKeys(user: SalesImportUser) {
  return new Set([
    String(user.id || '').trim(),
    normalizedIdentity(user.id),
    normalizedIdentity(user.fullName),
    normalizedIdentity(user.email),
  ].filter(Boolean));
}

export function canImportLeadAssignment(role: unknown) {
  return ['admin', 'manager'].includes(String(role || ''));
}

export function salesImportExistingLeadAccess(
  user: SalesImportUser,
  existingAssignedTo: unknown,
  existingAssignedToName: unknown,
) {
  const ownerValues = [existingAssignedTo, existingAssignedToName]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
  if (!ownerValues.length) return 'unassigned' as const;
  const ownKeys = userIdentityKeys(user);
  return ownerValues.every((value) => ownKeys.has(value) || ownKeys.has(normalizedIdentity(value)))
    ? 'own' as const
    : 'forbidden' as const;
}
