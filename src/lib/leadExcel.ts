import * as XLSX from 'xlsx';
import { DEAL_QUOTED_STATUS, DEFAULT_DEAL_CURRENCY, LOST_LEAD_STATUS, WON_LEAD_STATUS, leadStatuses } from '@/lib/constants';
import { expectedRevenueAmount, revenueAmount } from '@/lib/leadFinance';
import type { Appointment, Lead, LeadActivity, LeadPriorityLevel } from '@/types/crm';

type LeadExcelKey = keyof Lead;

interface LeadExcelColumn {
  key: LeadExcelKey;
  label: string;
  sample?: string | number;
  type?: 'number';
}

export const leadExcelColumns: LeadExcelColumn[] = [
  { key: 'id', label: 'Lead ID' },
  { key: 'parentName', label: 'Tên phụ huynh', sample: 'Chị Mai Anh' },
  { key: 'studentName', label: 'Tên học sinh', sample: 'Bảo An' },
  { key: 'fullName', label: 'Tên hiển thị', sample: 'Bảo An' },
  { key: 'phone', label: 'Số điện thoại', sample: '0971000000' },
  { key: 'email', label: 'Email', sample: 'demo.import@metta.test' },
  { key: 'contactType', label: 'Loại liên hệ', sample: 'parent' },
  { key: 'age', label: 'Tuổi', sample: '7' },
  { key: 'school', label: 'Trường', sample: 'Trường Quốc tế Việt Úc' },
  { key: 'currentClass', label: 'Lớp hiện tại', sample: 'Lớp 2' },
  { key: 'interestedCourse', label: 'Khóa học quan tâm', sample: 'METTA Kiddies' },
  { key: 'currentLevel', label: 'Trình độ hiện tại' },
  { key: 'targetGoal', label: 'Mục tiêu' },
  { key: 'source', label: 'Nguồn lead', sample: 'Meta Lead Form' },
  { key: 'referralPhone', label: 'SĐT người referral', sample: '0971000000' },
  { key: 'centerName', label: 'Trung tâm', sample: 'METTA' },
  { key: 'priorityLevel', label: 'Cấp độ ưu tiên', sample: 5, type: 'number' },
  { key: 'status', label: 'Trạng thái', sample: leadStatuses[0] },
  { key: 'assignedTo', label: 'Sales ID' },
  { key: 'assignedToName', label: 'Sales phụ trách', sample: 'Linh' },
  { key: 'assignedBy', label: 'Người phân lead' },
  { key: 'assignedStatus', label: 'Trạng thái phân lead', sample: 'active' },
  { key: 'assignedAt', label: 'Ngày phân lead' },
  { key: 'followUpDate', label: 'Ngày follow-up' },
  { key: 'consultationDate', label: 'Ngày tư vấn/test' },
  { key: 'dealSize', label: 'Deal size', sample: 20000000, type: 'number' },
  { key: 'dealCurrency', label: 'Currency', sample: DEFAULT_DEAL_CURRENCY },
  { key: 'discountPercent', label: '% Discount', sample: 10, type: 'number' },
  { key: 'expectedRevenue', label: 'Expected revenue', type: 'number' },
  { key: 'revenue', label: 'Revenue', type: 'number' },
  { key: 'expectedCloseDate', label: 'Ngày dự kiến chốt' },
  { key: 'dealPackage', label: 'Gói học' },
  { key: 'dealNote', label: 'Note deal' },
  { key: 'enrollmentType', label: 'Loại enrollment', sample: 'new' },
  { key: 'wonAt', label: 'Ngày đăng ký học' },
  { key: 'revenueAt', label: 'Ngày ghi nhận revenue' },
  { key: 'pendingReason', label: 'Lý do pending' },
  { key: 'pendingReasonNote', label: 'Note pending' },
  { key: 'pendingWarmthPercent', label: 'Warmth %', type: 'number' },
  { key: 'lostReason', label: 'Lý do mất lead' },
  { key: 'lostNote', label: 'Note mất lead' },
  { key: 'initialNote', label: 'Ghi chú ban đầu', sample: 'Lead import từ file mẫu.' },
  { key: 'statusUpdatedAt', label: 'Ngày cập nhật status' },
  { key: 'failedAssignedTo', label: 'Sales bị trả lead' },
  { key: 'failedAssignedToName', label: 'Tên sales bị trả lead' },
  { key: 'failedAt', label: 'Ngày trả lead' },
  { key: 'failedReason', label: 'Lý do trả lead' },
  { key: 'convertedToStudentId', label: 'Student ID sau chuyển đổi' },
  { key: 'createdAt', label: 'Ngày tạo' },
  { key: 'updatedAt', label: 'Ngày cập nhật' },
];

export interface ParsedLeadImportRow {
  rowNumber: number;
  lead: Partial<Lead>;
  mode: 'create' | 'update';
  warnings: string[];
}

export interface ParsedLeadImportResult {
  rows: ParsedLeadImportRow[];
  errors: string[];
}

const CONTACT_TYPES = ['parent', 'student', 'other'] as const;
const ASSIGNMENT_STATUSES = ['unassigned', 'active', 'accepted', 'returned'] as const;
type ContactType = (typeof CONTACT_TYPES)[number];
type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

function normalizeHeader(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9%]+/g, '');
}

function toCellValue(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function toNumber(value: unknown) {
  const raw = toCellValue(value).replace(/[^\d.-]/g, '');
  if (!raw) return undefined;
  const num = Number(raw);
  return Number.isFinite(num) ? num : undefined;
}

function rowValue(row: Record<string, unknown>, column: LeadExcelColumn) {
  const lookup = new Map<string, unknown>();
  Object.entries(row).forEach(([key, value]) => {
    lookup.set(normalizeHeader(key), value);
  });
  return lookup.get(normalizeHeader(column.label)) ?? lookup.get(normalizeHeader(String(column.key)));
}

function cleanedPriority(value: unknown): LeadPriorityLevel | undefined {
  const num = toNumber(value);
  if (!num) return undefined;
  return Math.min(Math.max(Math.round(num), 1), 5) as LeadPriorityLevel;
}

function cleanedStatus(value: unknown) {
  const raw = toCellValue(value);
  return (leadStatuses as readonly string[]).includes(raw) ? raw : leadStatuses[0];
}

export function leadToExcelRow(lead: Lead) {
  return Object.fromEntries(leadExcelColumns.map((column) => {
    let value = lead[column.key];
    if (column.key === 'expectedRevenue') value = lead.expectedRevenue || expectedRevenueAmount(lead);
    if (column.key === 'revenue') value = lead.revenue || revenueAmount(lead);
    return [column.label, value ?? ''];
  }));
}

export function leadImportTemplateRows() {
  const base = Object.fromEntries(leadExcelColumns.map((column) => [column.label, column.sample ?? '']));
  return [
    {
      ...base,
      'Lead ID': '',
      'Tên phụ huynh': 'Chị Demo Import',
      'Tên học sinh': 'Bé Import 01',
      'Tên hiển thị': 'Bé Import 01',
      'Số điện thoại': '0971999001',
      Email: 'import.demo.01@metta.test',
      'Nguồn lead': 'Meta Lead Form',
      'Trung tâm': 'METTA',
      'Cấp độ ưu tiên': 5,
      'Trạng thái': leadStatuses[0],
      'Khóa học quan tâm': 'METTA Kiddies',
      'Ghi chú ban đầu': 'Lead mẫu để test import database.',
    },
    {
      ...base,
      'Lead ID': '',
      'Tên phụ huynh': 'Anh Demo Báo Phí',
      'Tên học sinh': 'Bé Import 02',
      'Tên hiển thị': 'Bé Import 02',
      'Số điện thoại': '0971999002',
      Email: 'import.demo.02@metta.test',
      'Nguồn lead': 'Referral',
      'SĐT người referral': '0971999001',
      'Trung tâm': 'METTA',
      'Cấp độ ưu tiên': 5,
      'Trạng thái': DEAL_QUOTED_STATUS,
      'Khóa học quan tâm': 'METTA on Phonics',
      'Deal size': 20000000,
      Currency: DEFAULT_DEAL_CURRENCY,
      '% Discount': 10,
      'Expected revenue': 18000000,
      'Lý do pending': 'Đã hẹn CK',
      'Warmth %': 90,
      'Ghi chú ban đầu': 'Lead mẫu có finance để test expected revenue.',
    },
  ];
}

export function makeLeadWorkbook(leads: Lead[], activities: LeadActivity[] = [], appointments: Appointment[] = []) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(leads.map(leadToExcelRow)), 'Leads');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(activities.map((activity) => ({
    'Activity ID': activity.id,
    'Lead ID': activity.leadId,
    Type: activity.type,
    Content: activity.content,
    'Created by': activity.createdBy,
    'Created at': activity.createdAt,
  }))), 'Lead Activities');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(appointments.map((appointment) => ({
    'Appointment ID': appointment.id,
    'Lead ID': appointment.leadId || '',
    Title: appointment.title,
    Type: appointment.type,
    'Start time': appointment.startTime,
    'End time': appointment.endTime,
    'Assigned to': appointment.assignedTo,
    'Assigned name': appointment.assignedToName || '',
    Status: appointment.status,
    Notes: appointment.notes,
    'Created at': appointment.createdAt,
    'Updated at': appointment.updatedAt,
  }))), 'Appointments');
  return workbook;
}

export function makeLeadTemplateWorkbook() {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(leadImportTemplateRows()), 'Leads');
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
    ['Field', 'Required', 'Notes'],
    ['Tên học sinh hoặc Tên phụ huynh', 'Yes', 'Ít nhất một trong hai tên phải có dữ liệu.'],
    ['Số điện thoại', 'Yes', 'Dùng để upsert nếu không có Lead ID.'],
    ['Trạng thái', 'No', `Nếu để trống, hệ thống dùng "${leadStatuses[0]}".`],
    ['Đã báo phí/Chờ chốt', 'Conditional', 'Cần có Lý do pending.'],
    ['Mất lead', 'Conditional', 'Cần có Lý do mất lead.'],
  ]), 'Guide');
  return workbook;
}

export function downloadWorkbook(workbook: XLSX.WorkBook, fileName: string) {
  XLSX.writeFile(workbook, fileName, { compression: true });
}

export async function parseLeadWorkbook(file: File, existingLeads: Lead[]): Promise<ParsedLeadImportResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames.find((name) => normalizeHeader(name) === 'leads') || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return { rows: [], errors: ['Không tìm thấy sheet dữ liệu leads trong file.'] };

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const existingById = new Map(existingLeads.map((lead) => [lead.id, lead]));
  const existingByPhone = new Map(existingLeads.filter((lead) => lead.phone).map((lead) => [lead.phone, lead]));
  const parsed: ParsedLeadImportRow[] = [];
  const errors: string[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const lead: Partial<Lead> = {};
    const warnings: string[] = [];

    leadExcelColumns.forEach((column) => {
      const value = rowValue(row, column);
      if (value === undefined || value === null || value === '') return;
      if (column.key === 'priorityLevel') lead.priorityLevel = cleanedPriority(value);
      else if (column.type === 'number') {
        const num = toNumber(value);
        if (num !== undefined) (lead as Record<string, unknown>)[column.key] = num;
      } else if (column.key === 'status') lead.status = cleanedStatus(value) as Lead['status'];
      else (lead as Record<string, unknown>)[column.key] = toCellValue(value);
    });

    const displayName = String(lead.studentName || lead.parentName || lead.fullName || '').trim();
    const phone = String(lead.phone || '').trim();
    if (!displayName && !phone) return;
    if (!displayName || !phone) {
      errors.push(`Dòng ${rowNumber}: cần có tên học sinh/phụ huynh và số điện thoại.`);
      return;
    }

    const matched = (lead.id && existingById.get(lead.id)) || existingByPhone.get(phone);
    if (matched) lead.id = matched.id;
    else delete lead.id;

    lead.fullName = String(lead.fullName || lead.studentName || lead.parentName || '').trim();
    lead.phone = phone;
    const contactType = String(lead.contactType || '');
    const assignedStatus = String(lead.assignedStatus || '');
    lead.contactType = CONTACT_TYPES.includes(contactType as ContactType) ? contactType as Lead['contactType'] : 'parent';
    lead.assignedStatus = ASSIGNMENT_STATUSES.includes(assignedStatus as AssignmentStatus)
      ? assignedStatus as Lead['assignedStatus']
      : lead.assignedTo ? 'active' : 'unassigned';
    lead.status = (lead.status || leadStatuses[0]) as Lead['status'];
    lead.dealCurrency = lead.dealCurrency || DEFAULT_DEAL_CURRENCY;
    lead.enrollmentType = lead.enrollmentType || 'new';
    lead.initialNote = lead.initialNote || '';

    if (lead.status === DEAL_QUOTED_STATUS && !lead.pendingReason) warnings.push('Trạng thái báo phí cần có Lý do pending để import thành công.');
    if (lead.status === LOST_LEAD_STATUS && !lead.lostReason) warnings.push('Trạng thái mất lead cần có Lý do mất lead để import thành công.');
    if (lead.status === WON_LEAD_STATUS && !lead.revenue) warnings.push('Lead đăng ký học chưa có Revenue; hệ thống sẽ tính theo Deal size/Discount nếu có.');
    if (String(lead.source || '').toLowerCase() === 'referral' && !String(lead.referralPhone || '').trim()) warnings.push('Lead Referral cần có SĐT người referral.');

    parsed.push({
      rowNumber,
      lead,
      mode: matched ? 'update' : 'create',
      warnings,
    });
  });

  return { rows: parsed, errors };
}
