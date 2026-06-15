import { auth } from '@/lib/firebase';

async function authHeaders() {
  const token = await auth?.currentUser?.getIdToken();
  if (!token) throw new Error('Missing auth token');
  return { Authorization: `Bearer ${token}` };
}

export async function readAppConfig<T>(id: string, field: string) {
  const response = await fetch(`/api/app-config?id=${encodeURIComponent(id)}`, {
    headers: await authHeaders(),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown> & { error?: string };
  if (!response.ok) throw new Error(payload.error || 'Cannot read app config');
  return Array.isArray(payload[field]) ? payload[field] as T[] : null;
}

export async function writeAppConfig<T>(id: string, field: string, value: T[]) {
  const response = await fetch(`/api/app-config?id=${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify({ [field]: value }),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown> & { error?: string };
  if (!response.ok) throw new Error(payload.error || 'Cannot save app config');
  return Array.isArray(payload[field]) ? payload[field] as T[] : value;
}
