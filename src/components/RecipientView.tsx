import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FastForward,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import {
  COSMIC_PALETTES,
  GLOW_COLORS,
  MUSIC_TRACKS,
  computeTextBlockMarginLeftPct,
  isDefaultStarTextStyle,
  resolveMessageFont,
  resolveStarGlowHex,
  resolveStarTextStyle,
  resolveTextShadowCss,
} from '../scene/paletteConfig';
import { getMusicTrackBlob } from '../services/musicEngine';
import type {
  ConstellationProject,
  MessageTextAlign,
  RecipientPhase,
} from '../types/project';
import { Constellation3D, type Constellation3DHandle } from './Constellation3D';
import { StarIllustrationView } from './StarIllustrationView';

interface RecipientViewProps {
  project: ConstellationProject;
  onExitPreview?: () => void;
}

type StoryNavigationIntent =
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'index'; index: number }
  | { type: 'constellation' };

interface SwipeGestureState {
  active: boolean;
  pointerId: number | null;
  pointerType: string;
  startX: number;
  startY: number;
  hasHorizontalIntent: boolean;
}

const INITIAL_SWIPE_STATE: SwipeGestureState = {
  active: false,
  pointerId: null,
  pointerType: '',
  startX: 0,
  startY: 0,
  hasHorizontalIntent: false,
};

const SWIPE_MIN_DISTANCE_PX = 65;
const SWIPE_HORIZONTAL_RATIO = 1.35;

function SmallProgressStarIcon({ lit, active }: { lit: boolean; active: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`transition-transform duration-200 ${
        active ? 'w-5 h-5 scale-110' : 'w-4 h-4'
      }`}
      aria-hidden="true"
    >
      <path
        d="M12 2.4l2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 16.59l-5.56 2.93 1.06-6.2-4.5-4.39 6.22-.9L12 2.4z"
        fill={lit ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={lit ? '1.2' : '1.6'}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function shouldIgnoreSwipeTarget(
  target: EventTarget | null,
  pointerType: string,
): boolean {
  if (!(target instanceof Element)) return false;
  if (
    target.closest(
      'button, a, input, textarea, select, [role="button"], [data-no-swipe="true"]',
    )
  ) {
    return true;
  }
  if (
    pointerType === 'mouse' &&
    target.closest('[data-selectable-text="true"]')
  ) {
    return true;
  }
  return false;
}

function hasActiveTextSelection(): boolean {
  if (typeof window === 'undefined' || !window.getSelection) return false;
  const sel = window.getSelection();
  return Boolean(sel && !sel.isCollapsed && sel.toString().trim().length > 0);
}

export function RecipientView({ project, onExitPreview }: RecipientViewProps) {
  const sceneRef = useRef<Constellation3DHandle | null>(null);

  const [phase, setPhase] = useState<RecipientPhase>('sealed');
  const [activeIndex, setActiveIndex] = useState(0);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [finaleReached, setFinaleReached] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [dragOffsetX, setDragOffsetX] = useState(0);

  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );
  const [force2D, setForce2D] = useState(false);
  const [webglUnavailable, setWebglUnavailable] = useState(false);

  const [viewport, setViewport] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? window.innerHeight : 720,
  }));

  // Synchronous state snapshot & lock refs to prevent stale closures and double transitions
  const stateRef = useRef({
    phase,
    activeIndex,
    unlockedCount,
    finaleReached,
    reducedMotion,
    force2D,
    webglUnavailable,
  });
  stateRef.current = {
    phase,
    activeIndex,
    unlockedCount,
    finaleReached,
    reducedMotion,
    force2D,
    webglUnavailable,
  };

  const navLockRef = useRef(false);
  const lockTimerRef = useRef<number | null>(null);
  const swipeRef = useRef<SwipeGestureState>({ ...INITIAL_SWIPE_STATE });

  // Audio playback state
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [volume, setVolume] = useState(0.58);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const releaseTransitionLock = useCallback(() => {
    if (lockTimerRef.current !== null) {
      window.clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
    }
    navLockRef.current = false;
    setIsTransitioning(false);
  }, []);

  const acquireTransitionLock = useCallback(
    (durationMs: number) => {
      if (lockTimerRef.current !== null) {
        window.clearTimeout(lockTimerRef.current);
      }
      navLockRef.current = true;
      setIsTransitioning(true);
      lockTimerRef.current = window.setTimeout(() => {
        lockTimerRef.current = null;
        navLockRef.current = false;
        setIsTransitioning(false);
      }, durationMs);
    },
    [],
  );

  useEffect(() => {
    return () => {
      if (lockTimerRef.current !== null) {
        window.clearTimeout(lockTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const syncViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener('resize', syncViewport);
    window.addEventListener('orientationchange', syncViewport);
    return () => {
      window.removeEventListener('resize', syncViewport);
      window.removeEventListener('orientationchange', syncViewport);
    };
  }, []);

  useEffect(() => {
    if (project.musicTrackId === 'none') return;
    const blob = getMusicTrackBlob(project.musicTrackId);
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = volume;
    audioRef.current = audio;

    return () => {
      audio.pause();
      URL.revokeObjectURL(url);
      audioRef.current = null;
    };
  }, [project.musicTrackId]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = musicMuted ? 0 : volume;
    }
  }, [volume, musicMuted]);

  const attemptPlayMusic = () => {
    const audio = audioRef.current;
    if (!audio || project.musicTrackId === 'none') return;

    audio.volume = musicMuted ? 0 : volume;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          setMusicPlaying(true);
          setAudioBlocked(false);
        })
        .catch(() => {
          setMusicPlaying(false);
          setAudioBlocked(true);
        });
    }
  };

  const toggleSound = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!musicPlaying || audioBlocked) {
      setMusicMuted(false);
      attemptPlayMusic();
      return;
    }

    setMusicMuted((m) => !m);
  };

  const enterStarStoryAtFirst = useCallback(() => {
    releaseTransitionLock();
    stateRef.current.unlockedCount = Math.max(1, stateRef.current.unlockedCount);
    stateRef.current.activeIndex = 0;
    stateRef.current.phase = 'starStory';
    setUnlockedCount((prev) => Math.max(1, prev));
    setActiveIndex(0);
    setPhase('starStory');
  }, [releaseTransitionLock]);

  const handleOpenEnvelope = () => {
    if (stateRef.current.phase !== 'sealed' || navLockRef.current) return;

    attemptPlayMusic();
    stateRef.current.unlockedCount = 1;
    stateRef.current.activeIndex = 0;
    setUnlockedCount(1);
    setActiveIndex(0);

    if (
      stateRef.current.force2D ||
      stateRef.current.webglUnavailable ||
      stateRef.current.reducedMotion
    ) {
      sceneRef.current?.skipBirthSequence();
      stateRef.current.phase = 'starStory';
      setPhase('starStory');
      acquireTransitionLock(90);
      return;
    }

    stateRef.current.phase = 'birthing';
    setPhase('birthing');
    sceneRef.current?.playBirthSequence();
  };

  const handleSkipBirth = () => {
    sceneRef.current?.skipBirthSequence();
    enterStarStoryAtFirst();
  };

  const handleBirthComplete = () => {
    enterStarStoryAtFirst();
  };

  const handleTriggerFinalReveal = useCallback(() => {
    const total = project.stars.length;
    stateRef.current.unlockedCount = total;
    setUnlockedCount(total);

    if (
      stateRef.current.force2D ||
      stateRef.current.webglUnavailable ||
      stateRef.current.reducedMotion
    ) {
      sceneRef.current?.skipFinalReveal();
      stateRef.current.finaleReached = true;
      stateRef.current.phase = 'constellation';
      setFinaleReached(true);
      setPhase('constellation');
      acquireTransitionLock(100);
      return;
    }

    releaseTransitionLock();
    stateRef.current.phase = 'finalReveal';
    setPhase('finalReveal');
    sceneRef.current?.playFinalReveal();
  }, [project.stars.length, acquireTransitionLock, releaseTransitionLock]);

  const handleSkipFinalReveal = () => {
    releaseTransitionLock();
    sceneRef.current?.skipFinalReveal();
    stateRef.current.finaleReached = true;
    stateRef.current.phase = 'constellation';
    setFinaleReached(true);
    setPhase('constellation');
  };

  const handleFinalRevealComplete = () => {
    releaseTransitionLock();
    stateRef.current.finaleReached = true;
    stateRef.current.phase = 'constellation';
    setFinaleReached(true);
    setPhase('constellation');
  };

  /**
   * Unified transition handler used by swipes, compact arrows, progress stars, 3D star picks, and keyboard.
   */
  const navigateStory = useCallback(
    (intent: StoryNavigationIntent) => {
      const snap = stateRef.current;
      const total = project.stars.length;
      if (total === 0) return;
      if (navLockRef.current) return;
      if (snap.phase === 'sealed' || snap.phase === 'birthing' || snap.phase === 'finalReveal') {
        return;
      }

      const instant = snap.reducedMotion || snap.force2D || snap.webglUnavailable;
      const lockDuration = instant ? 90 : 460;

      if (intent.type === 'constellation') {
        if (!snap.finaleReached || snap.phase === 'constellation') return;
        acquireTransitionLock(lockDuration);
        stateRef.current.phase = 'constellation';
        setPhase('constellation');
        return;
      }

      if (snap.phase === 'constellation') {
        if (intent.type !== 'index') return;
        if (intent.index < 0 || intent.index >= total) return;
        acquireTransitionLock(lockDuration);
        stateRef.current.activeIndex = intent.index;
        stateRef.current.phase = 'starStory';
        setActiveIndex(intent.index);
        setPhase('starStory');
        return;
      }

      // Phase === 'starStory'
      if (intent.type === 'next') {
        if (snap.activeIndex >= total - 1) {
          handleTriggerFinalReveal();
          return;
        }
        const nextIdx = snap.activeIndex + 1;
        const nextStar = project.stars[nextIdx];
        const isBrandNew = nextIdx >= snap.unlockedCount;

        acquireTransitionLock(lockDuration);
        stateRef.current.activeIndex = nextIdx;
        if (isBrandNew) {
          stateRef.current.unlockedCount = nextIdx + 1;
          setUnlockedCount(nextIdx + 1);
          if (nextStar && !instant) {
            sceneRef.current?.triggerStarBirth(nextStar.id);
          }
        }
        setActiveIndex(nextIdx);
        return;
      }

      if (intent.type === 'prev') {
        if (snap.activeIndex <= 0) return;
        const prevIdx = snap.activeIndex - 1;
        acquireTransitionLock(lockDuration);
        stateRef.current.activeIndex = prevIdx;
        setActiveIndex(prevIdx);
        return;
      }

      if (intent.type === 'index') {
        if (intent.index < 0 || intent.index >= total) return;
        // Strictly block premature access to unopened stars
        if (intent.index >= snap.unlockedCount && !snap.finaleReached) return;
        if (intent.index === snap.activeIndex) return;

        acquireTransitionLock(lockDuration);
        stateRef.current.activeIndex = intent.index;
        setActiveIndex(intent.index);
      }
    },
    [project.stars, acquireTransitionLock, handleTriggerFinalReveal],
  );

  // Keyboard navigation in StarStory
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current.phase !== 'starStory') return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateStory({ type: 'next' });
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateStory({ type: 'prev' });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigateStory]);

  const handleSelectStarFromScene = (starId: string) => {
    const idx = project.stars.findIndex((s) => s.id === starId);
    if (idx === -1) return;
    navigateStory({ type: 'index', index: idx });
  };

  // Pointer Events Swipe Handling (exclusively on story content region, never 3D canvas)
  const resetSwipeGesture = useCallback(() => {
    swipeRef.current = { ...INITIAL_SWIPE_STATE };
    setDragOffsetX(0);
  }, []);

  const handleStoryPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stateRef.current.phase !== 'starStory') return;
    if (navLockRef.current) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    // Cancel cleanly on multi-touch
    if (swipeRef.current.active && swipeRef.current.pointerId !== e.pointerId) {
      resetSwipeGesture();
      return;
    }

    if (shouldIgnoreSwipeTarget(e.target, e.pointerType)) return;
    if (hasActiveTextSelection()) return;

    swipeRef.current = {
      active: true,
      pointerId: e.pointerId,
      pointerType: e.pointerType,
      startX: e.clientX,
      startY: e.clientY,
      hasHorizontalIntent: false,
    };
  };

  const handleStoryPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = swipeRef.current;
    if (!gesture.active || gesture.pointerId !== e.pointerId) return;

    if (navLockRef.current || hasActiveTextSelection()) {
      resetSwipeGesture();
      return;
    }

    const dx = e.clientX - gesture.startX;
    const dy = e.clientY - gesture.startY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    // Yield immediately to vertical scrolling when vertical gesture dominates
    if (!gesture.hasHorizontalIntent && absY > 20 && absY >= absX * 1.05) {
      resetSwipeGesture();
      return;
    }

    if (!gesture.hasHorizontalIntent && absX > 16 && absX > absY * SWIPE_HORIZONTAL_RATIO) {
      gesture.hasHorizontalIntent = true;
    }

    if (gesture.hasHorizontalIntent && !stateRef.current.reducedMotion) {
      const clamped = Math.max(-26, Math.min(26, dx * 0.24));
      setDragOffsetX(clamped);
    }
  };

  const handleStoryPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const gesture = swipeRef.current;
    if (!gesture.active || gesture.pointerId !== e.pointerId) return;

    const dx = e.clientX - gesture.startX;
    const dy = e.clientY - gesture.startY;
    resetSwipeGesture();

    if (navLockRef.current || hasActiveTextSelection()) return;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (absX >= SWIPE_MIN_DISTANCE_PX && absX > absY * SWIPE_HORIZONTAL_RATIO) {
      if (dx < 0) {
        navigateStory({ type: 'next' });
      } else {
        navigateStory({ type: 'prev' });
      }
    }
  };

  const totalStars = project.stars.length;
  const activeStar = project.stars[activeIndex] ?? project.stars[0] ?? null;
  const activeStarId =
    phase === 'starStory' || phase === 'birthing'
      ? activeStar?.id ?? null
      : null;

  const unlockedStarIds = project.stars
    .slice(0, Math.max(0, unlockedCount))
    .map((s) => s.id);

  const palette = COSMIC_PALETTES[project.paletteId];
  const globalGlow = GLOW_COLORS[project.globalGlowColor];
  const trackMeta = MUSIC_TRACKS.find((t) => t.id === project.musicTrackId);
  const activeStarGlow = activeStar
    ? GLOW_COLORS[resolveStarGlowHex(activeStar, project.globalGlowColor)]
    : globalGlow;

  const signatureText =
    project.senderName?.trim() ||
    (project.recipientName ? `Для ${project.recipientName}` : '');

  const isLastStar = activeIndex >= totalStars - 1;
  const isPortrait = viewport.height > viewport.width || viewport.width < 540;
  const isCompactLandscape = !isPortrait && viewport.height < 520;

  const starTextStyle = resolveStarTextStyle(activeStar ?? undefined);
  const starFontMeta = resolveMessageFont(starTextStyle.fontId);
  const effectiveAlign: Exclude<MessageTextAlign, 'auto'> =
    starTextStyle.textAlign === 'auto'
      ? isPortrait
        ? 'center'
        : 'left'
      : starTextStyle.textAlign;
  const effectiveBodyPx = Math.min(
    starTextStyle.fontSize + starFontMeta.opticalSizeBoost,
    isCompactLandscape ? 16 : isPortrait ? 20 : 26,
  );
  const effectiveTitlePx = Math.round(
    Math.min(isCompactLandscape ? 25 : isPortrait ? 31 : 38, effectiveBodyPx * 1.48),
  );
  const textMarginLeftPct = computeTextBlockMarginLeftPct(
    starTextStyle.widthPct,
    starTextStyle.offsetX,
  );
  const absYRatio = Math.min(1, Math.abs(starTextStyle.offsetY) / 100);
  const spacerBase = isPortrait || isCompactLandscape ? 0.35 : 0.9;
  const topOuterGrow = Number(((1 - absYRatio) * spacerBase).toFixed(3));
  const topInnerGrow = Number(
    (starTextStyle.offsetY <= 0
      ? 0.08 * (1 + starTextStyle.offsetY / 100)
      : 0.08 + (starTextStyle.offsetY / 100) * 1.92
    ).toFixed(3),
  );
  const bottomInnerGrow = Number(
    (starTextStyle.offsetY >= 0
      ? (1 - absYRatio) * spacerBase
      : spacerBase + (-starTextStyle.offsetY / 100) * (2 - spacerBase)
    ).toFixed(3),
  );
  const resolvedTextShadow = resolveTextShadowCss(
    starTextStyle.shadow,
    activeStarGlow.hex,
  );

  const finalTextStyle = project.finalTextStyle
    ? resolveStarTextStyle(project.finalTextStyle)
    : null;
  const hasCustomFinalStyle = Boolean(
    finalTextStyle && !isDefaultStarTextStyle(finalTextStyle),
  );
  const finalFontMeta = finalTextStyle
    ? resolveMessageFont(finalTextStyle.fontId)
    : null;
  const finalEffectiveAlign: Exclude<MessageTextAlign, 'auto'> =
    finalTextStyle && finalTextStyle.textAlign !== 'auto'
      ? finalTextStyle.textAlign
      : 'center';

  return (
    <div className="relative w-screen gl-h-screen overflow-hidden bg-gl-bg text-gl-text">
      {/* Unified 3D Cosmic Scene (single persistent WebGL context) */}
      <Constellation3D
        ref={sceneRef}
        paletteId={project.paletteId}
        globalGlowColor={project.globalGlowColor}
        stars={project.stars}
        connections={project.connections}
        selectedStarId={activeStarId}
        visitedStarIds={unlockedStarIds}
        interactionMode="recipient"
        recipientPhase={phase}
        unlockedCount={unlockedCount}
        finaleActive={phase === 'finalReveal' || phase === 'constellation' || finaleReached}
        lowPerformance={viewport.width < 768}
        reducedMotion={reducedMotion}
        force2DFallback={force2D}
        startSealed={true}
        onOpenEnvelope={handleOpenEnvelope}
        onBirthComplete={handleBirthComplete}
        onFinalRevealComplete={handleFinalRevealComplete}
        onSelectStar={handleSelectStarFromScene}
        onWebGLFallback={() => setWebglUnavailable(true)}
      />

      {/* 2D fallback sealed envelope when 2D mode is active or WebGL2 unavailable */}
      {phase === 'sealed' && (force2D || webglUnavailable) && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center p-6"
          style={{ background: palette.cssGradient }}
        >
          <div className="gl-card w-72 h-48 !border-white/20 shadow-2xl flex flex-col items-center justify-center gap-3">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center border border-amber-200/70"
              style={{
                background: `radial-gradient(circle, ${globalGlow.coreHex} 10%, ${globalGlow.hex} 65%, transparent 100%)`,
                boxShadow: `0 0 28px ${globalGlow.hex}`,
              }}
            >
              <Sparkles className="w-7 h-7 text-gl-card" />
            </div>
            <span className="text-xs font-medium text-gl-text-secondary">
              Запечатанное созвездие
            </span>
          </div>
        </div>
      )}

      {/* PHASE 1: Sealed Envelope */}
      {phase === 'sealed' && (
        <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-5 sm:p-8 gl-safe-top gl-safe-bottom">
          <header className="flex items-start justify-between gap-4">
            <div className="pointer-events-auto">
              {onExitPreview && (
                <button
                  type="button"
                  onClick={onExitPreview}
                  className="gl-btn-secondary !bg-gl-panel/85 hover:!bg-gl-card text-gl-text !px-3 !py-2 text-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  В редактор
                </button>
              )}
            </div>

            <div className="text-center flex-1 max-w-2xl mx-auto">
              <p className="text-xs sm:text-sm text-gl-text-secondary font-medium mb-1">
                {project.recipientName
                  ? `Для ${project.recipientName} · ${project.occasionLabel}`
                  : project.occasionLabel}
              </p>
              <h1 className="font-display text-2xl sm:text-4xl font-bold text-gl-text leading-tight drop-shadow [text-wrap:balance]">
                {project.title}
              </h1>
            </div>

            <div className="w-20 hidden sm:block" />
          </header>

          <div className="pointer-events-auto flex flex-col items-center gap-3 pb-4 sm:pb-6">
            <p className="text-xs sm:text-sm text-gl-text-secondary text-center">
              Нажмите на звёздную печать или кнопку ниже, чтобы открыть первое послание
            </p>
            <button
              type="button"
              onClick={handleOpenEnvelope}
              className="gl-btn-primary !rounded-2xl !px-7 !py-3.5 !text-base shadow-xl"
            >
              <Sparkles className="w-5 h-5" />
              Открыть послание
            </button>
          </div>
        </div>
      )}

      {/* PHASE 2: Envelope Dissolve & First Star Birth */}
      {phase === 'birthing' && (
        <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 gl-safe-top gl-safe-bottom">
          <div className="flex items-start justify-between gap-3">
            <div className="pointer-events-auto">
              {onExitPreview && (
                <button
                  type="button"
                  onClick={onExitPreview}
                  className="gl-btn-secondary !bg-gl-panel/85 hover:!bg-gl-card text-gl-text !px-3 !py-2 text-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  В редактор
                </button>
              )}
            </div>

            <div className="pointer-events-auto flex items-center gap-2">
              {project.musicTrackId !== 'none' && (
                <button
                  type="button"
                  onClick={toggleSound}
                  className="gl-btn-secondary !bg-gl-panel/88 hover:!bg-gl-card text-gl-text !px-3 !py-2 text-xs"
                >
                  {musicMuted || !musicPlaying ? (
                    <VolumeX className="w-3.5 h-3.5 text-amber-300" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-gl-accent-light" />
                  )}
                  <span className="hidden sm:inline">
                    {audioBlocked
                      ? 'Запустить музыку'
                      : musicMuted
                        ? 'Включить звук'
                        : 'Звук вкл'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={handleSkipBirth}
                className="gl-btn-secondary !bg-gl-panel/88 hover:!bg-gl-card text-gl-text !px-3.5 !py-2 text-xs"
              >
                <FastForward className="w-3.5 h-3.5" />
                Пропустить
              </button>
            </div>
          </div>

          {audioBlocked && project.musicTrackId !== 'none' && (
            <div className="pointer-events-auto gl-hud !border-amber-300/40 mx-auto mb-4 px-4 py-2.5 flex items-center gap-3 text-xs text-amber-100">
              <span>Браузер ограничил автозапуск музыки</span>
              <button
                type="button"
                onClick={attemptPlayMusic}
                className="gl-btn-primary !min-h-[34px] !px-3 !py-1.5 text-xs"
              >
                Включить вручную
              </button>
            </div>
          )}
        </div>
      )}

      {/* PHASE 3: Sequential Star Story (Swipe + Orientation Adaptive Layout) */}
      {phase === 'starStory' && activeStar && (
        <div className="pointer-events-none fixed inset-0 z-20 flex flex-col overflow-x-hidden gl-safe-top gl-safe-bottom">
          {/* Atmospheric readability scrim adapted to portrait vs landscape */}
          <div
            className={`pointer-events-none absolute inset-0 ${
              isPortrait
                ? 'bg-gradient-to-t from-[#070B1A]/90 via-[#070B1A]/44 to-transparent'
                : 'bg-gradient-to-l from-[#070B1A]/78 via-[#070B1A]/36 to-transparent'
            }`}
            aria-hidden="true"
          />

          {/* Compact Top Bar: Exit, Star Progress Indicator, Utility Toggles */}
          <header
            className={`relative z-10 flex items-center justify-between gap-2 shrink-0 ${
              isCompactLandscape ? 'px-4 pt-2.5 pb-1' : 'px-4 sm:px-7 pt-3.5 sm:pt-4 pb-1.5'
            }`}
          >
            <div className="pointer-events-auto flex items-center gap-2.5 min-w-0">
              {onExitPreview && (
                <button
                  type="button"
                  onClick={onExitPreview}
                  className="gl-btn-secondary !bg-gl-panel/75 hover:!bg-gl-card/90 text-gl-text !px-3 !py-2 text-xs shrink-0"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">В редактор</span>
                </button>
              )}
              {!isPortrait && !isCompactLandscape && (
                <span className="hidden lg:inline text-xs sm:text-sm text-gl-text-secondary/90 font-medium truncate">
                  {project.title}
                </span>
              )}
            </div>

            {/* Star-shaped progress indicator (5-7+ small stars) */}
            <div className="pointer-events-auto flex items-center gap-2 sm:gap-2.5 shrink-0">
              <div
                className="flex items-center gap-1 sm:gap-1.5"
                role="navigation"
                aria-label="Открытые звёзды"
              >
                {project.stars.map((s, idx) => {
                  const isUnlocked = idx < unlockedCount || finaleReached;
                  const isCurrent = idx === activeIndex;
                  const starGlow =
                    GLOW_COLORS[resolveStarGlowHex(s, project.globalGlowColor)].hex;

                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={!isUnlocked || isTransitioning}
                      onClick={() => navigateStory({ type: 'index', index: idx })}
                      title={
                        isUnlocked
                          ? s.title || `Звезда ${idx + 1}`
                          : `Звезда ${idx + 1} ещё не открыта`
                      }
                      aria-label={
                        isUnlocked
                          ? `Открыть звезду ${idx + 1}: ${s.title || ''}`
                          : `Звезда ${idx + 1} закрыта`
                      }
                      aria-current={isCurrent ? 'step' : undefined}
                      className={`p-0.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 ${
                        isUnlocked
                          ? 'cursor-pointer hover:scale-110'
                          : 'cursor-default opacity-25'
                      }`}
                      style={{
                        color: isUnlocked ? starGlow : '#94a3b8',
                        filter: isCurrent
                          ? `drop-shadow(0 0 8px ${starGlow})`
                          : undefined,
                      }}
                    >
                      <SmallProgressStarIcon lit={isUnlocked} active={isCurrent} />
                    </button>
                  );
                })}
              </div>

              <span className="text-xs font-semibold text-gl-text-secondary tabular-nums whitespace-nowrap">
                {activeIndex + 1} / {totalStars}
              </span>
            </div>

            {/* Compact Utility Controls */}
            <div className="pointer-events-auto flex items-center gap-1.5 sm:gap-2 shrink-0">
              {finaleReached && (
                <button
                  type="button"
                  onClick={() => navigateStory({ type: 'constellation' })}
                  className="gl-btn-secondary !bg-amber-500/20 hover:!bg-amber-500/35 !border-amber-300/35 text-amber-100 !px-2.5 sm:!px-3 !py-2 text-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">К созвездию</span>
                </button>
              )}

              {project.musicTrackId !== 'none' && (
                <button
                  type="button"
                  onClick={toggleSound}
                  title={trackMeta?.name ?? 'Музыка'}
                  aria-label={musicMuted || !musicPlaying ? 'Включить звук' : 'Выключить звук'}
                  className="gl-btn-secondary !bg-gl-panel/75 hover:!bg-gl-card/90 text-gl-text !px-2.5 sm:!px-3 !py-2 text-xs"
                >
                  {musicMuted || !musicPlaying ? (
                    <VolumeX className="w-3.5 h-3.5 text-amber-300" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-gl-accent-light" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => setReducedMotion((v) => !v)}
                className="hidden sm:inline-flex gl-btn-secondary !bg-gl-panel/65 hover:!bg-gl-card/85 !px-2.5 !py-2 text-xs font-medium"
              >
                {reducedMotion ? 'Обычное движение' : 'Меньше движения'}
              </button>

              <button
                type="button"
                onClick={() => setForce2D((v) => !v)}
                className="hidden md:inline-flex gl-btn-secondary !bg-gl-panel/65 hover:!bg-gl-card/85 !px-2.5 !py-2 text-xs font-medium"
              >
                {force2D ? '3D' : '2D'}
              </button>
            </div>
          </header>

          {audioBlocked && project.musicTrackId !== 'none' && (
            <div className="pointer-events-auto relative z-20 gl-hud mx-auto mt-1 px-3.5 py-1.5 flex items-center gap-2.5 text-xs text-amber-100">
              <span>Музыка на паузе</span>
              <button
                type="button"
                onClick={attemptPlayMusic}
                className="gl-btn-primary !min-h-[32px] !px-2.5 !py-1 text-xs"
              >
                Включить
              </button>
            </div>
          )}

          {/* Orientation-adaptive split: Portrait (top 3D / bottom story) vs Landscape (left 3D / right story) */}
          <div
            className={`relative z-10 flex-1 min-h-0 overflow-hidden ${
              isPortrait ? 'flex flex-col' : 'grid grid-cols-[44%_56%]'
            }`}
          >
            {/* Open 3D Canvas Zone (pointer-events-none so user can independently rotate 3D scene with OrbitControls) */}
            <div
              className={
                isPortrait
                  ? 'h-[32vh] min-h-[190px] max-h-[290px] shrink-0 pointer-events-none'
                  : 'min-h-0 pointer-events-none'
              }
              aria-hidden="true"
            />

            {/* Story / Swipeable Area (pointer-events-auto, isolated from 3D OrbitControls) */}
            <div
              onPointerDown={handleStoryPointerDown}
              onPointerMove={handleStoryPointerMove}
              onPointerUp={handleStoryPointerUp}
              onPointerCancel={resetSwipeGesture}
              onLostPointerCapture={resetSwipeGesture}
              style={{ touchAction: 'pan-y' }}
              className={`pointer-events-auto min-h-0 flex flex-col overflow-y-auto overflow-x-hidden ${
                isPortrait
                  ? 'flex-1 px-5 pb-4 pt-1 justify-between items-center text-center'
                  : isCompactLandscape
                    ? 'px-5 pr-6 pb-3 pt-1 justify-between items-start text-left'
                    : 'px-6 sm:px-10 lg:pr-14 lg:pl-4 pb-6 pt-2 justify-between items-start text-left'
              }`}
            >
              {/* Animated Story Content inside bounded flex stage */}
              <div
                className={`flex-1 min-h-0 w-full max-w-xl flex flex-col ${
                  isPortrait ? 'mx-auto' : ''
                }`}
                style={{
                  transform:
                    dragOffsetX !== 0
                      ? `translate3d(${dragOffsetX}px, 0, 0)`
                      : undefined,
                  transition:
                    dragOffsetX === 0 ? 'transform 220ms ease-out' : undefined,
                }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.article
                    key={activeStar.id}
                    initial={
                      reducedMotion
                        ? { opacity: 1 }
                        : { opacity: 0, y: 12 }
                    }
                    animate={{ opacity: 1, y: 0 }}
                    exit={
                      reducedMotion
                        ? { opacity: 0 }
                        : { opacity: 0, y: -8 }
                    }
                    transition={{
                      duration: reducedMotion ? 0.06 : 0.24,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    className="flex-1 min-h-0 w-full flex flex-col"
                  >
                    <div style={{ flexGrow: topOuterGrow, flexBasis: 0 }} />

                    {/* Borderless Floating Illustration (always protected above text) */}
                    <div
                      className={`relative shrink-0 flex items-center justify-center py-0.5 ${
                        isPortrait ? 'self-center' : 'self-start'
                      }`}
                    >
                      <div
                        className="pointer-events-none absolute inset-0 -m-5 rounded-full opacity-55"
                        style={{
                          background: `radial-gradient(circle, ${activeStarGlow.hex}36 0%, transparent 70%)`,
                        }}
                        aria-hidden="true"
                      />
                      <StarIllustrationView
                        illustration={activeStar.illustration}
                        imageSettings={activeStar.imageSettings}
                        alt={activeStar.title || `Звезда ${activeIndex + 1}`}
                        className={`relative object-contain drop-shadow-[0_14px_34px_rgba(0,0,0,0.6)] ${
                          isPortrait
                            ? 'w-28 h-28 sm:w-40 sm:h-40'
                            : isCompactLandscape
                              ? 'w-20 h-20'
                              : 'w-40 h-40 lg:w-52 lg:h-52'
                        }`}
                      />
                    </div>

                    <div style={{ flexGrow: topInnerGrow, flexBasis: 0 }} />

                    {/* Bounded Customizable Message Block */}
                    <div
                      data-testid="story-text-block"
                      style={{
                        width: `${starTextStyle.widthPct}%`,
                        marginLeft: `${textMarginLeftPct}%`,
                        textAlign: effectiveAlign,
                        fontFamily: starFontMeta.cssFamily,
                        borderColor:
                          starTextStyle.accent === 'frame'
                            ? `${activeStarGlow.hex}44`
                            : starTextStyle.accent === 'quote'
                              ? activeStarGlow.hex
                              : undefined,
                      }}
                      className={`shrink-0 max-w-full space-y-2 ${
                        starTextStyle.accent === 'frame'
                          ? 'rounded-2xl border bg-[#070B1A]/62 backdrop-blur-md px-4 py-3.5 sm:px-5 sm:py-4 shadow-xl'
                          : starTextStyle.accent === 'quote'
                            ? effectiveAlign === 'right'
                              ? 'border-r-2 pr-3.5 py-0.5'
                              : 'border-l-2 pl-3.5 py-0.5'
                            : ''
                      }`}
                    >
                      {starTextStyle.accent === 'line' && (
                        <div
                          className="h-0.5 w-16 rounded-full"
                          style={{
                            background: `linear-gradient(90deg, ${activeStarGlow.hex}, ${activeStarGlow.coreHex})`,
                            marginLeft: effectiveAlign === 'left' ? 0 : 'auto',
                            marginRight: effectiveAlign === 'center' ? 'auto' : 0,
                          }}
                        />
                      )}

                      {/* Star Ordinal & Title */}
                      <div className="space-y-1 w-full">
                        <p
                          className="text-xs sm:text-sm font-medium tracking-wide tabular-nums"
                          style={{ color: activeStarGlow.coreHex }}
                        >
                          Звезда {activeIndex + 1} из {totalStars}
                        </p>
                        <h2
                          data-selectable-text="true"
                          style={{
                            fontFamily: starFontMeta.cssFamily,
                            fontSize: `${effectiveTitlePx}px`,
                            fontWeight: 600,
                            lineHeight: Math.min(
                              1.4,
                              Math.max(1.12, Number((starTextStyle.lineHeight * 0.78).toFixed(2))),
                            ),
                            color: starTextStyle.color,
                            textShadow: resolvedTextShadow,
                          }}
                          className="leading-tight [text-wrap:balance] break-words [overflow-wrap:anywhere] select-text"
                        >
                          {activeStar.title || `Звезда ${activeIndex + 1}`}
                        </h2>
                      </div>

                      {/* Personal Wish Message */}
                      <p
                        data-selectable-text="true"
                        style={{
                          fontFamily: starFontMeta.cssFamily,
                          fontSize: `${effectiveBodyPx}px`,
                          fontWeight: starTextStyle.fontWeight === 'semibold' ? 600 : 400,
                          lineHeight: starTextStyle.lineHeight,
                          color: starTextStyle.color,
                          textShadow: resolvedTextShadow,
                        }}
                        className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] select-text"
                      >
                        {activeStar.message || 'Здесь хранится особое тёплое пожелание.'}
                      </p>

                      {/* Signature Attribution */}
                      {signatureText && (
                        <p
                          data-selectable-text="true"
                          style={{
                            color: starTextStyle.color,
                            opacity: 0.78,
                            textShadow: resolvedTextShadow,
                          }}
                          className="text-xs sm:text-sm italic tracking-wide select-text"
                        >
                          — {signatureText}
                        </p>
                      )}
                    </div>

                    <div style={{ flexGrow: bottomInnerGrow, flexBasis: 0 }} />
                  </motion.article>
                </AnimatePresence>
              </div>

              {/* Stably Mounted Secondary Controls + Unobtrusive Swipe Hint */}
              <div
                data-no-swipe="true"
                className={`w-full max-w-xl pt-3 shrink-0 flex items-center gap-3 ${
                  isPortrait ? 'mx-auto justify-between' : 'justify-between'
                }`}
              >
                <button
                  type="button"
                  disabled={activeIndex <= 0 || isTransitioning}
                  onClick={() => navigateStory({ type: 'prev' })}
                  aria-label="Предыдущая звезда"
                  className="gl-btn-icon !rounded-full !bg-gl-panel/75 hover:!bg-gl-card text-gl-text"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Unobtrusive Animated Swipe Guidance */}
                <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-gl-text-secondary/90 text-center px-1 select-none">
                  <span
                    className={`inline-flex items-center ${
                      reducedMotion ? '' : 'animate-nudge-left'
                    }`}
                    aria-hidden="true"
                  >
                    <ChevronLeft
                      className={`w-3.5 h-3.5 ${
                        isLastStar ? 'text-amber-300' : 'text-gl-accent-light'
                      }`}
                    />
                  </span>
                  <span className={isLastStar ? 'text-amber-100/95 font-medium' : ''}>
                    {isLastStar
                      ? 'Свайп влево завершит создание созвездия'
                      : 'Свайп влево — следующая звезда'}
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isTransitioning}
                  onClick={() => navigateStory({ type: 'next' })}
                  aria-label={
                    isLastStar ? 'Завершить и зажечь созвездие' : 'Следующая звезда'
                  }
                  title={
                    isLastStar ? 'Зажечь всё созвездие' : 'Следующая звезда'
                  }
                  className={`gl-btn-icon !rounded-full ${
                    isLastStar
                      ? '!border-amber-300/45 !bg-amber-500/20 hover:!bg-amber-500/35 text-amber-200'
                      : '!bg-gl-panel/75 hover:!bg-gl-card text-gl-text'
                  }`}
                >
                  {isLastStar ? (
                    <Sparkles className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 4: Final Constellation Birth Choreography */}
      {phase === 'finalReveal' && (
        <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 gl-safe-top gl-safe-bottom">
          <div className="flex items-start justify-between gap-3">
            <div className="pointer-events-auto">
              {onExitPreview && (
                <button
                  type="button"
                  onClick={onExitPreview}
                  className="gl-btn-secondary !bg-gl-panel/85 hover:!bg-gl-card text-gl-text !px-3 !py-2 text-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  В редактор
                </button>
              )}
            </div>

            <div className="pointer-events-auto flex items-center gap-2">
              {project.musicTrackId !== 'none' && (
                <button
                  type="button"
                  onClick={toggleSound}
                  className="gl-btn-secondary !bg-gl-panel/88 hover:!bg-gl-card text-gl-text !px-3 !py-2 text-xs"
                >
                  {musicMuted || !musicPlaying ? (
                    <VolumeX className="w-3.5 h-3.5 text-amber-300" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5 text-gl-accent-light" />
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={handleSkipFinalReveal}
                className="gl-btn-secondary !bg-gl-panel/88 hover:!bg-gl-card text-gl-text !px-3.5 !py-2 text-xs"
              >
                <FastForward className="w-3.5 h-3.5" />
                Пропустить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PHASE 5: Final Rotating 3D Constellation + Non-Occluding Greeting */}
      {phase === 'constellation' && (
        <>
          <div
            className="pointer-events-none fixed inset-x-0 top-0 h-52 bg-gradient-to-b from-[#070B1A]/82 via-[#070B1A]/38 to-transparent z-10"
            aria-hidden="true"
          />

          <header className="pointer-events-none fixed top-0 inset-x-0 z-20 px-4 sm:px-8 pt-4 sm:pt-6 gl-safe-top flex items-start justify-between gap-4">
            <div className="pointer-events-auto shrink-0">
              {onExitPreview && (
                <button
                  type="button"
                  onClick={onExitPreview}
                  className="gl-btn-secondary !bg-gl-panel/85 hover:!bg-gl-card text-gl-text !px-3 !py-2 text-xs"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  В редактор
                </button>
              )}
            </div>

            {/* Final Greeting Positioned Above Constellation */}
            <motion.div
              initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: reducedMotion ? 0.08 : 0.65, ease: [0.16, 1, 0.3, 1] }}
              style={
                hasCustomFinalStyle && finalTextStyle && finalFontMeta
                  ? {
                      textAlign: finalEffectiveAlign,
                      fontFamily: finalFontMeta.cssFamily,
                      borderColor:
                        finalTextStyle.accent === 'frame'
                          ? `${globalGlow.hex}44`
                          : finalTextStyle.accent === 'quote'
                            ? globalGlow.hex
                            : undefined,
                    }
                  : undefined
              }
              className={`flex-1 max-w-2xl mx-auto text-center space-y-1.5 ${
                hasCustomFinalStyle && finalTextStyle?.accent === 'frame'
                  ? 'rounded-2xl border bg-[#070B1A]/60 backdrop-blur-md px-5 py-3.5 shadow-xl'
                  : hasCustomFinalStyle && finalTextStyle?.accent === 'quote'
                    ? finalEffectiveAlign === 'right'
                      ? 'border-r-2 pr-4 py-1'
                      : 'border-l-2 pl-4 py-1'
                    : ''
              }`}
            >
              <p className="text-xs sm:text-sm font-medium text-amber-200/90 tracking-wide">
                {project.recipientName
                  ? `Для ${project.recipientName} · ${project.title}`
                  : project.title}
              </p>

              {hasCustomFinalStyle && finalTextStyle?.accent === 'line' && (
                <div
                  className="h-0.5 w-16 rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${globalGlow.hex}, ${globalGlow.coreHex})`,
                    marginLeft: finalEffectiveAlign === 'left' ? 0 : 'auto',
                    marginRight: finalEffectiveAlign === 'center' ? 'auto' : 0,
                  }}
                />
              )}

              <h1
                style={
                  hasCustomFinalStyle && finalTextStyle && finalFontMeta
                    ? {
                        fontFamily: finalFontMeta.cssFamily,
                        fontWeight: finalTextStyle.fontWeight === 'semibold' ? 600 : 400,
                        fontSize: `${Math.min(
                          isPortrait ? 24 : 34,
                          Math.max(
                            16,
                            Math.round(
                              (finalTextStyle.fontSize + finalFontMeta.opticalSizeBoost) *
                                1.28,
                            ),
                          ),
                        )}px`,
                        lineHeight: Math.min(1.65, finalTextStyle.lineHeight),
                        color: finalTextStyle.color,
                        textShadow: resolveTextShadowCss(
                          finalTextStyle.shadow,
                          globalGlow.hex,
                        ),
                      }
                    : undefined
                }
                className="font-display text-lg sm:text-2xl lg:text-3xl font-bold text-gl-text leading-snug drop-shadow-[0_2px_16px_rgba(0,0,0,0.85)] [text-wrap:balance] break-words [overflow-wrap:anywhere]"
              >
                {project.finalMessage}
              </h1>
              {signatureText && (
                <p
                  style={
                    hasCustomFinalStyle && finalTextStyle
                      ? { color: finalTextStyle.color, opacity: 0.78 }
                      : undefined
                  }
                  className="text-xs sm:text-sm text-gl-text-secondary/90 italic"
                >
                  {signatureText}
                </p>
              )}
            </motion.div>

            <div className="w-20 hidden sm:block shrink-0" />
          </header>

          {/* Compact Interactive Bottom Dock */}
          <div className="gl-hud fixed bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-wrap items-center justify-center gap-2 !rounded-2xl px-3 py-2 max-w-[95vw] mb-[env(safe-area-inset-bottom,0px)]">
            <div className="flex items-center gap-1 pr-2 border-r border-white/15">
              {project.stars.map((s, idx) => {
                const hex = GLOW_COLORS[resolveStarGlowHex(s, project.globalGlowColor)].hex;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => navigateStory({ type: 'index', index: idx })}
                    title={s.title || `Звезда ${idx + 1}`}
                    aria-label={`Открыть звезду ${idx + 1}: ${s.title || ''}`}
                    className="w-9 h-9 sm:w-8 sm:h-8 rounded-lg bg-white/[0.06] hover:bg-white/[0.16] text-xs font-semibold text-gl-text flex items-center justify-center transition-colors cursor-pointer tabular-nums"
                    style={{ borderBottom: `2px solid ${hex}` }}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => sceneRef.current?.resetCamera()}
              className="gl-btn-secondary !px-3 !py-1.5 text-xs text-gl-text"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Сброс
            </button>

            <button
              type="button"
              onClick={() => setReducedMotion((v) => !v)}
              className="gl-btn-secondary !px-3 !py-1.5 text-xs"
            >
              {reducedMotion ? 'Вращение: выкл' : 'Меньше движения'}
            </button>

            <button
              type="button"
              onClick={() => setForce2D((v) => !v)}
              className="gl-btn-secondary !px-3 !py-1.5 text-xs"
            >
              {force2D ? '3D' : '2D'}
            </button>

            {project.musicTrackId !== 'none' && (
              <div className="flex items-center gap-2 pl-2 border-l border-white/15">
                <button
                  type="button"
                  onClick={toggleSound}
                  title={trackMeta?.name ?? 'Музыка'}
                  aria-label={musicMuted || !musicPlaying ? 'Включить звук' : 'Выключить звук'}
                  className="gl-btn-secondary !bg-violet-600/40 hover:!bg-violet-600/60 !px-3 !py-1.5 text-xs text-gl-text"
                >
                  {musicMuted || !musicPlaying ? (
                    <VolumeX className="w-3.5 h-3.5" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                  <span className="hidden sm:inline">
                    {musicMuted || !musicPlaying ? 'Звук выкл' : 'Звук вкл'}
                  </span>
                </button>

                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={musicMuted ? 0 : volume}
                  onChange={(e) => {
                    setMusicMuted(false);
                    if (!musicPlaying) attemptPlayMusic();
                    setVolume(Number(e.target.value));
                  }}
                  aria-label="Громкость музыки"
                  className="w-16 sm:w-20 accent-violet-400 cursor-pointer"
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
