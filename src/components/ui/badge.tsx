import { cn } from '@/lib/utils';

const colors: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  cyan: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  gray: 'bg-slate-100 text-slate-700 border-slate-200',
  orange: 'bg-orange-50 text-orange-700 border-orange-100',
  purple: 'bg-purple-50 text-purple-700 border-purple-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  green: 'bg-green-50 text-green-700 border-green-100',
  red: 'bg-red-50 text-red-700 border-red-100'
};

export function Badge({ className, tone = 'gray', ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof colors }) {
  return <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold', colors[tone], className)} {...props} />;
}
