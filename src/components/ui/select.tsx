import * as React from 'react';
import { cn } from '@/lib/utils';

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#16A9D8] focus:ring-2 focus:ring-cyan-100', className)} {...props} />;
}
