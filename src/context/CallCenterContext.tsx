import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { callCenterService, normalizePhoneForCall } from '@/services/callCenterService';
import type { CallLog } from '@/types/call';
import type { Lead } from '@/types/crm';

type StringeeClientLike = {
  connect?: (token: string) => void;
  disconnect?: () => void;
  on?: (event: string, callback: (...args: any[]) => void) => void;
};

type StringeeCallLike = {
  callId?: string;
  id?: string;
  fromNumber?: string;
  toNumber?: string;
  customData?: string;
  initAnswer?: (...args: any[]) => unknown;
  makeCall?: (...args: any[]) => void;
  answer?: (...args: any[]) => unknown;
  reject?: (...args: any[]) => void;
  hangup?: (...args: any[]) => void;
  mute?: (...args: any[]) => void;
  on?: (event: string, callback: (...args: any[]) => void) => void;
};

declare global {
  interface Window {
    StringeeClient?: new () => StringeeClientLike;
    StringeeCall?: new (client: StringeeClientLike, from: string, to: string, isVideoCall?: boolean) => StringeeCallLike;
    StringeeCall2?: new (client: StringeeClientLike, from: string, to: string, isVideoCall?: boolean) => StringeeCallLike;
  }
}

export type CallConnectionState = 'disabled' | 'idle' | 'pcc-ready' | 'loading-sdk' | 'connecting' | 'connected' | 'error';

export interface CallSession {
  id: string;
  providerCallId: string;
  direction: 'outbound' | 'inbound';
  status: 'ringing' | 'answered' | 'ended' | 'failed';
  phone: string;
  leadId?: string;
  leadName?: string;
  startedAt: string;
  answeredAt?: string;
  endedAt?: string;
  muted?: boolean;
  sdkCall?: StringeeCallLike;
  log?: CallLog;
}

type CallCenterContextValue = {
  connectionState: CallConnectionState;
  error: string;
  activeCall: CallSession | null;
  incomingCall: CallSession | null;
  pendingWrapUp: CallLog | null;
  startOutboundCall: (lead: Lead) => Promise<void>;
  answerActiveCall: () => Promise<void>;
  answerIncoming: () => Promise<void>;
  rejectIncoming: () => Promise<void>;
  hangup: () => Promise<void>;
  toggleMute: () => Promise<void>;
  clearError: () => void;
  saveWrapUp: (disposition: string, note: string) => Promise<void>;
  dismissWrapUp: () => void;
};

const CallCenterContext = createContext<CallCenterContextValue | null>(null);

function loadStringeeSdk() {
  if (window.StringeeClient) return Promise.resolve();
  const sdkUrl = import.meta.env.VITE_STRINGEE_SDK_URL || 'https://cdn.stringee.com/sdk/web/latest/stringee-web-sdk.min.js';
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-stringee-sdk="true"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Cannot load Stringee SDK.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = sdkUrl;
    script.async = true;
    script.dataset.stringeeSdk = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Cannot load Stringee SDK.'));
    document.head.appendChild(script);
  });
}

function hiddenAudioElement(id: string, muted = false) {
  let element = document.getElementById(id) as HTMLAudioElement | null;
  if (!element) {
    element = document.createElement('audio');
    element.id = id;
    element.autoplay = true;
    element.muted = muted;
    element.style.display = 'none';
    document.body.appendChild(element);
  }
  return element;
}

function attachStreamToAudio(id: string, stream: MediaStream, muted = false) {
  const element = hiddenAudioElement(id, muted);
  element.srcObject = stream;
  void element.play?.().catch(() => {});
}

async function ensureMicrophonePermission() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Trình duyệt chưa hỗ trợ WebRTC microphone.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  attachStreamToAudio('metta-stringee-local-audio', stream, true);
  return stream;
}

async function maybeAwait(value: unknown) {
  if (value && typeof (value as Promise<unknown>).then === 'function') {
    return (value as Promise<unknown>);
  }
  return value;
}

function eventCallId(call?: StringeeCallLike) {
  return call?.callId || call?.id || `call-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseCustomData(call?: StringeeCallLike) {
  try {
    return call?.customData ? JSON.parse(call.customData) as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function leadName(lead: Lead) {
  return String(lead.studentName || lead.parentName || lead.fullName || lead.phone || '').trim();
}

function durationSec(startedAt?: string, endedAt?: string) {
  const start = startedAt ? new Date(startedAt).getTime() : 0;
  const end = endedAt ? new Date(endedAt).getTime() : Date.now();
  if (!start || Number.isNaN(start) || Number.isNaN(end) || end <= start) return undefined;
  return Math.round((end - start) / 1000);
}

function terminalStatus(status?: string) {
  return status === 'ended' || status === 'failed' || status === 'missed';
}

function logMatchesSession(log: CallLog, session: CallSession) {
  const sessionIds = new Set([
    session.id,
    session.providerCallId,
    session.log?.id,
    session.log?.providerCallId,
    session.log?.clientCallId,
    session.log?.stringeeCallId,
  ].filter(Boolean));
  return [
    log.id,
    log.providerCallId,
    log.clientCallId,
    log.stringeeCallId,
  ].some((value) => sessionIds.has(value));
}

function makeCallFailed(response: unknown) {
  const payload = response && typeof response === 'object' ? response as Record<string, unknown> : {};
  const resultCode = Number(payload.r ?? payload.code ?? payload.statusCode);
  if (Number.isFinite(resultCode) && resultCode !== 0) return true;
  const ok = payload.success ?? payload.ok;
  if (ok === false) return true;
  const text = JSON.stringify(response || {}).toLowerCase();
  return text.includes('error') || text.includes('failed');
}

function responseCallId(response: unknown, call?: StringeeCallLike) {
  const payload = response && typeof response === 'object' ? response as Record<string, unknown> : {};
  return String(call?.callId || call?.id || payload.callId || payload.call_id || payload.id || '').trim();
}

function responseMessage(response: unknown) {
  const payload = response && typeof response === 'object' ? response as Record<string, unknown> : {};
  return String(payload.message || payload.msg || payload.error || JSON.stringify(response || {}));
}

export function CallCenterProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const clientRef = useRef<StringeeClientLike | null>(null);
  const tokenRef = useRef('');
  const activeCallRef = useRef<CallSession | null>(null);
  const [connectionState, setConnectionState] = useState<CallConnectionState>('idle');
  const [error, setError] = useState('');
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const [incomingCall, setIncomingCall] = useState<CallSession | null>(null);
  const [pendingWrapUp, setPendingWrapUp] = useState<CallLog | null>(null);

  useEffect(() => {
    activeCallRef.current = activeCall;
  }, [activeCall]);

  useEffect(() => {
    if (!activeCall || activeCall.sdkCall || !activeCall.leadId) return undefined;
    let cancelled = false;

    async function syncPccStatus() {
      const session = activeCallRef.current;
      if (!session || session.sdkCall || !session.leadId) return;
      const logs = await callCenterService.getLogsForLead(session.leadId).catch(() => []);
      const remote = logs.find((log) => logMatchesSession(log, session));
      if (!remote || cancelled) return;

      if (terminalStatus(remote.status)) {
        activeCallRef.current = null;
        setActiveCall(null);
        setIncomingCall(null);
        setPendingWrapUp(remote);
        if (remote.status === 'failed' || remote.status === 'missed' || !remote.answeredAt) {
          setError('Cuộc gọi không kết nối được với khách. Vui lòng ghi chú kết quả cuộc gọi.');
        }
        return;
      }

      if (remote.status === 'answered' && session.status !== 'answered') {
        const next = {
          ...session,
          status: 'answered' as const,
          answeredAt: remote.answeredAt || new Date().toISOString(),
          log: remote,
        };
        activeCallRef.current = next;
        setActiveCall(next);
      }
    }

    void syncPccStatus();
    const timer = window.setInterval(() => void syncPccStatus(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeCall]);

  const clearError = useCallback(() => setError(''), []);

  const finishSession = useCallback(async (session: CallSession, status: 'ended' | 'failed' = 'ended') => {
    const endedAt = new Date().toISOString();
    const log: CallLog = {
      ...(session.log || {}),
      id: session.log?.id || session.providerCallId,
      provider: 'stringee',
      providerCallId: session.providerCallId,
      leadId: session.leadId,
      leadName: session.leadName,
      direction: session.direction,
      status,
      agentId: session.log?.agentId || user?.id,
      agentName: session.log?.agentName || user?.fullName,
      customerNumber: session.phone,
      fromNumber: session.direction === 'outbound' ? user?.id || '' : session.phone,
      toNumber: session.direction === 'outbound' ? session.phone : user?.id || '',
      startedAt: session.startedAt,
      answeredAt: session.answeredAt,
      endedAt,
      durationSec: durationSec(session.answeredAt || session.startedAt, endedAt),
      createdAt: session.log?.createdAt || session.startedAt || endedAt,
      updatedAt: endedAt,
    };
    activeCallRef.current = null;
    setActiveCall(null);
    setIncomingCall(null);
    try {
      const saved = await callCenterService.saveLog(log);
      setPendingWrapUp(saved);
    } catch (err) {
      console.warn('[CallCenter] Cannot persist finished call log:', err);
      setPendingWrapUp(log);
      setError(`Đã kết thúc cuộc gọi, nhưng chưa lưu được call log: ${err instanceof Error ? err.message : 'Firestore từ chối ghi log.'}`);
    }
  }, [user?.fullName, user?.id]);

  const attachCallEvents = useCallback((call: StringeeCallLike, session: CallSession) => {
    let trackedSession = session;
    const markAnswered = async () => {
      if (trackedSession.status === 'answered') return;
      const answeredAt = new Date().toISOString();
      const next = { ...trackedSession, status: 'answered' as const, answeredAt, sdkCall: call };
      trackedSession = next;
      setActiveCall(next);
      setIncomingCall(null);
      const saved = await callCenterService.saveLog({
        ...(trackedSession.log || {}),
        id: trackedSession.log?.id || trackedSession.providerCallId,
        providerCallId: trackedSession.providerCallId,
        leadId: trackedSession.leadId,
        leadName: trackedSession.leadName,
        direction: trackedSession.direction,
        status: 'answered',
        customerNumber: trackedSession.phone,
        fromNumber: trackedSession.direction === 'outbound' ? user?.id || '' : trackedSession.phone,
        toNumber: trackedSession.direction === 'outbound' ? trackedSession.phone : user?.id || '',
        startedAt: trackedSession.startedAt,
        answeredAt,
      });
      trackedSession = { ...trackedSession, log: saved };
      setActiveCall((current) => current ? { ...current, log: saved } : current);
    };
    const markEnded = () => {
      const current = trackedSession;
      void finishSession({ ...current, sdkCall: call }, current.status === 'answered' ? 'ended' : 'failed');
    };
    call.on?.('signalingstate', (...args) => {
      const stateText = JSON.stringify(args).toLowerCase();
      if (stateText.includes('answered') || stateText.includes('connected')) void markAnswered();
      if (stateText.includes('ended') || stateText.includes('busy') || stateText.includes('failed')) markEnded();
    });
    call.on?.('mediastate', (...args) => {
      const stateText = JSON.stringify(args).toLowerCase();
      if (stateText.includes('connected') || stateText.includes('answered')) void markAnswered();
    });
    call.on?.('addlocalstream', (stream: MediaStream) => {
      if (stream) attachStreamToAudio('metta-stringee-local-audio', stream, true);
    });
    call.on?.('addremotestream', (stream: MediaStream) => {
      if (stream) attachStreamToAudio('metta-stringee-remote-audio', stream, false);
    });
    call.on?.('addlocaltrack', (track: MediaStreamTrack) => {
      if (track) attachStreamToAudio('metta-stringee-local-audio', new MediaStream([track]), true);
    });
    call.on?.('addremotetrack', (track: MediaStreamTrack) => {
      if (track) attachStreamToAudio('metta-stringee-remote-audio', new MediaStream([track]), false);
    });
    call.on?.('info', (...args) => {
      const stateText = JSON.stringify(args).toLowerCase();
      if (stateText.includes('record')) {
        setActiveCall((current) => current ? { ...current, status: current.status } : current);
      }
    });
  }, [finishSession, user?.id]);

  const connect = useCallback(async () => {
    if (!user || (user.role !== 'sales' && user.role !== 'admin' && user.role !== 'manager')) {
      setConnectionState('disabled');
      return;
    }
    try {
      setError('');
      const settings = await callCenterService.getSettings();
      if (!settings.enabled) {
        setConnectionState('disabled');
        return;
      }
      if (settings.pccMode !== false) {
        clientRef.current?.disconnect?.();
        clientRef.current = null;
        tokenRef.current = '';
        setConnectionState('pcc-ready');
        return;
      }
      setConnectionState('loading-sdk');
      await loadStringeeSdk();
      if (!window.StringeeClient) throw new Error('Stringee SDK is not available after loading.');
      setConnectionState('connecting');
      const client = clientRef.current || new window.StringeeClient();
      clientRef.current = client;
      client.on?.('connect', () => {
        setConnectionState('connected');
        void callCenterService.setPresence(user, true);
      });
      client.on?.('authen', (...args) => {
        const text = JSON.stringify(args).toLowerCase();
        if (text.includes('false') || text.includes('error')) setConnectionState('error');
        else setConnectionState('connected');
      });
      client.on?.('disconnect', () => {
        setConnectionState('idle');
        void callCenterService.setPresence(user, false);
      });
      client.on?.('requestnewtoken', async () => {
        tokenRef.current = await callCenterService.getToken(user);
        client.connect?.(tokenRef.current);
      });
      const handleIncoming = async (call: StringeeCallLike) => {
        const pendingOutbound = activeCallRef.current;
        if (pendingOutbound?.direction === 'outbound' && pendingOutbound.status === 'ringing' && !pendingOutbound.sdkCall) {
          const next = { ...pendingOutbound, sdkCall: call };
          attachCallEvents(call, next);
          setActiveCall(next);
          setIncomingCall(null);
          return;
        }

        const providerCallId = eventCallId(call);
        const custom = parseCustomData(call);
        const phone = normalizePhoneForCall(String(call.fromNumber || custom.customerNumber || ''));
        const lead = await callCenterService.findLeadByPhone(phone).catch(() => undefined);
        const session: CallSession = {
          id: providerCallId,
          providerCallId,
          direction: 'inbound',
          status: 'ringing',
          phone,
          leadId: lead?.id || String(custom.leadId || ''),
          leadName: lead ? leadName(lead) : 'Khách gọi vào',
          startedAt: new Date().toISOString(),
          sdkCall: call,
        };
        const saved = await callCenterService.saveLog({
          providerCallId,
          direction: 'inbound',
          status: 'ringing',
          leadId: session.leadId,
          leadName: session.leadName,
          agentId: user.id,
          agentName: user.fullName,
          customerNumber: phone,
          fromNumber: phone,
          toNumber: user.id,
          startedAt: session.startedAt,
        });
        attachCallEvents(call, { ...session, log: saved });
        setIncomingCall({ ...session, log: saved });
      };
      client.on?.('incomingcall', handleIncoming);
      client.on?.('incomingcall2', handleIncoming);
      tokenRef.current = await callCenterService.getToken(user);
      client.connect?.(tokenRef.current);
    } catch (err) {
      setConnectionState('error');
      setError(err instanceof Error ? err.message : 'Cannot connect Stringee.');
    }
  }, [attachCallEvents, user]);

  useEffect(() => {
    void connect();
    return () => {
      void callCenterService.setPresence(user, false);
      clientRef.current?.disconnect?.();
    };
  }, [connect, user]);

  const startOutboundCall = useCallback(async (lead: Lead) => {
    if (activeCallRef.current) {
      setError('Đang có cuộc gọi đang xử lý. Vui lòng kết thúc cuộc gọi hiện tại trước khi gọi lead khác.');
      return;
    }

    try {
      setError('');
      const phone = normalizePhoneForCall(lead.phone);
      if (!phone) throw new Error('Lead chưa có SĐT hợp lệ để gọi.');
      const settings = await callCenterService.getSettings();
      const startedAt = new Date().toISOString();

      if (settings.pccMode !== false) {
        const providerCallId = `pcc-out-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const result = await callCenterService.startPccOutboundCall(lead, user, providerCallId);
        const resolvedCallId = result.providerCallId || providerCallId;
        const localLog = await callCenterService.saveLog({
          id: resolvedCallId,
          providerCallId: resolvedCallId,
          clientCallId: result.clientCallId || providerCallId,
          direction: 'outbound',
          status: 'ringing',
          leadId: lead.id,
          leadName: leadName(lead),
          agentId: user?.id,
          agentName: user?.fullName,
          customerNumber: phone,
          fromNumber: settings.fromNumber,
          toNumber: phone,
          startedAt,
          rawEvent: {
            type: 'pcc_callout_requested',
            message: result.message,
            stringeeUserId: result.userId,
          },
        }).catch((logError) => {
          console.warn('[CallCenter] Cannot persist local PCC call log:', logError);
          return undefined as CallLog | undefined;
        });
        const nextSession: CallSession = {
          id: resolvedCallId,
          providerCallId: resolvedCallId,
          direction: 'outbound',
          status: 'ringing',
          phone,
          leadId: lead.id,
          leadName: leadName(lead),
          startedAt,
          log: localLog,
        };
        activeCallRef.current = nextSession;
        setActiveCall(nextSession);
        setIncomingCall(null);
        return;
      }

      const client = clientRef.current;
      if (!client || connectionState !== 'connected') {
        throw new Error('Stringee softphone chưa kết nối. Kiểm tra env/API token hoặc reload trang.');
      }
      const CallCtor = window.StringeeCall2 || window.StringeeCall;
      if (!CallCtor) throw new Error('Stringee call constructor chưa sẵn sàng.');
      const stringeeUserId = await callCenterService.getMappedStringeeUserId(user);
      const call = new CallCtor(client, stringeeUserId || user?.id || '', phone, false);
      call.customData = JSON.stringify({
        leadId: lead.id,
        leadName: leadName(lead),
        agentId: user?.id,
        direction: 'outbound',
        customerNumber: phone,
      });
      if (!call.makeCall) throw new Error('Stringee makeCall is not ready.');
      call.makeCall(async (response: unknown) => {
        if (makeCallFailed(response)) {
          setError(`Stringee không tạo được cuộc gọi: ${responseMessage(response)}`);
          return;
        }
        const providerCallId = responseCallId(response, call) || eventCallId(call);
        const localLog = await callCenterService.saveLog({
          id: providerCallId,
          providerCallId,
          direction: 'outbound',
          status: 'ringing',
          leadId: lead.id,
          leadName: leadName(lead),
          agentId: user?.id,
          agentName: user?.fullName,
          customerNumber: phone,
          fromNumber: stringeeUserId || user?.id || '',
          toNumber: phone,
          startedAt,
          rawEvent: response && typeof response === 'object' ? response as Record<string, unknown> : { response: String(response || '') },
        });
        const session: CallSession = {
          id: providerCallId,
          providerCallId,
          direction: 'outbound',
          status: 'ringing',
          phone,
          leadId: lead.id,
          leadName: leadName(lead),
          startedAt,
          sdkCall: call,
          log: localLog,
        };
        attachCallEvents(call, session);
        setActiveCall(session);
      });
    } catch (err) {
      activeCallRef.current = null;
      setActiveCall(null);
      setIncomingCall(null);
      setError(err instanceof Error ? err.message : 'Không khởi tạo được cuộc gọi.');
    }
  }, [attachCallEvents, connectionState, user]);

  const answerIncoming = useCallback(async () => {
    if (!incomingCall) return;
    incomingCall.sdkCall?.answer?.();
    const answeredAt = new Date().toISOString();
    const next = { ...incomingCall, status: 'answered' as const, answeredAt };
    const saved = await callCenterService.saveLog({
      ...(incomingCall.log || {}),
      id: incomingCall.log?.id || incomingCall.providerCallId,
      providerCallId: incomingCall.providerCallId,
      direction: 'inbound',
      status: 'answered',
      leadId: incomingCall.leadId,
      leadName: incomingCall.leadName,
      customerNumber: incomingCall.phone,
      fromNumber: incomingCall.phone,
      toNumber: user?.id || '',
      startedAt: incomingCall.startedAt,
      answeredAt,
    });
    setActiveCall({ ...next, log: saved });
    setIncomingCall(null);
  }, [incomingCall, user?.id]);

  const answerActiveCall = useCallback(async () => {
    if (!activeCall?.sdkCall) return;
    try {
      setError('');
      await ensureMicrophonePermission();
      await maybeAwait(activeCall.sdkCall.initAnswer?.());
      const answerResult = activeCall.sdkCall.answer?.((response: unknown) => {
        if (makeCallFailed(response)) {
          setError(`Stringee không answer được agent leg: ${responseMessage(response)}`);
        }
      });
      await maybeAwait(answerResult);
      const answeredAt = new Date().toISOString();
      const next = { ...activeCall, status: 'answered' as const, answeredAt };
      const saved = await callCenterService.saveLog({
        ...(activeCall.log || {}),
        id: activeCall.log?.id || activeCall.providerCallId,
        providerCallId: activeCall.providerCallId,
        direction: activeCall.direction,
        status: 'answered',
        leadId: activeCall.leadId,
        leadName: activeCall.leadName,
        customerNumber: activeCall.phone,
        fromNumber: user?.id || '',
        toNumber: activeCall.phone,
        startedAt: activeCall.startedAt,
        answeredAt,
      });
      setActiveCall({ ...next, log: saved });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lấy được quyền microphone để nghe máy.');
    }
  }, [activeCall, user?.id]);

  const rejectIncoming = useCallback(async () => {
    if (!incomingCall) return;
    incomingCall.sdkCall?.reject?.();
    await finishSession(incomingCall, 'failed');
  }, [finishSession, incomingCall]);

  const hangup = useCallback(async () => {
    if (!activeCall) return;
    try {
      activeCall.sdkCall?.hangup?.();
    } catch (err) {
      console.warn('[CallCenter] SDK hangup failed:', err);
    }
    await finishSession(activeCall, activeCall.status === 'answered' ? 'ended' : 'failed');
  }, [activeCall, finishSession]);

  const toggleMute = useCallback(async () => {
    if (!activeCall) return;
    const muted = !activeCall.muted;
    activeCall.sdkCall?.mute?.(muted);
    setActiveCall({ ...activeCall, muted });
  }, [activeCall]);

  const saveWrapUp = useCallback(async (disposition: string, note: string) => {
    if (!pendingWrapUp) return;
    try {
      await callCenterService.wrapUp(pendingWrapUp, disposition, note);
      setPendingWrapUp(null);
    } catch (err) {
      console.warn('[CallCenter] Cannot save call wrap-up:', err);
      setError(`Không lưu được call log: ${err instanceof Error ? err.message : 'Firestore từ chối ghi log.'}`);
    }
  }, [pendingWrapUp]);

  const value = useMemo<CallCenterContextValue>(() => ({
    connectionState,
    error,
    activeCall,
    incomingCall,
    pendingWrapUp,
    startOutboundCall,
    answerActiveCall,
    answerIncoming,
    rejectIncoming,
    hangup,
    toggleMute,
    clearError,
    saveWrapUp,
    dismissWrapUp: () => setPendingWrapUp(null),
  }), [activeCall, answerActiveCall, answerIncoming, clearError, connectionState, error, hangup, incomingCall, pendingWrapUp, rejectIncoming, saveWrapUp, startOutboundCall, toggleMute]);

  return <CallCenterContext.Provider value={value}>{children}</CallCenterContext.Provider>;
}

export function useCallCenter() {
  const value = useContext(CallCenterContext);
  if (!value) throw new Error('useCallCenter must be used inside CallCenterProvider');
  return value;
}
