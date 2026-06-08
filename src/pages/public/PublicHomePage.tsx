import { useEffect, useMemo, useState } from 'react';
import { SectionRenderer } from '@/components/public/SectionRenderer';
import { sections as seedSections } from '@/data/seed';
import { cmsService } from '@/services/cmsService';
import type { PageSection } from '@/types/cms';

export default function PublicHomePage() {
  const fallbackSections = useMemo(
    () => seedSections.filter((section) => section.pageId === 'page-home' && section.visible).sort((a, b) => a.order - b.order),
    [],
  );
  const [sections, setSections] = useState<PageSection[] | null>(null);

  useEffect(() => {
    cmsService.getVisibleSections('page-home').then((items) => {
      setSections(items.length ? items : fallbackSections);
    }).catch(() => setSections(fallbackSections));
  }, [fallbackSections]);

  if (!sections) return <PublicHomeSkeleton />;

  return (
    <>
      {sections.map((section) => (
        <SectionRenderer key={section.id} section={section} />
      ))}
    </>
  );
}

function PublicHomeSkeleton() {
  return (
    <main className="min-h-screen bg-pure-white pt-20">
      <section className="mx-auto grid min-h-[78vh] max-w-[1440px] grid-cols-1 items-center gap-10 px-5 py-14 lg:grid-cols-[55fr_45fr] lg:px-page lg:py-20">
        <div className="space-y-6">
          <div className="h-8 w-56 animate-pulse rounded-full bg-orange-100" />
          <div className="space-y-3">
            <div className="h-12 w-full max-w-xl animate-pulse rounded-lg bg-slate-100" />
            <div className="h-12 w-4/5 max-w-lg animate-pulse rounded-lg bg-slate-100" />
            <div className="h-12 w-3/5 max-w-md animate-pulse rounded-lg bg-slate-100" />
          </div>
          <div className="h-5 w-full max-w-lg animate-pulse rounded bg-slate-100" />
          <div className="h-5 w-4/5 max-w-md animate-pulse rounded bg-slate-100" />
          <div className="flex gap-3">
            <div className="h-12 w-52 animate-pulse rounded-full bg-orange-100" />
            <div className="h-12 w-52 animate-pulse rounded-full bg-slate-100" />
          </div>
        </div>
        <div className="aspect-[4/5] w-full max-w-[520px] animate-pulse justify-self-center rounded-2xl bg-slate-100 shadow-xl" />
      </section>
    </main>
  );
}
