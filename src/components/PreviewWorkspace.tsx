import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  CopyCheck,
  Eye,
  Image as ImageIcon,
  Maximize,
  Minimize,
  Monitor,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Type,
} from 'lucide-react';
import type {
  EditableCardTarget,
  IframeToParentMessage,
  ParentToIframeMessage,
  PreviewJumpTarget,
} from '../preview/previewProtocol';
import {
  CARD_DECOR_MOTIFS,
  DEFAULT_STAR_IMAGE_SETTINGS,
  GLOW_COLORS,
  MESSAGE_FONTS,
  MESSAGE_FONT_CATEGORIES,
  MESSAGE_TEXT_COLORS,
  isDefaultStarTextStyle,
  resolveStarDecor,
  resolveStarGlowHex,
  resolveStarIllustrationLayout,
  resolveStarImageSettings,
  resolveStarTextStyle,
} from '../scene/paletteConfig';
import type {
  CardDecorMotif,
  ConstellationProject,
  ConstellationStar,
  MessageTextAccent,
  MessageTextAlign,
  MessageTextShadow,
  MessageTextWeight,
  RecipientPhase,
  StarDecorSettings,
  StarIllustrationLayout,
  StarImageFitMode,
  StarImageSettings,
  StarTextStyle,
} from '../types/project';
import { CardDecorView } from './CardDecorView';

export type PreviewDeviceId = 'phone' | 'desktop';
export type PreviewMode = 'view' | 'edit';

interface DevicePreset {
  id: PreviewDeviceId;
  label: string;
  width: number;
  height: number;
}

const DEVICE_PRESETS: Record<PreviewDeviceId, DevicePreset> = {
  phone: {
    id: 'phone',
    label: 'Телефон',
    width: 390,
    height: 844,
  },
  desktop: {
    id: 'desktop',
    label: 'Компьютер',
    width: 1280,
    height: 720,
  },
};

export type PreviewProjectMap = Map<string, ConstellationProject>;

declare global {
  interface Window {
    __GIFTLAB_PREVIEW_PROJECTS__?: PreviewProjectMap;
  }
}

export function getPreviewProjectRegistry(): PreviewProjectMap {
  if (!window.__GIFTLAB_PREVIEW_PROJECTS__) {
    window.__GIFTLAB_PREVIEW_PROJECTS__ = new Map();
  }
  return window.__GIFTLAB_PREVIEW_PROJECTS__;
}

function cloneProjectReadonly(project: ConstellationProject): ConstellationProject {
  if (typeof structuredClone === 'function') {
    return structuredClone(project);
  }
  return JSON.parse(JSON.stringify(project)) as ConstellationProject;
}

interface PreviewWorkspaceProps {
  project: ConstellationProject;
  saveState?: 'saved' | 'saving';
  returnLabel: string;
  onUpdateProject?: (updater: (prev: ConstellationProject) => ConstellationProject) => void;
  onExitPreview: () => void;
}

export function PreviewWorkspace({
  project,
  saveState = 'saved',
  returnLabel,
  onUpdateProject,
  onExitPreview,
}: PreviewWorkspaceProps) {
  const reactId = useId();
  const previewKey = useMemo(
    () => `preview_${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}_${Date.now().toString(36)}`,
    [reactId],
  );

  const [device, setDevice] = useState<PreviewDeviceId>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'phone' : 'desktop',
  );
  const [mode, setMode] = useState<PreviewMode>('view');
  const [selectedTarget, setSelectedTarget] = useState<EditableCardTarget | null>('text');
  const [iframePhase, setIframePhase] = useState<RecipientPhase>('sealed');
  const [iframeStarIndex, setIframeStarIndex] = useState<number>(0);
  const [jumpTo, setJumpTo] = useState<PreviewJumpTarget | null>(null);
  const [appliedAllNotice, setAppliedAllNotice] = useState(false);

  const [sessionKey, setSessionKey] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [stageSize, setStageSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? Math.max(320, window.innerHeight - 56) : 720,
  }));

  // Isolated deep-cloned snapshot passed to the preview iframe so simple viewing never mutates real project state
  const snapshot = useMemo(() => cloneProjectReadonly(project), [project]);
  getPreviewProjectRegistry().set(previewKey, snapshot);

  useEffect(() => {
    const registry = getPreviewProjectRegistry();
    registry.set(previewKey, snapshot);
    return () => {
      registry.delete(previewKey);
    };
  }, [previewKey, snapshot]);

  const sendSyncToIframe = useCallback(
    (nextJump?: PreviewJumpTarget | null) => {
      const win = iframeRef.current?.contentWindow;
      if (!win) return;
      const msg: ParentToIframeMessage = {
        source: 'giftlab-preview-host',
        type: 'sync',
        project: snapshot,
        editMode: mode === 'edit',
        selectedTarget: mode === 'edit' ? selectedTarget : null,
        jumpTo: nextJump ?? jumpTo,
      };
      win.postMessage(msg, window.location.origin);
    },
    [snapshot, mode, selectedTarget, jumpTo],
  );

  useEffect(() => {
    if (iframeLoaded) {
      sendSyncToIframe();
    }
  }, [iframeLoaded, sendSyncToIframe]);

  const patchStarInProject = useCallback(
    (starId: string, patch: Partial<ConstellationStar>) => {
      if (!onUpdateProject) return;
      onUpdateProject((prev) => ({
        ...prev,
        stars: prev.stars.map((s) => (s.id === starId ? { ...s, ...patch } : s)),
      }));
    },
    [onUpdateProject],
  );

  const patchProjectRoot = useCallback(
    (patch: Partial<ConstellationProject>) => {
      if (!onUpdateProject) return;
      onUpdateProject((prev) => ({ ...prev, ...patch }));
    },
    [onUpdateProject],
  );

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as IframeToParentMessage | undefined;
      if (!data || data.source !== 'giftlab-preview-iframe') return;

      if (data.type === 'ready') {
        setIframeLoaded(true);
        setIframePhase(data.phase);
        setIframeStarIndex(data.activeIndex);
        sendSyncToIframe();
      } else if (data.type === 'state') {
        setIframePhase(data.phase);
        setIframeStarIndex(data.activeIndex);
      } else if (data.type === 'selectTarget') {
        setSelectedTarget(data.target);
      } else if (data.type === 'patchStar') {
        patchStarInProject(data.starId, data.patch);
      } else if (data.type === 'patchProject') {
        patchProjectRoot(data.patch);
      }
    };

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [patchProjectRoot, patchStarInProject, sendSyncToIframe]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const updateSize = () => {
      setStageSize({
        width: el.clientWidth,
        height: el.clientHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    window.addEventListener('resize', updateSize);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, [mode]);

  const iframeSrc = useMemo(() => {
    if (typeof window === 'undefined') return '?giftlabPreview=1';
    const url = new URL(window.location.href);
    url.searchParams.set('giftlabPreview', '1');
    url.searchParams.set('previewKey', previewKey);
    url.searchParams.set('projectId', project.id);
    url.hash = '';
    return url.toString();
  }, [previewKey, project.id]);

  const preset = DEVICE_PRESETS[device];
  const isCompactHost = stageSize.width < 640;
  const stageMargin = isCompactHost ? 16 : 32;
  const bezelAllowance = isCompactHost ? 12 : 16;

  const availW = Math.max(120, stageSize.width - stageMargin - bezelAllowance);
  const availH = Math.max(120, stageSize.height - stageMargin - bezelAllowance);
  const scale = Math.max(0.2, Math.min(1, availW / preset.width, availH / preset.height));
  const scaledW = Math.floor(preset.width * scale);
  const scaledH = Math.floor(preset.height * scale);

  const issueJump = (targetPhase: 'sealed' | 'starStory' | 'constellation', starIndex?: number) => {
    const next: PreviewJumpTarget = {
      nonce: Date.now() + Math.random(),
      phase: targetPhase,
      starIndex,
    };
    setJumpTo(next);
    if (iframeLoaded) {
      sendSyncToIframe(next);
    }
  };

  const handleSwitchMode = (nextMode: PreviewMode) => {
    setMode(nextMode);
    if (nextMode === 'edit') {
      if (iframePhase === 'sealed' || iframePhase === 'birthing') {
        issueJump('starStory', 0);
      } else if (iframePhase === 'finalReveal') {
        issueJump('constellation');
      }
      if (!selectedTarget) setSelectedTarget('text');
    }
  };

  const handleRestartScenario = () => {
    setIframeLoaded(false);
    setJumpTo(null);
    setSessionKey((k) => k + 1);
  };

  // Active card resolution for Edit Mode inspector
  const isFinaleCard = iframePhase === 'constellation' || iframePhase === 'finalReveal';
  const activeStar = project.stars[iframeStarIndex] ?? project.stars[0];
  const activeGlow = isFinaleCard
    ? GLOW_COLORS[project.globalGlowColor]
    : activeStar
      ? GLOW_COLORS[resolveStarGlowHex(activeStar, project.globalGlowColor)]
      : GLOW_COLORS[project.globalGlowColor];

  const activeTextStyle = isFinaleCard
    ? resolveStarTextStyle(project.finalTextStyle)
    : resolveStarTextStyle(activeStar);
  const isDefaultText = isDefaultStarTextStyle(activeTextStyle);

  const defaultIlluOffsetX = device === 'phone' ? 0 : -100;
  const activeIlluLayout = resolveStarIllustrationLayout(activeStar, defaultIlluOffsetX);
  const activeImgSettings = resolveStarImageSettings(activeStar);
  const activeDecor = isFinaleCard
    ? resolveStarDecor(project.finalDecor)
    : resolveStarDecor(activeStar);

  const updateActiveTextStyle = (patch: Partial<StarTextStyle>) => {
    const next = resolveStarTextStyle({ ...activeTextStyle, ...patch });
    if (isFinaleCard) {
      patchProjectRoot({ finalTextStyle: next });
    } else if (activeStar) {
      patchStarInProject(activeStar.id, { textStyle: next });
    }
  };

  const resetActiveTextStyle = () => {
    if (isFinaleCard) {
      patchProjectRoot({ finalTextStyle: undefined });
    } else if (activeStar) {
      patchStarInProject(activeStar.id, { textStyle: undefined });
    }
  };

  const applyActiveTextStyleToAll = () => {
    if (!onUpdateProject) return;
    onUpdateProject((prev) => ({
      ...prev,
      stars: prev.stars.map((s) => ({
        ...s,
        textStyle: { ...activeTextStyle },
      })),
    }));
    setAppliedAllNotice(true);
    window.setTimeout(() => setAppliedAllNotice(false), 1500);
  };

  const updateActiveIllustrationLayout = (patch: Partial<StarIllustrationLayout>) => {
    if (!activeStar || isFinaleCard) return;
    const next = resolveStarIllustrationLayout({ ...activeIlluLayout, ...patch });
    patchStarInProject(activeStar.id, { illustrationLayout: next });
  };

  const updateActiveImageSettings = (patch: Partial<StarImageSettings>) => {
    if (!activeStar || isFinaleCard) return;
    const next = resolveStarImageSettings({
      imageSettings: { ...activeImgSettings, ...patch },
    });
    patchStarInProject(activeStar.id, { imageSettings: next });
  };

  const resetActiveIllustration = () => {
    if (!activeStar || isFinaleCard) return;
    patchStarInProject(activeStar.id, {
      illustrationLayout: undefined,
      imageSettings: { ...DEFAULT_STAR_IMAGE_SETTINGS },
    });
  };

  const updateActiveDecor = (patch: Partial<StarDecorSettings>) => {
    const next = resolveStarDecor({ ...activeDecor, ...patch });
    if (isFinaleCard) {
      patchProjectRoot({ finalDecor: next });
    } else if (activeStar) {
      patchStarInProject(activeStar.id, { decor: next });
    }
  };

  const resetActiveDecor = () => {
    if (isFinaleCard) {
      patchProjectRoot({ finalDecor: undefined });
    } else if (activeStar) {
      patchStarInProject(activeStar.id, { decor: undefined });
    }
  };

  const effectiveLayerTab: EditableCardTarget =
    isFinaleCard && selectedTarget === 'illustration'
      ? 'text'
      : selectedTarget ?? 'text';

  return (
    <div className="gl-h-screen w-screen overflow-hidden bg-[#050814] text-gl-text flex flex-col">
      {/* Top Preview Control Bar */}
      <header className="relative z-20 min-h-14 shrink-0 border-b gl-panel gl-safe-top px-3 sm:px-5 py-1.5 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
        {/* Left Zone: Return to Editor + Project Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onExitPreview}
            className="gl-btn-secondary !px-2.5 sm:!px-3 !py-1.5 text-xs text-gl-text shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            <span>{returnLabel}</span>
          </button>

          <span className="hidden xl:block text-sm font-medium text-gl-text-secondary truncate max-w-[180px]">
            {project.title || 'Предпросмотр подарка'}
          </span>
        </div>

        {/* Center Zone: Mode Switcher (Просмотр / Оформление) + Device Switcher (Телефон / Компьютер) */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <div
            role="group"
            aria-label="Режим предпросмотра"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-gl-input border border-white/10 shrink-0"
          >
            <button
              type="button"
              onClick={() => handleSwitchMode('view')}
              aria-pressed={mode === 'view'}
              data-selected={mode === 'view'}
              className="gl-tab !min-h-[34px] !px-2.5 sm:!px-3 inline-flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5 shrink-0" />
              <span>Просмотр</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchMode('edit')}
              aria-pressed={mode === 'edit'}
              data-selected={mode === 'edit'}
              className="gl-tab !min-h-[34px] !px-2.5 sm:!px-3 inline-flex items-center gap-1.5"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span>Оформление</span>
            </button>
          </div>

          <div
            role="group"
            aria-label="Выбор устройства для предпросмотра"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-gl-input border border-white/10 shrink-0"
          >
            <button
              type="button"
              onClick={() => {
                setDevice('phone');
                iframeRef.current?.focus();
              }}
              aria-pressed={device === 'phone'}
              data-selected={device === 'phone'}
              className="gl-tab !min-h-[34px] !px-2.5 sm:!px-3 inline-flex items-center gap-1.5"
            >
              <Smartphone className="w-3.5 h-3.5 shrink-0" />
              <span>Телефон</span>
              <span className="hidden md:inline text-[11px] opacity-80 tabular-nums">
                390×844
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setDevice('desktop');
                iframeRef.current?.focus();
              }}
              aria-pressed={device === 'desktop'}
              data-selected={device === 'desktop'}
              className="gl-tab !min-h-[34px] !px-2.5 sm:!px-3 inline-flex items-center gap-1.5"
            >
              <Monitor className="w-3.5 h-3.5 shrink-0" />
              <span>Компьютер</span>
              <span className="hidden md:inline text-[11px] opacity-80 tabular-nums">
                1280×720
              </span>
            </button>
          </div>
        </div>

        {/* Right Zone: Save state / Scale + Restart Scenario */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {mode === 'edit' ? (
            <span className="hidden sm:inline text-xs text-gl-accent-light whitespace-nowrap">
              {saveState === 'saving' ? 'Сохранение...' : 'Сохранено в проекте'}
            </span>
          ) : (
            <span className="hidden md:inline text-xs text-gl-text-muted tabular-nums whitespace-nowrap">
              {preset.width}×{preset.height} · {Math.round(scale * 100)}%
            </span>
          )}

          {mode === 'view' && (
            <button
              type="button"
              onClick={handleRestartScenario}
              title="Запустить сценарий подарка с начала"
              className="gl-btn-secondary !px-2.5 sm:!px-3 !py-1.5 text-xs shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">С начала</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Preview Body: Scaled Device Stage (+ Inspector Panel ONLY in Edit Mode) */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Scaled Device Stage */}
        <main
          ref={stageRef}
          className="relative flex-1 min-w-0 min-h-0 flex items-center justify-center overflow-hidden select-none"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-45"
            style={{
              background:
                'radial-gradient(circle at 50% 45%, rgba(124, 58, 237, 0.16), transparent 60%)',
            }}
            aria-hidden="true"
          />

          {/* Device Frame */}
          <div
            data-testid="preview-device-frame"
            data-device={device}
            data-mode={mode}
            data-logical-width={preset.width}
            data-logical-height={preset.height}
            className={`relative z-10 bg-[#0c1229] border border-white/15 shadow-[0_24px_80px_rgba(0,0,0,0.75)] transition-[border-radius] duration-200 ${
              isCompactHost ? 'p-1.5' : 'p-2'
            } ${device === 'phone' ? 'rounded-[24px]' : 'rounded-2xl'}`}
          >
            <div
              className={`relative overflow-hidden bg-gl-bg ${
                device === 'phone' ? 'rounded-[18px]' : 'rounded-xl'
              }`}
              style={{
                width: `${scaledW}px`,
                height: `${scaledH}px`,
              }}
            >
              {!iframeLoaded && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-gl-bg text-xs text-gl-text-muted">
                  Загружаем предпросмотр...
                </div>
              )}

              <iframe
                key={sessionKey}
                ref={iframeRef}
                src={iframeSrc}
                title={`Предпросмотр: ${preset.label} ${preset.width}×${preset.height}`}
                allow="autoplay"
                onLoad={() => {
                  setIframeLoaded(true);
                  sendSyncToIframe();
                }}
                style={{
                  width: `${preset.width}px`,
                  height: `${preset.height}px`,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  border: 0,
                  display: 'block',
                  backgroundColor: '#070B1A',
                }}
              />
            </div>
          </div>
        </main>

        {/* Design Inspector Panel — strictly hidden in View mode! */}
        {mode === 'edit' && (
          <aside
            data-testid="preview-design-inspector"
            className="lg:w-[356px] xl:w-[376px] h-[44vh] lg:h-auto shrink-0 border-t lg:border-t-0 lg:border-l gl-panel flex flex-col min-h-0 bg-gl-panel/95"
          >
            {/* Card / Star Quick Switcher */}
            <div className="p-3 border-b border-white/10 space-y-2 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-xs font-semibold text-gl-text">
                  Редактор оформления
                </span>
                <span className="text-[11px] text-gl-text-muted truncate max-w-[170px]">
                  {isFinaleCard
                    ? 'Финальная открытка'
                    : activeStar?.title || `Звезда ${iframeStarIndex + 1}`}
                </span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                {project.stars.map((s, idx) => {
                  const active = !isFinaleCard && iframeStarIndex === idx;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      data-selected={active}
                      onClick={() => issueJump('starStory', idx)}
                      title={s.title || `Звезда ${idx + 1}`}
                      className="gl-choice px-2.5 py-1.5 text-xs font-semibold shrink-0 tabular-nums"
                    >
                      ★ {idx + 1}
                    </button>
                  );
                })}
                <button
                  type="button"
                  data-selected={isFinaleCard}
                  onClick={() => issueJump('constellation')}
                  className="gl-choice px-2.5 py-1.5 text-xs font-semibold shrink-0 inline-flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  Финал
                </button>
              </div>

              {/* Layer Tabs */}
              <div
                className={`grid gap-1 pt-1 ${
                  isFinaleCard ? 'grid-cols-2' : 'grid-cols-3'
                }`}
              >
                <button
                  type="button"
                  data-selected={effectiveLayerTab === 'text'}
                  onClick={() => setSelectedTarget('text')}
                  className="gl-tab !min-h-[34px] inline-flex items-center justify-center gap-1.5 text-xs"
                >
                  <Type className="w-3.5 h-3.5" />
                  Текст
                </button>

                {!isFinaleCard && (
                  <button
                    type="button"
                    data-selected={effectiveLayerTab === 'illustration'}
                    onClick={() => setSelectedTarget('illustration')}
                    className="gl-tab !min-h-[34px] inline-flex items-center justify-center gap-1.5 text-xs"
                  >
                    <ImageIcon className="w-3.5 h-3.5" />
                    Иллюстрация
                  </button>
                )}

                <button
                  type="button"
                  data-selected={effectiveLayerTab === 'decor'}
                  onClick={() => setSelectedTarget('decor')}
                  className="gl-tab !min-h-[34px] inline-flex items-center justify-center gap-1.5 text-xs"
                >
                  <Palette className="w-3.5 h-3.5" />
                  Декор
                </button>
              </div>
            </div>

            {/* Scrollable Tool Controls */}
            <div className="flex-1 min-h-0 overflow-y-auto p-3.5 space-y-4">
              {effectiveLayerTab === 'text' && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gl-text-muted">
                      Нажмите или перетащите текст прямо на открытке
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {!isFinaleCard && (
                        <button
                          type="button"
                          onClick={applyActiveTextStyleToAll}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-200 hover:text-amber-100 cursor-pointer"
                        >
                          <CopyCheck className="w-3 h-3" />
                          {appliedAllNotice ? 'Применено!' : 'Ко всем'}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={resetActiveTextStyle}
                        disabled={isDefaultText}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-gl-accent-light hover:text-gl-text disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Сброс
                      </button>
                    </div>
                  </div>

                  {/* Font Family */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-gl-text-muted block">Шрифт</span>
                    <div className="space-y-1.5">
                      {MESSAGE_FONTS.map((font) => {
                        const cat = MESSAGE_FONT_CATEGORIES.find((c) => c.id === font.category);
                        const active = activeTextStyle.fontId === font.id;
                        return (
                          <button
                            key={font.id}
                            type="button"
                            data-selected={active}
                            onClick={() => updateActiveTextStyle({ fontId: font.id })}
                            className="gl-choice w-full text-left px-2.5 py-2"
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-gl-accent-light">
                                {cat?.name}
                              </span>
                              <span className="text-[11px] text-gl-text-muted">
                                · {font.name}
                              </span>
                            </div>
                            <p
                              className="text-sm text-gl-text truncate mt-0.5"
                              style={{ fontFamily: font.cssFamily }}
                            >
                              {font.sample}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Weight & Alignment */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <span className="text-[11px] text-gl-text-muted block">Начертание</span>
                      <div className="grid grid-cols-2 gap-1">
                        {(
                          [
                            { id: 'normal', label: 'Обычный' },
                            { id: 'semibold', label: 'Жирный' },
                          ] as Array<{ id: MessageTextWeight; label: string }>
                        ).map((w) => (
                          <button
                            key={w.id}
                            type="button"
                            data-selected={activeTextStyle.fontWeight === w.id}
                            onClick={() => updateActiveTextStyle({ fontWeight: w.id })}
                            className={`gl-choice py-1.5 px-1.5 text-[11px] ${
                              w.id === 'semibold' ? 'font-semibold' : 'font-normal'
                            }`}
                          >
                            {w.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] text-gl-text-muted block">Выравнивание</span>
                      <div className="grid grid-cols-3 gap-1">
                        {(
                          [
                            { id: 'left', label: 'Слева', icon: AlignLeft },
                            { id: 'center', label: 'По центру', icon: AlignCenter },
                            { id: 'right', label: 'Справа', icon: AlignRight },
                          ] as Array<{
                            id: MessageTextAlign;
                            label: string;
                            icon: typeof AlignLeft;
                          }>
                        ).map((al) => {
                          const Icon = al.icon;
                          return (
                            <button
                              key={al.id}
                              type="button"
                              title={al.label}
                              aria-label={al.label}
                              data-selected={activeTextStyle.textAlign === al.id}
                              onClick={() => updateActiveTextStyle({ textAlign: al.id })}
                              className="gl-choice py-1.5 flex items-center justify-center"
                            >
                              <Icon className="w-3.5 h-3.5" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Size, Line Height, Width & Offsets */}
                  <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.025] p-2.5">
                    <label className="block space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gl-text-secondary font-medium">Размер текста</span>
                        <span className="text-gl-accent-light font-semibold tabular-nums">
                          {activeTextStyle.fontSize} px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={14}
                        max={24}
                        step={1}
                        value={activeTextStyle.fontSize}
                        aria-label="Размер текста на открытке"
                        onChange={(e) =>
                          updateActiveTextStyle({ fontSize: Number(e.target.value) })
                        }
                        className="w-full accent-gl-accent cursor-pointer"
                      />
                    </label>

                    <label className="block space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gl-text-secondary font-medium">
                          Межстрочный интервал
                        </span>
                        <span className="text-gl-accent-light font-semibold tabular-nums">
                          {activeTextStyle.lineHeight.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1.2}
                        max={2.0}
                        step={0.05}
                        value={activeTextStyle.lineHeight}
                        aria-label="Межстрочный интервал на открытке"
                        onChange={(e) =>
                          updateActiveTextStyle({ lineHeight: Number(e.target.value) })
                        }
                        className="w-full accent-gl-accent cursor-pointer"
                      />
                    </label>

                    {!isFinaleCard && (
                      <>
                        <label className="block space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gl-text-muted">Ширина блока</span>
                            <span className="text-gl-text-secondary tabular-nums">
                              {activeTextStyle.widthPct}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={56}
                            max={100}
                            step={2}
                            value={activeTextStyle.widthPct}
                            aria-label="Ширина текстового блока на открытке"
                            onChange={(e) =>
                              updateActiveTextStyle({ widthPct: Number(e.target.value) })
                            }
                            className="w-full accent-gl-accent cursor-pointer"
                          />
                        </label>

                        <div className="grid grid-cols-2 gap-2.5">
                          <label className="block space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-gl-text-muted">Сдвиг X</span>
                              <span className="text-gl-text-secondary tabular-nums">
                                {activeTextStyle.offsetX}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min={-100}
                              max={100}
                              step={5}
                              value={activeTextStyle.offsetX}
                              aria-label="Позиция текста X"
                              onChange={(e) => {
                                const nextX = Number(e.target.value);
                                updateActiveTextStyle({
                                  offsetX: nextX,
                                  widthPct:
                                    activeTextStyle.widthPct > 90 && nextX !== 0
                                      ? 84
                                      : activeTextStyle.widthPct,
                                });
                              }}
                              className="w-full accent-gl-accent cursor-pointer"
                            />
                          </label>

                          <label className="block space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-gl-text-muted">Сдвиг Y</span>
                              <span className="text-gl-text-secondary tabular-nums">
                                {activeTextStyle.offsetY}%
                              </span>
                            </div>
                            <input
                              type="range"
                              min={-100}
                              max={100}
                              step={5}
                              value={activeTextStyle.offsetY}
                              aria-label="Позиция текста Y"
                              onChange={(e) =>
                                updateActiveTextStyle({ offsetY: Number(e.target.value) })
                              }
                              className="w-full accent-gl-accent cursor-pointer"
                            />
                          </label>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Color & Shadow */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-gl-text-muted block">Цвет текста</span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {MESSAGE_TEXT_COLORS.map((c) => {
                        const active =
                          activeTextStyle.color.toUpperCase() === c.hex.toUpperCase();
                        return (
                          <button
                            key={c.hex}
                            type="button"
                            title={c.name}
                            aria-label={c.name}
                            data-selected={active}
                            onClick={() => updateActiveTextStyle({ color: c.hex })}
                            className={`w-7 h-7 rounded-lg border transition-transform cursor-pointer ${
                              active
                                ? 'border-gl-accent-light scale-110 ring-2 ring-gl-accent/45'
                                : 'border-white/25 hover:scale-105'
                            }`}
                            style={{ backgroundColor: c.hex }}
                          />
                        );
                      })}

                      <label className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/[0.04] px-2 h-7 text-[11px] text-gl-text-secondary cursor-pointer hover:border-white/30">
                        <input
                          type="color"
                          value={activeTextStyle.color}
                          aria-label="Свой цвет текста на открытке"
                          onChange={(e) =>
                            updateActiveTextStyle({ color: e.target.value.toUpperCase() })
                          }
                          className="w-4 h-4 bg-transparent border-0 p-0 cursor-pointer"
                        />
                        <span>Свой</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[11px] text-gl-text-muted block">Тень текста</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'soft', label: 'Мягкая' },
                          { id: 'glow', label: 'Сияние' },
                          { id: 'none', label: 'Нет' },
                        ] as Array<{ id: MessageTextShadow; label: string }>
                      ).map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          data-selected={activeTextStyle.shadow === s.id}
                          onClick={() => updateActiveTextStyle({ shadow: s.id })}
                          className="gl-choice py-1.5 text-[11px] font-medium"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {effectiveLayerTab === 'illustration' && !isFinaleCard && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gl-text-muted">
                      Перетаскивайте картинку или тяните угол на открытке
                    </span>
                    <button
                      type="button"
                      onClick={resetActiveIllustration}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-gl-accent-light hover:text-gl-text cursor-pointer shrink-0"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Сброс
                    </button>
                  </div>

                  <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.025] p-2.5">
                    <label className="block space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gl-text-secondary font-medium">
                          Размер на открытке
                        </span>
                        <span className="text-gl-accent-light font-semibold tabular-nums">
                          {activeIlluLayout.scale.toFixed(2)}×
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.65}
                        max={1.45}
                        step={0.05}
                        value={activeIlluLayout.scale}
                        aria-label="Размер иллюстрации на открытке"
                        onChange={(e) =>
                          updateActiveIllustrationLayout({ scale: Number(e.target.value) })
                        }
                        className="w-full accent-gl-accent cursor-pointer"
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-2.5">
                      <label className="block space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gl-text-muted">Позиция X</span>
                          <span className="text-gl-text-secondary tabular-nums">
                            {activeIlluLayout.offsetX}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-100}
                          max={100}
                          step={5}
                          value={activeIlluLayout.offsetX}
                          aria-label="Позиция иллюстрации X"
                          onChange={(e) =>
                            updateActiveIllustrationLayout({
                              offsetX: Number(e.target.value),
                            })
                          }
                          className="w-full accent-gl-accent cursor-pointer"
                        />
                      </label>

                      <label className="block space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gl-text-muted">Позиция Y</span>
                          <span className="text-gl-text-secondary tabular-nums">
                            {activeIlluLayout.offsetY}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={-100}
                          max={100}
                          step={5}
                          value={activeIlluLayout.offsetY}
                          aria-label="Позиция иллюстрации Y"
                          onChange={(e) =>
                            updateActiveIllustrationLayout({
                              offsetY: Number(e.target.value),
                            })
                          }
                          className="w-full accent-gl-accent cursor-pointer"
                        />
                      </label>
                    </div>
                  </div>

                  {/* Image crop / fit inside its frame */}
                  <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.025] p-2.5">
                    <span className="text-[11px] font-medium text-gl-text-secondary block">
                      Кадрирование внутри рамки
                    </span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(
                        [
                          { id: 'cover', label: 'Заполнить', icon: Maximize },
                          { id: 'contain', label: 'Вписать', icon: Minimize },
                        ] as Array<{
                          id: StarImageFitMode;
                          label: string;
                          icon: typeof Maximize;
                        }>
                      ).map((fitMode) => {
                        const Icon = fitMode.icon;
                        return (
                          <button
                            key={fitMode.id}
                            type="button"
                            data-selected={activeImgSettings.fit === fitMode.id}
                            onClick={() => updateActiveImageSettings({ fit: fitMode.id })}
                            className="gl-choice py-1.5 text-[11px] font-medium inline-flex items-center justify-center gap-1"
                          >
                            <Icon className="w-3 h-3" />
                            {fitMode.label}
                          </button>
                        );
                      })}
                    </div>

                    <label className="block space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-gl-text-muted">Зум картинки</span>
                        <span className="text-gl-text-secondary tabular-nums">
                          {activeImgSettings.scale.toFixed(2)}×
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={2.5}
                        step={0.05}
                        value={activeImgSettings.scale}
                        aria-label="Зум картинки внутри рамки"
                        onChange={(e) =>
                          updateActiveImageSettings({ scale: Number(e.target.value) })
                        }
                        className="w-full accent-gl-accent cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              )}

              {effectiveLayerTab === 'decor' && (
                <div className="space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-gl-text-muted">
                      Декоративные элементы открытки
                    </span>
                    <button
                      type="button"
                      onClick={resetActiveDecor}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-gl-accent-light hover:text-gl-text cursor-pointer shrink-0"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Сброс
                    </button>
                  </div>

                  {/* Text block decorative accent */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-gl-text-muted block">
                      Акцент текстового блока
                    </span>
                    <div className="grid grid-cols-4 gap-1.5">
                      {(
                        [
                          { id: 'none', label: 'Нет' },
                          { id: 'line', label: 'Линия' },
                          { id: 'frame', label: 'Рамка' },
                          { id: 'quote', label: 'Черта' },
                        ] as Array<{ id: MessageTextAccent; label: string }>
                      ).map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          data-selected={activeTextStyle.accent === a.id}
                          onClick={() => updateActiveTextStyle({ accent: a.id })}
                          className="gl-choice py-1.5 px-1 text-[11px] font-medium"
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Card Ornament Motif */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-gl-text-muted block">
                      Узор на открытке
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {CARD_DECOR_MOTIFS.map((item) => {
                        const active = activeDecor.motif === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            data-selected={active}
                            onClick={() =>
                              updateActiveDecor({ motif: item.id as CardDecorMotif })
                            }
                            className="gl-choice p-2 flex flex-col items-center gap-1"
                          >
                            <div className="w-9 h-9 flex items-center justify-center">
                              {item.id === 'none' ? (
                                <span className="text-xs text-gl-text-muted">—</span>
                              ) : (
                                <CardDecorView
                                  motif={item.id}
                                  glowHex={activeGlow.hex}
                                  coreHex={activeGlow.coreHex}
                                  className="w-9 h-9"
                                />
                              )}
                            </div>
                            <span className="text-[11px] font-medium">{item.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {activeDecor.motif !== 'none' && (
                    <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.025] p-2.5">
                      <span className="text-[11px] text-gl-text-secondary font-medium block">
                        Положение узора (или перетащите на открытке)
                      </span>

                      <div className="grid grid-cols-2 gap-1.5">
                        {(
                          [
                            { label: 'Верх-лево', xPct: 14, yPct: 14 },
                            { label: 'Верх-право', xPct: 84, yPct: 16 },
                            { label: 'Низ-лево', xPct: 14, yPct: 80 },
                            { label: 'Низ-право', xPct: 84, yPct: 78 },
                          ] as const
                        ).map((presetPos) => (
                          <button
                            key={presetPos.label}
                            type="button"
                            onClick={() =>
                              updateActiveDecor({
                                xPct: presetPos.xPct,
                                yPct: presetPos.yPct,
                              })
                            }
                            className="gl-choice py-1.5 text-[11px] font-medium"
                          >
                            {presetPos.label}
                          </button>
                        ))}
                      </div>

                      <label className="block space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gl-text-muted">Размер узора</span>
                          <span className="text-gl-text-secondary tabular-nums">
                            {activeDecor.scale.toFixed(2)}×
                          </span>
                        </div>
                        <input
                          type="range"
                          min={0.7}
                          max={1.45}
                          step={0.05}
                          value={activeDecor.scale}
                          aria-label="Размер декоративного элемента"
                          onChange={(e) =>
                            updateActiveDecor({ scale: Number(e.target.value) })
                          }
                          className="w-full accent-gl-accent cursor-pointer"
                        />
                      </label>

                      <div className="grid grid-cols-2 gap-2.5">
                        <label className="block space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gl-text-muted">Позиция X</span>
                            <span className="text-gl-text-secondary tabular-nums">
                              {activeDecor.xPct}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={6}
                            max={94}
                            step={2}
                            value={activeDecor.xPct}
                            aria-label="Позиция декора X"
                            onChange={(e) =>
                              updateActiveDecor({ xPct: Number(e.target.value) })
                            }
                            className="w-full accent-gl-accent cursor-pointer"
                          />
                        </label>

                        <label className="block space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gl-text-muted">Позиция Y</span>
                            <span className="text-gl-text-secondary tabular-nums">
                              {activeDecor.yPct}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={6}
                            max={88}
                            step={2}
                            value={activeDecor.yPct}
                            aria-label="Позиция декора Y"
                            onChange={(e) =>
                              updateActiveDecor({ yPct: Number(e.target.value) })
                            }
                            className="w-full accent-gl-accent cursor-pointer"
                          />
                        </label>
                      </div>
                    </div>
                  )}

                  {activeDecor.motif === 'none' && (
                    <p className="text-[11px] text-gl-text-muted leading-snug">
                      Выберите узор выше — после добавления его можно свободно перемещать по открытке мышью или пальцем.
                    </p>
                  )}
                </div>
              )}

            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
