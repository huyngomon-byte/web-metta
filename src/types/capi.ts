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
  source: 'browser' | 'server' | 'test';
  sourceUrl: string;
  leadId?: string;
  formId?: string;
  status: 'success' | 'failed' | 'pending';
  responseMessage: string;
  createdAt: string;
  payloadPreview: Record<string, unknown>;
}
