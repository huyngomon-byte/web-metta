import { ApiError, requireAnyRole, requireApiUser } from './_apiAuth.js';
import { adminDb } from './_firebaseAdmin.js';
import { capiEventsForLeadStatus, capiRuntimeSummary, retryCapiLog, sendLeadCapiSignal, sendManualCapiEvent } from './_metaCapi.js';

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: any;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

function canSendStatusEvent(user: { id: string; role: string }, lead: Record<string, any>) {
  if (user.role === 'admin' || user.role === 'manager') return true;
  return user.role === 'sales' && lead.assignedTo === user.id;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const db = adminDb();
    const user = await requireApiUser(db, req);
    if (req.method === 'GET') {
      requireAnyRole(user, ['admin', 'manager', 'ads']);
      return res.status(200).json(capiRuntimeSummary());
    }

    const action = String(req.body?.action || 'send');

    if (action === 'retry') {
      requireAnyRole(user, ['admin', 'manager', 'ads']);
      const logId = String(req.body?.id || req.body?.logId || '');
      if (!logId) return res.status(400).json({ error: 'Missing event log id.' });
      const result = await retryCapiLog(db, logId);
      return res.status(200).json(result);
    }

    if (action === 'lead-status') {
      const leadId = String(req.body?.leadId || '');
      const previousStatus = String(req.body?.previousStatus || '');
      const nextStatus = String(req.body?.nextStatus || '');
      if (!leadId || !nextStatus) return res.status(400).json({ error: 'Missing leadId or nextStatus.' });
      if (previousStatus && previousStatus === nextStatus) {
        return res.status(200).json({ ok: true, skipped: true, reason: 'Status unchanged.' });
      }

      const leadSnap = await db.collection('leads').doc(leadId).get();
      if (!leadSnap.exists) return res.status(404).json({ error: 'Lead not found.' });
      const lead = { id: leadSnap.id, ...leadSnap.data(), status: nextStatus };
      if (!canSendStatusEvent(user, lead)) throw new ApiError(403, 'You do not have permission for this lead.');

      const events = capiEventsForLeadStatus(nextStatus);
      if (!events.length) {
        return res.status(200).json({ ok: true, skipped: true, reason: 'No CAPI mapping for this status.' });
      }

      const results = [];
      for (const eventName of events) {
        results.push(await sendLeadCapiSignal({
          db,
          lead,
          eventName,
          previousStatus,
          nextStatus,
          source: 'server',
        }));
      }
      return res.status(200).json({ ok: true, results });
    }

    requireAnyRole(user, ['admin', 'manager', 'ads']);
    const result = await sendManualCapiEvent(db, req, req.body || {});
    return res.status(result.ok || result.queued ? 200 : 400).json(result);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'CAPI server event failed.';
    return res.status(status).json({ error: message });
  }
}
