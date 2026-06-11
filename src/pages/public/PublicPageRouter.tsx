import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import PublicLayout from '@/pages/public/PublicLayout';
import PublicCmsPage from '@/pages/public/PublicCmsPage';
import PublicEbookLanding from '@/pages/public/PublicEbookLanding';
import { pages as seedPages, sections as seedSections } from '@/data/seed';
import { cmsService } from '@/services/cmsService';
import type { PageSection } from '@/types/cms';

function hasEbookHero(items: PageSection[]) {
  return items.some((section) => section.type === 'Ebook Hero');
}

export default function PublicPageRouter() {
  const { slug } = useParams();
  const [isEbookLanding, setIsEbookLanding] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let active = true;
    if (!slug) {
      setIsEbookLanding(false);
      return () => { active = false; };
    }

    setIsEbookLanding(undefined);
    cmsService.getPages()
      .then(async (pages) => {
        const page = pages.find((item) => item.slug === slug) || seedPages.find((item) => item.slug === slug);
        if (!page) return false;
        const sections = await cmsService.getVisibleSections(page.id);
        const fallback = seedSections.filter((section) => section.pageId === page.id && section.visible);
        return hasEbookHero(sections.length ? sections : fallback);
      })
      .then((value) => {
        if (active) setIsEbookLanding(Boolean(value));
      })
      .catch(() => {
        if (active) setIsEbookLanding(false);
      });

    return () => { active = false; };
  }, [slug]);

  if (isEbookLanding === undefined) {
    return <div className="grid min-h-screen place-items-center text-slate-400">Dang tai...</div>;
  }

  if (isEbookLanding) return <PublicEbookLanding />;

  return (
    <PublicLayout>
      <PublicCmsPage />
    </PublicLayout>
  );
}
