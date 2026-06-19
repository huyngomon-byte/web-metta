import { adminDb } from './_firebaseAdmin.js';
import { ApiError, requireAnyRole, requireApiUser, type ApiUser } from './_apiAuth.js';

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

type AdminUser = {
  id: string;
  fullName: string;
  role: string;
  active: boolean;
};

type SalesAssignmentRule = {
  salesId: string;
  salesName: string;
  percent: number;
  active: boolean;
  updatedAt?: string;
};

type LeadDoc = Record<string, any> & {
  id: string;
  fullName?: string;
  parentName?: string;
  studentName?: string;
  phone?: string;
  status?: string;
  assignedTo?: string;
  assignedToName?: string;
  assignedStatus?: string;
};

type LeadRecord = {
  id: string;
  ref: FirebaseFirestore.DocumentReference;
  lead: LeadDoc;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const NEW_LEAD_STATUS = 'Lead mới';
const MAX_WRITES_PER_BATCH = 440;
const WRITES_PER_LEAD = 4;
const MAX_LEADS_PER_BATCH = Math.floor(MAX_WRITES_PER_BATCH / WRITES_PER_LEAD);

function cleanPercent(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return Math.min(100, Math.round(parsed));
}

function activeSales(users: AdminUser[]) {
  return users.filter((user) => user.role === 'sales' && user.active);
}

function assignmentRulesTotal(rules: SalesAssignmentRule[]) {
  return rules.filter((rule) => rule.active).reduce((sum, rule) => sum + cleanPercent(rule.percent), 0);
}

function defaultRules(users: AdminUser[]): SalesAssignmentRule[] {
  const sales = activeSales(users);
  if (!sales.length) return [];
  if (sales.length === 2) {
    return sales.map((user, index) => ({
      salesId: user.id,
      salesName: user.fullName,
      percent: index === 0 ? 60 : 40,
      active: true,
      updatedAt: new Date().toISOString(),
    }));
  }

  const base = Math.floor(100 / sales.length);
  let remainder = 100 - base * sales.length;
  return sales.map((user) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return {
      salesId: user.id,
      salesName: user.fullName,
      percent: base + extra,
      active: true,
      updatedAt: new Date().toISOString(),
    };
  });
}

function normalizeAssignmentRules(users: AdminUser[], saved: SalesAssignmentRule[]) {
  const sales = activeSales(users);
  if (!sales.length) return [];
  if (!saved.length) return defaultRules(users);

  const savedById = new Map(saved.map((rule) => [rule.salesId, rule]));
  const rules = sales.map((user) => {
    const existing = savedById.get(user.id);
    return {
      salesId: user.id,
      salesName: user.fullName,
      percent: cleanPercent(existing?.percent),
      active: existing?.active !== false,
      updatedAt: existing?.updatedAt,
    };
  });

  return assignmentRulesTotal(rules) > 0 ? rules : defaultRules(users);
}

function salesMatches(lead: LeadDoc, sales: Pick<AdminUser, 'id' | 'fullName'> | SalesAssignmentRule) {
  const salesId = 'salesId' in sales ? sales.salesId : sales.id;
  const salesName = 'salesName' in sales ? sales.salesName : sales.fullName;
  return lead.assignedTo === salesId || lead.assignedTo === salesName || lead.assignedToName === salesName;
}

function hasActiveSalesAssignment(lead: LeadDoc, salesUsers: AdminUser[]) {
  return lead.assignedStatus !== 'returned' && salesUsers.some((sales) => salesMatches(lead, sales));
}

function leadName(lead: LeadDoc) {
  return String(lead.studentName || lead.fullName || lead.parentName || lead.phone || 'Lead mới').trim();
}

function assignmentPickForNext(rules: SalesAssignmentRule[], counts: Map<string, number>, totalAfter: number) {
  return rules.map((rule) => {
    const current = counts.get(rule.salesId) || 0;
    const targetExact = (totalAfter * cleanPercent(rule.percent)) / 100;
    const targetRounded = Math.round(targetExact);
    return {
      rule,
      current,
      targetExact,
      targetRounded,
      roundedGap: targetRounded - current,
      exactGap: targetExact - current,
    };
  }).sort((a, b) =>
    b.roundedGap - a.roundedGap ||
    b.exactGap - a.exactGap ||
    a.current - b.current ||
    cleanPercent(b.rule.percent) - cleanPercent(a.rule.percent) ||
    a.rule.salesName.localeCompare(b.rule.salesName, 'vi'),
  )[0]?.rule || null;
}

function activityId(index: number) {
  return `act-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}

function auditId(index: number) {
  return `audit-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}

function notificationId(index: number) {
  return `noti-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
}

function leadUrl(leadId: string) {
  return `/crm/leads?view=kanban&leadId=${encodeURIComponent(leadId)}`;
}

async function readActiveUsers(db: FirebaseFirestore.Firestore) {
  const snap = await db.collection('users').get();
  return snap.docs.map((docSnap) => {
    const data = docSnap.data() || {};
    return {
      id: docSnap.id,
      fullName: String(data.fullName || data.email || docSnap.id),
      role: String(data.role || ''),
      active: data.active === true,
    };
  });
}

async function readAssignmentRules(db: FirebaseFirestore.Firestore, users: AdminUser[]) {
  const snap = await db.collection('appConfig').doc('salesAssignmentRules').get();
  const data = snap.exists ? snap.data() || {} : {};
  const savedRules = Array.isArray(data.rules) ? data.rules as SalesAssignmentRule[] : [];
  return normalizeAssignmentRules(users, savedRules)
    .filter((rule) => rule.active && cleanPercent(rule.percent) > 0);
}

async function readNewLeads(db: FirebaseFirestore.Firestore): Promise<LeadRecord[]> {
  const snap = await db.collection('leads').where('status', '==', NEW_LEAD_STATUS).get();
  return snap.docs.map((docSnap) => {
    const data = docSnap.data() as LeadDoc;
    return {
      id: docSnap.id,
      ref: docSnap.ref,
      lead: { ...data, id: data.id || docSnap.id },
    };
  });
}

async function commitAssignments(
  db: FirebaseFirestore.Firestore,
  assignments: Array<{ record: LeadRecord; rule: SalesAssignmentRule }>,
  user: ApiUser,
) {
  const timestamp = new Date().toISOString();
  const assignedAtMs = Date.now();
  const assignedExpiresAtMs = assignedAtMs + DAY_MS;

  for (let start = 0; start < assignments.length; start += MAX_LEADS_PER_BATCH) {
    const batch = db.batch();
    assignments.slice(start, start + MAX_LEADS_PER_BATCH).forEach((item, offset) => {
      const index = start + offset;
      const { record, rule } = item;
      const name = leadName(record.lead);

      batch.set(record.ref, {
        assignedTo: rule.salesId,
        assignedToName: rule.salesName,
        assignedBy: user.id,
        assignedAt: timestamp,
        assignedAtMs,
        assignedExpiresAtMs,
        assignedStatus: 'active',
        failedAssignedTo: '',
        failedAssignedToName: '',
        failedAt: '',
        failedAtMs: 0,
        failedReason: '',
        updatedAt: timestamp,
      }, { merge: true });

      const activityRef = db.collection('leadActivities').doc(activityId(index));
      batch.set(activityRef, {
        id: activityRef.id,
        leadId: record.id,
        type: 'assignment',
        content: `Auto chia lead mới cho ${rule.salesName}.`,
        createdBy: user.fullName || user.email || 'Auto rule',
        createdAt: timestamp,
      });

      const auditRef = db.collection('activityLogs').doc(auditId(index));
      batch.set(auditRef, {
        id: auditRef.id,
        type: 'lead_auto_balanced_assigned',
        leadId: record.id,
        assignedTo: rule.salesId,
        assignedToName: rule.salesName,
        assignedBy: user.id,
        assignedByName: user.fullName || user.email || '',
        createdAt: timestamp,
        createdAtMs: assignedAtMs,
      });

      const notificationRef = db.collection('appNotifications').doc(notificationId(index));
      batch.set(notificationRef, {
        id: notificationRef.id,
        type: 'lead_assigned',
        userId: rule.salesId,
        title: 'Lead mới được auto assign',
        body: `${name} - ${user.fullName || user.email || 'Auto rule'}`,
        leadId: record.id,
        url: leadUrl(record.id),
        read: false,
        createdAt: timestamp,
      });
    });
    await batch.commit();
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const db = adminDb();
    const user = await requireApiUser(db, req);
    requireAnyRole(user, ['admin', 'manager']);

    const users = await readActiveUsers(db);
    const salesUsers = activeSales(users);
    if (!salesUsers.length) return res.status(400).json({ error: 'Chưa có sales active để chia lead.' });

    const rules = await readAssignmentRules(db, users);
    if (!rules.length || assignmentRulesTotal(rules) !== 100) {
      return res.status(400).json({ error: 'Tổng tỷ lệ active trong rule chia lead phải bằng 100%.' });
    }

    const newLeadRecords = await readNewLeads(db);
    const assignedNewLeadRecords = newLeadRecords.filter((record) => hasActiveSalesAssignment(record.lead, salesUsers));
    const candidateRecords = newLeadRecords
      .filter((record) => !hasActiveSalesAssignment(record.lead, salesUsers))
      .sort((a, b) =>
        String(a.lead.createdAt || a.lead.updatedAt || '').localeCompare(String(b.lead.createdAt || b.lead.updatedAt || '')) ||
        a.id.localeCompare(b.id),
      );

    const counts = new Map<string, number>();
    rules.forEach((rule) => counts.set(rule.salesId, 0));
    assignedNewLeadRecords.forEach((record) => {
      const rule = rules.find((item) => salesMatches(record.lead, item));
      if (rule) counts.set(rule.salesId, (counts.get(rule.salesId) || 0) + 1);
    });
    const beforeCounts = new Map(counts);

    const assignments: Array<{ record: LeadRecord; rule: SalesAssignmentRule }> = [];
    candidateRecords.forEach((record) => {
      const totalAfter = assignedNewLeadRecords.length + assignments.length + 1;
      const rule = assignmentPickForNext(rules, counts, totalAfter);
      if (!rule) return;
      counts.set(rule.salesId, (counts.get(rule.salesId) || 0) + 1);
      assignments.push({ record, rule });
    });

    await commitAssignments(db, assignments, user);

    const totalAfter = assignedNewLeadRecords.length + assignments.length;
    const distribution = rules.map((rule) => {
      const before = beforeCounts.get(rule.salesId) || 0;
      const after = counts.get(rule.salesId) || 0;
      return {
        salesId: rule.salesId,
        salesName: rule.salesName,
        percent: cleanPercent(rule.percent),
        before,
        assigned: after - before,
        after,
        shareAfter: totalAfter ? Math.round((after / totalAfter) * 100) : 0,
        targetAfter: Math.round((totalAfter * cleanPercent(rule.percent)) / 100),
      };
    });

    return res.status(200).json({
      ok: true,
      status: NEW_LEAD_STATUS,
      totalNewLeadCount: newLeadRecords.length,
      baselineAssignedCount: assignedNewLeadRecords.length,
      candidateCount: candidateRecords.length,
      assignedCount: assignments.length,
      distribution,
    });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    console.error('[BulkAutoAssignLeads] Failed:', error);
    return res.status(status).json({ error: error instanceof Error ? error.message : 'Không auto chia được lead.' });
  }
}
