import { adminAuth, adminDb } from '../../api/_firebaseAdmin.js';
import { stringeeRestToken } from '../../api/_stringee.js';

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader?: (name: string, value: string) => void;
  send?: (body: unknown) => void;
  redirect?: (status: number, url: string) => void;
};

function first(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function bearer(req: VercelRequest) {
  const raw = first(req.headers.authorization || req.headers.Authorization);
  return raw?.replace(/^Bearer\s+/i, '').trim() || first(req.query?.token) || '';
}

async function verifyIfRequired(req: VercelRequest) {
  if (process.env.REQUIRE_RECORDING_AUTH !== 'true') return true;
  const token = bearer(req);
  if (!token) return false;
  const decoded = await adminAuth().verifyIdToken(token).catch(() => null);
  return Boolean(decoded?.uid);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!await verifyIfRequired(req)) return res.status(401).json({ error: 'Unauthorized' });

  const callLogId = first(req.query?.callLogId) || first(req.query?.callId) || '';
  if (!callLogId) return res.status(400).json({ error: 'Missing callLogId' });

  const db = adminDb();
  const snap = await db.collection('callLogs').doc(callLogId).get().catch(() => null);
  if (!snap?.exists) return res.status(404).json({ error: 'Call log not found' });
  const log = snap.data() as { recordingUrl?: string };
  if (!log.recordingUrl) return res.status(404).json({ error: 'Recording URL is not available yet' });

  try {
    const response = await fetch(log.recordingUrl, {
      headers: { 'X-STRINGEE-AUTH': stringeeRestToken() },
    });
    if (!response.ok) {
      if (res.redirect) return res.redirect(302, log.recordingUrl);
      return res.status(502).json({ error: `Stringee recording responded with ${response.status}` });
    }
    const contentType = response.headers.get('content-type') || 'audio/mpeg';
    const buffer = Buffer.from(await response.arrayBuffer());
    res.setHeader?.('Content-Type', contentType);
    res.setHeader?.('Content-Disposition', `inline; filename="${callLogId}.mp3"`);
    return res.status(200).send?.(buffer);
  } catch (error) {
    if (res.redirect) return res.redirect(302, log.recordingUrl);
    return res.status(502).json({ error: error instanceof Error ? error.message : 'Cannot proxy recording' });
  }
}
