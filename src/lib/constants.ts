import type { SummerStat, SummerAudienceItem, SummerModule, SummerShowcaseItem, SummerClassInfoRow, SummerGalleryImage, RoadmapCard, SummerSectionVisibility } from '@/types/cms';

const LOGO_ASSET_VERSION = '20260612-1555';

export const BRAND_LOGOS = {
  onWhite: `/brand/logo-tr%E1%BA%AFng.png?v=${LOGO_ASSET_VERSION}`,
  onBlue: `/brand/logo-xanh.png?v=${LOGO_ASSET_VERSION}`,
};

export const BRAND = {
  name: 'METTA Academy',
  logo: BRAND_LOGOS.onWhite,
  banner: '/brand/brand-banner.jpg',
  primary: '#003B7A',
  secondary: '#1267AE',
  orange: '#F45A0A',
  cyan: '#16A9D8',
};

export const COURSE_OPTIONS = ['METTA Kiddies', 'METTA on Phonics', 'METTA Young Learner', 'IELTS Junior', 'METTA Summer 2026'] as const;
export const STAFF_OPTIONS = ['METTA Admin'] as const;
export const DEFAULT_DEAL_CURRENCY = 'VND';
export const DEFAULT_COURSE_DEAL_SIZE = 20000000;
const SUMMER_HERO_IMAGE = '/brand/metta-summer-hero-4x3.jpg';

export const SUMMER_ENGLISH_WARMUP_NOTE = 'Mỗi buổi học dành khoảng 10–15 phút đầu giờ cho hoạt động tiếng Anh:';
export const SUMMER_ENGLISH_WARMUP_ACTIVITIES = [
  'Greeting Time',
  'Vocabulary of the Day',
  'Mini Game bằng tiếng Anh',
] as const;

export function summerWeeklyColumnSchedule(column: string) {
  const normalized = column
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  if (normalized.includes('my thuat')) return 'Thứ 2 18:00 - 19:30';
  if (normalized.includes('co vua')) return 'Thứ 4 18:00 - 19:30';
  if (normalized.includes('thanh nhac')) return 'Thứ 6 18:00 - 19:30';
  if (normalized.includes('nhay') && normalized.includes('mua')) return 'Chủ nhật 09:00 - 10:30';
  return '';
}

export const COURSES = [
  { name: 'METTA Kiddies', code: 'KIDDIES', ageRange: '3-6 tuổi', level: 'Preschool' },
  { name: 'METTA on Phonics', code: 'PHONICS', ageRange: '5-7 tuổi', level: 'Early Primary' },
  { name: 'METTA Young Learner', code: 'YOUNG-LEARNER', ageRange: '6-12 tuổi', level: 'Primary' },
  { name: 'IELTS Junior', code: 'IELTS-JUNIOR', ageRange: '11-15 tuổi', level: 'Secondary' },
] as const;

export const PUBLIC_PROGRAMS = [
  {
    slug: 'metta-kiddies',
    programTemplate: 'course',
    courseName: 'Mầm non · Preschool',
    title: 'METTA Kiddies',
    eyebrow: 'Giai đoạn vàng ngôn ngữ',
    ageRange: '3-6 tuổi',
    duration: '90 phút/buổi · 2 buổi/tuần · 96 buổi/level',
    dealSize: DEFAULT_COURSE_DEAL_SIZE,
    dealCurrency: DEFAULT_DEAL_CURRENCY,
    image: '/brand/workshop-kids.jpg',
    summary: 'Không dạy tiếng Anh theo kiểu học thuộc, mà tạo môi trường để trẻ thẩm thấu ngôn ngữ tự nhiên như tiếng mẹ đẻ.',
    description:
      'METTA Kiddies dành cho trẻ 3-6 tuổi, tập trung vào nghe nói, phát âm, phản xạ tự nhiên và sự tự tin. Trẻ học qua âm nhạc, vận động, trò chơi, câu chuyện, CLIL và trải nghiệm đa giác quan.',
    highlights: [
      '3E Method: Engage -> Explore -> Excel qua âm nhạc và vận động',
      'Giáo trình Super Safari Cambridge kết hợp Oxford Phonics World',
      'Học đa giác quan: nghe, nhìn, chạm và vận động trong mỗi buổi học',
      'CLIL giúp trẻ phát triển tư duy logic và sáng tạo song song',
    ],
    methodology: ['3E Method', 'Learning through play', 'CLIL', 'Multi-sensory', 'Music & movement'],
    outcomes: [
      'Phản xạ tiếng Anh tự nhiên trong tình huống quen thuộc',
      'Phát âm chuẩn và quen với ngữ điệu tiếng Anh từ sớm',
      'Tự tin giao tiếp, tham gia hoạt động nhóm và thể hiện bản thân',
      'Có nền tảng sẵn sàng bước vào tiếng Anh tiểu học',
    ],
    roadmap: [
      'Làm quen âm thanh, nhịp điệu và từ vựng qua bài hát, hình ảnh',
      'Tương tác bằng câu ngắn, phản hồi qua trò chơi và vận động',
      'Kể chuyện, đóng vai, hoạt động sáng tạo theo chủ đề',
      'Đánh giá phản xạ nghe nói và tư vấn lộ trình tiếp theo',
    ],
  },
  {
    slug: 'metta-on-phonics',
    programTemplate: 'course',
    courseName: 'Tiểu học sớm · Early Primary',
    title: 'METTA on Phonics',
    eyebrow: 'Đánh vần chuẩn bản xứ',
    ageRange: '5-7 tuổi',
    duration: '90 phút/buổi · 2 buổi/tuần · 5 cấp độ',
    dealSize: DEFAULT_COURSE_DEAL_SIZE,
    dealCurrency: DEFAULT_DEAL_CURRENCY,
    image: '/brand/workshop-pattern.jpg',
    summary: 'Giải mã ngôn ngữ thay vì học vẹt, giúp trẻ tự đọc truyện tiếng Anh độc lập từ cấp 1.',
    description:
      'METTA on Phonics xây dựng nền tảng phát âm, đọc và viết chính tả qua Oxford Phonics World, giúp trẻ hiểu mối liên hệ giữa âm thanh và ký tự để đọc từ mới một cách độc lập.',
    highlights: [
      'Oxford Phonics World với hơn 150 quy tắc phát âm',
      'Học qua trò chơi, bài hát, câu đố và hoạt hình sinh động',
      'Kích hoạt 4 giác quan: nghe, nhìn, chạm và vận động',
      'Rèn tư duy phân tích logic giữa âm thanh và chữ cái',
    ],
    methodology: ['Oxford Phonics World', 'Blending', 'Segmenting', 'Songs & chants', 'Decoding rules'],
    outcomes: [
      'Đọc độc lập các từ và câu tiếng Anh phù hợp trình độ',
      'Viết chính tả tốt hơn nhờ liên kết âm và chữ',
      'Phát âm rõ, đúng âm và ngữ điệu tự nhiên hơn',
      'Có nền tảng đọc viết vững chắc cho bậc tiểu học',
    ],
    roadmap: [
      'Level 1: Letter sounds và short vowels',
      'Level 2: Consonant blends và short vowel words',
      'Level 3: Long vowels và vowel combinations',
      'Level 4-5: Advanced phonics, reading fluency và spelling confidence',
    ],
  },
  {
    slug: 'metta-young-learner',
    programTemplate: 'course',
    courseName: 'Tiểu học · Primary',
    title: 'METTA Young Learner',
    eyebrow: 'Tiếng Anh thế hệ mới',
    ageRange: '6-12 tuổi',
    duration: '108 giờ/cấp · 72 buổi/level · 10-13 học viên/lớp',
    dealSize: DEFAULT_COURSE_DEAL_SIZE,
    dealCurrency: DEFAULT_DEAL_CURRENCY,
    image: '/brand/brand-banner.jpg',
    summary: 'Không chỉ giỏi tiếng Anh, học sinh phát triển tư duy, kỹ năng thế kỷ 21 và bản lĩnh toàn cầu.',
    description:
      'METTA Young Learner dành cho học sinh 6-12 tuổi, kết hợp 3E, STEAM, project-based learning và lộ trình Cambridge Starters - Movers - Flyers để phát triển toàn diện 4 kỹ năng.',
    highlights: [
      '3E kết hợp STEAM qua dự án thực tế Discovery Education',
      'Project-based Learning: mỗi tiết học là một nhiệm vụ ứng dụng',
      'Metta 5 Skills: Social, Physical, Intellectual, Creative, Emotional',
      'Mục tiêu Cambridge Starters -> Movers -> Flyers',
    ],
    methodology: ['3E + STEAM', 'Project-based', 'Discovery Education', 'Cambridge pathway', 'Metta 5 Skills'],
    outcomes: [
      'Phát triển năng lực nghe, nói, đọc, viết theo chuẩn quốc tế',
      'Tự tin thuyết trình, làm việc nhóm và trình bày ý tưởng',
      'Sẵn sàng cho chứng chỉ Cambridge phù hợp độ tuổi',
      'Có nền tảng học thuật để chuyển tiếp lên IELTS Junior',
    ],
    roadmap: [
      'Starter: xây nền từ vựng, phản xạ nghe nói và thói quen học',
      'Starters: luyện kỹ năng theo định dạng Cambridge Pre A1',
      'Movers: mở rộng chủ đề, cấu trúc câu và giao tiếp dự án',
      'Flyers: tăng năng lực học thuật, thuyết trình và tư duy phản biện',
    ],
  },
  {
    slug: 'ielts-junior',
    programTemplate: 'course',
    courseName: 'THCS · Secondary',
    title: 'IELTS Junior',
    eyebrow: 'Khởi đầu vững chắc từ cấp 2',
    ageRange: '11-15 tuổi',
    duration: 'IELTS 1.5 -> 3.0+ · 10-12 học viên/lớp · cam kết đầu ra',
    dealSize: DEFAULT_COURSE_DEAL_SIZE,
    dealCurrency: DEFAULT_DEAL_CURRENCY,
    image: '/brand/hero-classroom.png',
    summary: 'IELTS đang là tiêu chuẩn mới; bắt đầu từ cấp 2 giúp học sinh có lợi thế cạnh tranh thực sự.',
    description:
      'IELTS Junior giúp học sinh THCS xây nền học thuật, mở rộng vốn từ theo chủ đề, luyện tư duy bài thi và phát triển kỹ năng đọc, nghe, nói, viết theo lộ trình phù hợp độ tuổi.',
    highlights: [
      'AI-powered learning: chữa bài nhanh và luyện đề qua app',
      'CLIL: học tiếng Anh qua khoa học và đời sống thực tế',
      '150+ video Knowledge Chunking ngắn, dễ ôn tập',
      'Cam kết đầu ra bằng văn bản, lớp nhỏ 10-12 học viên',
    ],
    methodology: ['AI-powered', 'CLIL', 'Knowledge Chunking', 'IELTS skills', 'Small class'],
    outcomes: [
      'Xây nền IELTS từ sớm với mục tiêu 1.5 đến 3.0+',
      'Tăng lợi thế xét tuyển lớp 10 và định hướng học thuật',
      'Phát triển kỹ năng viết, nói và tư duy lập luận rõ ràng',
      'Chuẩn bị nền tảng săn học bổng và hội nhập quốc tế',
    ],
    roadmap: [
      'Foundation: củng cố từ vựng, ngữ pháp và phát âm học thuật',
      'Skills: luyện đọc, nghe, nói, viết theo chủ đề quen thuộc',
      'Practice: làm quen format IELTS và chiến lược từng dạng bài',
      'Review: đánh giá tiến bộ, chỉnh lỗi cá nhân và định hướng band tiếp theo',
    ],
  },
  {
    slug: 'metta-summer-2026',
    programTemplate: 'skills',
    courseName: 'Summer Camp · Đa bộ môn',
    title: 'METTA Summer 2026',
    seoTitle: 'METTA Summer 2026 | Chương trình hè cho trẻ 4–11 tuổi',
    seoDescription: 'METTA Summer 2026 là chương trình hè đa bộ môn cho trẻ 4–11 tuổi với Mỹ thuật, Cờ vua, Thanh nhạc, Nhảy & Múa, kéo dài 6 tuần và có Showcase cuối khóa.',
    eyebrow: 'Chương trình hè đa bộ môn',
    ageRange: '4–11 tuổi',
    duration: '6 tuần · 24 buổi · 1h30/buổi',
    dealSize: 1999000,
    dealCurrency: DEFAULT_DEAL_CURRENCY,
    image: SUMMER_HERO_IMAGE,
    images: [
      SUMMER_HERO_IMAGE,
      'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=1200&q=85&auto=format&fit=crop',
      'https://images.unsplash.com/photo-1547153760-18fc86324498?w=1200&q=85&auto=format&fit=crop',
    ],
    summary: 'Chương trình hè trải nghiệm đa bộ môn cho trẻ 4–11 tuổi, giúp con khám phá năng khiếu qua Mỹ thuật, Cờ vua, Thanh nhạc, Nhảy & Múa.',
    description:
      'Một mùa hè để con khám phá năng khiếu, rèn kỹ năng và tự tin tỏa sáng qua 4 bộ môn: Mỹ thuật, Cờ vua, Thanh nhạc, Nhảy & Múa.',
    highlights: [
      '4 bộ môn trong 6 tuần: Mỹ thuật, Cờ vua, Thanh nhạc, Nhảy & Múa',
      '24 buổi học, mỗi buổi 1h30 với hoạt động phù hợp độ tuổi 4–11',
      'Lộ trình 3 giai đoạn: Khám phá, Phát triển và Hoàn thiện',
      'METTA Summer Showcase 2026 cuối khóa cùng phụ huynh',
    ],
    highlightCards: [
      { icon: 'Sparkles', color: '#F45A0A', title: '4 bộ môn', description: 'Mỹ thuật, Cờ vua, Thanh nhạc, Nhảy & Múa' },
      { icon: 'Clock', color: '#16A9D8', title: '6 tuần', description: '24 buổi, mỗi buổi 1h30' },
      { icon: 'Users', color: '#16A34A', title: '4–11 tuổi', description: 'Chia nhóm mầm non và tiểu học' },
      { icon: 'Trophy', color: '#F59E0B', title: 'Showcase', description: 'Triển lãm, biểu diễn và chứng nhận cuối khóa' },
    ],
    methodology: ['Art-based learning', 'Chess thinking', 'Music & voice', 'Dance movement', 'Showcase project'],
    outcomes: [
      'Có tranh cá nhân và sản phẩm thủ công sáng tạo',
      'Biết luật chơi và chiến thuật cờ vua cơ bản',
      'Biểu diễn ít nhất một bài hát hoặc tiết mục nhóm',
      'Tham gia một bài nhảy hoặc múa hoàn chỉnh',
      'Tự tin hơn khi đứng trước tập thể',
      'Nhận chứng nhận hoàn thành chương trình',
      'Tham gia METTA Summer Showcase 2026 cùng phụ huynh',
    ],
    outcomeCards: [
      { icon: 'Sparkles', color: '#F45A0A', title: 'Sản phẩm sáng tạo', description: 'Tranh cá nhân và sản phẩm thủ công' },
      { icon: 'Brain', color: '#003B7A', title: 'Tư duy chiến thuật', description: 'Luật chơi và chiến thuật cờ vua cơ bản' },
      { icon: 'Mic', color: '#8B5CF6', title: 'Tự tin biểu diễn', description: 'Hát nhóm, nhảy múa và trình diễn trước tập thể' },
      { icon: 'Trophy', color: '#16A34A', title: 'Chứng nhận', description: 'Hoàn thành chương trình và tham gia Showcase' },
    ],
    roadmap: [
      'Tuần 1–2: Khám phá chất liệu, bàn cờ, giọng hát và nhịp điệu cơ bản',
      'Tuần 3–4: Phát triển kỹ thuật, luyện sản phẩm và phối hợp nhóm',
      'Tuần 5–6: Hoàn thiện tiết mục, sản phẩm và chuẩn bị Showcase cuối khóa',
    ],
    roadmapCards: [
      { label: 'Tuần 1–2', title: 'Khám phá', description: 'Con làm quen chất liệu, luật chơi, giọng hát và chuyển động cơ bản.', color: '#16A9D8' },
      { label: 'Tuần 3–4', title: 'Phát triển', description: 'Con luyện kỹ thuật, hoàn thiện sản phẩm nhỏ và tăng khả năng phối hợp nhóm.', color: '#F45A0A' },
      { label: 'Tuần 5–6', title: 'Hoàn thiện', description: 'Con chuẩn bị tiết mục, sản phẩm và tâm thế tham gia METTA Summer Showcase 2026.', color: '#16A34A' },
    ],
    skills: [
      { name: 'Social', label: 'Xã hội', description: 'Hợp tác trong hoạt động nhóm, biết chia sẻ vai trò và cổ vũ bạn bè.', color: '#16A9D8' },
      { name: 'Physical', label: 'Vận động', description: 'Rèn nhịp điệu, sự phối hợp cơ thể và khả năng trình diễn.', color: '#F45A0A' },
      { name: 'Intellectual', label: 'Tư duy', description: 'Quan sát, lập kế hoạch và ra quyết định qua cờ vua.', color: '#003B7A' },
      { name: 'Creative', label: 'Sáng tạo', description: 'Thể hiện ý tưởng qua màu sắc, hình khối, âm nhạc và chuyển động.', color: '#8B5CF6' },
      { name: 'Emotional', label: 'Cảm xúc', description: 'Tự tin thể hiện bản thân và cảm nhận niềm vui học tập trong mùa hè.', color: '#16A34A' },
    ],
  },
] as const;

type ProgramDealSource = {
  slug?: string;
  title?: string;
  courseName?: string;
  dealSize?: number | string | null;
};

export function defaultCourseDealSizeForProgram(program?: ProgramDealSource | null) {
  const matched = program
    ? PUBLIC_PROGRAMS.find((item) => (
      item.slug === program.slug
      || item.title === program.title
      || item.courseName === program.courseName
    ))
    : undefined;
  const parsed = Number(matched?.dealSize);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_COURSE_DEAL_SIZE;
}

export function resolveCourseDealSizeForProgram(program?: ProgramDealSource | null) {
  const parsed = Number(program?.dealSize);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultCourseDealSizeForProgram(program);
}

/* ── Nội dung mặc định cho trang Summer (dùng chung cho web + CMS editor) ── */
export const SUMMER_DEFAULTS = {
  subtitle: 'Chương trình hè trải nghiệm đa bộ môn cho trẻ 4–11 tuổi',
  chips: ['4–11 tuổi', '6 tuần', '24 buổi', '4 bộ môn', 'Showcase cuối khóa'] as string[],
  heroStats: [
    { value: '6', label: 'tuần', color: '#F45A0A' },
    { value: '24', label: 'buổi', color: '#003B7A' },
    { value: '4', label: 'bộ môn', color: '#16A34A' },
  ] as SummerStat[],
  sectionVisibility: {
    hero: true,
    overview: true,
    audience: true,
    modules: true,
    roadmap: true,
    outcomes: true,
    showcase: true,
    classInfo: true,
    gallery: true,
    cta: true,
    leadForm: true,
  } as SummerSectionVisibility,
  overviewEyebrow: 'Tổng quan chương trình',
  overviewTitle: 'Một mùa hè để con khám phá, phát triển và tỏa sáng',
  overviewBody:
    'METTA Summer 2026 là chương trình hè đa bộ môn dành cho trẻ mầm non và tiểu học. Trong 6 tuần, học viên được trải nghiệm nghệ thuật, tư duy, âm nhạc và vận động thông qua các hoạt động phù hợp với lứa tuổi.',
  audienceTitle: 'Chương trình phù hợp với ai?',
  audience: [
    {
      title: 'Nhóm mầm non 4–6 tuổi',
      description: 'Hoạt động nhiều hình ảnh, âm nhạc, vận động và sản phẩm thủ công nhỏ để con làm quen nhẹ nhàng, vui vẻ và tự tin tham gia cùng bạn.',
    },
    {
      title: 'Nhóm tiểu học 6–11 tuổi',
      description: 'Tăng dần thử thách về kỹ thuật, tư duy chiến thuật, trình diễn nhóm và hoàn thiện sản phẩm cho Showcase cuối khóa.',
    },
  ] as SummerAudienceItem[],
  modulesEyebrow: '4 bộ môn',
  modulesTitle: '4 bộ môn trong chương trình',
  modules: [
    { icon: 'Sparkles', color: '#F45A0A', title: 'Mỹ thuật', tag: 'Mỹ thuật', description: 'Màu sắc, hình khối, tranh mùa hè và sản phẩm thủ công giúp con thể hiện ý tưởng bằng chất liệu trực quan.', image: SUMMER_HERO_IMAGE },
    { icon: 'Brain', color: '#003B7A', title: 'Cờ vua', tag: 'Cờ vua', description: 'Làm quen bàn cờ, quân cờ, luật chơi, chiến thuật cơ bản và mini tournament phù hợp độ tuổi.', image: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=1200&q=85&auto=format&fit=crop' },
    { icon: 'Mic', color: '#8B5CF6', title: 'Thanh nhạc', tag: 'Thanh nhạc', description: 'Cảm thụ âm nhạc, luyện hơi, hát nhóm và chuẩn bị tiết mục biểu diễn tự tin trước tập thể.', image: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=1200&q=85&auto=format&fit=crop' },
    { icon: 'Music', color: '#16A34A', title: 'Nhảy & Múa', tag: 'Nhảy & Múa', description: 'Rèn nhịp điệu, động tác cơ bản, phối hợp đội hình và trình diễn nhóm trong Showcase.', image: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=1200&q=85&auto=format&fit=crop' },
  ] as SummerModule[],
  roadmapEyebrow: 'Lộ trình học',
  roadmapTitle: 'Lộ trình học 6 tuần',
  stages: [
    { label: 'Tuần 1–2', title: 'Khám phá', description: 'Con làm quen chất liệu, bàn cờ, giọng hát và nhịp điệu cơ bản qua hoạt động nhẹ nhàng.', color: '#16A9D8' },
    { label: 'Tuần 3–4', title: 'Phát triển', description: 'Con luyện kỹ thuật, hoàn thiện bài tập nhỏ và bắt đầu phối hợp với nhóm.', color: '#F45A0A' },
    { label: 'Tuần 5–6', title: 'Hoàn thiện', description: 'Con chỉnh sửa sản phẩm, ráp tiết mục và chuẩn bị tâm thế cho Showcase cuối khóa.', color: '#16A34A' },
  ] as RoadmapCard[],
  weeklyColumns: ['Tuần', 'Mỹ thuật', 'Cờ vua', 'Thanh nhạc', 'Nhảy & Múa'] as string[],
  weeklyPlan: [
    ['Tuần 1', 'Làm quen màu sắc, hình khối và chất liệu mùa hè', 'Nhận biết bàn cờ, quân cờ và cách di chuyển cơ bản', 'Cảm thụ giai điệu, tư thế hát và luyện hơi nhẹ', 'Nhịp điệu cơ bản, làm quen chuyển động theo nhạc'],
    ['Tuần 2', 'Vẽ tranh chủ đề mùa hè và hoàn thiện sản phẩm nhỏ', 'Luật chơi, cách bảo vệ quân và bài tập quan sát', 'Hát nhóm, giữ nhịp và phát âm lời bài hát rõ ràng', 'Động tác tay chân cơ bản và phối hợp theo nhóm'],
    ['Tuần 3', 'Thủ công sáng tạo, phối màu và bố cục đơn giản', 'Chiến thuật khai cuộc đơn giản và tình huống mini', 'Luyện câu hát, biểu cảm và nghe bạn trong nhóm', 'Tổ hợp động tác ngắn và ghi nhớ đội hình'],
    ['Tuần 4', 'Dự án tranh cá nhân hoặc sản phẩm thủ công nâng cao', 'Mini game, xử lý nước đi và rèn tinh thần fair-play', 'Chọn tiết mục, luyện đoạn biểu diễn chính', 'Ráp bài nhóm, nhịp chuyển đoạn và tương tác sân khấu'],
    ['Tuần 5', 'Hoàn thiện sản phẩm trưng bày và đặt tên tác phẩm', 'Luyện mini tournament và cách bắt tay sau ván đấu', 'Tổng duyệt tiết mục hát nhóm hoặc cá nhân', 'Tổng duyệt bài nhảy/múa và biểu cảm trình diễn'],
    ['Tuần 6', 'Chuẩn bị góc triển lãm và chia sẻ về sản phẩm', 'Giải cờ vua mini trong không khí vui vẻ', 'Biểu diễn trong METTA Summer Showcase 2026', 'Trình diễn nhóm, nhận chứng nhận và chụp ảnh cùng phụ huynh'],
  ] as string[][],
  outcomesTitle: 'Sau 6 tuần, con có gì?',
  outcomes: [
    'Có tranh cá nhân và sản phẩm thủ công sáng tạo.',
    'Biết luật chơi và chiến thuật cờ vua cơ bản.',
    'Biểu diễn ít nhất một bài hát hoặc tiết mục nhóm.',
    'Tham gia một bài nhảy/múa hoàn chỉnh.',
    'Tự tin hơn khi đứng trước tập thể.',
    'Nhận chứng nhận hoàn thành chương trình.',
    'Tham gia METTA Summer Showcase 2026 cùng phụ huynh.',
  ] as string[],
  showcaseEyebrow: 'Điểm nhấn cuối khóa',
  showcaseTitle: 'METTA Summer Showcase 2026',
  showcaseBody:
    'Cuối khóa, học viên tham gia triển lãm sản phẩm mỹ thuật, giải cờ vua mini, biểu diễn thanh nhạc, nhảy múa, trao chứng nhận và chụp ảnh cùng phụ huynh.',
  showcaseImage: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1200&q=85&auto=format&fit=crop',
  showcaseImages: [
    { src: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1200&q=85&auto=format&fit=crop', title: 'METTA Summer Showcase 2026', alt: 'Học viên tham gia hoạt động showcase cuối khóa' },
    { src: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=1200&q=85&auto=format&fit=crop', title: 'Art Exhibition', alt: 'Triển lãm sản phẩm mỹ thuật của học viên' },
    { src: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=1200&q=85&auto=format&fit=crop', title: 'Chess Mini Tournament', alt: 'Giải cờ vua mini trong showcase cuối khóa' },
    { src: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=1200&q=85&auto=format&fit=crop', title: 'Dance Showcase', alt: 'Học viên biểu diễn nhảy múa trong showcase' },
  ] as SummerGalleryImage[],
  showcaseItems: [
    { icon: 'Sparkles', title: 'Art Exhibition', description: 'Trưng bày tranh và sản phẩm thủ công của học viên.' },
    { icon: 'Brain', title: 'Chess Mini Tournament', description: 'Không gian thi đấu nhỏ, vui vẻ và khích lệ tinh thần chiến thuật.' },
    { icon: 'Mic', title: 'Music Performance', description: 'Tiết mục thanh nhạc cá nhân hoặc nhóm trước phụ huynh.' },
    { icon: 'Music', title: 'Dance Showcase', description: 'Bài nhảy/múa hoàn chỉnh với đội hình và biểu cảm sân khấu.' },
  ] as SummerShowcaseItem[],
  classInfoTitle: 'Thông tin lớp học',
  classInfoBody: 'Thông tin chính để phụ huynh nắm nhanh lịch học, độ tuổi, học phí và bộ môn trong chương trình.',
  classInfo: [
    { label: 'Tên chương trình', value: 'METTA Summer 2026' },
    { label: 'Độ tuổi', value: '4–11 tuổi' },
    { label: 'Thời lượng', value: '6 tuần' },
    { label: 'Tổng số buổi', value: '24 buổi' },
    { label: 'Lịch học', value: 'Thứ 2 · Thứ 4 · Thứ 6 · Chủ nhật' },
    { label: 'Mỗi buổi', value: '1h30' },
    { label: 'Học phí', value: '1.999.000đ / trọn khóa' },
    { label: 'Bộ môn', value: 'Mỹ thuật · Cờ vua · Thanh nhạc · Nhảy & Múa' },
  ] as SummerClassInfoRow[],
  galleryTitle: 'Hình ảnh hoạt động',
  gallery: [
    { src: 'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&q=85&auto=format&fit=crop', title: 'Mỹ thuật & thủ công', alt: 'Trẻ học vẽ và thực hành mỹ thuật' },
    { src: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=800&q=85&auto=format&fit=crop', title: 'Cờ vua', alt: 'Bàn cờ vua và hoạt động tư duy chiến thuật' },
    { src: 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=800&q=85&auto=format&fit=crop', title: 'Thanh nhạc', alt: 'Hoạt động âm nhạc và luyện hát' },
    { src: 'https://images.unsplash.com/photo-1547153760-18fc86324498?w=800&q=85&auto=format&fit=crop', title: 'Nhảy & Múa', alt: 'Hoạt động nhảy múa và trình diễn nhóm' },
  ] as SummerGalleryImage[],
  ctaTitle: 'Sẵn sàng cho con một mùa hè đáng nhớ tại METTA?',
  ctaBody: 'Để lại thông tin để METTA tư vấn lịch học, độ tuổi phù hợp và hướng dẫn đăng ký ngay cho con.',
};

export const DEAL_QUOTED_STATUS = 'Đã báo phí/Chờ chốt';
export const WON_LEAD_STATUS = 'Đã đăng ký học';
export const LOST_LEAD_STATUS = 'Mất lead';
export const discountPercentOptions = [5, 10, 15, 20, 25, 30] as const;
export const courseDealSizeDefaults = [
  { courseName: 'METTA Kiddies', dealSize: DEFAULT_COURSE_DEAL_SIZE },
  { courseName: 'METTA on Phonics', dealSize: DEFAULT_COURSE_DEAL_SIZE },
  { courseName: 'METTA Young Learner', dealSize: DEFAULT_COURSE_DEAL_SIZE },
  { courseName: 'IELTS Junior', dealSize: DEFAULT_COURSE_DEAL_SIZE },
  { courseName: 'METTA Summer 2026', dealSize: 1999000 },
] as const;

export const pendingReasonOptions = [
  {
    reason: 'Đã hẹn chuyển khoản / giữ chỗ',
    warmthPercent: 90,
    defaultNote: 'Phụ huynh đã xác nhận đăng ký, đang chờ chuyển khoản hoặc giữ chỗ. Sales cần follow sát trong ngày.',
  },
  {
    reason: 'Đồng ý học, chờ xác nhận lịch khai giảng',
    warmthPercent: 85,
    defaultNote: 'Phụ huynh đồng ý học, còn chờ xác nhận lớp/ca học phù hợp trước khi thanh toán.',
  },
  {
    reason: 'Chờ ưu đãi / chính sách thanh toán',
    warmthPercent: 70,
    defaultNote: 'Phụ huynh quan tâm nhưng đang chờ thông tin ưu đãi, chia đợt thanh toán hoặc chính sách học phí.',
  },
  {
    reason: 'Cần trao đổi thêm với người quyết định học phí',
    warmthPercent: 60,
    defaultNote: 'Người trao đổi chưa phải người ra quyết định cuối cùng. Cần hẹn thời điểm gọi lại với người quyết định.',
  },
  {
    reason: 'Cần tư vấn thêm lộ trình / level / đầu ra',
    warmthPercent: 55,
    defaultNote: 'Phụ huynh còn cần làm rõ lộ trình học, level phù hợp, mục tiêu đầu ra hoặc cam kết chương trình.',
  },
  {
    reason: 'Đang so sánh với trung tâm khác',
    warmthPercent: 40,
    defaultNote: 'Phụ huynh đang so sánh học phí, lịch học, cam kết và trải nghiệm với trung tâm khác.',
  },
  {
    reason: 'Lịch học chưa phù hợp, chờ ca/lớp mới',
    warmthPercent: 35,
    defaultNote: 'Nhu cầu học có thật nhưng lịch hiện tại chưa phù hợp. Cần ghi rõ khung giờ mong muốn.',
  },
  {
    reason: 'Học phí vượt ngân sách, đang cân nhắc',
    warmthPercent: 25,
    defaultNote: 'Phụ huynh quan tâm nhưng đang cân nhắc ngân sách. Cần ghi rõ mức học phí/gói học đã báo.',
  },
  {
    reason: 'Chưa phản hồi sau khi báo phí',
    warmthPercent: 20,
    defaultNote: 'Đã gửi báo phí nhưng phụ huynh chưa phản hồi. Cần follow-up bằng kênh phù hợp và ghi lịch gọi lại.',
  },
  {
    reason: 'Hơi xa, đang cân nhắc',
    warmthPercent: 10,
    defaultNote: 'Phụ huynh thấy vị trí trung tâm chưa thuận tiện. Cần ghi rõ khu vực nhà/trường và phương án ca học.',
  },
  {
    reason: 'Chưa có nhu cầu học ngay',
    warmthPercent: 10,
    defaultNote: 'Phụ huynh chưa muốn đăng ký ngay, cần lưu mốc follow-up dài hạn và lý do trì hoãn.',
  },
] as const;

export const leadStatuses = [
  'Lead mới',
  'Đã liên hệ',
  'Chưa nghe máy',
  'Đã hẹn tư vấn',
  'Đã tư vấn/Đặt lịch test',
  'Đã test/Học thử',
  DEAL_QUOTED_STATUS,
  WON_LEAD_STATUS,
  LOST_LEAD_STATUS,
] as const;

export const lostReasons = [
  'Không liên lạc được sau nhiều lần gọi',
  'Sai số / số không tồn tại',
  'Phụ huynh từ chối, không có nhu cầu học',
  'Học phí vượt ngân sách',
  'Lịch học không phù hợp',
  'Địa điểm xa / di chuyển bất tiện',
  'Chọn trung tâm hoặc đối thủ khác',
  'Học viên chưa đúng độ tuổi / chưa phù hợp chương trình',
  'Chưa sẵn sàng, hẹn liên hệ lại dài hạn',
  'Trùng lead / data không hợp lệ',
  'Khác',
] as const;

export const defaultLeadSourceConfigs = [
  { name: 'Meta Lead Form', priorityLevel: 5, description: 'Lead để lại form trực tiếp trên Meta, intent cao và cần xử lý nhanh.' },
  { name: 'Meta Ads', priorityLevel: 4, description: 'Lead đến từ chiến dịch quảng cáo Meta nhưng không nhất thiết là form native.' },
  { name: 'Website', priorityLevel: 4, description: 'Lead gửi từ website METTA Academy hoặc landing page nội bộ.' },
  { name: 'Sales input', priorityLevel: 3, description: 'Lead do sales nhập thủ công từ cuộc gọi, inbox hoặc nguồn offline.' },
  { name: 'Zalo OA', priorityLevel: 4, description: 'Lead từ Zalo Official Account.' },
  { name: 'Referral', priorityLevel: 5, description: 'Giới thiệu từ phụ huynh/học viên hiện hữu.' },
  { name: 'Google Ads', priorityLevel: 4, description: 'Lead từ quảng cáo Google Search/Display.' },
  { name: 'Landing Page', priorityLevel: 4, description: 'Lead từ landing page chiến dịch.' },
  { name: 'Facebook Ads', priorityLevel: 4, description: 'Nguồn cũ, giữ để tương thích dữ liệu hiện tại.' },
  { name: 'Instagram Ads', priorityLevel: 3, description: 'Nguồn cũ, giữ để tương thích dữ liệu hiện tại.' },
  { name: 'TikTok Ads', priorityLevel: 3, description: 'Nguồn cũ, giữ để tương thích dữ liệu hiện tại.' },
  { name: 'Zalo', priorityLevel: 3, description: 'Nguồn Zalo cũ, giữ để tương thích dữ liệu hiện tại.' },
  { name: 'Walk-in', priorityLevel: 3, description: 'Khách đến trực tiếp trung tâm.' },
  { name: 'Khác', priorityLevel: 1, description: 'Nguồn chưa phân loại.' },
] as const;

export const leadSources = defaultLeadSourceConfigs.map((source) => source.name);

export const defaultLeadCenterConfigs = [
  { name: 'METTA', address: 'G4 Bồ Hòa, Hà Đông, Hà Nội', description: 'Cơ sở đang hoạt động của METTA Academy.' },
] as const;

export const studentStatuses = ['Đang tư vấn', 'Đã đăng ký', 'Đang học', 'Tạm nghỉ', 'Bảo lưu', 'Hoàn thành khóa', 'Đã nghỉ'] as const;
export const classStatuses = ['Sắp khai giảng', 'Đang học', 'Tạm dừng', 'Đã hoàn thành', 'Đã hủy'] as const;
export const classStudentStatuses = ['Đang học', 'Bảo lưu', 'Chuyển lớp', 'Đã nghỉ', 'Hoàn thành'] as const;
export const sessionStatuses = ['Sắp diễn ra', 'Đã hoàn thành', 'Đã hủy', 'Học bù'] as const;
export const attendanceStatuses = ['Có mặt', 'Đi muộn', 'Nghỉ phép', 'Nghỉ không phép', 'Học bù'] as const;

export const roles = ['admin', 'manager', 'sales', 'ads', 'design'] as const;

export const capiEvents = ['PageView', 'ViewContent', 'Lead', 'CompleteRegistration', 'Contact', 'Custom'] as const;
