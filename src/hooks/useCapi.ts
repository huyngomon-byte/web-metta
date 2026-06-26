import { useCallback, useEffect, useState } from 'react';
import { capiService } from '@/services/capiService';
import type { CapiEventLog, CapiRuntimeConfig } from '@/types/capi';

export function useCapi() {
  const [runtimeConfig, setRuntimeConfig] = useState<CapiRuntimeConfig | null>(null);
  const [events, setEvents] = useState<CapiEventLog[]>([]);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      const [config, nextEvents] = await Promise.all([
        capiService.getRuntimeConfig(),
        capiService.getEvents(),
      ]);
      setRuntimeConfig(config);
      setEvents(nextEvents);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Không tải được cấu hình CAPI.');
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  return { runtimeConfig, events, error, refresh };
}
