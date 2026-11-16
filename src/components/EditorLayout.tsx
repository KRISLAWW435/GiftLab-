import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  Download,
  Eye,
  Hand,
  HelpCircle,
  Link2,
  Mail,
  Maximize2,
  Minimize2,
  Monitor,
  Orbit,
  Palette,
  RotateCcw,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import type {
  EditableCardTarget,
  EditableTextField,
  PreviewJumpTarget,
} from '../preview/previewProtocol';
import {
  computeNextStarSpawnPosition,
  makeConnectionId,
} from '../scene/paletteConfig';
import {
  MAX_STARS,
  canExportProject,
  isStarComplete,
  type ConstellationProject,
  type ConstellationStar,
  type EditorInteractionMode,
  type RecipientPhase,
  type StarPosition3D,
} from '../types/project';
import {
  CANVAS_TUTORIAL_STORAGE_KEY,
  CanvasTutorialOverlay,
  type TutorialStep,
} from './CanvasTutorialOverlay';
import { CardEditorPanel, type CardEditorTab } from './CardEditorPanel';
import { Constellation3D, type Constellation3DHandle } from './Constellation3D';
import { ConstellationSettings } from './ConstellationSettings';
import { ExportModal } from './ExportModal';
import {
  LivePreviewStage,
  mergeProjectDevicePatch,
  mergeStarDevicePatch,
  type PreviewDeviceId,
} from './LivePreviewStage';
import { PreviewWorkspace } from './PreviewWorkspace';
import { StarEditor, type StarEditStep } from './StarEditor';
import { StarList } from './StarList';

interface EditorLayoutProps {
  project: ConstellationProject;
  saveState: 'saved' | 'saving';
  onUpdateProject: (updater: (prev: ConstellationProject) => ConstellationProject) => void;
  onBackToProjects: () => void;
  onOpenPreview?: () => void;
}

export type WorkshopStepId =
  | 'stars'
  | 'constellation'
  | 'card'
  | 'atmosphere'
  | 'preview';

type MobilePane = 'panel' | 'scene';

interface WorkshopStepMeta {
  id: WorkshopStepId;
  num: number;
  label: string;
  icon: typeof Star;
}

const WORKSHOP_STEPS: WorkshopStepMeta[] = [
  { id: 'stars', num: 1, label: 'Мои звёзды', icon: Star },
  { id: 'constellation', num: 2, label: 'Созвездие', icon: Sparkles },
  { id: 'card', num: 3, label: 'Открытка', icon: Mail },
  { id: 'atmosphere', num: 4, label: 'Атмосфера', icon: Palette },
  { id: 'preview', num: 5, label: 'Предпросмотр', icon: Eye },
];

export function EditorLayout({
  project,
  saveState,
  onUpdateProject,
  onBackToProjects,
}: EditorLayoutProps) {
  const sceneRef = useRef<Constellation3DHandle | null>(null);
  const jumpNonceRef = useRef(1);

  const [selectedStarId, setSelectedStarId] = useState<string>(
    project.stars[0]?.id ?? '',
  );
  const [activeStep, setActiveStep] = useState<WorkshopStepId>('stars');
  const [lastEditStep, setLastEditStep] =
    useState<Exclude<WorkshopStepId, 'preview'>>('stars');
  const [visitedSteps, setVisitedSteps] = useState<Set<WorkshopStepId>>(
    () => new Set(['stars']),
  );
  const [interactionMode, setInteractionMode] =
    useState<EditorInteractionMode>('arrange');
  const [pendingLinkStarId, setPendingLinkStarId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(
    null,
  );
  const [connectNotice, setConnectNotice] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<MobilePane>('panel');
  const [zenMode, setZenMode] = useState(false);
  const [isDesktopMd, setIsDesktopMd] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
  );
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [dragReadout, setDragReadout] = useState<{
    starId: string;
    position: StarPosition3D;
    isDepthDrag: boolean;
  } | null>(null);

  const [cardDevice, setCardDevice] = useState<PreviewDeviceId>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'phone' : 'desktop',
  );
  const [starEditStep, setStarEditStep] = useState<StarEditStep>('shape');
  const [starSubStepById, setStarSubStepById] = useState<Record<string, StarEditStep>>({});
  const [starsCenterView, setStarsCenterView] = useState<'3d' | 'card'>('3d');
  const [starCardSelectedTarget, setStarCardSelectedTarget] =
    useState<EditableCardTarget | null>('text');
  const [starCardJumpTo, setStarCardJumpTo] = useState<PreviewJumpTarget>({
    nonce: 1,
    phase: 'starStory',
    starIndex: 0,
  });

  const [cardTab, setCardTab] = useState<CardEditorTab>('theme');
  const [cardSelectedTarget, setCardSelectedTarget] =
    useState<EditableCardTarget | null>('text');
  const [cardFocusedField, setCardFocusedField] =
    useState<EditableTextField | null>(null);
  const [cardIframePhase, setCardIframePhase] =
    useState<RecipientPhase>('constellation');
  const [cardIframeStarIndex, setCardIframeStarIndex] = useState(0);
  const [cardJumpTo, setCardJumpTo] = useState<PreviewJumpTarget | null>({
    nonce: 1,
    phase: 'constellation',
  });

  const [tutorialOpen, setTutorialOpen] = useState<boolean>(false);
  const [tutorialStep, setTutorialStep] = useState<TutorialStep>('overview');
  const [practiceMovedStar, setPracticeMovedStar] = useState(false);
  const [practiceRotatedScene, setPracticeRotatedScene] = useState(false);

  const markTutorialCompleted = () => {
    try {
      window.localStorage.setItem(CANVAS_TUTORIAL_STORAGE_KEY, '1');
    } catch {
      // ignore storage quota / privacy mode errors
    }
  };

  const handleOpenTutorial = () => {
    setMobilePane('scene');
    setTutorialStep('overview');
    setPracticeMovedStar(false);
    setPracticeRotatedScene(false);
    setTutorialOpen(true);
  };

  const handleDismissTutorial = () => {
    markTutorialCompleted();
    setTutorialOpen(false);
  };

  const handleCompleteTutorial = () => {
    markTutorialCompleted();
    setTutorialOpen(false);
  };

  const activeStarIndex = Math.max(
    0,
    project.stars.findIndex((s) => s.id === selectedStarId),
  );
  const activeStar = project.stars[activeStarIndex] ?? project.stars[0];

  const syncStarCardPreview = (targetStarIndex: number) => {
    jumpNonceRef.current += 1;
    setStarCardJumpTo({
      nonce: jumpNonceRef.current,
      phase: 'starStory',
      starIndex: targetStarIndex,
    });
  };

  useEffect(() => {
    if (activeStep === 'stars' && starsCenterView === 'card') {
      syncStarCardPreview(activeStarIndex);
    }
  }, [activeStep, starsCenterView, activeStarIndex]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const syncViewport = () => {
      setIsDesktopMd(mq.matches);
      if (!mq.matches) {
        setZenMode(false);
      }
    };
    syncViewport();
    mq.addEventListener('change', syncViewport);
    return () => mq.removeEventListener('change', syncViewport);
  }, []);

  const switchMode = (nextMode: EditorInteractionMode) => {
    setInteractionMode(nextMode);
    if (nextMode !== 'connect') {
      setPendingLinkStarId(null);
      setSelectedConnectionId(null);
      setConnectNotice(null);
    }
  };

  const goToStep = (nextStep: WorkshopStepId) => {
    if (activeStep === 'constellation' && nextStep !== 'constellation') {
      if (interactionMode === 'connect') {
        switchMode('arrange');
      } else {
        setPendingLinkStarId(null);
        setSelectedConnectionId(null);
        setConnectNotice(null);
      }
    }
    if (nextStep === 'preview' && activeStep !== 'preview') {
      setLastEditStep(activeStep);
    } else if (nextStep !== 'preview') {
      setLastEditStep(nextStep);
    }
    if (nextStep === 'card' && activeStep !== 'card') {
      jumpNonceRef.current += 1;
      setCardJumpTo({
        nonce: jumpNonceRef.current,
        phase: 'constellation',
      });
      setCardIframePhase('constellation');
      setCardSelectedTarget('text');
      setCardFocusedField(null);
    }
    if (nextStep === 'constellation' && activeStep !== 'constellation') {
      try {
        if (window.localStorage.getItem(CANVAS_TUTORIAL_STORAGE_KEY) !== '1') {
          setTutorialStep('overview');
          setPracticeMovedStar(false);
          setPracticeRotatedScene(false);
          setTutorialOpen(true);
        }
      } catch {
        // ignore storage quota / privacy mode errors
      }
    }
    setActiveStep(nextStep);
    setVisitedSteps((prev) => {
      if (prev.has(nextStep)) return prev;
      const next = new Set(prev);
      next.add(nextStep);
      return next;
    });
  };

  const handleCardSelectTarget = (
    target: EditableCardTarget | null,
    field?: EditableTextField,
  ) => {
    setCardSelectedTarget(target);
    setCardFocusedField(field ?? null);
    if (target === 'text') setCardTab('text');
    else if (target === 'illustration') setCardTab('illustration');
    else if (target === 'decor') setCardTab('theme');
    else if (target === 'card' && cardTab !== 'theme') setCardTab('card');
  };

  const handleStarCardSelectTarget = (target: EditableCardTarget | null) => {
    setStarCardSelectedTarget(target);
    if (target === 'illustration') {
      setStarEditStep('look');
      if (activeStar) {
        setStarSubStepById((prev) => ({ ...prev, [activeStar.id]: 'look' }));
      }
    } else if (target === 'text') {
      setStarEditStep('message');
      if (activeStar) {
        setStarSubStepById((prev) => ({ ...prev, [activeStar.id]: 'message' }));
      }
    } else if (target === 'decor') {
      goToStep('card');
      setCardTab('theme');
    }
  };

  const handleStarEditStepChange = (nextSubStep: StarEditStep) => {
    setStarEditStep(nextSubStep);
    if (activeStar) {
      setStarSubStepById((prev) => ({ ...prev, [activeStar.id]: nextSubStep }));
    }
    if (nextSubStep === 'shape') {
      setStarsCenterView('3d');
    }
  };

  const handleCardSelectTargetView = (
    phase: 'sealed' | 'constellation' | 'starStory',
    starIndex = 0,
  ) => {
    jumpNonceRef.current += 1;
    setCardIframePhase(phase);
    if (phase === 'starStory') {
      setCardIframeStarIndex(starIndex);
    }
    if (phase === 'sealed') {
      setCardSelectedTarget('envelope');
      setCardFocusedField(null);
    } else if (cardSelectedTarget === 'envelope') {
      setCardSelectedTarget('text');
      setCardFocusedField(null);
    }
    setCardJumpTo({
      nonce: jumpNonceRef.current,
      phase,
      starIndex,
    });
  };

  const handleCardPatchStar = (
    starId: string,
    patch: Partial<ConstellationStar>,
  ) => {
    onUpdateProject((prev) => ({
      ...prev,
      stars: prev.stars.map((s) =>
        s.id === starId ? mergeStarDevicePatch(s, patch) : s,
      ),
    }));
  };

  const handleCardPatchProject = (patch: Partial<ConstellationProject>) => {
    onUpdateProject((prev) => mergeProjectDevicePatch(prev, patch));
  };

  const handleSelectStarFromList = (starId: string) => {
    const rememberedStep = starSubStepById[starId] ?? 'shape';
    setSelectedStarId(starId);
    setStarEditStep(rememberedStep);
    if (activeStep !== 'stars') {
      setStarsCenterView('3d');
      goToStep('stars');
    }
  };

  const handleSelectStarOnScene = (starId: string) => {
    if (interactionMode !== 'connect') {
      setSelectedStarId(starId);
      return;
    }

    setSelectedConnectionId(null);

    if (!pendingLinkStarId) {
      setPendingLinkStarId(starId);
      setSelectedStarId(starId);
      setConnectNotice(null);
      return;
    }

    if (pendingLinkStarId === starId) {
      setPendingLinkStarId(null);
      setConnectNotice('Нельзя соединить звезду саму с собой');
      return;
    }

    const existing = project.connections.find(
      (c) =>
        (c.from === pendingLinkStarId && c.to === starId) ||
        (c.from === starId && c.to === pendingLinkStarId),
    );

    if (existing) {
      setPendingLinkStarId(null);
      setSelectedConnectionId(existing.id);
      setConnectNotice('Такая связь уже существует — можно удалить её ниже');
      return;
    }

    const fromId = pendingLinkStarId;
    const newConnId = makeConnectionId(fromId, starId);
    onUpdateProject((prev) => ({
      ...prev,
      connections: [
        ...prev.connections,
        { id: newConnId, from: fromId, to: starId },
      ],
    }));
    setPendingLinkStarId(null);
    setSelectedStarId(starId);
    setConnectNotice(null);
  };

  const handleSelectConnection = (connectionId: string | null) => {
    setSelectedConnectionId(connectionId);
    if (connectionId) {
      setPendingLinkStarId(null);
      setConnectNotice(null);
    }
  };

  const handleDeleteConnection = (connectionId: string) => {
    onUpdateProject((prev) => ({
      ...prev,
      connections: prev.connections.filter((c) => c.id !== connectionId),
    }));
    if (selectedConnectionId === connectionId) {
      setSelectedConnectionId(null);
    }
    setConnectNotice(null);
  };

  const handleMoveStar = (starId: string, position: StarPosition3D) => {
    if (tutorialOpen && tutorialStep === 'practice') {
      setPracticeMovedStar(true);
    }
    onUpdateProject((prev) => ({
      ...prev,
      stars: prev.stars.map((s) => (s.id === starId ? { ...s, position } : s)),
    }));
  };

  const handleUpdateStar = (patch: Partial<ConstellationStar>) => {
    if (!activeStar) return;
    onUpdateProject((prev) => ({
      ...prev,
      stars: prev.stars.map((s) =>
        s.id === activeStar.id ? { ...s, ...patch } : s,
      ),
    }));
  };

  const handleAddStar = () => {
    if (project.stars.length >= MAX_STARS) return;
    const idx = project.stars.length;
    const position = computeNextStarSpawnPosition(project.stars, idx);

    const newStar: ConstellationStar = {
      id: `star_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      order: idx,
      title: `Звезда ${idx + 1}`,
      message: '',
      illustration: { type: 'builtin', id: 'comet' },
      shape: 'star',
      glowColor: 'inherit',
      position,
      isDraft: true,
    };

    onUpdateProject((prev) => ({
      ...prev,
      stars: [...prev.stars, newStar],
    }));
    setSelectedStarId(newStar.id);
    setStarSubStepById((prev) => ({ ...prev, [newStar.id]: 'shape' }));
    setStarEditStep('shape');
    setStarsCenterView('3d');
    if (activeStep !== 'stars') {
      goToStep('stars');
    }
  };

  const handleRemoveStar = (starId: string) => {
    if (project.stars.length <= 5) return;
    if (pendingLinkStarId === starId) setPendingLinkStarId(null);

    const remaining = project.stars.filter((s) => s.id !== starId);
    if (selectedStarId === starId && remaining[0]) {
      setSelectedStarId(remaining[0].id);
    }
    if (selectedConnectionId) {
      const stillExists = project.connections.some(
        (c) =>
          c.id === selectedConnectionId &&
          c.from !== starId &&
          c.to !== starId,
      );
      if (!stillExists) {
        setSelectedConnectionId(null);
      }
    }

    onUpdateProject((prev) => {
      const filtered = prev.stars
        .filter((s) => s.id !== starId)
        .map((s, idx) => ({ ...s, order: idx }));
      const nextConnections = prev.connections.filter(
        (c) => c.from !== starId && c.to !== starId,
      );
      return { ...prev, stars: filtered, connections: nextConnections };
    });
  };

  const starTitleById = new Map(
    project.stars.map((s, idx) => [s.id, s.title.trim() || `Звезда ${idx + 1}`]),
  );
  const selectedConnection = selectedConnectionId
    ? project.connections.find((c) => c.id === selectedConnectionId) ?? null
    : null;
  const pendingSourceTitle = pendingLinkStarId
    ? starTitleById.get(pendingLinkStarId) ?? 'Звезда'
    : null;

  // Readiness & step completion flags
  const hasTitle = project.title.trim().length > 0;
  const hasFinalMessage = project.finalMessage.trim().length > 0;
  const readyToExport = canExportProject(project);
  const hasNextStar = activeStarIndex + 1 < project.stars.length;

  const handleNextStarOrConstellation = () => {
    if (hasNextStar) {
      const nextStar = project.stars[activeStarIndex + 1];
      setSelectedStarId(nextStar.id);
      setStarSubStepById((prev) => ({ ...prev, [nextStar.id]: 'shape' }));
      setStarEditStep('shape');
      setStarsCenterView('3d');
    } else {
      goToStep('constellation');
    }
  };

  const stepCompleted: Record<WorkshopStepId, boolean> = {
    stars: project.stars.length >= 5 && project.stars.every(isStarComplete),
    constellation: project.connections.length > 0,
    card: hasTitle && hasFinalMessage,
    atmosphere: visitedSteps.has('atmosphere'),
    preview: readyToExport,
  };

  const activeStepIndex = WORKSHOP_STEPS.findIndex((s) => s.id === activeStep);
  const prevStep = activeStepIndex > 0 ? WORKSHOP_STEPS[activeStepIndex - 1] : null;
  const nextStep =
    activeStepIndex >= 0 && activeStepIndex < WORKSHOP_STEPS.length - 1
      ? WORKSHOP_STEPS[activeStepIndex + 1]
      : null;

  const activeStepMeta = WORKSHOP_STEPS[activeStepIndex] ?? WORKSHOP_STEPS[0];
  void activeStepMeta;

  return (
    <div
      data-palette={project.paletteId}
      className="gl-h-screen w-screen overflow-hidden bg-transparent text-gl-text flex flex-col"
    >
      {/* Top Studio Header + Horizontal 5-Step Progress Bar */}
      <header className="gl-workshop-header relative z-30 shrink-0 border-b gl-glass-header gl-safe-top">
        <div className="min-h-[50px] px-4 sm:px-6 py-2 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onBackToProjects}
              title="К списку проектов"
              aria-label="К списку проектов"
              className="gl-btn-secondary !min-h-[36px] !px-3 !py-1.5 text-xs shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Проекты</span>
            </button>

            <div className="flex items-baseline gap-2.5 min-w-0">
              <h1 className="font-display text-sm sm:text-base font-bold text-gl-text truncate">
                {project.title || 'Новое созвездие'}
              </h1>
              <span className="text-[11px] text-gl-text-muted shrink-0 hidden sm:inline">
                {saveState === 'saving' ? 'Сохранение...' : 'Сохранено'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeStep !== 'preview' && (
              <button
                type="button"
                onClick={() => goToStep('preview')}
                title="Перейти к предпросмотру подарка"
                className="gl-btn-secondary !min-h-[36px] !px-3 !py-1.5 text-xs text-gl-text"
              >
                <Eye className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">Предпросмотр</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowExport(true)}
              title="Скачать подарок в ZIP"
              className="gl-btn-primary !min-h-[36px] !px-3.5 !py-1.5 text-xs"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden sm:inline">Скачать ZIP</span>
              <span className="sm:hidden">ZIP</span>
            </button>
          </div>
        </div>

        {/* Clickable Horizontal Progress Bar (1 -> 2 -> 3 -> 4 -> 5) */}
        <nav
          data-testid="workshop-top-nav"
          aria-label="Этапы создания подарка"
          className="gl-workshop-stepper border-t border-white/[0.07] bg-white/[0.02] px-4 sm:px-6 py-2.5 overflow-x-auto"
        >
          <div className="flex items-center justify-start md:justify-center gap-1.5 sm:gap-2 min-w-max mx-auto">
            {WORKSHOP_STEPS.map((step, idx) => {
              const Icon = step.icon;
              const isCurrent = activeStep === step.id;
              const isDone = stepCompleted[step.id];

              return (
                <div key={step.id} className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                  <button
                    type="button"
                    data-step={step.id}
                    data-selected={isCurrent}
                    aria-current={isCurrent ? 'step' : undefined}
                    onClick={() => goToStep(step.id)}
                    className={`gl-workshop-step min-h-[36px] px-3 sm:px-3.5 py-1.5 rounded-2xl border text-xs sm:text-[13px] font-semibold flex items-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                      isCurrent
                        ? 'border-violet-300/70 bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-[0_0_20px_-4px_rgba(139,92,246,0.65)]'
                        : isDone
                          ? 'border-emerald-400/25 bg-emerald-500/12 text-emerald-100 hover:bg-emerald-500/20'
                          : 'border-white/10 bg-white/[0.035] text-gl-text-secondary hover:bg-white/[0.08] hover:text-gl-text'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold tabular-nums shrink-0 ${
                        isCurrent
                          ? 'bg-white/22 text-white'
                          : isDone
                            ? 'bg-emerald-500/25 text-emerald-200'
                            : 'bg-white/10 text-gl-text-muted'
                      }`}
                    >
                      {step.num}
                    </span>
                    <Icon className="w-3.5 h-3.5 shrink-0 opacity-90 sm:hidden lg:inline" />
                    <span>{step.label}</span>
                    {isDone && (
                      <Check
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isCurrent ? 'text-emerald-200' : 'text-emerald-300'
                        }`}
                        aria-label="Этап заполнен"
                      />
                    )}
                  </button>

                  {idx < WORKSHOP_STEPS.length - 1 && (
                    <ArrowRight
                      aria-hidden="true"
                      className="w-4 h-4 text-violet-300/65 shrink-0 mx-0.5"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </nav>
      </header>

      {/* Main Workspace: Embedded Preview on Step 5 OR strict 3-Column Flex (Left Stars | Center Stage | Right Step Panel) */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row relative overflow-hidden">
        {activeStep === 'preview' ? (
          <div
            data-testid="workshop-embedded-preview"
            className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden"
          >
            <PreviewWorkspace
              embedded
              project={project}
              saveState={saveState}
              returnLabel="Вернуться к редактированию"
              onExitPreview={() => goToStep(lastEditStep)}
              onJumpToStep={(step) => goToStep(step)}
              onOpenExport={() => setShowExport(true)}
            />
          </div>
        ) : (
          <>
            {/* Column 1 (lg+): Left Sidebar — Stars List Only */}
            <aside
              data-testid="workshop-left-sidebar"
              data-zen={zenMode}
              aria-hidden={zenMode}
              inert={zenMode && isDesktopMd ? true : undefined}
              className={`hidden lg:flex gl-editor-sidebar-left-shell shrink-0 flex-col border-r gl-glass-panel min-h-0 overflow-hidden ${
                zenMode ? 'pointer-events-none' : 'pointer-events-auto'
              }`}
            >
              <div
                data-testid="workshop-star-sidebar"
                className={`gl-editor-sidebar-left-inner flex-1 min-h-0 flex flex-col bg-[#070512]/58 transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                  zenMode ? '-translate-x-full opacity-0' : 'translate-x-0 opacity-100'
                }`}
              >
                <StarList
                  stars={project.stars}
                  selectedStarId={activeStar?.id ?? ''}
                  globalGlowColor={project.globalGlowColor}
                  onSelectStar={handleSelectStarFromList}
                  onAddStar={handleAddStar}
                  onRemoveStar={handleRemoveStar}
                />
              </div>
            </aside>

            {/* Column 2: Center Area — Live Card Editor on Step 3 OR Live 3D Scene on Steps 1, 2, 4 */}
            {activeStep === 'card' ? (
              <main
                data-testid="workshop-card-main"
                className={`${
                  mobilePane === 'scene' ? 'flex' : 'hidden'
                } md:flex flex-1 min-w-0 min-h-0 relative flex-col bg-transparent`}
              >
                <div className="shrink-0 border-b border-white/10 bg-black/25 backdrop-blur-md px-2.5 sm:px-3.5 py-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1 overflow-x-auto max-w-full">
                    <button
                      type="button"
                      data-testid="card-stage-envelope-btn"
                      data-selected={cardIframePhase === 'sealed'}
                      onClick={() => handleCardSelectTargetView('sealed')}
                      className="gl-choice px-2.5 py-1 text-[11px] font-semibold inline-flex items-center gap-1 shrink-0"
                    >
                      <Mail className="w-3 h-3 text-violet-300" />
                      <span>Конверт</span>
                    </button>

                    <button
                      type="button"
                      data-testid="card-stage-finale-btn"
                      data-selected={
                        cardIframePhase === 'constellation' ||
                        cardIframePhase === 'finalReveal'
                      }
                      onClick={() => handleCardSelectTargetView('constellation')}
                      className="gl-choice px-2.5 py-1 text-[11px] font-semibold inline-flex items-center gap-1 shrink-0"
                    >
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      <span>Финал</span>
                    </button>

                    {project.stars.map((s, idx) => {
                      const active =
                        cardIframePhase === 'starStory' && cardIframeStarIndex === idx;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          data-testid={`card-stage-star-${idx}`}
                          data-selected={active}
                          onClick={() => handleCardSelectTargetView('starStory', idx)}
                          title={s.title || `Звезда ${idx + 1}`}
                          className="gl-choice px-2 py-1 text-[11px] font-semibold shrink-0 tabular-nums"
                        >
                          ★ {idx + 1}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div
                      role="group"
                      aria-label="Экран открытки"
                      className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-gl-input border border-white/10"
                    >
                      <button
                        type="button"
                        data-testid="card-device-phone"
                        data-selected={cardDevice === 'phone'}
                        onClick={() => setCardDevice('phone')}
                        className="gl-tab !min-h-[30px] !px-2 text-[11px] inline-flex items-center gap-1"
                      >
                        <Smartphone className="w-3 h-3 shrink-0" />
                        <span>Телефон</span>
                      </button>

                      <button
                        type="button"
                        data-testid="card-device-desktop"
                        data-selected={cardDevice === 'desktop'}
                        onClick={() => setCardDevice('desktop')}
                        className="gl-tab !min-h-[30px] !px-2 text-[11px] inline-flex items-center gap-1"
                      >
                        <Monitor className="w-3 h-3 shrink-0" />
                        <span>Компьютер</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setZenMode((z) => !z)}
                      aria-pressed={zenMode}
                      title={zenMode ? 'Показать панели' : 'Скрыть панели'}
                      aria-label={zenMode ? 'Показать панели' : 'Скрыть панели'}
                      className="hidden md:inline-flex gl-btn-icon !min-w-[32px] !min-h-[32px] !w-[32px] !h-[32px] !p-0"
                    >
                      {zenMode ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="flex-1 min-h-0 flex overflow-hidden">
                  <LivePreviewStage
                    project={project}
                    device={cardDevice}
                    editMode={true}
                    selectedTarget={cardSelectedTarget}
                    jumpTo={cardJumpTo}
                    frameTestId="card-editor-frame"
                    onPhaseStateChange={(phase, idx) => {
                      setCardIframePhase(phase);
                      setCardIframeStarIndex(idx);
                    }}
                    onSelectTarget={handleCardSelectTarget}
                    onPatchStar={handleCardPatchStar}
                    onPatchProject={handleCardPatchProject}
                  />
                </div>

                <div className="hidden sm:flex items-center justify-center px-3 py-1 border-t border-white/8 bg-gl-input/55 text-[11px] text-gl-text-muted">
                  {cardIframePhase === 'sealed'
                    ? 'Нажми на любую надпись или кнопку прямо на конверте, чтобы отредактировать их'
                    : 'Нажми на текст открытки для правки или потяни за уголки открытки и текста, чтобы изменить размер'}
                </div>
              </main>
            ) : (
              <main
                data-testid="workshop-3d-main"
                className={`${
                  mobilePane === 'scene' ? 'flex' : 'hidden'
                } md:flex flex-1 min-w-0 min-h-0 relative flex-col bg-transparent`}
              >
                {activeStep === 'stars' && (
                  <div className="shrink-0 border-b border-white/10 bg-black/25 backdrop-blur-md px-2.5 sm:px-3.5 py-2 flex flex-wrap items-center justify-between gap-2">
                    <div
                      role="group"
                      aria-label="Режим предпросмотра этапа звёзд"
                      className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-gl-input border border-white/10"
                    >
                      <button
                        type="button"
                        data-testid="stars-center-3d"
                        data-selected={starsCenterView === '3d'}
                        onClick={() => setStarsCenterView('3d')}
                        className="gl-tab !min-h-[30px] !px-2.5 text-xs inline-flex items-center gap-1.5"
                      >
                        <Orbit className="w-3.5 h-3.5 shrink-0" />
                        <span>3D-сцена</span>
                      </button>

                      <button
                        type="button"
                        data-testid="stars-center-card"
                        data-selected={starsCenterView === 'card'}
                        onClick={() => {
                          setStarsCenterView('card');
                          syncStarCardPreview(activeStarIndex);
                        }}
                        className="gl-tab !min-h-[30px] !px-2.5 text-xs inline-flex items-center gap-1.5"
                      >
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        <span>Карточка звезды</span>
                      </button>
                    </div>

                    {starsCenterView === 'card' && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div
                          role="group"
                          aria-label="Экран карточки звезды"
                          className="inline-flex items-center gap-1 p-0.5 rounded-xl bg-gl-input border border-white/10"
                        >
                          <button
                            type="button"
                            data-testid="stars-card-device-phone"
                            data-selected={cardDevice === 'phone'}
                            onClick={() => setCardDevice('phone')}
                            className="gl-tab !min-h-[30px] !px-2 text-[11px] inline-flex items-center gap-1"
                          >
                            <Smartphone className="w-3 h-3 shrink-0" />
                            <span>Телефон</span>
                          </button>

                          <button
                            type="button"
                            data-testid="stars-card-device-desktop"
                            data-selected={cardDevice === 'desktop'}
                            onClick={() => setCardDevice('desktop')}
                            className="gl-tab !min-h-[30px] !px-2 text-[11px] inline-flex items-center gap-1"
                          >
                            <Monitor className="w-3 h-3 shrink-0" />
                            <span>Компьютер</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => setZenMode((z) => !z)}
                          aria-pressed={zenMode}
                          title={zenMode ? 'Показать панели' : 'Скрыть панели'}
                          aria-label={zenMode ? 'Показать панели' : 'Скрыть панели'}
                          className="hidden md:inline-flex gl-btn-icon !min-w-[32px] !min-h-[32px] !w-[32px] !h-[32px] !p-0"
                        >
                          {zenMode ? (
                            <Minimize2 className="w-3.5 h-3.5" />
                          ) : (
                            <Maximize2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {activeStep === 'stars' && starsCenterView === 'card' ? (
                  <>
                    <div className="flex-1 min-h-0 flex overflow-hidden">
                      <LivePreviewStage
                        project={project}
                        device={cardDevice}
                        editMode={true}
                        selectedTarget={starCardSelectedTarget}
                        jumpTo={starCardJumpTo}
                        frameTestId="star-card-editor-frame"
                        onPhaseStateChange={(phase, idx) => {
                          if (phase === 'starStory' && project.stars[idx]) {
                            setSelectedStarId(project.stars[idx].id);
                          }
                        }}
                        onSelectTarget={handleStarCardSelectTarget}
                        onPatchStar={handleCardPatchStar}
                        onPatchProject={handleCardPatchProject}
                      />
                    </div>
                    <div className="hidden sm:flex items-center justify-center px-3 py-1 border-t border-white/8 bg-gl-input/55 text-[11px] text-gl-text-muted">
                      Живая карточка выбранной звезды — изменения текста, картинки и узора видны сразу
                    </div>
                  </>
                ) : (
                  <div className="flex-1 min-h-0 relative w-full h-full overflow-hidden">
                    <Constellation3D
                      ref={sceneRef}
                      paletteId={project.paletteId}
                      globalGlowColor={project.globalGlowColor}
                      stars={project.stars}
                      connections={project.connections}
                      selectedStarId={activeStar?.id ?? null}
                      selectedConnectionId={selectedConnectionId}
                      pendingLinkStarId={pendingLinkStarId}
                      interactionMode={interactionMode}
                      finaleActive={activeStep === 'constellation'}
                      lowPerformance={typeof window !== 'undefined' && window.innerWidth < 768}
                      reducedMotion={reducedMotion}
                      onSelectStar={handleSelectStarOnScene}
                      onSelectConnection={handleSelectConnection}
                      onMoveStar={handleMoveStar}
                      onDragStar={(starId, position, isDepthDrag) =>
                        setDragReadout({ starId, position, isDepthDrag })
                      }
                      onDragEnd={() => setDragReadout(null)}
                      onCameraOrbit={() => {
                        if (tutorialOpen && tutorialStep === 'practice') {
                          setPracticeRotatedScene(true);
                        }
                      }}
                    />

            {/* Live Star Movement HUD during 3D Drag */}
            {dragReadout && interactionMode === 'arrange' && (
              <div
                aria-live="polite"
                className={`pointer-events-none absolute top-14 xl:top-3 left-3 z-10 gl-hud !rounded-xl px-3 py-1.5 text-xs flex flex-wrap items-center gap-x-2 gap-y-0.5 max-w-[calc(100%-24px)] xl:max-w-[calc(100%-340px)] ${
                  dragReadout.isDepthDrag ? '!border-amber-300/50' : '!border-gl-accent/45'
                }`}
              >
                <span className="font-semibold text-gl-text truncate max-w-[160px]">
                  {starTitleById.get(dragReadout.starId) ?? 'Звезда'}
                </span>
                <span className={dragReadout.isDepthDrag ? 'text-amber-200' : 'text-gl-text-secondary'}>
                  {dragReadout.isDepthDrag
                    ? 'Двигаем ближе или дальше (Shift)'
                    : 'Двигаем звезду по небу'}
                </span>
              </div>
            )}

            {/* Contextual Connect-Mode Helper */}
            {interactionMode === 'connect' && (
              <div className="pointer-events-none absolute top-14 xl:top-3 left-3 z-10 flex flex-col items-start gap-2 max-w-[calc(100%-24px)] xl:max-w-[calc(100%-340px)]">
                <div className="gl-hud !rounded-xl px-3 py-1.5 text-[11px] sm:text-xs text-gl-text-secondary">
                  {pendingSourceTitle
                    ? `Выберите вторую звезду для соединения с «${pendingSourceTitle}»`
                    : 'Выберите две звезды для линии или нажмите на связь'}
                </div>

                {(pendingLinkStarId || selectedConnection || connectNotice) && (
                  <div className="pointer-events-auto gl-hud !rounded-xl !border-amber-300/35 flex flex-wrap items-center gap-2 px-3 py-1.5 text-xs">
                    {connectNotice && !selectedConnection && (
                      <span className="text-amber-200">{connectNotice}</span>
                    )}

                    {pendingLinkStarId && (
                      <button
                        type="button"
                        onClick={() => setPendingLinkStarId(null)}
                        className="inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/20 px-2.5 py-1 font-medium text-white cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        Отменить выбор
                      </button>
                    )}

                    {selectedConnection && (
                      <>
                        <span className="text-amber-100 font-medium">
                          {starTitleById.get(selectedConnection.from) ?? 'Звезда'} ↔{' '}
                          {starTitleById.get(selectedConnection.to) ?? 'Звезда'}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteConnection(selectedConnection.id)}
                          className="inline-flex items-center gap-1 rounded-lg bg-rose-600 hover:bg-rose-500 px-2.5 py-1 font-semibold text-white cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Удалить связь
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedConnectionId(null)}
                          className="rounded-lg px-2 py-1 text-slate-300 hover:text-white cursor-pointer"
                          title="Снять выделение"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Compact Secondary Scene Controls (top-right bar) */}
            <div className="pointer-events-auto gl-hud absolute top-3 right-3 z-10 !rounded-xl p-1 flex items-center gap-1">
              <button
                type="button"
                onClick={handleOpenTutorial}
                title="Открыть обучение управлению холстом"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 h-[34px] text-xs font-medium text-gl-text-secondary hover:text-gl-text hover:bg-white/[0.08] whitespace-nowrap transition-colors cursor-pointer"
              >
                <HelpCircle className="w-3.5 h-3.5 text-gl-accent-light shrink-0" />
                <span>Как управлять?</span>
              </button>

              <button
                type="button"
                onClick={() => setReducedMotion((r) => !r)}
                aria-pressed={!reducedMotion}
                title={
                  reducedMotion
                    ? 'Включить плавное движение сцены'
                    : 'Уменьшить движение сцены'
                }
                aria-label={
                  reducedMotion
                    ? 'Включить плавное движение сцены'
                    : 'Уменьшить движение сцены'
                }
                className={`gl-btn-icon !min-w-[34px] !min-h-[34px] !w-[34px] !h-[34px] !p-0 !border-transparent ${
                  reducedMotion
                    ? '!bg-transparent text-gl-text-muted hover:!bg-white/[0.08]'
                    : '!bg-white/[0.08] text-gl-accent-light'
                }`}
              >
                <Activity className="w-4 h-4" />
              </button>

              <button
                type="button"
                data-testid="toggle-zen-mode"
                onClick={() => setZenMode((z) => !z)}
                aria-pressed={zenMode}
                title={zenMode ? 'Показать панели' : 'Скрыть панели'}
                aria-label={zenMode ? 'Показать панели' : 'Скрыть панели'}
                className="hidden md:inline-flex items-center gap-1.5 rounded-xl px-2.5 sm:px-3 h-[34px] text-xs font-semibold text-gl-text hover:bg-white/[0.1] whitespace-nowrap transition-colors cursor-pointer"
              >
                {zenMode ? (
                  <Minimize2 className="w-3.5 h-3.5 text-gl-accent-light shrink-0" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5 text-gl-accent-light shrink-0" />
                )}
                <span>{zenMode ? 'Показать панели' : 'Скрыть панели'}</span>
              </button>
            </div>

            <CanvasTutorialOverlay
              open={tutorialOpen}
              step={tutorialStep}
              movedStar={practiceMovedStar}
              rotatedScene={practiceRotatedScene}
              onStartPractice={() => {
                setPracticeMovedStar(false);
                setPracticeRotatedScene(false);
                setTutorialStep('practice');
                markTutorialCompleted();
              }}
              onComplete={handleCompleteTutorial}
              onDismiss={handleDismissTutorial}
            />

            {/* Bottom Single-Row Primary Dock (Arrange, Connect, Reset Camera) */}
            <div className="pointer-events-auto gl-hud absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex flex-nowrap items-center gap-1 !rounded-2xl p-1.5 max-w-[96%] overflow-x-auto">
              <button
                type="button"
                onClick={() => switchMode('arrange')}
                data-selected={interactionMode === 'arrange'}
                className="gl-tab inline-flex items-center gap-1.5 !min-h-[36px] sm:!min-h-[38px] !px-2.5 sm:!px-3 shrink-0"
              >
                <Hand className="w-3.5 h-3.5 shrink-0" />
                <span>Расположение</span>
              </button>

              <button
                type="button"
                onClick={() => switchMode('connect')}
                data-selected={interactionMode === 'connect'}
                className="gl-tab inline-flex items-center gap-1.5 !min-h-[36px] sm:!min-h-[38px] !px-2.5 sm:!px-3 shrink-0"
              >
                <Link2 className="w-3.5 h-3.5 shrink-0" />
                <span>Связи</span>
              </button>

              <button
                type="button"
                onClick={() => sceneRef.current?.resetCamera()}
                title="Вернуть камеру в исходное положение"
                className="gl-btn-secondary !bg-transparent !border-transparent hover:!bg-white/[0.08] !min-h-[36px] sm:!min-h-[38px] !px-2.5 sm:!px-3 !py-1.5 text-xs font-medium shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                <span>Сброс</span>
              </button>
            </div>
                  </div>
                )}
              </main>
            )}

            {/* Column 3: Right Panel — Step-driven Workshop Content */}
            <aside
              data-testid="workshop-right-panel"
              data-zen={zenMode}
              aria-hidden={isDesktopMd ? zenMode : undefined}
              inert={zenMode && isDesktopMd ? true : undefined}
              className={`${
                mobilePane === 'panel' ? 'flex' : 'hidden'
              } md:flex gl-editor-sidebar-right-shell shrink-0 flex-col md:border-l gl-glass-panel min-h-0 flex-1 md:flex-none overflow-hidden ${
                zenMode ? 'md:pointer-events-none' : 'md:pointer-events-auto'
              }`}
            >
              <div
                className={`gl-editor-sidebar-right-inner flex-1 min-h-0 flex flex-col md:transition-[transform,opacity] md:duration-300 md:ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
                  zenMode ? 'md:translate-x-full md:opacity-0' : 'md:translate-x-0 md:opacity-100'
                }`}
              >
                {/* Compact Horizontal Star Strip on Step 1 for < lg screens (portrait phones, landscape phones, tablets) */}
                {activeStep === 'stars' && (
                  <div className="lg:hidden shrink-0">
                    <StarList
                      layout="strip"
                      stars={project.stars}
                      selectedStarId={activeStar?.id ?? ''}
                      globalGlowColor={project.globalGlowColor}
                      onSelectStar={handleSelectStarFromList}
                      onAddStar={handleAddStar}
                      onRemoveStar={handleRemoveStar}
                    />
                  </div>
                )}

                {/* Step Body */}
                <div className="flex-1 min-h-0 overflow-y-auto p-3.5 sm:p-4 overscroll-contain">
                  {activeStep === 'stars' &&
                    (activeStar ? (
                      <StarEditor
                        projectId={project.id}
                        occasion={project.occasion}
                        recipientName={project.recipientName}
                        star={activeStar}
                        starIndex={activeStarIndex}
                        globalGlowColor={project.globalGlowColor}
                        editStep={starEditStep}
                        hasNextStar={hasNextStar}
                        onEditStepChange={handleStarEditStepChange}
                        onNextStarOrConstellation={handleNextStarOrConstellation}
                        onChange={handleUpdateStar}
                      />
                    ) : (
                      <div
                        data-testid="stars-empty-state"
                        className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] p-6 text-center space-y-3"
                      >
                        <p className="text-sm text-gl-text-secondary leading-relaxed">
                          У вас пока нет звезд. Нажмите +, чтобы добавить
                        </p>
                        <button
                          type="button"
                          onClick={handleAddStar}
                          className="gl-btn-primary !min-h-[40px] !px-4 text-xs"
                        >
                          + Добавить звезду
                        </button>
                      </div>
                    ))}

                  {activeStep === 'card' && (
                    <CardEditorPanel
                      project={project}
                      device={cardDevice}
                      cardPhase={cardIframePhase}
                      cardStarIndex={cardIframeStarIndex}
                      activeTab={cardTab}
                      focusedField={cardFocusedField}
                      onChangeDevice={setCardDevice}
                      onChangeTab={(tab, target) => {
                        setCardTab(tab);
                        setCardFocusedField(null);
                        if (target) setCardSelectedTarget(target);
                      }}
                      onSelectCardTargetView={handleCardSelectTargetView}
                      onPatchProject={handleCardPatchProject}
                      onPatchStar={handleCardPatchStar}
                      onResetDeviceLayout={(nextProject) =>
                        onUpdateProject(() => nextProject)
                      }
                    />
                  )}

                  {(activeStep === 'constellation' || activeStep === 'atmosphere') && (
                    <ConstellationSettings
                      project={project}
                      section={activeStep}
                      selectedConnectionId={selectedConnectionId}
                      reducedMotion={reducedMotion}
                      onChange={(patch) =>
                        onUpdateProject((prev) => ({ ...prev, ...patch }))
                      }
                      onSelectConnection={handleSelectConnection}
                      onDeleteConnection={handleDeleteConnection}
                      onToggleReducedMotion={() => setReducedMotion((r) => !r)}
                    />
                  )}
                </div>

                {/* Step Navigation Footer: Назад / Далее */}
                <div className="gl-workshop-footer shrink-0 border-t border-white/10 bg-black/10 px-3.5 py-2.5 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => prevStep && goToStep(prevStep.id)}
                    disabled={!prevStep}
                    className="gl-btn-secondary !min-h-[38px] !px-3 text-xs"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 shrink-0" />
                    <span>Назад</span>
                  </button>

                  {nextStep ? (
                    <button
                      type="button"
                      onClick={() => goToStep(nextStep.id)}
                      className="gl-btn-primary !min-h-[38px] !px-3.5 text-xs"
                    >
                      <span>Далее</span>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowExport(true)}
                      className="gl-btn-primary !min-h-[38px] !px-3.5 text-xs"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span>Скачать ZIP</span>
                    </button>
                  )}
                </div>
              </div>
            </aside>
          </>
        )}
      </div>

      {/* Mobile Compact 2-Pane Switcher (< md only on Steps 1-4; md+ shows Live Result + Workshop Panel side-by-side) */}
      {activeStep !== 'preview' && (
        <nav
          aria-label="Переключение между настройками и результатом"
          className="md:hidden shrink-0 border-t gl-glass-panel gl-safe-bottom grid grid-cols-2 p-1.5 gap-1.5"
        >
          <button
            type="button"
            data-testid="mobile-pane-panel"
            onClick={() => setMobilePane('panel')}
            data-selected={mobilePane === 'panel'}
            className="gl-tab !min-h-[40px] flex items-center justify-center gap-1.5"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span>Настройки</span>
          </button>

          <button
            type="button"
            data-testid="mobile-pane-stage"
            onClick={() => setMobilePane('scene')}
            data-selected={mobilePane === 'scene'}
            className="gl-tab !min-h-[40px] flex items-center justify-center gap-1.5"
          >
            {activeStep === 'card' || (activeStep === 'stars' && starsCenterView === 'card') ? (
              <>
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span>{activeStep === 'card' ? 'Открытка' : 'Карточка'}</span>
              </>
            ) : (
              <>
                <Orbit className="w-3.5 h-3.5 shrink-0" />
                <span>3D-результат</span>
              </>
            )}
          </button>
        </nav>
      )}

      {showExport && (
        <ExportModal
          project={project}
          onClose={() => setShowExport(false)}
          onSelectStar={(starId) => {
            const target = project.stars.find((s) => s.id === starId);
            const targetSubStep: StarEditStep =
              target && target.title.trim().length === 0
                ? 'title'
                : 'message';
            setSelectedStarId(starId);
            setStarSubStepById((prev) => ({ ...prev, [starId]: targetSubStep }));
            setStarEditStep(targetSubStep);
            setStarsCenterView('3d');
            goToStep('stars');
            setMobilePane('panel');
          }}
        />
      )}
    </div>
  );
}
