import { DEFAULT_COURSE_DEAL_SIZE, DEFAULT_DEAL_CURRENCY, WON_LEAD_STATUS, courseDealSizeDefaults, discountPercentOptions } from '@/lib/constants';
import type { Lead } from '@/types/crm';

export const DEFAULT_DISCOUNT_PERCENT = discountPercentOptions[0];

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

export function courseDealSize(course?: string) {
  const courseName = canonicalCourseName(course);
  return courseDealSizeDefaults.find((item) => item.courseName === courseName)?.dealSize || DEFAULT_COURSE_DEAL_SIZE;
}

export function normalizeDiscountPercent(value?: number | string) {
  const parsed = Number(value);
  return discountPercentOptions.includes(parsed as (typeof discountPercentOptions)[number])
    ? parsed
    : DEFAULT_DISCOUNT_PERCENT;
}

export function expectedRevenueFrom(dealSize?: number, discountPercent?: number | string) {
  const base = Number(dealSize || DEFAULT_COURSE_DEAL_SIZE);
  const discount = normalizeDiscountPercent(discountPercent);
  return Math.round(base * (100 - discount) / 100);
}

export function financeDefaultsForLead(lead: Partial<Lead>) {
  const dealSize = courseDealSize(lead.interestedCourse);
  const discountPercent = normalizeDiscountPercent(lead.discountPercent);
  const expectedRevenue = expectedRevenueFrom(dealSize, discountPercent);
  return {
    dealSize,
    discountPercent,
    expectedRevenue,
    dealCurrency: lead.dealCurrency || DEFAULT_DEAL_CURRENCY,
  };
}

export function expectedRevenueAmount(lead: Partial<Lead>) {
  const finance = financeDefaultsForLead(lead);
  return Number(lead.expectedRevenue ?? finance.expectedRevenue) || 0;
}

export function revenueAmount(lead: Partial<Lead>) {
  return Number(lead.revenue ?? (lead.status === WON_LEAD_STATUS ? expectedRevenueAmount(lead) : 0)) || 0;
}
