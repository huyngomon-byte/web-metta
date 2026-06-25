import { auth } from '@/lib/firebase';
import type { Lead } from '@/types/crm';

export type DashboardSummaryFilters = {
  sales?: string;
  source?: string;
  course?: string;
  center?: string;
};

export type DashboardSummary = {
  leads: Lead[];
  cached?: boolean;
  generatedAt?: string;
};

async function authHeaders() {
  const token = await auth?.currentUser?.getIdToken().catch(() => '');
  if (!token) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
  return { Authorization: `Bearer ${token}` };
}

function appendParam(params: URLSearchParams, key: string, value?: string) {
  const normalized = String(value || '').trim();
  if (normalized) params.set(key, normalized);
}

export const dashboardService = {
  getSummary: async (filters: DashboardSummaryFilters = {}): Promise<DashboardSummary> => {
    const params = new URLSearchParams({ id: 'dashboardSummary' });
    appendParam(params, 'sales', filters.sales);
    appendParam(params, 'source', filters.source);
    appendParam(params, 'course', filters.course);
    appendParam(params, 'center', filters.center);

    const response = await fetch(`/api/app-config?${params.toString()}`, {
      headers: await authHeaders(),
    });
    const payload = await response.json().catch(() => ({})) as Partial<DashboardSummary> & { error?: string };
    if (!response.ok) throw new Error(payload.error || 'Không tải được dữ liệu dashboard.');
    if (!Array.isArray(payload.leads)) throw new Error('Server trả về dữ liệu dashboard không hợp lệ.');
    return {
      leads: payload.leads,
      cached: Boolean(payload.cached),
      generatedAt: payload.generatedAt,
    };
  },
};
