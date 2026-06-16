import type { Lead } from '@/types/crm';

type PublicLeadSubmitInput = Partial<Lead> & {
  company?: string;
  website?: string;
  formId?: string;
  pageSlug?: string;
  sourceUrl?: string;
};

export const publicLeadService = {
  submit: async (lead: PublicLeadSubmitInput, formId = 'consultation-form') => {
    const parentName = String(lead.parentName || '').replace(/\s+/g, ' ').trim();
    const studentName = String(lead.studentName || lead.fullName || '').replace(/\s+/g, ' ').trim();
    if (!parentName || !studentName || !lead.phone) {
      throw new Error('Thiếu họ tên phụ huynh, họ tên bé hoặc số điện thoại.');
    }

    const response = await fetch('/api/public-lead-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...lead,
        fullName: studentName,
        parentName,
        studentName,
        formId,
        sourceUrl: lead.sourceUrl || window.location.href,
        pageSlug: lead.pageSlug || window.location.pathname.replace(/^\/+/, ''),
      }),
    });
    const payload = await response.json().catch(() => ({})) as { leadId?: string; error?: string };
    if (!response.ok) throw new Error(payload.error || 'Không gửi được thông tin. Vui lòng thử lại.');
    return {
      id: payload.leadId || `lead-${Date.now()}`,
      ...lead,
      formId,
    };
  },
};
