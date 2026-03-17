'use client';

import { useEffect, useRef, useState } from 'react';

const LERP = 0.08;
const RUN_AWAY_RADIUS = 120;
const RUN_AWAY_STRENGTH = 0.5;

const DEBUG_LOG = (payload: Record<string, unknown>) => {
  // #region agent log
  fetch('http://127.0.0.1:7289/ingest/21c7021f-8459-4d84-8d35-ae3faff04b86', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '917595' },
    body: JSON.stringify({
      sessionId: '917595',
      location: 'CursorQuirks.tsx',
      message: payload.message as string,
      data: payload.data as Record<string, unknown>,
      timestamp: Date.now(),
      hypothesisId: payload.hypothesisId as string,
    }),
  }).catch(() => {});
  // #endregion
};

export default function CursorQuirks() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [follow, setFollow] = useState({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);
  const followRef = useRef({ x: 0, y: 0 });
  const moveLogCountRef = useRef(0);
  const renderLogRef = useRef(0);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      // #region agent log
      if (moveLogCountRef.current < 5) {
        moveLogCountRef.current += 1;
        DEBUG_LOG({
          message: 'mousemove received',
          data: { clientX: e.clientX, clientY: e.clientY, count: moveLogCountRef.current },
          hypothesisId: 'H1',
        });
      }
      // #endregion
      setMouse({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMove);
    return () => window.removeEventListener('mousemove', handleMove);
  }, []);

  useEffect(() => {
    if (reducedMotion) return;
    let raf = 0;
    const tick = () => {
      followRef.current.x += (mouse.x - followRef.current.x) * LERP;
      followRef.current.y += (mouse.y - followRef.current.y) * LERP;
      setFollow({ x: followRef.current.x, y: followRef.current.y });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [mouse.x, mouse.y, reducedMotion]);

  if (reducedMotion) {
    // #region agent log
    if (renderLogRef.current < 3) {
      renderLogRef.current += 1;
      DEBUG_LOG({
        message: 'CursorQuirks return null (reducedMotion)',
        data: { reducedMotion, mouseX: mouse.x, mouseY: mouse.y },
        hypothesisId: 'H2_H3',
      });
    }
    // #endregion
    return null;
  }

  // #region agent log
  if (renderLogRef.current < 10) {
    renderLogRef.current += 1;
    DEBUG_LOG({
      message: 'CursorQuirks rendering fragment',
      data: { reducedMotion, mouseX: mouse.x, mouseY: mouse.y, followX: follow.x, followY: follow.y },
      hypothesisId: 'H2_H5',
    });
  }
  // #endregion

  return (
    <>
      <FollowDots x={follow.x} y={follow.y} />
      <RunAwayElements mouseX={mouse.x} mouseY={mouse.y} />
    </>
  );
}

function FollowDots({ x, y }: { x: number; y: number }) {
  // #region agent log
  const followLogRef = useRef(0);
  if (followLogRef.current < 5 && (x !== 0 || y !== 0)) {
    followLogRef.current += 1;
    DEBUG_LOG({ message: 'FollowDots received non-zero', data: { x, y }, hypothesisId: 'H5' });
  }
  // #endregion
  return (
    <div className="pointer-events-none fixed inset-0 z-10" aria-hidden>
      <div
        className="absolute w-3 h-3 rounded-full bg-cyan-400/60 blur-sm"
        style={{ left: 0, top: 0, transform: `translate(${x}px,${y}px) translate(-50%,-50%)` }}
      />
      <div
        className="absolute w-2 h-2 rounded-full bg-cyan-300/80"
        style={{
          left: 0,
          top: 0,
          transform: `translate(${x + 12}px,${y + 8}px) translate(-50%,-50%)`,
        }}
      />
    </div>
  );
}

function RunAwayElements({ mouseX, mouseY }: { mouseX: number; mouseY: number }) {
  const positions = [
    { id: 1, baseX: 0.15, baseY: 0.2 },
    { id: 2, baseX: 0.85, baseY: 0.25 },
    { id: 3, baseX: 0.1, baseY: 0.7 },
    { id: 4, baseX: 0.9, baseY: 0.75 },
  ];
  return (
    <div className="pointer-events-none fixed inset-0 z-10" aria-hidden>
      {positions.map(({ id, baseX, baseY }) => (
        <RunAwayDot
          key={id}
          baseX={baseX}
          baseY={baseY}
          mouseX={mouseX}
          mouseY={mouseY}
        />
      ))}
    </div>
  );
}

function RunAwayDot({
  baseX,
  baseY,
  mouseX,
  mouseY,
}: {
  baseX: number;
  baseY: number;
  mouseX: number;
  mouseY: number;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const baseXpx = window.innerWidth * baseX;
    const baseYpx = window.innerHeight * baseY;
    const dx = mouseX - baseXpx;
    const dy = mouseY - baseYpx;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < RUN_AWAY_RADIUS && dist > 0) {
      const push = ((RUN_AWAY_RADIUS - dist) / RUN_AWAY_RADIUS) * RUN_AWAY_STRENGTH;
      const nx = dx / dist;
      const ny = dy / dist;
      setOffset((prev) => ({
        x: prev.x * 0.7 + nx * push * 40,
        y: prev.y * 0.7 + ny * push * 40,
      }));
    } else {
      setOffset((prev) => ({ x: prev.x * 0.9, y: prev.y * 0.9 }));
    }
  }, [baseX, baseY, mouseX, mouseY]);

  return (
    <div
      className="absolute w-2 h-2 rounded-full bg-amber-400/50"
      style={{
        left: `${baseX * 100}%`,
        top: `${baseY * 100}%`,
        transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
      }}
    />
  );
}
