import { ExternalLink, Loader2, Play, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { callCenterService } from '@/services/callCenterService';
import type { CallLog } from '@/types/call';
import type { AdminUser } from '@/types/user';

type RecordingState = {
  loading: boolean;
  error: string;
  audioUrl: string;
};

export function canPlayCallRecording(user?: AdminUser | null) {
  return user?.active === true && (user.role === 'admin' || user.role === 'manager');
}

function callLogId(log: Pick<CallLog, 'id' | 'providerCallId'>) {
  return log.id || log.providerCallId;
}

function errorMessageFromPayload(payload: unknown, fallback: string) {
  if (payload && typeof payload === 'object' && 'error' in payload) {
    return String((payload as { error?: unknown }).error || fallback);
  }
  return fallback;
}

function useRecordingAudio(callId: string, enabled: boolean) {
  const [state, setState] = useState<RecordingState>({ loading: false, error: '', audioUrl: '' });

  useEffect(() => {
    if (!enabled || !callId) return undefined;
    let objectUrl = '';
    const controller = new AbortController();

    async function load() {
      setState({ loading: true, error: '', audioUrl: '' });
      try {
        const token = await auth?.currentUser?.getIdToken().catch(() => '');
        if (!token) throw new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
        const response = await fetch(callCenterService.recordingProxyUrlById(callId), {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(errorMessageFromPayload(payload, 'Không tải được ghi âm.'));
        }
        const blob = await response.blob();
        objectUrl = URL.createObjectURL(blob);
        setState({ loading: false, error: '', audioUrl: objectUrl });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({
          loading: false,
          error: error instanceof Error ? error.message : 'Không tải được ghi âm.',
          audioUrl: '',
        });
      }
    }

    void load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [callId, enabled]);

  return state;
}

export function CallRecordingPanel({
  callId,
  title = 'Ghi âm cuộc gọi',
  autoLoad = true,
}: {
  callId: string;
  title?: string;
  autoLoad?: boolean;
}) {
  const { user } = useAuth();
  const allowed = canPlayCallRecording(user);
  const { loading, error, audioUrl } = useRecordingAudio(callId, autoLoad && allowed);

  if (!allowed) {
    return (
      <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
        Chỉ Admin và Manager được nghe ghi âm cuộc gọi.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-extrabold text-slate-950">{title}</h2>
          <p className="mt-1 break-all text-xs font-semibold text-slate-500">{callId}</p>
        </div>
      </div>
      {loading && (
        <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-bold text-blue-700">
          <Loader2 size={16} className="animate-spin" /> Đang tải file ghi âm...
        </div>
      )}
      {error && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}
      {audioUrl && (
        <audio className="mt-2 w-full" src={audioUrl} controls preload="metadata">
          Trình duyệt không hỗ trợ phát audio.
        </audio>
      )}
    </div>
  );
}

export function CallRecordingButton({
  log,
  label = 'Nghe ghi âm',
  emptyLabel = 'Chưa có ghi âm',
  className,
}: {
  log: CallLog;
  label?: string;
  emptyLabel?: string;
  className?: string;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const id = useMemo(() => callLogId(log), [log]);
  const allowed = canPlayCallRecording(user);

  if (!allowed) return null;

  if (!log.recordingUrl) {
    return (
      <span
        className={cn('inline-flex items-center gap-1 font-bold text-slate-400', className)}
        title="Stringee chưa trả recording_url cho cuộc gọi này."
      >
        <Play size={13} /> {emptyLabel}
      </span>
    );
  }

  return (
    <>
      <button
        type="button"
        className={cn('inline-flex items-center gap-1 font-bold text-[#003B7A] hover:underline', className)}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
      >
        <Play size={13} /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-xl bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-slate-950">{log.leadName || log.customerNumber || 'Cuộc gọi'}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {log.direction === 'inbound' ? 'Inbound' : 'Outbound'} · {log.durationSec ? `${Math.round(log.durationSec)}s` : 'chưa có duration'}
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                onClick={() => setOpen(false)}
                title="Đóng"
              >
                <X size={18} />
              </button>
            </div>
            <CallRecordingPanel callId={id} title="Nghe ghi âm" />
            <div className="mt-3 flex justify-end">
              <Link
                to={callCenterService.recordingPageUrl(log)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
              >
                <ExternalLink size={14} /> Mở trang riêng
              </Link>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
