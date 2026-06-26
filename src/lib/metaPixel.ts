type MetaPixelFunction = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  loaded: boolean;
  version: string;
  push: MetaPixelFunction;
};

declare global {
  interface Window {
    fbq?: MetaPixelFunction;
    _fbq?: MetaPixelFunction;
  }
}

let initializedPixelId = '';

const ADMIN_PATH_PREFIXES = ['/crm', '/cms', '/capi', '/marketing'];
const ADMIN_PATHS = new Set(['/login', '/admin', '/dashboard', '/appointments', '/media', '/reports', '/users', '/settings']);

export function isMetaTrackablePath(pathname: string) {
  return !ADMIN_PATHS.has(pathname) && !ADMIN_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function installPixelQueue() {
  if (window.fbq) return window.fbq;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as MetaPixelFunction;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;
  return fbq;
}

export function initMetaPixel(pixelId: string, enabled = true) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return false;
  const normalizedPixelId = String(pixelId || '').trim();
  if (!enabled || !normalizedPixelId) return false;
  if (initializedPixelId === normalizedPixelId) return true;

  const fbq = installPixelQueue();
  if (!document.querySelector('script[data-metta-meta-pixel]')) {
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://connect.facebook.net/en_US/fbevents.js';
    script.dataset.mettaMetaPixel = 'true';
    document.head.appendChild(script);
  }

  fbq('init', normalizedPixelId);
  fbq('track', 'PageView');
  initializedPixelId = normalizedPixelId;
  return true;
}

export function createMetaEventId() {
  const randomId = typeof window !== 'undefined' && window.crypto?.randomUUID
    ? window.crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
  return `metta_${randomId}`;
}

export function trackMetaEvent(
  eventName: string,
  params: Record<string, unknown> = {},
  eventId?: string,
) {
  if (typeof window === 'undefined' || !window.fbq) return false;
  if (eventId) window.fbq('track', eventName, params, { eventID: eventId });
  else window.fbq('track', eventName, params);
  return true;
}
