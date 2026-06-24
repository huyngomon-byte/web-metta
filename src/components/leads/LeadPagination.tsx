import { ChevronLeft, ChevronRight } from 'lucide-react';
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
    <div className="flex flex-col items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row">
      <p className="text-xs font-semibold text-slate-500">
        Tổng {totalLeads.toLocaleString('vi-VN')} lead · tối đa {pageSize} lead/trang
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="outline" size="sm" disabled={loading || page <= 1} onClick={() => void onPageChange(page - 1)}>
          <ChevronLeft size={16} /> Trước
        </Button>
        <form className="flex items-center gap-2" onSubmit={submitPage}>
          <span className="text-sm font-semibold text-slate-600">Trang</span>
          <Input
            aria-label="Số trang"
            type="number"
            min={1}
            max={totalPages}
            value={draftPage}
            disabled={loading}
            onChange={(event) => setDraftPage(event.target.value)}
            className="h-9 w-20 text-center"
          />
          <span className="text-sm font-semibold text-slate-600">/ {totalPages}</span>
          <Button type="submit" variant="outline" size="sm" disabled={loading}>Đi</Button>
        </form>
        <Button variant="outline" size="sm" disabled={loading || page >= totalPages} onClick={() => void onPageChange(page + 1)}>
          Sau <ChevronRight size={16} />
        </Button>
      </div>
    </div>
  );
}
