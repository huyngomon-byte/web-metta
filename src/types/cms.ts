export type PageStatus = 'draft' | 'published';
export type BlockType =
  | 'Hero'
  | 'Stats'
  | 'Benefits'
  | 'Courses'
  | 'Facilities'
  | 'Testimonials'
  | 'Teachers'
  | 'News'
  | 'Lead Form'
  | 'FAQ'
  | 'CTA'
  | 'About'
  | 'Contact'
  | 'Footer'
  // Landing "Sách tiền tiểu học" (ebook) — dùng cho trang landing-page-phonics
  | 'Ebook Hero'
  | 'Ebook Skills'
  | 'Ebook Why'
  | 'Metta+ Hero'
  | 'Metta+ Benefits'
  | 'Metta+ Age Clubs'
  | 'Metta+ Pass'
  | 'Metta+ Journey'
  | 'Metta+ Reasons'
  | 'Metta+ Form'
  | 'Metta+ Landing';

export interface HighlightCard {
  icon: string;        // Lucide icon name, e.g. "Music", "BookOpen"
  color: string;       // hex background color
  title: string;       // short bold title
  description: string; // subtitle / supporting text
}

export interface ProgramCms {
  slug: string;
  visible?: boolean;
  title: string;
  eyebrow: string;
  ageRange: string;
  duration: string;
  courseName: string;
  image: string;
  images?: string[]; // multiple hero images for slider
  summary: string;
  description: string;
  highlights: string[];
  highlightCards?: HighlightCard[]; // structured version with icon/color/title/desc
  highlightsEyebrow?: string;       // small chip text, e.g. "Điểm nổi bật"
  highlightsTitle?: string;         // main H2 title
  highlightsSubtitle?: string;      // small text under title
  outcomesEyebrow?: string;         // divider chip, e.g. "Kết quả đầu ra"
  methodology: string[];
  outcomes: string[];
  outcomeCards?: HighlightCard[];   // structured version with icon/color/title/desc
  roadmap: string[];
  roadmapCards?: RoadmapCard[];
  skills?: SkillPetal[];
}

export interface SkillPetal {
  name: string;       // e.g. "Social"
  label: string;      // e.g. "Xã hội"
  description: string;
  color: string;      // hex
}

export interface RoadmapCard {
  label: string;     // e.g. "Level 1", "Nền tảng"
  title: string;     // e.g. "Foundation"
  description: string;
  color: string;     // hex bg color
}

export interface SiteSettings {
  brandName: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  hotline: string;
  email: string;
  address: string;
  socials: Record<string, string>;
  footerText: string;
  headerLinks?: Array<{ label: string; href: string; children?: Array<{ label: string; href: string }> }>;
  headerCtaText?: string;
  headerCtaLink?: string;
  footerColumns?: Array<{
    title: string;
    links: Array<{ label: string; href: string }>;
  }>;
  programs?: ProgramCms[];
  /** Section Cơ sở vật chất trên trang chủ — gallery hình ảnh. */
  facilities?: FacilitySettings;
  /** Danh sách trang pháp lý (Chính sách, Điều khoản, FAQ pháp lý, v.v.) — admin có thể thêm/xóa/ẩn. */
  legalPages?: LegalPage[];
  /** @deprecated giữ lại cho backward-compat — nội dung cũ sẽ được migrate sang legalPages. */
  privacyPolicy?: string;
  /** @deprecated giữ lại cho backward-compat — nội dung cũ sẽ được migrate sang legalPages. */
  termsOfUse?: string;
  updatedAt: string;
}

export interface FacilityImage {
  src: string;
  alt: string;
  /** Caption hiển thị trên ảnh — để trống thì không hiện chữ. */
  title: string;
}

export interface FacilitySettings {
  /** Ẩn/hiện cả section trên trang chủ. Default true. */
  visible?: boolean;
  eyebrow?: string;
  title?: string;
  description?: string;
  images?: FacilityImage[];
}

export interface LegalPage {
  /** Slug URL (vd: "chinh-sach-bao-mat") — duy nhất. */
  slug: string;
  /** Tiêu đề trang hiển thị ở hero + footer link. */
  title: string;
  /** Nội dung HTML đầy đủ của trang. */
  content: string;
  /** Có hiển thị / liên kết được không. Default true. */
  visible?: boolean;
  /** Thời điểm cập nhật cuối. */
  updatedAt?: string;
}

export interface CmsPage {
  id: string;
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  status: PageStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PageSection {
  id: string;
  pageId: string;
  type: BlockType;
  title: string;
  subtitle?: string;
  description?: string;
  content?: string;
  imageUrl?: string;
  image2Url?: string;
  buttonText?: string;
  buttonLink?: string;
  button2Text?: string;
  button2Link?: string;
  formId?: string;
  /** Anchor ID for scroll navigation, e.g. "about", "teachers", "programs" */
  anchorId?: string;
  /** JSON array for complex section data: stats, testimonials, teachers, news items */
  extraData?: string;
  order: number;
  visible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  category: string;
  author: string;
  excerpt: string;
  content: string; // HTML rich text
  coverImage: string;
  status: 'published' | 'draft';
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface MediaItem {
  id: string;
  name: string;
  fileUrl: string;
  fileType: string;
  fileSize: number;
  uploadedBy: string;
  createdAt: string;
}
