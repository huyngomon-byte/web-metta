import { ArrowLeft, ArrowRight, CheckCircle2, Clock, GraduationCap, Sparkles, Users, Music, BookOpen, Eye, Brain, Globe, Zap, Mic, MessageCircle, Star, Cpu, FlaskConical, Trophy, Target, Lightbulb, Hand, type LucideIcon } from 'lucide-react';
import { type ReactNode, useEffect, useState, useRef, useCallback } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { PublicLeadForm } from '@/components/public/PublicLeadForm';
import { PUBLIC_PROGRAMS } from '@/lib/constants';
import { usePublicThemeSettings } from '@/hooks/usePublicCms';
import type { ProgramCms } from '@/types/cms';

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

  if (program.slug === 'metta-summer-2026') {
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

      <PublicLeadForm formId={`${program.slug}-form`} title={`Nhận tư vấn chương trình ${program.title}`} />
    </>
  );
}

const summerChips = ['4–11 tuổi', '6 tuần', '24 buổi', '4 bộ môn', 'Showcase cuối khóa'];

const summerAudience = [
  {
    title: 'Nhóm mầm non 4–6 tuổi',
    description: 'Hoạt động nhiều hình ảnh, âm nhạc, vận động và sản phẩm thủ công nhỏ để con làm quen nhẹ nhàng, vui vẻ và tự tin tham gia cùng bạn.',
  },
  {
    title: 'Nhóm tiểu học 6–11 tuổi',
    description: 'Tăng dần thử thách về kỹ thuật, tư duy chiến thuật, trình diễn nhóm và hoàn thiện sản phẩm cho Showcase cuối khóa.',
  },
];

const summerModules: Array<{ title: string; description: string; Icon: LucideIcon; color: string; bg: string }> = [
  {
    title: 'Mỹ thuật',
    description: 'Màu sắc, hình khối, tranh mùa hè và sản phẩm thủ công giúp con thể hiện ý tưởng bằng chất liệu trực quan.',
    Icon: Sparkles,
    color: '#F45A0A',
    bg: '#FFF3E8',
  },
  {
    title: 'Cờ vua',
    description: 'Làm quen bàn cờ, quân cờ, luật chơi, chiến thuật cơ bản và mini tournament phù hợp độ tuổi.',
    Icon: Brain,
    color: '#003B7A',
    bg: '#EEF6FF',
  },
  {
    title: 'Thanh nhạc',
    description: 'Cảm thụ âm nhạc, luyện hơi, hát nhóm và chuẩn bị tiết mục biểu diễn tự tin trước tập thể.',
    Icon: Mic,
    color: '#8B5CF6',
    bg: '#F5F0FF',
  },
  {
    title: 'Nhảy & Múa',
    description: 'Rèn nhịp điệu, động tác cơ bản, phối hợp đội hình và trình diễn nhóm trong Showcase.',
    Icon: Music,
    color: '#16A34A',
    bg: '#ECFDF3',
  },
];

const summerStages = [
  {
    label: 'Tuần 1–2',
    title: 'Khám phá',
    description: 'Con làm quen chất liệu, bàn cờ, giọng hát và nhịp điệu cơ bản qua hoạt động nhẹ nhàng.',
    color: '#16A9D8',
  },
  {
    label: 'Tuần 3–4',
    title: 'Phát triển',
    description: 'Con luyện kỹ thuật, hoàn thiện bài tập nhỏ và bắt đầu phối hợp với nhóm.',
    color: '#F45A0A',
  },
  {
    label: 'Tuần 5–6',
    title: 'Hoàn thiện',
    description: 'Con chỉnh sửa sản phẩm, ráp tiết mục và chuẩn bị tâm thế cho Showcase cuối khóa.',
    color: '#16A34A',
  },
];

const summerWeeklyPlan = [
  {
    week: 'Tuần 1',
    art: 'Làm quen màu sắc, hình khối và chất liệu mùa hè',
    chess: 'Nhận biết bàn cờ, quân cờ và cách di chuyển cơ bản',
    vocal: 'Cảm thụ giai điệu, tư thế hát và luyện hơi nhẹ',
    dance: 'Nhịp điệu cơ bản, làm quen chuyển động theo nhạc',
  },
  {
    week: 'Tuần 2',
    art: 'Vẽ tranh chủ đề mùa hè và hoàn thiện sản phẩm nhỏ',
    chess: 'Luật chơi, cách bảo vệ quân và bài tập quan sát',
    vocal: 'Hát nhóm, giữ nhịp và phát âm lời bài hát rõ ràng',
    dance: 'Động tác tay chân cơ bản và phối hợp theo nhóm',
  },
  {
    week: 'Tuần 3',
    art: 'Thủ công sáng tạo, phối màu và bố cục đơn giản',
    chess: 'Chiến thuật khai cuộc đơn giản và tình huống mini',
    vocal: 'Luyện câu hát, biểu cảm và nghe bạn trong nhóm',
    dance: 'Tổ hợp động tác ngắn và ghi nhớ đội hình',
  },
  {
    week: 'Tuần 4',
    art: 'Dự án tranh cá nhân hoặc sản phẩm thủ công nâng cao',
    chess: 'Mini game, xử lý nước đi và rèn tinh thần fair-play',
    vocal: 'Chọn tiết mục, luyện đoạn biểu diễn chính',
    dance: 'Ráp bài nhóm, nhịp chuyển đoạn và tương tác sân khấu',
  },
  {
    week: 'Tuần 5',
    art: 'Hoàn thiện sản phẩm trưng bày và đặt tên tác phẩm',
    chess: 'Luyện mini tournament và cách bắt tay sau ván đấu',
    vocal: 'Tổng duyệt tiết mục hát nhóm hoặc cá nhân',
    dance: 'Tổng duyệt bài nhảy/múa và biểu cảm trình diễn',
  },
  {
    week: 'Tuần 6',
    art: 'Chuẩn bị góc triển lãm và chia sẻ về sản phẩm',
    chess: 'Giải cờ vua mini trong không khí vui vẻ',
    vocal: 'Biểu diễn trong METTA Summer Showcase 2026',
    dance: 'Trình diễn nhóm, nhận chứng nhận và chụp ảnh cùng phụ huynh',
  },
];

const summerOutcomes = [
  'Có tranh cá nhân và sản phẩm thủ công sáng tạo.',
  'Biết luật chơi và chiến thuật cờ vua cơ bản.',
  'Biểu diễn ít nhất một bài hát hoặc tiết mục nhóm.',
  'Tham gia một bài nhảy/múa hoàn chỉnh.',
  'Tự tin hơn khi đứng trước tập thể.',
  'Nhận chứng nhận hoàn thành chương trình.',
  'Tham gia METTA Summer Showcase 2026 cùng phụ huynh.',
];

const summerShowcaseItems = [
  { title: 'Art Exhibition', description: 'Trưng bày tranh và sản phẩm thủ công của học viên.', Icon: Sparkles },
  { title: 'Chess Mini Tournament', description: 'Không gian thi đấu nhỏ, vui vẻ và khích lệ tinh thần chiến thuật.', Icon: Brain },
  { title: 'Music Performance', description: 'Tiết mục thanh nhạc cá nhân hoặc nhóm trước phụ huynh.', Icon: Mic },
  { title: 'Dance Showcase', description: 'Bài nhảy/múa hoàn chỉnh với đội hình và biểu cảm sân khấu.', Icon: Music },
];

const summerClassInfo = [
  ['Tên chương trình', 'METTA Summer 2026'],
  ['Độ tuổi', '4–11 tuổi'],
  ['Thời lượng', '6 tuần'],
  ['Tổng số buổi', '24 buổi'],
  ['Lịch học', 'Thứ 2 · Thứ 4 · Thứ 6 · Chủ nhật'],
  ['Mỗi buổi', '1h30'],
  ['Học phí', '1.999.000đ / trọn khóa'],
  ['Bộ môn', 'Mỹ thuật · Cờ vua · Thanh nhạc · Nhảy & Múa'],
];

const summerGallery = [
  { src: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=85&auto=format&fit=crop', title: 'Mỹ thuật & thủ công', alt: 'Trẻ học vẽ và thực hành mỹ thuật' },
  { src: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=800&q=85&auto=format&fit=crop', title: 'Cờ vua', alt: 'Bàn cờ vua và hoạt động tư duy chiến thuật' },
  { src: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800&q=85&auto=format&fit=crop', title: 'Thanh nhạc', alt: 'Hoạt động âm nhạc và luyện hát' },
  { src: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=800&q=85&auto=format&fit=crop', title: 'Nhảy & Múa', alt: 'Hoạt động nhảy múa và trình diễn nhóm' },
];

function SummerProgramPage({ program, onCtaClick }: { program: ProgramCms; onCtaClick: () => void }) {
  const [showPlan, setShowPlan] = useState(false);

  return (
    <main className="bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#FFF8EA] via-white to-[#EAF7FF] pt-24">
        <div className="absolute right-[-120px] top-12 h-72 w-72 rounded-full bg-[#F45A0A]/10 blur-3xl" />
        <div className="absolute bottom-[-140px] left-[-120px] h-80 w-80 rounded-full bg-[#16A9D8]/14 blur-3xl" />
        <div className="relative mx-auto grid min-h-[680px] max-w-[1180px] items-center gap-10 px-5 py-10 lg:grid-cols-[1fr_0.9fr] lg:px-4">
          <div>
            <Link to="/#programs" className="mb-7 inline-flex items-center gap-2 text-sm font-bold text-[#003B7A]/70 transition-colors hover:text-[#003B7A]">
              <ArrowLeft size={18} /> Quay lại chương trình học
            </Link>
            <h1 className="max-w-3xl text-4xl font-extrabold leading-tight text-[#003B7A] md:text-6xl">
              METTA Summer 2026
            </h1>
            <p className="mt-4 max-w-2xl text-xl font-bold leading-8 text-[#1267AE]">
              Chương trình hè trải nghiệm đa bộ môn cho trẻ 4–11 tuổi
            </p>
            <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
              Một mùa hè để con khám phá năng khiếu, rèn kỹ năng và tự tin tỏa sáng qua 4 bộ môn: Mỹ thuật, Cờ vua, Thanh nhạc, Nhảy & Múa.
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              {summerChips.map((chip) => (
                <span key={chip} className="rounded-full border border-[#16A9D8]/20 bg-white px-4 py-2 text-sm font-extrabold text-[#003B7A] shadow-sm">
                  {chip}
                </span>
              ))}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={onCtaClick} className="inline-flex items-center justify-center gap-2 rounded-md bg-[#F45A0A] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-orange-600/20 transition-colors hover:bg-orange-600">
                Tư vấn chương trình <ArrowRight size={18} />
              </button>
              <button type="button" onClick={onCtaClick} className="inline-flex items-center justify-center rounded-md border border-[#003B7A]/15 bg-white px-6 py-3.5 text-sm font-bold text-[#003B7A] shadow-sm transition-colors hover:bg-[#F4FAFF]">
                Đăng ký giữ chỗ
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="aspect-[4/5] overflow-hidden rounded-2xl bg-white p-3 shadow-2xl shadow-[#003B7A]/12">
              <img src={program.image || '/brand/workshop-kids.jpg'} alt="METTA Summer 2026" className="h-full w-full rounded-xl object-cover" />
            </div>
            <div className="absolute -bottom-5 left-5 right-5 rounded-xl border border-white/70 bg-white/95 p-4 shadow-xl backdrop-blur">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-2xl font-extrabold text-[#F45A0A]">6</p>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">tuần</p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-[#003B7A]">24</p>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">buổi</p>
                </div>
                <div>
                  <p className="text-2xl font-extrabold text-[#16A34A]">4</p>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">bộ môn</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 lg:py-16">
        <div className="mx-auto max-w-[1180px] px-5 lg:px-4">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#F45A0A]">Tổng quan chương trình</p>
              <h2 className="mt-3 text-3xl font-extrabold leading-tight text-slate-950 md:text-4xl">
                Một mùa hè để con khám phá, phát triển và tỏa sáng
              </h2>
            </div>
            <p className="text-base leading-8 text-slate-600">
              METTA Summer 2026 là chương trình hè đa bộ môn dành cho trẻ mầm non và tiểu học. Trong 6 tuần, học viên được trải nghiệm nghệ thuật, tư duy, âm nhạc và vận động thông qua các hoạt động phù hợp với lứa tuổi.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-[#F7FAFD] py-14 lg:py-16">
        <div className="mx-auto max-w-[1180px] px-5 lg:px-4">
          <h2 className="text-3xl font-extrabold text-slate-950">Chương trình phù hợp với ai?</h2>
          <div className="mt-7 grid gap-5 md:grid-cols-2">
            {summerAudience.map((item) => (
              <article key={item.title} className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
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

      <section className="py-14 lg:py-16">
        <div className="mx-auto max-w-[1180px] px-5 lg:px-4">
          <div className="max-w-2xl">
            <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#F45A0A]">4 bộ môn</p>
            <h2 className="mt-3 text-3xl font-extrabold text-slate-950">4 bộ môn trong chương trình</h2>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {summerModules.map(({ title, description, Icon, color, bg }) => (
              <article key={title} className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm transition-transform hover:-translate-y-1">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ color, backgroundColor: bg }}>
                  <Icon size={24} />
                </div>
                <h3 className="mt-5 text-lg font-extrabold text-slate-950">{title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#003B7A] py-14 text-white lg:py-16">
        <div className="mx-auto max-w-[1180px] px-5 lg:px-4">
          <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#F6B43C]">Lộ trình học</p>
          <h2 className="mt-3 text-3xl font-extrabold">Lộ trình học 6 tuần</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {summerStages.map((stage) => (
              <article key={stage.title} className="rounded-xl bg-white/10 p-5 backdrop-blur-sm">
                <p className="text-sm font-extrabold uppercase tracking-widest" style={{ color: stage.color }}>{stage.label}</p>
                <h3 className="mt-2 text-2xl font-extrabold">{stage.title}</h3>
                <p className="mt-3 text-sm leading-7 text-white/75">{stage.description}</p>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-white/15 bg-white/10">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-extrabold"
              onClick={() => setShowPlan((current) => !current)}
              aria-expanded={showPlan}
            >
              Xem lộ trình chi tiết từng tuần
              <span className="text-2xl leading-none">{showPlan ? '-' : '+'}</span>
            </button>
            {showPlan && (
              <div className="overflow-x-auto border-t border-white/15">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead className="bg-white/10 text-xs uppercase tracking-widest text-white/70">
                    <tr>
                      <th className="px-4 py-3">Tuần</th>
                      <th className="px-4 py-3">Mỹ thuật</th>
                      <th className="px-4 py-3">Cờ vua</th>
                      <th className="px-4 py-3">Thanh nhạc</th>
                      <th className="px-4 py-3">Nhảy & Múa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summerWeeklyPlan.map((row) => (
                      <tr key={row.week} className="border-t border-white/10">
                        <td className="px-4 py-4 font-extrabold text-[#F6B43C]">{row.week}</td>
                        <td className="px-4 py-4 text-white/80">{row.art}</td>
                        <td className="px-4 py-4 text-white/80">{row.chess}</td>
                        <td className="px-4 py-4 text-white/80">{row.vocal}</td>
                        <td className="px-4 py-4 text-white/80">{row.dance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="py-14 lg:py-16">
        <div className="mx-auto max-w-[1180px] px-5 lg:px-4">
          <h2 className="text-3xl font-extrabold text-slate-950">Sau 6 tuần, con có gì?</h2>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {summerOutcomes.map((item) => (
              <div key={item} className="flex gap-3 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <CheckCircle2 className="mt-0.5 shrink-0 text-[#16A34A]" size={22} />
                <p className="text-sm font-semibold leading-7 text-slate-700">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#FFF8EA] py-14 lg:py-16">
        <div className="mx-auto max-w-[1180px] px-5 lg:px-4">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="overflow-hidden rounded-2xl shadow-xl">
              <img src="https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1200&q=85&auto=format&fit=crop" alt="METTA Summer Showcase 2026" className="h-[320px] w-full object-cover md:h-[420px]" />
            </div>
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#F45A0A]">Điểm nhấn cuối khóa</p>
              <h2 className="mt-3 text-3xl font-extrabold leading-tight text-slate-950">METTA Summer Showcase 2026</h2>
              <p className="mt-4 text-base leading-8 text-slate-600">
                Cuối khóa, học viên tham gia triển lãm sản phẩm mỹ thuật, giải cờ vua mini, biểu diễn thanh nhạc, nhảy múa, trao chứng nhận và chụp ảnh cùng phụ huynh.
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {summerShowcaseItems.map(({ title, description, Icon }) => (
              <article key={title} className="rounded-xl bg-white p-5 shadow-sm">
                <Icon size={24} className="text-[#F45A0A]" />
                <h3 className="mt-4 text-base font-extrabold text-[#003B7A]">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 lg:py-16">
        <div className="mx-auto max-w-[1180px] px-5 lg:px-4">
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <div>
              <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#F45A0A]">Thông tin lớp học</p>
              <h2 className="mt-3 text-3xl font-extrabold text-slate-950">Thông tin lớp học</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">Thông tin chính để phụ huynh nắm nhanh lịch học, độ tuổi, học phí và bộ môn trong chương trình.</p>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              {summerClassInfo.map(([label, value]) => (
                <div key={label} className="grid gap-1 border-b border-slate-100 px-5 py-4 last:border-b-0 sm:grid-cols-[200px_1fr]">
                  <p className="text-sm font-extrabold text-slate-500">{label}</p>
                  <p className="text-sm font-bold leading-6 text-slate-900">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#F7FAFD] py-14 lg:py-16">
        <div className="mx-auto max-w-[1180px] px-5 lg:px-4">
          <h2 className="text-3xl font-extrabold text-slate-950">Hình ảnh hoạt động</h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summerGallery.map((image) => (
              <figure key={image.title} className="overflow-hidden rounded-xl bg-white shadow-sm">
                <img src={image.src} alt={image.alt} className="h-56 w-full object-cover transition-transform duration-700 hover:scale-105" />
                <figcaption className="px-4 py-3 text-sm font-extrabold text-[#003B7A]">{image.title}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#003B7A] py-14 text-white lg:py-16">
        <div className="mx-auto flex max-w-[1180px] flex-col gap-6 px-5 lg:flex-row lg:items-center lg:justify-between lg:px-4">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-extrabold leading-tight">Sẵn sàng cho con một mùa hè đáng nhớ tại METTA?</h2>
            <p className="mt-4 text-sm leading-7 text-white/75">
              Để lại thông tin để METTA tư vấn lịch học, độ tuổi phù hợp và hướng dẫn đăng ký giữ chỗ cho con.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={onCtaClick} className="inline-flex items-center justify-center gap-2 rounded-md bg-[#F45A0A] px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-orange-600">
              Tư vấn chương trình <ArrowRight size={18} />
            </button>
            <button type="button" onClick={onCtaClick} className="inline-flex items-center justify-center rounded-md border border-white/25 bg-white/10 px-6 py-3.5 text-sm font-bold text-white transition-colors hover:bg-white/20">
              Đăng ký giữ chỗ
            </button>
          </div>
        </div>
      </section>

      <PublicLeadForm formId="metta-summer-2026-form" title="Tư vấn chương trình METTA Summer 2026" />
    </main>
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
  Star, Cpu, FlaskConical, Trophy, Target, Hand, Lightbulb, Users, CheckCircle2,
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

function Info({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm p-4">
      <div className="text-[#16A9D8]">{icon}</div>
      <p className="mt-3 text-xs font-bold uppercase tracking-widest text-white/60">{label}</p>
      <p className="mt-1 font-extrabold text-white">{value}</p>
    </div>
  );
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
    <section className="relative min-h-[600px] md:min-h-[700px] overflow-hidden">
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
        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#003B7A]/90 via-[#003B7A]/70 to-[#003B7A]/40" />
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
      <div className="relative z-10 mx-auto max-w-[1180px] px-5 pt-28 pb-16 flex flex-col justify-center min-h-[600px] md:min-h-[700px]">
        <Link to="/#programs" className="inline-flex items-center gap-2 text-sm font-bold text-white/70 hover:text-white mb-8 w-fit">
          <ArrowLeft size={18} /> Quay lại chương trình học
        </Link>
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#F45A0A]">{program.eyebrow}</p>
        <h1 className="mt-4 text-4xl font-extrabold leading-tight text-white md:text-6xl max-w-2xl">{program.title}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-white/80">{program.description}</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3 max-w-xl">
          <Info icon={<Users />} label="Độ tuổi" value={program.ageRange} />
          <Info icon={<Clock />} label="Thời lượng" value={program.duration} />
          <Info icon={<GraduationCap />} label="Nhóm khóa" value={program.courseName} />
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <button type="button" onClick={onCtaClick} className="inline-flex items-center justify-center gap-2 rounded-md bg-[#F45A0A] px-6 py-3.5 text-sm font-bold text-white hover:bg-orange-600 shadow-lg">
            Đăng ký tư vấn <ArrowRight size={18} />
          </button>
          <a href="#roadmap" className="inline-flex items-center justify-center rounded-md border border-white/30 bg-white/10 backdrop-blur-sm px-6 py-3.5 text-sm font-bold text-white hover:bg-white/20">
            Xem lộ trình
          </a>
        </div>
      </div>
    </section>
  );
}
