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

function sha256(value?: string) {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = process.env.META_ACCESS_TOKEN;
  const pixelId = process.env.META_PIXEL_ID;
  if (!token || !pixelId) return res.status(500).json({ error: 'Missing Meta CAPI environment variables' });

  const body = req.body || {};
  const eventId = body.event_id || `metta_${Date.now()}`;
  const payload = {
    data: [
      {
        event_name: body.event_name || 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: 'website',
        event_source_url: body.event_source_url,
        user_data: {
          em: sha256(body.email),
          ph: sha256(body.phone),
          client_ip_address: req.headers['x-forwarded-for'],
          client_user_agent: req.headers['user-agent'],
          fbp: body.fbp,
          fbc: body.fbc
        },
        custom_data: body.custom_data || {}
      }
    ],
    ...(process.env.META_TEST_EVENT_CODE ? { test_event_code: process.env.META_TEST_EVENT_CODE } : {})
  };

  const response = await fetch(`https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await response.json();

  try {
    const db = adminDb();
    const logRef = db.collection('capiEvents').doc();
    await logRef.set({
      id: logRef.id,
      eventName: payload.data[0].event_name,
      eventId,
      formId: body.formId || body.form_id || '',
      leadId: body.leadId || body.lead_id || '',
      sourceUrl: body.event_source_url || '',
      status: response.ok ? 'success' : 'failed',
      responseMessage: JSON.stringify(result).slice(0, 800),
      payloadPreview: {
        event_name: payload.data[0].event_name,
        custom_data: payload.data[0].custom_data,
      },
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.warn('Cannot write CAPI log', error);
  }

  return res.status(response.ok ? 200 : 400).json({ eventId, ok: response.ok, result });
}
