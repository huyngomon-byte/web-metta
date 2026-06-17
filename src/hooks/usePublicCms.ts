import { useEffect, useMemo, useState } from 'react';
import { COURSE_OPTIONS } from '@/lib/constants';
import { publicCmsService } from '@/services/publicCmsService';

export function usePublicThemeSettings() {
  const fallbackSettings = useMemo(() => publicCmsService.getSettingsSync(), []);
  const [settings, setSettings] = useState(fallbackSettings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    publicCmsService.getSettings()
      .then((nextSettings) => {
        if (mounted) setSettings(nextSettings || fallbackSettings);
      })
      .catch(() => {
        if (mounted) setSettings(fallbackSettings);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [fallbackSettings]);

  return { settings, setSettings: undefined, loading };
}

export function usePublicCourseOptions(): string[] {
  const { settings } = usePublicThemeSettings();
  return useMemo(() => {
    const fromCms = settings.programs
      ?.map((program) => program.title?.trim())
      .filter((title): title is string => Boolean(title));
    return fromCms?.length ? fromCms : [...COURSE_OPTIONS];
  }, [settings]);
}
