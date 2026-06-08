import type { LeadPriorityLevel } from '@/types/crm';

export type SourcePlatform = 'Meta' | 'Website' | 'Zalo OA' | 'Google Ads' | 'TikTok Ads' | 'Manual' | 'Import' | 'Other';
export type ConnectorStatus = 'connected' | 'testing' | 'needs_setup' | 'paused';
export type AttributionStatus = 'matched' | 'review' | 'warning';
export type RuleMatchField = 'source_id' | 'form_id' | 'utm_source' | 'utm_campaign' | 'pixel_id' | 'referrer' | 'page_slug' | 'manual_source';
export type RuleOperator = 'equals' | 'contains' | 'starts_with' | 'exists';

export interface SourceChannel {
  id: string;
  name: string;
  platform: SourcePlatform;
  priorityLevel: LeadPriorityLevel;
  defaultCenter: string;
  defaultCourse: string;
  routingHint: string;
  description: string;
  active: boolean;
  updatedAt: string;
}

export interface SourceConnector {
  id: string;
  name: string;
  platform: SourcePlatform;
  captureMethod: 'Webhook' | 'API' | 'Pixel/CAPI' | 'Website Form' | 'Manual';
  status: ConnectorStatus;
  credentialStatus: 'ok' | 'missing' | 'expired' | 'not_required';
  identifiers: string;
  lastSyncAt: string;
  testStatus: string;
  updatedAt: string;
}

export interface AttributionRule {
  id: string;
  name: string;
  order: number;
  active: boolean;
  matchField: RuleMatchField;
  operator: RuleOperator;
  matchValue: string;
  sourceId: string;
  confidence: number;
  notes: string;
  updatedAt: string;
}

export interface AttributionLog {
  id: string;
  leadName: string;
  rawChannel: string;
  campaign: string;
  sourceName: string;
  matchedRuleName: string;
  confidence: number;
  status: AttributionStatus;
  receivedAt: string;
}

export interface SourceEngineState {
  sources: SourceChannel[];
  connectors: SourceConnector[];
  rules: AttributionRule[];
  logs: AttributionLog[];
}

export type AttributionPayload = Partial<Record<RuleMatchField, string>> & {
  leadName?: string;
  rawChannel?: string;
};

export interface AttributionResult {
  source?: SourceChannel;
  rule?: AttributionRule;
  confidence: number;
  status: AttributionStatus;
}
