const PURGE_VERSION_KEY = 'metta_client_data_purge_version';
const CURRENT_PURGE_VERSION = '2026-06-16-center-cache-sync-v2';

const LEGACY_DATA_KEYS = [
  'metta_leads',
  'metta_lead_activities',
  'metta_appointments',
  'metta_parent_profiles',
  'metta_sales_manual_tasks',
  'metta_blog_posts',
  'metta_call_logs',
  'metta_call_center_settings',
  'metta_lead_center_configs',
  'metta_lead_source_configs',
  'metta_sales_assignment_rules',
  'metta_source_engine',
];

const LEGACY_DEMO_FLAGS = [
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
  'metta_appointment_demo_firestore_reset_v5',
  'metta_parent_profiles_demo_firestore_reset_v2',
  'metta_parent_profiles_demo_firestore_reset_v3',
];

export function purgeSampleClientData() {
  if (typeof window === 'undefined') return;
  try {
    const previousVersion = localStorage.getItem(PURGE_VERSION_KEY);
    if (previousVersion === CURRENT_PURGE_VERSION) return;

    [...LEGACY_DATA_KEYS, ...LEGACY_DEMO_FLAGS].forEach((key) => localStorage.removeItem(key));

    if ('caches' in window) {
      void caches.keys()
        .then((keys) => Promise.all(keys
          .filter((key) => /metta|vite|workbox|demo/i.test(key))
          .map((key) => caches.delete(key))))
        .catch(() => {});
    }

    localStorage.setItem(PURGE_VERSION_KEY, CURRENT_PURGE_VERSION);
  } catch (error) {
    console.warn('[ClientDataPurge] Cannot purge local business cache:', error);
  }
}
