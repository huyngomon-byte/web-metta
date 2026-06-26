export interface CapiSettings {
  id: string;
  pixelId: string;
  accessToken: string;
  testEventCode: string;
  defaultSourceUrl: string;
  enableBrowserPixel: boolean;
  enableServerCapi: boolean;
  enableDeduplication: boolean;
  updatedAt: string;
}

export interface CapiMapping {
  id: string;
  formId: string;
  formName: string;
  eventName: string;
  landingPageSlug: string;
  enabled: boolean;
  sendBrowserEvent: boolean;
  sendServerEvent: boolean;
  customDataFields: string[];
  updatedAt: string;
}

export interface CapiEventLog {
  id: string;
  eventName: string;
  eventId: string;
  source: 'browser' | 'server' | 'test' | 'retry';
  sourceUrl: string;
  leadId?: string;
  formId?: string;
  mode?: 'production' | 'test';
  status: 'success' | 'failed' | 'pending' | 'skipped';
  responseMessage: string;
  ledgerId?: string;
  attempts?: number;
  httpStatus?: number;
  createdAt: string;
  updatedAt?: string;
  payloadPreview: Record<string, unknown>;
  retryCount?: number;
  lastRetryAt?: string;
  hasEm?: boolean;
  hasPh?: boolean;
  hasFbp?: boolean;
  hasFbc?: boolean;
  hasExternalId?: boolean;
  usedCustomerMeta?: boolean;
}

export interface CapiRuntimeConfig {
  mode: 'production' | 'test';
  vercelEnv: string;
  capiEnabled: boolean;
  browserPixelEnabled: boolean;
  pixelId: string;
  browserPixelId: string;
  pixelIdsMatch: boolean;
  accessTokenConfigured: boolean;
  testEventCodeConfigured: boolean;
  testEventCodeActive: boolean;
  testEventCodeMasked: string;
  graphVersion: string;
  timeoutMs: number;
  manualEventsEnabled: boolean;
  eventToggles: Record<'Lead' | 'QualifiedLead' | 'InitiateCheckout' | 'Purchase' | 'LeadFailed', boolean>;
  statusMappings: Array<{
    status: string;
    eventName: string;
    destination: string;
  }>;
}
