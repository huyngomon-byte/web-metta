import { useCallback, useEffect, useState } from 'react';
import { leadService } from '@/services/leadService';
import type { Lead } from '@/types/crm';

type UseLeadsOptions = {
  realtime?: boolean;
  pollMs?: number;
  pageSize?: number;
  mode?: 'paged' | 'all';
};

function mergeLeads(incoming: Lead[], existing: Lead[]) {
  const byId = new Map<string, Lead>();
  existing.forEach((lead) => byId.set(lead.id, lead));
  incoming.forEach((lead) => byId.set(lead.id, lead));
  return Array.from(byId.values()).sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
}

export function useLeads({ realtime = true, pollMs, pageSize = 300, mode = realtime ? 'paged' : 'all' }: UseLeadsOptions = {}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [nextCursor, setNextCursor] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const refresh = useCallback(async () => {
    if (mode === 'paged') {
      const page = await leadService.getLeadsPage({ pageSize });
      setLeads(page.leads);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
      return;
    }
    const items = await leadService.getLeads();
    setLeads(items);
    setNextCursor('');
    setHasMore(false);
    return;
  }, [mode, pageSize]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await leadService.getLeadsPage({ pageSize, cursorUpdatedAt: nextCursor });
      setLeads(page.leads);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, nextCursor, pageSize]);

  useEffect(() => {
    void refresh();
    if (realtime) {
      return leadService.subscribeLeads((items) => {
        setLeads((current) => mergeLeads(items, current));
      }, () => {
        void refresh();
      });
    }

    if (!pollMs) return undefined;
    const timer = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(timer);
  }, [pollMs, realtime, refresh]);

  return { leads, refresh, setLeads, loadMore, hasMore, loadingMore };
}
