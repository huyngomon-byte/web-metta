import { BRAND } from '@/lib/constants';

export function BrandLogo({ compact = false, light = false }: { compact?: boolean; light?: boolean }) {
  return (
    <div className="flex items-center">
      <div className={light ? 'rounded-lg bg-white px-3 py-1.5 shadow-sm' : ''}>
        <img src={BRAND.logo} alt="METTA Academy" className={`${compact ? 'h-12' : 'h-16'} w-auto object-contain`} />
      </div>
    </div>
  );
}
