import { ArrowLeft } from 'lucide-react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { siteSettings as seedSettings } from '@/data/seed';
import { usePublicThemeSettings } from '@/hooks/usePublicCms';
import type { LegalPage } from '@/types/cms';

/** Tìm legal page theo slug, ưu tiên CMS, fallback seed, hỗ trợ backward-compat từ privacyPolicy/termsOfUse cũ. */
function resolveLegalPage(slug: string, settings: typeof seedSettings): LegalPage | null {
  const candidates: LegalPage[] = settings.legalPages?.length ? settings.legalPages : (seedSettings.legalPages || []);
  const found = candidates.find((p) => p.slug === slug && p.visible !== false);
  if (found) return found;

  // Backward-compat: nếu vẫn còn dùng privacyPolicy/termsOfUse cũ
  if (slug === 'chinh-sach-bao-mat' && settings.privacyPolicy) {
    return { slug, title: 'Chính sách bảo mật', content: settings.privacyPolicy, visible: true };
  }
  if (slug === 'dieu-khoan-su-dung' && settings.termsOfUse) {
    return { slug, title: 'Điều khoản sử dụng', content: settings.termsOfUse, visible: true };
  }
  return null;
}

export default function PublicLegalPage() {
  const { slug: paramSlug } = useParams();
  const location = useLocation();
  const { settings, loading } = usePublicThemeSettings();
  const current = settings || seedSettings;

  // Slug có thể đến từ /phap-ly/:slug (param) hoặc từ URL cũ /chinh-sach-bao-mat (path)
  const slug = paramSlug || location.pathname.replace(/^\//, '').split('/')[0];
  if (loading) return null;
  if (!slug) return <Navigate to="/" replace />;
  const page = resolveLegalPage(slug, current);
  if (!page) return <Navigate to="/" replace />;

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-[#003B7A] to-[#002B5B] pt-28 pb-12">
        <div className="max-w-[800px] mx-auto px-5">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-white/70 hover:text-white mb-6">
            <ArrowLeft size={18} /> Trang chủ
          </Link>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">{page.title}</h1>
          <p className="mt-3 text-white/60 text-sm">{current.brandName || 'METTA Academy'}</p>
        </div>
      </section>

      {/* Content */}
      <article className="py-12 bg-white">
        <div className="max-w-[800px] mx-auto px-5">
          <div
            className="prose prose-slate max-w-none prose-headings:text-[#003B7A] prose-h2:text-2xl prose-h2:font-extrabold prose-h2:mt-0 prose-h3:text-lg prose-h3:font-bold prose-h3:mt-8 prose-p:text-slate-700 prose-p:leading-7 prose-li:text-slate-700 prose-li:leading-7 prose-a:text-[#F45A0A] prose-a:no-underline hover:prose-a:underline prose-strong:text-slate-900"
            dangerouslySetInnerHTML={{ __html: page.content }}
          />
        </div>
      </article>

      {/* Back */}
      <section className="py-8 bg-[#F5F9FC]">
        <div className="max-w-[800px] mx-auto px-5 text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-[#003B7A] hover:text-[#F45A0A] transition">
            <ArrowLeft size={16} /> Quay về trang chủ
          </Link>
        </div>
      </section>
    </>
  );
}
