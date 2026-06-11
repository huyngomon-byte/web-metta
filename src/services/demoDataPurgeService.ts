import { auth } from '@/lib/firebase';
import { currentUser } from '@/services/authService';

const SERVER_PURGE_KEY = 'metta_demo_data_server_purge_2026_06_11_v3';

export async function purgeDemoDataOnServerOnce() {
  const user = currentUser();
  if (!user || !['admin', 'manager'].includes(user.role)) return;
  if (localStorage.getItem(SERVER_PURGE_KEY)) return;

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

  localStorage.setItem(SERVER_PURGE_KEY, '1');
}
