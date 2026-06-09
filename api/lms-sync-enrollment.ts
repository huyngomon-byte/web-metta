import crypto from 'node:crypto';
import { adminDb } from './_firebaseAdmin.js';

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

function joinUrl(baseUrl: string, path: string) {
  const base = baseUrl.replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}

function signature(secret: string, body: string) {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function writeLog(data: Record<string, unknown>) {
  try {
    const db = adminDb();
    const ref = db.collection('lmsSyncLogs').doc();
    await ref.set({ id: ref.id, createdAt: new Date().toISOString(), ...data });
  } catch (error) {
    console.warn('Cannot write LMS sync log', error);
  }
}

function parseJsonSafe(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const payload = req.body || {};
  const leadId = payload?.lead?.id || payload?.raw?.lead?.id || '';
  if (!leadId || payload.schemaVersion !== 'metta-lms-enrollment-v1') {
    return res.status(400).json({ ok: false, message: 'Invalid LMS enrollment payload.' });
  }

  const baseUrl = process.env.LMS_API_BASE_URL || '';
  const endpointPath = process.env.LMS_ENROLLMENT_PATH || '/api/enrollments';
  const eventId = payload.eventId || `lms_${leadId}_${Date.now()}`;
  const body = JSON.stringify(payload);

  if (!baseUrl) {
    const result = {
      ok: true,
      skipped: true,
      requestId: eventId,
      message: 'LMS_API_BASE_URL is not configured. Payload accepted as dry-run.',
    };
    await writeLog({
      leadId,
      eventId,
      status: 'skipped',
      message: result.message,
      payloadPreview: {
        studentName: payload?.student?.name || '',
        parentPhone: payload?.parent?.phone || '',
        revenue: payload?.finance?.revenue || 0,
        course: payload?.enrollment?.interestedCourse || '',
      },
    });
    return res.status(200).json(result);
  }

  const authHeader = process.env.LMS_AUTH_HEADER || 'Authorization';
  const authScheme = process.env.LMS_AUTH_SCHEME || 'Bearer';
  const apiKey = process.env.LMS_API_KEY || '';
  const webhookSecret = process.env.LMS_WEBHOOK_SECRET || '';
  const timeoutMs = Number(process.env.LMS_TIMEOUT_MS || 12000);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-METTA-Event': payload.eventName || 'enrollment.created',
    'X-Idempotency-Key': eventId,
  };
  if (apiKey) headers[authHeader] = authScheme ? `${authScheme} ${apiKey}` : apiKey;
  if (webhookSecret) headers['X-METTA-Signature'] = signature(webhookSecret, body);

  try {
    const response = await fetch(joinUrl(baseUrl, endpointPath), {
      method: 'POST',
      headers,
      body,
      signal: controller.signal,
    });
    const text = await response.text();
    const parsed = parseJsonSafe(text);
    const result = {
      ok: response.ok,
      status: response.status,
      requestId: eventId,
      externalId: typeof parsed === 'object' && parsed && 'externalId' in parsed ? (parsed as any).externalId : undefined,
      message: response.ok ? 'Synced to LMS.' : `LMS responded with ${response.status}.`,
      result: parsed,
    };
    await writeLog({
      leadId,
      eventId,
      status: response.ok ? 'success' : 'failed',
      message: result.message,
      responseStatus: response.status,
      responsePreview: text.slice(0, 1200),
    });
    return res.status(response.ok ? 200 : 502).json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cannot connect to LMS.';
    await writeLog({ leadId, eventId, status: 'failed', message });
    return res.status(504).json({ ok: false, requestId: eventId, message });
  } finally {
    clearTimeout(timeout);
  }
}
