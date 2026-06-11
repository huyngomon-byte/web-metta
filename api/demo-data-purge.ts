import { adminAuth, adminDb } from './_firebaseAdmin.js';

type VercelRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

const DEMO_LEAD_PREFIXES = ['lead-demo-stage-', 'lead-demo-priority-'];
const DEMO_APPOINTMENT_PREFIXES = ['ap-demo-stage-consultation-', 'ap-demo-priority-consultation-'];
type FirestoreData = Record<string, unknown>;

function bearer(req: VercelRequest) {
  const raw = req.headers?.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.startsWith('Bearer ') ? value.slice(7) : '';
}

async function requireLeadManager(req: VercelRequest) {
  const token = bearer(req);
  if (!token) throw new Error('Missing auth token');
  const decoded = await adminAuth().verifyIdToken(token);
  const snap = await adminDb().collection('users').doc(decoded.uid).get();
  const role = snap.exists ? snap.data()?.role : decoded.role;
  const active = snap.exists ? snap.data()?.active !== false : true;
  if (!active || !['admin', 'manager'].includes(String(role || ''))) throw new Error('Only admin or manager can purge demo data');
  return decoded;
}

function isDemoLeadId(id?: string) {
  const value = String(id || '');
  return DEMO_LEAD_PREFIXES.some((prefix) => value.startsWith(prefix))
    || /^lead-[1-5]$/.test(value)
    || /^lead-x\d+$/.test(value);
}

function isSampleEmail(email?: string) {
  const value = String(email || '').toLowerCase();
  return value.includes('@metta.test') || value.includes('@example.com');
}

function textIncludesDemo(values: unknown[]) {
  const text = values.map((value) => String(value || '').toLowerCase()).join(' ');
  return text.includes('demo lead')
    || text.includes('demo parent')
    || text.includes('demo.stage')
    || text.includes('metta.test');
}

function isDemoLead(data: FirestoreData, id: string) {
  return isDemoLeadId(id)
    || isSampleEmail(data.email)
    || textIncludesDemo([data.initialNote, data.dealNote, data.lostNote, data.notes]);
}

function isDemoParentProfile(data: FirestoreData, id: string) {
  return isSampleEmail(data.email)
    || textIncludesDemo([id, data.email, data.notes, data.knownFrom]);
}

function isDemoAppointment(data: FirestoreData, id: string, demoLeadIds: Set<string>) {
  const leadId = String(data.leadId || '');
  return DEMO_APPOINTMENT_PREFIXES.some((prefix) => id.startsWith(prefix))
    || /^ap-[1-5]$/.test(id)
    || isDemoLeadId(leadId)
    || demoLeadIds.has(leadId)
    || textIncludesDemo([data.notes, data.title]);
}

async function deleteDocs(paths: string[]) {
  const db = adminDb();
  let deleted = 0;
  for (let i = 0; i < paths.length; i += 450) {
    const batch = db.batch();
    paths.slice(i, i + 450).forEach((path) => batch.delete(db.doc(path)));
    await batch.commit();
    deleted += Math.min(450, paths.length - i);
  }
  return deleted;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    await requireLeadManager(req);
    const db = adminDb();
    const demoLeadIds = new Set<string>();
    const leadDeletePaths: string[] = [];

    const leadSnap = await db.collection('leads').get();
    leadSnap.docs.forEach((docSnap) => {
      if (!isDemoLead(docSnap.data(), docSnap.id)) return;
      demoLeadIds.add(docSnap.id);
      leadDeletePaths.push(docSnap.ref.path);
    });

    const activitySnap = await db.collection('leadActivities').get();
    const activityDeletePaths = activitySnap.docs
      .filter((docSnap) => {
        const leadId = String(docSnap.data().leadId || '');
        return isDemoLeadId(leadId) || demoLeadIds.has(leadId);
      })
      .map((docSnap) => docSnap.ref.path);

    const appointmentSnap = await db.collection('appointments').get();
    const appointmentDeletePaths = appointmentSnap.docs
      .filter((docSnap) => isDemoAppointment(docSnap.data(), docSnap.id, demoLeadIds))
      .map((docSnap) => docSnap.ref.path);

    const parentSnap = await db.collection('parentProfiles').get();
    const parentDeletePaths = parentSnap.docs
      .filter((docSnap) => isDemoParentProfile(docSnap.data(), docSnap.id))
      .map((docSnap) => docSnap.ref.path);

    const [leads, activities, appointments, parentProfiles] = await Promise.all([
      deleteDocs(leadDeletePaths),
      deleteDocs(activityDeletePaths),
      deleteDocs(appointmentDeletePaths),
      deleteDocs(parentDeletePaths),
    ]);

    return res.status(200).json({
      ok: true,
      deleted: {
        leads,
        activities,
        appointments,
        parentProfiles,
      },
    });
  } catch (error) {
    return res.status(403).json({ error: error instanceof Error ? error.message : 'Forbidden' });
  }
}
