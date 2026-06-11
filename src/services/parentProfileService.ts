import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import type { Lead } from '@/types/crm';

export interface ParentProfile {
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
}

const LS_KEY = 'metta_parent_profiles';
const LS_FIRESTORE_MIGRATION = 'metta_parent_profiles_firestore_migration_v1';
const LS_FIRESTORE_DEMO_RESET = 'metta_parent_profiles_demo_firestore_reset_v2';
const COL_PARENT_PROFILES = 'parentProfiles';
const USE_FIREBASE = isFirebaseConfigured && !!db;

function now() {
  return new Date().toISOString();
}

function isSampleEmail(email?: string) {
  const value = String(email || '').toLowerCase();
  return value.includes('@metta.test') || value.includes('@example.com');
}

function isSampleLeadId(id?: string) {
  const value = String(id || '');
  return value.startsWith('lead-demo-stage-')
    || value.startsWith('lead-demo-priority-')
    || /^lead-[1-5]$/.test(value)
    || /^lead-x\d+$/.test(value);
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

function isSampleLead(lead: Partial<Lead>) {
  const text = [
    lead.initialNote,
    lead.dealNote,
    lead.lostNote,
  ].map((value) => String(value || '').toLowerCase()).join(' ');
  return isSampleLeadId(lead.id)
    || isSampleEmail(lead.email)
    || text.includes('demo lead');
}

export function normalizeParentPhone(value?: string) {
  return String(value || '').replace(/\D/g, '').replace(/^84/, '0');
}

function profileId(phone: string) {
  return `parent-${normalizeParentPhone(phone) || Date.now()}`;
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

function normalizeProfile(profile: Partial<ParentProfile>): ParentProfile {
  const timestamp = now();
  const phone = normalizeParentPhone(profile.phone);
  return {
    id: profile.id || profileId(phone),
    phone,
    parentName: profile.parentName || '',
    email: profile.email || '',
    occupation: profile.occupation || '',
    workplace: profile.workplace || '',
    incomeRange: profile.incomeRange || '',
    knownFrom: profile.knownFrom || '',
    numberOfChildren: profile.numberOfChildren || '',
    address: profile.address || '',
    preferredContactChannel: profile.preferredContactChannel || '',
    notes: profile.notes || '',
    createdAt: profile.createdAt || timestamp,
    updatedAt: profile.updatedAt || timestamp,
  };
}

function mergeProfileFields(a: ParentProfile, b: ParentProfile): ParentProfile {
  const aTime = new Date(a.updatedAt || a.createdAt).getTime() || 0;
  const bTime = new Date(b.updatedAt || b.createdAt).getTime() || 0;
  const newer = bTime > aTime ? b : a;
  const older = newer === a ? b : a;
  return {
    ...older,
    ...newer,
    id: newer.id || older.id,
    phone: normalizeParentPhone(newer.phone || older.phone),
    parentName: newer.parentName || older.parentName || '',
    email: newer.email || older.email || '',
    occupation: newer.occupation || older.occupation || '',
    workplace: newer.workplace || older.workplace || '',
    incomeRange: newer.incomeRange || older.incomeRange || '',
    knownFrom: newer.knownFrom || older.knownFrom || '',
    numberOfChildren: newer.numberOfChildren || older.numberOfChildren || '',
    address: newer.address || older.address || '',
    preferredContactChannel: newer.preferredContactChannel || older.preferredContactChannel || '',
    notes: newer.notes || older.notes || '',
    createdAt: [a.createdAt, b.createdAt].filter(Boolean).sort()[0] || newer.createdAt,
    updatedAt: [a.updatedAt, b.updatedAt].filter(Boolean).sort().pop() || newer.updatedAt,
  };
}

function mergeProfiles(items: ParentProfile[]) {
  const map = new Map<string, ParentProfile>();
  items
    .map(normalizeProfile)
    .filter((item) => normalizeParentPhone(item.phone))
    .filter((item) => !isSampleParentProfile(item))
    .forEach((item) => {
      const key = normalizeParentPhone(item.phone) || item.id;
      const existing = map.get(key);
      map.set(key, existing ? mergeProfileFields(existing, item) : item);
    });
  return Array.from(map.values()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function dispatchUpdate() {
  window.dispatchEvent(new Event('metta-parent-profiles-updated'));
}

function readLocalProfiles(): ParentProfile[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    const clean = mergeProfiles(parsed);
    if (clean.length !== parsed.length) localStorage.setItem(LS_KEY, JSON.stringify(clean.slice(0, 1000)));
    return clean;
  } catch {
    return [];
  }
}

function writeLocalProfiles(items: ParentProfile[], notify = true) {
  localStorage.setItem(LS_KEY, JSON.stringify(mergeProfiles(items).slice(0, 1000)));
  if (notify) dispatchUpdate();
}

async function writeFirestoreProfile(profile: ParentProfile) {
  if (!USE_FIREBASE) return;
  await setDoc(doc(db!, COL_PARENT_PROFILES, profile.id), stripUndefined(profile), { merge: true });
}

async function deleteFirestoreProfile(id: string) {
  if (!USE_FIREBASE) return;
  await deleteDoc(doc(db!, COL_PARENT_PROFILES, id));
}

async function readFirestoreProfiles() {
  if (!USE_FIREBASE) return [];
  const snap = await getDocs(query(collection(db!, COL_PARENT_PROFILES), orderBy('updatedAt', 'desc')));
  const profiles = snap.docs.map((item) => normalizeProfile({ ...item.data(), id: item.id }));
  const sampleProfiles = profiles.filter(isSampleParentProfile);
  if (sampleProfiles.length && !localStorage.getItem(LS_FIRESTORE_DEMO_RESET)) {
    await Promise.all(sampleProfiles.map((item) => deleteFirestoreProfile(item.id).catch(() => {})));
    localStorage.setItem(LS_FIRESTORE_DEMO_RESET, '1');
  } else if (!sampleProfiles.length) {
    localStorage.setItem(LS_FIRESTORE_DEMO_RESET, '1');
  }
  return mergeProfiles(profiles.filter((item) => !isSampleParentProfile(item)));
}

async function syncProfilesToFirestore(profiles: ParentProfile[]) {
  if (!USE_FIREBASE) return;
  await Promise.all(profiles.map((profile) => writeFirestoreProfile(profile).catch((error) => {
    console.warn('[ParentProfiles] Firestore write failed:', error);
  })));
}

export const parentProfileService = {
  getProfiles: async () => {
    const localProfiles = readLocalProfiles();
    if (!USE_FIREBASE) return localProfiles;

    try {
      const firestoreProfiles = await readFirestoreProfiles();
      let profiles = firestoreProfiles;
      if (localProfiles.length && !localStorage.getItem(LS_FIRESTORE_MIGRATION)) {
        profiles = mergeProfiles([...firestoreProfiles, ...localProfiles]);
        await syncProfilesToFirestore(profiles);
        localStorage.setItem(LS_FIRESTORE_MIGRATION, '1');
      }
      writeLocalProfiles(profiles, false);
      return profiles;
    } catch (error) {
      console.warn('[ParentProfiles] Firestore read failed, using local cache:', error);
      return localProfiles;
    }
  },

  saveProfile: async (profile: Partial<ParentProfile>) => {
    const timestamp = now();
    const phone = normalizeParentPhone(profile.phone);
    if (!phone) throw new Error('Parent phone is required.');
    const profiles = await parentProfileService.getProfiles();
    const existing = profiles.find((item) => normalizeParentPhone(item.phone) === phone || item.id === profile.id);
    const saved = normalizeProfile({
      ...existing,
      ...profile,
      id: existing?.id || profile.id || profileId(phone),
      phone,
      createdAt: existing?.createdAt || profile.createdAt || timestamp,
      updatedAt: timestamp,
    });
    const nextProfiles = mergeProfiles([saved, ...profiles.filter((item) => item.id !== saved.id && normalizeParentPhone(item.phone) !== phone)]);
    writeLocalProfiles(nextProfiles);
    try {
      await writeFirestoreProfile(saved);
    } catch (error) {
      console.warn('[ParentProfiles] Firestore save failed, keeping local cache:', error);
    }
    return saved;
  },

  deleteProfile: async (id: string) => {
    const profiles = await parentProfileService.getProfiles();
    writeLocalProfiles(profiles.filter((item) => item.id !== id));
    try {
      await deleteFirestoreProfile(id);
    } catch (error) {
      console.warn('[ParentProfiles] Firestore delete failed:', error);
    }
    return true;
  },

  seedFromLeads: async (leads: Lead[]) => {
    const profiles = await parentProfileService.getProfiles();
    const known = new Set(profiles.map((item) => normalizeParentPhone(item.phone)));
    const generated = leads
      .filter((lead) => !isSampleLead(lead) && normalizeParentPhone(lead.phone) && !known.has(normalizeParentPhone(lead.phone)))
      .map((lead) => normalizeProfile({
        id: profileId(lead.phone),
        phone: normalizeParentPhone(lead.phone),
        parentName: lead.parentName || lead.fullName || '',
        email: lead.email || '',
        occupation: '',
        workplace: '',
        incomeRange: '',
        knownFrom: lead.source || '',
        numberOfChildren: '',
        address: '',
        preferredContactChannel: 'Phone/Zalo',
        notes: '',
        createdAt: lead.createdAt || now(),
        updatedAt: lead.updatedAt || now(),
      }));
    if (!generated.length) return profiles;
    const nextProfiles = mergeProfiles([...profiles, ...generated]);
    writeLocalProfiles(nextProfiles);
    await syncProfilesToFirestore(generated);
    return nextProfiles;
  },
};
