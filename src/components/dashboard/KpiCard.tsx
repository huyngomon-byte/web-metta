import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export function KpiCard({ label, value, helper, icon: Icon, tone = 'navy' }: { label: string; value: string | number; helper?: string; icon: React.ElementType; tone?: 'navy' | 'orange' | 'cyan' | 'green' }) {
  const tones = {
    navy: 'bg-[#003B7A]',
    orange: 'bg-[#F45A0A]',
    cyan: 'bg-[#16A9D8]',
    green: 'bg-green-600'
  };
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="text-sm text-slate-500">{label}</CardTitle>
        <div className={`flex size-10 items-center justify-center rounded-lg text-white ${tones[tone]}`}><Icon /></div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-extrabold text-slate-950">{value}</div>
        {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
      </CardContent>
    </Card>
  );
}
