import type { PageSection } from '@/types/cms';

const CANONICAL_HOME_HERO = {
  subtitle: 'Giỏi ngoại ngữ, giàu kỹ năng, lãnh đạo tương lai',
  description:
    'Hành trình tiếng Anh toàn diện cho trẻ 3-15 tuổi.\n100% Giáo viên nước ngoài có chứng chỉ quốc tế (TESOL/CELTA)\nLớp học nhỏ 10-12 học viên và lộ trình cá nhân hóa theo từng độ tuổi.',
  buttonText: 'Đăng ký tư vấn miễn phí',
  button2Text: 'Xem chương trình học',
};

const CANONICAL_HOME_BENEFITS = {
  title: 'Tại sao ba mẹ chọn METTA Academy?',
  subtitle: 'Hơn 10 năm kiến tạo tương lai thế hệ trẻ',
  description: '',
  extraData: JSON.stringify([
    { icon: 'school', color: '#F45A0A', title: 'Giáo trình chuẩn quốc tế Oxford & Cambridge' },
    { icon: 'verified', color: '#16A34A', title: '100% Giáo viên bản ngữ & CELTA/TESOL' },
    { icon: 'groups', color: '#8B5CF6', title: 'Lớp học sĩ số nhỏ tối đa 12-15 học viên' },
    { icon: 'psychology', color: '#F59E0B', title: 'Phương pháp tư duy phản biện' },
    { icon: 'workspace_premium', color: '#16A9D8', title: 'Cơ sở hiện đại 5 sao tiêu chuẩn quốc tế' },
    { icon: 'monitoring', color: '#EC4899', title: 'Báo cáo tiến độ định kỳ cho phụ huynh' },
  ]),
};

const CANONICAL_HOME_COURSES = {
  title: 'Chương trình đào tạo',
  subtitle: 'Lộ trình cá nhân hóa cho từng độ tuổi',
  description:
    'Ba chương trình trọng tâm thiết kế theo chuẩn Cambridge & Oxford, phù hợp từng giai đoạn phát triển của trẻ.',
};

const CANONICAL_HOME_TESTIMONIALS = {
  title: 'Phụ huynh & học viên nói gì về METTA?',
  subtitle: 'Hơn 5.000 gia đình đã tin tưởng lựa chọn',
  extraData: JSON.stringify([
    {
      name: 'Chị Nguyễn Thanh Hà',
      role: 'Phụ huynh bé Bảo An • Lớp Kiddies',
      quote:
        'Sau 6 tháng học tại METTA, con tôi đã tự tin giao tiếp với người nước ngoài. Phương pháp giảng dạy rất phù hợp với độ tuổi của con và giáo viên cực kỳ tận tâm.',
      avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&q=80&auto=format&fit=crop',
    },
    {
      name: 'Anh Trần Văn Minh',
      role: 'Phụ huynh bé Gia Bảo • Lớp Young Learners',
      quote:
        'METTA không chỉ dạy tiếng Anh mà còn giúp con học được kỹ năng tư duy và thuyết trình. Con tiến bộ rõ rệt chỉ sau 3 tháng, ngữ pháp và phát âm đều tốt hơn hẳn.',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&q=80&auto=format&fit=crop',
    },
    {
      name: 'Chị Lê Thu Hương',
      role: 'Phụ huynh bé Khánh Vy • Lớp Phonics',
      quote:
        'Con tôi từ không biết gì về phonics, giờ đã tự đọc được sách tiếng Anh! Giáo viên METTA dạy rất kiên nhẫn và có phương pháp riêng giúp trẻ tiếp thu nhanh.',
      avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=80&q=80&auto=format&fit=crop',
    },
  ]),
};

const CANONICAL_HOME_NEWS = {
  title: 'Tin tức & Sự kiện',
  subtitle: 'Cập nhật mới nhất từ METTA Academy',
  extraData: JSON.stringify([
    {
      title: 'Khai giảng lớp IELTS Foundation tháng 6/2026',
      date: '01/06/2026',
      category: 'Tin tức',
      image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=600&q=80&auto=format&fit=crop',
      excerpt:
        'METTA Academy chính thức mở đăng ký lớp IELTS Foundation dành cho học sinh THCS và THPT, khai giảng ngày 01/06/2026.',
    },
    {
      title: 'Workshop tiếng Anh hè 2026 - Trải nghiệm thú vị cho bé',
      date: '20/05/2026',
      category: 'Sự kiện',
      image: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&q=80&auto=format&fit=crop',
      excerpt:
        'Chương trình hè đặc biệt với các hoạt động sáng tạo, STEM và English Camp dành cho trẻ 6-15 tuổi trong hè 2026.',
    },
    {
      title: 'METTA tham dự Hội thảo Giáo dục Quốc tế SEAMEO 2026',
      date: '10/05/2026',
      category: 'Thành tích',
      image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=600&q=80&auto=format&fit=crop',
      excerpt:
        'Đại diện METTA Academy trình bày tham luận về ứng dụng AI trong giáo dục ngôn ngữ tại hội thảo SEAMEO 2026.',
    },
  ]),
};

const MISSING_FACILITY_PATHS = new Set([
  '/images/facilities/facility-1.jpg',
  '/images/facilities/facility-2.jpg',
  '/images/facilities/facility-3.jpg',
]);

const FACILITY_FALLBACK_IMAGES = [
  { src: '/brand/hero-classroom.png', title: '' },
  { src: '/brand/brand-banner.jpg', title: '' },
  { src: '/brand/workshop-kids.jpg', title: '' },
];

const FACILITY_ALTS = [
  'Phòng học hiện đại tại METTA Academy',
  'Tòa nhà METTA Academy',
  'Khu vực lễ tân METTA Academy',
];

function parseExtraArray(value?: string): Array<Record<string, unknown>> {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeFacilitySrc(item: Record<string, unknown>) {
  const value = item.src || item.url || item.image || item.fileUrl;
  return typeof value === 'string' ? value.trim() : '';
}

function isUsableFacilitySrc(src: string) {
  if (!src) return false;
  const path = src.split('?')[0];
  return !MISSING_FACILITY_PATHS.has(path);
}

function normalizeFacilityImages(extraData?: string) {
  const source = parseExtraArray(extraData);
  const customImages = source
    .map((item) => ({ ...item, src: normalizeFacilitySrc(item) }))
    .filter((item) => isUsableFacilitySrc(item.src));
  const images = customImages.length ? customImages : FACILITY_FALLBACK_IMAGES;
  return images.map((item, index) => ({
    ...item,
    alt: FACILITY_ALTS[index] || (typeof item.alt === 'string' ? item.alt : ''),
  }));
}

export function normalizeHomepageContentSection(section: PageSection): PageSection {
  if (section.pageId !== 'page-home') return section;

  switch (section.type) {
    case 'Hero':
      return { ...section, ...CANONICAL_HOME_HERO };
    case 'Benefits':
      return { ...section, ...CANONICAL_HOME_BENEFITS };
    case 'Courses':
      return { ...section, ...CANONICAL_HOME_COURSES };
    case 'Testimonials':
      return { ...section, ...CANONICAL_HOME_TESTIMONIALS };
    case 'News':
      return { ...section, ...CANONICAL_HOME_NEWS };
    case 'Facilities':
      return {
        ...section,
        title: 'Cơ sở vật chất tại METTA Academy',
        subtitle: 'Không gian học tập',
        description:
          'Không gian học tập hiện đại, chỉn chu và truyền cảm hứng, giúp học viên thoải mái phát triển mỗi ngày.',
        extraData: JSON.stringify(normalizeFacilityImages(section.extraData)),
      };
    case 'Lead Form':
      return { ...section, title: 'Đăng ký tư vấn miễn phí' };
    case 'CTA':
      return {
        ...section,
        title: 'Sẵn sàng để con tỏa sáng cùng METTA Academy?',
        subtitle: 'Đăng ký ngay để nhận bài kiểm tra năng lực MIỄN PHÍ và lộ trình học tập chuyên biệt cho bé.',
        buttonText: 'ĐĂNG KÝ TƯ VẤN NGAY',
      };
    default:
      return section;
  }
}
