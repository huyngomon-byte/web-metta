import { Link, useLocation, useNavigate } from 'react-router-dom';
import { siteSettings as seedSettings } from '@/data/seed';
import { usePublicThemeSettings } from '@/hooks/usePublicCms';
import { BRAND_LOGOS } from '@/lib/constants';

const FOOTER_LABELS: Record<string, string> = {
  '/#about': 'Về chúng tôi',
  '#about': 'Về chúng tôi',
  '/#programs': 'Chương trình học',
  '#programs': 'Chương trình học',
  '/#method': 'Phương pháp',
  '#method': 'Phương pháp',
  '/tin-tuc': 'Tin tức',
  '/chinh-sach-bao-mat': 'Chính sách bảo mật',
  '/dieu-khoan-su-dung': 'Điều khoản sử dụng',
};

function isHashHref(href: string) {
  return href.startsWith('#') || href.startsWith('/#');
}

function hashId(href: string) {
  return href.replace(/^\/?#/, '');
}

function isInternalRoute(href: string) {
  return href.startsWith('/') && !href.startsWith('//');
}

export function PublicFooter() {
  const { settings } = usePublicThemeSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const current = settings || seedSettings;
  const footerColumns = current.footerColumns?.length ? current.footerColumns : seedSettings.footerColumns || [];
  const socials = current.socials || {};

  function scrollToHash(href: string) {
    const id = hashId(href);
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', `${window.location.pathname}#${id}`);
      return;
    }
    if (location.pathname !== '/') navigate('/');
    let attempts = 0;
    const poll = setInterval(() => {
      const target = document.getElementById(id);
      attempts++;
      if (target) {
        clearInterval(poll);
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.history.replaceState(null, '', `/#${id}`);
      } else if (attempts > 30) {
        clearInterval(poll);
      }
    }, 100);
  }

  return (
    <footer data-public-shell="footer" className="w-full bg-primary border-t-4 border-cta-orange pt-16 pb-8">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-page">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 text-pure-white">
          <div className="md:col-span-4 space-y-5">
            <div className="flex items-center gap-3">
              <img
                src={BRAND_LOGOS.onBlue}
                alt="METTA Academy"
                className="h-[58px] w-auto max-w-[230px] object-contain sm:h-16"
              />
            </div>
            <p className="text-surface-variant text-sm leading-7 whitespace-pre-line">
              {current.footerText || 'Learn with Mind. Lead with Heart.'}
            </p>
            <div className="flex gap-3">
              {socials.facebook && <SocialLink href={socials.facebook} label="Facebook" icon="facebook" />}
              {socials.youtube && <SocialLink href={socials.youtube} label="YouTube" icon="youtube" />}
              {socials.tiktok && <SocialLink href={socials.tiktok} label="TikTok" icon="tiktok" />}
            </div>
          </div>

          {footerColumns.map((column, columnIndex) => (
            <div key={`${column.title}-${columnIndex}`} className="md:col-span-2 space-y-5">
              <h5 className="font-montserrat font-bold text-base border-l-4 border-cta-orange pl-4">
                {columnIndex === 0 ? 'Khám phá' : columnIndex === 1 ? 'Thông tin' : column.title}
              </h5>
              <ul className="space-y-3 text-sm">
                {column.links.map((link) => {
                  const href = link.href || '#';
                  const cls = 'text-surface-variant hover:text-cta-orange transition-colors';
                  const label = FOOTER_LABELS[href] || link.label;
                  // Hash link (#about, /#about) → scroll behavior, navigate to home if needed
                  if (isHashHref(href)) {
                    return (
                      <li key={`${column.title}-${label}-${href}`}>
                        <a
                          href={`/#${hashId(href)}`}
                          className={cls}
                          onClick={(e) => { e.preventDefault(); scrollToHash(href); }}
                        >
                          {label}
                        </a>
                      </li>
                    );
                  }
                  // Internal route (/tin-tuc, /phap-ly/...) → SPA Link
                  if (isInternalRoute(href)) {
                    return (
                      <li key={`${column.title}-${label}-${href}`}>
                        <Link to={href} className={cls}>{label}</Link>
                      </li>
                    );
                  }
                  // External (https://, mailto:, tel:) → normal anchor
                  return (
                    <li key={`${column.title}-${label}-${href}`}>
                      <a href={href} target="_blank" rel="noreferrer" className={cls}>{label}</a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className="md:col-span-4 space-y-5">
            <h5 className="font-montserrat font-bold text-base border-l-4 border-cta-orange pl-4">Liên hệ</h5>
            <div className="space-y-3 text-sm text-surface-variant">
              <FooterContact icon="location_on" text={current.address} href={current.mapUrl} />
              <FooterContact icon="call" text={current.hotline} />
              <FooterContact icon="mail" text={current.email} />
            </div>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-pure-white/10 flex justify-center text-center text-sm text-surface-variant">
          <p>© 2026 {current.brandName || 'METTA Academy'}. {current.footerText || 'Learn with Mind. Lead with Heart.'}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterContact({ icon, text, href }: { icon: string; text?: string; href?: string }) {
  if (!text) return null;
  const content = (
    <>
      <span className="material-symbols-outlined text-accent-cyan text-[20px] flex-shrink-0">{icon}</span>
      <p>{text}</p>
    </>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="flex gap-3 items-start hover:text-cta-orange transition-colors">
        {content}
      </a>
    );
  }
  return (
    <div className="flex gap-3 items-start">
      {content}
    </div>
  );
}

function SocialLink({ href, label, icon }: { href: string; label: string; icon: 'facebook' | 'youtube' | 'tiktok' }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" aria-label={label}
      className="w-10 h-10 rounded-full border border-pure-white/20 flex items-center justify-center hover:bg-cta-orange transition-colors">
      <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
        {icon === 'facebook' && <path d="M12 2.04c-5.5 0-10 4.49-10 10.02 0 5 3.66 9.15 8.44 9.9v-7h-2.54v-2.9h2.54v-2.2c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.23.19 2.23.19v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.77l-.44 2.9h-2.33v7c4.78-.75 8.44-4.9 8.44-9.9 0-5.53-4.5-10.02-10-10.02z" />}
        {icon === 'youtube' && <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 4-8 4z" />}
        {icon === 'tiktok' && <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.27 8.27 0 004.84 1.55V6.78a4.85 4.85 0 01-1.07-.09z" />}
      </svg>
    </a>
  );
}
