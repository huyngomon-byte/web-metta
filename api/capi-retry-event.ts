import { ApiError, requireAnyRole, requireApiUser } from './_apiAuth.js';
import { adminDb } from './_firebaseAdmin.js';
import { retryCapiLog } from './_metaCapi.js';

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const db = adminDb();
    const user = await requireApiUser(db, req);
    requireAnyRole(user, ['admin', 'manager', 'ads']);
    const logId = String(req.body?.id || req.body?.logId || '');
    if (!logId) return res.status(400).json({ error: 'Missing event log id.' });
    const result = await retryCapiLog(db, req, logId);
    return res.status(200).json(result);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Retry CAPI event failed.';
    return res.status(status).json({ error: message });
  }
}
