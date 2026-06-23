import crypto from 'node:crypto';

type HeaderValue = string | string[] | undefined;
const DEFAULT_STRINGEE_FROM_NUMBER = '842488921797';

export function firstHeader(value: HeaderValue) {
  return Array.isArray(value) ? value[0] : value;
}

function base64Url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

export function signJwt(payload: Record<string, unknown>, secret: string, header: Record<string, unknown> = {}) {
  const encodedHeader = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT', ...header }));
  const encodedPayload = base64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();
  return `${encodedHeader}.${encodedPayload}.${base64Url(signature)}`;
}

export function stringeeClientToken(userId: string) {
  const sid = process.env.STRINGEE_API_SID;
  const secret = process.env.STRINGEE_API_SECRET;
  if (!sid || !secret) throw new Error('Missing STRINGEE_API_SID or STRINGEE_API_SECRET');
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return {
    token: signJwt({
      jti: `${sid}-${Date.now()}`,
      iss: sid,
      exp,
      userId,
      icc_api: true,
    }, secret, { cty: 'stringee-api;v=1' }),
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

export function stringeeRestToken() {
  const sid = process.env.STRINGEE_API_SID;
  const secret = process.env.STRINGEE_API_SECRET;
  if (!sid || !secret) throw new Error('Missing STRINGEE_API_SID or STRINGEE_API_SECRET');
  const exp = Math.floor(Date.now() / 1000) + 300;
  return signJwt({
    jti: `${sid}-rest-${Date.now()}`,
    iss: sid,
    exp,
    rest_api: true,
  }, secret, { cty: 'stringee-api;v=1' });
}

export async function stringeePccCallout(input: {
  agentUserId: string;
  customerNumber: string;
  fromNumber?: string;
  toAgentFromNumberDisplay?: string;
  toAgentFromNumberDisplayAlias?: string;
}) {
  const fromNumber = normalizePhone(input.fromNumber || process.env.STRINGEE_FROM_NUMBER || DEFAULT_STRINGEE_FROM_NUMBER);
  const customerNumber = normalizePhone(input.customerNumber);
  if (!input.agentUserId) throw new Error('Missing Stringee agentUserId');
  if (!customerNumber) throw new Error('Missing customer phone number');
  if (!fromNumber) throw new Error('Missing Stringee from number');

  const body = {
    agentUserId: input.agentUserId,
    toAgentFromNumberDisplay: input.toAgentFromNumberDisplay || `Call-out-from-${fromNumber}`,
    toAgentFromNumberDisplayAlias: input.toAgentFromNumberDisplayAlias || `Call-out-from-${fromNumber}-Alias`,
    toCustomerFromNumber: fromNumber,
    customerNumber,
  };

  const response = await fetch('https://icc-api.stringee.com/v1/call/callout', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-STRINGEE-AUTH': stringeeRestToken(),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Stringee PCC callout HTTP ${response.status}`);
  }
  const result = Number(payload?.r);
  if (Number.isFinite(result) && result !== 0) {
    const message = String(payload?.message || payload?.msg || `Stringee PCC callout failed (${result})`);
    if (message.toLowerCase().includes('number not found') || message.toLowerCase().includes('from_number_not_found')) {
      throw new Error(`${message}. Kiểm tra hotline trong PCC: number phải được add vào portal, bật Allow call-out và cho phép group/agent đang gọi.`);
    }
    throw new Error(message);
  }
  return { payload, request: body };
}

export async function stringeePhoneBridgeCallout(input: {
  agentPhoneNumber: string;
  customerNumber: string;
  fromNumber?: string;
  eventUrl?: string;
  customData?: Record<string, unknown>;
}) {
  const fromNumber = normalizePhone(input.fromNumber || process.env.STRINGEE_FROM_NUMBER || DEFAULT_STRINGEE_FROM_NUMBER);
  const agentPhoneNumber = normalizePhone(input.agentPhoneNumber);
  const customerNumber = normalizePhone(input.customerNumber);
  if (!agentPhoneNumber) throw new Error('Missing agent phone number');
  if (!customerNumber) throw new Error('Missing customer phone number');
  if (!fromNumber) throw new Error('Missing Stringee from number');

  const actions = [
    ...(input.eventUrl ? [{
      action: 'record',
      eventUrl: input.eventUrl,
      format: 'mp3',
    }] : []),
    {
      action: 'connect',
      from: { type: 'external', number: fromNumber, alias: 'METTA Academy' },
      to: { type: 'external', number: customerNumber, alias: customerNumber },
    },
  ];

  const body = {
    from: { type: 'external', number: fromNumber, alias: 'METTA Academy' },
    to: [{ type: 'external', number: agentPhoneNumber, alias: agentPhoneNumber }],
    event_url: input.eventUrl,
    actions,
    customData: JSON.stringify({
      direction: 'outbound',
      fromNumber,
      agentPhoneNumber,
      customerNumber,
      ...(input.customData || {}),
    }),
  };

  const response = await fetch('https://api.stringee.com/v1/call2/callout', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-STRINGEE-AUTH': stringeeRestToken(),
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Stringee phone bridge callout HTTP ${response.status}`);
  }
  const result = Number(payload?.r);
  if (Number.isFinite(result) && result !== 0) {
    throw new Error(String(payload?.message || payload?.msg || `Stringee phone bridge callout failed (${result})`));
  }
  return { payload, request: body };
}

export async function stringeePccAgentByUserId(userId: string) {
  const target = String(userId || '').trim();
  if (!target) return null;
  const response = await fetch('https://icc-api.stringee.com/v1/agent?limit=100', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-STRINGEE-AUTH': stringeeRestToken(),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Stringee agent list HTTP ${response.status}`);
  }
  const result = Number(payload?.r);
  if (Number.isFinite(result) && result !== 0) {
    throw new Error(String(payload?.message || payload?.msg || `Stringee agent list failed (${result})`));
  }
  const agents = Array.isArray(payload?.data?.agents) ? payload.data.agents : [];
  return agents.find((agent: Record<string, unknown>) => String(agent.stringee_user_id || '').trim() === target) || null;
}

export function normalizePhone(phone?: string) {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+84')) return `84${digits.slice(3)}`;
  if (digits.startsWith('84')) return digits;
  if (digits.startsWith('0')) return `84${digits.slice(1)}`;
  return digits;
}

export function requestBaseUrl(req: { headers?: Record<string, HeaderValue> }) {
  const configured = process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, '');
  const proto = firstHeader(req.headers?.['x-forwarded-proto']) || 'https';
  const host = firstHeader(req.headers?.host) || process.env.VERCEL_URL || 'www.metta.edu.vn';
  return `${proto}://${host}`.replace(/\/+$/, '');
}

export function verifyStringeeSignature(req: { headers?: Record<string, HeaderValue>; body?: unknown }) {
  const secret = process.env.STRINGEE_SIGNING_SECRET;
  if (!secret) return true;
  const supplied = firstHeader(req.headers?.['x-stringee-signature'])
    || firstHeader(req.headers?.['x-stringee-request-signature'])
    || firstHeader(req.headers?.signature);
  if (!supplied) return false;
  const raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export function sccoRecord(actionUrl: string) {
  return {
    action: 'record',
    eventUrl: actionUrl,
    format: 'mp3',
  };
}

export function sccoConnectToUser(userId: string, eventUrl: string) {
  return {
    action: 'connect',
    eventUrl,
    from: { type: 'external', number: process.env.STRINGEE_FROM_NUMBER || DEFAULT_STRINGEE_FROM_NUMBER, alias: 'METTA Academy' },
    to: { type: 'internal', number: userId, alias: userId },
  };
}

export function sccoConnectToPhone(phone: string, eventUrl: string) {
  return {
    action: 'connect',
    eventUrl,
    from: { type: 'external', number: process.env.STRINGEE_FROM_NUMBER || DEFAULT_STRINGEE_FROM_NUMBER, alias: 'METTA Academy' },
    to: { type: 'external', number: normalizePhone(phone), alias: normalizePhone(phone) },
  };
}
