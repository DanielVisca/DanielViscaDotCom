'use client';

import { useEffect, useRef } from 'react';
import posthog from 'posthog-js';

const SCROLL_READ_THRESHOLD = 0.9; // 90% of page scrolled into view
const MIN_READ_TIME_MS = 8000; // 8s minimum before we count as "read" (best guess)

export default function PageReadTracker() {
  const sentRef = useRef(false);
  const mountedAtRef = useRef(0);

  useEffect(() => {
    mountedAtRef.current = Date.now();

    const checkRead = () => {
      if (sentRef.current) return;
      const elapsed = Date.now() - mountedAtRef.current;
      if (elapsed < MIN_READ_TIME_MS) return;

      const { scrollY, innerHeight } = window;
      const { scrollHeight } = document.documentElement;
      const scrollDepth = (scrollY + innerHeight) / scrollHeight;
      if (scrollDepth < SCROLL_READ_THRESHOLD) return;

      sentRef.current = true;
      try {
        if (typeof posthog !== 'undefined' && posthog.capture) {
          posthog.capture('page_read', {
            scroll_depth: Math.round(scrollDepth * 100) / 100,
            time_on_page_seconds: Math.round(elapsed / 1000),
          });
        }
      } catch (_) {
        // ignore
      }
    };

    const onScroll = () => {
      window.requestAnimationFrame(checkRead);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    checkRead(); // in case already scrolled (e.g. refresh at bottom)
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return null;
}
