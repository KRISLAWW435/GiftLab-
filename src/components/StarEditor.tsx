import { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Lightbulb,
  Maximize,
  Minimize,
  Move,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { BUILTIN_ILLUSTRATIONS, BuiltinIllustration } from '../assets/illustrations';
import { StarShapePreview } from '../assets/shapePreviews';
import {
  DEFAULT_STAR_IMAGE_SETTINGS,
  GLOW_COLORS,
  STAR_SHAPES,
  getStarIdeasForCategory,
  isPresetOrIdeaStarText,
  resolveStarGlowHex,
  resolveStarImageSettings,
  resolveStarShape,
  type StarIdeaItem,
} from '../scene/paletteConfig';
import { saveImageBlob } from '../services/database';
import { processUploadedImage } from '../services/imageProcessor';
import type {
  ConstellationStar,
  GlowColorId,
  OccasionId,
  StarIllustrationRef,
  StarImageFitMode,
  StarImageSettings,
} from '../types/project';
import { StarIllustrationView } from './StarIllustrationView';

interface StarEditorProps {
  projectId: string;
  occasion: OccasionId;
  star: ConstellationStar;
  starIndex: number;
  globalGlowColor: GlowColorId;
  onChange: (patch: Partial<ConstellationStar>) => void;
}

type IdeaCategory = 'mothers_day' | 'new_year' | OccasionId;

export function StarEditor({
  projectId,
  occasion,
  star,
  starIndex,
  globalGlowColor,
  onChange,
}: StarEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewDragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [ideasOpen, setIdeasOpen] = useState(false);
  const [ideaCategory, setIdeaCategory] = useState<IdeaCategory>(() =>
    occasion === 'mothers_day' || occasion === 'new_year' ? occasion : occasion,
  );
  const [pendingIdeaConfirm, setPendingIdeaConfirm] = useState<StarIdeaItem | null>(
    null,
  );

  // Sync default idea category when project occasion changes (never overwrites star text!)
  useEffect(() => {
    setIdeaCategory(occasion);
    setPendingIdeaConfirm(null);
  }, [occasion]);

  // Clear pending overwrite prompt when switching stars
  useEffect(() => {
    setPendingIdeaConfirm(null);
  }, [star.id]);

  const currentShape = resolveStarShape(star);
  const activeGlow = GLOW_COLORS[resolveStarGlowHex(star, globalGlowColor)];
  const imgSettings = resolveStarImageSettings(star);

  const isDefaultImageSettings =
    imgSettings.fit === DEFAULT_STAR_IMAGE_SETTINGS.fit &&
    imgSettings.scale === DEFAULT_STAR_IMAGE_SETTINGS.scale &&
    imgSettings.offsetX === DEFAULT_STAR_IMAGE_SETTINGS.offsetX &&
    imgSettings.offsetY === DEFAULT_STAR_IMAGE_SETTINGS.offsetY;

  const updateImageSettings = (patch: Partial<StarImageSettings>) => {
    onChange({
      imageSettings: resolveStarImageSettings({
        imageSettings: {
          ...imgSettings,
          ...patch,
        },
      }),
    });
  };

  const resetImageSettings = () => {
    onChange({
      imageSettings: { ...DEFAULT_STAR_IMAGE_SETTINGS },
    });
  };

  const applyIdea = (idea: StarIdeaItem) => {
    onChange({
      title: idea.title.slice(0, 30),
      message: idea.message.slice(0, 180),
    });
    setPendingIdeaConfirm(null);
  };

  const handleSelectIdea = (idea: StarIdeaItem) => {
    if (isPresetOrIdeaStarText(star.title, star.message)) {
      applyIdea(idea);
    } else {
      setPendingIdeaConfirm(idea);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);

    try {
      const processed = await processUploadedImage(file);
      const imageId = `img_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
      await saveImageBlob(imageId, projectId, processed.blob);
      const nextIll: StarIllustrationRef = { type: 'custom', id: imageId };
      onChange({
        illustration: nextIll,
        imageSettings: { ...DEFAULT_STAR_IMAGE_SETTINGS },
      });
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Не удалось загрузить картинку.',
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const ideasList = getStarIdeasForCategory(ideaCategory);
  const categoryOptions: Array<{ id: IdeaCategory; label: string }> = [
    ...(occasion !== 'mothers_day' && occasion !== 'new_year'
      ? [{ id: occasion, label: 'По теме проекта' }]
      : []),
    { id: 'mothers_day', label: 'День матери' },
    { id: 'new_year', label: 'Новый год' },
  ];

  const handlePreviewPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    previewDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      originX: imgSettings.offsetX,
      originY: imgSettings.offsetY,
    };
  };

  const handlePreviewPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = previewDragRef.current;
    if (!drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dxPct = Math.round(((e.clientX - drag.startX) / Math.max(80, rect.width)) * 100);
    const dyPct = Math.round(((e.clientY - drag.startY) / Math.max(80, rect.height)) * 100);
    updateImageSettings({
      offsetX: Math.max(-50, Math.min(50, drag.originX + dxPct)),
      offsetY: Math.max(-50, Math.min(50, drag.originY + dyPct)),
    });
  };

  const handlePreviewPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (previewDragRef.current) {
      previewDragRef.current = null;
      try {
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-sm font-semibold text-gl-text">
          Параметры звезды
        </h3>
        <span className="text-xs font-medium text-gl-accent-light tabular-nums">
          Звезда {starIndex + 1}
        </span>
      </div>

      {/* 1. Форма 3D-объекта */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="gl-label">Форма 3D-объекта</span>
          <span className="text-[11px] text-gl-text-muted">
            {STAR_SHAPES.find((s) => s.id === currentShape)?.name}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {STAR_SHAPES.map((item) => {
            const active = currentShape === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-selected={active}
                title={item.shortHint}
                onClick={() => onChange({ shape: item.id })}
                className="gl-choice px-2 py-2 flex flex-col items-center gap-1"
              >
                <StarShapePreview
                  shape={item.id}
                  color={activeGlow.hex}
                  coreColor={activeGlow.coreHex}
                  className="w-7 h-7"
                />
                <span className="text-[11px] font-medium leading-tight truncate max-w-full">
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Название */}
      <label className="block space-y-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="gl-label">Название</span>
          <span className="text-gl-text-muted tabular-nums">{star.title.length}/30</span>
        </div>
        <input
          type="text"
          maxLength={30}
          value={star.title}
          onChange={(e) => {
            setPendingIdeaConfirm(null);
            onChange({ title: e.target.value });
          }}
          placeholder="Например: Звезда тепла"
          className="gl-input"
        />
      </label>

      {/* 3. Послание + Библиотека идей */}
      <div className="space-y-2">
        <label className="block space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="gl-label">Послание</span>
            <span className="text-gl-text-muted tabular-nums">
              {star.message.length}/180
            </span>
          </div>
          <textarea
            rows={3}
            maxLength={180}
            value={star.message}
            onChange={(e) => {
              setPendingIdeaConfirm(null);
              onChange({ message: e.target.value });
            }}
            placeholder="Напиши тёплые слова, которые откроются при нажатии на эту звезду..."
            className="gl-textarea resize-none leading-relaxed"
          />
        </label>

        {/* Ideas Library Accordion */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
          <button
            type="button"
            onClick={() => setIdeasOpen((o) => !o)}
            aria-expanded={ideasOpen}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-amber-200 hover:bg-white/[0.04] transition-colors cursor-pointer"
          >
            <span className="inline-flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              Библиотека идей
            </span>
            {ideasOpen ? (
              <ChevronUp className="w-3.5 h-3.5 text-gl-text-muted shrink-0" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-gl-text-muted shrink-0" />
            )}
          </button>

          {ideasOpen && (
            <div className="border-t border-white/10 p-2.5 space-y-2.5">
              <div className="flex flex-wrap gap-1.5">
                {categoryOptions.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    data-selected={ideaCategory === cat.id}
                    onClick={() => {
                      setIdeaCategory(cat.id);
                      setPendingIdeaConfirm(null);
                    }}
                    className="gl-choice px-2.5 py-1 text-[11px] font-medium"
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {pendingIdeaConfirm && (
                <div className="rounded-xl border border-amber-300/45 bg-amber-500/12 p-2.5 space-y-2 text-xs">
                  <p className="text-amber-100 leading-snug">
                    У звезды уже написан свой текст. Заменить его идеей «
                    {pendingIdeaConfirm.title}»?
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyIdea(pendingIdeaConfirm)}
                      className="gl-btn-primary !min-h-[30px] !px-2.5 !py-1 text-[11px]"
                    >
                      Заменить текст
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingIdeaConfirm(null)}
                      className="gl-btn-secondary !min-h-[30px] !px-2.5 !py-1 text-[11px]"
                    >
                      Оставить свой
                    </button>
                  </div>
                </div>
              )}

              <div className="max-h-44 overflow-y-auto space-y-1.5 pr-0.5">
                {ideasList.map((idea) => {
                  const isActive =
                    star.title.trim() === idea.title &&
                    star.message.trim() === idea.message;
                  return (
                    <button
                      key={idea.id}
                      type="button"
                      data-selected={isActive}
                      onClick={() => handleSelectIdea(idea)}
                      className="gl-choice w-full text-left px-2.5 py-2 space-y-0.5"
                    >
                      <div className="text-xs font-semibold text-gl-text">
                        {idea.title}
                      </div>
                      <p className="text-[11px] text-gl-text-muted leading-snug line-clamp-2">
                        {idea.message}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Цвет свечения */}
      <div className="space-y-2">
        <span className="gl-label block">Цвет свечения</span>
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            data-selected={star.glowColor === 'inherit'}
            onClick={() => onChange({ glowColor: 'inherit' })}
            className="gl-choice inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium"
          >
            <Sparkles
              className="w-3.5 h-3.5"
              style={{ color: GLOW_COLORS[globalGlowColor].hex }}
            />
            Общий
          </button>

          {(Object.keys(GLOW_COLORS) as GlowColorId[]).map((gid) => {
            const g = GLOW_COLORS[gid];
            const active = star.glowColor === gid;
            return (
              <button
                key={gid}
                type="button"
                data-selected={active}
                title={g.name}
                onClick={() => onChange({ glowColor: gid })}
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

      {/* 5. Иллюстрация */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="gl-label">Иллюстрация</span>
          <span className="text-[11px] text-gl-text-muted truncate max-w-[160px]">
            {star.illustration.type === 'builtin'
              ? BUILTIN_ILLUSTRATIONS.find((i) => i.id === star.illustration.id)?.name
              : 'Своё изображение'}
          </span>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {BUILTIN_ILLUSTRATIONS.map((item) => {
            const active =
              star.illustration.type === 'builtin' && star.illustration.id === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-selected={active}
                title={`${item.name} — ${item.meaning}`}
                onClick={() =>
                  onChange({ illustration: { type: 'builtin', id: item.id } })
                }
                className="gl-choice aspect-square w-full p-1.5 flex items-center justify-center"
              >
                <BuiltinIllustration id={item.id} className="w-full h-full object-contain" />
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5 rounded-xl border border-white/10 bg-gl-input p-2">
          <div className="w-11 h-11 rounded-lg bg-white/[0.04] p-1 flex items-center justify-center shrink-0 overflow-hidden">
            <StarIllustrationView
              illustration={star.illustration}
              imageSettings={imgSettings}
              alt={star.title || 'Иллюстрация звезды'}
              className="w-full h-full"
            />
          </div>
          <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
            <span className="text-xs text-gl-text-secondary truncate">
              {star.illustration.type === 'custom'
                ? 'Своя картинка'
                : 'Своё фото'}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="gl-btn-secondary !min-h-[34px] !px-2.5 !py-1 text-xs shrink-0"
            >
              <ImagePlus className="w-3.5 h-3.5" />
              {uploading ? 'Сжатие...' : 'Загрузить'}
            </button>
          </div>
        </div>

        {uploadError && <p className="text-xs text-rose-300">{uploadError}</p>}
      </div>

      {/* 6. Настройка изображения */}
      <div className="space-y-3 pt-1 border-t border-white/10">
        <div className="flex items-center justify-between gap-2">
          <span className="gl-label">Настройка изображения</span>
          <button
            type="button"
            onClick={resetImageSettings}
            disabled={isDefaultImageSettings}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-gl-accent-light hover:text-gl-text disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            Сброс
          </button>
        </div>

        {/* Live Draggable Preview Frame */}
        <div className="flex items-center gap-3">
          <div
            onPointerDown={handlePreviewPointerDown}
            onPointerMove={handlePreviewPointerMove}
            onPointerUp={handlePreviewPointerUp}
            onPointerCancel={handlePreviewPointerUp}
            title="Потяните картинку внутри рамки для смещения"
            className="relative w-24 h-24 shrink-0 rounded-xl border border-white/15 bg-gl-input overflow-hidden cursor-grab active:cursor-grabbing touch-none"
          >
            <StarIllustrationView
              illustration={star.illustration}
              imageSettings={imgSettings}
              alt={star.title || 'Предпросмотр изображения'}
              className="w-full h-full"
            />
            <span className="pointer-events-none absolute bottom-1 right-1 rounded bg-black/55 p-0.5 text-white/75">
              <Move className="w-2.5 h-2.5" />
            </span>
          </div>

          <div className="flex-1 min-w-0 space-y-2">
            {/* Fit Mode: Заполнить / Вписать */}
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
              ).map((mode) => {
                const Icon = mode.icon;
                const active = imgSettings.fit === mode.id;
                return (
                  <button
                    key={mode.id}
                    type="button"
                    data-selected={active}
                    onClick={() => updateImageSettings({ fit: mode.id })}
                    className="gl-choice px-2 py-1.5 text-[11px] font-medium flex items-center justify-center gap-1"
                  >
                    <Icon className="w-3 h-3 shrink-0" />
                    <span className="truncate">{mode.label}</span>
                  </button>
                );
              })}
            </div>

            <p className="text-[11px] text-gl-text-muted leading-snug">
              Можно двигать прямо внутри рамки или ползунками ниже.
            </p>
          </div>
        </div>

        {/* Scale & X/Y Position Sliders */}
        <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.025] p-2.5">
          <label className="block space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-gl-text-secondary font-medium">Масштаб</span>
              <span className="text-gl-accent-light font-semibold tabular-nums">
                {imgSettings.scale.toFixed(2)}×
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={2.5}
              step={0.05}
              value={imgSettings.scale}
              aria-label="Масштаб изображения"
              onChange={(e) =>
                updateImageSettings({ scale: Number(e.target.value) })
              }
              className="w-full accent-gl-accent cursor-pointer"
            />
          </label>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="block space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gl-text-muted">Сдвиг X</span>
                <span className="text-gl-text-secondary tabular-nums">
                  {imgSettings.offsetX}%
                </span>
              </div>
              <input
                type="range"
                min={-50}
                max={50}
                step={1}
                value={imgSettings.offsetX}
                aria-label="Смещение изображения по горизонтали"
                onChange={(e) =>
                  updateImageSettings({ offsetX: Number(e.target.value) })
                }
                className="w-full accent-gl-accent cursor-pointer"
              />
            </label>

            <label className="block space-y-1">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-gl-text-muted">Сдвиг Y</span>
                <span className="text-gl-text-secondary tabular-nums">
                  {imgSettings.offsetY}%
                </span>
              </div>
              <input
                type="range"
                min={-50}
                max={50}
                step={1}
                value={imgSettings.offsetY}
                aria-label="Смещение изображения по вертикали"
                onChange={(e) =>
                  updateImageSettings({ offsetY: Number(e.target.value) })
                }
                className="w-full accent-gl-accent cursor-pointer"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

