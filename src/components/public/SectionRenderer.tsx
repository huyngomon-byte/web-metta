import { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FacilitiesSection } from '@/components/public/FacilitiesSection';
import { EbookHeroBlock, EbookSkillsBlock, EbookWhyBlock } from '@/components/public/EbookLandingBlocks';
import { PublicLeadForm } from '@/components/public/PublicLeadForm';
import { usePublicThemeSettings } from '@/hooks/usePublicCms';
import { publicBlogService } from '@/services/publicBlogService';
import { siteSettings as seedSettings } from '@/data/seed';
import { PUBLIC_PROGRAMS } from '@/lib/constants';
import type { FacilityImage, ProgramCms } from '@/types/cms';
import type { PageSection } from '@/types/cms';

/* ── helpers ──────────────────────────────────────────────────────────────── */
function parseExtra<T = unknown[]>(json?: string, fallback: T = [] as unknown as T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

function sectionId(section: PageSection, fallback: string) {
  return section.anchorId || fallback;
}

/* ── Hero ─────────────────────────────────────────────────────────────────── */
function HeroBlock({ section }: { section: PageSection }) {
  type HeroSlide = { url: string };

  // Support both old format (HeroSlide[]) and new format ({ slides, interval })
  let imgList: string[] = [section.imageUrl || '/brand/workshop-kids.jpg'];
  let slideInterval = 4; // default 4s
  if (section.extraData) {
    try {
      const parsed = JSON.parse(section.extraData);
      if (Array.isArray(parsed)) {
        const urls = (parsed as HeroSlide[]).map((s) => s.url).filter(Boolean);
        if (urls.length > 0) imgList = urls;
      } else if (parsed.slides) {
        const urls = (parsed.slides as HeroSlide[]).map((s) => s.url).filter(Boolean);
        if (urls.length > 0) imgList = urls;
        if (parsed.interval) slideInterval = Number(parsed.interval);
      }
    } catch { /* keep defaults */ }
  }

  const [current, setCurrent] = useState(0);
  const [animate, setAnimate] = useState(true);

  // Seamless loop: append clone of first image; when reaching clone, snap back
  const loopList = imgList.length > 1 ? [...imgList, imgList[0]] : imgList;
  const total = loopList.length;

  // Auto-slide, always left-to-right
  useEffect(() => {
    if (imgList.length <= 1) return;
    const t = setInterval(() => {
      setCurrent((c) => c + 1);
    }, slideInterval * 1000);
    return () => clearInterval(t);
  }, [imgList.length, slideInterval]);

  // When we land on the clone (index === imgList.length), snap back to 0 instantly
  useEffect(() => {
    if (current === imgList.length) {
      const timer = setTimeout(() => {
        setAnimate(false);
        setCurrent(0);
        // Re-enable animation after the instant snap
        requestAnimationFrame(() => {
          requestAnimationFrame(() => setAnimate(true));
        });
      }, 850); // wait for slide transition to finish
      return () => clearTimeout(timer);
    }
  }, [current, imgList.length]);

  return (
    <section
      id={sectionId(section, 'about')}
      className="relative overflow-hidden"
      style={{ height: 'auto', minHeight: 'clamp(580px, 41.666vw, 800px)' }}
    >
      {/* ── Background image — sliding strip ── */}
      <div className="absolute inset-0">
        <div
          className="flex h-full"
          style={{
            width: `${total * 100}%`,
            transform: `translateX(-${current * (100 / total)}%)`,
            transition: animate ? 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          }}
        >
          {loopList.map((src, i) => (
            <img
              key={i}
              src={src}
              alt={`METTA Academy ${i + 1}`}
              className="h-full object-cover object-top flex-shrink-0"
              style={{ width: `${100 / total}%` }}
            />
          ))}
        </div>
        {/* Gradient overlay: dark left → light right (desktop), darker overall on mobile */}
        <div
          className="absolute inset-0 hidden md:block"
          style={{ background: 'linear-gradient(90deg, rgba(8,45,82,0.88) 0%, rgba(8,45,82,0.62) 45%, rgba(8,45,82,0.18) 100%)' }}
        />
        <div
          className="absolute inset-0 md:hidden"
          style={{ background: 'linear-gradient(180deg, rgba(8,45,82,0.82) 0%, rgba(8,45,82,0.72) 60%, rgba(8,45,82,0.55) 100%)' }}
        />
      </div>

      {/* ── Content ── */}
      <div className="relative z-10 flex items-center pt-28 pb-12 lg:pt-32 lg:pb-14">
        <div className="w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-page">

          {/* Glass card */}
          <div
            className="w-full max-w-[680px] p-7 sm:p-9 lg:p-10"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: '24px',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            {/* Badge */}
            <div className="inline-flex items-center gap-2.5 bg-cta-orange/15 border border-cta-orange/25 px-3.5 py-2 rounded-full mb-5">
              <span className="material-symbols-outlined text-cta-orange text-[16px]">school</span>
              <span className="font-inter font-bold text-[13px] tracking-[0.12em] text-cta-orange uppercase">
                Trung tâm Anh ngữ quốc tế
              </span>
            </div>

            {/* Heading */}
            <h1
              className="font-montserrat text-pure-white mb-4"
              style={{
                fontWeight: 800,
                fontSize: 'clamp(38px, 4.5vw, 58px)',
                lineHeight: 1.05,
                letterSpacing: '-0.5px',
              }}
            >
              {section.title ? (
                section.title.split('\n').map((line, i, arr) => (
                  <Fragment key={i}>{line}{i < arr.length - 1 && <br />}</Fragment>
                ))
              ) : (
                <>Learn with Mind.<br />Lead with Heart.</>
              )}
            </h1>

            {/* Sub-heading */}
            {section.subtitle && (
              <p className="font-montserrat font-bold text-[17px] lg:text-[20px] text-cta-orange mb-4 leading-snug">
                {section.subtitle}
              </p>
            )}

            {/* Description */}
            {section.description && (
              <p className="text-white/75 text-[15px] lg:text-base leading-[1.8] max-w-[540px] mb-5">
                {section.description.split('\n').map((line, i, arr) => (
                  <Fragment key={i}>{line}{i < arr.length - 1 && <br />}</Fragment>
                ))}
              </p>
            )}

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <a
                href={section.buttonLink || '#lead-form'}
                className="inline-flex items-center justify-center bg-cta-orange text-pure-white font-montserrat font-bold text-[14px] tracking-wide uppercase shadow-lg shadow-cta-orange/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-cta-orange/35 active:scale-[0.98] whitespace-nowrap"
                style={{ height: '56px', padding: '0 32px', borderRadius: '16px' }}
              >
                <span className="material-symbols-outlined text-[18px] mr-2">edit_note</span>
                {section.buttonText || 'Nhận tư vấn miễn phí'}
              </a>
              {section.button2Text && (
                <a
                  href={section.button2Link || '#programs'}
                  className="inline-flex items-center justify-center border-2 border-white/50 text-pure-white font-montserrat font-bold text-[14px] tracking-wide uppercase transition-all hover:-translate-y-0.5 hover:bg-white hover:text-navy-deep whitespace-nowrap"
                  style={{ height: '56px', padding: '0 32px', borderRadius: '16px' }}
                >
                  {section.button2Text}
                  <span className="material-symbols-outlined text-[16px] ml-2">arrow_forward</span>
                </a>
              )}
            </div>

            {/* Trust badges — 2x2 grid */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { icon: 'verified', text: 'Chuẩn Cambridge' },
                { icon: 'groups', text: 'Giáo viên bản ngữ (TESOL/CELTA)' },
                { icon: 'workspace_premium', text: 'Cam kết đầu ra' },
                { icon: 'favorite', text: 'Miễn phí test đầu vào' },
              ].map((chip) => (
                <span
                  key={chip.text}
                  className="inline-flex items-center gap-1.5 font-semibold text-white/85 bg-white/8 border border-white/15 backdrop-blur-sm"
                  style={{ fontSize: '13px', padding: '8px 14px', borderRadius: '999px' }}
                >
                  <span className="material-symbols-outlined text-accent-cyan text-[15px]">{chip.icon}</span>
                  {chip.text}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}

/* ── Stats ────────────────────────────────────────────────────────────────── */
function StatsBlock({ section }: { section: PageSection }) {
  const stats = parseExtra<{ number: string; label: string }[]>(section.extraData);
  return (
    <section id={sectionId(section, 'stats')} className="bg-pure-white py-12 border-b border-outline-variant/30">
      <div className="max-w-[1200px] mx-auto px-5 lg:px-page">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="text-center group">
              <div className="font-montserrat font-extrabold text-[40px] lg:text-[52px] leading-none text-cta-orange mb-2 group-hover:scale-105 transition-transform">
                {stat.number}
              </div>
              <div className="text-navy-deep font-semibold text-sm tracking-wide uppercase">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Courses ──────────────────────────────────────────────────────────────── */
function CoursesBlock({ section }: { section: PageSection }) {
  const { settings, loading } = usePublicThemeSettings();
  const fallbackPrograms: ProgramCms[] = PUBLIC_PROGRAMS.map((program) => ({
    ...program,
    images: 'images' in program ? [...program.images] : undefined,
    highlights: [...program.highlights],
    highlightCards: 'highlightCards' in program ? program.highlightCards.map((card) => ({ ...card })) : undefined,
    methodology: [...program.methodology],
    outcomes: [...program.outcomes],
    outcomeCards: 'outcomeCards' in program ? program.outcomeCards.map((card) => ({ ...card })) : undefined,
    roadmap: [...program.roadmap],
    roadmapCards: 'roadmapCards' in program ? program.roadmapCards.map((card) => ({ ...card })) : undefined,
    skills: 'skills' in program ? program.skills.map((skill) => ({ ...skill })) : undefined,
  }));
  const programs = (settings?.programs?.length ? settings.programs : fallbackPrograms)
    .filter((program) => program.visible !== false);
  const count = programs.length;

  // Grid responsive cân chỉnh theo số chương trình hiển thị
  const gridClass =
    count === 1 ? 'grid grid-cols-1 max-w-md mx-auto gap-8' :
    count === 2 ? 'grid grid-cols-1 md:grid-cols-2 max-w-4xl mx-auto gap-8' :
    count === 3 ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-w-[1200px] mx-auto gap-8' :
    count === 4 ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8' :
    // >= 5: dùng flex wrap để các hàng đều giữa
    'flex flex-wrap justify-center gap-8';

  // Card width khi count >= 5 (flex wrap) — đặt cố định để mỗi card cùng kích thước
  const cardClass = count >= 5
    ? 'group flex flex-col bg-pure-white border border-outline-variant/40 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 w-full sm:w-[320px] lg:w-[300px]'
    : 'group flex flex-col bg-pure-white border border-outline-variant/40 overflow-hidden hover:shadow-2xl hover:-translate-y-1 transition-all duration-300';

  return (
    <section id={sectionId(section, 'programs')} className="py-8 lg:py-section bg-pure-white">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-page">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8">
          <div>
            <span className="inline-block text-cta-orange font-bold text-sm tracking-widest uppercase mb-3">Chương trình học</span>
            <h2 className="font-montserrat font-extrabold text-[28px] lg:text-[40px] text-navy-deep leading-tight">
              {section.title}
            </h2>
            {section.subtitle && (
              <p className="mt-2 text-on-surface-variant text-base font-inter">{section.subtitle}</p>
            )}
          </div>
          {section.description && (
            <p className="text-on-surface-variant text-sm leading-7 max-w-md lg:text-right">{section.description}</p>
          )}
        </div>

        {/* Program cards */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="border border-outline-variant/40 bg-white">
                <div className="h-52 animate-pulse bg-slate-100" />
                <div className="space-y-3 p-6">
                  <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-5/6 animate-pulse rounded bg-slate-100" />
                  <div className="h-11 w-full animate-pulse rounded bg-slate-100" />
                </div>
              </div>
            ))}
          </div>
        ) : (
        <div className={gridClass}>
          {programs.map((program) => {
            const homeImage = program.homeImage || program.images?.find(Boolean) || program.image || '/brand/workshop-kids.jpg';
            const homeTitle = program.homeTitle || program.title;
            const homeAgeLabel = program.homeAgeLabel || program.ageRange;
            const homeDuration = program.homeDuration || program.duration;
            const homeEyebrow = program.homeEyebrow || program.eyebrow;
            const homeSummary = program.homeSummary || program.summary;
            const homeHighlights = (program.homeHighlights !== undefined ? program.homeHighlights : program.highlights)
              .filter((item) => item?.trim());

            return (
              <article key={program.slug}
                className={cardClass}>
                {/* Photo */}
                <div className="relative h-52 flex-shrink-0 overflow-hidden">
                  <img
                    src={homeImage}
                    alt={homeTitle}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/60 to-transparent" />
                  <div className="absolute top-4 left-4">
                    <span className="bg-cta-orange text-pure-white px-3 py-1 text-[11px] font-bold tracking-widest uppercase">
                      {homeAgeLabel}
                    </span>
                  </div>
                  <div className="absolute bottom-4 left-4">
                    <span className="text-pure-white font-montserrat font-bold text-lg">{homeTitle}</span>
                  </div>
                </div>

                {/* Body — flex-col + flex-1 để button luôn sát đáy */}
                <div className="flex flex-col flex-1 p-6">
                  <p className="text-xs font-bold tracking-widest uppercase text-accent-cyan mb-3">{homeEyebrow}</p>
                  <p className="text-on-surface-variant text-sm leading-6 mb-4">{homeSummary}</p>
                  <ul className="space-y-2 mb-6 flex-1">
                    {homeHighlights.slice(0, 3).map((h) => (
                      <li key={h} className="flex items-start gap-2 text-sm text-on-surface-variant">
                        <span className="material-symbols-outlined text-accent-cyan text-[16px] flex-shrink-0 mt-0.5">check_circle</span>
                        {h}
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between text-xs font-semibold text-on-surface-variant border-t border-outline-variant/30 pt-4 mb-5">
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">schedule</span>
                      {homeDuration}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px]">person</span>
                      {homeAgeLabel}
                    </span>
                  </div>
                  <Link to={`/programs/${program.slug}`}
                    className="block w-full text-center bg-navy-deep text-pure-white py-3 font-montserrat font-bold text-[13px] tracking-wider uppercase hover:bg-cta-orange transition-colors mt-auto">
                    Xem chi tiết chương trình
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
        )}
      </div>
    </section>
  );
}

/* ── Benefits ─────────────────────────────────────────────────────────────── */
function BenefitsBlock({ section }: { section: PageSection }) {
  type Benefit = { icon: string; color: string; title: string; desc: string };
  const items = parseExtra<Benefit[]>(section.extraData);
  const cardColors = ['#0EA5E9', '#F45A0A', '#16A34A', '#8B5CF6', '#EC4899', '#F59E0B'];

  function benefitColor(value: string | undefined, index: number) {
    if (value?.startsWith('#')) return value;
    if (value?.includes('cta-orange')) return '#F45A0A';
    if (value?.includes('accent-cyan')) return '#16A9D8';
    if (value?.includes('navy')) return '#003B7A';
    return cardColors[index % cardColors.length];
  }

  return (
    <section
      id={sectionId(section, 'method')}
      className="relative overflow-hidden py-12 lg:py-section"
      style={{ background: 'linear-gradient(135deg, #003B7A 0%, #0A4F8F 52%, #1267AE 100%)' }}
    >
      <div className="absolute top-0 right-0 h-[420px] w-[420px] rounded-full bg-[#16A9D8]/10 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-[320px] w-[320px] rounded-full bg-[#F45A0A]/8 blur-3xl" />

      <div className="relative z-10 max-w-[1440px] mx-auto px-5 lg:px-page">
        <div className="mx-auto mb-12 max-w-3xl text-center">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-xs font-bold uppercase tracking-widest text-accent-cyan backdrop-blur-sm">
            ✦ Điểm khác biệt
          </span>
          <h2 className="font-montserrat font-extrabold text-[30px] lg:text-[44px] text-pure-white leading-tight">
            {section.title}
          </h2>
          {section.subtitle && (
            <p className="mt-3 text-accent-cyan font-semibold text-base">{section.subtitle}</p>
          )}
          {section.description && (
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/72">{section.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item, i) => {
            const color = benefitColor(item.color, i);
            const hasDesc = Boolean(item.desc?.trim());
            return (
              <div
                key={i}
                className={`group relative min-h-[150px] overflow-hidden rounded-2xl p-6 text-white shadow-lg transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${hasDesc ? '' : 'flex items-center justify-center'}`}
                style={{ backgroundColor: color }}
              >
                <div className="absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/12" />
                <div className="absolute -bottom-4 -left-4 h-14 w-14 rounded-full bg-white/10" />
                <div className={`relative flex gap-4 ${hasDesc ? 'items-start' : 'items-center justify-center text-center'}`}>
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white/20">
                    <span className="material-symbols-outlined text-[26px] text-white">{item.icon || 'star'}</span>
                  </div>
                  <div>
                    <h4 className="font-montserrat text-[16px] font-extrabold leading-snug text-white">{item.title}</h4>
                    {hasDesc && <p className="mt-3 text-sm leading-6 text-white/82">{item.desc}</p>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── Testimonials ─────────────────────────────────────────────────────────── */
function TestimonialsBlock({ section }: { section: PageSection }) {
  type Testimonial = { name: string; role: string; quote: string; avatar: string };
  const items = parseExtra<Testimonial[]>(section.extraData);

  return (
    <section id={sectionId(section, 'testimonials')} className="py-8 lg:py-section bg-[#F5F9FC]">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-page">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="inline-block text-cta-orange font-bold text-sm tracking-widest uppercase mb-3">Đánh giá</span>
          <h2 className="font-montserrat font-extrabold text-[28px] lg:text-[40px] text-navy-deep leading-tight">
            {section.title}
          </h2>
          {section.subtitle && (
            <p className="mt-4 text-on-surface-variant text-base">{section.subtitle}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((item, i) => (
            <div key={i}
              className="bg-pure-white p-8 border-l-4 border-cta-orange shadow-sm hover:shadow-xl transition-shadow">
              {/* Stars */}
              <div className="flex gap-1 mb-5">
                {Array.from({ length: 5 }).map((_, s) => (
                  <span key={s} className="material-symbols-outlined text-cta-orange text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    star
                  </span>
                ))}
              </div>
              <blockquote className="text-on-surface-variant text-sm leading-7 italic mb-6">
                "{item.quote}"
              </blockquote>
              <div className="flex items-center gap-3">
                <img src={item.avatar} alt={item.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-cta-orange/20" />
                <div>
                  <div className="font-montserrat font-bold text-navy-deep text-sm">{item.name}</div>
                  <div className="text-on-surface-variant text-xs">{item.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Teachers ─────────────────────────────────────────────────────────────── */
function TeachersBlock({ section }: { section: PageSection }) {
  type Teacher = { name: string; role: string; exp: string; nationality: string; photo: string };
  const items = parseExtra<Teacher[]>(section.extraData);

  return (
    <section id={sectionId(section, 'teachers')} className="py-8 lg:py-section bg-pure-white">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-page">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <span className="inline-block text-cta-orange font-bold text-sm tracking-widest uppercase mb-3">Đội ngũ giảng dạy</span>
            <h2 className="font-montserrat font-extrabold text-[28px] lg:text-[40px] text-navy-deep leading-tight">
              {section.title}
            </h2>
            {section.subtitle && (
              <p className="mt-3 text-accent-cyan font-semibold text-base">{section.subtitle}</p>
            )}
          </div>
          {section.description && (
            <p className="text-on-surface-variant text-sm leading-7 max-w-md">{section.description}</p>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {items.map((teacher, i) => (
            <div key={i} className="group text-center">
              <div className="relative overflow-hidden mb-4">
                <img
                  src={teacher.photo}
                  alt={teacher.name}
                  className="w-full aspect-[3/4] object-cover object-top group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-navy-deep/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform">
                  <span className="text-pure-white font-bold text-xs tracking-wider">{teacher.exp}</span>
                </div>
              </div>
              <div className="px-2">
                <h4 className="font-montserrat font-bold text-navy-deep text-base mb-1">{teacher.name}</h4>
                <p className="text-accent-cyan text-sm font-semibold mb-1">{teacher.role}</p>
                <p className="text-on-surface-variant text-xs">{teacher.nationality} • {teacher.exp}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── News ─────────────────────────────────────────────────────────────────── */
const HOME_NEWS_LIMIT = 3;

function NewsBlock({ section }: { section: PageSection }) {
  type NewsItem = { title: string; date: string; category: string; image: string; excerpt: string; link?: string };
  const seedItems = parseExtra<NewsItem[]>(section.extraData);
  const [blogPosts, setBlogPosts] = useState<NewsItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    publicBlogService.getPublished().then((posts) => {
      if (posts.length > 0) {
        setBlogPosts(posts.slice(0, HOME_NEWS_LIMIT).map((p) => ({
          title: p.title,
          date: new Date(p.publishedAt).toLocaleDateString('vi-VN'),
          category: p.category,
          image: p.coverImage,
          excerpt: p.excerpt,
          link: `/tin-tuc/${p.slug}`,
        })));
      }
      setLoaded(true);
    });
  }, []);

  // Use real blog posts if available, otherwise fall back to seed
  const items = blogPosts.length > 0 ? blogPosts : (loaded ? [] : seedItems.slice(0, HOME_NEWS_LIMIT));

  return (
    <section id={sectionId(section, 'news')} className="py-8 lg:py-section bg-[#F5F9FC]">
      <div className="max-w-[1440px] mx-auto px-5 lg:px-page">
        <div className="flex justify-between items-end mb-8">
          <div>
            <span className="inline-block text-cta-orange font-bold text-sm tracking-widest uppercase mb-3">Cập nhật</span>
            <h2 className="font-montserrat font-extrabold text-[28px] lg:text-[40px] text-navy-deep leading-tight">
              {section.title}
            </h2>
            {section.subtitle && (
              <p className="mt-2 text-on-surface-variant text-base">{section.subtitle}</p>
            )}
          </div>
          <a href="/tin-tuc" className="hidden lg:inline-flex items-center gap-2 text-navy-deep font-bold text-sm hover:text-cta-orange transition-colors group">
            Xem tất cả
            <span className="material-symbols-outlined text-[18px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {items.map((item, i) => {
            const href = item.link || '#';
            const isExternal = href.startsWith('http');
            const CardWrapper = ({ children }: { children: React.ReactNode }) =>
              isExternal
                ? <a href={href} target="_blank" rel="noreferrer" className="group block bg-pure-white overflow-hidden hover:shadow-xl transition-shadow cursor-pointer">{children}</a>
                : <a href={href} className="group block bg-pure-white overflow-hidden hover:shadow-xl transition-shadow cursor-pointer">{children}</a>;
            return (
              <CardWrapper key={i}>
                <div className="relative h-48 overflow-hidden">
                  <img src={item.image} alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                  <div className="absolute top-4 left-4">
                    <span className="bg-cta-orange text-pure-white px-3 py-1 text-[11px] font-bold tracking-widest uppercase">
                      {item.category}
                    </span>
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-on-surface-variant text-xs mb-3 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                    {item.date}
                  </p>
                  <h3 className="font-montserrat font-bold text-navy-deep text-base leading-snug mb-3 group-hover:text-cta-orange transition-colors line-clamp-2">
                    {item.title}
                  </h3>
                  <p className="text-on-surface-variant text-sm leading-6 line-clamp-2 mb-4">{item.excerpt}</p>
                  <span className="inline-flex items-center gap-1.5 text-cta-orange font-bold text-sm group-hover:gap-3 transition-all">
                    Đọc thêm
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </span>
                </div>
              </CardWrapper>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ── CTA ──────────────────────────────────────────────────────────────────── */
function CTABlock({ section }: { section: PageSection }) {
  return (
    <section id={sectionId(section, 'cta')} className="py-8 lg:py-section bg-pure-white">
      <div className="max-w-[1200px] mx-auto px-5 lg:px-page">
        <div className="relative overflow-hidden rounded-sm bg-gradient-to-r from-primary to-primary-container p-12 lg:p-20 text-center">
          {/* Decorations */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-cta-orange/10 rounded-full translate-x-32 -translate-y-32" />
          <div className="absolute bottom-0 left-0 w-48 h-48 border-[16px] border-accent-cyan/10 rounded-full -translate-x-24 translate-y-24" />
          <div className="absolute top-1/2 left-1/4 w-24 h-24 bg-accent-cyan/5 rounded-full" />

          <div className="relative z-10">
            <span className="inline-block bg-cta-orange/20 text-cta-orange font-bold text-xs tracking-widest uppercase px-4 py-2 rounded-full mb-6">
              Bắt đầu hành trình
            </span>
            <h2 className="font-montserrat font-extrabold text-[26px] lg:text-[44px] text-pure-white leading-tight mb-6 max-w-3xl mx-auto">
              {section.title}
            </h2>
            {section.subtitle && (
              <p className="text-surface-variant text-base lg:text-lg leading-8 mb-10 max-w-2xl mx-auto">
                {section.subtitle}
              </p>
            )}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href={section.buttonLink || '#lead-form'}
                className="inline-flex items-center justify-center bg-cta-orange text-pure-white px-10 py-5 font-montserrat font-bold text-sm uppercase tracking-wide rounded shadow-2xl shadow-cta-orange/30 hover:scale-105 transition-transform">
                {section.buttonText || 'Đăng ký ngay'}
              </a>
              {section.button2Text && (
                <a href={section.button2Link || 'tel:19001234'}
                  className="inline-flex items-center justify-center border-2 border-pure-white/70 text-pure-white px-10 py-5 font-montserrat font-bold text-sm uppercase tracking-wide rounded hover:bg-pure-white hover:text-primary transition-all">
                  {section.button2Text}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Facilities (Cơ sở vật chất) ───────────────────────────────────────────── */
function FacilitiesBlock({ section }: { section: PageSection }) {
  const images = parseExtra<FacilityImage[]>(section.extraData);
  // Fallback ảnh mặc định nếu section chưa cấu hình ảnh
  const finalImages = images.length ? images : (seedSettings.facilities?.images ?? []);
  return (
    <FacilitiesSection
      eyebrow={section.subtitle || undefined}
      title={section.title || undefined}
      description={section.description ?? undefined}
      images={finalImages}
    />
  );
}

/* ── Fallback ─────────────────────────────────────────────────────────────── */
function FallbackBlock({ section }: { section: PageSection }) {
  return (
    <section id={sectionId(section, section.type.toLowerCase().replace(/\s+/g, '-'))} className="bg-pure-white py-10">
      <div className="max-w-[1200px] mx-auto px-5 lg:px-page">
        <h2 className="font-montserrat font-bold text-[28px] text-navy-deep mb-4">{section.title}</h2>
        {section.subtitle && <p className="text-accent-cyan font-semibold text-lg mb-3">{section.subtitle}</p>}
        {(section.description || section.content) && (
          <p className="text-on-surface-variant text-base leading-7">{section.description || section.content}</p>
        )}
      </div>
    </section>
  );
}

/* ── Router ───────────────────────────────────────────────────────────────── */
export function SectionRenderer({ section }: { section: PageSection }) {
  switch (section.type) {
    case 'Hero':         return <HeroBlock section={section} />;
    case 'Stats':        return <StatsBlock section={section} />;
    case 'Courses':      return <CoursesBlock section={section} />;
    case 'Facilities':   return <FacilitiesBlock section={section} />;
    case 'Benefits':     return <BenefitsBlock section={section} />;
    case 'Testimonials': return <TestimonialsBlock section={section} />;
    case 'Teachers':     return <TeachersBlock section={section} />;
    case 'News':         return <NewsBlock section={section} />;
    case 'CTA':          return <CTABlock section={section} />;
    case 'Lead Form':    return <PublicLeadForm formId={section.formId} title={section.title} />;
    case 'Ebook Hero':   return <EbookHeroBlock section={section} />;
    case 'Ebook Skills': return <EbookSkillsBlock section={section} />;
    case 'Ebook Why':    return <EbookWhyBlock section={section} />;
    default:             return <FallbackBlock section={section} />;
  }
}
