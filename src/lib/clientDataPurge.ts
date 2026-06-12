const PURGE_VERSION_KEY = 'metta_client_data_purge_version';
const CURRENT_PURGE_VERSION = '2026-06-12-remove-demo-leads-and-parents-v4';

function parseArray(value: string | null) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveArray(key: string, items: unknown[]) {
  localStorage.setItem(key, JSON.stringify(items));
}

function isDemoLeadId(id?: string) {
  const value = String(id || '');
  return value.startsWith('lead-demo-stage-')
    || value.startsWith('lead-demo-priority-')
    || /^lead-[1-5]$/.test(value)
    || /^lead-x\d+$/.test(value);
}

function demoStagePhone(globalIndex: number) {
  return `09${String(71000000 + globalIndex * 13791).padStart(8, '0').slice(0, 8)}`;
}

function demoPriorityPhone(index: number) {
  return `0988${String(100000 + index * 137).slice(0, 6)}`;
}

const KNOWN_DEMO_PHONES = new Set([
  ...Array.from({ length: 120 }, (_, index) => demoStagePhone(index)),
  ...Array.from({ length: 20 }, (_, index) => demoPriorityPhone(index)),
]);

function normalizePhone(value?: unknown) {
  return String(value || '').replace(/\D/g, '').replace(/^84/, '0');
}

function isKnownDemoPhone(value?: unknown) {
  return KNOWN_DEMO_PHONES.has(normalizePhone(value));
}

function isSampleEmail(email?: string) {
  const value = String(email || '').toLowerCase();
  return value.includes('@metta.test') || value.includes('@example.com');
}

function isSampleLead(item: Record<string, unknown>) {
  const text = [
    item.initialNote,
    item.dealNote,
    item.lostNote,
    item.notes,
  ].map((value) => String(value || '').toLowerCase()).join(' ');
  return isDemoLeadId(String(item.id || ''))
    || isSampleEmail(String(item.email || ''))
    || isKnownDemoPhone(item.phone)
    || text.includes('demo lead');
}

function isSampleParent(item: Record<string, unknown>) {
  const text = [
    item.id,
    item.email,
    item.notes,
    item.knownFrom,
  ].map((value) => String(value || '').toLowerCase()).join(' ');
  return isSampleEmail(String(item.email || ''))
    || isKnownDemoPhone(item.phone)
    || text.includes('metta.test')
    || text.includes('demo.stage')
    || text.includes('demo parent')
    || text.includes('demo lead');
}

function isSampleAppointment(item: Record<string, unknown>) {
  const id = String(item.id || '');
  const leadId = String(item.leadId || '');
  return id.startsWith('ap-demo-stage-consultation-')
    || id.startsWith('ap-demo-priority-consultation-')
    || /^ap-[1-5]$/.test(id)
    || isDemoLeadId(leadId);
}

export function purgeSampleClientData() {
  if (typeof window === 'undefined') return;
  try {
    const previousVersion = localStorage.getItem(PURGE_VERSION_KEY);
    const leads = parseArray(localStorage.getItem('metta_leads')) as Record<string, unknown>[];
    const demoLeadIds = new Set(leads.filter(isSampleLead).map((item) => String(item.id || '')).filter(Boolean));
    if (leads.length) saveArray('metta_leads', leads.filter((item) => !isSampleLead(item)));

    const activities = parseArray(localStorage.getItem('metta_lead_activities')) as Record<string, unknown>[];
    if (activities.length) {
      saveArray('metta_lead_activities', activities.filter((item) => {
        const leadId = String(item.leadId || '');
        return !demoLeadIds.has(leadId) && !isDemoLeadId(leadId);
      }));
    }

    const appointments = parseArray(localStorage.getItem('metta_appointments')) as Record<string, unknown>[];
    if (appointments.length) saveArray('metta_appointments', appointments.filter((item) => !isSampleAppointment(item)));

    const parents = parseArray(localStorage.getItem('metta_parent_profiles')) as Record<string, unknown>[];
    if (parents.length) saveArray('metta_parent_profiles', parents.filter((item) => !isSampleParent(item)));

    [
      'metta_lead_finance_demo_seed_v1',
      'metta_lead_stage_demo_seed_v1',
      'metta_lead_demo_reset_v6',
      'metta_lead_demo_firestore_reset_v6',
      'metta_lead_demo_reset_v7',
      'metta_lead_demo_reset_v8',
      'metta_lead_demo_firestore_reset_v8',
      'metta_appointment_demo_reset_v4',
      'metta_appointment_demo_firestore_reset_v4',
      'metta_appointment_demo_reset_v5',
      'metta_parent_profiles_demo_firestore_reset_v2',
      'metta_parent_profiles_demo_firestore_reset_v3',
    ].forEach((key) => localStorage.setItem(key, '1'));

    if (previousVersion !== CURRENT_PURGE_VERSION && 'caches' in window) {
      void caches.keys()
        .then((keys) => Promise.all(keys
          .filter((key) => /metta|vite|workbox|demo/i.test(key))
          .map((key) => caches.delete(key))))
        .catch(() => {});
    }

    localStorage.setItem(PURGE_VERSION_KEY, CURRENT_PURGE_VERSION);
  } catch (error) {
    console.warn('[ClientDataPurge] Cannot purge sample data:', error);
  }
}
