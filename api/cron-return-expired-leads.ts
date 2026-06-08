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
  const nowMs = Date.now();
  const timestamp = new Date(nowMs).toISOString();
  const snap = await db.collection('leads')
    .where('assignedStatus', '==', 'active')
    .where('assignedExpiresAtMs', '<=', nowMs)
    .get();

  if (snap.empty) return res.status(200).json({ ok: true, returned: 0 });

  const batch = db.batch();
  snap.docs.forEach((docSnap) => {
    const lead = docSnap.data();
    const failedAssignedTo = String(lead.assignedTo || '');
    const failedAssignedToName = String(lead.assignedToName || failedAssignedTo);

    batch.set(docSnap.ref, {
      assignedTo: '',
      assignedToName: '',
      failedAssignedTo,
      failedAssignedToName,
      failedAt: timestamp,
      failedAtMs: nowMs,
      failedReason: 'no_status_update_24h',
      assignedStatus: 'returned',
      updatedAt: timestamp,
    }, { merge: true });

    const activityRef = db.collection('leadActivities').doc();
    batch.set(activityRef, {
      id: activityRef.id,
      leadId: docSnap.id,
      type: 'note',
      content: `Lead bị trả về do không cập nhật status sau 24h. Sales cũ: ${failedAssignedToName}`,
      createdBy: 'system',
      createdAt: timestamp,
    });

    const auditRef = db.collection('activityLogs').doc();
    batch.set(auditRef, {
      id: auditRef.id,
      type: 'lead_assignment_returned',
      leadId: docSnap.id,
      failedAssignedTo,
      failedAssignedToName,
      reason: 'no_status_update_24h',
      actorId: 'system',
      createdAt: timestamp,
      createdAtMs: nowMs,
    });
  });

  await batch.commit();
  return res.status(200).json({ ok: true, returned: snap.size });
}
