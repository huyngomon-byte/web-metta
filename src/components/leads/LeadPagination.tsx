import { ChevronLeft, ChevronRight, UsersRound } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type LeadPaginationProps = {
  page: number;
  totalPages: number;
  totalLeads: number;
  pageSize: number;
  loading?: boolean;
  onPageChange: (page: number) => void | Promise<void>;
};

export function LeadPagination({
  page,
  totalPages,
  totalLeads,
  pageSize,
  loading = false,
  onPageChange,
}: LeadPaginationProps) {
  const [draftPage, setDraftPage] = useState(String(page));

  useEffect(() => {
    setDraftPage(String(page));
  }, [page]);

  function submitPage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = Number(draftPage);
    if (!Number.isFinite(parsed)) {
      setDraftPage(String(page));
      return;
    }
    const nextPage = Math.max(1, Math.min(totalPages, Math.round(parsed)));
    setDraftPage(String(nextPage));
    void onPageChange(nextPage);
  }

  return (
    <div className="relative z-10 grid gap-4 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#003B7A]">
          <UsersRound size={21} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.08em] text-slate-500">Tổng số lead</p>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-xl font-extrabold text-slate-950">{totalLeads.toLocaleString('vi-VN')} lead</span>
            <span className="text-xs font-semibold text-slate-400">{pageSize} lead/trang · {totalPages} trang</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-2 sm:grid-cols-[auto_minmax(220px,1fr)_auto] sm:items-center">
        <Button className="w-full" variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => void onPageChange(page - 1)}>
          <ChevronLeft size={16} /> Trước
        </Button>
        <form className="order-first col-span-2 flex items-center justify-center gap-2 sm:order-none sm:col-span-1" onSubmit={submitPage}>
          <span className="text-sm font-semibold text-slate-600">Trang</span>
          <Input
            aria-label="Số trang"
            type="number"
            min={1}
            max={totalPages}
            value={draftPage}
            disabled={loading}
            onChange={(event) => setDraftPage(event.target.value)}
            className="h-9 w-20 bg-white text-center"
          />
          <span className="text-sm font-semibold text-slate-600">/ {totalPages}</span>
          <Button type="submit" variant="outline" size="sm" disabled={loading}>Đi</Button>
        </form>
        <Button className="w-full" variant="outline" size="sm" disabled={loading || page >= totalPages} onClick={() => void onPageChange(page + 1)}>
          Sau <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
