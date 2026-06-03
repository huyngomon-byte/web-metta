import { cn } from '@/lib/utils';

export function TabsList({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('inline-flex rounded-lg bg-slate-100 p-1', className)} {...props} />;
}
export function TabsTrigger({ active, className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return <button className={cn('rounded-md px-3 py-1.5 text-sm font-semibold text-slate-600 transition', active && 'bg-white text-[#003B7A] shadow-sm', className)} {...props} />;
}
