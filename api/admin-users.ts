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

const roles = ['admin', 'manager', 'sales', 'ads', 'design'];

function bearer(req: VercelRequest) {
  const raw = req.headers?.authorization;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.startsWith('Bearer ') ? value.slice(7) : '';
}

async function requireAdmin(req: VercelRequest) {
  const token = bearer(req);
  if (!token) throw new Error('Missing auth token');
  const decoded = await adminAuth().verifyIdToken(token);
  const snap = await adminDb().collection('users').doc(decoded.uid).get();
  const role = snap.exists ? snap.data()?.role : decoded.role;
  const active = snap.exists ? snap.data()?.active !== false : true;
  if (!active || role !== 'admin') throw new Error('Only admin can manage users');
  return decoded;
}

function cleanUser(input: any) {
  const now = new Date().toISOString();
  const role = roles.includes(input.role) ? input.role : 'sales';
  return {
    fullName: String(input.fullName || '').trim(),
    email: String(input.email || '').trim().toLowerCase(),
    role,
    active: input.active !== false,
    updatedAt: now,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const decoded = await requireAdmin(req);
    const auth = adminAuth();
    const db = adminDb();

    if (req.method === 'POST') {
      const data = cleanUser(req.body || {});
      if (!data.email || !data.fullName) return res.status(400).json({ error: 'Missing fullName or email' });
      const password = String(req.body?.password || '');
      let authUser = await auth.getUserByEmail(data.email).catch(() => null);
      if (!authUser) {
        authUser = await auth.createUser({
          email: data.email,
          password: password || undefined,
          displayName: data.fullName,
          emailVerified: true,
          disabled: !data.active,
        });
      } else {
        await auth.updateUser(authUser.uid, {
          displayName: data.fullName,
          disabled: !data.active,
          ...(password ? { password } : {}),
        });
      }
      await auth.setCustomUserClaims(authUser.uid, { role: data.role });
      const user = { id: authUser.uid, ...data, createdAt: new Date().toISOString() };
      await db.collection('users').doc(authUser.uid).set(user, { merge: true });
      return res.status(200).json({ user });
    }

    if (req.method === 'PATCH') {
      const id = String(req.body?.id || '');
      if (!id) return res.status(400).json({ error: 'Missing user id' });
      const data = cleanUser(req.body || {});
      const password = String(req.body?.password || '');
      await auth.updateUser(id, {
        email: data.email || undefined,
        displayName: data.fullName || undefined,
        disabled: !data.active,
        ...(password ? { password } : {}),
      });
      await auth.setCustomUserClaims(id, { role: data.role });
      const user = { id, ...data };
      await db.collection('users').doc(id).set(user, { merge: true });
      return res.status(200).json({ user });
    }

    if (req.method === 'DELETE') {
      const id = String(req.body?.id || '');
      if (!id) return res.status(400).json({ error: 'Missing user id' });
      if (id === decoded.uid) return res.status(400).json({ error: 'Không thể xóa chính tài khoản đang đăng nhập.' });

      await auth.deleteUser(id).catch(async (error) => {
        const code = String(error?.code || '');
        if (!code.includes('user-not-found')) {
          await auth.updateUser(id, { disabled: true }).catch(() => {});
        }
      });

      await db.collection('users').doc(id).delete();
      await db.collection('agentPresence').doc(id).delete().catch(() => {});

      const settingsRef = db.collection('callCenterSettings').doc('stringee');
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(settingsRef);
        if (!snap.exists) return;
        const data = snap.data() || {};
        const mappings = Array.isArray(data.userMappings) ? data.userMappings : [];
        const nextMappings = mappings.filter((mapping: any) => mapping?.crmUserId !== id);
        const patch: Record<string, unknown> = { userMappings: nextMappings, updatedAt: new Date().toISOString() };
        if (data.fallbackAgentId === id) {
          patch.fallbackAgentId = '';
          patch.fallbackAgentName = '';
        }
        transaction.set(settingsRef, patch, { merge: true });
      }).catch(() => {});

      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(403).json({ error: error instanceof Error ? error.message : 'Forbidden' });
  }
}
