import { ArrowLeft, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Clock, GraduationCap, Sparkles, Users, Music, BookOpen, Eye, Brain, Globe, Zap, Mic, MessageCircle, Star, Cpu, FlaskConical, Trophy, Target, Lightbulb, Hand, X, type LucideIcon } from 'lucide-react';
import { useEffect, useState, useRef, useCallback } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { PublicLeadForm } from '@/components/public/PublicLeadForm';
import { DEFAULT_DEAL_CURRENCY, PUBLIC_PROGRAMS, SUMMER_DEFAULTS, WON_LEAD_STATUS, leadStatuses, resolveCourseDealSizeForProgram } from '@/lib/constants';
import { usePublicThemeSettings } from '@/hooks/usePublicCms';
import { publicLeadService } from '@/services/publicLeadService';
import { formatCurrency } from '@/lib/utils';
import type { ProgramCms, ProgramTemplate, SummerGalleryImage, SummerModule, SummerSectionKey } from '@/types/cms';

function programTemplateOf(program: Pick<ProgramCms, 'programTemplate' | 'slug'>): ProgramTemplate {
  return program.programTemplate || (program.slug === 'metta-summer-2026' ? 'skills' : 'course');
}

export default function PublicProgramDetailPage() {
  const { slug } = useParams();
  const { settings, loading } = usePublicThemeSettings();
  const normalizedSlug = slug === 'metta-young-learners'
    ? 'metta-young-learner'
    : slug === 'phonics'
      ? 'metta-on-phonics'
      : slug;

  function scrollToLeadForm() {
    const form = document.getElementById('lead-form');
    if (!form) return;
    window.history.replaceState(null, '', `${window.location.pathname}#lead-form`);
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (loading) return <ProgramDetailSkeleton />;

  // Try CMS first, fall back to hardcoded PUBLIC_PROGRAMS
  const hasCmsPrograms = Boolean(settings?.programs?.length);
  const cmsProgram = settings?.programs?.find((p) => p.slug === normalizedSlug && p.visible !== false);
  const staticProgram = hasCmsPrograms ? undefined : PUBLIC_PROGRAMS.find((item) => item.slug === normalizedSlug);

  // Normalise: if using static program, cast it to ProgramCms shape
  const program: ProgramCms | undefined = cmsProgram ?? (staticProgram
    ? {
        slug: staticProgram.slug,
        programTemplate: staticProgram.programTemplate,
        title: staticProgram.title,
        eyebrow: staticProgram.eyebrow,
        ageRange: staticProgram.ageRange,
        duration: staticProgram.duration,
        courseName: staticProgram.courseName,
        image: staticProgram.image,
        summary: staticProgram.summary,
        description: staticProgram.description,
        highlights: [...staticProgram.highlights],
        methodology: [...staticProgram.methodology],
        outcomes: [...staticProgram.outcomes],
        roadmap: [...staticProgram.roadmap],
      }
    : undefined);

  if (!program) return <Navigate to="/" replace />;

  if (programTemplateOf(program) === 'skills') {
    return <SummerProgramPage program={program} onCtaClick={scrollToLeadForm} />;
  }

  return (
    <>
      <ProgramHero program={program} onCtaClick={scrollToLeadForm} />

      {/* ── Infographic: Highlights + Outcomes ── */}
      <section className="relative py-14 overflow-hidden" style={{ background: 'linear-gradient(135deg, #003B7A 0%, #0A4F8F 50%, #1267AE 100%)' }}>
        <div className="absolute top-0 right-0 w-[400px] h-[400px] rounded-full bg-[#16A9D8]/8 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] rounded-full bg-[#F45A0A]/6 blur-3xl" />

        <div className="relative mx-auto max-w-[1180px] px-4">
          {/* Header */}
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm text-[#16A9D8] px-5 py-2 rounded-full text-xs font-bold uppercase tracking-widest mb-5">
              ✦ {program.highlightsEyebrow || 'Điểm nổi bật'}
            </span>
            <h2 className="text-2xl md:text-4xl font-extrabold text-white leading-tight whitespace-pre-line">
              {program.highlightsTitle || 'Học qua trải nghiệm,\nphát triển năng lực thật'}
            </h2>
            {(program.highlightsSubtitle || program.highlightsSubtitle === undefined) && (
              <p className="mt-3 text-white/60 text-sm">{program.highlightsSubtitle || 'Phương pháp hiện đại – Trẻ hứng thú – Tiến bộ mỗi ngày'}</p>
            )}
          </div>

          {/* Highlights - icon cards */}
          {(() => {
            const HCOLORS = ['#0EA5E9', '#F45A0A', '#8B5CF6', '#16A34A', '#EC4899', '#F59E0B'];
            const entries = program.highlightCards?.length
              ? program.highlightCards.map((c) => ({ Icon: iconFromName(c.icon), title: c.title, sub: c.description, color: c.color }))
              : program.highlights.map((text, i) => ({ ...parseHighlight(text, i), color: HCOLORS[i % HCOLORS.length] }));
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                {entries.map(({ Icon, title, sub, color }, i) => (
                  <div
                    key={i}
                    className="group rounded-2xl p-5 text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl relative overflow-hidden flex flex-col justify-center gap-2 min-h-[100px]"
                    style={{ backgroundColor: color }}
                  >
                    <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/10" />
                    <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full bg-white/10" />
                    {/* Icon + Title nằm ngang, căn giữa */}
                    <div className="flex items-center gap-3 relative">
                      <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                        <Icon size={22} className="text-white" />
                      </div>
                      <p className="text-[16px] font-extrabold leading-snug">{title}</p>
                    </div>
                    {sub && <p className="text-[12px] text-white/80 leading-snug relative">{sub}</p>}
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Divider */}
          <div className="flex items-center gap-4 mb-10">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            <span className="text-[11px] font-bold uppercase tracking-widest text-[#F45A0A]">✦ {program.outcomesEyebrow || 'Kết quả đầu ra'}</span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
          </div>

          {/* Outcomes - icon cards */}
          {(() => {
            const OCOLORS = ['#0EA5E9', '#F45A0A', '#16A34A', '#8B5CF6'];
            const entries = program.outcomeCards?.length
              ? program.outcomeCards.map((c) => ({ Icon: iconFromName(c.icon), title: c.title, sub: c.description, color: c.color }))
              : program.outcomes.map((text, i) => ({ ...parseOutcome(text, i), color: OCOLORS[i % OCOLORS.length] }));
            return (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {entries.map(({ Icon, title, sub, color }, i) => (
                  <div
                    key={i}
                    className="group rounded-2xl p-5 text-white transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl relative overflow-hidden flex flex-col justify-center gap-2 min-h-[100px]"
                    style={{ backgroundColor: color }}
                  >
                    <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-white/10" />
                    <div className="absolute -bottom-3 -left-3 w-10 h-10 rounded-full bg-white/10" />
                    {/* Icon + Title nằm ngang, căn giữa */}
                    <div className="flex items-center gap-3 relative">
                      <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                        <Icon size={22} className="text-white" />
                      </div>
                      <p className="text-[16px] font-extrabold leading-snug">{title}</p>
                    </div>
                    {sub && <p className="text-[12px] text-white/80 leading-snug relative">{sub}</p>}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      </section>

      <section id="roadmap" className="bg-[#F7F9FC] py-12">
        <div className="mx-auto max-w-[1180px] px-4">
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#F45A0A]">Lộ trình học</p>
          <h2 className="mt-3 text-3xl font-extrabold text-slate-950">Hành trình của học viên</h2>

          {(() => {
            const cards = program.roadmapCards?.length
              ? program.roadmapCards
              : program.roadmap.map((item, i) => ({
                  label: `Level ${i + 1}`,
                  title: '',
                  description: item,
                  color: ['#0EA5E9', '#1E3A5F', '#F97316', '#16A34A'][i % 4],
                }));
            const total = cards.length;
            return (
              <>
                {/* Desktop: staircase */}
                <div className="mt-10 hidden md:flex items-end justify-center" style={{ gap: total <= 3 ? 16 : total <= 5 ? 12 : 8 }}>
                  {cards.map((card, i) => {
                    // Scale height step based on count so it looks balanced
                    const step = total <= 3 ? 36 : total <= 5 ? 24 : 18;
                    const minH = total <= 3 ? 160 : total <= 5 ? 140 : 120;
                    const h = minH + i * step;
                    // Max width adapts: fewer cards = wider
                    const maxW = Math.min(280, Math.floor(1000 / total));
                    return (
                      <div
                        key={i}
                        className="group flex-1 rounded-2xl p-5 flex flex-col items-center justify-center text-center shadow-lg hover:shadow-xl transition-all hover:-translate-y-1 relative overflow-hidden"
                        style={{ height: h, maxWidth: maxW, backgroundColor: card.color || '#003B7A' }}
                      >
                        <div className="absolute -top-6 -right-6 w-16 h-16 rounded-full bg-white/10" />
                        <div className="absolute -bottom-4 -left-4 w-12 h-12 rounded-full bg-white/5" />

                        <span className="text-[11px] font-bold uppercase tracking-widest text-white/70 mb-1.5">{card.label}</span>
                        {card.title && <h3 className="text-sm font-extrabold text-white leading-snug mb-1.5">{card.title}</h3>}
                        <p className="text-xs leading-5 text-white/90">{card.description}</p>
                      </div>
                  );
                })}
                </div>

                {/* Mobile: vertical timeline */}
                <div className="mt-10 md:hidden relative pl-10">
                  {/* Vertical line */}
                  <div className="absolute left-[15px] top-2 bottom-2 w-[3px] rounded-full bg-gradient-to-b from-[#0EA5E9] via-[#F97316] to-[#16A34A]" />

                  <div className="flex flex-col gap-4">
                    {cards.map((card, i) => (
                      <div key={i} className="relative">
                        {/* Dot on line */}
                        <div
                          className="absolute -left-10 top-5 w-[30px] h-[30px] rounded-full flex items-center justify-center text-[11px] font-extrabold text-white border-[3px] border-white shadow-md z-10"
                          style={{ backgroundColor: card.color || '#003B7A' }}
                        >
                          {i + 1}
                        </div>

                        {/* Card */}
                        <div
                          className="rounded-xl p-4 shadow-md relative overflow-hidden"
                          style={{ backgroundColor: card.color || '#003B7A' }}
                        >
                          <div className="absolute -top-4 -right-4 w-14 h-14 rounded-full bg-white/10" />
                          <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">{card.label}</span>
                          {card.title && <h3 className="text-sm font-extrabold text-white leading-snug mt-1">{card.title}</h3>}
                          <p className="text-[13px] leading-5 text-white/90 mt-1">{card.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </section>

      {/* Skills - The Metta 5 */}
      <SkillsFlower skills={program.skills} />

      <PublicLeadForm
        formId={`${program.slug}-form`}
        title={`Nhận tư vấn chương trình ${program.title}`}
        interestedCourse={leadCourseFromProgram(program)}
        dealSize={resolveCourseDealSizeForProgram(program)}
        dealCurrency={program.dealCurrency || DEFAULT_DEAL_CURRENCY}
      />
    </>
  );
}


function summerClassInfoFromProgram(program: ProgramCms) {
  const price = `${formatCurrency(resolveCourseDealSizeForProgram(program), program.dealCurrency || DEFAULT_DEAL_CURRENCY)} / trọn khóa`;
  const rows = program.summerClassInfo?.length ? program.summerClassInfo : SUMMER_DEFAULTS.classInfo;
  return rows.map((row) => {
    if (row.label === 'Tên chương trình') return { ...row, value: program.title || row.value };
    if (row.label === 'Độ tuổi') return { ...row, value: program.ageRange || row.value };
    if (row.label === 'Thời lượng') return { ...row, value: program.duration || row.value };
    if (row.label === 'Học phí') return { ...row, value: price };
    return row;
  });
}

function leadCourseFromProgram(program: ProgramCms) {
  switch (program.slug) {
    case 'metta-kiddies':
      return 'METTA Kiddies';
    case 'metta-on-phonics':
      return 'METTA on Phonics';
    case 'metta-young-learner':
      return 'METTA Young Learner';
    case 'ielts-junior':
      return 'IELTS Junior';
    case 'metta-summer-2026':
      return 'METTA Summer 2026';
    default:
      return program.title || program.courseName || '';
  }
}

function summerModuleImage(module: { image?: string }, index: number) {
  return module.image || SUMMER_DEFAULTS.modules[index % SUMMER_DEFAULTS.modules.length]?.image || SUMMER_DEFAULTS.showcaseImage;
}

function summerModuleTag(module: { tag?: string; title?: string }) {
  return module.tag || module.title || 'METTA Summer';
}

function isSummerStatDescriptor(text: string) {
  const value = text.toLowerCase();
  return value.includes('độ tuổi')
    || value.includes('tuổi học')
    || value.includes('thời lượng')
    || value.includes('nhóm')
    || value.includes('khoá')
    || value.includes('khóa');
}

function summerStatDisplay(stat: SummerStat) {
  const value = stat.value.trim();
  const label = stat.label.trim();
  if (isSummerStatDescriptor(value) && label) return { label: value, value: label };
  return { label: label || value, value };
}

function summerStatIcon(stat: SummerStat): LucideIcon {
  const display = summerStatDisplay(stat);
  const text = `${display.label} ${display.value}`.toLowerCase();
  if (text.includes('tuổi') || text.includes('tuoi') || text.includes('age')) return Users;
  if (text.includes('thời lượng') || text.includes('thoi luong') || text.includes('tuần') || text.includes('buổi')) return Clock;
  if (text.includes('nhóm') || text.includes('khoá') || text.includes('khóa') || text.includes('mầm non') || text.includes('preschool')) return GraduationCap;
  return Sparkles;
}

function summerGalleryImageSrc(image: SummerGalleryImage) {
  return image.src || SUMMER_DEFAULTS.showcaseImage;
}

const SUMMER_QR_IMAGE = '/brand/metta-summer-2026-qr.jpg';

function normalizeSummerPhone(phone: string) {
  return phone.replace(/[\s.\-()]/g, '').replace(/^\+84/, '0');
}

function isValidSummerPhone(phone: string) {
  return /^0(3|5|7|8|9|1[2689])\d{8}$/.test(phone);
}

const heroStatCardClass = 'flex min-h-[112px] min-w-0 flex-col rounded-2xl border border-white/65 bg-white/5 px-4 py-3.5 shadow-sm backdrop-blur';
const heroStatLabelClass = 'mb-2 flex min-w-0 items-center gap-1.5 text-[#16A9D8]';
const heroStatLabelTextClass = 'truncate text-[10px] font-bold uppercase tracking-wider text-white/60';
const heroStatValueClass = 'min-w-0 break-words text-[13.5px] font-extrabold leading-snug text-white sm:text-sm';

function SummerProgramPage({ program, onCtaClick }: { program: ProgramCms; onCtaClick: () => void }) {
  const [showPlan, setShowPlan] = useState(false);
  const [heroSlideIndex, setHeroSlideIndex] = useState(0);
  const [showcaseSlideIndex, setShowcaseSlideIndex] = useState(0);
  const [registrationOpen, setRegistrationOpen] = useState(false);

  // Nội dung lấy từ CMS, fallback về SUMMER_DEFAULTS nếu chưa nhập
  const subtitle = program.summerSubtitle || SUMMER_DEFAULTS.subtitle;
  const chips = program.summerChips?.length ? program.summerChips : SUMMER_DEFAULTS.chips;
  const heroStats = program.summerHeroStats?.length ? program.summerHeroStats : SUMMER_DEFAULTS.heroStats;
  const heroImage = program.image || program.images?.[0] || SUMMER_DEFAULTS.showcaseImage;
  const overviewEyebrow = program.summerOverviewEyebrow || SUMMER_DEFAULTS.overviewEyebrow;
  const overviewTitle = program.summerOverviewTitle || SUMMER_DEFAULTS.overviewTitle;
  const overviewBody = program.summerOverviewBody || SUMMER_DEFAULTS.overviewBody;
  const audienceTitle = program.summerAudienceTitle || SUMMER_DEFAULTS.audienceTitle;
  const audience = program.summerAudience?.length ? program.summerAudience : SUMMER_DEFAULTS.audience;
  const modulesEyebrow = program.summerModulesEyebrow || SUMMER_DEFAULTS.modulesEyebrow;
  const modulesTitle = program.summerModulesTitle || SUMMER_DEFAULTS.modulesTitle;
  const modules = program.summerModules?.length ? program.summerModules : SUMMER_DEFAULTS.modules;
  const roadmapEyebrow = program.summerRoadmapEyebrow || SUMMER_DEFAULTS.roadmapEyebrow;
  const roadmapTitle = program.summerRoadmapTitle || SUMMER_DEFAULTS.roadmapTitle;
  const stages = program.summerStages?.length ? program.summerStages : SUMMER_DEFAULTS.stages;
  const weeklyColumns = program.summerWeeklyColumns?.length ? program.summerWeeklyColumns : SUMMER_DEFAULTS.weeklyColumns;
  const weeklyPlan = program.summerWeeklyPlan?.length ? program.summerWeeklyPlan : SUMMER_DEFAULTS.weeklyPlan;
  const outcomesTitle = program.summerOutcomesTitle || SUMMER_DEFAULTS.outcomesTitle;
  const outcomes = program.summerOutcomesList?.length ? program.summerOutcomesList : SUMMER_DEFAULTS.outcomes;
  const showcaseEyebrow = program.summerShowcaseEyebrow || SUMMER_DEFAULTS.showcaseEyebrow;
  const showcaseTitle = program.summerShowcaseTitle || SUMMER_DEFAULTS.showcaseTitle;
  const showcaseBody = program.summerShowcaseBody || SUMMER_DEFAULTS.showcaseBody;
  const showcaseImage = program.summerShowcaseImage || SUMMER_DEFAULTS.showcaseImage;
  const showcaseImages = program.summerShowcaseImages?.length
    ? program.summerShowcaseImages
    : (program.summerShowcaseImage
      ? [{ src: program.summerShowcaseImage, title: showcaseTitle, alt: showcaseTitle }]
      : SUMMER_DEFAULTS.showcaseImages);
  const showcaseItems = program.summerShowcaseItems?.length ? program.summerShowcaseItems : SUMMER_DEFAULTS.showcaseItems;
  const classInfoTitle = program.summerClassInfoTitle || SUMMER_DEFAULTS.classInfoTitle;
  const classInfoBody = program.summerClassInfoBody || SUMMER_DEFAULTS.classInfoBody;
  const classInfo = summerClassInfoFromProgram(program);
  const galleryTitle = program.summerGalleryTitle || SUMMER_DEFAULTS.galleryTitle;
  const gallery = program.summerGallery?.length ? program.summerGallery : SUMMER_DEFAULTS.gallery;
  const ctaTitle = program.summerCtaTitle || SUMMER_DEFAULTS.ctaTitle;
  const ctaBody = program.summerCtaBody || SUMMER_DEFAULTS.ctaBody;
  const sectionVisibility = { ...SUMMER_DEFAULTS.sectionVisibility, ...program.summerSectionVisibility };
  const showSection = (section: SummerSectionKey) => sectionVisibility[section] !== false;
  const heroSlides: SummerModule[] = modules.length ? modules : [{
    icon: 'Sparkles',
    color: '#F45A0A',
    title: program.title,
    description: program.description,
    image: heroImage,
    tag: program.eyebrow || program.title,
  }];
  const activeHeroIndex = heroSlides.length ? Math.min(heroSlideIndex, heroSlides.length - 1) : 0;
  const activeShowcaseIndex = showcaseImages.length ? Math.min(showcaseSlideIndex, showcaseImages.length - 1) : 0;
  const activeShowcaseImage = showcaseImages[activeShowcaseIndex];

  useEffect(() => {
    if (heroSlides.length > 0 && heroSlideIndex >= heroSlides.length) setHeroSlideIndex(0);
  }, [heroSlideIndex, heroSlides.length]);

  useEffect(() => {
    if (showcaseImages.length > 0 && showcaseSlideIndex >= showcaseImages.length) setShowcaseSlideIndex(0);
  }, [showcaseImages.length, showcaseSlideIndex]);

  const moveHeroSlide = useCallback((direction: number) => {
    setHeroSlideIndex((current) => {
      if (!heroSlides.length) return 0;
      return (current + direction + heroSlides.length) % heroSlides.length;
    });
  }, [heroSlides.length]);

  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const timer = window.setInterval(() => {
      setHeroSlideIndex((current) => (current + 1) % heroSlides.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

  const moveShowcaseSlide = useCallback((direction: number) => {
    setShowcaseSlideIndex((current) => {
      if (!showcaseImages.length) return 0;
      return (current + direction + showcaseImages.length) % showcaseImages.length;
    });
  }, [showcaseImages.length]);

  return (
    <main className="bg-white">
      {/* ── Hero ── */}
      {showSection('hero') && (
      <section className="relative overflow-hidden" style={{ minHeight: 'clamp(620px, 43vw, 820px)' }}>
        <div className="absolute inset-0">
          {heroSlides.map((slide, index) => (
            <img
              key={`${summerModuleTag(slide)}-${index}`}
              src={summerModuleImage(slide, index)}
              alt=""
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 ${index === activeHeroIndex ? 'opacity-100' : 'opacity-0'}`}
            />
          ))}
          <div className="absolute inset-0 hidden md:block" style={{ background: 'linear-gradient(90deg, rgba(8,45,82,0.88) 0%, rgba(8,45,82,0.62) 45%, rgba(8,45,82,0.18) 100%)' }} />
          <div className="absolute inset-0 md:hidden" style={{ background: 'linear-gradient(180deg, rgba(8,45,82,0.84) 0%, rgba(8,45,82,0.74) 62%, rgba(8,45,82,0.58) 100%)' }} />
        </div>
        <div className="relative z-10 mx-auto flex max-w-[1180px] flex-col px-5 pb-16 pt-20 sm:pt-24 lg:px-4 lg:pt-28">
          <div
            className="w-full max-w-[620px] p-5 sm:p-7 lg:p-8"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: '24px',
              backdropFilter: 'blur(10px)',
              WebkitBackdropFilter: 'blur(10px)',
            }}
          >
            <Link to="/#programs" className="mb-5 inline-flex items-center gap-2 text-sm font-bold text-white/70 transition-colors hover:text-white sm:mb-6">
              <ArrowLeft size={18} /> Quay lại chương trình học
            </Link>
            {program.eyebrow && (
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#F45A0A]/25 bg-[#F45A0A]/15 px-3.5 py-2 sm:mb-5">
                <Sparkles size={15} className="text-[#F45A0A]" />
                <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#F45A0A]">{program.eyebrow}</span>
              </div>
            )}
            <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.05] text-white md:text-5xl">
              {program.title}
            </h1>
            {subtitle && <p className="mt-3 max-w-2xl text-base font-bold leading-7 text-white md:text-lg">{subtitle}</p>}
            {program.description && <p className="mt-4 max-w-2xl text-sm leading-6 text-white/75 md:text-base md:leading-7">{program.description}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {chips.map((chip) => (
                <span key={chip} className="rounded-full border border-white/16 bg-white/10 px-3 py-1.5 text-xs font-extrabold text-white shadow-sm backdrop-blur sm:px-4 sm:py-2 sm:text-sm">
                  {chip}
                </span>
              ))}
            </div>
            {heroStats.length > 0 && (
              <div className={`mt-5 grid grid-cols-1 gap-2.5 ${heroStats.length === 2 ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
                {heroStats.map((stat) => {
                  const Icon = summerStatIcon(stat);
                  const display = summerStatDisplay(stat);
                  return (
                    <div key={`${display.label}-${display.value}`} className={heroStatCardClass}>
                      <div className={heroStatLabelClass}>
                        <Icon size={15} className="shrink-0" />
                        <span className={heroStatLabelTextClass}>{display.label}</span>
                      </div>
                      <p className={heroStatValueClass}>{display.value}</p>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="mt-4 flex flex-col gap-2 sm:mt-5 sm:flex-row sm:gap-3">
              <button type="button" onClick={onCtaClick} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F45A0A] px-6 py-3 text-xs font-bold uppercase tracking-wide text-white shadow-lg shadow-orange-600/25 transition-all hover:-translate-y-0.5 hover:bg-orange-600 sm:py-3.5 sm:text-sm">
                Tư vấn chương trình <ArrowRight size={18} />
              </button>
              <button type="button" onClick={() => setRegistrationOpen(true)} className="inline-flex items-center justify-center rounded-2xl border-2 border-white/50 bg-white/5 px-6 py-3 text-xs font-bold uppercase tracking-wide text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-white hover:text-[#003B7A] sm:py-3.5 sm:text-sm">
                Đăng ký ngay
              </button>
            </div>
          </div>
        </div>

        {heroSlides.length > 1 && (
          <div className="absolute bottom-12 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2">
            {heroSlides.map((slide, index) => (
              <button
                key={summerModuleTag(slide)}
                type="button"
                onClick={() => setHeroSlideIndex(index)}
                className={`h-2.5 rounded-full transition-all ${index === activeHeroIndex ? 'w-8 bg-white' : 'w-2.5 bg-white/45 hover:bg-white/70'}`}
                aria-label={`Chọn ảnh ${summerModuleTag(slide)}`}
              />
            ))}
          </div>
        )}

        {heroSlides.length > 1 && (
          <div className="absolute bottom-12 right-5 z-10 hidden items-center gap-2 md:flex lg:right-[calc((100vw-1180px)/2)]">
            <button
              type="button"
              onClick={() => moveHeroSlide(-1)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-[#003B7A] shadow-sm backdrop-blur transition-colors hover:bg-white"
              aria-label="Ảnh hero trước"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => moveHeroSlide(1)}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-[#003B7A] text-white shadow-sm transition-colors hover:bg-[#1267AE]"
              aria-label="Ảnh hero tiếp theo"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </section>
      )}

      {/* ── Tổng quan ── */}
      {showSection('overview') && (
      <section className="py-14 lg:py-16">
        <div className="mx-auto max-w-[1180px] px-5 lg:px-4">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#F45A0A]">{overviewEyebrow}</p>
              <h2 className="mt-3 text-3xl font-extrabold leading-tight text-slate-950 md:text-4xl">{overviewTitle}</h2>
            </div>
            <p className="text-base leading-8 text-slate-600">{overviewBody}</p>
          </div>
        </div>
      </section>
      )}

      {/* ── Đối tượng phù hợp ── */}
      {showSection('audience') && audience.length > 0 && (
        <section className="bg-[#F7FAFD] py-14 lg:py-16">
          <div className="mx-auto max-w-[1180px] px-5 lg:px-4">
            <h2 className="text-3xl font-extrabold text-slate-950">{audienceTitle}</h2>
            <div className="mt-7 grid gap-5 md:grid-cols-2">
              {audience.map((item, i) => (
                <article key={item.title || i} className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm transition-transform hover:-translate-y-1">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#EAF7FF] text-[#003B7A]">
                    <Users size={24} />
                  </div>
                  <h3 className="text-xl font-extrabold text-[#003B7A]">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── 4 bộ môn ── */}
      {showSection('modules') && modules.length > 0 && (
        <section className="py-14 lg:py-16">
          <div className="mx-auto max-w-[1180px] px-5 lg:px-4">
            <div className="max-w-2xl">
              <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#F45A0A]">{modulesEyebrow}</p>
              <h2 className="mt-3 text-3xl font-extrabold text-slate-950">{modulesTitle}</h2>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {modules.map((mod, i) => {
                const Icon = iconFromName(mod.icon);
                return (
                  <article key={mod.title || i} className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg">
                    <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: mod.color }} />
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ color: mod.color, backgroundColor: `${mod.color}1A` }}>
                      <Icon size={24} />
                    </div>
                    <h3 className="mt-5 text-lg font-extrabold text-slate-950">{mod.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{mod.description}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Lộ trình + lịch tuần ── */}
      {showSection('roadmap') && (
      <section className="bg-[#003B7A] py-14 text-white lg:py-16">
        <div className="mx-auto max-w-[1180px] px-5 lg:px-4">
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#F6B43C]">{roadmapEyebrow}</p>
          <h2 className="mt-3 text-3xl font-extrabold">{roadmapTitle}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {stages.map((stage, i) => (
              <article key={stage.title || i} className="rounded-2xl bg-white/10 p-5 backdrop-blur-sm ring-1 ring-white/10">
                <p className="text-sm font-extrabold uppercase tracking-widest" style={{ color: stage.color }}>{stage.label}</p>
                <h3 className="mt-2 text-2xl font-extrabold">{stage.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/75">{stage.description}</p>
              </article>
            ))}
          </div>

          {weeklyPlan.length > 0 && (
            <div className="mt-8 overflow-hidden rounded-2xl border border-white/15 bg-white/10">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-extrabold"
                onClick={() => setShowPlan((current) => !current)}
                aria-expanded={showPlan}
              >
                Xem lộ trình chi tiết từng tuần
                <span className="text-2xl leading-none">{showPlan ? '−' : '+'}</span>
              </button>
              {showPlan && (
                <div className="overflow-x-auto border-t border-white/15">
                  <table className="w-full min-w-[820px] text-left text-sm">
                    <thead className="bg-white/10 text-xs uppercase tracking-widest text-white/70">
                      <tr>
                        {weeklyColumns.map((col) => (
                          <th key={col} className="px-4 py-3">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyPlan.map((row, ri) => (
                        <tr key={ri} className="border-t border-white/10">
                          {row.map((cell, ci) => (
                            <td key={ci} className={ci === 0 ? 'px-4 py-4 font-extrabold text-[#F6B43C]' : 'px-4 py-4 text-white/80'}>{cell}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
      )}

      {/* ── Kết quả ── */}
      {showSection('outcomes') && outcomes.length > 0 && (
        <section className="py-14 lg:py-16">
          <div className="mx-auto max-w-[1180px] px-5 lg:px-4">
            <h2 className="text-3xl font-extrabold text-slate-950">{outcomesTitle}</h2>
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              {outcomes.map((item, i) => (
                <div key={item || i} className="flex gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-[#16A34A]" size={22} />
                  <p className="text-sm font-semibold leading-7 text-slate-700">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Showcase ── */}
      {showSection('showcase') && (
      <section className="bg-[#FFF8EA] py-14 lg:py-16">
        <div className="mx-auto max-w-[1180px] px-5 lg:px-4">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="relative overflow-hidden rounded-3xl bg-white p-3 shadow-xl">
              <div className="relative overflow-hidden rounded-2xl">
                <img
                  src={activeShowcaseImage ? summerGalleryImageSrc(activeShowcaseImage) : showcaseImage}
                  alt={activeShowcaseImage?.alt || activeShowcaseImage?.title || showcaseTitle}
                  className="h-[320px] w-full object-cover md:h-[420px]"
                />
                {showcaseImages.length > 1 && (
                  <div className="absolute bottom-4 left-4 rounded-full bg-white/95 px-3 py-1.5 text-xs font-extrabold text-[#003B7A] shadow-sm backdrop-blur">
                    {String(activeShowcaseIndex + 1).padStart(2, '0')} / {String(showcaseImages.length).padStart(2, '0')}
                  </div>
                )}
                {showcaseImages.length > 1 && (
                  <div className="absolute bottom-4 right-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => moveShowcaseSlide(-1)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white/95 text-[#003B7A] shadow-sm transition-colors hover:bg-[#F4FAFF]"
                      aria-label="Ảnh showcase trước"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveShowcaseSlide(1)}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#003B7A] text-white shadow-sm transition-colors hover:bg-[#1267AE]"
                      aria-label="Ảnh showcase tiếp theo"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#F45A0A]">{showcaseEyebrow}</p>
              <h2 className="mt-3 text-3xl font-extrabold leading-tight text-slate-950">{showcaseTitle}</h2>
              <p className="mt-4 text-base leading-8 text-slate-600">{showcaseBody}</p>
            </div>
          </div>
          {showcaseItems.length > 0 && (
            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {showcaseItems.map((item, i) => {
                const Icon = iconFromName(item.icon);
                return (
                  <article key={item.title || i} className="rounded-2xl bg-white p-5 shadow-sm transition-transform hover:-translate-y-1">
                    <Icon size={24} className="text-[#F45A0A]" />
                    <h3 className="mt-4 text-base font-extrabold text-[#003B7A]">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>
      )}

      {/* ── Thông tin lớp học ── */}
      {showSection('classInfo') && classInfo.length > 0 && (
        <section className="py-14 lg:py-16">
          <div className="mx-auto max-w-[1180px] px-5 lg:px-4">
            <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
              <div>
                <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#F45A0A]">{classInfoTitle}</p>
                <h2 className="mt-3 text-3xl font-extrabold text-slate-950">{classInfoTitle}</h2>
                <p className="mt-4 text-sm leading-7 text-slate-600">{classInfoBody}</p>
              </div>
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {classInfo.map((row, i) => (
                  <div key={row.label || i} className="grid gap-1 border-b border-slate-100 px-5 py-4 last:border-b-0 sm:grid-cols-[200px_1fr]">
                    <p className="text-sm font-extrabold text-slate-500">{row.label}</p>
                    <p className="text-sm font-bold leading-6 text-slate-900">{row.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Thư viện ảnh ── */}
      {showSection('gallery') && gallery.length > 0 && (
        <section className="bg-[#F7FAFD] py-14 lg:py-16">
          <div className="mx-auto max-w-[1180px] px-5 lg:px-4">
            <h2 className="text-3xl font-extrabold text-slate-950">{galleryTitle}</h2>
            <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {gallery.map((image, i) => (
                <figure key={image.src || i} className="overflow-hidden rounded-2xl bg-white shadow-sm">
                  <img src={image.src} alt={image.alt || image.title} className="h-56 w-full object-cover transition-transform duration-700 hover:scale-105" />
                  {image.title && <figcaption className="px-4 py-3 text-sm font-extrabold text-[#003B7A]">{image.title}</figcaption>}
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      {showSection('cta') && (
      <section className="bg-[#003B7A] py-14 text-white lg:py-16">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-5 lg:flex-row lg:items-center lg:justify-between lg:px-4">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-extrabold leading-tight">{ctaTitle}</h2>
            <p className="mt-4 text-sm leading-7 text-white/75">{ctaBody}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={onCtaClick} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F45A0A] px-7 py-4 text-sm font-bold uppercase tracking-wide text-white transition-all hover:-translate-y-0.5 hover:bg-orange-600">
              Tư vấn chương trình <ArrowRight size={18} />
            </button>
            <button type="button" onClick={() => setRegistrationOpen(true)} className="inline-flex items-center justify-center rounded-2xl border-2 border-white/25 bg-white/10 px-7 py-4 text-sm font-bold uppercase tracking-wide text-white transition-all hover:-translate-y-0.5 hover:bg-white/20">
              Đăng ký ngay
            </button>
          </div>
        </div>
      </section>
      )}

      {showSection('leadForm') && (
        <PublicLeadForm
          formId={`${program.slug}-form`}
          title={`Tư vấn chương trình ${program.title}`}
          interestedCourse={leadCourseFromProgram(program)}
          dealSize={resolveCourseDealSizeForProgram(program)}
          dealCurrency={program.dealCurrency || DEFAULT_DEAL_CURRENCY}
        />
      )}

      {registrationOpen && (
        <SummerRegistrationModal
          program={program}
          onClose={() => setRegistrationOpen(false)}
        />
      )}
    </main>
  );
}

function SummerRegistrationModal({ program, onClose }: { program: ProgramCms; onClose: () => void }) {
  const [parentName, setParentName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loadingAction, setLoadingAction] = useState<'consult' | 'paid' | null>(null);

  const price = resolveCourseDealSizeForProgram(program);
  const currency = program.dealCurrency || DEFAULT_DEAL_CURRENCY;
  const normalizedPhone = normalizeSummerPhone(phone);
  const transferName = parentName.trim() || 'Tên phụ huynh';
  const transferPhone = normalizedPhone || 'SĐT';
  const transferContent = `${transferName} - ${transferPhone}`;
  const priceLabel = formatCurrency(price, currency);
  const courseName = leadCourseFromProgram(program);
  const sourceLabel = program.title || courseName || 'Chương trình kỹ năng';

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  async function submitRegistration(action: 'consult' | 'paid') {
    setError('');
    setSuccessMessage('');

    const cleanParentName = parentName.replace(/\s+/g, ' ').trim();
    const cleanStudentName = studentName.replace(/\s+/g, ' ').trim();
    const cleanPhone = normalizeSummerPhone(phone);

    if (!cleanParentName || !cleanStudentName || !cleanPhone) {
      setError('Vui lòng nhập tên phụ huynh, tên bé và số điện thoại.');
      return;
    }

    if (!isValidSummerPhone(cleanPhone)) {
      setError('Số điện thoại chưa đúng định dạng.');
      return;
    }

    const paid = action === 'paid';
    setLoadingAction(action);
    try {
      await publicLeadService.submit({
        fullName: cleanStudentName,
        parentName: cleanParentName,
        studentName: cleanStudentName,
        phone: cleanPhone,
        contactType: 'parent',
        source: paid ? `Website - ${sourceLabel} QR chuyển khoản` : `Website - ${sourceLabel} đăng ký ngay`,
        interestedCourse: courseName || sourceLabel,
        status: paid ? WON_LEAD_STATUS : leadStatuses[0],
        tags: paid ? ['Cần check CK'] : undefined,
        dealSize: price,
        dealCurrency: currency,
        expectedRevenue: price,
        revenue: paid ? price : undefined,
        dealPackage: courseName || sourceLabel,
        dealNote: `ND CK: ${cleanParentName} - ${cleanPhone}`,
        initialNote: paid
          ? `Phụ huynh chọn Đã chuyển khoản trên popup ${sourceLabel}. ND CK: ${cleanParentName} - ${cleanPhone}. Sales kiểm tra giao dịch Techcombank.`
          : `Phụ huynh chọn Cần tư vấn thêm trên popup ${sourceLabel}. ND CK gợi ý: ${cleanParentName} - ${cleanPhone}.`,
      }, paid ? `${program.slug}-paid-popup` : `${program.slug}-consult-popup`);

      setSuccessMessage(paid
        ? `Đã ghi nhận đăng ký học ${sourceLabel}. Sales METTA sẽ kiểm tra chuyển khoản.`
        : 'METTA đã nhận thông tin. Tư vấn viên sẽ liên hệ để hỗ trợ thêm.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không gửi được thông tin. Vui lòng thử lại.');
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/60 px-4 py-6 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="summer-registration-title">
      <div className="mx-auto flex min-h-full max-w-5xl items-center justify-center">
        <div className="relative w-full overflow-hidden rounded-3xl bg-white shadow-2xl">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 transition-colors hover:text-slate-900"
            aria-label="Đóng form đăng ký"
          >
            <X size={20} />
          </button>

          <div className="grid lg:grid-cols-[1fr_0.95fr]">
            <div className="p-5 sm:p-7 lg:p-8">
              <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#F45A0A]">METTA Summer 2026</p>
              <h2 id="summer-registration-title" className="mt-3 text-2xl font-extrabold leading-tight text-[#003B7A] sm:text-3xl">
                Đăng ký ngay
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Điền thông tin để METTA ghi nhận đăng ký và hỗ trợ phụ huynh hoàn tất lớp hè cho con.
              </p>

              <div className="mt-6 grid gap-4">
                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Tên phụ huynh</span>
                  <input
                    value={parentName}
                    onChange={(event) => setParentName(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#16A9D8] focus:ring-4 focus:ring-[#16A9D8]/15"
                    placeholder="Ví dụ: Nguyễn Minh Anh"
                    autoFocus
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Tên bé</span>
                  <input
                    value={studentName}
                    onChange={(event) => setStudentName(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#16A9D8] focus:ring-4 focus:ring-[#16A9D8]/15"
                    placeholder="Ví dụ: Minh Khôi"
                  />
                </label>

                <label className="block">
                  <span className="text-sm font-bold text-slate-700">Số điện thoại</span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-[#16A9D8] focus:ring-4 focus:ring-[#16A9D8]/15"
                    placeholder="Ví dụ: 0912345678"
                    inputMode="tel"
                  />
                </label>
              </div>

              <div className="mt-5 rounded-2xl border border-[#F6B43C]/35 bg-[#FFF8EA] p-4">
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#F45A0A]">Nội dung chuyển khoản</p>
                <p className="mt-2 break-words text-lg font-extrabold text-slate-950">{transferContent}</p>
                <p className="mt-1 text-sm font-semibold text-slate-600">Học phí: {priceLabel} / trọn khóa</p>
              </div>

              {error && (
                <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              )}
              {successMessage && (
                <div className="mt-4 flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => submitRegistration('consult')}
                  disabled={Boolean(loadingAction)}
                  className="inline-flex items-center justify-center rounded-2xl border-2 border-[#003B7A]/15 bg-white px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-[#003B7A] transition-all hover:-translate-y-0.5 hover:bg-[#F4FAFF] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingAction === 'consult' ? 'Đang gửi...' : 'Cần tư vấn thêm'}
                </button>
                <button
                  type="button"
                  onClick={() => submitRegistration('paid')}
                  disabled={Boolean(loadingAction)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#F45A0A] px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-white shadow-lg shadow-orange-600/25 transition-all hover:-translate-y-0.5 hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loadingAction === 'paid' ? 'Đang ghi nhận...' : 'Đã chuyển khoản'} <ArrowRight size={18} />
                </button>
              </div>
            </div>

            <div className="bg-gradient-to-br from-[#EAF7FF] via-white to-[#FFF8EA] p-5 sm:p-7 lg:p-8">
              <div className="rounded-3xl bg-white p-4 shadow-xl shadow-[#003B7A]/10">
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-400">Thanh toán</p>
                    <p className="mt-1 text-lg font-extrabold text-[#003B7A]">Mã QR METTA Summer</p>
                  </div>
                  <span className="rounded-full bg-[#F45A0A]/10 px-3 py-1 text-xs font-extrabold text-[#F45A0A]">{priceLabel}</span>
                </div>

                <img
                  src={SUMMER_QR_IMAGE}
                  alt="Mã QR thanh toán METTA Summer 2026"
                  className="mx-auto mt-5 w-full max-w-[300px] rounded-2xl border border-slate-100 object-contain"
                />

                <div className="mt-5 rounded-2xl bg-[#FFF8EA] p-4 text-center">
                  <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#F45A0A]">ND CK</p>
                  <p className="mt-2 break-words text-base font-extrabold text-slate-950">{transferContent}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgramDetailSkeleton() {
  return (
    <main className="min-h-screen bg-[#F7F9FC] pt-24">
      <section className="mx-auto grid max-w-[1180px] gap-10 px-4 py-10 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-5">
          <div className="h-5 w-44 animate-pulse rounded bg-slate-200" />
          <div className="h-12 w-3/4 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-12 w-1/2 animate-pulse rounded-lg bg-slate-200" />
          <div className="h-5 w-full animate-pulse rounded bg-slate-200" />
          <div className="h-5 w-5/6 animate-pulse rounded bg-slate-200" />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="h-28 animate-pulse rounded-xl bg-white" />
            <div className="h-28 animate-pulse rounded-xl bg-white" />
            <div className="h-28 animate-pulse rounded-xl bg-white" />
          </div>
        </div>
        <div className="h-[420px] animate-pulse rounded-2xl bg-slate-200 shadow-xl" />
      </section>
      <section className="bg-[#003B7A] py-14">
        <div className="mx-auto max-w-[1180px] px-4">
          <div className="mx-auto mb-10 h-10 w-2/3 animate-pulse rounded-lg bg-white/15" />
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/10" />
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

/* ── Icon mapping helpers for highlights / outcomes ── */
type CardInfo = { Icon: LucideIcon; title: string; sub: string };

const ICON_MAP: Record<string, LucideIcon> = {
  Music, BookOpen, Eye, Brain, Globe, Zap, Mic, MessageCircle, GraduationCap,
  Star, Cpu, FlaskConical, Trophy, Target, Hand, Lightbulb, Users, CheckCircle2, Sparkles,
  Activity: Zap, Layers: Globe, // mapped to nearest available
};

function iconFromName(name: string): LucideIcon {
  return ICON_MAP[name] ?? Star;
}

function parseHighlight(text: string, index: number): CardInfo {
  const lower = text.toLowerCase();
  let Icon: LucideIcon;
  if (lower.includes('3e') || lower.includes('âm nhạc') || lower.includes('vận động')) Icon = Music;
  else if (lower.includes('phonics') || lower.includes('safari') || lower.includes('giáo trình') || lower.includes('oxford')) Icon = BookOpen;
  else if (lower.includes('giác quan') || lower.includes('nghe, nhìn') || lower.includes('đa giác')) Icon = Eye;
  else if (lower.includes('clil') || lower.includes('tư duy')) Icon = Brain;
  else if (lower.includes('ai-powered') || lower.includes('app') || lower.includes('video')) Icon = Cpu;
  else if (lower.includes('steam') || lower.includes('dự án') || lower.includes('project')) Icon = FlaskConical;
  else if (lower.includes('cambridge') || lower.includes('chứng chỉ')) Icon = Trophy;
  else if (lower.includes('cam kết') || lower.includes('lớp nhỏ')) Icon = Target;
  else Icon = ([Music, BookOpen, Eye, Brain, Globe, Star] as LucideIcon[])[index % 6];

  // Split "Title: description" or "Title giúp/qua description"
  const colonIdx = text.indexOf(':');
  if (colonIdx > 0 && colonIdx < 45) {
    return { Icon, title: text.slice(0, colonIdx).trim(), sub: text.slice(colonIdx + 1).trim() };
  }
  const verbMatch = text.match(/^(.{8,35}?)\s+(?:giúp|qua|với|và|theo|trong|kết hợp)\s+(.+)$/);
  if (verbMatch) return { Icon, title: verbMatch[1].trim(), sub: verbMatch[2].trim() };
  const words = text.split(' ');
  const mid = Math.min(4, Math.floor(words.length / 2));
  return { Icon, title: words.slice(0, mid).join(' '), sub: words.slice(mid).join(' ') };
}

function parseOutcome(text: string, index: number): CardInfo {
  const lower = text.toLowerCase();
  let Icon: LucideIcon;
  if (lower.includes('phản xạ')) Icon = Zap;
  else if (lower.includes('phát âm')) Icon = Mic;
  else if (lower.includes('giao tiếp') || lower.includes('tự tin')) Icon = MessageCircle;
  else if (lower.includes('tiểu học') || lower.includes('sẵn sàng') || lower.includes('chuyển tiếp')) Icon = GraduationCap;
  else if (lower.includes('cambridge') || lower.includes('chứng chỉ')) Icon = Trophy;
  else if (lower.includes('ielts') || lower.includes('band') || lower.includes('band')) Icon = Target;
  else if (lower.includes('thuyết trình') || lower.includes('làm việc nhóm')) Icon = Users;
  else if (lower.includes('đọc') || lower.includes('viết') || lower.includes('chính tả')) Icon = BookOpen;
  else if (lower.includes('học thuật') || lower.includes('học bổng')) Icon = Star;
  else Icon = ([Zap, Mic, MessageCircle, GraduationCap, Trophy, Target] as LucideIcon[])[index % 6];

  // Try to extract a short title from the full outcome text
  // Patterns: "Phản xạ tiếng Anh tự nhiên trong..." → "Phản xạ tự nhiên"
  const shortMap: Record<string, string> = {
    'phản xạ': 'Phản xạ tự nhiên',
    'phát âm chuẩn': 'Phát âm chuẩn',
    'phát âm rõ': 'Phát âm rõ ràng',
    'tự tin giao tiếp': 'Tự tin giao tiếp',
    'sẵn sàng': 'Sẵn sàng tiểu học',
    'đọc độc lập': 'Đọc độc lập',
    'viết chính tả': 'Viết chính tả tốt',
    'phát triển năng lực': 'Năng lực 4 kỹ năng',
    'tự tin thuyết trình': 'Tự tin thuyết trình',
    'cambridge': 'Chứng chỉ Cambridge',
    'nền tảng học thuật': 'Nền tảng học thuật',
    'xây nền ielts': 'Nền IELTS vững',
    'tăng lợi thế': 'Lợi thế xét tuyển',
    'kỹ năng viết': 'Viết & Nói tốt',
    'chuẩn bị nền tảng': 'Săn học bổng',
  };

  for (const [key, short] of Object.entries(shortMap)) {
    if (lower.includes(key)) {
      const sub = text.replace(new RegExp(short, 'i'), '').trim().replace(/^[,.\-–\s]+/, '');
      return { Icon, title: short, sub: text.length > short.length + 5 ? text : '' };
    }
  }

  // Fallback: first ~4 words as title
  const words = text.split(' ');
  const mid = Math.min(4, Math.floor(words.length / 2));
  return { Icon, title: words.slice(0, mid).join(' '), sub: words.slice(mid).join(' ') };
}

/* ── Skills Flower / Metta 5 ── */
const DEFAULT_SKILLS: import('@/types/cms').SkillPetal[] = [
  { name: 'Social', label: 'Xã hội', description: 'Phát triển khả năng làm việc nhóm, học cách chia sẻ và tương tác tích cực.', color: '#0EA5E9' },
  { name: 'Physical', label: 'Thể chất', description: 'Rèn luyện sự khéo léo qua các hoạt động vận động theo bài hát, vẽ và tô màu.', color: '#F97316' },
  { name: 'Intellectual', label: 'Nhận thức', description: 'Tăng khả năng quan sát, nhận xét và ghi nhớ quy luật âm thanh.', color: '#1E3A5F' },
  { name: 'Creative', label: 'Sáng tạo', description: 'Khơi gợi trí tưởng tượng qua việc sáng tạo câu chuyện từ các âm tiết.', color: '#8B5CF6' },
  { name: 'Emotional', label: 'Tình cảm', description: 'Xây dựng sự tự tin và tạo cảm hứng yêu thích học tập suốt đời.', color: '#16A34A' },
];

const SKILL_ICONS: Record<string, string> = {
  Social: '🤝', Physical: '🏃', Intellectual: '🧠', Creative: '🎨', Emotional: '💛',
};

function SkillsFlower({ skills }: { skills?: import('@/types/cms').SkillPetal[] }) {
  const petals = skills?.length ? skills : DEFAULT_SKILLS;
  const [active, setActive] = useState<number | null>(null);

  // Flower positions: 5 petals around center
  const positions = [
    { x: 50, y: 8 },    // top
    { x: 88, y: 38 },   // top-right
    { x: 73, y: 82 },   // bottom-right
    { x: 27, y: 82 },   // bottom-left
    { x: 12, y: 38 },   // top-left
  ];

  return (
    <section className="bg-white py-12 lg:py-16">
      <div className="mx-auto max-w-[1180px] px-4">
        <div className="text-center mb-10">
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#F45A0A]">Kỹ năng tích hợp</p>
          <h2 className="mt-3 text-3xl font-extrabold text-slate-950">Phát triển toàn diện "The Metta 5"</h2>
          <p className="mt-3 max-w-2xl mx-auto text-slate-600 leading-7">
            Chương trình lồng ghép bộ kỹ năng giúp trẻ phát triển cân bằng về thể chất, trí tuệ, cảm xúc, sáng tạo và xã hội.
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-10 items-center">
          {/* Flower diagram */}
          <div className="relative mx-auto w-[320px] h-[320px] lg:w-[380px] lg:h-[380px]">
            {/* Center circle */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 lg:w-24 lg:h-24 rounded-full bg-[#003B7A] shadow-xl flex items-center justify-center z-20">
              <span className="text-white font-extrabold text-xs lg:text-sm text-center leading-tight">THE<br/>METTA 5</span>
            </div>

            {/* Petals */}
            {petals.map((petal, i) => {
              const pos = positions[i % positions.length];
              const isActive = active === i;
              const icon = SKILL_ICONS[petal.name] || '⭐';
              return (
                <button
                  key={i}
                  type="button"
                  className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full flex flex-col items-center justify-center text-white shadow-lg transition-all duration-300 cursor-pointer border-4 border-white z-10"
                  style={{
                    left: `${pos.x}%`,
                    top: `${pos.y}%`,
                    backgroundColor: petal.color,
                    width: isActive ? 110 : 90,
                    height: isActive ? 110 : 90,
                    transform: `translate(-50%, -50%) scale(${isActive ? 1.15 : 1})`,
                    boxShadow: isActive ? `0 8px 30px ${petal.color}60` : undefined,
                  }}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onClick={() => setActive(active === i ? null : i)}
                >
                  <span className="text-2xl mb-0.5">{icon}</span>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider">{petal.name}</span>
                  <span className="text-[9px] font-semibold text-white/70">{petal.label}</span>
                </button>
              );
            })}

            {/* Connecting lines from center to petals */}
            <svg className="absolute inset-0 w-full h-full z-0" viewBox="0 0 100 100">
              {petals.map((petal, i) => {
                const pos = positions[i % positions.length];
                return (
                  <line key={i} x1="50" y1="50" x2={pos.x} y2={pos.y}
                    stroke={petal.color} strokeWidth="1.5" strokeDasharray="3 3" opacity="0.3" />
                );
              })}
            </svg>
          </div>

          {/* Skill cards list */}
          <div className="flex flex-col gap-3">
            {petals.map((petal, i) => {
              const isActive = active === i;
              const icon = SKILL_ICONS[petal.name] || '⭐';
              return (
                <div
                  key={i}
                  className="flex items-start gap-4 rounded-xl p-4 transition-all duration-300 cursor-pointer"
                  style={{
                    backgroundColor: isActive ? `${petal.color}12` : 'transparent',
                    borderLeft: `4px solid ${isActive ? petal.color : 'transparent'}`,
                  }}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 shadow-sm transition-transform duration-300"
                    style={{
                      backgroundColor: `${petal.color}18`,
                      transform: isActive ? 'scale(1.1)' : 'scale(1)',
                    }}
                  >
                    {icon}
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">
                      {petal.name} <span className="font-semibold text-slate-500">· {petal.label}</span>
                    </h4>
                    <p className="text-xs leading-5 text-slate-600 mt-0.5">{petal.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Program Hero with background slider ── */
function ProgramHero({ program, onCtaClick }: { program: ProgramCms; onCtaClick: () => void }) {
  const imgList = program.images?.filter(Boolean).length ? program.images.filter(Boolean) : [program.image].filter(Boolean);
  const [current, setCurrent] = useState(0);
  const [animate, setAnimate] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);

  // Seamless loop: clone first image
  const loopList = imgList.length > 1 ? [...imgList, imgList[0]] : imgList;

  const startTimer = useCallback(() => {
    if (imgList.length <= 1) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCurrent((c) => c + 1), 4000);
  }, [imgList.length]);

  useEffect(() => { startTimer(); return () => clearInterval(timerRef.current); }, [startTimer]);

  // Snap back for seamless loop
  useEffect(() => {
    if (current === imgList.length) {
      const t = setTimeout(() => {
        setAnimate(false);
        setCurrent(0);
        requestAnimationFrame(() => { requestAnimationFrame(() => setAnimate(true)); });
      }, 800);
      return () => clearTimeout(t);
    }
  }, [current, imgList.length]);

  return (
    <section className="relative overflow-hidden" style={{ minHeight: 'clamp(580px, 41.666vw, 800px)' }}>
      {/* Background slider */}
      <div className="absolute inset-0">
        <div
          className="flex h-full"
          style={{
            width: `${loopList.length * 100}%`,
            transform: `translateX(-${(current * 100) / loopList.length}%)`,
            transition: animate ? 'transform 0.8s ease-in-out' : 'none',
          }}
        >
          {loopList.map((img, i) => (
            <div key={i} className="relative h-full" style={{ width: `${100 / loopList.length}%` }}>
              <img src={img} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
        {/* Gradient overlay: tối trái → sáng phải (desktop), tối đều hơn (mobile) — giống hero homepage */}
        <div className="absolute inset-0 hidden md:block" style={{ background: 'linear-gradient(90deg, rgba(8,45,82,0.88) 0%, rgba(8,45,82,0.62) 45%, rgba(8,45,82,0.18) 100%)' }} />
        <div className="absolute inset-0 md:hidden" style={{ background: 'linear-gradient(180deg, rgba(8,45,82,0.82) 0%, rgba(8,45,82,0.72) 60%, rgba(8,45,82,0.55) 100%)' }} />
      </div>

      {/* Dots */}
      {imgList.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 flex gap-2">
          {imgList.map((_, i) => (
            <button
              key={i}
              onClick={() => { setCurrent(i); startTimer(); }}
              className={`w-2.5 h-2.5 rounded-full transition-all ${i === current % imgList.length ? 'bg-white scale-125' : 'bg-white/40 hover:bg-white/60'}`}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 mx-auto flex max-w-[1180px] flex-col px-5 pt-28 pb-14 lg:px-4 lg:pt-32">
        <Link to="/#programs" className="mb-6 inline-flex w-fit items-center gap-2 text-sm font-bold text-white/70 transition-colors hover:text-white">
          <ArrowLeft size={18} /> Quay lại chương trình học
        </Link>

        {/* Glass card — giống hero homepage */}
        <div
          className="w-full max-w-[600px] p-8 sm:p-9 lg:p-10"
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: '24px',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}
        >
          {/* Badge */}
          {program.eyebrow && (
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#F45A0A]/25 bg-[#F45A0A]/15 px-3.5 py-2">
              <Sparkles size={15} className="text-[#F45A0A]" />
              <span className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#F45A0A]">{program.eyebrow}</span>
            </div>
          )}

          {/* Heading */}
          <h1 className="mb-4 font-extrabold text-white" style={{ fontSize: 'clamp(34px, 4vw, 52px)', lineHeight: 1.06, letterSpacing: '-0.5px' }}>
            {program.title}
          </h1>

          {/* Description */}
          {program.description && (
            <p className="mb-6 text-[15px] leading-[1.8] text-white/75 lg:text-base">{program.description}</p>
          )}

          {/* Stat strip — 3 ô bằng nhau, cao bằng nhau */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {[
              { Icon: Users, label: 'Độ tuổi', value: program.ageRange },
              { Icon: Clock, label: 'Thời lượng', value: program.duration },
              { Icon: GraduationCap, label: 'Nhóm khóa', value: program.courseName },
            ].map(({ Icon, label, value }) => (
              <div key={label} className={heroStatCardClass}>
                <div className={heroStatLabelClass}>
                  <Icon size={15} className="shrink-0" />
                  <span className={heroStatLabelTextClass}>{label}</span>
                </div>
                <p className={heroStatValueClass}>{value}</p>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={onCtaClick}
              className="inline-flex items-center justify-center gap-2 bg-[#F45A0A] text-[14px] font-bold uppercase tracking-wide text-white shadow-lg shadow-[#F45A0A]/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-[#F45A0A]/35 active:scale-[0.98]"
              style={{ height: '54px', padding: '0 28px', borderRadius: '16px' }}
            >
              Đăng ký tư vấn <ArrowRight size={18} />
            </button>
            <a
              href="#roadmap"
              className="inline-flex items-center justify-center border-2 border-white/50 text-[14px] font-bold uppercase tracking-wide text-white transition-all hover:-translate-y-0.5 hover:bg-white hover:text-[#003B7A]"
              style={{ height: '54px', padding: '0 28px', borderRadius: '16px' }}
            >
              Xem lộ trình
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
