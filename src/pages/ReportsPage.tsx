import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function ReportsPage() {
  return (
    <Card>
      <CardHeader><CardTitle>Reports</CardTitle></CardHeader>
      <CardContent className="text-slate-500">
        MVP: tổng quan performance đã có trong Dashboard. Phase tiếp theo có báo cáo chiến dịch, nguồn lead, tỷ lệ chuyển đổi và hiệu quả CAPI.
      </CardContent>
    </Card>
  );
}
