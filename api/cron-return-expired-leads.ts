import { adminDb } from './_firebaseAdmin.js';
import { createAppNotification, notifyLeadManagers } from './_notifications.js';

const DAY_MS = 24 * 60 * 60 * 1000;

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

function leadAssignmentExpired(lead: Record<string, any>, nowMs: number) {
  if (!lead.assignedTo || lead.assignedStatus !== 'active') return false;
  const assignedAtMs = Number(lead.assignedAtMs || 0);
  const expiresAtMs = Number(lead.assignedExpiresAtMs || 0) || (assignedAtMs ? assignedAtMs + DAY_MS : 0);
  return Boolean(expiresAtMs && expiresAtMs <= nowMs);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method && !['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Unauthorized' });

  const db = adminDb();
  const nowMs = Date.now();
  const timestamp = new Date(nowMs).toISOString();
  const [expiresSnap, legacySnap] = await Promise.all([
    db.collection('leads')
      .where('assignedStatus', '==', 'active')
      .where('assignedExpiresAtMs', '<=', nowMs)
      .get(),
    db.collection('leads')
      .where('assignedStatus', '==', 'active')
      .where('assignedAtMs', '<=', nowMs - DAY_MS)
      .get(),
  ]);
  const expiredDocs = Array.from(
    new Map(
      [...expiresSnap.docs, ...legacySnap.docs]
        .filter((docSnap) => leadAssignmentExpired(docSnap.data(), nowMs))
        .map((docSnap) => [docSnap.id, docSnap]),
    ).values(),
  );

  if (!expiredDocs.length) return res.status(200).json({ ok: true, returned: 0 });

  const batch = db.batch();
  const managerNotifications: Promise<unknown>[] = [];
  expiredDocs.forEach((docSnap) => {
    const lead = docSnap.data();
    const failedAssignedTo = String(lead.assignedTo || '');
    const failedAssignedToName = String(lead.assignedToName || failedAssignedTo);
    const leadName = String(lead.studentName || lead.fullName || lead.parentName || lead.phone || 'Lead');

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

    if (failedAssignedTo) {
      managerNotifications.push(createAppNotification(db, {
        type: 'pipeline_alert',
        userId: failedAssignedTo,
        title: 'Lead đã bị trả về',
        body: `${leadName} bị trả về do quá 24 giờ chưa cập nhật status.`,
        leadId: docSnap.id,
        url: '/crm/tasks',
        createdAt: timestamp,
      }));
    }

    managerNotifications.push(notifyLeadManagers(db, {
      type: 'pipeline_alert',
      title: 'Lead bị trả về từ sales',
      body: `${leadName} bị trả về. Sales cũ: ${failedAssignedToName || 'Chưa rõ'}.`,
      leadId: docSnap.id,
      url: '/crm/lead-assignment',
      createdAt: timestamp,
    }));
  });

  await batch.commit();
  await Promise.all(managerNotifications).catch((error) => console.warn('[CronReturnLeads] Notification failed:', error));
  return res.status(200).json({ ok: true, returned: expiredDocs.length });
}
