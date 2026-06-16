import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { publicBlogService } from '@/services/publicBlogService';
import type { BlogPost } from '@/types/cms';

export default function PublicBlogDetailPage() {
  const { slug } = useParams();
  const [post, setPost] = useState<BlogPost | null | undefined>(undefined);

  useEffect(() => {
    if (!slug) return;
    publicBlogService.getBySlug(slug).then((p) => setPost(p || null));
  }, [slug]);

  if (post === undefined) {
    return <div className="pt-32 text-center text-slate-400">Đang tải...</div>;
  }

  if (post === null) {
    return <Navigate to="/tin-tuc" replace />;
  }

  return (
    <>
      {/* Hero */}
      <section className="bg-gradient-to-b from-[#003B7A] to-[#002B5B] pt-28 pb-12">
        <div className="max-w-[800px] mx-auto px-5">
          <Link to="/tin-tuc" className="inline-flex items-center gap-2 text-sm font-bold text-white/70 hover:text-white mb-6">
            <ArrowLeft size={18} /> Tất cả tin tức
          </Link>
          <span className="inline-block bg-[#F45A0A] text-white px-3 py-1 text-[11px] font-bold tracking-widest uppercase rounded mb-4">
            {post.category}
          </span>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white leading-tight">{post.title}</h1>
          <p className="mt-4 text-white/60 text-sm flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">calendar_today</span>
              {new Date(post.publishedAt).toLocaleDateString('vi-VN', { day: '2-digit', month: 'long', year: 'numeric' })}
            </span>
            {post.author && (
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[14px]">person</span>
                {post.author}
              </span>
            )}
          </p>
        </div>
      </section>

      {/* Content */}
      <article className="py-12 bg-white">
        <div className="max-w-[800px] mx-auto px-5">
          {post.excerpt && (
            <p className="text-lg text-slate-600 leading-8 mb-8 font-medium border-l-4 border-[#F45A0A] pl-5 italic">
              {post.excerpt}
            </p>
          )}
          <div
            className="prose prose-lg max-w-none prose-headings:text-[#003B7A] prose-a:text-[#F45A0A] prose-img:rounded-xl prose-img:shadow-lg"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        </div>
      </article>

      {/* Back */}
      <section className="py-8 bg-[#F5F9FC]">
        <div className="max-w-[800px] mx-auto px-5 text-center">
          <Link to="/tin-tuc" className="inline-flex items-center gap-2 text-sm font-bold text-[#003B7A] hover:text-[#F45A0A] transition">
            <ArrowLeft size={16} /> Xem tất cả tin tức
          </Link>
        </div>
      </section>
    </>
  );
}
