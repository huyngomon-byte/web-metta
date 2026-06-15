import { auth } from '@/lib/firebase';
import { currentUser } from '@/services/authService';

let purgeAttempted = false;

export async function purgeDemoDataOnServerOnce() {
  const user = currentUser();
  if (!user || !['admin', 'manager'].includes(user.role)) return;
  if (purgeAttempted) return;
  purgeAttempted = true;

  const token = await auth?.currentUser?.getIdToken().catch(() => '');
  if (!token) return;

  const response = await fetch('/api/demo-data-purge', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: string };
    console.warn('[DemoDataPurge] Server purge failed:', payload.error || response.statusText);
    return;
  }
}
