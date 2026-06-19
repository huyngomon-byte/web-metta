import { Mic, MicOff, Phone, PhoneCall, PhoneIncoming, PhoneOff, RadioTower, Save, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CallRecordingButton } from '@/components/call/CallRecordingPlayer';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useCallCenter } from '@/context/CallCenterContext';
import { callCenterService } from '@/services/callCenterService';
import { DEFAULT_CALL_DISPOSITIONS, type CallLog } from '@/types/call';

function durationLabel(startedAt?: string) {
  const start = startedAt ? new Date(startedAt).getTime() : 0;
  if (!start || Number.isNaN(start)) return '00:00';
  const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function stateLabel(state: string) {
  if (state === 'connected') return 'Stringee online';
  if (state === 'pcc-ready') return 'Stringee PCC sẵn sàng';
  if (state === 'connecting' || state === 'loading-sdk') return 'Đang nối Stringee';
  if (state === 'error') return 'Stringee lỗi';
  if (state === 'disabled') return 'Call center tắt';
  return 'Stringee standby';
}

function defaultDispositionFor(log: CallLog, options: string[]) {
  const fallback = options[0] || DEFAULT_CALL_DISPOSITIONS[0];
  const negative = options.find((item) => item.toLowerCase().includes('không nghe'))
    || options.find((item) => item.toLowerCase().includes('máy bận'));
  if (log.status === 'failed' || log.status === 'missed' || (!log.answeredAt && !log.recordingUrl)) {
    return negative || fallback;
  }
  return fallback;
}

export function CallWidget() {
  const {
    connectionState,
    error,
    activeCall,
    incomingCall,
    pendingWrapUp,
    answerIncoming,
    rejectIncoming,
    hangup,
    toggleMute,
    saveWrapUp,
    dismissWrapUp,
    clearError,
  } = useCallCenter();
  const [, setTick] = useState(0);
  const [dispositions, setDispositions] = useState<string[]>([...DEFAULT_CALL_DISPOSITIONS]);
  const [disposition, setDisposition] = useState<string>(DEFAULT_CALL_DISPOSITIONS[0]);
  const [note, setNote] = useState('');

  useEffect(() => {
    callCenterService.getSettings().then((settings) => {
      setDispositions(settings.dispositions.length ? settings.dispositions : [...DEFAULT_CALL_DISPOSITIONS]);
      setDisposition(settings.dispositions[0] || DEFAULT_CALL_DISPOSITIONS[0]);
    });
  }, []);

  useEffect(() => {
    if (!activeCall) return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [activeCall]);

  useEffect(() => {
    if (!pendingWrapUp) return;
    setDisposition(defaultDispositionFor(pendingWrapUp, dispositions));
    setNote('');
  }, [dispositions, pendingWrapUp]);

  const shouldShowStatus = connectionState === 'error' || Boolean(activeCall || incomingCall || pendingWrapUp);
  const callDuration = durationLabel(activeCall?.answeredAt || activeCall?.startedAt);

  return (
    <div className="fixed bottom-14 right-4 z-50 flex w-[360px] max-w-[calc(100vw-2rem)] flex-col gap-3">
      {incomingCall && (
        <div className="rounded-xl border border-orange-200 bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-extrabold text-orange-700"><PhoneIncoming size={17} /> Cuộc gọi đến</p>
              <h3 className="mt-1 text-lg font-extrabold text-slate-950">{incomingCall.leadName || 'Khách gọi vào'}</h3>
              <p className="text-sm font-semibold text-slate-500">{incomingCall.phone}</p>
            </div>
            <span className="rounded-full bg-orange-50 px-2 py-1 text-[11px] font-bold text-orange-700">ringing</span>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => void answerIncoming()}>
              <PhoneCall size={16} /> Nghe máy
            </Button>
            <Button className="flex-1" variant="destructive" onClick={() => void rejectIncoming()}>
              <PhoneOff size={16} /> Từ chối
            </Button>
          </div>
        </div>
      )}

      {activeCall && (
        <div className="rounded-xl border border-blue-200 bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-sm font-extrabold text-blue-700"><Phone size={17} /> Đang gọi</p>
              <h3 className="mt-1 text-lg font-extrabold text-slate-950">{activeCall.leadName || activeCall.phone}</h3>
              <p className="text-sm font-semibold text-slate-500">{activeCall.direction === 'outbound' ? 'Outbound' : 'Inbound'} · {callDuration}</p>
            </div>
            <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-bold text-blue-700">{activeCall.status}</span>
          </div>
          <div className="flex gap-2">
            {activeCall.status === 'answered' && (
              <Button variant="outline" size="icon" onClick={() => void toggleMute()} title={activeCall.muted ? 'Bật mic' : 'Tắt mic'}>
                {activeCall.muted ? <MicOff size={17} /> : <Mic size={17} />}
              </Button>
            )}
            <Button className="flex-1" variant="destructive" onClick={() => void hangup()}>
              <PhoneOff size={16} /> Kết thúc
            </Button>
          </div>
        </div>
      )}

      {pendingWrapUp && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xl">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-extrabold text-slate-950">Wrap-up cuộc gọi</p>
              <p className="text-xs font-semibold text-slate-500">{pendingWrapUp.leadName || pendingWrapUp.customerNumber} · {pendingWrapUp.direction}</p>
            </div>
            <button type="button" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={dismissWrapUp} title="Đóng">
              <X size={16} />
            </button>
          </div>
          <div className="flex flex-col gap-2">
            <Select value={disposition} onChange={(event) => setDisposition(event.target.value)}>
              {dispositions.map((item) => <option key={item} value={item}>{item}</option>)}
            </Select>
            <Textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ghi chú nhanh sau cuộc gọi..." />
            <CallRecordingButton log={pendingWrapUp} className="text-xs" />
            <Button onClick={() => void saveWrapUp(disposition, note)}>
              <Save size={16} /> Lưu call log
            </Button>
          </div>
        </div>
      )}

      {(shouldShowStatus || error) && (
        <div className={`rounded-xl border bg-white px-3 py-2 text-xs font-bold shadow-lg ${connectionState === 'error' ? 'border-red-200 text-red-700' : 'border-slate-200 text-slate-600'}`}>
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2"><RadioTower size={14} /> {stateLabel(connectionState)}</span>
            {error && <button type="button" className="text-slate-400 hover:text-slate-700" onClick={clearError}>Đóng</button>}
          </div>
          {error && <p className="mt-1 font-semibold text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}
