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

function readProfiles(): ParentProfile[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    const clean = parsed.filter((item) => !isSampleParentProfile(item));
    if (clean.length !== parsed.length) localStorage.setItem(LS_KEY, JSON.stringify(clean.slice(0, 1000)));
    return clean;
  } catch {
    return [];
  }
}

function writeProfiles(items: ParentProfile[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items.slice(0, 1000)));
  window.dispatchEvent(new Event('metta-parent-profiles-updated'));
}

function profileId(phone: string) {
  return `parent-${normalizeParentPhone(phone) || Date.now()}`;
}

export const parentProfileService = {
  getProfiles: async () => readProfiles(),

  saveProfile: async (profile: Partial<ParentProfile>) => {
    const timestamp = now();
    const phone = normalizeParentPhone(profile.phone);
    if (!phone) throw new Error('SĐT phụ huynh là bắt buộc.');
    const existing = readProfiles().find((item) => normalizeParentPhone(item.phone) === phone || item.id === profile.id);
    const saved: ParentProfile = {
      id: existing?.id || profile.id || profileId(phone),
      phone,
      parentName: profile.parentName || existing?.parentName || '',
      email: profile.email || '',
      occupation: profile.occupation || '',
      workplace: profile.workplace || '',
      incomeRange: profile.incomeRange || '',
      knownFrom: profile.knownFrom || '',
      numberOfChildren: profile.numberOfChildren || '',
      address: profile.address || '',
      preferredContactChannel: profile.preferredContactChannel || '',
      notes: profile.notes || '',
      createdAt: existing?.createdAt || timestamp,
      updatedAt: timestamp,
    };
    writeProfiles([saved, ...readProfiles().filter((item) => item.id !== saved.id && normalizeParentPhone(item.phone) !== phone)]);
    return saved;
  },

  deleteProfile: async (id: string) => {
    writeProfiles(readProfiles().filter((item) => item.id !== id));
    return true;
  },

  seedFromLeads: async (leads: Lead[]) => {
    const profiles = readProfiles();
    const known = new Set(profiles.map((item) => normalizeParentPhone(item.phone)));
    const generated = leads
      .filter((lead) => !isSampleLead(lead) && normalizeParentPhone(lead.phone) && !known.has(normalizeParentPhone(lead.phone)))
      .map((lead) => ({
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
    if (generated.length) writeProfiles([...profiles, ...generated]);
    return readProfiles();
  },
};
