import * as React from 'react';
import { cn } from '@/lib/utils';

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <div className="overflow-x-auto"><table className={cn('w-full text-left text-sm', className)} {...props} /></div>;
}
export const THead = (props: React.HTMLAttributes<HTMLTableSectionElement>) => <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500" {...props} />;
export const TBody = (props: React.HTMLAttributes<HTMLTableSectionElement>) => <tbody className="divide-y divide-slate-100" {...props} />;
export const TR = (props: React.HTMLAttributes<HTMLTableRowElement>) => <tr className="hover:bg-slate-50" {...props} />;
export const TH = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => <th className={cn('px-4 py-3 font-bold', className)} {...props} />;
export const TD = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => <td className={cn('px-4 py-3 align-top text-slate-700', className)} {...props} />;
