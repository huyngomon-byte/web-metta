import { adminAuth, adminDb } from './_firebaseAdmin.js';

type VercelRequest = {
  method?: string;
  body?: any;
  headers?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

type ParentProfile = {
  id: string;
  phone: string;
  parentName: string;
  email?: string;
  occupation?: string;
  workplace?: string;
  incomeRange?: string;
  knownFrom?: string;
  numberOfChildren?: string;
  address?: string;
  preferredContactChannel?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

const COL = 'parentProfiles';

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
  if (!active || !['admin', 'manager'].includes(String(role || ''))) throw new Error('Only admin or manager can manage parent profiles');
  return decoded;
}

function normalizeParentPhone(value?: string) {
  return String(value || '').replace(/\D/g, '').replace(/^84/, '0');
}

function profileId(phone: string) {
  return `parent-${normalizeParentPhone(phone) || Date.now()}`;
}

function isSampleEmail(email?: string) {
  const value = String(email || '').toLowerCase();
  return value.includes('@metta.test') || value.includes('@example.com');
}

function isSampleParentProfile(profile: Partial<ParentProfile>) {
  const text = [
    profile.id,
    profile.email,
    profile.notes,
    profile.knownFrom,
  ].map((value) => String(value || '').toLowerCase()).join(' ');
  return isSampleEmail(profile.email)
    || text.includes('metta.test')
    || text.includes('demo.stage')
    || text.includes('demo parent')
    || text.includes('demo lead');
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => stripUndefined(item)) as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, stripUndefined(item)]),
    ) as T;
  }
  return value;
}

function normalizeProfile(input: Partial<ParentProfile>): ParentProfile {
  const timestamp = new Date().toISOString();
  const phone = normalizeParentPhone(input.phone);
  return {
    id: input.id || profileId(phone),
    phone,
    parentName: String(input.parentName || '').trim(),
    email: String(input.email || '').trim(),
    occupation: String(input.occupation || '').trim(),
    workplace: String(input.workplace || '').trim(),
    incomeRange: String(input.incomeRange || '').trim(),
    knownFrom: String(input.knownFrom || '').trim(),
    numberOfChildren: String(input.numberOfChildren || '').trim(),
    address: String(input.address || '').trim(),
    preferredContactChannel: String(input.preferredContactChannel || '').trim(),
    notes: String(input.notes || '').trim(),
    createdAt: input.createdAt || timestamp,
    updatedAt: input.updatedAt || timestamp,
  };
}

async function cleanSampleProfiles() {
  const db = adminDb();
  const snap = await db.collection(COL).get();
  const sampleDocs = snap.docs.filter((docSnap) => isSampleParentProfile({ id: docSnap.id, ...docSnap.data() }));
  if (!sampleDocs.length) return 0;
  const batch = db.batch();
  sampleDocs.forEach((docSnap) => batch.delete(docSnap.ref));
  await batch.commit();
  return sampleDocs.length;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await requireLeadManager(req);
    const db = adminDb();

    if (req.method === 'GET') {
      await cleanSampleProfiles();
      const snap = await db.collection(COL).orderBy('updatedAt', 'desc').get();
      const profiles = snap.docs
        .map((docSnap) => normalizeProfile({ ...docSnap.data(), id: docSnap.id }))
        .filter((profile) => !isSampleParentProfile(profile));
      return res.status(200).json({ profiles });
    }

    if (req.method === 'POST') {
      const profile = normalizeProfile(req.body || {});
      if (!profile.phone) return res.status(400).json({ error: 'Parent phone is required' });
      if (isSampleParentProfile(profile)) return res.status(200).json({ skipped: true });
      await db.collection(COL).doc(profile.id).set(stripUndefined(profile), { merge: true });
      return res.status(200).json({ profile });
    }

    if (req.method === 'PUT') {
      const profiles: ParentProfile[] = Array.isArray(req.body?.profiles) ? req.body.profiles.map(normalizeProfile) : [];
      const cleanProfiles = profiles.filter((profile) => profile.phone && !isSampleParentProfile(profile));
      for (let i = 0; i < cleanProfiles.length; i += 450) {
        const batch = db.batch();
        cleanProfiles.slice(i, i + 450).forEach((profile) => {
          batch.set(db.collection(COL).doc(profile.id), stripUndefined(profile), { merge: true });
        });
        await batch.commit();
      }
      return res.status(200).json({ profiles: cleanProfiles });
    }

    if (req.method === 'DELETE') {
      const id = String(req.body?.id || '');
      if (!id) return res.status(400).json({ error: 'Missing parent profile id' });
      await db.collection(COL).doc(id).delete();
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(403).json({ error: error instanceof Error ? error.message : 'Forbidden' });
  }
}
