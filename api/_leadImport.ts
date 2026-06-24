import type { DocumentData, DocumentReference, DocumentSnapshot, Firestore, QueryDocumentSnapshot, WriteBatch } from 'firebase-admin/firestore';
import { ApiError, requireAnyRole, requireApiUser } from './_apiAuth.js';
import { adminDb } from './_firebaseAdmin.js';
import {
  dedupeIndexPayload,
  leadDedupeIdentity,
  normalizeLeadPhone,
  normalizeStudentName,
  type DedupeLeadDoc,
} from './_leadDedupe.js';
import { salesImportAssignmentTargetsSelf, salesImportExistingLeadAccess } from './_leadImportPolicy.js';

const LEAD_STATUSES = [
  'Lead mới',
  'Đã liên hệ',
  'Chưa nghe máy',
  'Đã hẹn tư vấn',
  'Đã tư vấn/Đặt lịch test',
  'Đã test/Học thử',
  'Đã báo phí/Chờ chốt',
  'Đã đăng ký học',
  'Mất lead',
] as const;

const DEAL_QUOTED_STATUS = 'Đã báo phí/Chờ chốt';
const WON_LEAD_STATUS = 'Đã đăng ký học';
const LOST_LEAD_STATUS = 'Mất lead';
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_IMPORT_ROWS = 2_000;
const MAX_BATCH_WRITES = 400;
const GET_ALL_CHUNK_SIZE = 250;
const FALLBACK_QUERY_CONCURRENCY = 20;

const SOURCE_PRIORITY: Record<string, number> = {
  'Meta Lead Form': 5,
  Referral: 5,
  'Meta Ads': 4,
  Website: 4,
  'Zalo OA': 4,
  'Google Ads': 4,
  'Landing Page': 4,
  'Facebook Ads': 4,
  'Sales input': 3,
  'Instagram Ads': 3,
  'TikTok Ads': 3,
  Zalo: 3,
  'Walk-in': 3,
  'Khác': 1,
};

const STRING_FIELDS = [
  'fullName', 'parentName', 'studentName', 'email', 'contactType', 'age', 'school', 'currentClass',
  'interestedCourse', 'currentLevel', 'targetGoal', 'source', 'referralPhone', 'centerName', 'status',
  'followUpDate', 'consultationDate', 'dealCurrency', 'dealPackage', 'dealNote', 'expectedCloseDate',
  'enrollmentType', 'wonAt', 'pendingReason', 'pendingReasonNote', 'lostReason', 'lostNote', 'initialNote',
  'revenueAt', 'convertedToStudentId', 'statusUpdatedAt', 'failedAssignedTo', 'failedAssignedToName',
  'failedAt', 'failedReason',
] as const;

const NUMBER_FIELDS = [
  'priorityLevel', 'dealSize', 'discountPercent', 'expectedRevenue', 'revenue', 'pendingWarmthPercent',
  'statusUpdatedAtMs', 'failedAtMs',
] as const;

type ImportLead = Record<string, unknown> & {
  id?: string;
  phone?: string;
  parentName?: string;
  studentName?: string;
  fullName?: string;
  assignedTo?: string;
  assignedToName?: string;
};

type ImportRow = {
  rowNumber: number;
  lead: ImportLead;
};

type ImportMode = 'create' | 'update' | 'failed';

type ImportRowResult = {
  rowNumber: number;
  leadId: string;
  mode: ImportMode;
  error?: string;
  warnings?: string[];
};

type ApiUserRecord = {
  id: string;
  fullName: string;
  email: string;
  role: string;
  active: boolean;
};

type PreparedRow = ImportRow & {
  inputId: string;
  phone: string;
  studentName: string;
  identity: ReturnType<typeof leadDedupeIdentity>;
};

type LeadState = DedupeLeadDoc & Record<string, unknown>;

type WriteGroup = {
  leadId: string;
  rowNumbers: number[];
  writeCount: number;
  apply: (batch: WriteBatch) => void;
};

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
};

export const config = { maxDuration: 60 };

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function normalizedLookup(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

function clampPriority(value: unknown) {
  const parsed = Number(value);
  if (parsed >= 5) return 5;
  if (parsed >= 4) return 4;
  if (parsed >= 3) return 3;
  if (parsed >= 2) return 2;
  return 1;
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

function importedPatch(input: ImportLead) {
  const patch: Record<string, unknown> = {};
  STRING_FIELDS.forEach((field) => {
    if (!(field in input)) return;
    const value = cleanText(input[field]);
    if (value) patch[field] = value;
  });
  NUMBER_FIELDS.forEach((field) => {
    if (!(field in input) || input[field] === '' || input[field] === null || input[field] === undefined) return;
    const value = Number(input[field]);
    if (Number.isFinite(value)) patch[field] = value;
  });
  if (Array.isArray(input.tags)) {
    patch.tags = Array.from(new Set(input.tags.map(cleanText).filter(Boolean))).slice(0, 20);
  }
  return patch;
}

function leadFromSnapshot(snap: QueryDocumentSnapshot<DocumentData>) {
  return { id: snap.id, ...snap.data() } as LeadState;
}

async function getAllChunked(db: Firestore, refs: DocumentReference<DocumentData>[]) {
  const snapshots: DocumentSnapshot<DocumentData>[] = [];
  for (let index = 0; index < refs.length; index += GET_ALL_CHUNK_SIZE) {
    snapshots.push(...await db.getAll(...refs.slice(index, index + GET_ALL_CHUNK_SIZE)));
  }
  return snapshots;
}

async function parallelChunks<T>(items: T[], worker: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += FALLBACK_QUERY_CONCURRENCY) {
    await Promise.all(items.slice(index, index + FALLBACK_QUERY_CONCURRENCY).map(worker));
  }
}

function findRequestedSales(users: ApiUserRecord[], assignedTo: string, assignedToName: string) {
  const sales = users.filter((user) => user.role === 'sales' && user.active);
  const byAssignedTo = assignedTo
    ? sales.find((user) => user.id === assignedTo || normalizedLookup(user.fullName) === normalizedLookup(assignedTo))
    : undefined;
  const byName = assignedToName
    ? sales.find((user) => normalizedLookup(user.fullName) === normalizedLookup(assignedToName))
    : undefined;
  if ((assignedTo && !byAssignedTo) || (assignedToName && !byName)) return null;
  if (byAssignedTo && byName && byAssignedTo.id !== byName.id) return null;
  return byAssignedTo || byName || null;
}

function applyAssignment(
  lead: LeadState,
  sales: { id: string; fullName: string } | null,
  assignedBy: string,
  now: string,
  nowMs: number,
  accepted = false,
) {
  if (!sales) {
    return {
      ...lead,
      assignedTo: '',
      assignedToName: '',
      assignedBy: '',
      assignedAt: '',
      assignedAtMs: 0,
      assignedExpiresAtMs: 0,
      assignedStatus: 'unassigned',
    };
  }
  return {
    ...lead,
    assignedTo: sales.id,
    assignedToName: sales.fullName,
    assignedBy,
    assignedAt: now,
    assignedAtMs: nowMs,
    assignedExpiresAtMs: accepted ? 0 : nowMs + DAY_MS,
    assignedStatus: accepted ? 'accepted' : 'active',
    failedReason: '',
    failedAt: '',
    failedAtMs: 0,
  };
}

function nextStageHistory(existing: LeadState | null, status: string, now: string) {
  const history = Array.isArray(existing?.stageHistory) ? existing.stageHistory : [];
  const last = history[history.length - 1] as { status?: string; exitedAt?: string } | undefined;
  if (last?.status === status) return history;
  const closed = last && !last.exitedAt
    ? [...history.slice(0, -1), { ...last, exitedAt: now }]
    : history;
  return [...closed, { status, enteredAt: now }];
}

function validateLead(lead: LeadState) {
  if (!cleanText(lead.studentName) && !cleanText(lead.parentName) && !cleanText(lead.fullName)) {
    throw new Error('Cần có tên học sinh, tên phụ huynh hoặc tên hiển thị.');
  }
  if (!normalizeLeadPhone(lead.phone)) throw new Error('Cần có số điện thoại.');
  const status = cleanText(lead.status);
  if (status && !(LEAD_STATUSES as readonly string[]).includes(status)) throw new Error(`Trạng thái "${status}" không hợp lệ.`);
  if (status === DEAL_QUOTED_STATUS && !cleanText(lead.pendingReason)) throw new Error('Trạng thái báo phí cần có Lý do pending.');
  if (status === LOST_LEAD_STATUS && !cleanText(lead.lostReason)) throw new Error('Trạng thái mất lead cần có Lý do mất lead.');
  if (normalizedLookup(lead.source) === 'referral' && normalizeLeadPhone(lead.referralPhone).replace(/\D/g, '').length < 9) {
    throw new Error('Lead source Referral cần có SĐT người giới thiệu.');
  }
}

function resolvePriority(sourceConfigs: Map<string, number>, source: string, fallback: unknown) {
  return sourceConfigs.get(normalizedLookup(source)) || SOURCE_PRIORITY[source] || clampPriority(fallback);
}

async function handleLeadImport(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const db = adminDb();
  const apiUser = await requireApiUser(db, req);
  requireAnyRole(apiUser, ['admin', 'manager', 'sales']);

  const body = req.body && typeof req.body === 'object' ? req.body as { rows?: unknown } : {};
  if (!Array.isArray(body.rows)) throw new ApiError(400, 'rows must be an array.');
  if (!body.rows.length) throw new ApiError(400, 'rows must not be empty.');
  if (body.rows.length > MAX_IMPORT_ROWS) throw new ApiError(400, `Maximum ${MAX_IMPORT_ROWS} rows per import.`);

  const preparedRows: PreparedRow[] = body.rows.map((value, index) => {
    if (!value || typeof value !== 'object') throw new ApiError(400, `Invalid row at index ${index}.`);
    const row = value as Partial<ImportRow>;
    if (!Number.isInteger(row.rowNumber) || Number(row.rowNumber) < 1 || !row.lead || typeof row.lead !== 'object') {
      throw new ApiError(400, `Invalid row at index ${index}.`);
    }
    const lead = row.lead as ImportLead;
    const phone = normalizeLeadPhone(lead.phone);
    const studentName = cleanText(lead.studentName);
    return {
      rowNumber: Number(row.rowNumber),
      lead,
      inputId: cleanText(lead.id),
      phone,
      studentName,
      identity: leadDedupeIdentity(phone, studentName),
    };
  });

  const [usersResult, configsResult] = await Promise.allSettled([
    db.collection('users').get(),
    db.collection('appConfig').doc('leadSourceConfigs').get(),
  ]);

  const usersAvailable = usersResult.status === 'fulfilled';
  const users: ApiUserRecord[] = usersResult.status === 'fulfilled'
    ? usersResult.value.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        fullName: cleanText(data.fullName),
        email: cleanText(data.email),
        role: cleanText(data.role),
        active: data.active === true,
      };
    })
    : [];

  const sourceConfigs = new Map<string, number>();
  let sourceConfigWarning = '';
  let assignmentConfigWarning = '';
  if (configsResult.status === 'fulfilled') {
    const sourceSnap = configsResult.value;
    const sourceData = sourceSnap.exists ? sourceSnap.data() : null;
    const configs = Array.isArray(sourceData?.configs) ? sourceData.configs : [];
    configs.forEach((item: Record<string, unknown>) => {
      if (item?.active === false || !cleanText(item?.name)) return;
      sourceConfigs.set(normalizedLookup(item.name), clampPriority(item.priorityLevel));
    });
  } else {
    sourceConfigWarning = 'Không đọc được source config; đã dùng priority fallback.';
  }
  if (!usersAvailable) {
    assignmentConfigWarning = 'Không đọc được danh sách users; assignment từ file không được áp dụng và lead mới sẽ để unassigned.';
  }

  const explicitIds = Array.from(new Set(preparedRows.map((row) => row.inputId).filter(Boolean)));
  const indexIds = Array.from(new Set(preparedRows.map((row) => row.identity?.indexId || '').filter(Boolean)));
  const [explicitSnaps, indexSnaps] = await Promise.all([
    getAllChunked(db, explicitIds.map((id) => db.collection('leads').doc(id))),
    getAllChunked(db, indexIds.map((id) => db.collection('leadDedupeIndex').doc(id))),
  ]);

  const explicitExistingIds = new Set(explicitSnaps.filter((snap) => snap.exists).map((snap) => snap.id));
  const indexLeadIdByIndexId = new Map(indexSnaps
    .filter((snap) => snap.exists && cleanText(snap.data()?.leadId))
    .map((snap) => [snap.id, cleanText(snap.data()?.leadId)]));
  const stateById = new Map<string, LeadState>();
  explicitSnaps.forEach((snap) => {
    if (snap.exists) stateById.set(snap.id, { id: snap.id, ...snap.data() } as LeadState);
  });
  const targetLeadIds = Array.from(new Set(indexLeadIdByIndexId.values())).filter((id) => !stateById.has(id));
  const targetSnaps = await getAllChunked(db, targetLeadIds.map((id) => db.collection('leads').doc(id)));
  targetSnaps.forEach((snap) => {
    if (snap.exists) stateById.set(snap.id, { id: snap.id, ...snap.data() } as LeadState);
  });
  const originalById = new Map(Array.from(stateById, ([id, lead]) => [id, { ...lead }]));

  const keyToLeadId = new Map<string, string>();
  const staleIndexIds = new Set<string>();
  preparedRows.forEach((row) => {
    if (!row.identity) return;
    const indexedLeadId = indexLeadIdByIndexId.get(row.identity.indexId);
    const indexedLead = indexedLeadId ? stateById.get(indexedLeadId) : null;
    if (indexedLead
      && normalizeLeadPhone(indexedLead.phone) === row.identity.phone
      && normalizeStudentName(indexedLead.studentName) === row.identity.studentKey) {
      keyToLeadId.set(row.identity.rawKey, indexedLead.id);
    } else if (indexedLeadId) {
      staleIndexIds.add(row.identity.indexId);
    }
  });

  const missingIdentitiesByPhone = new Map<string, NonNullable<PreparedRow['identity']>[]>();
  preparedRows.forEach((row) => {
    if (!row.identity || keyToLeadId.has(row.identity.rawKey)) return;
    const identities = missingIdentitiesByPhone.get(row.identity.phone) || [];
    if (!identities.some((item) => item.rawKey === row.identity!.rawKey)) identities.push(row.identity);
    missingIdentitiesByPhone.set(row.identity.phone, identities);
  });
  await parallelChunks(Array.from(missingIdentitiesByPhone), async ([phone, identities]) => {
    const snap = await db.collection('leads').where('phone', '==', phone).limit(25).get();
    const candidates = snap.docs.map(leadFromSnapshot);
    candidates.forEach((lead) => {
      if (!stateById.has(lead.id)) {
        stateById.set(lead.id, lead);
        originalById.set(lead.id, { ...lead });
      }
    });
    identities.forEach((identity) => {
      const matched = candidates.find((lead) => normalizeStudentName(lead.studentName) === identity.studentKey);
      if (matched) keyToLeadId.set(identity.rawKey, matched.id);
    });
  });

  const results: ImportRowResult[] = [];
  const finalRowNumbersByLeadId = new Map<string, number[]>();
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();

  preparedRows.forEach((row) => {
    const warnings: string[] = [];
    const result: ImportRowResult = { rowNumber: row.rowNumber, leadId: '', mode: 'failed', warnings };
    results.push(result);
    try {
      if (!row.phone) throw new Error('Cần có số điện thoại.');
      const displayName = cleanText(row.lead.studentName || row.lead.parentName || row.lead.fullName);
      if (!displayName) throw new Error('Cần có tên học sinh, tên phụ huynh hoặc tên hiển thị.');
      if (!row.studentName) warnings.push('Thiếu tên học sinh: dòng này không tự động merge theo SĐT và sẽ không tạo dedupe index.');

      const requestedAssignedTo = cleanText(row.lead.assignedTo);
      const requestedAssignedToName = cleanText(row.lead.assignedToName);
      const hasRequestedAssignment = Boolean(requestedAssignedTo || requestedAssignedToName);
      if (apiUser.role === 'sales' && hasRequestedAssignment
        && !salesImportAssignmentTargetsSelf(apiUser, requestedAssignedTo, requestedAssignedToName)) {
        throw new Error('Sales chỉ được import assignment cho chính mình.');
      }

      const explicitExistingId = row.inputId && stateById.has(row.inputId) ? row.inputId : '';
      if (row.inputId && !explicitExistingId) warnings.push(`Lead ID ${row.inputId} không tồn tại; hệ thống đã kiểm tra trùng theo SĐT + tên học sinh.`);
      const dedupeLeadId = row.identity ? keyToLeadId.get(row.identity.rawKey) || '' : '';
      if (explicitExistingId && dedupeLeadId && explicitExistingId !== dedupeLeadId) {
        throw new Error(`Lead ID xung đột với lead ${dedupeLeadId} có cùng SĐT + tên học sinh.`);
      }
      const existingId = explicitExistingId || dedupeLeadId;
      const existing = existingId ? stateById.get(existingId) || null : null;

      if (apiUser.role === 'sales' && existing) {
        const access = salesImportExistingLeadAccess(apiUser, existing.assignedTo, existing.assignedToName);
        if (access === 'forbidden') throw new Error('Lead trùng đang thuộc người khác; sales không có quyền cập nhật hoặc tạo duplicate.');
      }

      const patch = importedPatch(row.lead);
      patch.phone = row.phone;
      if (row.studentName) patch.studentName = row.studentName;
      const merged = {
        ...(existing || {}),
        ...patch,
        id: existing?.id || db.collection('leads').doc().id,
      } as LeadState;
      merged.fullName = cleanText(merged.studentName || merged.parentName || merged.fullName);
      merged.contactType = ['parent', 'student', 'other'].includes(cleanText(merged.contactType)) ? cleanText(merged.contactType) : 'parent';
      merged.status = cleanText(merged.status) || 'Lead mới';
      merged.source = cleanText(merged.source) || 'Website';
      merged.dealCurrency = cleanText(merged.dealCurrency) || 'VND';
      merged.enrollmentType = cleanText(merged.enrollmentType) || 'new';
      merged.initialNote = cleanText(merged.initialNote);
      merged.priorityLevel = resolvePriority(sourceConfigs, cleanText(merged.source), merged.priorityLevel);
      if (sourceConfigWarning) warnings.push(sourceConfigWarning);

      if (apiUser.role === 'sales') {
        if (!existing || !cleanText(existing.assignedTo)) {
          Object.assign(merged, applyAssignment(merged, { id: apiUser.id, fullName: apiUser.fullName }, apiUser.id, now, nowMs, true));
        }
      } else if (hasRequestedAssignment) {
        if (!usersAvailable) {
          warnings.push(assignmentConfigWarning);
          if (!existing) Object.assign(merged, applyAssignment(merged, null, apiUser.id, now, nowMs));
        } else {
          const requestedSales = findRequestedSales(users, requestedAssignedTo, requestedAssignedToName);
          if (!requestedSales) throw new Error('Sales phụ trách trong file không tồn tại hoặc đang inactive.');
          Object.assign(merged, applyAssignment(merged, { id: requestedSales.id, fullName: requestedSales.fullName }, apiUser.id, now, nowMs));
        }
      } else if (!existing) {
        Object.assign(merged, applyAssignment(merged, null, '', now, nowMs));
      }

      merged.createdAt = cleanText(existing?.createdAt) || cleanText(row.lead.createdAt) || now;
      merged.updatedAt = now;
      if (!existing || cleanText(existing.status) !== cleanText(merged.status)) {
        merged.statusUpdatedAt = now;
        merged.statusUpdatedAtMs = nowMs;
      }
      merged.stageHistory = nextStageHistory(existing, cleanText(merged.status), now);
      if (merged.status === DEAL_QUOTED_STATUS && !Number(merged.expectedRevenue || 0) && Number(merged.dealSize || 0)) {
        const discount = Math.min(100, Math.max(0, Number(merged.discountPercent || 0)));
        merged.expectedRevenue = Math.round(Number(merged.dealSize) * (100 - discount) / 100);
      }
      if (merged.status === WON_LEAD_STATUS) {
        merged.wonAt = cleanText(merged.wonAt) || now;
        merged.revenue = Number(merged.revenue || merged.expectedRevenue || merged.dealSize || 0);
        merged.revenueAt = cleanText(merged.revenueAt) || now;
      }

      validateLead(merged);
      const mode: ImportMode = existing ? 'update' : 'create';
      stateById.set(merged.id, stripUndefined(merged));
      if (row.identity) {
        const previousMappedId = keyToLeadId.get(row.identity.rawKey);
        if (previousMappedId && previousMappedId !== merged.id) throw new Error(`Khóa trùng đã thuộc lead ${previousMappedId}.`);
        keyToLeadId.set(row.identity.rawKey, merged.id);
      }
      const rowNumbers = finalRowNumbersByLeadId.get(merged.id) || [];
      rowNumbers.push(row.rowNumber);
      finalRowNumbersByLeadId.set(merged.id, rowNumbers);
      result.leadId = merged.id;
      result.mode = mode;
      if (!warnings.length) delete result.warnings;
    } catch (error) {
      result.error = error instanceof Error ? error.message : 'Không import được dòng này.';
      if (!warnings.length) delete result.warnings;
    }
  });

  const finalIndexIds = new Set<string>();
  const writeGroups: WriteGroup[] = [];
  finalRowNumbersByLeadId.forEach((rowNumbers, leadId) => {
    const lead = stateById.get(leadId);
    if (!lead) return;
    const index = dedupeIndexPayload(lead, now);
    if (index) finalIndexIds.add(index.id);
    writeGroups.push({
      leadId,
      rowNumbers,
      writeCount: index ? 2 : 1,
      apply: (batch) => {
        batch.set(db.collection('leads').doc(leadId), stripUndefined(lead), { merge: false });
        if (index) batch.set(db.collection('leadDedupeIndex').doc(index.id), index.data, { merge: true });
      },
    });
  });

  const writeChunks: WriteGroup[][] = [];
  let currentChunk: WriteGroup[] = [];
  let currentWriteCount = 0;
  writeGroups.forEach((group) => {
    if (currentChunk.length && currentWriteCount + group.writeCount > MAX_BATCH_WRITES) {
      writeChunks.push(currentChunk);
      currentChunk = [];
      currentWriteCount = 0;
    }
    currentChunk.push(group);
    currentWriteCount += group.writeCount;
  });
  if (currentChunk.length) writeChunks.push(currentChunk);

  for (const groups of writeChunks) {
    const batch = db.batch();
    groups.forEach((group) => group.apply(batch));
    try {
      await batch.commit();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Firestore batch commit thất bại.';
      const failedRows = new Set(groups.flatMap((group) => group.rowNumbers));
      results.forEach((result) => {
        if (!failedRows.has(result.rowNumber) || result.mode === 'failed') return;
        result.mode = 'failed';
        result.error = `Không ghi được batch: ${message}`;
      });
    }
  }

  const staleToDelete = Array.from(staleIndexIds).filter((id) => !finalIndexIds.has(id));
  for (let index = 0; index < staleToDelete.length; index += MAX_BATCH_WRITES) {
    const batch = db.batch();
    staleToDelete.slice(index, index + MAX_BATCH_WRITES).forEach((id) => batch.delete(db.collection('leadDedupeIndex').doc(id)));
    await batch.commit().catch((error) => console.warn('[LeadImport] Cannot delete stale dedupe indexes:', error));
  }

  const created = results.filter((result) => result.mode === 'create').length;
  const updated = results.filter((result) => result.mode === 'update').length;
  const failed = results.filter((result) => result.mode === 'failed').length;
  return res.status(200).json({ created, updated, failed, results });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    return await handleLeadImport(req, res);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Không import được leads.';
    console.error('[LeadImport] Import failed:', error);
    return res.status(status).json({ error: message });
  }
}
