import { useCallback, useEffect, useRef, useState } from 'react';
import { describeFriendlyDataError } from '@/lib/friendlyErrors';
import { leadService } from '@/services/leadService';
import type { LeadPageCursor } from '@/services/leadService';
import type { Lead } from '@/types/crm';

type UseLeadsOptions = {
  realtime?: boolean;
  pollMs?: number;
  pageSize?: number;
  mode?: 'paged' | 'numbered' | 'all';
  sinceDays?: number;
  dateFrom?: string;
  dateTo?: string;
  assignedTo?: string;
  status?: string;
  source?: string;
  centerName?: string;
  course?: string;
};

function mergeLeads(incoming: Lead[], existing: Lead[]) {
  const byId = new Map<string, Lead>();
  existing.forEach((lead) => byId.set(lead.id, lead));
  incoming.forEach((lead) => byId.set(lead.id, lead));
  return Array.from(byId.values()).sort((a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
}

export function useLeads({
  realtime = true,
  pollMs,
  pageSize = 100,
  mode = 'paged',
  sinceDays = 30,
  dateFrom,
  dateTo,
  assignedTo,
  status,
  source,
  centerName,
  course,
}: UseLeadsOptions = {}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [nextCursor, setNextCursor] = useState<LeadPageCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingPage, setLoadingPage] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeads, setTotalLeads] = useState(0);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [error, setError] = useState('');
  const currentPageRef = useRef(1);
  const totalPagesRef = useRef(1);
  const numberedPageCacheRef = useRef(new Map<number, Lead[]>());
  const numberedCursorCacheRef = useRef(new Map<number, string>());

  const loadNumberedPage = useCallback(async (targetPage: number, force = false) => {
    const safeTarget = Math.max(1, Math.round(targetPage || 1));
    const cached = numberedPageCacheRef.current.get(safeTarget);
    if (cached && !force) {
      currentPageRef.current = safeTarget;
      setPage(safeTarget);
      setLeads(leadService.useCachedLeadsPage(cached));
      setHasMore(safeTarget < totalPagesRef.current);
      return;
    }

    setLoadingPage(true);
    setError('');
    try {
      const result = await leadService.getNumberedLeadsPage({
        page: safeTarget,
        pageSize,
        afterDocId: numberedCursorCacheRef.current.get(safeTarget),
        sinceDays,
        dateFrom,
        dateTo,
        assignedTo,
        status,
        source,
        centerName,
        course,
      });
      currentPageRef.current = result.page;
      totalPagesRef.current = result.totalPages;
      setPage(result.page);
      setTotalPages(result.totalPages);
      setTotalLeads(result.total);
      setStatusCounts(result.statusCounts || {});
      setHasMore(result.hasNext);
      setLeads(result.leads);
      const cache = numberedPageCacheRef.current;
      cache.delete(result.page);
      cache.set(result.page, result.leads);
      if (result.nextPageCursor?.id) {
        numberedCursorCacheRef.current.set(result.page + 1, result.nextPageCursor.id);
      }
      while (cache.size > 5) {
        const oldestPage = cache.keys().next().value as number | undefined;
        if (oldestPage === undefined) break;
        cache.delete(oldestPage);
      }
    } catch (err) {
      console.warn('[useLeads] Cannot load numbered lead page:', err);
      setError(describeFriendlyDataError(err, 'trang dữ liệu lead'));
    } finally {
      setLoadingPage(false);
    }
  }, [assignedTo, centerName, course, dateFrom, dateTo, pageSize, sinceDays, source, status]);

  const refresh = useCallback(async () => {
    setError('');
    try {
      if (mode === 'numbered') {
        await loadNumberedPage(currentPageRef.current, true);
        return;
      }
      if (mode === 'paged') {
        const page = await leadService.getLeadsPage({ pageSize, sinceDays, dateFrom, dateTo, assignedTo, status, source, centerName, course });
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
  }, [assignedTo, centerName, course, dateFrom, dateTo, loadNumberedPage, mode, pageSize, sinceDays, source, status]);

  const goToPage = useCallback(async (targetPage: number, force = false) => {
    if (mode !== 'numbered' || loadingPage) return;
    const safeTarget = Math.max(1, Math.min(Math.max(1, totalPages), Math.round(targetPage || 1)));
    await loadNumberedPage(safeTarget, force);
  }, [loadNumberedPage, loadingPage, mode, totalPages]);

  const loadMore = useCallback(async () => {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const page = await leadService.getLeadsPage({ pageSize, cursor: nextCursor, sinceDays, dateFrom, dateTo, assignedTo, status, source, centerName, course });
      setLeads((current) => mergeLeads(page.leads, current));
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch (err) {
      console.warn('[useLeads] Cannot load more leads:', err);
      setError(describeFriendlyDataError(err, 'dữ liệu lead'));
    } finally {
      setLoadingMore(false);
    }
  }, [assignedTo, centerName, course, dateFrom, dateTo, hasMore, loadingMore, nextCursor, pageSize, sinceDays, source, status]);

  useEffect(() => {
    if (mode === 'numbered') {
      numberedPageCacheRef.current.clear();
      numberedCursorCacheRef.current.clear();
      currentPageRef.current = 1;
      totalPagesRef.current = 1;
      setPage(1);
      setTotalPages(1);
      setTotalLeads(0);
      setStatusCounts({});
      void loadNumberedPage(1, true);
      if (!pollMs) return undefined;
      const timer = window.setInterval(() => void loadNumberedPage(currentPageRef.current, true), pollMs);
      return () => window.clearInterval(timer);
    }

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

    void refresh();
    if (!pollMs) return undefined;
    const timer = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(timer);
  }, [loadNumberedPage, mode, pollMs, realtime, refresh]);

  return {
    leads,
    refresh,
    setLeads,
    loadMore,
    hasMore,
    loadingMore,
    error,
    page,
    totalPages,
    totalLeads,
    statusCounts,
    goToPage,
    loadingPage,
    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,
  };
}
