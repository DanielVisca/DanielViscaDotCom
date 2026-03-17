'use client';

import { useEffect, useRef } from 'react';
import posthog from 'posthog-js';

const FLUID_INTERACTION_THROTTLE_MS = 5000;

export default function FluidBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastCapturedRef = useRef<number>(0);

  useEffect(() => {
    (window as unknown as { __FLUID_EMBED__?: boolean }).__FLUID_EMBED__ = true;
    const script = document.createElement('script');
    script.src = '/fluid/script.js';
    script.async = false;
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, []);

  useEffect(() => {
    const BURST_INTERVAL_MS = 45000;
    const t = setInterval(() => {
      const trigger = (window as unknown as { __FLUID_TRIGGER_BURST?: () => void }).__FLUID_TRIGGER_BURST;
      if (typeof trigger === 'function') trigger();
    }, BURST_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onPointer = () => {
      const now = Date.now();
      if (now - lastCapturedRef.current >= FLUID_INTERACTION_THROTTLE_MS) {
        lastCapturedRef.current = now;
        try {
          if (typeof posthog !== 'undefined' && posthog.capture) {
            posthog.capture('fluid_interaction');
          }
        } catch (_) {
          // never break fluid interaction for analytics
        }
      }
    };
    el.addEventListener('pointermove', onPointer, { passive: true });
    el.addEventListener('pointerdown', onPointer, { passive: true });
    return () => {
      el.removeEventListener('pointermove', onPointer);
      el.removeEventListener('pointerdown', onPointer);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-0 w-full h-full"
      aria-hidden
    >
      <canvas
        id="fluid-canvas"
        className="block w-full h-full"
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
