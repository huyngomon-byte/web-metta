import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { siteSettings as seedSettings } from '@/data/seed';
import { useThemeSettings } from '@/hooks/useCms';
import { BRAND_LOGOS } from '@/lib/constants';

type NavLink = {
  label: string;
  href: string;
  children?: Array<{ label: string; href: string }>;
};

const HEADER_LABELS: Record<string, string> = {
  '/#about': 'Giới thiệu',
  '#about': 'Giới thiệu',
  '/#programs': 'Chương trình học',
  '#programs': 'Chương trình học',
  '/#teachers': 'Đội ngũ giáo viên',
  '#teachers': 'Đội ngũ giáo viên',
  '/tin-tuc': 'Tin tức',
  '/#lead-form': 'Liên hệ',
  '#lead-form': 'Liên hệ',
  '/#contact': 'Liên hệ',
  '#contact': 'Liên hệ',
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

function NavAnchor({
  href,
  className,
  onClick,
  onHashNavigate,
  children,
}: {
  href: string;
  className: string;
  onClick?: () => void;
  onHashNavigate: (href: string) => void;
  children: ReactNode;
}) {
  if (isHashHref(href)) {
    const id = hashId(href);
    return (
      <a
        href={`/#${id}`}
        className={className}
        onClick={(event) => {
          event.preventDefault();
          onHashNavigate(href);
          onClick?.();
        }}
      >
        {children}
      </a>
    );
  }

  if (isInternalRoute(href)) {
    return <Link to={href} className={className} onClick={onClick}>{children}</Link>;
  }

  return <a href={href} className={className} onClick={onClick}>{children}</a>;
}

export function PublicHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const { settings } = useThemeSettings();
  const current = settings || seedSettings;
  const rawLinks = (current.headerLinks?.length ? current.headerLinks : seedSettings.headerLinks || []) as NavLink[];
  // Auto-sync links
  const navLinks = rawLinks.map((link) => {
    const normalizedLink = { ...link, label: HEADER_LABELS[link.href] || link.label };
    // Sync "Chương trình học" children from programs
    if (normalizedLink.children?.length && current.programs?.length) {
      const lowerLabel = normalizedLink.label.toLowerCase();
      const isPrograms = normalizedLink.href === '/#programs' || lowerLabel.includes('chương trình') || lowerLabel.includes('chuong trinh');
      if (isPrograms) {
        return {
          ...normalizedLink,
          children: current.programs.filter((p) => p.visible !== false).map((p) => ({
            label: p.title,
            href: `/programs/${p.slug}`,
          })),
        };
      }
    }
    // Force "Tin tức" to use /tin-tuc route (not hash)
    if (normalizedLink.label.toLowerCase().includes('tin tức') || normalizedLink.label.toLowerCase().includes('tin tuc')) {
      return { ...normalizedLink, href: '/tin-tuc' };
    }
    return normalizedLink;
  });
  const ctaText = settings?.headerCtaText || 'Đăng ký tư vấn';
  const ctaLink = current.headerCtaLink || seedSettings.headerCtaLink || '#lead-form';

  const ctaClass = 'hidden lg:inline-flex items-center justify-center bg-cta-orange text-pure-white px-6 py-3 font-inter font-bold text-sm rounded-lg hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-cta-orange/20';
  const linkBase = 'font-inter font-semibold text-[14px] tracking-wide transition-colors text-navy-deep hover:text-cta-orange';

  function scrollToHash(href: string) {
    const id = hashId(href);

    // If the element already exists on the current page, scroll to it in-place
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.history.replaceState(null, '', `${window.location.pathname}#${id}`);
      return;
    }

    // Navigate to home and wait for element to appear before scrolling
    if (location.pathname !== '/') {
      navigate('/');
    }

    // Poll until element is rendered (max 3s)
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
    <header data-public-shell="header" className="fixed top-0 w-full z-[100] h-[72px] bg-pure-white/95 backdrop-blur-md border-b border-navy-deep/10 shadow-sm">
      <nav className="flex justify-between items-center w-full px-5 lg:px-page max-w-[1440px] mx-auto h-full">
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
          <img
            src={BRAND_LOGOS.onWhite}
            alt="METTA Academy"
            className="h-[46px] w-auto object-contain sm:h-[50px]"
          />
        </Link>

        <div className="hidden lg:flex items-center gap-5">
          {navLinks.map((link, index) => {
            const cls = `${linkBase} ${index === 0 ? 'text-cta-orange border-b-2 border-cta-orange pb-0.5' : ''}`;

            if (link.children?.length) {
              return (
                <div
                  key={`${link.label}-${index}`}
                  className="relative"
                  onMouseEnter={() => {
                    if (closeTimer.current) clearTimeout(closeTimer.current);
                    setOpenDropdown(link.label);
                  }}
                  onMouseLeave={() => {
                    closeTimer.current = setTimeout(() => setOpenDropdown(null), 150);
                  }}
                >
                  <button className={`${cls} flex items-center gap-1 cursor-pointer`}>
                    {link.label}
                    <ChevronDown size={14} className={`mt-px transition-transform duration-200 ${openDropdown === link.label ? 'rotate-180' : ''}`} />
                  </button>

                  <div className="absolute top-full left-0 right-0 h-3" />
                  <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 py-2 min-w-[200px] z-50 transition-all duration-150 origin-top ${openDropdown === link.label ? 'opacity-100 scale-100 pointer-events-auto' : 'opacity-0 scale-95 pointer-events-none'}`}>
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l border-t border-slate-100 rotate-45" />
                    {link.children.map((child, childIndex) => (
                      <NavAnchor
                        key={`${child.href}-${childIndex}`}
                        href={child.href}
                        className="block px-5 py-2.5 text-sm font-semibold text-navy-deep hover:bg-orange-50 hover:text-cta-orange transition-colors"
                        onHashNavigate={scrollToHash}
                      >
                        {child.label}
                      </NavAnchor>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <NavAnchor key={`${link.href}-${index}`} href={link.href} className={cls} onHashNavigate={scrollToHash}>
                {link.label}
              </NavAnchor>
            );
          })}
        </div>

        <NavAnchor href={ctaLink} className={ctaClass} onHashNavigate={scrollToHash}>
          {ctaText}
        </NavAnchor>

        <button className="lg:hidden p-2" onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">
          <span className="material-symbols-outlined text-navy-deep text-[28px]">{menuOpen ? 'close' : 'menu'}</span>
        </button>
      </nav>

      {menuOpen && (
        <div className="lg:hidden bg-pure-white border-t border-navy-deep/10 px-5 py-4 flex flex-col gap-1 shadow-lg">
          {navLinks.map((link, index) => {
            if (link.children?.length) {
              const expanded = mobileExpanded === link.label;
              return (
                <div key={`${link.label}-${index}`}>
                  <button
                    className="w-full flex items-center justify-between font-inter font-semibold text-sm text-navy-deep hover:text-cta-orange py-2.5 transition-colors"
                    onClick={() => setMobileExpanded(expanded ? null : link.label)}
                  >
                    {link.label}
                    <ChevronDown size={14} className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
                  </button>
                  {expanded && (
                    <div className="ml-4 flex flex-col border-l-2 border-orange-200 pl-3 mb-1">
                      {link.children.map((child, childIndex) => (
                        <NavAnchor
                          key={`${child.href}-${childIndex}`}
                          href={child.href}
                          className="font-inter text-sm text-navy-deep/80 hover:text-cta-orange py-2 transition-colors"
                          onClick={() => setMenuOpen(false)}
                          onHashNavigate={scrollToHash}
                        >
                          {child.label}
                        </NavAnchor>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavAnchor
                key={`${link.href}-${index}`}
                href={link.href}
                className="font-inter font-semibold text-sm text-navy-deep hover:text-cta-orange py-2.5 block transition-colors"
                onClick={() => setMenuOpen(false)}
                onHashNavigate={scrollToHash}
              >
                {link.label}
              </NavAnchor>
            );
          })}

          <NavAnchor
            href={ctaLink}
            className="mt-2 text-center bg-cta-orange text-pure-white px-6 py-3 font-bold text-sm rounded-lg block"
            onClick={() => setMenuOpen(false)}
            onHashNavigate={scrollToHash}
          >
            {ctaText}
          </NavAnchor>
        </div>
      )}
    </header>
  );
}
