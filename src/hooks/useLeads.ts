import { useCallback, useEffect, useState } from 'react';
import { leadService } from '@/services/leadService';
import type { Lead } from '@/types/crm';

type UseLeadsOptions = {
  realtime?: boolean;
  pollMs?: number;
};

export function useLeads({ realtime = true, pollMs }: UseLeadsOptions = {}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const refresh = useCallback(() => leadService.getLeads().then(setLeads), []);

  useEffect(() => {
    if (realtime) {
      return leadService.subscribeLeads(setLeads, () => {
        void refresh();
      });
    }

    void refresh();
    if (!pollMs) return undefined;
    const timer = window.setInterval(() => void refresh(), pollMs);
    return () => window.clearInterval(timer);
  }, [pollMs, realtime, refresh]);

  return { leads, refresh, setLeads };
}
