import { useMemo } from 'react';
import { COURSE_OPTIONS } from '@/lib/constants';
import { publicCmsService } from '@/services/publicCmsService';

export function usePublicThemeSettings() {
  const settings = useMemo(() => publicCmsService.getSettingsSync(), []);
  return { settings, setSettings: undefined, loading: false };
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
