import { DEFAULT_COURSE_DEAL_SIZE, DEFAULT_DEAL_CURRENCY, WON_LEAD_STATUS, courseDealSizeDefaults, discountPercentOptions } from '@/lib/constants';
import type { Lead } from '@/types/crm';

export const DEFAULT_DISCOUNT_PERCENT = discountPercentOptions[0];

export type CourseDealSizeRule = {
  courseName: string;
  dealSize?: number;
  aliases?: string[];
};

export type FinanceDefaultOptions = {
  preferExistingDealSize?: boolean;
};

const courseAliases: Record<string, string> = {
  'METTA Young Learners': 'METTA Young Learner',
  'Young Learners': 'METTA Young Learner',
  'Young Learner': 'METTA Young Learner',
  Phonics: 'METTA on Phonics',
};

function canonicalCourseName(course?: string) {
  const value = String(course || '').trim();
  return courseAliases[value] || value;
}

function normalizedCourseKey(course?: string) {
  return canonicalCourseName(course).toLowerCase();
}

function validDealSize(value?: number | string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function courseRuleNames(item: CourseDealSizeRule) {
  return [item.courseName, ...(item.aliases || [])].map(normalizedCourseKey).filter(Boolean);
}

export function courseDealSize(course?: string, courseDeals: readonly CourseDealSizeRule[] = courseDealSizeDefaults) {
  const courseName = canonicalCourseName(course);
  const courseKey = normalizedCourseKey(courseName);
  const matched = courseDeals.find((item) => courseRuleNames(item).includes(courseKey));
  return validDealSize(matched?.dealSize) || DEFAULT_COURSE_DEAL_SIZE;
}

export function normalizeDiscountPercent(value?: number | string) {
  const parsed = Number(value);
  return discountPercentOptions.includes(parsed as (typeof discountPercentOptions)[number])
    ? parsed
    : DEFAULT_DISCOUNT_PERCENT;
}

export function expectedRevenueFrom(dealSize?: number, discountPercent?: number | string) {
  const base = validDealSize(dealSize) || DEFAULT_COURSE_DEAL_SIZE;
  const discount = normalizeDiscountPercent(discountPercent);
  return Math.round(base * (100 - discount) / 100);
}

export function financeDefaultsForLead(
  lead: Partial<Lead>,
  courseDeals?: readonly CourseDealSizeRule[],
  options: FinanceDefaultOptions = {},
) {
  const configuredDealSize = courseDealSize(lead.interestedCourse, courseDeals);
  const existingDealSize = validDealSize(lead.dealSize);
  const dealSize = options.preferExistingDealSize === false
    ? configuredDealSize
    : existingDealSize || configuredDealSize;
  const discountPercent = normalizeDiscountPercent(lead.discountPercent);
  const expectedRevenue = expectedRevenueFrom(dealSize, discountPercent);
  return {
    dealSize,
    discountPercent,
    expectedRevenue,
    dealCurrency: lead.dealCurrency || DEFAULT_DEAL_CURRENCY,
  };
}

export function expectedRevenueAmount(lead: Partial<Lead>, courseDeals?: readonly CourseDealSizeRule[]) {
  const finance = financeDefaultsForLead(lead, courseDeals);
  return Number(lead.expectedRevenue ?? finance.expectedRevenue) || 0;
}

export function revenueAmount(lead: Partial<Lead>, courseDeals?: readonly CourseDealSizeRule[]) {
  return Number(lead.revenue ?? (lead.status === WON_LEAD_STATUS ? expectedRevenueAmount(lead, courseDeals) : 0)) || 0;
}
