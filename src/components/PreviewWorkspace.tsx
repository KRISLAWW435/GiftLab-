import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Monitor, RotateCcw, Smartphone } from 'lucide-react';
import type { ConstellationProject } from '../types/project';

export type PreviewDeviceId = 'phone' | 'desktop';

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
  returnLabel: string;
  onExitPreview: () => void;
}

export function PreviewWorkspace({
  project,
  returnLabel,
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
  const [sessionKey, setSessionKey] = useState(0);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [stageSize, setStageSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1280,
    height: typeof window !== 'undefined' ? Math.max(320, window.innerHeight - 56) : 720,
  }));

  // Publish an isolated deep-cloned snapshot so preview never mutates editor state
  const snapshot = useMemo(() => cloneProjectReadonly(project), [project]);
  getPreviewProjectRegistry().set(previewKey, snapshot);

  useEffect(() => {
    const registry = getPreviewProjectRegistry();
    registry.set(previewKey, snapshot);
    return () => {
      registry.delete(previewKey);
    };
  }, [previewKey, snapshot]);

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
  }, []);

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
  const stageMargin = isCompactHost ? 16 : 36;
  const bezelAllowance = isCompactHost ? 12 : 16;

  const availW = Math.max(120, stageSize.width - stageMargin - bezelAllowance);
  const availH = Math.max(120, stageSize.height - stageMargin - bezelAllowance);
  const scale = Math.max(0.2, Math.min(1, availW / preset.width, availH / preset.height));
  const scaledW = Math.floor(preset.width * scale);
  const scaledH = Math.floor(preset.height * scale);

  const handleRestartScenario = () => {
    setIframeLoaded(false);
    setSessionKey((k) => k + 1);
  };

  return (
    <div className="gl-h-screen w-screen overflow-hidden bg-[#050814] text-gl-text flex flex-col">
      {/* Top Preview Control Bar */}
      <header className="relative z-20 min-h-14 shrink-0 border-b gl-panel gl-safe-top px-3 sm:px-5 py-1.5 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left Zone: Return to Editor + Project Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onExitPreview}
            className="gl-btn-secondary !px-2.5 sm:!px-3 !py-1.5 text-xs text-gl-text shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            <span>{returnLabel}</span>
          </button>

          <span className="hidden lg:block text-sm font-medium text-gl-text-secondary truncate max-w-[220px]">
            {project.title || 'Предпросмотр подарка'}
          </span>
        </div>

        {/* Center Zone: Device Switcher (Phone 390x844 / Desktop 1280x720) */}
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
            <span className="hidden sm:inline text-[11px] opacity-80 tabular-nums">
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
            <span className="hidden sm:inline text-[11px] opacity-80 tabular-nums">
              1280×720
            </span>
          </button>
        </div>

        {/* Right Zone: Scale readout + Restart Scenario */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <span className="hidden md:inline text-xs text-gl-text-muted tabular-nums whitespace-nowrap">
            {preset.width}×{preset.height} · {Math.round(scale * 100)}%
          </span>

          <button
            type="button"
            onClick={handleRestartScenario}
            title="Запустить сценарий подарка с начала"
            className="gl-btn-secondary !px-2.5 sm:!px-3 !py-1.5 text-xs shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden sm:inline">С начала</span>
          </button>
        </div>
      </header>

      {/* Center Scaled Device Stage */}
      <main
        ref={stageRef}
        className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden select-none"
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
                iframeRef.current?.focus();
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
    </div>
  );
}
