import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PublicLayout from '@/pages/public/PublicLayout';
import PublicCmsPage from '@/pages/public/PublicCmsPage';
import PublicEbookLanding from '@/pages/public/PublicEbookLanding';
import PublicNotFoundPage from '@/pages/public/PublicNotFoundPage';
import { pages as seedPages, sections as seedSections } from '@/data/seed';
import { publicCmsService } from '@/services/publicCmsService';
import type { PageSection } from '@/types/cms';

function hasEbookHero(items: PageSection[]) {
  return items.some((section) => section.type === 'Ebook Hero');
}

export default function PublicPageRouter() {
  const { slug } = useParams();
  const [routeKind, setRouteKind] = useState<'loading' | 'ebook' | 'cms' | 'not-found'>('loading');

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
        return hasEbookHero(sections.length ? sections : fallback) ? 'ebook' as const : 'cms' as const;
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
