import { useRef, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  Download,
  Eye,
  Hand,
  HelpCircle,
  Link2,
  Maximize2,
  Minimize2,
  Orbit,
  RotateCcw,
  Settings,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import {
  computeAutoDepthForIndex,
  makeConnectionId,
} from '../scene/paletteConfig';
import type {
  ConstellationProject,
  ConstellationStar,
  EditorInteractionMode,
  StarPosition3D,
} from '../types/project';
import {
  CANVAS_TUTORIAL_STORAGE_KEY,
  CanvasTutorialOverlay,
  type TutorialStep,
} from './CanvasTutorialOverlay';
import { Constellation3D, type Constellation3DHandle } from './Constellation3D';
import { ConstellationSettings } from './ConstellationSettings';
import { ExportModal } from './ExportModal';
import { StarEditor } from './StarEditor';
import { StarList } from './StarList';

interface EditorLayoutProps {
  project: ConstellationProject;
  saveState: 'saved' | 'saving';
  onUpdateProject: (updater: (prev: ConstellationProject) => ConstellationProject) => void;
  onBackToProjects: () => void;
  onOpenPreview: () => void;
}

type RightTab = 'star' | 'constellation' | 'space';
type MobileSection = 'scene' | 'stars' | 'settings';

export function EditorLayout({
  project,
  saveState,
  onUpdateProject,
  onBackToProjects,
  onOpenPreview,
}: EditorLayoutProps) {
  const sceneRef = useRef<Constellation3DHandle | null>(null);

  const [selectedStarId, setSelectedStarId] = useState<string>(
    project.stars[0]?.id ?? '',
  );
  const [interactionMode, setInteractionMode] =
    useState<EditorInteractionMode>('arrange');
  const [pendingLinkStarId, setPendingLinkStarId] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(
    null,
  );
  const [connectNotice, setConnectNotice] = useState<string | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>('star');
  const [mobileSection, setMobileSection] = useState<MobileSection>('scene');
  const [zenMode, setZenMode] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const [tutorialOpen, setTutorialOpen] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(CANVAS_TUTORIAL_STORAGE_KEY) !== '1';
    } catch {
      return false;
    }
  });
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
    setMobileSection('scene');
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

  const switchMode = (nextMode: EditorInteractionMode) => {
    setInteractionMode(nextMode);
    if (nextMode !== 'connect') {
      setPendingLinkStarId(null);
      setSelectedConnectionId(null);
      setConnectNotice(null);
    }
  };

  const handleSelectStarFromList = (starId: string) => {
    setSelectedStarId(starId);
    setRightTab('star');
  };

  const handleSelectStarOnScene = (starId: string) => {
    if (interactionMode !== 'connect') {
      setSelectedStarId(starId);
      setRightTab('star');
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
    if (project.stars.length >= 7) return;
    const idx = project.stars.length;
    const angle = idx * 1.1;
    const x = Number((Math.cos(angle) * 2.4).toFixed(2));
    const y = Number((Math.sin(angle) * 1.6).toFixed(2));
    const z = computeAutoDepthForIndex(idx, x, y);

    const newStar: ConstellationStar = {
      id: `star_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      order: idx,
      title: `Звезда ${idx + 1}`,
      message: '',
      illustration: { type: 'builtin', id: 'comet' },
      shape: 'star',
      glowColor: 'inherit',
      position: { x, y, z },
    };

    onUpdateProject((prev) => ({
      ...prev,
      stars: [...prev.stars, newStar],
    }));
    setSelectedStarId(newStar.id);
    setRightTab('star');
  };

  const handleRemoveStar = (starId: string) => {
    if (project.stars.length <= 5) return;
    if (pendingLinkStarId === starId) setPendingLinkStarId(null);
    onUpdateProject((prev) => {
      const filtered = prev.stars
        .filter((s) => s.id !== starId)
        .map((s, idx) => ({ ...s, order: idx }));
      const nextConnections = prev.connections.filter(
        (c) => c.from !== starId && c.to !== starId,
      );
      if (selectedStarId === starId && filtered[0]) {
        setSelectedStarId(filtered[0].id);
      }
      if (
        selectedConnectionId &&
        !nextConnections.some((c) => c.id === selectedConnectionId)
      ) {
        setSelectedConnectionId(null);
      }
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

  return (
    <div className="gl-h-screen w-screen overflow-hidden bg-gl-bg text-gl-text flex flex-col">
      {/* Top Studio Header */}
      <header className="min-h-14 shrink-0 border-b gl-panel gl-safe-top px-3 sm:px-5 py-1.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToProjects}
            className="gl-btn-secondary !px-3 !py-1.5 text-xs shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Проекты</span>
          </button>

          <div className="min-w-0">
            <h1 className="font-display text-sm sm:text-base font-bold text-gl-text truncate">
              {project.title || 'Новое созвездие'}
            </h1>
            <p className="text-[11px] text-gl-text-muted truncate">
              {saveState === 'saving' ? 'Сохранение...' : 'Сохранено на устройстве'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenPreview}
            className="gl-btn-secondary !px-3 !py-2 text-xs text-gl-text"
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Режим получателя</span>
            <span className="sm:hidden">Просмотр</span>
          </button>

          <button
            type="button"
            onClick={() => setShowExport(true)}
            className="gl-btn-primary !px-3.5 !py-2 text-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Скачать ZIP</span>
          </button>
        </div>
      </header>

      {/* Main Workspace: 3 columns on lg+, sequential view on mobile */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row relative">
        {/* Left Panel: Stars List (240px on 1024-1439, 280px on 1440+) */}
        {!zenMode && (
          <aside
            className={`${
              mobileSection === 'stars' ? 'flex' : 'hidden'
            } lg:flex gl-editor-sidebar-left shrink-0 flex-col border-b lg:border-b-0 lg:border-r gl-panel min-h-0 flex-1 lg:flex-none`}
          >
            <StarList
              stars={project.stars}
              selectedStarId={activeStar?.id ?? ''}
              globalGlowColor={project.globalGlowColor}
              onSelectStar={(id) => {
                handleSelectStarFromList(id);
                setMobileSection('settings');
              }}
              onAddStar={handleAddStar}
              onRemoveStar={handleRemoveStar}
            />
          </aside>
        )}

        {/* Center Area: Live 3D Scene */}
        <main
          className={`${
            mobileSection === 'scene' ? 'flex' : 'hidden'
          } lg:flex flex-1 min-w-0 min-h-0 relative flex-col`}
        >
          <div className="flex-1 min-h-0 relative">
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
              lowPerformance={typeof window !== 'undefined' && window.innerWidth < 768}
              reducedMotion={reducedMotion}
              onSelectStar={handleSelectStarOnScene}
              onSelectConnection={handleSelectConnection}
              onMoveStar={handleMoveStar}
              onCameraOrbit={() => {
                if (tutorialOpen && tutorialStep === 'practice') {
                  setPracticeRotatedScene(true);
                }
              }}
            />

            {/* Contextual Connect-Mode Helper (top-left, shown only when connecting or editing a link) */}
            {interactionMode === 'connect' && (
              <div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-col items-start gap-2 max-w-[calc(100%-220px)]">
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
            <div className="gl-hud absolute top-3 right-3 z-10 !rounded-xl p-1 flex items-center gap-1">
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
                onClick={() => setZenMode((z) => !z)}
                aria-pressed={zenMode}
                title={zenMode ? 'Показать боковые панели' : 'Развернуть 3D-сцену'}
                aria-label={zenMode ? 'Показать боковые панели' : 'Развернуть 3D-сцену'}
                className="hidden lg:inline-flex gl-btn-icon !min-w-[34px] !min-h-[34px] !w-[34px] !h-[34px] !p-0 !border-transparent !bg-transparent hover:!bg-white/[0.08]"
              >
                {zenMode ? (
                  <Minimize2 className="w-4 h-4" />
                ) : (
                  <Maximize2 className="w-4 h-4" />
                )}
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

            {/* Bottom Single-Row Primary Dock (4 core actions) */}
            <div className="gl-hud absolute bottom-3 left-1/2 -translate-x-1/2 z-10 flex flex-nowrap items-center gap-1 !rounded-2xl p-1.5 max-w-[96%] overflow-x-auto">
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
                onClick={() => switchMode('orbit')}
                data-selected={interactionMode === 'orbit'}
                className="gl-tab inline-flex items-center gap-1.5 !min-h-[36px] sm:!min-h-[38px] !px-2.5 sm:!px-3 shrink-0"
              >
                <Orbit className="w-3.5 h-3.5 shrink-0" />
                <span>Обзор 3D</span>
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
        </main>

        {/* Right Panel: 3 Settings Tabs (320px on 1024-1439, 360px on 1440+) */}
        {!zenMode && (
          <aside
            className={`${
              mobileSection === 'settings' ? 'flex' : 'hidden'
            } lg:flex gl-editor-sidebar-right shrink-0 flex-col border-t lg:border-t-0 lg:border-l gl-panel min-h-0 flex-1 lg:flex-none`}
          >
            <div className="gl-tab-group grid-cols-3 shrink-0">
              <button
                type="button"
                onClick={() => setRightTab('star')}
                data-selected={rightTab === 'star'}
                className="gl-tab"
              >
                Звезда
              </button>
              <button
                type="button"
                onClick={() => setRightTab('constellation')}
                data-selected={rightTab === 'constellation'}
                className="gl-tab"
              >
                Созвездие
              </button>
              <button
                type="button"
                onClick={() => setRightTab('space')}
                data-selected={rightTab === 'space'}
                className="gl-tab"
              >
                Космос
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-4 overscroll-contain">
              {rightTab === 'star' && activeStar ? (
                <StarEditor
                  projectId={project.id}
                  occasion={project.occasion}
                  star={activeStar}
                  starIndex={activeStarIndex}
                  globalGlowColor={project.globalGlowColor}
                  onChange={handleUpdateStar}
                />
              ) : (
                <ConstellationSettings
                  project={project}
                  section={rightTab === 'constellation' ? 'constellation' : 'space'}
                  selectedConnectionId={selectedConnectionId}
                  reducedMotion={reducedMotion}
                  onChange={(patch) =>
                    onUpdateProject((prev) => ({ ...prev, ...patch }))
                  }
                  onSelectConnection={handleSelectConnection}
                  onDeleteConnection={handleDeleteConnection}
                  onEnterConnectMode={() => {
                    switchMode('connect');
                    setMobileSection('scene');
                  }}
                  onToggleReducedMotion={() => setReducedMotion((r) => !r)}
                />
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Mobile Sequential Tab Switcher (< lg) */}
      <nav className="lg:hidden shrink-0 border-t gl-panel gl-safe-bottom grid grid-cols-3 p-1.5 gap-1">
        <button
          type="button"
          onClick={() => setMobileSection('scene')}
          data-selected={mobileSection === 'scene'}
          className="gl-tab flex items-center justify-center gap-1.5"
        >
          <Orbit className="w-4 h-4" />
          Сцена
        </button>
        <button
          type="button"
          onClick={() => setMobileSection('stars')}
          data-selected={mobileSection === 'stars'}
          className="gl-tab flex items-center justify-center gap-1.5"
        >
          <Star className="w-4 h-4" />
          Звёзды ({project.stars.length})
        </button>
        <button
          type="button"
          onClick={() => setMobileSection('settings')}
          data-selected={mobileSection === 'settings'}
          className="gl-tab flex items-center justify-center gap-1.5"
        >
          <Settings className="w-4 h-4" />
          Настройки
        </button>
      </nav>

      {showExport && (
        <ExportModal
          project={project}
          onClose={() => setShowExport(false)}
          onSelectStar={(starId) => {
            handleSelectStarFromList(starId);
            setMobileSection('settings');
          }}
        />
      )}
    </div>
  );
}
