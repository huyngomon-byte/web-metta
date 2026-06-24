import { createHash } from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';

export type DedupeLeadDoc = Record<string, unknown> & {
  id: string;
  phone?: string;
  parentName?: string;
  studentName?: string;
};

export function normalizeLeadPhone(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;
  if (digits.length === 9 && /^[1-9]/.test(digits)) return `0${digits}`;
  if (digits.startsWith('84') && digits.length >= 11 && digits.length <= 12) return `0${digits.slice(2)}`;
  return digits.startsWith('0') ? digits : raw;
}

export function normalizeStudentName(value: unknown) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

export function leadDedupeIdentity(phoneValue: unknown, studentNameValue: unknown) {
  const phone = normalizeLeadPhone(phoneValue);
  const studentKey = normalizeStudentName(studentNameValue);
  if (!phone || !studentKey) return null;
  const rawKey = `${phone}::${studentKey}`;
  return {
    phone,
    studentKey,
    rawKey,
    indexId: createHash('sha256').update(rawKey).digest('hex'),
  };
}

export function dedupeIndexPayload(lead: DedupeLeadDoc, updatedAt: string) {
  const identity = leadDedupeIdentity(lead.phone, lead.studentName);
  if (!identity) return null;
  return {
    id: identity.indexId,
    data: {
      phone: identity.phone,
      studentKey: identity.studentKey,
      leadId: lead.id,
      parentName: String(lead.parentName || '').trim(),
      studentName: String(lead.studentName || '').trim(),
      updatedAt,
    },
  };
}

function leadMatchesIdentity(lead: DedupeLeadDoc, phone: string, studentKey: string) {
  return normalizeLeadPhone(lead.phone) === phone && normalizeStudentName(lead.studentName) === studentKey;
}

export async function findLeadByDedupe(db: Firestore, phoneValue: unknown, studentNameValue: unknown) {
  const identity = leadDedupeIdentity(phoneValue, studentNameValue);
  if (!identity) return null;

  const indexSnap = await db.collection('leadDedupeIndex').doc(identity.indexId).get();
  if (indexSnap.exists) {
    const leadId = String(indexSnap.data()?.leadId || '');
    if (leadId) {
      const leadSnap = await db.collection('leads').doc(leadId).get();
      if (leadSnap.exists) {
        const lead = { id: leadSnap.id, ...leadSnap.data() } as DedupeLeadDoc;
        if (leadMatchesIdentity(lead, identity.phone, identity.studentKey)) return lead;
      }
    }
  }

  const phoneSnap = await db.collection('leads').where('phone', '==', identity.phone).limit(25).get();
  const matched = phoneSnap.docs
    .map((item) => ({ id: item.id, ...item.data() }) as DedupeLeadDoc)
    .find((lead) => leadMatchesIdentity(lead, identity.phone, identity.studentKey));
  return matched || null;
}
