import { useEffect, useRef, useState } from 'react';
import { Link2, Music, Pause, Play, Trash2 } from 'lucide-react';
import { CompositionPresetPreview } from '../assets/shapePreviews';
import {
  COMPOSITION_PRESETS,
  COSMIC_PALETTES,
  GLOW_COLORS,
  MUSIC_TRACKS,
  OCCASION_PRESETS,
  applyCompositionPreset,
} from '../scene/paletteConfig';
import { getMusicTrackBlob } from '../services/musicEngine';
import type {
  CompositionPresetId,
  ConstellationProject,
  CosmicPaletteId,
  GlowColorId,
  MusicTrackId,
  OccasionId,
} from '../types/project';

interface ConstellationSettingsProps {
  project: ConstellationProject;
  section?: 'constellation' | 'space' | 'all';
  selectedConnectionId?: string | null;
  reducedMotion?: boolean;
  onChange: (patch: Partial<ConstellationProject>) => void;
  onSelectConnection?: (connectionId: string | null) => void;
  onDeleteConnection?: (connectionId: string) => void;
  onEnterConnectMode?: () => void;
  onToggleReducedMotion?: () => void;
}

export function ConstellationSettings({
  project,
  section = 'all',
  selectedConnectionId = null,
  reducedMotion = false,
  onChange,
  onSelectConnection,
  onDeleteConnection,
  onEnterConnectMode,
  onToggleReducedMotion,
}: ConstellationSettingsProps) {
  const [auditionTrackId, setAuditionTrackId] = useState<MusicTrackId | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

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
  const showSpace = section === 'all' || section === 'space';

  return (
    <div className="space-y-5">
      {showConstellation && (
        <>
          <div>
            <h3 className="font-display text-sm font-semibold text-gl-text">
              Структура созвездия
            </h3>
            <p className="text-xs text-gl-text-muted mt-0.5">
              Композиция, ручные связи и финальное послание
            </p>
          </div>

          {/* Constellation Composition Presets */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="gl-label">Композиция</span>
              <span className="text-[11px] text-gl-text-muted">форма и линии</span>
            </div>
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
                Соединения ({project.connections.length})
              </span>
              {onEnterConnectMode && (
                <button
                  type="button"
                  onClick={onEnterConnectMode}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-gl-accent-light hover:text-gl-text cursor-pointer"
                >
                  <Link2 className="w-3 h-3" />
                  Соединить на сцене
                </button>
              )}
            </div>

            {project.connections.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/12 bg-white/[0.02] px-3 py-2.5 text-xs text-gl-text-muted">
                Линий пока нет. Выберите «Связи» под сценой или готовую композицию выше.
              </p>
            ) : (
              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-0.5">
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

          {/* Final Greeting Message */}
          <label className="block space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="gl-label">Финальное послание</span>
              <span className="text-gl-text-muted tabular-nums">
                {project.finalMessage.length}/240
              </span>
            </div>
            <textarea
              rows={4}
              maxLength={240}
              value={project.finalMessage}
              onChange={(e) => onChange({ finalMessage: e.target.value })}
              placeholder="Появится, когда получатель откроет все звёзды созвездия..."
              className="gl-textarea resize-none leading-relaxed"
            />
          </label>
        </>
      )}

      {showSpace && (
        <>
          <div>
            <h3 className="font-display text-sm font-semibold text-gl-text">
              Космос и параметры сцены
            </h3>
            <p className="text-xs text-gl-text-muted mt-0.5">
              Фон, палитра свечения, музыка и общие данные
            </p>
          </div>

          {/* 4 Cosmic Gradient Backgrounds */}
          <div className="space-y-2">
            <span className="gl-label block">Градиентный фон космоса</span>
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
            <span className="gl-label block">Палитра свечения звёзд</span>
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

          {/* General Scene & Gift Metadata */}
          <div className="space-y-3 pt-1 border-t border-white/10">
            <span className="gl-label block">Общие параметры</span>

            <label className="block space-y-1">
              <span className="text-[11px] text-gl-text-muted block">Название подарка</span>
              <input
                type="text"
                maxLength={50}
                value={project.title}
                onChange={(e) => onChange({ title: e.target.value })}
                className="gl-input"
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-[11px] text-gl-text-muted block">Получатель</span>
                <input
                  type="text"
                  maxLength={40}
                  value={project.recipientName}
                  onChange={(e) => onChange({ recipientName: e.target.value })}
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
            </div>

            <label className="block space-y-1">
              <span className="text-[11px] text-gl-text-muted block">Подпись автора</span>
              <input
                type="text"
                maxLength={40}
                value={project.senderName ?? ''}
                onChange={(e) => onChange({ senderName: e.target.value })}
                placeholder="Например: С любовью, Маша"
                className="gl-input"
              />
            </label>

            {onToggleReducedMotion && (
              <div className="pt-1">
                <button
                  type="button"
                  data-selected={!reducedMotion}
                  onClick={onToggleReducedMotion}
                  className="gl-choice w-full px-3 py-2 text-xs font-medium text-center"
                >
                  {reducedMotion ? 'Плавная анимация: выкл' : 'Плавная анимация: вкл'}
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

