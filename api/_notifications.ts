type FirestoreDb = FirebaseFirestore.Firestore;

type NotificationInput = {
  type: 'lead_assigned' | 'admin_digest' | 'sales_digest' | 'task_due' | 'appointment_due' | 'pipeline_alert';
  userId: string;
  title: string;
  body: string;
  leadId?: string;
  url?: string;
  createdAt?: string;
};

function now() {
  return new Date().toISOString();
}

function notificationId(prefix = 'noti') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function leadUrl(leadId: string) {
  return `/crm/leads?view=kanban&leadId=${encodeURIComponent(leadId)}`;
}

export async function createAppNotification(db: FirestoreDb, input: NotificationInput) {
  if (!input.userId) return null;
  const ref = db.collection('appNotifications').doc(notificationId());
  const payload = {
    id: ref.id,
    read: false,
    createdAt: input.createdAt || now(),
    ...input,
  };
  await ref.set(payload);
  return payload;
}

export async function notifyLeadAssigned(db: FirestoreDb, input: {
  leadId: string;
  leadName: string;
  salesId: string;
  assignedByName?: string;
  auto?: boolean;
  createdAt?: string;
}) {
  return createAppNotification(db, {
    type: 'lead_assigned',
    userId: input.salesId,
    title: input.auto ? 'Lead mới được auto assign' : 'Lead mới được phân cho bạn',
    body: `${input.leadName || 'Lead mới'}${input.assignedByName ? ` - ${input.assignedByName}` : ''}`,
    leadId: input.leadId,
    url: leadUrl(input.leadId),
    createdAt: input.createdAt,
  });
}

export async function notifyLeadManagers(db: FirestoreDb, input: {
  title: string;
  body: string;
  leadId?: string;
  url?: string;
  type?: NotificationInput['type'];
  createdAt?: string;
}) {
  const snap = await db.collection('users').where('active', '==', true).get();
  const managerDocs = snap.docs.filter((docSnap) => ['admin', 'manager'].includes(String(docSnap.data().role || '')));
  await Promise.all(managerDocs.map((docSnap) => createAppNotification(db, {
    type: input.type || 'admin_digest',
    userId: docSnap.id,
    title: input.title,
    body: input.body,
    leadId: input.leadId,
    url: input.url,
    createdAt: input.createdAt,
  })));
}
