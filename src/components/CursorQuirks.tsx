'use client';

import { useEffect, useRef, useState } from 'react';

const LERP = 0.08;
const RUN_AWAY_RADIUS = 120;
const RUN_AWAY_STRENGTH = 0.5;

const PEEKER_HEAD_SIZE = 80;
const PEEK_VISIBLE = 28;
const PEEKER_LERP = 0.08;
const PUPIL_MAX_OFFSET = 4;
const CURSOR_CLOSE_RADIUS = 80;

export default function CursorQuirks() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [follow, setFollow] = useState({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);
  const followRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
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

  if (reducedMotion) return null;

  return (
    <>
      <FollowDots x={follow.x} y={follow.y} />
      <RunAwayElements mouseX={mouse.x} mouseY={mouse.y} />
      <Peeker mouseX={mouse.x} mouseY={mouse.y} />
    </>
  );
}

function FollowDots({ x, y }: { x: number; y: number }) {
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

function Peeker({ mouseX, mouseY }: { mouseX: number; mouseY: number }) {
  const [pupils, setPupils] = useState({ left: { x: 0, y: 0 }, right: { x: 0, y: 0 } });
  const pupilsRef = useRef({ left: { x: 0, y: 0 }, right: { x: 0, y: 0 } });
  const [windowSize, setWindowSize] = useState({ w: 0, h: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const updateSize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    if (windowSize.w === 0 || windowSize.h === 0) return;
    const headLeft = windowSize.w / 2 - PEEKER_HEAD_SIZE / 2;
    const headTop = windowSize.h - PEEK_VISIBLE;
    const leftEyeX = headLeft + 14 + 10;
    const leftEyeY = headTop + 14 + 10;
    const rightEyeX = headLeft + 14 + 20 + 24 + 10;
    const rightEyeY = headTop + 14 + 10;

    const tick = () => {
      const clamp = (dx: number, dy: number) => {
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const scale = Math.min(1, PUPIL_MAX_OFFSET / dist);
        return { x: dx * scale, y: dy * scale };
      };
      const leftTarget = clamp(mouseX - leftEyeX, mouseY - leftEyeY);
      const rightTarget = clamp(mouseX - rightEyeX, mouseY - rightEyeY);

      const l = pupilsRef.current.left;
      const r = pupilsRef.current.right;
      l.x += (leftTarget.x - l.x) * PEEKER_LERP;
      l.y += (leftTarget.y - l.y) * PEEKER_LERP;
      r.x += (rightTarget.x - r.x) * PEEKER_LERP;
      r.y += (rightTarget.y - r.y) * PEEKER_LERP;
      setPupils({ left: { ...l }, right: { ...r } });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mouseX, mouseY, windowSize.w, windowSize.h]);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const t = setInterval(() => {
      setIsBlinking(true);
      timeoutId = setTimeout(() => setIsBlinking(false), 150);
    }, 4000);
    return () => {
      clearInterval(t);
      clearTimeout(timeoutId);
    };
  }, []);

  const headCenterY = windowSize.h - PEEK_VISIBLE / 2;
  const distToHead = Math.hypot(mouseX - windowSize.w / 2, mouseY - headCenterY);
  const cursorClose = distToHead < CURSOR_CLOSE_RADIUS;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex justify-center items-end" aria-hidden>
      <style>{`
        @keyframes peekBounce {
          0% { transform: translate(-50%, 100%); }
          70% { transform: translate(-50%, calc(52px - 6px)); }
          100% { transform: translate(-50%, 52px); }
        }
        @keyframes peekBob {
          0%, 100% { transform: translate(-50%, 52px); }
          50% { transform: translate(-50%, 48px); }
        }
        .peeker-head {
          animation: peekBounce 0.5s ease-out forwards, peekBob 3s ease-in-out 0.6s infinite;
        }
      `}</style>
      <div
        className="peeker-head absolute rounded-full border border-white/10 bg-black/80 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
        style={{
          width: PEEKER_HEAD_SIZE,
          height: PEEKER_HEAD_SIZE,
          left: '50%',
          bottom: 0,
        }}
      >
        <div className="absolute flex gap-6" style={{ left: 14, top: 14 }}>
          <div
            className="relative rounded-full bg-white/20 flex items-center justify-center overflow-visible transition-transform duration-75"
            style={{
              width: 20,
              height: 20,
              transform: cursorClose ? 'scale(1.1)' : 'scale(1)',
              boxShadow: '0 0 12px rgba(34,211,238,0.4)',
            }}
          >
            <div
              className="absolute rounded-full bg-cyan-400 transition-transform duration-75"
              style={{
                width: 10,
                height: 10,
                left: '50%',
                top: '50%',
                transform: isBlinking
                  ? 'translate(-50%,-50%) scaleY(0.1)'
                  : `translate(calc(-50% + ${pupils.left.x}px), calc(-50% + ${pupils.left.y}px))`,
              }}
            />
          </div>
          <div
            className="relative rounded-full bg-white/20 flex items-center justify-center overflow-visible transition-transform duration-75"
            style={{
              width: 20,
              height: 20,
              transform: cursorClose ? 'scale(1.1)' : 'scale(1)',
              boxShadow: '0 0 12px rgba(34,211,238,0.4)',
            }}
          >
            <div
              className="absolute rounded-full bg-cyan-400 transition-transform duration-75"
              style={{
                width: 10,
                height: 10,
                left: '50%',
                top: '50%',
                transform: isBlinking
                  ? 'translate(-50%,-50%) scaleY(0.1)'
                  : `translate(calc(-50% + ${pupils.right.x}px), calc(-50% + ${pupils.right.y}px))`,
              }}
            />
          </div>
        </div>
      </div>
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
