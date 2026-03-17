'use client';

import posthog from 'posthog-js';
import { useEffect, useRef, useState } from 'react';

const LERP = 0.08;
const RUN_AWAY_RADIUS = 120;
const RUN_AWAY_STRENGTH = 0.5;

const PEEKER_HEAD_SIZE = 80;
const PEEK_VISIBLE = 28;
const PEEKER_LERP = 0.08;
const PUPIL_MAX_OFFSET = 4;
const CURSOR_CLOSE_RADIUS = 80;

type PeekerPhase =
  | 'peeking'
  | 'pulling_up'
  | 'standing'
  | 'standing_with_bubble'
  | 'running_off'
  | 'off_screen'
  | 'hop_on_bike'
  | 'biking_to_volcano'
  | 'dismounting'
  | 'climbing'
  | 'cheering'
  | 'climbing_down'
  | 'remounting'
  | 'biking_off';
const PULL_UP_DURATION_MS = 800;
const STANDING_BEFORE_RUN_MS = 500;
const RUN_SPEED = 6;
const CHARACTER_WIDTH = 80;
const OFF_SCREEN_DELAY_MS = 30000;
const PEEKER_INITIAL_DELAY_MS = 25000;
const LONG_VISIT_MS = 45 * 60 * 1000;
const ADVENTURE_CHANCE = 0.2;
const HOP_ON_BIKE_DURATION_MS = 2000;
const ADVENTURE_BIKE_PATH_DURATION_MS = 10000;
const VOLCANO_TARGET_RATIO = 0.65;
const BIKE_PARK_OFFSET_RATIO = 0.08;
const CLIMB_DURATION_MS = 6000;
const CHEER_DURATION_MS = 3000;
const CLIMB_DOWN_DURATION_MS = 4000;
const DISMOUNT_DURATION_MS = 2200;
const DISMOUNT_GET_OFF_MS = 500;
const DISMOUNT_STEP_DOWN_MS = 350;
const DISMOUNT_WALK_START_MS = DISMOUNT_GET_OFF_MS + DISMOUNT_STEP_DOWN_MS;
const REMOUNT_DURATION_MS = 1500;
const ADVENTURE_BIKE_OFF_DURATION_MS = 5000;
const ADVENTURE_BIKE_WIDTH = 200;
const CRANK_RATIO = 0.3;

// Bicycle joints traced from reference image proportions.
// Wheels are large (r=18). BB sits above axle line. Head tube is short.
// Fork drops nearly straight down from HB to FD.
const WHEEL_R = 18;
const AXLE_Y = 62;              // wheel centers
const RD = { x: 24, y: AXLE_Y };   // rear axle
const FD = { x: 118, y: AXLE_Y };  // front axle
const BB = { x: 56, y: 54 };       // bottom bracket (above axle line, between wheels)
const SC = { x: 48, y: 20 };       // seat cluster (top of seat tube)
const HT = { x: 96, y: 16 };       // head tube top
const HB = { x: 92, y: 38 };       // head tube bottom / fork crown

export default function CursorQuirks() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const [follow, setFollow] = useState({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [hasHover, setHasHover] = useState(false); // only show follow-dots after we confirm hover (avoids trail on touch)
  const [peekerUnlocked, setPeekerUnlocked] = useState(false);
  const followRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const t = setTimeout(() => setPeekerUnlocked(true), PEEKER_INITIAL_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(hover: hover)');
    setHasHover(mq.matches);
    const handler = () => setHasHover(mq.matches);
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
      {hasHover && <FollowDots x={follow.x} y={follow.y} />}
      <RunAwayElements mouseX={mouse.x} mouseY={mouse.y} />
      {peekerUnlocked && <Peeker mouseX={mouse.x} mouseY={mouse.y} />}
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
  const [phase, setPhase] = useState<PeekerPhase>('peeking');
  const [characterX, setCharacterX] = useState(0);
  const runDirectionRef = useRef(1);
  const [pupils, setPupils] = useState({ left: { x: 0, y: 0 }, right: { x: 0, y: 0 } });
  const pupilsRef = useRef({ left: { x: 0, y: 0 }, right: { x: 0, y: 0 } });
  const [windowSize, setWindowSize] = useState({ w: 0, h: 0 });
  const [isBlinking, setIsBlinking] = useState(false);
  const rafRef = useRef<number>(0);
  const mountTimeRef = useRef(Date.now());
  const longVisitStandupRef = useRef(false);
  const startAdventureAfterPullUpRef = useRef(false);
  const [characterY, setCharacterY] = useState(0);
  const climbProgressRef = useRef(0);
  const adventureBikeDirectionRef = useRef(1);
  const adventureBikeStartTimeRef = useRef(0);
  const adventureBikeOffStartXRef = useRef(0);
  const adventureBikeOffStartTimeRef = useRef(0);
  const [bikeWheelRotation, setBikeWheelRotation] = useState(0);
  const bikePrevXRef = useRef(0);
  const BIKE_WHEEL_RADIUS_PX = WHEEL_R;
  const BIKE_DEG_PER_PX = 360 / (2 * Math.PI * BIKE_WHEEL_RADIUS_PX);
  const [volcanoScale, setVolcanoScale] = useState(0);
  const [bikeParkedX, setBikeParkedX] = useState(0);
  const [climbProgress, setClimbProgress] = useState(0);
  const [dismountWalkProgress, setDismountWalkProgress] = useState(0);
  const [dismountElapsedMs, setDismountElapsedMs] = useState(0);

  useEffect(() => {
    const updateSize = () => setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  useEffect(() => {
    const triggerLongVisitStandup = () => {
      if (phase !== 'peeking' || longVisitStandupRef.current) return;
      longVisitStandupRef.current = true;
      setCharacterX(0);
      setPhase('pulling_up');
    };

    const interval = setInterval(() => {
      if (Date.now() - mountTimeRef.current >= LONG_VISIT_MS) {
        triggerLongVisitStandup();
      }
    }, 60000);
    return () => clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        if (phase !== 'peeking' || longVisitStandupRef.current) return;
        longVisitStandupRef.current = true;
        setCharacterX(0);
        setPhase('pulling_up');
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (phase === 'peeking') {
          if (longVisitStandupRef.current) return;
          longVisitStandupRef.current = true;
          startAdventureAfterPullUpRef.current = true;
          setCharacterX(0);
          setPhase('pulling_up');
        } else if (phase === 'standing' || phase === 'standing_with_bubble') {
          setPhase('hop_on_bike');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase]);

  const headCenterX = windowSize.w / 2 + characterX;
  const baseStandingY = windowSize.h - 44;
  const isAdventureClimb = phase === 'climbing' || phase === 'cheering' || phase === 'climbing_down';
  const headCenterY =
    phase === 'peeking'
      ? windowSize.h - PEEK_VISIBLE / 2
      :     isAdventureClimb
        ? windowSize.h - climbProgress * Math.max(240, windowSize.h * 0.58) * 0.97 - 44
        : baseStandingY;
  const headLeft = headCenterX - PEEKER_HEAD_SIZE / 2;
  const headTop = headCenterY - PEEKER_HEAD_SIZE / 2;
  const leftEyeX = headLeft + 14 + 10;
  const leftEyeY = headTop + 14 + 10;
  const rightEyeX = headLeft + 14 + 20 + 24 + 10;
  const rightEyeY = headTop + 14 + 10;

  useEffect(() => {
    if (windowSize.w === 0 || windowSize.h === 0) return;
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
  }, [mouseX, mouseY, windowSize.w, windowSize.h, characterX, phase]);

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

  useEffect(() => {
    if (phase !== 'pulling_up') return;
    const t = setTimeout(() => {
      if (startAdventureAfterPullUpRef.current) {
        startAdventureAfterPullUpRef.current = false;
        setPhase('hop_on_bike');
        return;
      }
      if (longVisitStandupRef.current) {
        if (typeof posthog !== 'undefined' && posthog.capture) {
          posthog.capture('long_visit_standup_seen');
        }
        setPhase('standing_with_bubble');
      } else {
        setPhase('standing');
      }
    }, PULL_UP_DURATION_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'standing') return;
    const t = setTimeout(() => {
      runDirectionRef.current = mouseX < windowSize.w / 2 ? 1 : -1;
      setPhase('running_off');
    }, STANDING_BEFORE_RUN_MS);
    return () => clearTimeout(t);
  }, [phase, mouseX, windowSize.w]);

  useEffect(() => {
    if (phase !== 'off_screen') return;
    const t = setTimeout(() => {
      setCharacterX(0);
      setPhase('peeking');
    }, OFF_SCREEN_DELAY_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'running_off' || windowSize.w === 0) return;
    let raf = 0;
    const halfW = windowSize.w / 2 + CHARACTER_WIDTH;
    const tick = () => {
      setCharacterX((prev) => {
        const next = prev + RUN_SPEED * runDirectionRef.current;
        if (runDirectionRef.current > 0 && next > halfW) {
          queueMicrotask(() => setPhase('off_screen'));
          return 0;
        }
        if (runDirectionRef.current < 0 && next < -halfW) {
          queueMicrotask(() => setPhase('off_screen'));
          return 0;
        }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, windowSize.w]);

  // Adventure: hop_on_bike -> after delay -> biking_to_volcano
  useEffect(() => {
    if (phase !== 'hop_on_bike') return;
    const w = windowSize.w || (typeof window !== 'undefined' ? window.innerWidth : 0);
    setCharacterX(-0.35 * w);
    setCharacterY(0);
    setBikeWheelRotation(0);
    setVolcanoScale(0);
    setClimbProgress(0);
    climbProgressRef.current = 0;
    adventureBikeDirectionRef.current = 1;
    const t = setTimeout(() => {
      adventureBikeStartTimeRef.current = Date.now();
      bikePrevXRef.current = -0.35 * w;
      setPhase('biking_to_volcano');
    }, HOP_ON_BIKE_DURATION_MS);
    return () => clearTimeout(t);
  }, [phase, windowSize.w]);

  // Adventure: biking_to_volcano -> path + forced perspective volcano -> dismounting
  useEffect(() => {
    if (phase !== 'biking_to_volcano' || windowSize.w === 0 || windowSize.h === 0) return;
    const startX = -0.35 * windowSize.w;
    const endX = (VOLCANO_TARGET_RATIO - 0.5 - BIKE_PARK_OFFSET_RATIO) * windowSize.w;
    const h = windowSize.h;
    bikePrevXRef.current = startX;
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - adventureBikeStartTimeRef.current;
      const progress = Math.min(1, elapsed / ADVENTURE_BIKE_PATH_DURATION_MS);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const x = startX + (endX - startX) * eased;
      const rise = 0.10 * h;
      const y = -rise * Math.sin(progress * Math.PI);
      const deltaX = x - bikePrevXRef.current;
      bikePrevXRef.current = x;
      setCharacterX(x);
      setCharacterY(y);
      setBikeWheelRotation((prev) => prev + deltaX * BIKE_DEG_PER_PX);
      setVolcanoScale(0.15 + 0.85 * eased);
      if (progress >= 1) {
        setCharacterY(0);
        setVolcanoScale(1);
        queueMicrotask(() => setPhase('dismounting'));
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, windowSize.w, windowSize.h]);

  // Adventure: dismounting -> get off (on bike), step down beside bike, walk to volcano, then climb
  const dismountStartXRef = useRef(0);
  useEffect(() => {
    if (phase !== 'dismounting' || windowSize.w === 0) return;
    dismountStartXRef.current = characterX;
    setBikeParkedX(characterX);
    setClimbProgress(0);
    setDismountWalkProgress(0);
    setDismountElapsedMs(0);
    climbProgressRef.current = 0;
    const start = Date.now();
    const volcanoCenterPx = (VOLCANO_TARGET_RATIO - 0.5) * windowSize.w;
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - start;
      setDismountElapsedMs(elapsed);
      if (elapsed >= DISMOUNT_DURATION_MS) {
        setDismountWalkProgress(1);
        setCharacterX(volcanoCenterPx);
        queueMicrotask(() => setPhase('climbing'));
        return;
      }
      const walkDurMs = DISMOUNT_DURATION_MS - DISMOUNT_WALK_START_MS;
      const raw = elapsed <= DISMOUNT_WALK_START_MS ? 0 : Math.min(1, (elapsed - DISMOUNT_WALK_START_MS) / walkDurMs);
      const eased = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
      setDismountWalkProgress(eased);
      if (elapsed >= DISMOUNT_WALK_START_MS) {
        setCharacterX(dismountStartXRef.current + (volcanoCenterPx - dismountStartXRef.current) * eased);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, windowSize.w]);

  // Adventure: climbing -> progress 0..1 over CLIMB_DURATION_MS -> cheering
  useEffect(() => {
    if (phase !== 'climbing' || windowSize.h === 0) return;
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / CLIMB_DURATION_MS);
      climbProgressRef.current = progress;
      setClimbProgress(progress);
      if (progress >= 1) {
        queueMicrotask(() => setPhase('cheering'));
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, windowSize.h]);

  // Adventure: cheering -> after CHEER_DURATION_MS -> climbing_down
  useEffect(() => {
    if (phase !== 'cheering') return;
    setClimbProgress(1);
    const t = setTimeout(() => setPhase('climbing_down'), CHEER_DURATION_MS);
    return () => clearTimeout(t);
  }, [phase]);

  // Adventure: climbing_down -> progress 1..0 over CLIMB_DOWN_DURATION_MS -> remounting
  useEffect(() => {
    if (phase !== 'climbing_down' || windowSize.h === 0) return;
    const start = Date.now();
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.max(0, 1 - elapsed / CLIMB_DOWN_DURATION_MS);
      climbProgressRef.current = progress;
      setClimbProgress(progress);
      if (progress <= 0) {
        queueMicrotask(() => setPhase('remounting'));
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, windowSize.h]);

  // Adventure: remounting -> get back on bike -> biking_off
  useEffect(() => {
    if (phase !== 'remounting') return;
    setCharacterX(bikeParkedX);
    setClimbProgress(0);
    const t = setTimeout(() => {
      adventureBikeOffStartXRef.current = bikeParkedX;
      adventureBikeOffStartTimeRef.current = Date.now();
      setPhase('biking_off');
    }, REMOUNT_DURATION_MS);
    return () => clearTimeout(t);
  }, [phase, bikeParkedX]);

  // Adventure: biking_off -> time-based to off right edge -> off_screen
  useEffect(() => {
    if (phase !== 'biking_off' || windowSize.w === 0) return;
    const halfW = windowSize.w / 2 + ADVENTURE_BIKE_WIDTH;
    const startX = adventureBikeOffStartXRef.current;
    bikePrevXRef.current = startX;
    let raf = 0;
    const tick = () => {
      const elapsed = Date.now() - adventureBikeOffStartTimeRef.current;
      const progress = Math.min(1, elapsed / ADVENTURE_BIKE_OFF_DURATION_MS);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const x = startX + (halfW - startX) * eased;
      const deltaX = x - bikePrevXRef.current;
      bikePrevXRef.current = x;
      setCharacterX(x);
      setBikeWheelRotation((prev) => prev + deltaX * BIKE_DEG_PER_PX);
      setVolcanoScale(1 - eased);
      if (progress >= 1) {
        setVolcanoScale(0);
        queueMicrotask(() => setPhase('off_screen'));
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, windowSize.w]);

  const distToHead = Math.hypot(mouseX - headCenterX, mouseY - headCenterY);
  const cursorClose = distToHead < CURSOR_CLOSE_RADIUS;

  const handlePeekerClick = () => {
    if (phase === 'peeking') {
      if (typeof posthog !== 'undefined' && posthog.capture) {
        posthog.capture('peeker_clicked');
      }
      startAdventureAfterPullUpRef.current = Math.random() < ADVENTURE_CHANCE;
      setCharacterX(0);
      setPhase('pulling_up');
    }
    if (phase === 'standing_with_bubble') {
      if (Math.random() < ADVENTURE_CHANCE) {
        setPhase('hop_on_bike');
      } else {
        setPhase('running_off');
      }
    }
  };

  const sharedEyeProps = {
    isBlinking,
    pupils,
    cursorClose,
  };

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
        @keyframes pullUpArmLeft {
          0% { transform: rotate(0deg); opacity: 0; }
          15% { transform: rotate(-55deg); opacity: 1; }
          100% { transform: rotate(-55deg); opacity: 1; }
        }
        @keyframes pullUpArmRight {
          0% { transform: rotate(0deg); opacity: 0; }
          15% { transform: rotate(55deg); opacity: 1; }
          100% { transform: rotate(55deg); opacity: 1; }
        }
        @keyframes pullUpBody {
          0% { height: 0; opacity: 0; transform: translateY(20px); }
          50% { height: 44px; opacity: 1; transform: translateY(-4px); }
          100% { height: 44px; opacity: 1; transform: translateY(0); }
        }
        @keyframes standWobble {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-2px) rotate(1deg); }
          75% { transform: translateY(-2px) rotate(-1deg); }
        }
        @keyframes runLegLeft {
          0%, 100% { transform: translateY(0) rotate(-8deg); }
          50% { transform: translateY(-6px) rotate(8deg); }
        }
        @keyframes runLegRight {
          0%, 100% { transform: translateY(-6px) rotate(8deg); }
          50% { transform: translateY(0) rotate(-8deg); }
        }
        @keyframes runArmPump {
          0%, 100% { transform: rotate(-12deg); }
          50% { transform: rotate(12deg); }
        }
        .peeker-head {
          animation: peekBounce 0.5s ease-out forwards, peekBob 3s ease-in-out 0.6s infinite;
        }
        .peeker-pull-up-arm-left { animation: pullUpArmLeft 0.35s ease-out forwards; }
        .peeker-pull-up-arm-right { animation: pullUpArmRight 0.35s ease-out forwards; }
        .peeker-pull-up-body {
          animation: pullUpBody 0.6s cubic-bezier(0.34, 1.2, 0.64, 1) 0.15s forwards;
        }
        .peeker-stand-wobble {
          animation: standWobble 0.4s ease-in-out;
        }
        .peeker-stand-wobble-idle {
          animation: standWobble 2s ease-in-out infinite;
        }
        .peeker-run-leg-left { animation: runLegLeft 0.15s ease-in-out infinite; }
        .peeker-run-leg-right { animation: runLegRight 0.15s ease-in-out infinite; }
        .peeker-run-arm { animation: runArmPump 0.2s ease-in-out infinite; }
        @keyframes bikeBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-2px); }
        }
        @keyframes passengerLegSwing {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(5deg); }
        }
        @keyframes climbArmLeftReach {
          0% { transform: rotate(-50deg); }
          25% { transform: rotate(-95deg); }
          50% { transform: rotate(-95deg); }
          75% { transform: rotate(-72deg); }
          100% { transform: rotate(-50deg); }
        }
        @keyframes climbArmRightReach {
          0% { transform: rotate(-72deg); }
          25% { transform: rotate(-50deg); }
          50% { transform: rotate(-95deg); }
          75% { transform: rotate(-95deg); }
          100% { transform: rotate(-72deg); }
        }
        @keyframes climbLegStepLeft {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          25% { transform: translateY(-4px) rotate(8deg); }
          50% { transform: translateY(-8px) rotate(4deg); }
          75% { transform: translateY(-4px) rotate(0deg); }
        }
        @keyframes climbLegStepRight {
          0%, 100% { transform: translateY(-8px) rotate(4deg); }
          25% { transform: translateY(-4px) rotate(0deg); }
          50% { transform: translateY(0) rotate(0deg); }
          75% { transform: translateY(-4px) rotate(8deg); }
        }
        @keyframes climbSlip {
          0%, 78%, 100% { transform: translateY(0); }
          82% { transform: translateY(12px); }
          88% { transform: translateY(10px); }
          95% { transform: translateY(2px); }
        }
        @keyframes fallingRock {
          0% { transform: translateY(0) translateX(0) scale(1); opacity: 0.7; }
          100% { transform: translateY(200px) translateX(20px) scale(0.5); opacity: 0; }
        }
        @keyframes windParticle {
          0% { transform: translateX(-40px) translateY(0); opacity: 0; }
          20% { opacity: 0.5; }
          80% { opacity: 0.3; }
          100% { transform: translateX(120px) translateY(-10px); opacity: 0; }
        }
        @keyframes cheerBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes cheerArmLeft {
          0% { transform: rotate(-60deg); }
          50% { transform: rotate(-110deg); }
          100% { transform: rotate(-110deg); }
        }
        @keyframes cheerArmRight {
          0% { transform: rotate(-60deg); }
          50% { transform: rotate(110deg); }
          100% { transform: rotate(110deg); }
        }
        @keyframes volcanoGlow {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
        @keyframes volcanoSmoke {
          0% { opacity: 0.25; transform: translate(-50%, 0) scale(0.8); }
          50% { opacity: 0.45; transform: translate(-50%, -12%) scale(1.1); }
          100% { opacity: 0; transform: translate(-50%, -30%) scale(1.3); }
        }
        @keyframes lavaDrip {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes lavaFlow {
          0% { stroke-dashoffset: 0; opacity: 0.6; }
          50% { stroke-dashoffset: -8; opacity: 0.9; }
          100% { stroke-dashoffset: 0; opacity: 0.6; }
        }
        @keyframes cloudDrift {
          0% { transform: translate(-50%, 0) translateX(0); opacity: 0.5; }
          50% { transform: translate(-50%, 0) translateX(8%); opacity: 0.7; }
          100% { transform: translate(-50%, 0) translateX(0); opacity: 0.5; }
        }
        @keyframes cloudDriftSlow {
          0% { transform: translate(-50%, 0) translateX(5%); opacity: 0.4; }
          100% { transform: translate(-50%, 0) translateX(-5%); opacity: 0.6; }
        }
        .peeker-bike-bob { animation: bikeBob 0.4s ease-in-out infinite; }
        .passenger-leg-swing { animation: passengerLegSwing 2s ease-in-out infinite; }
        .climb-arm-left { animation: climbArmLeftReach 1.5s ease-in-out infinite; }
        .climb-arm-right { animation: climbArmRightReach 1.5s ease-in-out infinite; }
        .climb-leg-left { animation: climbLegStepLeft 1.5s ease-in-out infinite; }
        .climb-leg-right { animation: climbLegStepRight 1.5s ease-in-out infinite; }
        .climb-slip { animation: climbSlip 4s ease-in-out infinite; }
        .falling-rock { animation: fallingRock 1.5s ease-in forwards; }
        .falling-rock-delay-1 { animation: fallingRock 1.8s ease-in 0.6s forwards; }
        .falling-rock-delay-2 { animation: fallingRock 1.4s ease-in 1.2s forwards; }
        .wind-particle { animation: windParticle 3s linear infinite; }
        .wind-particle-delay-1 { animation: windParticle 3.5s linear 0.8s infinite; }
        .wind-particle-delay-2 { animation: windParticle 2.8s linear 1.6s infinite; }
        .cheer-bounce { animation: cheerBounce 0.5s ease-in-out 3; }
        .cheer-arm-left { animation: cheerArmLeft 0.4s ease-out forwards; }
        .cheer-arm-right { animation: cheerArmRight 0.4s ease-out forwards; }
        .volcano-glow { animation: volcanoGlow 2s ease-in-out infinite; }
        .volcano-smoke { animation: volcanoSmoke 4s ease-in-out infinite; }
        .volcano-smoke-delay { animation: volcanoSmoke 5s ease-in-out 1.5s infinite; }
        .volcano-smoke-delay-2 { animation: volcanoSmoke 6s ease-in-out 3s infinite; }
        .lava-drip { animation: lavaDrip 3s ease-in-out infinite, lavaFlow 2.5s ease-in-out infinite; }
        .lava-drip-delay { animation: lavaDrip 4s ease-in-out 1.5s infinite, lavaFlow 3s ease-in-out 0.5s infinite; }
        .volcano-cloud { animation: cloudDrift 12s ease-in-out infinite; }
        .volcano-cloud-slow { animation: cloudDriftSlow 18s ease-in-out infinite; }
      `}</style>

      {phase === 'peeking' && (
        <div
          role="button"
          tabIndex={0}
          onClick={handlePeekerClick}
          onKeyDown={(e) => e.key === 'Enter' && handlePeekerClick()}
          className="peeker-head pointer-events-auto absolute cursor-pointer rounded-full border border-white/10 bg-black/80 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
          style={{
            width: PEEKER_HEAD_SIZE,
            height: PEEKER_HEAD_SIZE,
            left: '50%',
            bottom: 0,
          }}
          aria-hidden
        >
          <PeekerEyes {...sharedEyeProps} />
        </div>
      )}

      {/* Volcano: forced perspective (scales from 0.15 to 1.0 as biker approaches) */}
      {volcanoScale > 0 && (
        <div
          className="pointer-events-none absolute z-0"
          style={{
            left: `${VOLCANO_TARGET_RATIO * 100}%`,
            bottom: 0,
            transform: `translate(-50%, 0) scale(${volcanoScale})`,
            transformOrigin: 'center bottom',
            width: 'min(38vw, 300px)',
            height: '58vh',
            minHeight: 240,
          }}
        >
          <div className="volcano-smoke absolute left-1/2 rounded-full bg-gray-500/30 blur-xl" style={{ width: '45%', height: '16%', top: '-6%' }} />
          <div className="volcano-smoke-delay absolute left-1/2 rounded-full bg-gray-400/25 blur-2xl" style={{ width: '35%', height: '12%', top: '-3%' }} />
          <div className="volcano-smoke-delay-2 absolute left-1/2 rounded-full bg-gray-500/20 blur-xl" style={{ width: '28%', height: '10%', top: '-1%' }} />
          <div className="volcano-cloud absolute left-1/2 rounded-full bg-white/20 blur-2xl" style={{ width: '50%', height: '14%', top: '-15%' }} />
          <div className="volcano-cloud-slow absolute left-1/2 rounded-full bg-white/15 blur-xl" style={{ width: '38%', height: '10%', top: '-22%', left: '55%' }} />
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 300 400" preserveAspectRatio="none">
            <defs>
              <linearGradient id="volcCone" x1="0.3" y1="0" x2="0.7" y2="1">
                <stop offset="0%" stopColor="#5c5248" />
                <stop offset="25%" stopColor="#4a4035" />
                <stop offset="50%" stopColor="#3a3028" />
                <stop offset="75%" stopColor="#2e2620" />
                <stop offset="100%" stopColor="#252019" />
              </linearGradient>
              <linearGradient id="volcConeSide" x1="0" y1="0.5" x2="1" y2="0.5">
                <stop offset="0%" stopColor="#2a231c" />
                <stop offset="35%" stopColor="#3d352c" />
                <stop offset="65%" stopColor="#4a4035" />
                <stop offset="100%" stopColor="#5a5045" />
              </linearGradient>
              <linearGradient id="volcSnow" x1="0.5" y1="0" x2="0.5" y2="1">
                <stop offset="0%" stopColor="#e8e8f0" />
                <stop offset="35%" stopColor="#d0d0dc" />
                <stop offset="70%" stopColor="#a8a8b8" />
                <stop offset="100%" stopColor="#8a8a9a" />
              </linearGradient>
              <radialGradient id="volcLava" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0%" stopColor="#ff6b1a" />
                <stop offset="60%" stopColor="#dc2626" />
                <stop offset="100%" stopColor="#7f1d1d" />
              </radialGradient>
              <filter id="lavaGlow"><feGaussianBlur in="SourceGraphic" stdDeviation="6" /></filter>
              <filter id="bikeGlow"><feGaussianBlur stdDeviation="1.5" /><feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            {/* Main cone: irregular silhouette (slightly wavy edges, not a perfect triangle) */}
            <path d="M150,12 L138,55 L115,120 L75,200 L45,280 L18,365 L12,390 L35,390 L65,392 L100,390 L135,391 L165,390 L200,391 L235,390 L268,392 L288,390 L282,365 L255,280 L225,200 L185,120 L162,55 Z" fill="url(#volcCone)" stroke="#252019" strokeWidth="1.5" />
            <path d="M150,12 L138,55 L115,120 L75,200 L45,280 L18,365 L12,390 L35,390 L65,392 L100,390 L135,391 L165,390 L200,391 L235,390 L268,392 L288,390 L282,365 L255,280 L225,200 L185,120 L162,55 Z" fill="url(#volcConeSide)" opacity="0.85" />
            {/* Rock strata / horizontal bands (subtle) */}
            <path d="M120,180 L180,180 L240,220 L260,260 L40,260 L60,220 Z" fill="#2a231c" opacity="0.12" />
            <path d="M95,260 L205,260 L235,300 L65,300 Z" fill="#1f1a16" opacity="0.14" />
            <path d="M70,320 L230,320 L250,355 L50,355 Z" fill="#1a1714" opacity="0.16" />
            {/* Erosion / lava flow ridges (darker lines running down) */}
            <path d="M130,50 Q125,120 115,200" stroke="#1f1a16" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.5" />
            <path d="M165,45 Q172,110 185,190" stroke="#252019" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.45" />
            <path d="M110,90 Q95,180 75,270" stroke="#1a1714" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.4" />
            <path d="M192,95 Q208,175 228,265" stroke="#1f1a16" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.4" />
            <path d="M88,240 L72,320" stroke="#252019" strokeWidth="1.5" fill="none" opacity="0.35" />
            <path d="M212,238 L228,318" stroke="#252019" strokeWidth="1.5" fill="none" opacity="0.35" />
            {/* Fine rock texture / cracks */}
            <line x1={98} y1={140} x2={92} y2={165} stroke="#1f1a16" strokeWidth="1" opacity="0.3" />
            <line x1={155} y1={100} x2={148} y2={130} stroke="#252019" strokeWidth="0.8" opacity="0.25" />
            <line x1={200} y1={135} x2={208} y2={160} stroke="#1f1a16" strokeWidth="1" opacity="0.3" />
            <line x1={65} y1={230} x2={58} y2={255} stroke="#1a1714" strokeWidth="0.8" opacity="0.3" />
            <line x1={235} y1={228} x2={242} y2={252} stroke="#1a1714" strokeWidth="0.8" opacity="0.3" />
            <line x1={118} y1={290} x2={108} y2={315} stroke="#252019" strokeWidth="0.6" opacity="0.25" />
            <line x1={182} y1={288} x2={192} y2={312} stroke="#252019" strokeWidth="0.6" opacity="0.25" />
            <line x1={145} y1={340} x2={155} y2={360} stroke="#1f1a16" strokeWidth="0.6" opacity="0.2" />
            <polygon points="150,12 133,60 126,80 119,100 181,100 174,80 167,60 150,12" fill="url(#volcSnow)" opacity="0.92" />
            <ellipse cx={150} cy={22} rx={28} ry={12} fill="#1a1714" stroke="#2a231c" strokeWidth="1.5" />
            <ellipse cx={150} cy={20} rx={22} ry={9} fill="#ff6b1a" opacity="0.4" filter="url(#lavaGlow)" />
            <ellipse cx={150} cy={20} rx={16} ry={7} fill="url(#volcLava)" className="volcano-glow" />
            <path d="M142,28 Q140,60 138,90" stroke="#dc4a1a" strokeWidth="2" fill="none" strokeDasharray="4 6" className="lava-drip" />
            <path d="M158,28 Q162,55 165,80" stroke="#dc4a1a" strokeWidth="1.5" fill="none" strokeDasharray="3 5" className="lava-drip-delay" />
            <path d="M150,26 Q148,70 142,110" stroke="#dc4a1a" strokeWidth="1.2" fill="none" opacity="0.6" strokeDasharray="3 4" className="lava-drip" style={{ animationDelay: '0.8s' }} />
          </svg>
        </div>
      )}

      {/* Bike: visible during biking phases + dismounting/remounting. Joint-based diamond frame. */}
      {(phase === 'hop_on_bike' || phase === 'biking_to_volcano' || phase === 'dismounting' || phase === 'remounting' || phase === 'biking_off') && (() => {
        const lean = phase === 'biking_to_volcano' ? characterY * 0.04 : 0;
        const bikeY = phase === 'biking_to_volcano' ? characterY : 0;
        const bikeX = (phase === 'dismounting' || phase === 'remounting') ? bikeParkedX : characterX;
        const riderOnBike = phase !== 'dismounting' || dismountElapsedMs < DISMOUNT_GET_OFF_MS;
        const crankAngle = bikeWheelRotation * CRANK_RATIO;
        const crankRad = (crankAngle * Math.PI) / 180;
        const crankLen = 10;
        const pedal1X = BB.x + crankLen * Math.cos(crankRad);
        const pedal1Y = BB.y + crankLen * Math.sin(crankRad);
        const pedal2X = BB.x + crankLen * Math.cos(crankRad + Math.PI);
        const pedal2Y = BB.y + crankLen * Math.sin(crankRad + Math.PI);
        const hipX = SC.x + 4; const hipY = SC.y + 6;
        const thighLen = 16; const shinLen = 16;
        const solveKnee = (hx: number, hy: number, px: number, py: number) => {
          const dx = px - hx; const dy = py - hy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const clampedDist = Math.min(dist, thighLen + shinLen - 0.5);
          const a = Math.atan2(dy, dx);
          const cosA = (thighLen * thighLen + clampedDist * clampedDist - shinLen * shinLen) / (2 * thighLen * clampedDist);
          const ka = Math.acos(Math.max(-1, Math.min(1, cosA)));
          return { x: hx + thighLen * Math.cos(a - ka), y: hy + thighLen * Math.sin(a - ka) };
        };
        const knee1 = solveKnee(hipX, hipY, pedal1X, pedal1Y);
        const knee2 = solveKnee(hipX, hipY, pedal2X, pedal2Y);
        const fs = 'rgba(255,255,255,0.5)';
        const rs = 'rgba(255,255,255,0.45)';
        return (
          <div
            className="pointer-events-none absolute peeker-bike-bob"
            style={{
              left: '50%',
              bottom: 0,
              transform: `translate(calc(-50% + ${bikeX}px), ${bikeY}px) rotate(${lean}deg)`,
              transformOrigin: 'center bottom',
            }}
          >
            <svg width="280" height="140" viewBox="0 0 160 80" fill="none">
              {/* Back wheel: tire + spokes, no fill */}
              <g transform={`rotate(${bikeWheelRotation} ${RD.x} ${RD.y})`}>
                <circle cx={RD.x} cy={RD.y} r={WHEEL_R} fill="none" stroke={fs} strokeWidth="2.5" />
                {[0, 60, 120, 180, 240, 300].map((d) => (
                  <line key={d} x1={RD.x} y1={RD.y} x2={RD.x + (WHEEL_R - 2) * Math.cos((d * Math.PI) / 180)} y2={RD.y + (WHEEL_R - 2) * Math.sin((d * Math.PI) / 180)} stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
                ))}
              </g>
              {/* Front wheel: tire + spokes, no fill */}
              <g transform={`rotate(${bikeWheelRotation} ${FD.x} ${FD.y})`}>
                <circle cx={FD.x} cy={FD.y} r={WHEEL_R} fill="none" stroke={fs} strokeWidth="2.5" />
                {[0, 60, 120, 180, 240, 300].map((d) => (
                  <line key={d} x1={FD.x} y1={FD.y} x2={FD.x + (WHEEL_R - 2) * Math.cos((d * Math.PI) / 180)} y2={FD.y + (WHEEL_R - 2) * Math.sin((d * Math.PI) / 180)} stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
                ))}
              </g>
              {/* Main diamond: top tube, down tube (BB to fork 1/5 down), seat tube */}
              <g stroke={fs} strokeWidth="3.5" strokeLinecap="round">
                <line x1={SC.x} y1={SC.y} x2={HT.x} y2={HT.y} />
                <line x1={HT.x + 0.2 * (FD.x - HT.x)} y1={HT.y + 0.2 * (FD.y - HT.y)} x2={BB.x} y2={BB.y} />
                <line x1={BB.x} y1={BB.y} x2={SC.x} y2={SC.y} />
              </g>
              {/* Fork: single line from handlebars to front wheel */}
              <line x1={HT.x} y1={HT.y} x2={FD.x} y2={FD.y} stroke={fs} strokeWidth="3" strokeLinecap="round" />
              {/* Rear triangle */}
              <g stroke={fs} strokeWidth="2.5" strokeLinecap="round">
                <line x1={SC.x} y1={SC.y} x2={RD.x} y2={RD.y} />
                <line x1={BB.x} y1={BB.y} x2={RD.x} y2={RD.y} />
              </g>
              {/* Seat post + saddle */}
              <line x1={SC.x} y1={SC.y} x2={SC.x - 1} y2={SC.y - 5} stroke={fs} strokeWidth="2" strokeLinecap="round" />
              <ellipse cx={SC.x - 1} cy={SC.y - 7} rx={7} ry={2.5} fill="rgba(0,0,0,0.7)" stroke="rgba(255,255,255,0.35)" strokeWidth="1.2" />
              {/* Stem + handlebars */}
              <line x1={HT.x} y1={HT.y} x2={HT.x + 6} y2={HT.y - 3} stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" />
              <line x1={HT.x + 3} y1={HT.y - 5} x2={HT.x + 10} y2={HT.y - 2} stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round" />
              {/* (rear rack removed -- peeker rides on saddle, not as passenger) */}
              {/* Cranks at BB */}
              <g transform={`rotate(${crankAngle} ${BB.x} ${BB.y})`}>
                <line x1={BB.x} y1={BB.y} x2={BB.x} y2={BB.y - crankLen} stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
                <line x1={BB.x} y1={BB.y} x2={BB.x} y2={BB.y + crankLen} stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
                <circle cx={BB.x} cy={BB.y - crankLen} r={2.5} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
                <circle cx={BB.x} cy={BB.y + crankLen} r={2.5} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1" />
              </g>
              {riderOnBike && (
                <>
                  {/* Rider legs: IK from hip to pedals */}
                  <line x1={hipX} y1={hipY} x2={knee1.x} y2={knee1.y} stroke="rgba(255,255,255,0.1)" strokeWidth="13" strokeLinecap="round" />
                  <line x1={knee1.x} y1={knee1.y} x2={pedal1X} y2={pedal1Y} stroke="rgba(255,255,255,0.1)" strokeWidth="13" strokeLinecap="round" />
                  <line x1={hipX} y1={hipY} x2={knee2.x} y2={knee2.y} stroke="rgba(255,255,255,0.1)" strokeWidth="13" strokeLinecap="round" />
                  <line x1={knee2.x} y1={knee2.y} x2={pedal2X} y2={pedal2Y} stroke="rgba(255,255,255,0.1)" strokeWidth="13" strokeLinecap="round" />
                  <line x1={hipX} y1={hipY} x2={knee1.x} y2={knee1.y} stroke="rgba(0,0,0,0.8)" strokeWidth="11" strokeLinecap="round" />
                  <line x1={knee1.x} y1={knee1.y} x2={pedal1X} y2={pedal1Y} stroke="rgba(0,0,0,0.8)" strokeWidth="11" strokeLinecap="round" />
                  <line x1={hipX} y1={hipY} x2={knee2.x} y2={knee2.y} stroke="rgba(0,0,0,0.8)" strokeWidth="11" strokeLinecap="round" />
                  <line x1={knee2.x} y1={knee2.y} x2={pedal2X} y2={pedal2Y} stroke="rgba(0,0,0,0.8)" strokeWidth="11" strokeLinecap="round" />
                </>
              )}
            </svg>
            {riderOnBike && (
            /* Peeker (the actual div-based character, same as when running) sitting on the saddle */
            <div className="absolute flex flex-col items-center" style={{
              left: hipX * (280 / 160) - PEEKER_HEAD_SIZE / 2,
              bottom: (80 - hipY) * (140 / 80),
            }}>
              <div className="absolute flex gap-12" style={{ bottom: 44, zIndex: 2, left: '50%', transform: 'translateX(-50%)' }}>
                <div className="h-8 w-3 rounded-full border border-white/10 bg-black/80 origin-bottom" style={{ transform: 'rotate(-48deg)' }} />
                <div className="h-8 w-3 rounded-full border border-white/10 bg-black/80 origin-bottom" style={{ transform: 'rotate(48deg)' }} />
              </div>
              <div
                className="relative rounded-full border border-white/10 bg-black/80 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
                style={{ width: PEEKER_HEAD_SIZE, height: PEEKER_HEAD_SIZE, marginBottom: -4 }}
              >
                <PeekerEyes {...sharedEyeProps} />
              </div>
              <div className="overflow-hidden rounded-b-2xl border border-t-0 border-white/10 bg-black/80" style={{ width: 56, height: 44, marginBottom: 0 }} />
            </div>
            )}
          </div>
        );
      })()}

      {/* Dismount: step off bike (same X), step down to ground, then walk to volcano — no teleport */}
      {phase === 'dismounting' && dismountElapsedMs >= DISMOUNT_GET_OFF_MS && (() => {
        const isSteppingDown = dismountElapsedMs < DISMOUNT_WALK_START_MS;
        const stepDownProgress = isSteppingDown
          ? Math.min(1, (dismountElapsedMs - DISMOUNT_GET_OFF_MS) / DISMOUNT_STEP_DOWN_MS)
          : 1;
        const stepDownBottom = 16 * (1 - stepDownProgress);
        const x = isSteppingDown ? bikeParkedX : characterX;
        return (
          <div
            className="pointer-events-none absolute flex flex-col items-center"
            style={{
              left: '50%',
              bottom: stepDownBottom,
              transform: `translate(calc(-50% + ${x}px), 0)`,
            }}
          >
            <div className="absolute flex gap-20" style={{ bottom: 44, zIndex: 2, left: '50%', transform: 'translateX(-50%)' }}>
              <div className="h-10 w-4 rounded-full border border-white/10 bg-black/80 origin-bottom" style={{ transform: 'rotate(-15deg)' }} />
              <div className="h-10 w-4 rounded-full border border-white/10 bg-black/80 origin-bottom" style={{ transform: 'rotate(15deg)' }} />
            </div>
            <div
              className="relative rounded-full border border-white/10 bg-black/80 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
              style={{ width: PEEKER_HEAD_SIZE, height: PEEKER_HEAD_SIZE, marginBottom: -4 }}
            >
              <PeekerEyes {...sharedEyeProps} />
            </div>
            <div className="overflow-hidden rounded-b-2xl border border-t-0 border-white/10 bg-black/80" style={{ width: 56, height: 44, marginBottom: 0 }} />
          </div>
        );
      })()}

      {/* Climbing / cheering / climbing_down: anchored to volcano position */}
      {(phase === 'climbing' || phase === 'cheering' || phase === 'climbing_down') && (() => {
        const volcanoHeightPx = Math.max(240, windowSize.h * 0.58);
        const climbBottom = climbProgress * volcanoHeightPx * 0.97;
        const isDown = phase === 'climbing_down';
        const isClimbing = phase === 'climbing' || isDown;
        return (
          <div
            className={`pointer-events-none absolute flex flex-col items-center ${isClimbing ? 'climb-slip' : 'cheer-bounce'}`}
            style={{
              left: `${VOLCANO_TARGET_RATIO * 100}%`,
              bottom: climbBottom,
              transform: `translateX(-50%)${isDown ? ' scaleX(-1)' : ''}`,
            }}
          >
            {isClimbing && (
              <>
                <div className="wind-particle absolute w-1.5 h-1.5 rounded-full bg-white/40" style={{ top: -20, left: -30 }} />
                <div className="wind-particle-delay-1 absolute w-1 h-1 rounded-full bg-white/30" style={{ top: 10, left: -20 }} />
                <div className="wind-particle-delay-2 absolute w-1.5 h-1.5 rounded-full bg-white/35" style={{ top: 40, left: -40 }} />
                <div className="falling-rock absolute w-1.5 h-1.5 rounded-full bg-stone-500/70" style={{ top: -10, left: 20 }} />
                <div className="falling-rock-delay-1 absolute w-2 h-2 rounded-sm bg-stone-600/60" style={{ top: -5, left: -15 }} />
                <div className="falling-rock-delay-2 absolute w-1 h-1 rounded-full bg-stone-500/50" style={{ top: -15, left: 5 }} />
                <svg className="absolute pointer-events-none" style={{ top: PEEKER_HEAD_SIZE + 20, left: -10, width: 60, height: 200, overflow: 'visible' }}>
                  <path d="M30,0 Q15,60 25,120 Q35,160 20,200" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" fill="none" strokeDasharray="4 3" />
                  <circle cx={20} cy={200} r={3} fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                </svg>
              </>
            )}
            <div className="absolute flex gap-12" style={{ bottom: 64, zIndex: 2, left: '50%', transform: 'translateX(-50%)' }}>
              <div className="relative" style={{ height: 40, width: 16 }}>
                <div className={`h-10 w-4 rounded-full border border-white/10 bg-black/80 origin-bottom ${isClimbing ? 'climb-arm-left' : 'cheer-arm-left'}`}>
                  {phase === 'climbing' && (
                    <svg width="24" height="36" viewBox="0 0 24 36" fill="none" className="absolute" style={{ top: -34, left: -4 }}>
                      <line x1={12} y1={6} x2={12} y2={32} stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" />
                      <path d="M12,6 Q18,4 20,10" stroke="rgba(255,255,255,0.35)" strokeWidth="2" fill="none" strokeLinecap="round" />
                      <line x1={12} y1={6} x2={6} y2={10} stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinecap="round" />
                      <line x1={12} y1={32} x2={12} y2={36} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  )}
                  {phase === 'cheering' && (
                    <svg width="20" height="24" viewBox="0 0 20 24" fill="none" className="absolute" style={{ top: -22, left: 0 }}>
                      <line x1={4} y1={0} x2={4} y2={24} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
                      <polygon points="4,0 18,4 4,10" fill="rgba(34,211,238,0.6)" stroke="rgba(255,255,255,0.2)" strokeWidth="0.5" />
                    </svg>
                  )}
                </div>
              </div>
              <div className={`h-10 w-4 rounded-full border border-white/10 bg-black/80 origin-bottom ${isClimbing ? 'climb-arm-right' : 'cheer-arm-right'}`} />
            </div>
            <svg className="absolute" style={{ top: -6, left: '50%', transform: 'translateX(-50%)', width: PEEKER_HEAD_SIZE + 8, height: 20, overflow: 'visible' }}>
              <path d={`M4,18 Q${(PEEKER_HEAD_SIZE + 8) / 2},0 ${PEEKER_HEAD_SIZE + 4},18`} stroke="rgba(255,255,255,0.2)" strokeWidth="3" fill="rgba(0,0,0,0.5)" strokeLinecap="round" />
              <line x1={12} y1={18} x2={12} y2={24} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
              <line x1={PEEKER_HEAD_SIZE - 4} y1={18} x2={PEEKER_HEAD_SIZE - 4} y2={24} stroke="rgba(255,255,255,0.12)" strokeWidth="1" />
            </svg>
            <div
              className="relative rounded-full border border-white/10 bg-black/80 shadow-[0_0_20px_rgba(34,211,238,0.15)]"
              style={{ width: PEEKER_HEAD_SIZE, height: PEEKER_HEAD_SIZE, marginBottom: -4, transform: isClimbing ? 'rotate(3deg)' : 'none' }}
            >
              <PeekerEyes {...sharedEyeProps} />
            </div>
            <div
              className="overflow-hidden rounded-b-2xl border border-t-0 border-white/10 bg-black/80"
              style={{ width: 56, height: 44, marginBottom: 0, transform: isClimbing ? 'rotate(3deg)' : 'none' }}
            />
            <div className="flex justify-center gap-2" style={{ marginTop: -2 }}>
              <div className={`h-5 w-5 rounded-b-md border border-white/10 bg-black/80 ${isClimbing ? 'climb-leg-left' : ''}`} style={{ transformOrigin: 'top center' }} />
              <div className={`h-5 w-5 rounded-b-md border border-white/10 bg-black/80 ${isClimbing ? 'climb-leg-right' : ''}`} style={{ transformOrigin: 'top center' }} />
            </div>
          </div>
        );
      })()}

      {(phase === 'pulling_up' || phase === 'standing' || phase === 'standing_with_bubble' || phase === 'running_off') && (
        <div
          className={phase === 'standing_with_bubble' ? 'pointer-events-auto absolute flex flex-col items-center cursor-pointer' : 'pointer-events-none absolute flex flex-col items-center'}
          style={{
            left: '50%',
            bottom: 0,
            transform: `translate(calc(-50% + ${characterX}px), 0)`,
          }}
          {...(phase === 'standing_with_bubble' ? { role: 'button', tabIndex: 0, onClick: handlePeekerClick, onKeyDown: (e: React.KeyboardEvent) => e.key === 'Enter' && handlePeekerClick() } : {})}
        >
          {phase === 'standing_with_bubble' && (
            <div
              className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-2xl bg-white px-5 py-4 text-base text-gray-900 shadow-lg border border-gray-200/80 leading-relaxed z-20"
              style={{
                bottom: PEEKER_HEAD_SIZE + 44 + 24,
                width: 'min(340px, calc(100vw - 2rem))',
                minWidth: 260,
              }}
            >
              Hey, I know Daniel is really cool and great and all... but you&apos;ve been here for a really long time and you are probably really cool too with your own life to live. I think we should part ways now. It&apos;s not me, it&apos;s you.
            </div>
          )}
          <div className="absolute flex gap-20" style={{ bottom: 44, zIndex: 2, left: '50%', transform: 'translateX(-50%)' }}>
            <div
              className={`h-10 w-4 rounded-full border border-white/10 bg-black/80 shadow-[0_0_8px_rgba(34,211,238,0.2)] origin-bottom ${phase === 'pulling_up' ? 'peeker-pull-up-arm-left' : ''} ${phase === 'running_off' ? 'peeker-run-arm' : ''}`}
              style={phase === 'standing' || phase === 'standing_with_bubble' ? { transform: 'rotate(-15deg)' } : undefined}
            />
            <div
              className={`h-10 w-4 rounded-full border border-white/10 bg-black/80 shadow-[0_0_8px_rgba(34,211,238,0.2)] origin-bottom ${phase === 'pulling_up' ? 'peeker-pull-up-arm-right' : ''} ${phase === 'running_off' ? 'peeker-run-arm' : ''}`}
              style={phase === 'standing' || phase === 'standing_with_bubble' ? { transform: 'rotate(15deg)' } : undefined}
            />
          </div>

          <div
            className={`relative rounded-full border border-white/10 bg-black/80 shadow-[0_0_20px_rgba(34,211,238,0.15)] ${phase === 'standing' ? 'peeker-stand-wobble' : ''} ${phase === 'standing_with_bubble' ? 'peeker-stand-wobble-idle' : ''}`}
            style={{
              width: PEEKER_HEAD_SIZE,
              height: PEEKER_HEAD_SIZE,
              marginBottom: -4,
            }}
          >
            <PeekerEyes {...sharedEyeProps} />
          </div>

          <div
            className={`overflow-hidden rounded-b-2xl border border-t-0 border-white/10 bg-black/80 shadow-[0_0_12px_rgba(34,211,238,0.1)] ${phase === 'pulling_up' ? 'peeker-pull-up-body' : ''}`}
            style={{
              width: 56,
              height: phase === 'pulling_up' ? 0 : 44,
              marginBottom: 0,
            }}
          />

          <div className="flex justify-center gap-2" style={{ marginTop: -2 }}>
            <div
              className={`h-4 w-5 rounded-b-md border border-white/10 bg-black/80 ${phase === 'running_off' ? 'peeker-run-leg-left' : ''}`}
              style={{ transformOrigin: 'top center' }}
            />
            <div
              className={`h-4 w-5 rounded-b-md border border-white/10 bg-black/80 ${phase === 'running_off' ? 'peeker-run-leg-right' : ''}`}
              style={{ transformOrigin: 'top center' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function PeekerEyes({
  isBlinking,
  pupils,
  cursorClose,
}: {
  isBlinking: boolean;
  pupils: { left: { x: number; y: number }; right: { x: number; y: number } };
  cursorClose: boolean;
}) {
  return (
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
    <div className="pointer-events-none fixed inset-0 z-10 hidden md:block" aria-hidden>
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
      className="absolute w-2 h-2 rounded-full bg-white/15"
      style={{
        left: `${baseX * 100}%`,
        top: `${baseY * 100}%`,
        transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
      }}
    />
  );
}
