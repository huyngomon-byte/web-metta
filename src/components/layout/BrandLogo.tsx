import { BRAND_LOGOS } from '@/lib/constants';

export function BrandLogo({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  const logoSrc = light ? BRAND_LOGOS.onBlue : BRAND_LOGOS.onWhite;
  return (
    <div className="flex items-center">
      <img src={logoSrc} alt="METTA Academy" className={`${compact ? 'h-10' : 'h-14'} w-auto max-w-[220px] object-contain`} />
    </div>
  );
}
