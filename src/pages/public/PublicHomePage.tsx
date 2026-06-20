import { useEffect, useState } from 'react';
import { SectionRenderer } from '@/components/public/SectionRenderer';
import { publicCmsService } from '@/services/publicCmsService';
import type { PageSection } from '@/types/cms';

export default function PublicHomePage() {
  const [sections, setSections] = useState<PageSection[] | null>(null);

  useEffect(() => {
    let active = true;
    publicCmsService.getVisibleSections('page-home').then((items) => {
      if (!active) return;
      setSections(items.length ? items : publicCmsService.getSeedVisibleSections('page-home'));
    }).catch(() => {
      if (active) setSections(publicCmsService.getSeedVisibleSections('page-home'));
    });
    return () => {
      active = false;
    };
  }, []);

  if (sections === null) return <HomePageSkeleton />;

  return (
    <>
      {sections.map((section) => (
        <SectionRenderer key={section.id} section={section} />
      ))}
    </>
  );
}

function HomePageSkeleton() {
  return (
    <main className="min-h-screen bg-pure-white pt-[72px]">
      <section className="bg-[#F5F9FC] py-16 lg:py-24">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div className="space-y-5">
            <div className="h-5 w-40 animate-pulse rounded-full bg-slate-200" />
            <div className="h-12 w-11/12 animate-pulse rounded-xl bg-slate-200 lg:h-16" />
            <div className="h-12 w-8/12 animate-pulse rounded-xl bg-slate-200 lg:h-16" />
            <div className="space-y-3 pt-2">
              <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-10/12 animate-pulse rounded bg-slate-200" />
            </div>
            <div className="flex gap-3 pt-4">
              <div className="h-12 w-40 animate-pulse rounded-lg bg-slate-200" />
              <div className="h-12 w-36 animate-pulse rounded-lg bg-slate-200" />
            </div>
          </div>
          <div className="aspect-[16/9] w-full animate-pulse rounded-2xl bg-slate-200" />
        </div>
      </section>
    </main>
  );
}
