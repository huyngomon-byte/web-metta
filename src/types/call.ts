export type CallDirection = 'outbound' | 'inbound';
export type CallProvider = 'stringee';
export type CallStatus = 'queued' | 'ringing' | 'answered' | 'ended' | 'missed' | 'failed';

export const DEFAULT_CALL_DISPOSITIONS = [
  'Nghe máy - quan tâm',
  'Nghe máy - hẹn gọi lại',
  'Không nghe máy',
  'Máy bận',
  'Sai số',
  'Phụ huynh từ chối',
  'Đã đặt lịch tư vấn',
  'Đã báo phí',
  'Khác',
] as const;

export interface CallCenterUserMapping {
  crmUserId: string;
  crmName: string;
  stringeeUserId: string;
  active: boolean;
  agentPhoneNumber?: string;
  routingType?: 1 | 2;
  answerTimeoutSec?: number;
}

export interface CallCenterSettings {
  provider: CallProvider;
  enabled: boolean;
  pccMode: boolean;
  fromNumber: string;
  fallbackAgentId: string;
  fallbackAgentName: string;
  userMappings: CallCenterUserMapping[];
  dispositions: string[];
  updatedAt?: string;
}

export interface AgentPresence {
  userId: string;
  stringeeUserId: string;
  online: boolean;
  lastSeenAt: string;
  currentCallId?: string;
}

export interface CallLog {
  id: string;
  provider: CallProvider;
  providerCallId: string;
  direction: CallDirection;
  status: CallStatus;
  leadId?: string;
  leadName?: string;
  agentId?: string;
  agentName?: string;
  fromNumber: string;
  toNumber: string;
  customerNumber: string;
  startedAt: string;
  answeredAt?: string;
  endedAt?: string;
  durationSec?: number;
  recordingUrl?: string;
  recordingExpiresAt?: string;
  disposition?: string;
  note?: string;
  createdAt: string;
  updatedAt: string;
  rawEvent?: Record<string, unknown>;
}

export interface StartCallPayload {
  leadId: string;
  leadName: string;
  phone: string;
  parentName?: string;
  studentName?: string;
}
