import { ArrowLeft } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { CallRecordingPanel } from '@/components/call/CallRecordingPlayer';

export default function CallRecordingPage() {
  const { callId = '' } = useParams();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4 md:p-6">
      <Link
        to="/crm/leads"
        className="inline-flex w-fit items-center gap-2 text-sm font-bold text-[#003B7A] hover:underline"
      >
        <ArrowLeft size={16} /> Quay lại Leads
      </Link>
      <CallRecordingPanel callId={decodeURIComponent(callId)} />
    </div>
  );
}
