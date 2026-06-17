import { ExternalLink, Mail, MapPin, Phone } from 'lucide-react';
import { PublicLeadForm } from '@/components/public/PublicLeadForm';
import { siteSettings as seedSettings } from '@/data/seed';
import { usePublicThemeSettings } from '@/hooks/usePublicCms';

const DEFAULT_MAP_URL = 'https://share.google/w0414JKEjY3GoBG0F';

function phoneHref(phone?: string) {
  const compact = phone?.replace(/[^\d+]/g, '');
  return compact ? `tel:${compact}` : undefined;
}

function isEmbeddableMapUrl(url?: string) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.hostname.includes('google') && parsed.pathname.includes('/maps/embed');
  } catch {
    return false;
  }
}

export default function PublicContactPage() {
  const { settings } = usePublicThemeSettings();
  const current = settings || seedSettings;
  const mapUrl = current.mapUrl || seedSettings.mapUrl || DEFAULT_MAP_URL;
  const embedUrl = isEmbeddableMapUrl(mapUrl) ? mapUrl : '';
  const contactItems = [
    { label: 'Hotline', value: current.hotline, href: phoneHref(current.hotline), icon: Phone },
    { label: 'Email', value: current.email, href: current.email ? `mailto:${current.email}` : undefined, icon: Mail },
    { label: 'Địa chỉ', value: current.address, href: mapUrl, icon: MapPin },
  ].filter((item) => item.value);

  return (
    <>
      <section className="bg-[#003B7A] py-20 text-white">
        <div className="mx-auto max-w-[1180px] px-4">
          <h1 className="text-5xl font-extrabold">Liên hệ METTA Academy</h1>
          <p className="mt-4 max-w-2xl text-white/70">Đội ngũ METTA sẵn sàng tư vấn lộ trình phù hợp cho học viên.</p>
        </div>
      </section>
      <section className="bg-white py-16">
        <div className="mx-auto grid max-w-[1180px] px-4 gap-6 md:grid-cols-3">
          {contactItems.map((item) => {
            const Icon = item.icon;
            const content = (
              <>
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#E8F6FF] text-[#1267AE]">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block text-xs font-bold uppercase tracking-wide text-slate-400">{item.label}</span>
                  <span className="mt-1 block text-base font-semibold text-slate-900">{item.value}</span>
                </span>
              </>
            );
            return item.href ? (
              <a
                key={item.label}
                href={item.href}
                target={item.href.startsWith('http') ? '_blank' : undefined}
                rel={item.href.startsWith('http') ? 'noreferrer' : undefined}
                className="flex min-h-[118px] items-center gap-4 rounded-xl border border-slate-200 p-6 shadow-sm transition hover:border-[#1267AE] hover:shadow-md"
              >
                {content}
              </a>
            ) : (
              <div key={item.label} className="flex min-h-[118px] items-center gap-4 rounded-xl border border-slate-200 p-6 shadow-sm">
                {content}
              </div>
            );
          })}
        </div>
      </section>
      <section className="bg-slate-50 py-16">
        <div className="mx-auto grid max-w-[1180px] gap-8 px-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl bg-[#003B7A] p-8 text-white shadow-sm">
            <p className="text-sm font-bold uppercase tracking-wide text-[#1EC8F5]">Google Maps</p>
            <h2 className="mt-3 text-3xl font-extrabold">Tìm đường đến METTA Academy</h2>
            <p className="mt-4 text-white/75">{current.address}</p>
            {mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#F45A0A] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#d94a00]"
              >
                Mở Google Maps
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>

          <div className="min-h-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {embedUrl ? (
              <iframe
                title="METTA Academy Google Maps"
                src={embedUrl}
                className="h-full min-h-[360px] w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            ) : (
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="flex h-full min-h-[360px] flex-col items-center justify-center gap-4 bg-slate-100 px-8 text-center transition hover:bg-slate-200"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-[#F45A0A] shadow-sm">
                  <MapPin className="h-8 w-8" />
                </span>
                <span className="max-w-md text-lg font-bold text-slate-900">{current.address}</span>
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#1267AE]">
                  Xem bản đồ trên Google Maps
                  <ExternalLink className="h-4 w-4" />
                </span>
              </a>
            )}
          </div>
        </div>
      </section>
      <PublicLeadForm formId="contact-form" title="Gửi thông tin liên hệ" />
    </>
  );
}
