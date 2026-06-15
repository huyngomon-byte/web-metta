import { adminDb } from './_firebaseAdmin.js';
import { createAppNotification, notifyLeadManagers } from './_notifications.js';

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
  const notifications: Promise<unknown>[] = [];
  snap.docs.forEach((docSnap) => {
    const appointment = docSnap.data();
    const title = String(appointment.title || 'Lịch hẹn');
    const assignedTo = String(appointment.assignedTo || '');
    batch.set(docSnap.ref, {
      status: 'overdue',
      updatedAt: timestamp,
    }, { merge: true });

    if (assignedTo) {
      notifications.push(createAppNotification(db, {
        type: 'appointment_due',
        userId: assignedTo,
        title: 'Lịch hẹn đã quá hạn',
        body: `${title} cần được cập nhật trạng thái.`,
        leadId: String(appointment.leadId || ''),
        url: '/crm/tasks',
        createdAt: timestamp,
      }));
    }
  });

  await batch.commit();
  await notifyLeadManagers(db, {
    type: 'appointment_due',
    title: `${snap.size} lịch hẹn quá hạn`,
    body: 'Cần kiểm tra và nhắc sales cập nhật trạng thái lịch hẹn.',
    url: '/appointments',
    createdAt: timestamp,
  }).catch((error) => console.warn('[CronOverdueAppointments] Manager notification failed:', error));
  await Promise.all(notifications).catch((error) => console.warn('[CronOverdueAppointments] Sales notification failed:', error));
  return res.status(200).json({ ok: true, overdue: snap.size });
}
