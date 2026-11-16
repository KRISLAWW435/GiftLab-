import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FastForward,
  MailOpen,
  Pencil,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type {
  EditableCardTarget,
  EditableTextField,
  PreviewJumpTarget,
} from '../preview/previewProtocol';
import {
  COSMIC_PALETTES,
  GLOW_COLORS,
  MUSIC_TRACKS,
  buildProjectCardDevicePatch,
  buildProjectConstellationDevicePatch,
  buildProjectFinalDecorDevicePatch,
  buildProjectFinalTextDevicePatch,
  buildStarDecorDevicePatch,
  buildStarIllustrationDevicePatch,
  buildStarTextDevicePatch,
  computeTextBlockMarginLeftPct,
  resolveCardColors,
  resolveCardTheme,
  resolveEffectiveCardLayout,
  resolveEffectiveConstellationLayout,
  resolveEffectiveFinalDecor,
  resolveEffectiveFinalTextStyle,
  resolveEffectiveIllustrationLayout,
  resolveEffectiveStarDecor,
  resolveEffectiveStarTextStyle,
  resolveMessageFont,
  resolveStarGlowHex,
  resolveTextShadowCss,
  resolveViewportDeviceMode,
} from '../scene/paletteConfig';
import { getMusicTrackBlob } from '../services/musicEngine';
import type {
  ConstellationProject,
  ConstellationStar,
  DeviceLayoutKey,
  MessageTextAlign,
  RecipientPhase,
} from '../types/project';
import { CardDecorView } from './CardDecorView';
import { Constellation3D, type Constellation3DHandle } from './Constellation3D';
import { FinalLetterCard, type FinalLetterDragKind } from './FinalLetterCard';
import { StarIllustrationView } from './StarIllustrationView';

interface RecipientViewProps {
  project: ConstellationProject;
  deviceMode?: DeviceLayoutKey;
  onExitPreview?: () => void;
  editMode?: boolean;
  selectedTarget?: EditableCardTarget | null;
  jumpTo?: PreviewJumpTarget | null;
  onPhaseStateChange?: (phase: RecipientPhase, activeIndex: number) => void;
  onSelectTarget?: (target: EditableCardTarget | null, field?: EditableTextField) => void;
  onPatchStar?: (starId: string, patch: Partial<ConstellationStar>) => void;
  onPatchProject?: (patch: Partial<ConstellationProject>) => void;
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

export function RecipientView({
  project,
  deviceMode,
  onExitPreview,
  editMode = false,
  selectedTarget = null,
  jumpTo = null,
  onPhaseStateChange,
  onSelectTarget,
  onPatchStar,
  onPatchProject,
}: RecipientViewProps) {
  const sceneRef = useRef<Constellation3DHandle | null>(null);
  const storyStageRef = useRef<HTMLDivElement | null>(null);
  const storyRightRef = useRef<HTMLDivElement | null>(null);
  const finaleHeaderRef = useRef<HTMLElement | null>(null);
  const storyInlineInputRef = useRef<HTMLInputElement | null>(null);
  const storyInlineTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const [phase, setPhase] = useState<RecipientPhase>('sealed');
  const [activeIndex, setActiveIndex] = useState(0);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [finaleReached, setFinaleReached] = useState(false);
  const [letterOpen, setLetterOpen] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [dragOffsetX, setDragOffsetX] = useState(0);
  const [activeInlineField, setActiveInlineField] = useState<EditableTextField | null>(null);

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

  const canvasEditDragRef = useRef<{
    kind:
      | 'text-move'
      | 'text-resize-right'
      | 'text-resize-left'
      | 'illu-move'
      | 'illu-scale'
      | 'decor-move'
      | 'decor-scale'
      | 'constellation-move'
      | FinalLetterDragKind;
    pointerId: number;
    startX: number;
    startY: number;
    containerW: number;
    containerH: number;
    originX: number;
    originY: number;
    originValue: number;
    starId?: string;
    hasMoved: boolean;
    pendingInlineField?: EditableTextField;
  } | null>(null);

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
    onPhaseStateChange?.(phase, activeIndex);
  }, [phase, activeIndex, onPhaseStateChange]);

  const lastHandledJumpNonceRef = useRef<number>(0);
  useEffect(() => {
    if (!jumpTo || jumpTo.nonce === lastHandledJumpNonceRef.current) return;
    lastHandledJumpNonceRef.current = jumpTo.nonce;

    releaseTransitionLock();
    const total = Math.max(1, project.stars.length);

    if (jumpTo.phase === 'sealed') {
      stateRef.current.phase = 'sealed';
      stateRef.current.activeIndex = 0;
      stateRef.current.unlockedCount = 0;
      stateRef.current.finaleReached = false;
      setPhase('sealed');
      setActiveIndex(0);
      setUnlockedCount(0);
      setFinaleReached(false);
      return;
    }

    if (jumpTo.phase === 'constellation') {
      sceneRef.current?.skipFinalReveal();
      stateRef.current.unlockedCount = total;
      stateRef.current.finaleReached = true;
      stateRef.current.phase = 'constellation';
      setUnlockedCount(total);
      setFinaleReached(true);
      setLetterOpen(true);
      setPhase('constellation');
      return;
    }

    // jumpTo.phase === 'starStory'
    const targetIdx = Math.max(0, Math.min(total - 1, jumpTo.starIndex ?? 0));
    if (stateRef.current.phase === 'sealed' || stateRef.current.phase === 'birthing') {
      sceneRef.current?.skipBirthSequence();
    } else if (stateRef.current.phase === 'finalReveal') {
      sceneRef.current?.skipFinalReveal();
    }
    const nextUnlocked = Math.max(stateRef.current.unlockedCount, targetIdx + 1);
    stateRef.current.unlockedCount = nextUnlocked;
    stateRef.current.activeIndex = targetIdx;
    stateRef.current.phase = 'starStory';
    setUnlockedCount(nextUnlocked);
    setActiveIndex(targetIdx);
    setPhase('starStory');
  }, [jumpTo, project.stars.length, releaseTransitionLock]);

  useEffect(() => {
    if (
      editMode &&
      !jumpTo &&
      (stateRef.current.phase === 'sealed' || stateRef.current.phase === 'birthing')
    ) {
      releaseTransitionLock();
      sceneRef.current?.skipBirthSequence();
      const total = Math.max(1, project.stars.length);
      const nextUnlocked = Math.min(total, Math.max(1, stateRef.current.unlockedCount));
      stateRef.current.unlockedCount = nextUnlocked;
      stateRef.current.activeIndex = 0;
      stateRef.current.phase = 'starStory';
      setUnlockedCount(nextUnlocked);
      setActiveIndex(0);
      setPhase('starStory');
    }
  }, [editMode, jumpTo, phase, project.stars.length, releaseTransitionLock]);

  useEffect(() => {
    setActiveInlineField(null);
  }, [editMode, phase, activeIndex]);

  useEffect(() => {
    if (!editMode || phase !== 'starStory' || !activeInlineField) return;
    if (activeInlineField === 'starMessage') {
      const el = storyInlineTextareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    } else if (activeInlineField === 'starTitle' || activeInlineField === 'senderName') {
      const el = storyInlineInputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }
  }, [editMode, phase, activeInlineField]);

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
      setLetterOpen(true);
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
    setLetterOpen(true);
    setPhase('constellation');
  };

  const handleFinalRevealComplete = () => {
    releaseTransitionLock();
    stateRef.current.finaleReached = true;
    stateRef.current.phase = 'constellation';
    setFinaleReached(true);
    setLetterOpen(true);
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
        setLetterOpen(true);
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
    if (editMode) return;
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
  const activeDevice: DeviceLayoutKey =
    deviceMode ?? resolveViewportDeviceMode(viewport.width, viewport.height);

  const constellationLayout = resolveEffectiveConstellationLayout(project, activeDevice);
  const cardLayout = resolveEffectiveCardLayout(project, activeDevice);
  const starTextStyle = resolveEffectiveStarTextStyle(activeStar ?? undefined, activeDevice);
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

  const illuLayout = resolveEffectiveIllustrationLayout(activeStar ?? undefined, activeDevice);
  const illuLeftGrow = Number(((illuLayout.offsetX + 100) / 200).toFixed(3));
  const illuRightGrow = Number((1 - illuLeftGrow).toFixed(3));
  const clampedIlluScale = Math.min(isPortrait ? 1.28 : 1.45, illuLayout.scale);
  const baseIlluPx = isCompactLandscape
    ? 80
    : isPortrait
      ? viewport.width >= 640
        ? 156
        : 118
      : viewport.width >= 1024
        ? 196
        : 158;
  const effectiveIlluPx = Math.round(baseIlluPx * clampedIlluScale);

  const illuYShift = illuLayout.offsetY / 100;
  const textYShift = starTextStyle.offsetY / 100;
  const spacerBase = isPortrait || isCompactLandscape ? 0.35 : 0.9;
  const rawTopOuterGrow = Math.max(
    0,
    Math.min(
      2.0,
      spacerBase * (1 + illuYShift * 0.85) - Math.max(0, -textYShift) * 0.45,
    ),
  );
  const rawTopInnerGrow = Math.max(
    0.06,
    Math.min(
      2.2,
      0.14 + Math.max(0, textYShift) * 1.4 + Math.max(0, -illuYShift) * 0.7,
    ),
  );
  const rawBottomInnerGrow = Math.max(
    0,
    Math.min(2.4, spacerBase + Math.max(0, -textYShift) * 1.35 - Math.max(0, textYShift) * 0.65),
  );

  const topOuterGrow = Number(
    (cardLayout.verticalAlign === 'top'
      ? rawTopOuterGrow * 0.2
      : cardLayout.verticalAlign === 'spread'
        ? rawTopOuterGrow * 0.4
        : rawTopOuterGrow
    ).toFixed(3),
  );
  const topInnerGrow = Number(
    (cardLayout.verticalAlign === 'spread'
      ? rawTopInnerGrow + 0.75
      : rawTopInnerGrow
    ).toFixed(3),
  );
  const bottomInnerGrow = Number(
    (cardLayout.verticalAlign === 'top'
      ? rawBottomInnerGrow + 1.15
      : cardLayout.verticalAlign === 'spread'
        ? rawBottomInnerGrow * 0.4
        : rawBottomInnerGrow
    ).toFixed(3),
  );

  const cardTheme = resolveCardTheme(project.cardTheme);
  const cardColors = resolveCardColors(project);
  const hasExplicitCardTheme = Boolean(project.cardTheme || project.cardColors);

  const storyWidthClass = isPortrait
    ? cardLayout.width === 'compact'
      ? 'max-w-[330px]'
      : cardLayout.width === 'wide'
        ? 'max-w-full'
        : 'max-w-[374px]'
    : cardLayout.width === 'compact'
      ? 'max-w-md'
      : cardLayout.width === 'wide'
        ? 'max-w-2xl'
        : 'max-w-xl';

  const storyCardPaddingClass = hasExplicitCardTheme
    ? cardLayout.padding === 'compact'
      ? 'px-3 py-2 sm:px-4 sm:py-3'
      : cardLayout.padding === 'spacious'
        ? 'px-5 py-4 sm:px-8 sm:py-6'
        : 'px-4 py-3 sm:px-6 sm:py-4'
    : cardLayout.padding === 'compact'
      ? 'px-0.5 py-0.5'
      : cardLayout.padding === 'spacious'
        ? 'px-3 sm:px-5 py-2 sm:py-3'
        : '';

  const storyCardOffsetY = Math.round(cardLayout.offsetY * 0.7);

  const starDecor = resolveEffectiveStarDecor(activeStar ?? undefined, activeDevice);
  const effectiveStarTextColor =
    activeStar?.textStyle || !cardColors.isLightPaper
      ? starTextStyle.color
      : cardColors.textColor;
  const effectiveStarShadowMode =
    cardColors.isLightPaper && starTextStyle.shadow !== 'glow'
      ? 'none'
      : starTextStyle.shadow;
  const resolvedTextShadow = resolveTextShadowCss(
    effectiveStarShadowMode,
    activeStarGlow.hex,
  );
  const storyDecorGlowHex = cardColors.isLightPaper
    ? cardColors.accentColor
    : activeStarGlow.hex;
  const storyDecorCoreHex = cardColors.isLightPaper
    ? cardColors.badgeColor
    : activeStarGlow.coreHex;

  const finalTextStyle = resolveEffectiveFinalTextStyle(project, activeDevice);
  const finalDecor = resolveEffectiveFinalDecor(project, activeDevice);

  // Interactive visual card design pointer handlers (only active in PreviewWorkspace editMode)
  const beginCanvasEdit = (
    kind:
      | 'text-move'
      | 'text-resize-right'
      | 'text-resize-left'
      | 'illu-move'
      | 'illu-scale'
      | 'decor-move'
      | 'decor-scale'
      | 'constellation-move'
      | FinalLetterDragKind,
    e: React.PointerEvent<HTMLElement>,
  ) => {
    if (!editMode) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.stopPropagation();

    const targetMap = {
      'text-move': 'text',
      'text-resize-right': 'text',
      'text-resize-left': 'text',
      'illu-move': 'illustration',
      'illu-scale': 'illustration',
      'decor-move': 'decor',
      'decor-scale': 'decor',
      'constellation-move': 'constellation',
      'final-text-move': 'text',
      'final-text-resize-right': 'text',
      'final-text-resize-left': 'text',
      'final-card-move': 'card',
      'final-decor-move': 'decor',
      'final-decor-scale': 'decor',
    } as const;
    onSelectTarget?.(targetMap[kind]);

    const stageRect =
      kind === 'constellation-move'
        ? undefined
        : kind.startsWith('final-')
          ? finaleHeaderRef.current?.getBoundingClientRect()
          : storyStageRef.current?.getBoundingClientRect();

    const containerW = Math.max(160, stageRect?.width ?? viewport.width);
    const containerH = Math.max(140, stageRect?.height ?? viewport.height);

    let originX = 0;
    let originY = 0;
    let originValue = 1;

    if (kind === 'text-move' || kind === 'text-resize-right' || kind === 'text-resize-left') {
      originX = starTextStyle.offsetX;
      originY = starTextStyle.offsetY;
      originValue = starTextStyle.widthPct;
    } else if (kind === 'illu-move' || kind === 'illu-scale') {
      originX = illuLayout.offsetX;
      originY = illuLayout.offsetY;
      originValue = illuLayout.scale;
    } else if (kind === 'decor-move' || kind === 'decor-scale') {
      originX = starDecor.xPct;
      originY = starDecor.yPct;
      originValue = starDecor.scale;
    } else if (kind === 'constellation-move') {
      originX = constellationLayout.offsetX;
      originY = constellationLayout.offsetY;
      originValue = constellationLayout.scale;
    } else if (
      kind === 'final-text-move' ||
      kind === 'final-text-resize-right' ||
      kind === 'final-text-resize-left'
    ) {
      originX = finalTextStyle.offsetX;
      originY = finalTextStyle.offsetY;
      originValue = finalTextStyle.widthPct;
    } else if (kind === 'final-card-move') {
      originX = 0;
      originY = cardLayout.offsetY;
      originValue = cardLayout.offsetY;
    } else {
      originX = finalDecor.xPct;
      originY = finalDecor.yPct;
      originValue = finalDecor.scale;
    }

    const inlineTargetEl = (e.target as HTMLElement | null)?.closest(
      '[data-inline-field]',
    ) as HTMLElement | null;
    const pendingInlineField = (inlineTargetEl?.getAttribute('data-inline-field') ??
      undefined) as EditableTextField | undefined;

    e.currentTarget.setPointerCapture(e.pointerId);
    canvasEditDragRef.current = {
      kind,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      containerW,
      containerH,
      originX,
      originY,
      originValue,
      starId: activeStar?.id,
      hasMoved: false,
      pendingInlineField,
    };
  };

  const moveCanvasEdit = (e: React.PointerEvent<HTMLElement>) => {
    const drag = canvasEditDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    e.stopPropagation();

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;

    if (!drag.hasMoved) {
      if (Math.hypot(dx, dy) < 5) {
        return;
      }
      drag.hasMoved = true;
      setActiveInlineField(null);
    }

    if (drag.kind === 'constellation-move') {
      const dxNorm = Math.round((dx / Math.max(140, drag.containerW * 0.42)) * 100);
      const dyNorm = Math.round((-dy / Math.max(140, drag.containerH * 0.42)) * 100);
      onPatchProject?.(
        buildProjectConstellationDevicePatch(project, activeDevice, {
          offsetX: Math.max(-100, Math.min(100, drag.originX + dxNorm)),
          offsetY: Math.max(-100, Math.min(100, drag.originY + dyNorm)),
        }),
      );
      return;
    }

    if (drag.kind === 'final-card-move') {
      const nextY = Math.max(-60, Math.min(60, Math.round(drag.originY + dy / 1.4)));
      onPatchProject?.(
        buildProjectCardDevicePatch(project, activeDevice, { offsetY: nextY }),
      );
      return;
    }

    if (drag.kind === 'final-text-move') {
      let nextWidth = drag.originValue;
      if (Math.abs(dx) > 6 && nextWidth > 90) {
        nextWidth = 84;
      }
      const dxNorm = Math.round((dx / Math.max(60, drag.containerW * 0.35)) * 100);
      const dyNorm = Math.round((dy / Math.max(50, drag.containerH * 0.25)) * 100);
      onPatchProject?.(
        buildProjectFinalTextDevicePatch(project, activeDevice, {
          widthPct: nextWidth,
          offsetX: Math.max(-100, Math.min(100, drag.originX + dxNorm)),
          offsetY: Math.max(-100, Math.min(100, drag.originY + dyNorm)),
        }),
      );
      return;
    }

    if (drag.kind === 'final-text-resize-right' || drag.kind === 'final-text-resize-left') {
      const signedDx = drag.kind === 'final-text-resize-right' ? dx : -dx;
      const dWidthPct = Math.round((signedDx / drag.containerW) * 100);
      const nextWidth = Math.max(56, Math.min(100, drag.originValue + dWidthPct));
      onPatchProject?.(
        buildProjectFinalTextDevicePatch(project, activeDevice, {
          widthPct: nextWidth,
        }),
      );
      return;
    }

    if (drag.kind === 'final-decor-move' || drag.kind === 'final-decor-scale') {
      if (drag.kind === 'final-decor-move') {
        const nextX = Math.max(6, Math.min(94, Math.round(drag.originX + (dx / drag.containerW) * 100)));
        const nextY = Math.max(6, Math.min(88, Math.round(drag.originY + (dy / drag.containerH) * 100)));
        onPatchProject?.(
          buildProjectFinalDecorDevicePatch(project, activeDevice, {
            xPct: nextX,
            yPct: nextY,
          }),
        );
      } else {
        const delta = (dx + dy) / 140;
        const nextScale = Math.max(0.7, Math.min(1.45, Number((drag.originValue + delta).toFixed(2))));
        onPatchProject?.(
          buildProjectFinalDecorDevicePatch(project, activeDevice, {
            scale: nextScale,
          }),
        );
      }
      return;
    }

    const starId = drag.starId;
    if (!starId) return;
    const targetStar = project.stars.find((s) => s.id === starId) ?? activeStar;
    if (!targetStar) return;

    if (drag.kind === 'text-move') {
      let nextWidth = drag.originValue;
      if (Math.abs(dx) > 6 && nextWidth > 90) {
        nextWidth = 84;
      }
      const dxNorm = Math.round((dx / Math.max(60, drag.containerW * 0.35)) * 100);
      const dyNorm = Math.round((dy / Math.max(60, drag.containerH * 0.32)) * 100);
      onPatchStar?.(
        starId,
        buildStarTextDevicePatch(targetStar, activeDevice, {
          widthPct: nextWidth,
          offsetX: Math.max(-100, Math.min(100, drag.originX + dxNorm)),
          offsetY: Math.max(-100, Math.min(100, drag.originY + dyNorm)),
        }),
      );
    } else if (drag.kind === 'text-resize-right' || drag.kind === 'text-resize-left') {
      const signedDx = drag.kind === 'text-resize-right' ? dx : -dx;
      const dWidthPct = Math.round((signedDx / drag.containerW) * 100);
      const nextWidth = Math.max(56, Math.min(100, drag.originValue + dWidthPct));
      onPatchStar?.(
        starId,
        buildStarTextDevicePatch(targetStar, activeDevice, {
          widthPct: nextWidth,
        }),
      );
    } else if (drag.kind === 'illu-move') {
      const dxNorm = Math.round((dx / Math.max(60, drag.containerW * 0.42)) * 100);
      const dyNorm = Math.round((dy / Math.max(60, drag.containerH * 0.34)) * 100);
      onPatchStar?.(
        starId,
        buildStarIllustrationDevicePatch(targetStar, activeDevice, {
          offsetX: Math.max(-100, Math.min(100, drag.originX + dxNorm)),
          offsetY: Math.max(-100, Math.min(100, drag.originY + dyNorm)),
        }),
      );
    } else if (drag.kind === 'illu-scale') {
      const delta = (dx + dy) / 140;
      const nextScale = Math.max(0.65, Math.min(1.45, Number((drag.originValue + delta).toFixed(2))));
      onPatchStar?.(
        starId,
        buildStarIllustrationDevicePatch(targetStar, activeDevice, {
          scale: nextScale,
        }),
      );
    } else if (drag.kind === 'decor-move') {
      const nextX = Math.max(6, Math.min(94, Math.round(drag.originX + (dx / drag.containerW) * 100)));
      const nextY = Math.max(6, Math.min(88, Math.round(drag.originY + (dy / drag.containerH) * 100)));
      onPatchStar?.(
        starId,
        buildStarDecorDevicePatch(targetStar, activeDevice, {
          xPct: nextX,
          yPct: nextY,
        }),
      );
    } else if (drag.kind === 'decor-scale') {
      const delta = (dx + dy) / 140;
      const nextScale = Math.max(0.7, Math.min(1.45, Number((drag.originValue + delta).toFixed(2))));
      onPatchStar?.(
        starId,
        buildStarDecorDevicePatch(targetStar, activeDevice, {
          scale: nextScale,
        }),
      );
    }
  };

  const endCanvasEdit = (e: React.PointerEvent<HTMLElement>) => {
    const drag = canvasEditDragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    canvasEditDragRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }

    if (!drag.hasMoved && drag.pendingInlineField) {
      setActiveInlineField(drag.pendingInlineField);
      onSelectTarget?.('text', drag.pendingInlineField);
    }
  };

  return (
    <div
      data-testid="recipient-view-root"
      data-active-device={activeDevice}
      data-constellation-offset-x={constellationLayout.offsetX}
      data-constellation-offset-y={constellationLayout.offsetY}
      data-constellation-scale={constellationLayout.scale}
      className="relative w-screen gl-h-screen overflow-hidden bg-gl-bg text-gl-text"
    >
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
        constellationLayout={constellationLayout}
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
              ref={storyRightRef}
              onPointerDown={handleStoryPointerDown}
              onPointerMove={handleStoryPointerMove}
              onPointerUp={handleStoryPointerUp}
              onPointerCancel={resetSwipeGesture}
              onLostPointerCapture={resetSwipeGesture}
              onClick={(e) => {
                if (editMode && e.target === e.currentTarget) {
                  onSelectTarget?.(null);
                }
              }}
              style={{ touchAction: editMode ? 'none' : 'pan-y' }}
              className={`relative pointer-events-auto min-h-0 flex flex-col overflow-y-auto overflow-x-hidden ${
                isPortrait
                  ? 'flex-1 px-4 pb-3.5 pt-1 justify-between items-center text-center'
                  : isCompactLandscape
                    ? 'px-5 pr-6 pb-3 pt-1 justify-between items-start text-left'
                    : 'px-6 sm:px-10 lg:pr-12 lg:pl-4 pb-5 pt-2 justify-between items-start text-left'
              }`}
            >
              {/* Animated Story Content inside bounded flex stage (styled by selected CardTheme + device CardLayout) */}
              <div
                ref={storyStageRef}
                data-testid="story-card-stage"
                data-device={activeDevice}
                data-card-width={cardLayout.width}
                data-card-padding={cardLayout.padding}
                onClick={(e) => {
                  if (editMode && e.target === e.currentTarget) {
                    onSelectTarget?.('card');
                  }
                }}
                style={{
                  transform:
                    dragOffsetX !== 0 || storyCardOffsetY !== 0
                      ? `translate3d(${dragOffsetX}px, ${storyCardOffsetY}px, 0)`
                      : undefined,
                  transition:
                    dragOffsetX === 0 ? 'transform 220ms ease-out' : undefined,
                  ...(hasExplicitCardTheme
                    ? {
                        background: cardColors.isLightPaper
                          ? `linear-gradient(155deg, ${cardColors.surfaceBg}F5 0%, ${cardColors.surfaceBgAlt}F2 100%)`
                          : `linear-gradient(155deg, ${cardColors.surfaceBg}CC 0%, ${cardColors.surfaceBgAlt}C4 100%)`,
                        borderColor: `${cardColors.borderColor}70`,
                        boxShadow: cardColors.isLightPaper
                          ? '0 20px 50px rgba(4, 7, 20, 0.45)'
                          : `0 18px 46px rgba(4, 7, 20, 0.52), 0 0 32px ${cardColors.accentColor}1E`,
                      }
                    : {}),
                }}
                className={`relative z-10 flex-1 min-h-0 w-full ${storyWidthClass} flex flex-col overflow-hidden ${
                  isPortrait ? 'mx-auto' : ''
                } ${
                  hasExplicitCardTheme
                    ? `rounded-[24px] border ${storyCardPaddingClass} ${
                        cardColors.isLightPaper ? '' : 'backdrop-blur-md'
                      }`
                    : storyCardPaddingClass
                } ${
                  editMode && selectedTarget === 'card'
                    ? 'ring-2 ring-amber-400/80 rounded-[24px]'
                    : ''
                }`}
              >
                {/* Theme inner pattern texture inside card sheet */}
                {hasExplicitCardTheme && cardTheme.paperPattern === 'paper' && (
                  <div
                    className="pointer-events-none absolute inset-2 rounded-[18px] border"
                    style={{ borderColor: `${cardColors.accentColor}38` }}
                    aria-hidden="true"
                  />
                )}
                {hasExplicitCardTheme && cardTheme.paperPattern === 'botanical' && (
                  <div
                    className="pointer-events-none absolute inset-2 rounded-[18px] border border-dashed"
                    style={{ borderColor: `${cardColors.accentColor}48` }}
                    aria-hidden="true"
                  />
                )}
                {hasExplicitCardTheme && cardTheme.paperPattern === 'stars' && (
                  <div
                    className="pointer-events-none absolute inset-0 opacity-40"
                    style={{
                      backgroundImage: `radial-gradient(${cardColors.accentColor}66 1px, transparent 1px)`,
                      backgroundSize: '26px 26px',
                    }}
                    aria-hidden="true"
                  />
                )}

                {/* Optional Card Decorative Ornament (positioned freely in safe card area) */}
                {starDecor.motif !== 'none' && (
                  <div
                    data-testid="story-card-decor"
                    data-selected={editMode && selectedTarget === 'decor'}
                    onPointerDown={editMode ? (e) => beginCanvasEdit('decor-move', e) : undefined}
                    onPointerMove={editMode ? moveCanvasEdit : undefined}
                    onPointerUp={editMode ? endCanvasEdit : undefined}
                    onPointerCancel={editMode ? endCanvasEdit : undefined}
                    onClick={
                      editMode
                        ? (e) => {
                            e.stopPropagation();
                            onSelectTarget?.('decor');
                          }
                        : undefined
                    }
                    style={{
                      left: `${starDecor.xPct}%`,
                      top: `${starDecor.yPct}%`,
                      transform: `translate(-50%, -50%) scale(${starDecor.scale})`,
                    }}
                    className={`absolute ${
                      editMode
                        ? `z-30 cursor-grab active:cursor-grabbing touch-none rounded-2xl p-1 transition-[box-shadow,background-color] ${
                            selectedTarget === 'decor'
                              ? 'ring-2 ring-amber-400 bg-amber-500/15'
                              : 'ring-1 ring-dashed ring-current/30 hover:ring-amber-400/75'
                          }`
                        : 'z-0 pointer-events-none opacity-75'
                    }`}
                  >
                    <CardDecorView
                      motif={starDecor.motif}
                      glowHex={storyDecorGlowHex}
                      coreHex={storyDecorCoreHex}
                      className={isPortrait ? 'w-20 h-20' : 'w-24 h-24 sm:w-28 sm:h-28'}
                    />
                    {editMode && selectedTarget === 'decor' && (
                      <button
                        type="button"
                        data-testid="decor-scale-handle"
                        aria-label="Изменить размер декора"
                        onPointerDown={(e) => beginCanvasEdit('decor-scale', e)}
                        onPointerMove={moveCanvasEdit}
                        onPointerUp={endCanvasEdit}
                        onPointerCancel={endCanvasEdit}
                        className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-400 border-2 border-white cursor-nwse-resize touch-none shadow"
                      />
                    )}
                  </div>
                )}

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
                    className="relative z-10 flex-1 min-h-0 w-full flex flex-col overflow-y-auto overscroll-contain"
                  >
                    <div style={{ flexGrow: topOuterGrow, flexBasis: 0 }} />

                    {/* Borderless Floating Illustration with Safe Horizontal Positioning & Scale */}
                    <div className="w-full flex items-center shrink-0">
                      <div style={{ flexGrow: illuLeftGrow, flexBasis: 0 }} />
                      <div
                        data-testid="story-illustration-box"
                        data-selected={editMode && selectedTarget === 'illustration'}
                        onPointerDown={editMode ? (e) => beginCanvasEdit('illu-move', e) : undefined}
                        onPointerMove={editMode ? moveCanvasEdit : undefined}
                        onPointerUp={editMode ? endCanvasEdit : undefined}
                        onPointerCancel={editMode ? endCanvasEdit : undefined}
                        onClick={
                          editMode
                            ? (e) => {
                                e.stopPropagation();
                                onSelectTarget?.('illustration');
                              }
                            : undefined
                        }
                        className={`relative shrink-0 flex items-center justify-center py-0.5 ${
                          editMode
                            ? `cursor-grab active:cursor-grabbing touch-none rounded-2xl p-1.5 transition-[box-shadow,background-color] ${
                                selectedTarget === 'illustration'
                                  ? 'ring-2 ring-sky-400 bg-sky-500/10'
                                  : 'ring-1 ring-dashed ring-white/25 hover:ring-sky-400/75'
                              }`
                            : ''
                        }`}
                      >
                        <div
                          className="pointer-events-none absolute inset-0 -m-5 rounded-full opacity-55"
                          style={{
                            background: `radial-gradient(circle, ${activeStarGlow.hex}36 0%, transparent 70%)`,
                          }}
                          aria-hidden="true"
                        />
                        <div
                          style={{
                            width: `${effectiveIlluPx}px`,
                            height: `${effectiveIlluPx}px`,
                            maxWidth: '100%',
                          }}
                          className="relative flex items-center justify-center"
                        >
                          <StarIllustrationView
                            illustration={activeStar.illustration}
                            imageSettings={activeStar.imageSettings}
                            alt={activeStar.title || `Звезда ${activeIndex + 1}`}
                            className="w-full h-full relative object-contain drop-shadow-[0_14px_34px_rgba(0,0,0,0.45)]"
                          />
                        </div>
                        {editMode && selectedTarget === 'illustration' && (
                          <button
                            type="button"
                            data-testid="illu-scale-handle"
                            aria-label="Изменить масштаб иллюстрации"
                            onPointerDown={(e) => beginCanvasEdit('illu-scale', e)}
                            onPointerMove={moveCanvasEdit}
                            onPointerUp={endCanvasEdit}
                            onPointerCancel={endCanvasEdit}
                            className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full bg-sky-400 border-2 border-white cursor-nwse-resize touch-none shadow"
                          />
                        )}
                      </div>
                      <div style={{ flexGrow: illuRightGrow, flexBasis: 0 }} />
                    </div>

                    <div style={{ flexGrow: topInnerGrow, flexBasis: 0 }} />

                    {/* Bounded Customizable Message Block */}
                    <div
                      data-testid="story-text-block"
                      data-selected={editMode && selectedTarget === 'text'}
                      onPointerDown={
                        editMode
                          ? (e) => {
                              if ((e.target as HTMLElement).closest('input, textarea')) return;
                              beginCanvasEdit('text-move', e);
                            }
                          : undefined
                      }
                      onPointerMove={editMode ? moveCanvasEdit : undefined}
                      onPointerUp={editMode ? endCanvasEdit : undefined}
                      onPointerCancel={editMode ? endCanvasEdit : undefined}
                      onClick={
                        editMode
                          ? (e) => {
                              if ((e.target as HTMLElement).closest('input, textarea')) return;
                              e.stopPropagation();
                              onSelectTarget?.('text');
                            }
                          : undefined
                      }
                      style={{
                        width: `${starTextStyle.widthPct}%`,
                        marginLeft: `${textMarginLeftPct}%`,
                        textAlign: effectiveAlign,
                        fontFamily: starFontMeta.cssFamily,
                        borderColor:
                          starTextStyle.accent === 'frame'
                            ? `${cardColors.isLightPaper ? cardColors.accentColor : activeStarGlow.hex}44`
                            : starTextStyle.accent === 'quote'
                              ? cardColors.isLightPaper
                                ? cardColors.accentColor
                                : activeStarGlow.hex
                              : undefined,
                        backgroundColor:
                          starTextStyle.accent === 'frame'
                            ? cardColors.isLightPaper
                              ? 'rgba(255,255,255,0.62)'
                              : 'rgba(7,11,26,0.62)'
                            : undefined,
                      }}
                      className={`relative shrink-0 max-w-full space-y-2 ${
                        starTextStyle.accent === 'frame'
                          ? 'rounded-2xl border backdrop-blur-md px-4 py-3.5 sm:px-5 sm:py-4 shadow-xl'
                          : starTextStyle.accent === 'quote'
                            ? effectiveAlign === 'right'
                              ? 'border-r-2 pr-3.5 py-0.5'
                              : 'border-l-2 pl-3.5 py-0.5'
                            : ''
                      } ${
                        editMode
                          ? `cursor-grab active:cursor-grabbing touch-none rounded-xl transition-[box-shadow] ${
                              selectedTarget === 'text'
                                ? 'ring-2 ring-violet-400 ring-offset-2 ring-offset-transparent'
                                : 'ring-1 ring-dashed ring-current/25 hover:ring-violet-400/75'
                            }`
                          : ''
                      }`}
                    >
                      {editMode && selectedTarget === 'text' && (
                        <>
                          <button
                            type="button"
                            data-testid="text-resize-left"
                            aria-label="Изменить ширину текста слева"
                            onPointerDown={(e) => beginCanvasEdit('text-resize-left', e)}
                            onPointerMove={moveCanvasEdit}
                            onPointerUp={endCanvasEdit}
                            onPointerCancel={endCanvasEdit}
                            className="absolute top-1/2 -left-2 -translate-y-1/2 w-3.5 h-8 rounded-full bg-violet-500 border-2 border-white cursor-ew-resize touch-none shadow z-20"
                          />
                          <button
                            type="button"
                            data-testid="text-resize-right"
                            aria-label="Изменить ширину текста справа"
                            onPointerDown={(e) => beginCanvasEdit('text-resize-right', e)}
                            onPointerMove={moveCanvasEdit}
                            onPointerUp={endCanvasEdit}
                            onPointerCancel={endCanvasEdit}
                            className="absolute top-1/2 -right-2 -translate-y-1/2 w-3.5 h-8 rounded-full bg-violet-500 border-2 border-white cursor-ew-resize touch-none shadow z-20"
                          />
                        </>
                      )}

                      {starTextStyle.accent === 'line' && (
                        <div
                          className="h-0.5 w-16 rounded-full"
                          style={{
                            background: cardColors.isLightPaper
                              ? `linear-gradient(90deg, ${cardColors.accentColor}, ${cardColors.badgeColor})`
                              : `linear-gradient(90deg, ${activeStarGlow.hex}, ${activeStarGlow.coreHex})`,
                            marginLeft: effectiveAlign === 'left' ? 0 : 'auto',
                            marginRight: effectiveAlign === 'center' ? 'auto' : 0,
                          }}
                        />
                      )}

                      {/* Star Ordinal & Title */}
                      <div className="space-y-1 w-full">
                        <p
                          className="text-xs sm:text-sm font-medium tracking-wide tabular-nums"
                          style={{
                            color: cardColors.isLightPaper
                              ? cardColors.badgeColor
                              : activeStarGlow.coreHex,
                          }}
                        >
                          Звезда {activeIndex + 1} из {totalStars}
                        </p>
                        {editMode && activeInlineField === 'starTitle' ? (
                          <input
                            ref={storyInlineInputRef}
                            type="text"
                            maxLength={30}
                            value={activeStar.title}
                            placeholder={`Звезда ${activeIndex + 1}`}
                            data-testid="inline-edit-starTitle"
                            onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) =>
                              onPatchStar?.(activeStar.id, {
                                title: e.target.value,
                                isDraft: false,
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === 'Escape') {
                                e.preventDefault();
                                setActiveInlineField(null);
                              }
                            }}
                            onBlur={() => setActiveInlineField(null)}
                            style={{
                              fontFamily: starFontMeta.cssFamily,
                              fontSize: `${effectiveTitlePx}px`,
                              fontWeight: 600,
                              lineHeight: Math.min(
                                1.4,
                                Math.max(1.12, Number((starTextStyle.lineHeight * 0.78).toFixed(2))),
                              ),
                              color: effectiveStarTextColor,
                              textShadow: resolvedTextShadow,
                              textAlign: effectiveAlign,
                              borderColor: `${cardColors.accentColor}88`,
                            }}
                            className="w-full rounded-xl border bg-black/20 px-2.5 py-1 outline-none"
                          />
                        ) : (
                          <h2
                            data-selectable-text={editMode ? undefined : 'true'}
                            data-inline-field={editMode ? 'starTitle' : undefined}
                            data-testid="card-text-starTitle"
                            title={editMode ? 'Нажми, чтобы изменить название звезды' : undefined}
                            style={{
                              fontFamily: starFontMeta.cssFamily,
                              fontSize: `${effectiveTitlePx}px`,
                              fontWeight: 600,
                              lineHeight: Math.min(
                                1.4,
                                Math.max(1.12, Number((starTextStyle.lineHeight * 0.78).toFixed(2))),
                              ),
                              color: effectiveStarTextColor,
                              textShadow: resolvedTextShadow,
                            }}
                            className={`leading-tight [text-wrap:balance] break-words [overflow-wrap:anywhere] ${
                              editMode
                                ? 'select-none cursor-text rounded-lg px-1 -mx-1 hover:bg-black/10 transition-colors'
                                : 'select-text'
                            }`}
                          >
                            {activeStar.title || `Звезда ${activeIndex + 1}`}
                          </h2>
                        )}
                      </div>

                      {/* Personal Wish Message */}
                      {editMode && activeInlineField === 'starMessage' ? (
                        <textarea
                          ref={storyInlineTextareaRef}
                          rows={4}
                          maxLength={180}
                          value={activeStar.message}
                          placeholder="Напиши пожелание для этой звезды..."
                          data-testid="inline-edit-starMessage"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            onPatchStar?.(activeStar.id, {
                              message: e.target.value,
                              isDraft: false,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              e.preventDefault();
                              setActiveInlineField(null);
                            }
                          }}
                          onBlur={() => setActiveInlineField(null)}
                          style={{
                            fontFamily: starFontMeta.cssFamily,
                            fontSize: `${effectiveBodyPx}px`,
                            fontWeight: starTextStyle.fontWeight === 'semibold' ? 600 : 400,
                            lineHeight: starTextStyle.lineHeight,
                            color: effectiveStarTextColor,
                            textShadow: resolvedTextShadow,
                            textAlign: effectiveAlign,
                            borderColor: `${cardColors.accentColor}88`,
                          }}
                          className="w-full rounded-xl border bg-black/20 px-2.5 py-1.5 outline-none resize-y"
                        />
                      ) : (
                        <p
                          data-selectable-text={editMode ? undefined : 'true'}
                          data-inline-field={editMode ? 'starMessage' : undefined}
                          data-testid="card-text-starMessage"
                          title={editMode ? 'Нажми, чтобы изменить текст звезды' : undefined}
                          style={{
                            fontFamily: starFontMeta.cssFamily,
                            fontSize: `${effectiveBodyPx}px`,
                            fontWeight: starTextStyle.fontWeight === 'semibold' ? 600 : 400,
                            lineHeight: starTextStyle.lineHeight,
                            color: effectiveStarTextColor,
                            textShadow: resolvedTextShadow,
                          }}
                          className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${
                            editMode
                              ? 'select-none cursor-text rounded-lg px-1 -mx-1 hover:bg-black/10 transition-colors'
                              : 'select-text'
                          }`}
                        >
                          {activeStar.message || 'Здесь хранится особое тёплое пожелание.'}
                        </p>
                      )}

                      {/* Signature Attribution */}
                      {editMode && activeInlineField === 'senderName' ? (
                        <input
                          ref={storyInlineInputRef}
                          type="text"
                          maxLength={40}
                          value={project.senderName ?? ''}
                          placeholder="Твоё имя"
                          data-testid="inline-edit-senderName"
                          onPointerDown={(e) => e.stopPropagation()}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            onPatchProject?.({ senderName: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'Escape') {
                              e.preventDefault();
                              setActiveInlineField(null);
                            }
                          }}
                          onBlur={() => setActiveInlineField(null)}
                          style={{
                            color: effectiveStarTextColor,
                            textShadow: resolvedTextShadow,
                            textAlign: effectiveAlign,
                            borderColor: `${cardColors.accentColor}88`,
                          }}
                          className="w-48 max-w-full rounded-lg border bg-black/20 px-2 py-0.5 text-xs sm:text-sm italic outline-none"
                        />
                      ) : (signatureText || editMode) ? (
                        <p
                          data-selectable-text={editMode ? undefined : 'true'}
                          data-inline-field={editMode ? 'senderName' : undefined}
                          data-testid="card-text-senderName"
                          title={editMode ? 'Нажми, чтобы изменить подпись' : undefined}
                          style={{
                            color: effectiveStarTextColor,
                            opacity: signatureText ? 0.78 : 0.5,
                            textShadow: resolvedTextShadow,
                          }}
                          className={`text-xs sm:text-sm italic tracking-wide ${
                            editMode
                              ? 'select-none cursor-text rounded-lg px-1 -mx-1 hover:bg-black/10 transition-colors inline-flex items-center gap-1'
                              : 'select-text'
                          }`}
                        >
                          {signatureText ? (
                            `— ${signatureText}`
                          ) : (
                            <>
                              <Pencil className="w-3 h-3 opacity-70" />
                              <span>— Добавить подпись</span>
                            </>
                          )}
                        </p>
                      ) : null}
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

      {/* PHASE 5: Final Rotating 3D Constellation + Emerging Paper Letter */}
      {phase === 'constellation' && (
        <>
          {onExitPreview && (
            <div className="pointer-events-auto fixed top-4 left-4 sm:top-5 sm:left-6 z-30 gl-safe-top">
              <button
                type="button"
                onClick={onExitPreview}
                className="gl-btn-secondary !bg-gl-panel/85 hover:!bg-gl-card text-gl-text !px-3 !py-2 text-xs shadow-lg"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                В редактор
              </button>
            </div>
          )}

          {/* Direct drag & scale sky surface when editing Constellation layout in editMode */}
          {editMode && selectedTarget === 'constellation' && (
            <div
              data-testid="constellation-layout-overlay"
              onPointerDown={(e) => beginCanvasEdit('constellation-move', e)}
              onPointerMove={moveCanvasEdit}
              onPointerUp={endCanvasEdit}
              onPointerCancel={endCanvasEdit}
              onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY < 0 ? 0.06 : -0.06;
                const nextScale = Math.max(
                  0.55,
                  Math.min(1.45, Number((constellationLayout.scale + delta).toFixed(2))),
                );
                onPatchProject?.(
                  buildProjectConstellationDevicePatch(project, activeDevice, {
                    scale: nextScale,
                  }),
                );
              }}
              className="fixed inset-x-0 top-0 bottom-20 z-20 cursor-grab active:cursor-grabbing touch-none flex flex-col items-center justify-between pt-4 pb-3 px-4"
            >
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="gl-hud px-3.5 py-2 flex items-center gap-2.5 text-xs text-gl-text shadow-xl max-w-[92vw]"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span className="truncate">
                  Перетаскивай созвездие по небу
                </span>
                <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-white/15">
                  <button
                    type="button"
                    aria-label="Уменьшить созвездие"
                    onClick={() =>
                      onPatchProject?.(
                        buildProjectConstellationDevicePatch(project, activeDevice, {
                          scale: Math.max(
                            0.55,
                            Number((constellationLayout.scale - 0.08).toFixed(2)),
                          ),
                        }),
                      )
                    }
                    className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center justify-center cursor-pointer"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    aria-label="Увеличить созвездие"
                    onClick={() =>
                      onPatchProject?.(
                        buildProjectConstellationDevicePatch(project, activeDevice, {
                          scale: Math.min(
                            1.45,
                            Number((constellationLayout.scale + 0.08).toFixed(2)),
                          ),
                        }),
                      )
                    }
                    className="w-6 h-6 rounded-md bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onPatchProject?.(
                        buildProjectConstellationDevicePatch(project, activeDevice, {
                          offsetX: 0,
                          offsetY: activeDevice === 'phone' ? 8 : 0,
                          scale: activeDevice === 'phone' ? 0.78 : 1,
                        }),
                      )
                    }
                    className="px-2 py-1 rounded-md bg-white/10 hover:bg-white/20 text-[11px] font-medium cursor-pointer"
                  >
                    По центру
                  </button>
                </div>
              </div>
            </div>
          )}

          <FinalLetterCard
            project={project}
            deviceMode={activeDevice}
            signatureText={signatureText}
            isPortrait={isPortrait}
            isCompactLandscape={isCompactLandscape}
            reducedMotion={reducedMotion}
            isOpen={letterOpen && !(editMode && selectedTarget === 'constellation')}
            onClose={() => setLetterOpen(false)}
            editMode={editMode}
            selectedTarget={selectedTarget}
            activeInlineField={activeInlineField}
            onSelectTarget={(target, field) => {
              if (field) setActiveInlineField(field);
              onSelectTarget?.(target, field);
            }}
            onCloseInlineEdit={() => setActiveInlineField(null)}
            onPatchProject={onPatchProject}
            letterContainerRef={finaleHeaderRef}
            onBeginElementDrag={beginCanvasEdit}
            onMoveElementDrag={moveCanvasEdit}
            onEndElementDrag={endCanvasEdit}
          />

          {/* Compact Interactive Bottom Dock */}
          <div className="gl-hud fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex flex-wrap items-center justify-center gap-2 !rounded-2xl px-3 py-2 max-w-[95vw] mb-[env(safe-area-inset-bottom,0px)]">
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
              onClick={() => setLetterOpen((v) => !v)}
              data-testid="toggle-final-letter-btn"
              className={`gl-btn-secondary !px-3 !py-1.5 text-xs ${
                letterOpen
                  ? '!bg-amber-500/20 !border-amber-300/45 text-amber-100'
                  : '!bg-gl-accent/35 !border-gl-accent-light/55 text-gl-text'
              }`}
            >
              <MailOpen className="w-3.5 h-3.5" />
              {letterOpen ? 'Скрыть письмо' : 'Открыть письмо'}
            </button>

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
