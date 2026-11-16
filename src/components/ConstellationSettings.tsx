import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Hand,
  Link2,
  Monitor,
  Music,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  Type,
} from 'lucide-react';
import { CompositionPresetPreview } from '../assets/shapePreviews';
import {
  COMPOSITION_PRESETS,
  COSMIC_PALETTES,
  DEFAULT_CONSTELLATION_LAYOUT,
  GLOW_COLORS,
  MUSIC_TRACKS,
  OCCASION_PRESETS,
  applyCompositionPreset,
  buildProjectConstellationDevicePatch,
  resolveEffectiveConstellationLayout,
} from '../scene/paletteConfig';
import { getMusicTrackBlob } from '../services/musicEngine';
import type {
  CompositionPresetId,
  ConstellationProject,
  CosmicPaletteId,
  DeviceConstellationLayout,
  DeviceLayoutKey,
  EditorInteractionMode,
  GlowColorId,
  MusicTrackId,
  OccasionId,
  StarPosition3D,
} from '../types/project';
import { CardLibraryPanel } from './CardLibraryPanel';
import { TextStyleEditor } from './TextStyleEditor';

interface ConstellationSettingsProps {
  project: ConstellationProject;
  section?: 'constellation' | 'card' | 'atmosphere' | 'space' | 'all';
  selectedConnectionId?: string | null;
  reducedMotion?: boolean;
  interactionMode?: EditorInteractionMode;
  activeStarTitle?: string;
  activeStarPosition?: StarPosition3D;
  onChange: (patch: Partial<ConstellationProject>) => void;
  onSelectConnection?: (connectionId: string | null) => void;
  onDeleteConnection?: (connectionId: string) => void;
  onEnterConnectMode?: () => void;
  onSwitchMode?: (mode: EditorInteractionMode) => void;
  onResetCamera?: () => void;
  onToggleReducedMotion?: () => void;
}

export function ConstellationSettings({
  project,
  section = 'all',
  selectedConnectionId = null,
  reducedMotion = false,
  interactionMode = 'arrange',
  activeStarTitle,
  activeStarPosition,
  onChange,
  onSelectConnection,
  onDeleteConnection,
  onEnterConnectMode,
  onSwitchMode,
  onResetCamera,
  onToggleReducedMotion,
}: ConstellationSettingsProps) {
  const [auditionTrackId, setAuditionTrackId] = useState<MusicTrackId | null>(null);
  const [constellationAdvancedOpen, setConstellationAdvancedOpen] = useState(false);
  const [constellationDevice, setConstellationDevice] = useState<DeviceLayoutKey>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'phone' : 'desktop',
  );
  const [cardAdvancedOpen, setCardAdvancedOpen] = useState(false);
  const [atmosphereAdvancedOpen, setAtmosphereAdvancedOpen] = useState(false);
  const [finalStyleOpen, setFinalStyleOpen] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  const activeConstellationLayout = resolveEffectiveConstellationLayout(
    project,
    constellationDevice,
  );

  const updateConstellationLayout = (patch: Partial<DeviceConstellationLayout>) => {
    onChange(
      buildProjectConstellationDevicePatch(project, constellationDevice, patch),
    );
  };

  const resetConstellationLayout = () => {
    onChange(
      buildProjectConstellationDevicePatch(
        project,
        constellationDevice,
        DEFAULT_CONSTELLATION_LAYOUT[constellationDevice],
      ),
    );
  };

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  const toggleAudition = (trackId: MusicTrackId) => {
    if (trackId === 'none') return;

    if (auditionTrackId === trackId) {
      audioRef.current?.pause();
      setAuditionTrackId(null);
      return;
    }

    audioRef.current?.pause();
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }

    const blob = getMusicTrackBlob(trackId);
    if (!blob) return;

    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = 0.55;
    audioRef.current = audio;

    audio
      .play()
      .then(() => setAuditionTrackId(trackId))
      .catch(() => setAuditionTrackId(null));
  };

  const handleApplyComposition = (presetId: CompositionPresetId) => {
    const composed = applyCompositionPreset(project.stars, presetId);
    onChange({
      composition: presetId,
      stars: composed.stars,
      connections: composed.connections,
    });
  };

  const starTitleById = new Map(
    project.stars.map((s, idx) => [s.id, s.title.trim() || `Звезда ${idx + 1}`]),
  );

  const showConstellation = section === 'all' || section === 'constellation';
  const showCard = section === 'all' || section === 'space' || section === 'card';
  const showAtmosphere =
    section === 'all' || section === 'space' || section === 'atmosphere';

  return (
    <div className="space-y-4">
      {showConstellation && (
        <>
          <div>
            <h3 className="font-display text-sm font-semibold text-gl-text">
              Сборка созвездия
            </h3>
            <p className="text-[11px] text-gl-text-muted mt-0.5">
              Расставь звёзды на небе и соедини их линиями
            </p>
          </div>

          {/* Quick 3D Interaction Controls */}
          {onSwitchMode && (
            <div className="space-y-2">
              <span className="gl-label block">Действие на сцене</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  data-selected={interactionMode === 'arrange'}
                  onClick={() => onSwitchMode('arrange')}
                  className="gl-choice px-2.5 py-2 text-xs font-medium flex items-center justify-center gap-1.5"
                >
                  <Hand className="w-3.5 h-3.5 shrink-0" />
                  Двигать звёзды
                </button>
                <button
                  type="button"
                  data-selected={interactionMode === 'connect'}
                  onClick={() => {
                    onSwitchMode('connect');
                    onEnterConnectMode?.();
                  }}
                  className="gl-choice px-2.5 py-2 text-xs font-medium flex items-center justify-center gap-1.5"
                >
                  <Link2 className="w-3.5 h-3.5 shrink-0" />
                  Соединять
                </button>
              </div>
              {onResetCamera && (
                <button
                  type="button"
                  onClick={onResetCamera}
                  className="gl-btn-secondary w-full !min-h-[36px] text-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                  Вернуть камеру в центр
                </button>
              )}
            </div>
          )}

          {/* Constellation Composition Presets */}
          <div className="space-y-2">
            <span className="gl-label block">Готовая форма</span>
            <div className="grid grid-cols-3 gap-2">
              {COMPOSITION_PRESETS.map((preset) => {
                const active = (project.composition ?? 'free') === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    data-selected={active}
                    title={preset.description}
                    onClick={() => handleApplyComposition(preset.id)}
                    className="gl-choice px-2 py-2.5 flex flex-col items-center gap-1.5 text-center"
                  >
                    <CompositionPresetPreview
                      preset={preset.id}
                      color={COSMIC_PALETTES[project.paletteId].lineTint}
                      className="w-10 h-8"
                    />
                    <span className="text-[11px] font-semibold leading-tight">
                      {preset.name === 'Свободная композиция' ? 'Свободная' : preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Star Connections & Connection List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="gl-label tabular-nums">
                Линии между звёздами ({project.connections.length})
              </span>
              {!onSwitchMode && onEnterConnectMode && (
                <button
                  type="button"
                  onClick={onEnterConnectMode}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-gl-accent-light hover:text-gl-text cursor-pointer"
                >
                  <Link2 className="w-3 h-3" />
                  Соединить
                </button>
              )}
            </div>

            {project.connections.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/12 bg-white/[0.02] px-3 py-2.5 text-xs text-gl-text-muted leading-relaxed">
                Линий пока нет. Выбери готовую форму выше или включи «Соединять» и нажми на две звезды на сцене.
              </p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-0.5">
                {project.connections.map((conn) => {
                  const isSelected = conn.id === selectedConnectionId;
                  const fromName = starTitleById.get(conn.from) ?? 'Звезда';
                  const toName = starTitleById.get(conn.to) ?? 'Звезда';
                  return (
                    <div
                      key={conn.id}
                      className={`flex items-center justify-between gap-2 rounded-xl border px-2.5 py-1.5 text-xs transition-colors ${
                        isSelected
                          ? 'border-amber-300/70 bg-amber-500/15 text-amber-100'
                          : 'border-white/10 bg-white/[0.03] text-gl-text-secondary'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectConnection?.(isSelected ? null : conn.id)}
                        className="flex-1 min-w-0 text-left truncate cursor-pointer"
                      >
                        {fromName} ↔ {toName}
                      </button>
                      {onDeleteConnection && (
                        <button
                          type="button"
                          onClick={() => onDeleteConnection(conn.id)}
                          title="Удалить связь"
                          aria-label={`Удалить связь ${fromName} — ${toName}`}
                          className="gl-btn-icon !min-w-[28px] !min-h-[28px] !w-7 !h-7 !p-0 border-transparent bg-transparent text-gl-text-muted hover:text-rose-300 hover:bg-rose-500/15 shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Collapsible Device Framing & 3D Navigation Tips */}
          <div className="rounded-xl border border-white/10 bg-white/[0.025] overflow-hidden">
            <button
              type="button"
              onClick={() => setConstellationAdvancedOpen((o) => !o)}
              aria-expanded={constellationAdvancedOpen}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold text-gl-text-secondary hover:text-gl-text hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-gl-accent-light shrink-0" />
                Положение на экране и подсказки
              </span>
              {constellationAdvancedOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-gl-text-muted shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-gl-text-muted shrink-0" />
              )}
            </button>

            {constellationAdvancedOpen && (
              <div className="border-t border-white/10 p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="inline-flex items-center gap-1 p-0.5 rounded-lg bg-gl-input border border-white/10">
                    <button
                      type="button"
                      data-selected={constellationDevice === 'phone'}
                      onClick={() => setConstellationDevice('phone')}
                      className="gl-tab !min-h-[28px] !px-2 text-[11px] inline-flex items-center gap-1"
                    >
                      <Smartphone className="w-3 h-3" />
                      <span>Телефон</span>
                    </button>
                    <button
                      type="button"
                      data-selected={constellationDevice === 'desktop'}
                      onClick={() => setConstellationDevice('desktop')}
                      className="gl-tab !min-h-[28px] !px-2 text-[11px] inline-flex items-center gap-1"
                    >
                      <Monitor className="w-3 h-3" />
                      <span>Компьютер</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={resetConstellationLayout}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-gl-accent-light hover:text-gl-text cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Сброс
                  </button>
                </div>

                <label className="block space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gl-text-secondary font-medium">
                      Масштаб в открытке
                    </span>
                    <span className="text-gl-text-muted">Дальше — Крупнее</span>
                  </div>
                  <input
                    type="range"
                    min={0.55}
                    max={1.45}
                    step={0.05}
                    value={activeConstellationLayout.scale}
                    aria-label="Размер созвездия на экране"
                    onChange={(e) =>
                      updateConstellationLayout({ scale: Number(e.target.value) })
                    }
                    className="w-full accent-gl-accent cursor-pointer"
                  />
                </label>

                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { label: 'Левее', value: -35 },
                      { label: 'Центр', value: 0 },
                      { label: 'Правее', value: 35 },
                    ] as const
                  ).map((pos) => (
                    <button
                      key={pos.label}
                      type="button"
                      data-selected={
                        Math.abs(activeConstellationLayout.offsetX - pos.value) < 15
                      }
                      onClick={() => updateConstellationLayout({ offsetX: pos.value })}
                      className="gl-choice py-1.5 text-[11px] font-medium"
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { label: 'Выше', value: 28 },
                      { label: 'Середина', value: constellationDevice === 'phone' ? 8 : 0 },
                      { label: 'Ниже', value: -28 },
                    ] as const
                  ).map((pos) => (
                    <button
                      key={pos.label}
                      type="button"
                      data-selected={
                        Math.abs(activeConstellationLayout.offsetY - pos.value) < 12
                      }
                      onClick={() => updateConstellationLayout({ offsetY: pos.value })}
                      className="gl-choice py-1.5 text-[11px] font-medium"
                    >
                      {pos.label}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5 pt-2 border-t border-white/10 text-[11px] text-gl-text-muted leading-relaxed">
                  <p>
                    <span className="text-gl-text font-medium">Глубина:</span> удерживай{' '}
                    <span className="text-amber-200 font-semibold">Shift</span> при
                    перетаскивании звезды вверх или вниз.
                  </p>
                  <p>
                    <span className="text-gl-text font-medium">Поворот:</span> крути сцену
                    правой кнопкой мыши или одним пальцем по пустому небу.
                  </p>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {showCard && (
        <>
          <CardLibraryPanel
            project={project}
            onChange={onChange}
            compact
            collapsibleColors
          />

          {/* Final Greeting Message */}
          <label className="block space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-xs">
              <span className="gl-label">Текст финального письма</span>
              <span className="text-gl-text-muted tabular-nums">
                {project.finalMessage.length}/800
              </span>
            </div>
            <textarea
              rows={4}
              maxLength={800}
              value={project.finalMessage}
              onChange={(e) => onChange({ finalMessage: e.target.value })}
              placeholder="Главное поздравление появится на открытке, когда откроются все звёзды..."
              className="gl-textarea resize-y leading-relaxed"
            />
          </label>

          {/* Recipient & Sender */}
          <div className="grid grid-cols-2 gap-2">
            <label className="block space-y-1">
              <span className="text-[11px] text-gl-text-muted block">Кому</span>
              <input
                type="text"
                maxLength={40}
                value={project.recipientName}
                onChange={(e) => onChange({ recipientName: e.target.value })}
                placeholder="Имя получателя"
                className="gl-input"
              />
            </label>

            <label className="block space-y-1">
              <span className="text-[11px] text-gl-text-muted block">От кого</span>
              <input
                type="text"
                maxLength={40}
                value={project.senderName ?? ''}
                onChange={(e) => onChange({ senderName: e.target.value })}
                placeholder="Твоё имя"
                className="gl-input"
              />
            </label>
          </div>

          {/* Collapsible Advanced Card Options */}
          <div className="rounded-xl border border-white/10 bg-white/[0.025] overflow-hidden">
            <button
              type="button"
              onClick={() => setCardAdvancedOpen((o) => !o)}
              aria-expanded={cardAdvancedOpen}
              className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold text-gl-text-secondary hover:text-gl-text hover:bg-white/[0.04] transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center gap-1.5">
                <SlidersHorizontal className="w-3.5 h-3.5 text-gl-accent-light shrink-0" />
                Дополнительно
              </span>
              {cardAdvancedOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-gl-text-muted shrink-0" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-gl-text-muted shrink-0" />
              )}
            </button>

            {cardAdvancedOpen && (
              <div className="border-t border-white/10 p-3 space-y-3">
                <label className="block space-y-1">
                  <span className="text-[11px] text-gl-text-muted block">
                    Название подарка
                  </span>
                  <input
                    type="text"
                    maxLength={50}
                    value={project.title}
                    onChange={(e) => onChange({ title: e.target.value })}
                    className="gl-input"
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-[11px] text-gl-text-muted block">Повод</span>
                  <select
                    value={project.occasion}
                    onChange={(e) => {
                      const occId = e.target.value as OccasionId;
                      const found = OCCASION_PRESETS.find((p) => p.id === occId);
                      onChange({
                        occasion: occId,
                        occasionLabel: found?.label ?? 'Свой повод',
                      });
                    }}
                    className="gl-select"
                  >
                    {OCCASION_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setFinalStyleOpen((o) => !o)}
                    aria-expanded={finalStyleOpen}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-gl-text-secondary hover:text-gl-text hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Type className="w-3.5 h-3.5 text-gl-accent-light shrink-0" />
                      Шрифт и вид финального текста
                    </span>
                    {finalStyleOpen ? (
                      <ChevronUp className="w-3.5 h-3.5 text-gl-text-muted shrink-0" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-gl-text-muted shrink-0" />
                    )}
                  </button>

                  {finalStyleOpen && (
                    <div className="border-t border-white/10 p-3 pt-1">
                      <TextStyleEditor
                        value={project.finalTextStyle}
                        paletteId={project.paletteId}
                        glowColorId={project.globalGlowColor}
                        cardTheme={project.cardTheme}
                        cardColors={project.cardColors}
                        previewTitle={project.title}
                        previewMessage={project.finalMessage}
                        showLayoutControls={false}
                        onChange={(finalTextStyle) => onChange({ finalTextStyle })}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {showAtmosphere && (
        <>
          <div>
            <h3 className="font-display text-sm font-semibold text-gl-text">
              Атмосфера космоса
            </h3>
            <p className="text-[11px] text-gl-text-muted mt-0.5">
              Выбери фон неба, цвет сияния звёзд и музыку
            </p>
          </div>

          {/* 4 Cosmic Gradient Backgrounds */}
          <div className="space-y-2">
            <span className="gl-label block">Космический фон</span>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(COSMIC_PALETTES) as CosmicPaletteId[]).map((pid) => {
                const pal = COSMIC_PALETTES[pid];
                const active = project.paletteId === pid;
                return (
                  <button
                    key={pid}
                    type="button"
                    data-selected={active}
                    onClick={() => onChange({ paletteId: pid })}
                    className="gl-choice p-2 text-left"
                  >
                    <div
                      className="h-8 w-full rounded-lg mb-1.5 border border-white/15"
                      style={{ background: pal.cssGradient }}
                    />
                    <div className="text-xs font-semibold text-gl-text leading-snug">
                      {pal.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Global Glow Color Palette */}
          <div className="space-y-2">
            <span className="gl-label block">Цвет сияния звёзд</span>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(GLOW_COLORS) as GlowColorId[]).map((gid) => {
                const g = GLOW_COLORS[gid];
                const active = project.globalGlowColor === gid;
                return (
                  <button
                    key={gid}
                    type="button"
                    data-selected={active}
                    onClick={() => onChange({ globalGlowColor: gid })}
                    className="gl-choice inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium"
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0 border border-white/25"
                      style={{ backgroundColor: g.hex }}
                    />
                    {g.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Music Selector */}
          <div className="space-y-2">
            <span className="gl-label block">Музыка</span>
            <div className="space-y-1.5">
              {MUSIC_TRACKS.map((track) => {
                const active = project.musicTrackId === track.id;
                const playing = auditionTrackId === track.id;
                return (
                  <div
                    key={track.id}
                    data-selected={active}
                    className="gl-choice flex items-center justify-between gap-2 px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => onChange({ musicTrackId: track.id })}
                      className="flex-1 min-w-0 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2 text-xs font-semibold text-gl-text">
                        <Music className="w-3.5 h-3.5 text-gl-accent-light shrink-0" />
                        <span className="truncate">{track.name}</span>
                      </div>
                      <p className="text-[11px] text-gl-text-muted truncate mt-0.5">
                        {track.mood}
                      </p>
                    </button>

                    {track.id !== 'none' && (
                      <button
                        type="button"
                        onClick={() => toggleAudition(track.id)}
                        title={playing ? 'Остановить прослушивание' : 'Прослушать'}
                        className="gl-btn-icon !min-w-[34px] !min-h-[34px] shrink-0"
                      >
                        {playing ? (
                          <Pause className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Collapsible Advanced Scene Motion */}
          {onToggleReducedMotion && (
            <div className="rounded-xl border border-white/10 bg-white/[0.025] overflow-hidden">
              <button
                type="button"
                onClick={() => setAtmosphereAdvancedOpen((o) => !o)}
                aria-expanded={atmosphereAdvancedOpen}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-semibold text-gl-text-secondary hover:text-gl-text hover:bg-white/[0.04] transition-colors cursor-pointer"
              >
                <span className="inline-flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-gl-accent-light shrink-0" />
                  Дополнительно
                </span>
                {atmosphereAdvancedOpen ? (
                  <ChevronUp className="w-3.5 h-3.5 text-gl-text-muted shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-gl-text-muted shrink-0" />
                )}
              </button>

              {atmosphereAdvancedOpen && (
                <div className="border-t border-white/10 p-3 space-y-2">
                  <button
                    type="button"
                    data-selected={!reducedMotion}
                    onClick={onToggleReducedMotion}
                    className="gl-choice w-full px-3 py-2 text-xs font-medium text-center"
                  >
                    {reducedMotion
                      ? 'Плавное движение сцены: выключено'
                      : 'Плавное движение сцены: включено'}
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

