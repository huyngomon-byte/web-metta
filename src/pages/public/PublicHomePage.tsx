import { useEffect, useMemo, useState } from 'react';
import { SectionRenderer } from '@/components/public/SectionRenderer';
import { publicCmsService } from '@/services/publicCmsService';
import type { PageSection } from '@/types/cms';

export default function PublicHomePage() {
  const fallbackSections = useMemo(
    () => publicCmsService.getSeedVisibleSections('page-home'),
    [],
  );
  const [sections, setSections] = useState<PageSection[]>(fallbackSections);

  useEffect(() => {
    publicCmsService.getVisibleSections('page-home').then((items) => {
      setSections(items.length ? items : fallbackSections);
    }).catch(() => setSections(fallbackSections));
  }, [fallbackSections]);

  return (
    <>
      {sections.map((section) => (
        <SectionRenderer key={section.id} section={section} />
      ))}
    </>
  );
}
