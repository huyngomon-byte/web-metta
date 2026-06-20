import { useEffect, useMemo, useState } from 'react';
import { COURSE_OPTIONS } from '@/lib/constants';
import { publicCmsService } from '@/services/publicCmsService';
import type { SiteSettings } from '@/types/cms';

export function usePublicThemeSettings() {
  const [settings, setSettings] = useState<SiteSettings | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    publicCmsService.getSettings()
      .then((nextSettings) => {
        if (mounted) setSettings(nextSettings);
      })
      .catch(() => {
        if (mounted) setSettings(publicCmsService.getSettingsSync());
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return { settings, setSettings: undefined, loading };
}

export function usePublicCourseOptions(): string[] {
  const { settings, loading } = usePublicThemeSettings();
  return useMemo(() => {
    if (loading && !settings) return [];
    const fromCms = settings?.programs
      ?.filter((program) => program.visible !== false)
      ?.map((program) => program.title?.trim())
      .filter((title): title is string => Boolean(title));
    return fromCms?.length ? fromCms : [...COURSE_OPTIONS];
  }, [loading, settings]);
}
