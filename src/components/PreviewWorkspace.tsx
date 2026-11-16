import { useState } from 'react';
import {
  ArrowLeft,
  Download,
  Mail,
  Monitor,
  Palette,
  RotateCcw,
  Smartphone,
  Sparkles,
  Star,
} from 'lucide-react';
import type { ConstellationProject } from '../types/project';
import {
  DEVICE_PRESETS,
  LivePreviewStage,
  getPreviewProjectRegistry,
  type PreviewDeviceId,
  type PreviewProjectMap,
} from './LivePreviewStage';

export { getPreviewProjectRegistry, type PreviewDeviceId, type PreviewProjectMap };

interface PreviewWorkspaceProps {
  project: ConstellationProject;
  saveState?: 'saved' | 'saving';
  returnLabel: string;
  embedded?: boolean;
  onExitPreview: () => void;
  onJumpToStep?: (step: 'stars' | 'constellation' | 'card' | 'atmosphere') => void;
  onOpenExport?: () => void;
}

export function PreviewWorkspace({
  project,
  returnLabel,
  embedded = false,
  onExitPreview,
  onJumpToStep,
  onOpenExport,
}: PreviewWorkspaceProps) {
  const [device, setDevice] = useState<PreviewDeviceId>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'phone' : 'desktop',
  );
  const [sessionKey, setSessionKey] = useState(0);
  const [scale, setScale] = useState(1);

  const preset = DEVICE_PRESETS[device];

  const handleRestartScenario = () => {
    setSessionKey((k) => k + 1);
  };

  return (
    <div
      data-testid="preview-workspace-root"
      data-palette={project.paletteId}
      className={
        embedded
          ? 'h-full w-full min-h-0 flex-1 overflow-hidden bg-transparent text-gl-text flex flex-col'
          : 'gl-h-screen w-screen overflow-hidden bg-transparent text-gl-text flex flex-col'
      }
    >
      {/* Top Recipient Preview Control Bar */}
      <header
        className={`gl-preview-header relative z-20 shrink-0 border-b gl-glass-header px-2.5 sm:px-4 py-1.5 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 ${
          embedded ? 'min-h-12' : 'min-h-14 gl-safe-top'
        }`}
      >
        {/* Left Zone: Return to Editor + Quick Step Links */}
        <div className="flex items-center gap-1.5 min-w-0 max-w-full">
          <button
            type="button"
            data-testid="preview-return-btn"
            onClick={onExitPreview}
            className="gl-btn-secondary !min-h-[36px] !px-2.5 sm:!px-3 !py-1 text-xs text-gl-text shrink-0 max-w-full"
          >
            <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{returnLabel}</span>
          </button>

          {onJumpToStep && (
            <div className="hidden lg:flex items-center gap-1 pl-1.5 border-l border-white/10">
              <button
                type="button"
                data-testid="preview-jump-stars"
                onClick={() => onJumpToStep('stars')}
                className="gl-choice px-2 py-1 text-[11px] font-medium inline-flex items-center gap-1 whitespace-nowrap"
              >
                <Star className="w-3 h-3 text-gl-accent-light shrink-0" />
                <span>Звёзды</span>
              </button>
              <button
                type="button"
                data-testid="preview-jump-constellation"
                onClick={() => onJumpToStep('constellation')}
                className="gl-choice px-2 py-1 text-[11px] font-medium inline-flex items-center gap-1 whitespace-nowrap"
              >
                <Sparkles className="w-3 h-3 text-gl-accent-light shrink-0" />
                <span>Созвездие</span>
              </button>
              <button
                type="button"
                data-testid="preview-jump-card"
                onClick={() => onJumpToStep('card')}
                className="gl-choice px-2 py-1 text-[11px] font-medium inline-flex items-center gap-1 whitespace-nowrap"
              >
                <Mail className="w-3 h-3 text-gl-accent-light shrink-0" />
                <span>Открытка</span>
              </button>
              <button
                type="button"
                data-testid="preview-jump-atmosphere"
                onClick={() => onJumpToStep('atmosphere')}
                className="gl-choice px-2 py-1 text-[11px] font-medium inline-flex items-center gap-1 whitespace-nowrap"
              >
                <Palette className="w-3 h-3 text-gl-accent-light shrink-0" />
                <span>Атмосфера</span>
              </button>
            </div>
          )}

          {!embedded && (
            <span className="hidden 2xl:block text-sm font-medium text-gl-text-secondary truncate max-w-[200px]">
              {project.title || 'Предпросмотр подарка'}
            </span>
          )}
        </div>

        {/* Center Zone: Phone / Desktop Switcher */}
        <div
          role="group"
          aria-label="Выбор устройства для предпросмотра"
          className="inline-flex items-center gap-1 p-1 rounded-xl bg-gl-input border border-white/10 shrink-0 max-w-full"
        >
          <button
            type="button"
            data-testid="preview-device-phone"
            onClick={() => setDevice('phone')}
            aria-pressed={device === 'phone'}
            data-selected={device === 'phone'}
            className="gl-tab !min-h-[32px] sm:!min-h-[34px] !px-2.5 text-xs inline-flex items-center gap-1.5"
          >
            <Smartphone className="w-3.5 h-3.5 shrink-0" />
            <span>Телефон</span>
            <span className="hidden 2xl:inline text-[11px] opacity-80 tabular-nums">
              390×844
            </span>
          </button>

          <button
            type="button"
            data-testid="preview-device-desktop"
            onClick={() => setDevice('desktop')}
            aria-pressed={device === 'desktop'}
            data-selected={device === 'desktop'}
            className="gl-tab !min-h-[32px] sm:!min-h-[34px] !px-2.5 text-xs inline-flex items-center gap-1.5"
          >
            <Monitor className="w-3.5 h-3.5 shrink-0" />
            <span>Компьютер</span>
            <span className="hidden 2xl:inline text-[11px] opacity-80 tabular-nums">
              1280×720
            </span>
          </button>
        </div>

        {/* Right Zone: Scale + Restart + Export */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <span className="hidden 2xl:inline text-xs text-gl-text-muted tabular-nums whitespace-nowrap">
            {preset.width}×{preset.height} · {Math.round(scale * 100)}%
          </span>

          <button
            type="button"
            data-testid="preview-restart-btn"
            onClick={handleRestartScenario}
            title="Запустить сценарий подарка с начала"
            className="gl-btn-secondary !min-h-[36px] !px-2.5 sm:!px-3 !py-1 text-xs shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            <span>С начала</span>
          </button>

          {onOpenExport && (
            <button
              type="button"
              onClick={onOpenExport}
              className="gl-btn-primary !min-h-[36px] !px-3 !py-1 text-xs shrink-0"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Скачать ZIP</span>
            </button>
          )}
        </div>
      </header>

      {/* Pure Recipient Walkthrough Stage */}
      <main className="flex-1 min-w-0 min-h-0 flex overflow-hidden">
        <LivePreviewStage
          project={project}
          device={device}
          editMode={false}
          sessionKey={sessionKey}
          onScaleChange={setScale}
        />
      </main>
    </div>
  );
}
