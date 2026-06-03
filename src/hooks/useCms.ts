import { useCallback, useEffect, useMemo, useState } from 'react';
import { cmsService } from '@/services/cmsService';
import { COURSE_OPTIONS } from '@/lib/constants';
import type { CmsPage, PageSection, SiteSettings } from '@/types/cms';

export function usePages() {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const refresh = useCallback(() => cmsService.getPages().then(setPages).catch(() => setPages([])), []);
  useEffect(() => { refresh(); }, [refresh]);
  return { pages, refresh };
}

export function usePageSections(pageId?: string) {
  const [sections, setSections] = useState<PageSection[]>([]);
  const refresh = useCallback(
    () => pageId ? cmsService.getSections(pageId).then(setSections).catch(() => setSections([])) : undefined,
    [pageId],
  );
  useEffect(() => { refresh(); }, [refresh]);
  return { sections, refresh };
}

export function useThemeSettings() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    cmsService.getSettings()
      .then((value) => {
        if (active) setSettings(value);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return { settings, setSettings, loading };
}

/** Lấy danh sách tên khóa học động — ưu tiên từ CMS programs, fallback về COURSE_OPTIONS hardcoded. */
export function useCourseOptions(): string[] {
  const { settings } = useThemeSettings();
  return useMemo(() => {
    const fromCms = settings?.programs
      ?.map((p) => p.title?.trim())
      .filter((t): t is string => Boolean(t));
    if (fromCms && fromCms.length > 0) return fromCms;
    return [...COURSE_OPTIONS];
  }, [settings]);
}
