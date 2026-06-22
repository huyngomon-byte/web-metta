import { normalizePhone, requestBaseUrl, verifyStringeeSignature } from '../../api/_stringee.js';

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
  query?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function field(req: VercelRequest, key: string) {
  return first(req.query?.[key]) || req.body?.[key] || '';
}

function compact<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== '')) as T;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!verifyStringeeSignature(req)) return res.status(401).json({ error: 'Invalid Stringee signature' });

  const fromNumber = normalizePhone(String(field(req, 'fromNumber') || field(req, 'from_number') || ''));
  const customerNumber = normalizePhone(String(field(req, 'customerNumber') || field(req, 'customer_number') || field(req, 'toNumber') || ''));
  if (!fromNumber || !customerNumber) {
    return res.status(400).json({ error: 'Missing fromNumber or customerNumber for Stringee answer URL' });
  }

  const eventUrl = `${requestBaseUrl(req)}/api/call/event`;
  const customData = compact({
    direction: 'outbound',
    providerCallId: String(field(req, 'providerCallId') || field(req, 'callId') || field(req, 'call_id') || ''),
    clientCallId: String(field(req, 'clientCallId') || ''),
    leadId: String(field(req, 'leadId') || ''),
    leadName: String(field(req, 'leadName') || ''),
    agentId: String(field(req, 'agentId') || ''),
    agentName: String(field(req, 'agentName') || ''),
    stringeeAgentId: String(field(req, 'stringeeAgentId') || ''),
    customerNumber,
    fromNumber,
  });

  return res.status(200).json([
    {
      action: 'record',
      eventUrl,
      format: 'mp3',
    },
    {
      action: 'connect',
      eventUrl,
      from: { type: 'external', number: fromNumber, alias: 'METTA Academy' },
      to: { type: 'external', number: customerNumber, alias: customerNumber },
      customData: JSON.stringify(customData),
      timeout: 45,
      maxConnectTime: -1,
      peerToPeerCall: false,
    },
  ]);
}
