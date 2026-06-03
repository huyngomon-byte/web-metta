import { useEffect, useState } from 'react';
import { capiService } from '@/services/capiService';
import type { CapiEventLog, CapiMapping, CapiSettings } from '@/types/capi';

export function useCapi() {
  const [settings, setSettings] = useState<CapiSettings | null>(null);
  const [mappings, setMappings] = useState<CapiMapping[]>([]);
  const [events, setEvents] = useState<CapiEventLog[]>([]);
  const refresh = () => {
    capiService.getSettings().then(setSettings);
    capiService.getMappings().then(setMappings);
    capiService.getEvents().then(setEvents);
  };
  useEffect(() => { refresh(); }, []);
  return { settings, setSettings, mappings, events, refresh };
}
