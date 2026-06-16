import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { siteSettings as seedSettings } from '@/data/seed';
import { usePublicThemeSettings } from '@/hooks/usePublicCms';
import { publicBlogService } from '@/services/publicBlogService';
import type { BlogPost } from '@/types/cms';

export default function PublicNewsPage() {
  const { settings } = usePublicThemeSettings();
  const current = settings || seedSettings;
  const [posts, setPosts] = useState<BlogPost[] | null>(null);

  useEffect(() => { publicBlogService.getPublished().then(setPosts); }, []);

  return (
    <>
      <section className="bg-gradient-to-b from-[#003B7A] to-[#002B5B] pt-28 pb-12">
        <div className="max-w-[1180px] mx-auto px-5">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-bold text-white/70 hover:text-white mb-6">
            <ArrowLeft size={18} /> Trang chủ
          </Link>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white">Tin tức & Sự kiện</h1>
          <p className="mt-3 text-white/60 text-lg">Cập nhật mới nhất từ {current.brandName || 'METTA Academy'}</p>
        </div>
      </section>

      <section className="py-12 bg-[#F5F9FC]">
        <div className="max-w-[1180px] mx-auto px-5">
          {posts === null ? (
            <div className="text-center py-16 text-slate-400">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-[#003B7A]" />
              <p className="mt-3 text-sm font-semibold">Đang tải bài viết...</p>
            </div>
          ) : posts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  to={`/tin-tuc/${post.slug}`}
                  className="group block bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-shadow"
                >
                  <div className="relative h-52 overflow-hidden">
                    {post.coverImage ? (
                      <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    ) : (
                      <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-300 text-4xl">📰</div>
                    )}
                    <div className="absolute top-4 left-4">
                      <span className="bg-[#F45A0A] text-white px-3 py-1 text-[11px] font-bold tracking-widest uppercase rounded">
                        {post.category}
                      </span>
                    </div>
                  </div>
                  <div className="p-6">
                    <p className="text-slate-500 text-xs mb-3 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                      {new Date(post.publishedAt).toLocaleDateString('vi-VN')}
                      {post.author && <> • {post.author}</>}
                    </p>
                    <h3 className="font-bold text-[#003B7A] text-lg leading-snug mb-3 group-hover:text-[#F45A0A] transition-colors line-clamp-2">
                      {post.title}
                    </h3>
                    <p className="text-slate-600 text-sm leading-relaxed line-clamp-3">{post.excerpt}</p>
                    <p className="mt-4 text-[#F45A0A] text-sm font-bold flex items-center gap-1 group-hover:gap-2 transition-all">
                      Đọc thêm
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 text-slate-400">
              <p className="text-lg font-semibold">Chưa có bài viết nào</p>
              <p className="text-sm mt-1">Các bài viết sẽ hiển thị tại đây khi được đăng từ CMS.</p>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
