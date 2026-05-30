const ANALYTICS_SESSION_KEY = 'zentra_analytics_session_id';

type AnalyticsProperties = Record<string, string | number | boolean | null | undefined>;

const analyticsEnabled = () => import.meta.env.VITE_ANALYTICS_ENABLED === 'true';

const getSessionId = () => {
  try {
    const existing = localStorage.getItem(ANALYTICS_SESSION_KEY);
    if (existing) return existing;
    const next = crypto.randomUUID();
    localStorage.setItem(ANALYTICS_SESSION_KEY, next);
    return next;
  } catch {
    return 'session-unavailable';
  }
};

const cleanProperties = (properties: AnalyticsProperties = {}) =>
  Object.fromEntries(Object.entries(properties)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => [key, value ?? null]));

export function trackEvent(name: string, properties: AnalyticsProperties = {}) {
  if (!analyticsEnabled()) return;

  const payload = JSON.stringify({
    name,
    sessionId: getSessionId(),
    route: window.location.pathname,
    properties: cleanProperties(properties),
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/analytics/events', blob);
      return;
    }
  } catch {
    // Fall through to fetch. Analytics must never break product flows.
  }

  fetch('/api/analytics/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => undefined);
}
