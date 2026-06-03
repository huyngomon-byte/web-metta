export const BRAND = {
  name: 'METTA Academy',
  logo: '/brand/logo.png',
  banner: '/brand/brand-banner.jpg',
  primary: '#003B7A',
  secondary: '#1267AE',
  orange: '#F45A0A',
  cyan: '#16A9D8',
};

export const COURSE_OPTIONS = ['METTA Kiddies', 'METTA on Phonics', 'METTA Young Learner', 'IELTS Junior'] as const;
export const STAFF_OPTIONS = ['METTA Admin', 'Ms. Linh', 'Teacher An'] as const;

export const COURSES = [
  { name: 'METTA Kiddies', code: 'KIDDIES', ageRange: '3-6 tuổi', level: 'Preschool' },
  { name: 'METTA on Phonics', code: 'PHONICS', ageRange: '5-7 tuổi', level: 'Early Primary' },
  { name: 'METTA Young Learner', code: 'YOUNG-LEARNER', ageRange: '6-12 tuổi', level: 'Primary' },
  { name: 'IELTS Junior', code: 'IELTS-JUNIOR', ageRange: '11-15 tuổi', level: 'Secondary' },
] as const;

export const PUBLIC_PROGRAMS = [
  {
    slug: 'metta-kiddies',
    courseName: 'Mầm non · Preschool',
    title: 'METTA Kiddies',
    eyebrow: 'Giai đoạn vàng ngôn ngữ',
    ageRange: '3-6 tuổi',
    duration: '90 phút/buổi · 2 buổi/tuần · 96 buổi/level',
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
    courseName: 'Tiểu học sớm · Early Primary',
    title: 'METTA on Phonics',
    eyebrow: 'Đánh vần chuẩn bản xứ',
    ageRange: '5-7 tuổi',
    duration: '90 phút/buổi · 2 buổi/tuần · 5 cấp độ',
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
    courseName: 'Tiểu học · Primary',
    title: 'METTA Young Learner',
    eyebrow: 'Tiếng Anh thế hệ mới',
    ageRange: '6-12 tuổi',
    duration: '108 giờ/cấp · 72 buổi/level · 10-13 học viên/lớp',
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
    courseName: 'THCS · Secondary',
    title: 'IELTS Junior',
    eyebrow: 'Khởi đầu vững chắc từ cấp 2',
    ageRange: '11-15 tuổi',
    duration: 'IELTS 1.5 -> 3.0+ · 10-12 học viên/lớp · cam kết đầu ra',
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
] as const;

export const DEAL_QUOTED_STATUS = 'Đã báo phí/Chờ chốt';
export const WON_LEAD_STATUS = 'Đã đăng ký học';
export const LOST_LEAD_STATUS = 'Mất lead';
export const DEFAULT_DEAL_CURRENCY = 'VND';

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
  'Không liên lạc được',
  'Không phù hợp học phí',
  'Chưa sẵn sàng',
  'Chọn trung tâm khác',
  'Không phù hợp lịch học',
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

export const studentStatuses = ['Đang tư vấn', 'Đã đăng ký', 'Đang học', 'Tạm nghỉ', 'Bảo lưu', 'Hoàn thành khóa', 'Đã nghỉ'] as const;
export const classStatuses = ['Sắp khai giảng', 'Đang học', 'Tạm dừng', 'Đã hoàn thành', 'Đã hủy'] as const;
export const classStudentStatuses = ['Đang học', 'Bảo lưu', 'Chuyển lớp', 'Đã nghỉ', 'Hoàn thành'] as const;
export const sessionStatuses = ['Sắp diễn ra', 'Đã hoàn thành', 'Đã hủy', 'Học bù'] as const;
export const attendanceStatuses = ['Có mặt', 'Đi muộn', 'Nghỉ phép', 'Nghỉ không phép', 'Học bù'] as const;

export const roles = ['admin', 'manager', 'sales', 'ads', 'design'] as const;

export const capiEvents = ['PageView', 'ViewContent', 'Lead', 'CompleteRegistration', 'Contact', 'Custom'] as const;
