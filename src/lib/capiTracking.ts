export type PublicLeadTracking = {
  sourceUrl?: string;
  fbp?: string;
  fbc?: string;
  fbclid?: string;
  utmSource?: string;
  utmMedium?: string;
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
  const capturedAt = new Date().toISOString();
  const fbclid = params.get('fbclid') || undefined;
  const fbc = cookieValue('_fbc') || (fbclid ? `fb.1.${Date.parse(capturedAt)}.${fbclid}` : undefined);
  return {
    sourceUrl: window.location.href,
    fbp: cookieValue('_fbp') || undefined,
    fbc,
    fbclid,
    utmSource: params.get('utm_source') || undefined,
    utmMedium: params.get('utm_medium') || undefined,
    utmCampaign: params.get('utm_campaign') || undefined,
    utmContent: params.get('utm_content') || undefined,
    utmTerm: params.get('utm_term') || undefined,
    userAgent: navigator.userAgent,
    capturedAt,
  };
}
