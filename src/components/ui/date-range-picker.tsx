import { useEffect, useRef, useState } from 'react';

interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  placeholder?: string;
  className?: string;
}

const fmt = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');

export function DateRangePicker({ from, to, onChange, placeholder = 'Chọn khoảng ngày', className = '' }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => { setDraftFrom(from); setDraftTo(to); }, [from, to]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const display = from || to ? `${fmt(from) || '...'} → ${fmt(to) || '...'}` : '';

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-left text-sm outline-none transition hover:border-slate-400 ${open ? 'border-[#003B7A] ring-2 ring-[#003B7A]/15' : ''}`}
      >
        <span className="text-slate-400">📅</span>
        {display ? <span className="text-slate-900">{display}</span> : <span className="text-slate-400">{placeholder}</span>}
      </button>
      {open && (
        <div
          className="absolute left-0 z-30 mt-1 min-w-[260px] rounded-lg border border-slate-200 bg-white p-3 shadow-xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-2">
            <label className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Từ ngày</span>
              <input
                type="date"
                className="mt-0.5 cursor-pointer rounded border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-[#003B7A]"
                value={draftFrom}
                max={draftTo || undefined}
                onClick={(e) => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* ignore */ } }}
                onFocus={(e) => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* ignore */ } }}
                onChange={(e) => setDraftFrom(e.target.value)}
              />
            </label>
            <label className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Đến ngày</span>
              <input
                type="date"
                className="mt-0.5 cursor-pointer rounded border border-slate-200 bg-white px-2 py-1.5 text-sm outline-none focus:border-[#003B7A]"
                value={draftTo}
                min={draftFrom || undefined}
                onClick={(e) => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* ignore */ } }}
                onFocus={(e) => { try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* ignore */ } }}
                onChange={(e) => setDraftTo(e.target.value)}
              />
            </label>
            <div className="grid grid-cols-3 gap-1.5 border-t border-slate-100 pt-2">
              <button
                type="button"
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  setDraftFrom(today); setDraftTo(today);
                }}
                className="rounded border border-slate-200 px-1 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  const to = d.toISOString().slice(0, 10);
                  d.setDate(d.getDate() - 6);
                  const from = d.toISOString().slice(0, 10);
                  setDraftFrom(from); setDraftTo(to);
                }}
                className="rounded border border-slate-200 px-1 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                7 ngày
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  const to = d.toISOString().slice(0, 10);
                  d.setDate(d.getDate() - 29);
                  const from = d.toISOString().slice(0, 10);
                  setDraftFrom(from); setDraftTo(to);
                }}
                className="rounded border border-slate-200 px-1 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
              >
                30 ngày
              </button>
            </div>
            <div className="flex gap-1.5 pt-1">
              <button
                type="button"
                onClick={() => { setDraftFrom(''); setDraftTo(''); onChange('', ''); setOpen(false); }}
                className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Xoá
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Huỷ
              </button>
              <button
                type="button"
                onClick={() => { onChange(draftFrom, draftTo); setOpen(false); }}
                className="flex-[1.3] rounded bg-[#003B7A] px-2 py-1.5 text-xs font-bold text-white hover:opacity-90"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
