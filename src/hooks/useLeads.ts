import { useCallback, useEffect, useState } from 'react';
import { describeFriendlyDataError } from '@/lib/friendlyErrors';
import { leadService } from '@/services/leadService';
import type { LeadPageCursor } from '@/services/leadService';
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
  const [nextCursor, setNextCursor] = useState<LeadPageCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setError('');
    try {
      if (mode === 'paged') {
        const page = await leadService.getLeadsPage({ pageSize });
        setLeads(page.leads);
        setNextCursor(page.nextCursor);
        setHasMore(page.hasMore);
        return;
      }
      const items = await leadService.getLeads();
      setLeads(items);
      setNextCursor(null);
      setHasMore(false);
      return;
    } catch (err) {
      console.warn('[useLeads] Cannot load leads:', err);
      setError(describeFriendlyDataError(err, 'dữ liệu lead'));
      setLeads([]);
      setNextCursor(null);
      setHasMore(false);
    }
  }, [mode, pageSize]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const page = await leadService.getLeadsPage({ pageSize, cursor: nextCursor });
      setLeads(page.leads);
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (err) {
      console.warn('[useLeads] Cannot load more leads:', err);
      setError(describeFriendlyDataError(err, 'dữ liệu lead'));
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadingMore, nextCursor, pageSize]);

  useEffect(() => {
    void refresh();
    if (realtime) {
      return leadService.subscribeLeads((items, meta) => {
        setLeads((current) => {
          const removedIds = new Set(meta?.removedIds || []);
          const currentWithoutRemoved = removedIds.size ? current.filter((lead) => !removedIds.has(lead.id)) : current;
          return meta?.replace ? items : mergeLeads(items, currentWithoutRemoved);
        });
      }, () => {
        void refresh();
      });
    }

    if (!pollMs) return undefined;
    const timer = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(timer);
  }, [pollMs, realtime, refresh]);

  return { leads, refresh, setLeads, loadMore, hasMore, loadingMore, error };
}
