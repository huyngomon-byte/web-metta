import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { SectionRenderer } from '@/components/public/SectionRenderer';
import { pages as seedPages, sections as seedSections } from '@/data/seed';
import { cmsService } from '@/services/cmsService';
import type { CmsPage, PageSection } from '@/types/cms';

export default function PublicCmsPage() {
  const { slug } = useParams();
  const [page, setPage] = useState<CmsPage | null | undefined>(undefined);
  const [sections, setSections] = useState<PageSection[]>([]);
  useEffect(() => {
    if (!slug) return;
    // Lấy page theo slug (kể cả draft để admin có thể preview)
    cmsService.getPages()
      .then((allPages) => {
        const found = allPages.find((item) => item.slug === slug) || null;
        const fallback = seedPages.find((item) => item.slug === slug);
        const pageToRender = found || fallback || null;
        setPage(pageToRender);
        if (pageToRender) {
          cmsService.getVisibleSections(pageToRender.id).then((items) => {
            setSections(items.length ? items : seedSections.filter((section) => section.pageId === pageToRender.id && section.visible).sort((a, b) => a.order - b.order));
          });
        }
      })
      .catch(() => {
        const fallback = seedPages.find((item) => item.slug === slug) || null;
        setPage(fallback);
        if (fallback) setSections(seedSections.filter((section) => section.pageId === fallback.id && section.visible).sort((a, b) => a.order - b.order));
      });
  }, [slug]);
  if (page === undefined) return <PublicPageSkeleton />;
  if (page === null) return <Navigate to="/" replace />;
  if (!sections.length) return <PublicPageSkeleton />;
  return (
    <>
      {sections.map((section) => <SectionRenderer key={section.id} section={section} />)}
    </>
  );
}

function PublicPageSkeleton() {
  return (
    <main className="min-h-screen bg-pure-white pt-20">
      <section className="mx-auto max-w-[1180px] px-5 py-20">
        <div className="mb-8 h-8 w-48 animate-pulse rounded-full bg-orange-100" />
        <div className="mb-4 h-12 w-3/4 animate-pulse rounded-lg bg-slate-100" />
        <div className="mb-4 h-12 w-1/2 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-5 w-2/3 animate-pulse rounded bg-slate-100" />
      </section>
    </main>
  );
}
