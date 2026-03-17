import posthog from 'posthog-js';

if (typeof window !== 'undefined') {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (key && host) {
    posthog.init(key, {
      api_host: host,
      defaults: '2026-01-30',
    });
  }
}
