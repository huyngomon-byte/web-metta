import { adminAuth, adminDb } from './_firebaseAdmin.js';

type VercelRequest = {
  method?: string;
  body?: any;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

function adminEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const adminPassword = process.env.ADMIN_PASSWORD;
  const allowedEmails = adminEmails();

  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
  if (!adminPassword || password !== adminPassword) return res.status(401).json({ error: 'Invalid credentials' });
  if (allowedEmails.length && !allowedEmails.includes(email)) return res.status(403).json({ error: 'Email is not allowed' });

  const auth = adminAuth();
  let user = await auth.getUserByEmail(email).catch(() => null);
  if (!user) {
    user = await auth.createUser({ email, emailVerified: true, disabled: false });
  }
  if (user.disabled) {
    await auth.updateUser(user.uid, { disabled: false });
  }

  await auth.setCustomUserClaims(user.uid, { role: 'admin', adminEmail: email });
  await adminDb().collection('users').doc(user.uid).set({
    id: user.uid,
    fullName: user.displayName || email.split('@')[0],
    email,
    role: 'admin',
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  const token = await auth.createCustomToken(user.uid, { role: 'admin', adminEmail: email });
  return res.status(200).json({ token, email, uid: user.uid });
}
