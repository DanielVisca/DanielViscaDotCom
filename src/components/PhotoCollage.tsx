'use client';

import Image from 'next/image';
import { useState, useEffect, useCallback, useRef } from 'react';
import posthog from 'posthog-js';

export type PhotoItem = { src: string; alt: string; caption: string };

const COLLAGE_SIZE = 128;
const LIGHTBOX_SIZE = 640;

export default function PhotoCollage({ items }: { items: PhotoItem[] }) {
  const [reducedMotion, setReducedMotion] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lightboxContentRef = useRef<HTMLDivElement>(null);

  const lightbox = lightboxIndex !== null ? items[lightboxIndex] : null;

  useEffect(() => {
    if (lightboxIndex !== null) {
      closeRef.current?.focus({ preventScroll: true });
      const behavior = reducedMotion ? ('auto' as const) : ('smooth' as const);
      window.scrollTo({ top: 0, left: 0, behavior });
    }
  }, [lightboxIndex, reducedMotion]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const goPrev = useCallback(() => {
    posthog.capture('lightbox_navigated', { direction: 'prev' });
    setLightboxIndex((i) => (i === null ? null : i === 0 ? items.length - 1 : i - 1));
  }, [items.length]);
  const goNext = useCallback(() => {
    posthog.capture('lightbox_navigated', { direction: 'next' });
    setLightboxIndex((i) => (i === null ? null : i === items.length - 1 ? 0 : i + 1));
  }, [items.length]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (lightboxIndex === null) return;
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
    },
    [lightboxIndex, goPrev, goNext]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      <div
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-8"
        role="list"
        aria-label="Photo collage"
      >
        {items.map((item) => (
          <button
            key={item.src}
            type="button"
            onClick={() => {
              posthog.capture('lightbox_opened', { caption: item.caption });
              setLightboxIndex(items.findIndex((i) => i.src === item.src));
            }}
            className="relative block w-full aspect-square max-w-[140px] mx-auto rounded-xl border border-white/20 overflow-hidden shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black opacity-90 hover:opacity-100 hover:border-cyan-400/50 hover:shadow-cyan-500/20 transition-all duration-200 focus:not-sr-only"
            style={{
              transitionDuration: reducedMotion ? '0s' : '200ms',
              transform: reducedMotion ? undefined : 'translateZ(0)',
            }}
            onMouseEnter={(e) => {
              if (reducedMotion) return;
              e.currentTarget.style.transform = 'scale(1.05) translateZ(0)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1) translateZ(0)';
            }}
            aria-label={`View ${item.caption}`}
          >
            <Image
              src={item.src}
              alt={item.alt}
              width={COLLAGE_SIZE}
              height={COLLAGE_SIZE}
              className="w-full h-full object-cover"
              sizes="(max-width: 640px) 50vw, 140px"
            />
          </button>
        ))}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/90 pt-12 pb-12 px-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Image: ${lightbox.caption}`}
          onClick={() => setLightboxIndex(null)}
        >
          <button
            ref={closeRef}
            type="button"
            className="absolute top-4 right-4 z-10 text-white/80 hover:text-white text-2xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded"
            onClick={() => setLightboxIndex(null)}
            aria-label="Close"
          >
            &times;
          </button>
          <button
            type="button"
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center text-white/80 hover:text-white text-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded"
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            aria-label="Previous image"
          >
            &#8592;
          </button>
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 flex items-center justify-center text-white/80 hover:text-white text-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 rounded"
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            aria-label="Next image"
          >
            &#8594;
          </button>
          <div
            ref={lightboxContentRef}
            className="relative max-w-full max-h-[75vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={lightbox.src}
              alt={lightbox.alt}
              width={LIGHTBOX_SIZE}
              height={LIGHTBOX_SIZE}
              className="max-w-full max-h-[70vh] w-auto h-auto object-contain rounded-lg"
              sizes="100vw"
            />
            <p className="mt-3 text-sm text-white/80 text-center">{lightbox.caption}</p>
          </div>
        </div>
      )}
    </>
  );
}
