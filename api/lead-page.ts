import type { Query } from 'firebase-admin/firestore';
import { ApiError, requireAnyRole, requireApiUser } from './_apiAuth.js';
import { adminDb } from './_firebaseAdmin.js';

const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGE_SIZE = 100;
const DEFAULT_SINCE_DAYS = 30;
const MAX_PAGE_NUMBER = 100_000;

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

export const config = { maxDuration: 30 };

function queryValue(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

function positiveInteger(value: unknown, fallback: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(max, Math.round(parsed)));
}

function normalizeDateStart(value?: string) {
  if (!value) return '';
  return value.length === 10 ? `${value}T00:00:00.000Z` : value;
}

function normalizeDateEnd(value?: string) {
  if (!value) return '';
  return value.length === 10 ? `${value}T23:59:59.999Z` : value;
}

function daysAgoIso(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

async function handleLeadPage(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const db = adminDb();
  const user = await requireApiUser(db, req);
  requireAnyRole(user, ['admin', 'manager', 'sales']);

  const requestedPage = positiveInteger(queryValue(req.query?.page), 1, MAX_PAGE_NUMBER);
  const pageSize = positiveInteger(queryValue(req.query?.pageSize), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const sinceDays = positiveInteger(queryValue(req.query?.sinceDays), DEFAULT_SINCE_DAYS, 3_650);
  const dateFrom = normalizeDateStart(queryValue(req.query?.dateFrom)) || daysAgoIso(sinceDays);
  const dateTo = normalizeDateEnd(queryValue(req.query?.dateTo));

  let baseQuery: Query = db.collection('leads');
  if (user.role === 'sales') baseQuery = baseQuery.where('assignedTo', '==', user.id);
  baseQuery = baseQuery.where('createdAt', '>=', dateFrom);
  if (dateTo) baseQuery = baseQuery.where('createdAt', '<=', dateTo);
  baseQuery = baseQuery.orderBy('createdAt', 'desc');

  const readPage = (page: number) => baseQuery.offset((page - 1) * pageSize).limit(pageSize).get();
  // Count first so an invalid/oversized page cannot force an unnecessarily large offset scan.
  const countSnap = await baseQuery.count().get();
  const total = countSnap.data().count;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const pageSnap = await readPage(page);
  const leads = pageSnap.docs.map((item) => ({ ...item.data(), id: item.id }));

  return res.status(200).json({
    leads,
    page,
    pageSize,
    total,
    totalPages,
    hasPrevious: page > 1,
    hasNext: page < totalPages,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await handleLeadPage(req, res);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Không tải được trang leads.';
    console.error('[LeadPage] Query failed:', error);
    return res.status(status).json({ error: message });
  }
}
