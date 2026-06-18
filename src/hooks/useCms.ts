import { useCallback, useEffect, useMemo, useState } from 'react';
import { cmsService } from '@/services/cmsService';
import { COURSE_OPTIONS, DEFAULT_COURSE_DEAL_SIZE } from '@/lib/constants';
import type { CourseDealSizeRule } from '@/lib/leadFinance';
import type { CmsPage, PageSection, ProgramCms, SiteSettings } from '@/types/cms';

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

function courseDealSizeFromProgram(program: ProgramCms) {
  const parsed = Number(program.dealSize);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_COURSE_DEAL_SIZE;
}

function courseCatalogFromSettings(settings: SiteSettings | null) {
  const programs = settings?.programs?.filter((program) => program.visible !== false) || [];
  const courseOptions = programs
    .map((program) => program.title?.trim())
    .filter((title): title is string => Boolean(title));

  const courseDealSizes: CourseDealSizeRule[] = programs
    .map((program) => ({
      courseName: program.title?.trim() || program.courseName?.trim() || program.slug,
      dealSize: courseDealSizeFromProgram(program),
      aliases: [program.courseName, program.slug].map((item) => item?.trim()).filter((item): item is string => Boolean(item)),
    }))
    .filter((item) => Boolean(item.courseName));

  if (courseOptions.length > 0) return { courseOptions, courseDealSizes };

  return {
    courseOptions: [...COURSE_OPTIONS],
    courseDealSizes: COURSE_OPTIONS.map((courseName) => ({
      courseName,
      dealSize: DEFAULT_COURSE_DEAL_SIZE,
    })),
  };
}

/** Lấy tên khóa và deal size động — ưu tiên từ CMS programs, fallback về constants. */
export function useCourseCatalog() {
  const { settings } = useThemeSettings();
  return useMemo(() => courseCatalogFromSettings(settings), [settings]);
}

/** Lấy danh sách tên khóa học động — ưu tiên từ CMS programs, fallback về COURSE_OPTIONS hardcoded. */
export function useCourseOptions(): string[] {
  return useCourseCatalog().courseOptions;
}
