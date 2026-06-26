import type { Lead } from '@/types/crm';
import { captureLeadTracking, type PublicLeadTracking } from '@/lib/capiTracking';
import { createMetaEventId, trackMetaEvent } from '@/lib/metaPixel';

type PublicLeadSubmitInput = Partial<Lead> & {
  company?: string;
  website?: string;
  formId?: string;
  pageSlug?: string;
  sourceUrl?: string;
  tracking?: PublicLeadTracking;
  metaContentName?: string;
};

export const publicLeadService = {
  submit: async (lead: PublicLeadSubmitInput, formId = 'consultation-form') => {
    const parentName = String(lead.parentName || '').replace(/\s+/g, ' ').trim();
    const studentName = String(lead.studentName || lead.fullName || '').replace(/\s+/g, ' ').trim();
    if (!parentName || !studentName || !lead.phone) {
      throw new Error('Thiếu họ tên phụ huynh, họ tên bé hoặc số điện thoại.');
    }

    const metaEventId = createMetaEventId();
    const response = await fetch('/api/public-lead-submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...lead,
        fullName: studentName,
        parentName,
        studentName,
        formId,
        meta_event_id: metaEventId,
        sourceUrl: lead.sourceUrl || window.location.href,
        pageSlug: lead.pageSlug || window.location.pathname.replace(/^\/+/, ''),
        tracking: { ...captureLeadTracking(), ...lead.tracking },
      }),
    });
    const payload = await response.json().catch(() => ({})) as {
      leadId?: string;
      error?: string;
      capi?: { eventName?: string; dedupEventId?: string };
    };
    if (!response.ok) throw new Error(payload.error || 'Không gửi được thông tin. Vui lòng thử lại.');
    const eventName = payload.capi?.eventName || 'Lead';
    const eventId = payload.capi?.dedupEventId || metaEventId;
    const eventValue = Number(lead.revenue || lead.expectedRevenue || lead.dealSize || 0);
    trackMetaEvent(eventName, {
      content_name: lead.metaContentName || lead.interestedCourse || formId,
      content_category: eventName === 'Purchase' ? 'english_course' : 'education',
      ...(eventValue > 0 && eventName !== 'Lead' ? { value: eventValue, currency: lead.dealCurrency || 'VND' } : {}),
    }, eventId);
    return {
      id: payload.leadId || `lead-${Date.now()}`,
      ...lead,
      formId,
      metaEventId: eventId,
    };
  },
};
