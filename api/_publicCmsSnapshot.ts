import { get, put } from '@vercel/blob';

export type PublicCmsDocument = {
  id: string;
  [key: string]: unknown;
};

export type PublicCmsSnapshot = {
  pages: PublicCmsDocument[];
  sections: PublicCmsDocument[];
  settings: Record<string, unknown> | null;
  generatedAt: string;
  publishedAt?: string;
  publishedBy?: {
    id: string;
    email: string;
    role: string;
  };
  source?: string;
  schemaVersion?: number;
};

export type PublicCmsPublisher = {
  id: string;
  email: string;
  role: string;
};

export const PUBLIC_CMS_BLOB_PATH = 'cms/public-cms.json';
export const PUBLIC_CMS_CACHE_HEADER = 'public, max-age=15, s-maxage=60, stale-while-revalidate=3600';

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeDocuments(value: unknown): PublicCmsDocument[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => ({ ...item, id: String(item.id || '') }))
    .filter((item) => item.id);
}

export function normalizePublicCmsSnapshot(input: unknown): PublicCmsSnapshot {
  const data = isRecord(input) ? input : {};
  const settings = isRecord(data.settings) ? cloneJson(data.settings) : null;
  return {
    pages: normalizeDocuments(data.pages),
    sections: normalizeDocuments(data.sections),
    settings,
    generatedAt: String(data.generatedAt || new Date().toISOString()),
    schemaVersion: Number(data.schemaVersion || 1),
  };
}

function hasBlobConfig() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN
    || (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID),
  );
}

export async function readPublicCmsBlobSnapshot() {
  if (!hasBlobConfig()) return null;

  const result = await get(PUBLIC_CMS_BLOB_PATH, { access: 'public' });
  if (!result || result.statusCode !== 200 || !result.stream) return null;

  const text = await new Response(result.stream).text();
  const snapshot = normalizePublicCmsSnapshot(JSON.parse(text));

  return {
    snapshot: {
      ...snapshot,
      source: 'blob',
    },
    blob: result.blob,
  };
}

export async function writePublicCmsBlobSnapshot(input: unknown, publisher: PublicCmsPublisher) {
  if (!hasBlobConfig()) {
    throw new Error('Missing BLOB_READ_WRITE_TOKEN or Vercel Blob OIDC configuration.');
  }

  const snapshot: PublicCmsSnapshot = {
    ...normalizePublicCmsSnapshot(input),
    publishedAt: new Date().toISOString(),
    publishedBy: {
      id: publisher.id,
      email: publisher.email,
      role: publisher.role,
    },
    source: 'blob',
    schemaVersion: 1,
  };

  const body = JSON.stringify(snapshot);
  const blob = await put(PUBLIC_CMS_BLOB_PATH, body, {
    access: 'public',
    allowOverwrite: true,
    contentType: 'application/json',
    cacheControlMaxAge: 60,
  });

  return { snapshot, blob };
}
