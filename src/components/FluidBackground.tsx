'use client';

import { useEffect, useRef } from 'react';

export default function FluidBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

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

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-0 w-full h-full"
      aria-hidden
    >
      <canvas
        className="block w-full h-full"
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
