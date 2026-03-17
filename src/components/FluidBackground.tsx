'use client';

import { useEffect, useRef, useState } from 'react';
import posthog from 'posthog-js';

const FLUID_INTERACTION_THROTTLE_MS = 5000;
const FLUID_HINT_DELAY_MS = 65000;
const FLUID_HINT_DURATION_MS = 2200;
const FLUID_SCROLL_THROTTLE_MS = 120;

export default function FluidBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastCapturedRef = useRef<number>(0);
  const hasInteractedRef = useRef(false);
  const [hint, setHint] = useState<{ x: number; y: number } | null>(null);
  const [remountKey, setRemountKey] = useState(0);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;
      const win = window as unknown as { __FLUID_CONTEXT_LOST__?: boolean };
      if (win.__FLUID_CONTEXT_LOST__) {
        win.__FLUID_CONTEXT_LOST__ = false;
        setRemountKey((k) => k + 1);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    (window as unknown as { __FLUID_EMBED__?: boolean }).__FLUID_EMBED__ = true;
    const script = document.createElement('script');
    script.src = '/fluid/script.js';
    script.async = false;
    document.body.appendChild(script);
    return () => {
      script.remove();
    };
  }, [remountKey]);

  useEffect(() => {
    const BURST_INTERVAL_MS = 45000;
    const t = setInterval(() => {
      const trigger = (window as unknown as { __FLUID_TRIGGER_BURST?: () => void }).__FLUID_TRIGGER_BURST;
      if (typeof trigger === 'function') trigger();
    }, BURST_INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq.matches) return;
    const flush = (deltaY: number) => {
      const scrollSplat = (window as unknown as {
        __FLUID_SCROLL_SPLAT?: (deltaY: number, x?: number, y?: number) => void;
      }).__FLUID_SCROLL_SPLAT;
      if (typeof scrollSplat !== 'function') return;
      const readingBlock = document.getElementById('reading-block');
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (readingBlock && w > 0 && h > 0) {
        const rect = readingBlock.getBoundingClientRect();
        const xCenter = (rect.left + rect.width / 2) / w;
        const xLeft = rect.left / w;
        const xRight = rect.right / w;
        const yCenterFluid = 1 - (rect.top + rect.height / 2) / h;
        const scrollDown = deltaY > 0;
        const yLeading =
          scrollDown
            ? 1 - rect.top / h
            : 1 - (rect.top + rect.height) / h;
        scrollSplat(deltaY, xCenter, yLeading);
        scrollSplat(deltaY, xLeft, yCenterFluid);
        scrollSplat(deltaY, xRight, yCenterFluid);
      } else {
        scrollSplat(deltaY);
      }
    };

    const isCoarse = window.matchMedia('(pointer: coarse)').matches;
    if (isCoarse) {
      let lastFlushTime = 0;
      let lastFlushScrollY = window.scrollY;
      const onScroll = () => {
        const now = Date.now();
        if (now - lastFlushTime >= FLUID_SCROLL_THROTTLE_MS) {
          const scrollY = window.scrollY;
          const deltaY = scrollY - lastFlushScrollY;
          lastFlushScrollY = scrollY;
          lastFlushTime = now;
          if (deltaY !== 0) flush(deltaY);
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      return () => window.removeEventListener('scroll', onScroll);
    }

    let lastFlush = 0;
    let accumulatedDeltaY = 0;
    const onWheel = (e: WheelEvent) => {
      accumulatedDeltaY += e.deltaY;
      const now = Date.now();
      if (now - lastFlush >= FLUID_SCROLL_THROTTLE_MS) {
        lastFlush = now;
        flush(accumulatedDeltaY);
        accumulatedDeltaY = 0;
      }
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onPointer = (e: Event) => {
      if (!e.isTrusted) return;
      hasInteractedRef.current = true;
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

  const hintCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      if (hasInteractedRef.current) return;
      const canvas = document.getElementById('fluid-canvas') as HTMLCanvasElement | null;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      setHint({ x: centerX, y: centerY });

      const dispatch = (type: string, clientX: number, clientY: number, target: EventTarget) => {
        const e = new MouseEvent(type, {
          bubbles: true,
          clientX,
          clientY,
          button: 0,
          buttons: type === 'mouseup' ? 0 : 1,
        });
        target.dispatchEvent(e);
      };

      const dragDeltaX = 60;
      const dragDeltaY = 40;
      dispatch('mousedown', centerX, centerY, canvas);
      const t1 = setTimeout(() => dispatch('mousemove', centerX + dragDeltaX / 2, centerY + dragDeltaY / 2, canvas), 80);
      const t2 = setTimeout(() => dispatch('mousemove', centerX + dragDeltaX, centerY + dragDeltaY, canvas), 200);
      const t3 = setTimeout(() => dispatch('mouseup', centerX + dragDeltaX, centerY + dragDeltaY, window), 320);
      const t4 = setTimeout(() => setHint(null), FLUID_HINT_DURATION_MS);

      hintCleanupRef.current = () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    }, FLUID_HINT_DELAY_MS);
    return () => {
      clearTimeout(t);
      hintCleanupRef.current?.();
      hintCleanupRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-0 w-full h-full"
      aria-hidden
    >
      <canvas
        key={remountKey}
        id="fluid-canvas"
        className="block w-full h-full"
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
      {hint && (
        <>
          <style>{`
            @keyframes fluid-hint-pulse {
              0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.6; }
              50% { transform: translate(-50%, -50%) scale(1.2); opacity: 0.9; }
            }
          `}</style>
          <div
            className="pointer-events-none absolute z-[1] rounded-full bg-white/25"
            style={{
              width: 44,
              height: 44,
              left: hint.x,
              top: hint.y,
              transform: 'translate(-50%, -50%)',
              animation: 'fluid-hint-pulse 0.8s ease-in-out 3',
            }}
            aria-hidden
          />
        </>
      )}
    </div>
  );
}
