export type PublicLeadTracking = {
  sourceUrl?: string;
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  utmSource?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  userAgent?: string;
  capturedAt?: string;
};

function cookieValue(name: string) {
  if (typeof document === 'undefined') return '';
  const match = document.cookie
    .split(';')
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : '';
}

export function captureLeadTracking(): PublicLeadTracking {
  if (typeof window === 'undefined') return {};
  const params = new URLSearchParams(window.location.search);
  return {
    sourceUrl: window.location.href,
    fbp: cookieValue('_fbp') || undefined,
    fbc: cookieValue('_fbc') || undefined,
    fbclid: params.get('fbclid') || undefined,
    utmSource: params.get('utm_source') || undefined,
    utmCampaign: params.get('utm_campaign') || undefined,
    utmContent: params.get('utm_content') || undefined,
    utmTerm: params.get('utm_term') || undefined,
    userAgent: navigator.userAgent,
    capturedAt: new Date().toISOString(),
  };
}
