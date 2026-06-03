import { useEffect, useState } from 'react';
import { leadService } from '@/services/leadService';
import type { Lead } from '@/types/crm';

export function useLeads() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const refresh = () => leadService.getLeads().then(setLeads);
  useEffect(() => { refresh(); }, []);
  return { leads, refresh, setLeads };
}
