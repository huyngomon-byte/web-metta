import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PublicLayout from '@/pages/public/PublicLayout';
import PublicCmsPage from '@/pages/public/PublicCmsPage';
import PublicEbookLanding from '@/pages/public/PublicEbookLanding';
import MettaPlusLanding from '@/pages/public/MettaPlusLanding';
import PublicNotFoundPage from '@/pages/public/PublicNotFoundPage';
import { pages as seedPages, sections as seedSections } from '@/data/seed';
import { publicCmsService } from '@/services/publicCmsService';
import type { PageSection } from '@/types/cms';

const METTA_PLUS_SECTION_TYPES = new Set([
  'Metta+ Hero',
  'Metta+ Benefits',
  'Metta+ Age Clubs',
  'Metta+ Pass',
  'Metta+ Journey',
  'Metta+ Weekly Plan',
  'Metta+ Reasons',
  'Metta+ Form',
]);

function hasEbookHero(items: PageSection[]) {
  return items.some((section) => section.type === 'Ebook Hero');
}

function hasMettaPlusLanding(items: PageSection[]) {
  return items.some((section) => METTA_PLUS_SECTION_TYPES.has(section.type));
}

export default function PublicPageRouter() {
  const { slug } = useParams();
  const [routeKind, setRouteKind] = useState<'loading' | 'ebook' | 'metta-plus' | 'cms' | 'not-found'>('loading');

  useEffect(() => {
    let active = true;
    if (!slug) {
      setRouteKind('not-found');
      return () => { active = false; };
    }

    setRouteKind('loading');
    publicCmsService.getPages()
      .then(async (pages) => {
        const page = pages.find((item) => item.slug === slug) || seedPages.find((item) => item.slug === slug);
        if (!page) return 'not-found' as const;
        const sections = await publicCmsService.getVisibleSections(page.id);
        const fallback = seedSections.filter((section) => section.pageId === page.id && section.visible);
        const resolvedSections = sections.length ? sections : fallback;
        if (hasEbookHero(resolvedSections)) return 'ebook' as const;
        if (hasMettaPlusLanding(resolvedSections)) return 'metta-plus' as const;
        return 'cms' as const;
      })
      .then((value) => {
        if (active) setRouteKind(value);
      })
      .catch(() => {
        if (active) setRouteKind('not-found');
      });

    return () => { active = false; };
  }, [slug]);

  if (routeKind === 'loading') {
    return <div className="grid min-h-screen place-items-center text-slate-400">Đang tải...</div>;
  }

  if (routeKind === 'ebook') return <PublicEbookLanding />;
  if (routeKind === 'metta-plus') return <MettaPlusLanding />;
  if (routeKind === 'not-found') {
    return (
      <PublicLayout>
        <PublicNotFoundPage />
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <PublicCmsPage />
    </PublicLayout>
  );
}
