import { ArrowLeft, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PublicNotFoundPage() {
  return (
    <main className="min-h-[70vh] bg-[#F7F9FC] pt-28">
      <section className="mx-auto flex max-w-[820px] flex-col items-center px-5 py-16 text-center">
        <p className="text-sm font-extrabold uppercase tracking-[0.18em] text-[#F45A0A]">404</p>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight text-[#003B7A] md:text-5xl">
          Không tìm thấy trang
        </h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-slate-600">
          Trang bạn đang mở không tồn tại hoặc đã được đổi đường dẫn.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F45A0A] px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
          >
            <Home size={17} />
            Về trang chủ
          </Link>
          <Link
            to="/#programs"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#003B7A]/20 bg-white px-5 py-3 text-sm font-bold text-[#003B7A] transition hover:border-[#F45A0A] hover:text-[#F45A0A]"
          >
            <ArrowLeft size={17} />
            Xem chương trình học
          </Link>
        </div>
      </section>
    </main>
  );
}
