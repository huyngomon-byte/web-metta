import { adminDb } from './_firebaseAdmin.js';

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

function firstValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function isAuthorized(req: VercelRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const authorization = firstValue(req.headers.authorization);
  return authorization === `Bearer ${secret}` ||
    firstValue(req.headers['x-cron-secret']) === secret ||
    firstValue(req.query?.secret) === secret;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method && !['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  const db = adminDb();
  const timestamp = new Date().toISOString();
  const snap = await db.collection('appointments')
    .where('status', '==', 'upcoming')
    .where('startTime', '<', timestamp)
    .get();

  if (snap.empty) return res.status(200).json({ ok: true, overdue: 0 });

  const batch = db.batch();
  snap.docs.forEach((docSnap) => {
    batch.set(docSnap.ref, {
      status: 'overdue',
      updatedAt: timestamp,
    }, { merge: true });
  });

  await batch.commit();
  return res.status(200).json({ ok: true, overdue: snap.size });
}
