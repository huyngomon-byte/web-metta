import { adminAuth } from '../_firebaseAdmin.js';
import { stringeeClientToken } from '../_stringee.js';

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

function bearerToken(req: VercelRequest) {
  const value = req.headers.authorization || req.headers.Authorization;
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.replace(/^Bearer\s+/i, '').trim() || '';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const token = bearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing Firebase ID token' });

  const decoded = await adminAuth().verifyIdToken(token).catch(() => null);
  if (!decoded?.uid) return res.status(401).json({ error: 'Invalid Firebase ID token' });

  const requestedCrmUserId = String(req.body?.crmUserId || decoded.uid);
  if (requestedCrmUserId !== decoded.uid && decoded.role !== 'admin') {
    return res.status(403).json({ error: 'Cannot issue token for another user' });
  }

  const stringeeUserId = String(req.body?.stringeeUserId || decoded.uid).trim();
  if (!stringeeUserId) return res.status(400).json({ error: 'Missing Stringee userId' });

  try {
    const payload = stringeeClientToken(stringeeUserId);
    return res.status(200).json({ ...payload, userId: stringeeUserId });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Cannot issue Stringee token' });
  }
}
