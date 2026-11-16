import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Lightbulb,
  Maximize,
  MessageSquareHeart,
  Minimize,
  Move,
  Palette,
  RotateCcw,
  Shapes,
  Sparkles,
  Type,
} from 'lucide-react';
import { BUILTIN_ILLUSTRATIONS, BuiltinIllustration } from '../assets/illustrations';
import { StarShapePreview } from '../assets/shapePreviews';
import {
  DEFAULT_STAR_IMAGE_SETTINGS,
  GLOW_COLORS,
  resolveStarGlowHex,
  resolveStarImageSettings,
  resolveStarShape,
} from '../scene/paletteConfig';
import {
  ORDERED_SHAPE_IDS,
  SHAPE_DISPLAY_META,
  getShapeNameSuggestions,
  getStarMessageSuggestions,
  getToneBadgeLabel,
  isPresetOrSuggestedMessage,
  isPresetOrSuggestedTitle,
} from '../scene/starSuggestions';
import { saveImageBlob } from '../services/database';
import { processUploadedImage } from '../services/imageProcessor';
import {
  isStarComplete,
  type ConstellationStar,
  type GlowColorId,
  type OccasionId,
  type StarIllustrationRef,
  type StarImageFitMode,
  type StarImageSettings,
} from '../types/project';
import { StarIllustrationView } from './StarIllustrationView';

export type StarEditStep = 'shape' | 'title' | 'message' | 'look';

interface StarEditorProps {
  projectId: string;
  occasion: OccasionId;
  recipientName?: string;
  star: ConstellationStar;
  starIndex: number;
  globalGlowColor: GlowColorId;
  editStep?: StarEditStep;
  hasNextStar?: boolean;
  onEditStepChange?: (step: StarEditStep) => void;
  onNextStarOrConstellation?: () => void;
  onChange: (patch: Partial<ConstellationStar>) => void;
}

interface StarEditStepMeta {
  id: StarEditStep;
  stepLabel: string;
  title: string;
  icon: typeof Shapes;
}

const STAR_EDIT_STEPS: StarEditStepMeta[] = [
  { id: 'shape', stepLabel: '1. Форма', title: 'Форма', icon: Shapes },
  { id: 'title', stepLabel: '2. Название', title: 'Название', icon: Type },
  { id: 'message', stepLabel: '3. Послание', title: 'Послание', icon: MessageSquareHeart },
  { id: 'look', stepLabel: 'Вид и фото', title: 'Вид', icon: Palette },
];

export function StarEditor({
  projectId,
  occasion,
  recipientName,
  star,
  starIndex,
  globalGlowColor,
  editStep: controlledEditStep,
  hasNextStar = false,
  onEditStepChange,
  onNextStarOrConstellation,
  onChange,
}: StarEditorProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewDragRef = useRef<{
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const [internalEditStep, setInternalEditStep] = useState<StarEditStep>('shape');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [titleIdeasOpen, setTitleIdeasOpen] = useState(false);
  const [messageIdeasOpen, setMessageIdeasOpen] = useState(false);
  const [visitedLookById, setVisitedLookById] = useState<Record<string, boolean>>({});
  const [visitedShapeById, setVisitedShapeById] = useState<Record<string, boolean>>({});

  const [pendingTitleConfirm, setPendingTitleConfirm] = useState<string | null>(null);
  const [pendingMessageConfirm, setPendingMessageConfirm] = useState<string | null>(
    null,
  );

  const editStep = controlledEditStep ?? internalEditStep;

  // Reset transient UI toggles when switching to another star
  useEffect(() => {
    if (controlledEditStep === undefined) {
      setInternalEditStep('shape');
    }
    setPendingTitleConfirm(null);
    setPendingMessageConfirm(null);
    setTitleIdeasOpen(false);
    setMessageIdeasOpen(false);
    setUploadError(null);
  }, [star.id, controlledEditStep]);

  // Clear pending overwrite confirmations when project context updates
  useEffect(() => {
    setPendingTitleConfirm(null);
    setPendingMessageConfirm(null);
  }, [occasion, recipientName]);

  const currentShape = resolveStarShape(star);
  const shapeMeta = SHAPE_DISPLAY_META[currentShape];
  const activeGlow = GLOW_COLORS[resolveStarGlowHex(star, globalGlowColor)];
  const imgSettings = resolveStarImageSettings(star);
  const starReady = isStarComplete(star);

  const nameSuggestions = getShapeNameSuggestions(
    currentShape,
    occasion,
    recipientName,
  );
  const messageSuggestions = getStarMessageSuggestions(
    occasion,
    recipientName,
    currentShape,
  );
  const toneBadge = getToneBadgeLabel(occasion, recipientName);

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

  const goToEditStep = (step: StarEditStep) => {
    if (editStep === 'shape' && step !== 'shape') {
      setVisitedShapeById((prev) => ({ ...prev, [star.id]: true }));
    }
    if (step === 'look') {
      setVisitedLookById((prev) => ({ ...prev, [star.id]: true }));
    }
    setInternalEditStep(step);
    onEditStepChange?.(step);
    setPendingTitleConfirm(null);
    setPendingMessageConfirm(null);
  };

  const handleSelectTitleSuggestion = (suggestedTitle: string) => {
    const clean = suggestedTitle.slice(0, 30);
    if (
      star.title.trim() === clean.trim() ||
      isPresetOrSuggestedTitle(star.title)
    ) {
      onChange({ title: clean, isDraft: false });
      setPendingTitleConfirm(null);
    } else {
      setPendingTitleConfirm(clean);
    }
  };

  const handleSelectMessageSuggestion = (suggestedText: string) => {
    const clean = suggestedText.slice(0, 180);
    if (
      star.message.trim() === clean.trim() ||
      isPresetOrSuggestedMessage(star.message)
    ) {
      onChange({ message: clean, isDraft: false });
      setPendingMessageConfirm(null);
    } else {
      setPendingMessageConfirm(clean);
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

  const stepCompleteMap: Record<StarEditStep, boolean> = {
    shape: Boolean(visitedShapeById[star.id]) || !star.isDraft,
    title:
      !star.isDraft &&
      star.title.trim().length > 0 &&
      !/^Звезда\s+\d+$/.test(star.title.trim()),
    message: !star.isDraft && star.message.trim().length > 0,
    look:
      Boolean(visitedLookById[star.id]) ||
      star.glowColor !== 'inherit' ||
      star.illustration.type === 'custom',
  };

  return (
    <div className="space-y-4">
      {/* Selected Star Overview Header */}
      <div className="rounded-2xl border border-white/12 bg-white/[0.035] p-3 flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-xl border border-white/12 bg-gl-input flex items-center justify-center shrink-0 shadow-inner"
          style={{ boxShadow: `0 0 18px ${activeGlow.hex}26` }}
        >
          <StarShapePreview
            shape={currentShape}
            color={activeGlow.hex}
            coreColor={activeGlow.coreHex}
            className="w-7 h-7"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-semibold text-gl-accent-light">
              Звезда {starIndex + 1}
            </span>
            <span className="text-white/25">·</span>
            <span className="text-[11px] text-gl-text-muted truncate">
              {shapeMeta.shortLabel}
            </span>
          </div>
          <h3 className="font-display text-sm font-bold text-gl-text truncate mt-0.5">
            {star.title.trim() || 'Придумай название'}
          </h3>
        </div>

        <span
          className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium border ${
            starReady
              ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200'
              : 'border-amber-300/35 bg-amber-500/15 text-amber-100'
          }`}
        >
          {starReady ? (
            <>
              <Check className="w-3 h-3 shrink-0" />
              Готова
            </>
          ) : (
            'В процессе'
          )}
        </span>
      </div>

      {/* Single-Row 4-Tab Visual Stepper */}
      <nav
        aria-label="Шаги создания звезды"
        className="grid grid-cols-4 gap-1"
      >
        {STAR_EDIT_STEPS.map((st) => {
          const Icon = st.icon;
          const isCurrent = editStep === st.id;
          const isDone = stepCompleteMap[st.id];

          return (
            <button
              key={st.id}
              type="button"
              data-selected={isCurrent}
              data-testid={`star-step-tab-${st.id}`}
              onClick={() => goToEditStep(st.id)}
              className={`gl-choice min-h-[48px] px-1.5 py-1.5 flex flex-col items-center justify-center gap-1 text-[10px] sm:text-[11px] font-semibold transition-colors ${
                isCurrent
                  ? '!border-gl-accent-light !bg-gl-accent !text-white shadow-sm'
                  : ''
              }`}
            >
              <div className="flex items-center gap-1">
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {isDone && (
                  <Check
                    className={`w-3 h-3 shrink-0 ${
                      isCurrent ? 'text-emerald-200' : 'text-emerald-300'
                    }`}
                    aria-label="Пройдено"
                  />
                )}
              </div>
              <span className="truncate max-w-full leading-tight">{st.stepLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* STEP 1: Выбрать форму */}
      {editStep === 'shape' && (
        <section
          aria-label="Шаг 1: Выбрать форму"
          className="space-y-3.5 rounded-2xl border border-white/10 bg-white/[0.025] p-3.5"
        >
          <div className="space-y-1">
            <h4 className="font-display text-sm font-bold text-gl-text">
              Шаг 1. Выбери форму звезды
            </h4>
            <p className="text-xs text-gl-text-secondary leading-relaxed">
              Нажми на любую фигурку — она сразу обновится в 3D-космосе!
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {ORDERED_SHAPE_IDS.map((shapeId, idx) => {
              const meta = SHAPE_DISPLAY_META[shapeId];
              const active = currentShape === shapeId;
              const isLastOdd = idx === ORDERED_SHAPE_IDS.length - 1;

              return (
                <button
                  key={shapeId}
                  type="button"
                  data-selected={active}
                  data-testid={`shape-card-${shapeId}`}
                  onClick={() => {
                    setVisitedShapeById((prev) => ({ ...prev, [star.id]: true }));
                    onChange({ shape: shapeId });
                  }}
                  className={`gl-choice relative rounded-2xl p-3 transition-all ${
                    isLastOdd
                      ? 'col-span-2 min-h-[76px] flex flex-row items-center justify-center gap-3'
                      : 'min-h-[96px] flex flex-col items-center justify-center gap-2'
                  }`}
                >
                  {active && (
                    <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gl-accent/90 text-white flex items-center justify-center shadow">
                      <Check className="w-3 h-3" />
                    </span>
                  )}

                  <div
                    className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-center shrink-0"
                    style={
                      active
                        ? { boxShadow: `0 0 20px ${activeGlow.hex}44` }
                        : undefined
                    }
                  >
                    <StarShapePreview
                      shape={shapeId}
                      color={activeGlow.hex}
                      coreColor={activeGlow.coreHex}
                      className="w-9 h-9"
                    />
                  </div>

                  <span className="text-xs sm:text-[13px] font-semibold text-gl-text text-center leading-tight">
                    {meta.label}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            data-testid="star-step-next-to-title"
            onClick={() => goToEditStep('title')}
            className="gl-btn-primary w-full !min-h-[46px] text-sm font-semibold"
          >
            <span>Дальше: придумать название</span>
            <ArrowRight className="w-4 h-4 shrink-0" />
          </button>
        </section>
      )}

      {/* STEP 2: Придумать название */}
      {editStep === 'title' && (
        <section
          aria-label="Шаг 2: Придумать название"
          className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3.5"
        >
          <div className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-gl-input/70 px-3 py-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <StarShapePreview
                shape={currentShape}
                color={activeGlow.hex}
                coreColor={activeGlow.coreHex}
                className="w-6 h-6 shrink-0"
              />
              <span className="text-xs text-gl-text-secondary truncate">
                Форма: <strong className="text-gl-text">{shapeMeta.label}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => goToEditStep('shape')}
              className="text-xs font-semibold text-gl-accent-light hover:text-gl-text shrink-0 cursor-pointer"
            >
              Поменять
            </button>
          </div>

          <div className="space-y-1">
            <h4 className="font-display text-sm font-bold text-gl-text">
              Шаг 2. Придумай название
            </h4>
            <p className="text-xs text-gl-text-secondary leading-relaxed">
              Напиши своё название или нажми на идею, которая подходит к форме.
            </p>
          </div>

          <label className="block space-y-1.5">
            <span className="gl-label block">Название звезды</span>
            <input
              type="text"
              maxLength={30}
              value={star.title}
              data-testid="star-title-input"
              onChange={(e) => {
                setPendingTitleConfirm(null);
                onChange({ title: e.target.value, isDraft: false });
              }}
              placeholder="Напиши название для этой звезды..."
              className="gl-input !min-h-[46px] text-sm"
            />
            {star.title.length >= 26 && (
              <p className="text-[11px] text-amber-200/90">
                Название получается длинным — лучше короткое, чтобы красиво поместилось на открытке.
              </p>
            )}
          </label>

          {/* Collapsible Shape-specific name ideas accordion (closed by default) */}
          <div className="rounded-xl border border-white/10 bg-white/[0.025] overflow-hidden">
            <button
              type="button"
              data-testid="star-title-ideas-toggle"
              aria-expanded={titleIdeasOpen}
              onClick={() => setTitleIdeasOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-medium text-amber-200 hover:bg-white/[0.04] transition-colors cursor-pointer min-h-[42px]"
            >
              <span className="inline-flex items-center gap-2 text-left">
                <Lightbulb className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>Не знаешь, что написать? Посмотри идеи</span>
              </span>
              {titleIdeasOpen ? (
                <ChevronUp className="w-4 h-4 text-gl-text-muted shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gl-text-muted shrink-0" />
              )}
            </button>

            {(titleIdeasOpen || pendingTitleConfirm) && (
              <div className="border-t border-white/10 p-3 space-y-2.5">
                {pendingTitleConfirm && (
                  <div className="rounded-xl border border-amber-300/45 bg-amber-500/12 p-3 space-y-2 text-xs">
                    <p className="text-amber-100 leading-snug">
                      У тебя уже написано своё название. Заменить его на «{pendingTitleConfirm}»?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onChange({ title: pendingTitleConfirm, isDraft: false });
                          setPendingTitleConfirm(null);
                        }}
                        className="gl-btn-primary !min-h-[36px] !px-3 text-xs"
                      >
                        Заменить название
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingTitleConfirm(null)}
                        className="gl-btn-secondary !min-h-[36px] !px-3 text-xs"
                      >
                        Оставить своё
                      </button>
                    </div>
                  </div>
                )}

                {titleIdeasOpen && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-gl-text-muted">
                      Идеи названий для формы «{shapeMeta.shortLabel}»:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {nameSuggestions.map((name) => {
                        const selected = star.title.trim() === name.trim();
                        return (
                          <button
                            key={name}
                            type="button"
                            data-selected={selected}
                            onClick={() => handleSelectTitleSuggestion(name)}
                            className="gl-choice min-h-[38px] px-3 py-1.5 text-xs font-medium text-left"
                          >
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => goToEditStep('shape')}
              className="gl-btn-secondary !min-h-[44px] !px-3.5 text-xs shrink-0"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Форма</span>
            </button>
            <button
              type="button"
              data-testid="star-step-next-to-message"
              onClick={() => goToEditStep('message')}
              className="gl-btn-primary flex-1 !min-h-[44px] text-xs sm:text-sm font-semibold"
            >
              <span>Дальше: написать послание</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </section>
      )}

      {/* STEP 3: Придумать историю или послание */}
      {editStep === 'message' && (
        <section
          aria-label="Шаг 3: Придумать историю или послание"
          className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3.5"
        >
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h4 className="font-display text-sm font-bold text-gl-text">
                Шаг 3. Придумай историю или послание
              </h4>
              <span className="inline-flex items-center rounded-full border border-gl-accent/35 bg-gl-accent/15 px-2.5 py-0.5 text-[11px] font-medium text-gl-accent-light">
                {toneBadge}
              </span>
            </div>
            <p className="text-xs text-gl-text-secondary leading-relaxed">
              Эти слова откроются на открытке, когда получатель нажмёт на звезду.
            </p>
          </div>

          <label className="block space-y-1.5">
            <span className="gl-label block">Текст для этой звезды</span>
            <textarea
              rows={4}
              maxLength={180}
              value={star.message}
              data-testid="star-message-input"
              onChange={(e) => {
                setPendingMessageConfirm(null);
                onChange({ message: e.target.value, isDraft: false });
              }}
              placeholder="Напиши тёплые слова, воспоминание или маленькое пожелание..."
              className="gl-textarea resize-none leading-relaxed text-sm"
            />
          </label>

          {/* Collapsible Personalized wish/story starter ideas accordion (closed by default) */}
          <div className="rounded-xl border border-white/10 bg-white/[0.025] overflow-hidden">
            <button
              type="button"
              data-testid="star-message-ideas-toggle"
              aria-expanded={messageIdeasOpen}
              onClick={() => setMessageIdeasOpen((o) => !o)}
              className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs font-medium text-amber-200 hover:bg-white/[0.04] transition-colors cursor-pointer min-h-[42px]"
            >
              <span className="inline-flex items-center gap-2 text-left">
                <Lightbulb className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>Не знаешь, что написать? Посмотри идеи</span>
              </span>
              {messageIdeasOpen ? (
                <ChevronUp className="w-4 h-4 text-gl-text-muted shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gl-text-muted shrink-0" />
              )}
            </button>

            {(messageIdeasOpen || pendingMessageConfirm) && (
              <div className="border-t border-white/10 p-3 space-y-2.5">
                {pendingMessageConfirm && (
                  <div className="rounded-xl border border-amber-300/45 bg-amber-500/12 p-3 space-y-2 text-xs">
                    <p className="text-amber-100 leading-snug">
                      У звезды уже написан твой текст. Заменить его выбранной идеей?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onChange({ message: pendingMessageConfirm, isDraft: false });
                          setPendingMessageConfirm(null);
                        }}
                        className="gl-btn-primary !min-h-[36px] !px-3 text-xs"
                      >
                        Заменить текст
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingMessageConfirm(null)}
                        className="gl-btn-secondary !min-h-[36px] !px-3 text-xs"
                      >
                        Оставить свой
                      </button>
                    </div>
                  </div>
                )}

                {messageIdeasOpen && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-gl-text-muted">
                      Готовые идеи — выбери и допиши по-своему:
                    </p>
                    {messageSuggestions.map((item) => {
                      const active = star.message.trim() === item.text.trim();
                      return (
                        <button
                          key={item.id}
                          type="button"
                          data-selected={active}
                          onClick={() => handleSelectMessageSuggestion(item.text)}
                          className="gl-choice w-full text-left px-3 py-2.5 space-y-1 min-h-[48px]"
                        >
                          <span className="inline-block text-[10px] font-semibold uppercase tracking-wider text-gl-accent-light">
                            {item.tag}
                          </span>
                          <p className="text-xs text-gl-text leading-relaxed">
                            {item.text}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => goToEditStep('title')}
              className="gl-btn-secondary !min-h-[44px] !px-3.5 text-xs shrink-0"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Название</span>
            </button>
            <button
              type="button"
              data-testid="star-step-next-to-look"
              onClick={() => goToEditStep('look')}
              className="gl-btn-primary flex-1 !min-h-[44px] text-xs sm:text-sm font-semibold"
            >
              <span>Дальше: цвет и картинка</span>
              <ArrowRight className="w-4 h-4 shrink-0" />
            </button>
          </div>
        </section>
      )}

      {/* STEP 4: Оформление (цвет свечения и картинка) */}
      {editStep === 'look' && (
        <section
          aria-label="Оформление звезды: цвет и картинка"
          className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.025] p-3.5"
        >
          <div className="space-y-1">
            <h4 className="font-display text-sm font-bold text-gl-text">
              Оформление звезды
            </h4>
            <p className="text-xs text-gl-text-secondary leading-relaxed">
              Выбери цвет сияния и картинку, которая появится внутри открытки.
            </p>
          </div>

          {/* 1. Готовые цвета свечения (без HEX-кодов) */}
          <div className="space-y-2">
            <span className="gl-label block">Цвет свечения</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                data-selected={star.glowColor === 'inherit'}
                onClick={() => onChange({ glowColor: 'inherit' })}
                className="gl-choice min-h-[44px] px-3 py-2 flex items-center gap-2 text-xs font-medium col-span-2"
              >
                <Sparkles
                  className="w-4 h-4 shrink-0"
                  style={{ color: GLOW_COLORS[globalGlowColor].hex }}
                />
                <span>Как у всего неба ({GLOW_COLORS[globalGlowColor].name})</span>
              </button>

              {(Object.keys(GLOW_COLORS) as GlowColorId[]).map((gid) => {
                const g = GLOW_COLORS[gid];
                const active = star.glowColor === gid;
                return (
                  <button
                    key={gid}
                    type="button"
                    data-selected={active}
                    onClick={() => onChange({ glowColor: gid })}
                    className="gl-choice min-h-[44px] px-3 py-2 flex items-center gap-2.5 text-xs font-medium"
                  >
                    <span
                      className="w-4 h-4 rounded-full shrink-0 border border-white/30 shadow-sm"
                      style={{
                        backgroundColor: g.hex,
                        boxShadow: `0 0 10px ${g.hex}88`,
                      }}
                    />
                    <span className="truncate">{g.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Понятный выбор картинки и загрузка своего фото */}
          <div className="space-y-2.5 pt-1 border-t border-white/10">
            <div className="flex items-center justify-between gap-2">
              <span className="gl-label">Картинка внутри открытки</span>
              <span className="text-[11px] text-gl-text-muted truncate max-w-[160px]">
                {star.illustration.type === 'builtin'
                  ? BUILTIN_ILLUSTRATIONS.find((i) => i.id === star.illustration.id)?.name
                  : 'Своя картинка'}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {BUILTIN_ILLUSTRATIONS.map((item) => {
                const active =
                  star.illustration.type === 'builtin' && star.illustration.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    data-selected={active}
                    title={item.meaning}
                    onClick={() =>
                      onChange({ illustration: { type: 'builtin', id: item.id } })
                    }
                    className="gl-choice min-h-[82px] p-2 flex flex-col items-center justify-center gap-1.5"
                  >
                    <div className="w-11 h-11 flex items-center justify-center">
                      <BuiltinIllustration id={item.id} className="w-full h-full object-contain" />
                    </div>
                    <span className="text-[11px] font-medium text-gl-text text-center leading-tight line-clamp-2">
                      {item.name}
                    </span>
                  </button>
                );
              })}

              {/* Upload photo tile */}
              <button
                type="button"
                data-selected={star.illustration.type === 'custom'}
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="gl-choice min-h-[82px] p-2 flex flex-col items-center justify-center gap-1.5"
              >
                {star.illustration.type === 'custom' ? (
                  <div className="w-11 h-11 rounded-lg overflow-hidden bg-white/[0.04]">
                    <StarIllustrationView
                      illustration={star.illustration}
                      imageSettings={imgSettings}
                      alt={star.title || 'Своя картинка'}
                      className="w-full h-full"
                    />
                  </div>
                ) : (
                  <div className="w-11 h-11 rounded-lg bg-white/[0.05] border border-dashed border-white/25 flex items-center justify-center text-gl-accent-light">
                    <ImagePlus className="w-5 h-5" />
                  </div>
                )}
                <span className="text-[11px] font-medium text-gl-text text-center leading-tight">
                  {uploading
                    ? 'Сжатие...'
                    : star.illustration.type === 'custom'
                      ? 'Своё фото'
                      : 'Добавить фото'}
                </span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />

            {uploadError && <p className="text-xs text-rose-300">{uploadError}</p>}
          </div>

          {/* 3. Кадрирование картинки внутри звезды/рамки (оформление текста, цвета и узоры — на Этапе 3 «Открытка») */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between gap-2">
              <span className="gl-label">Кадрирование картинки</span>
              <button
                type="button"
                data-testid="star-crop-reset-btn"
                onClick={resetImageSettings}
                disabled={isDefaultImageSettings}
                className="inline-flex items-center gap-1 text-xs font-medium text-gl-accent-light hover:text-gl-text disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Сброс
              </button>
            </div>

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
                  <Move className="w-3 h-3" />
                </span>
              </div>

              <div className="flex-1 min-w-0 space-y-2">
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
                        data-testid={`star-crop-fit-${mode.id}`}
                        data-selected={active}
                        onClick={() => updateImageSettings({ fit: mode.id })}
                        className="gl-choice px-2 py-2 text-xs font-medium flex items-center justify-center gap-1"
                      >
                        <Icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{mode.label}</span>
                      </button>
                    );
                  })}
                </div>

                <p className="text-xs text-gl-text-muted leading-snug">
                  Двигай картинку прямо внутри рамки.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 rounded-xl border border-white/10 bg-white/[0.025] p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-gl-text-secondary font-medium">Приближение внутри рамки</span>
                <span className="text-gl-text-muted">
                  {imgSettings.scale <= 1.05
                    ? 'Обычное'
                    : imgSettings.scale >= 1.8
                      ? 'Крупно'
                      : 'Среднее'}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={2.5}
                step={0.05}
                value={imgSettings.scale}
                aria-label="Приближение изображения"
                onChange={(e) =>
                  updateImageSettings({ scale: Number(e.target.value) })
                }
                className="w-full accent-gl-accent cursor-pointer"
              />
            </div>

            <p className="text-[11px] text-gl-text-muted leading-relaxed">
              Шрифт, цвет текста и узоры карточки настраиваются на этапе «3. Открытка».
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => goToEditStep('message')}
              className="gl-btn-secondary !min-h-[44px] !px-3.5 text-xs shrink-0"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Послание</span>
            </button>
            <button
              type="button"
              data-testid="star-step-look-next"
              onClick={() => {
                if (onNextStarOrConstellation) {
                  onNextStarOrConstellation();
                } else {
                  goToEditStep('shape');
                }
              }}
              className="gl-btn-primary flex-1 !min-h-[44px] text-xs sm:text-sm font-semibold"
            >
              <span>
                {hasNextStar ? 'Следующая звезда' : 'К сборке созвездия'}
              </span>
              {hasNextStar ? (
                <ArrowRight className="w-4 h-4 shrink-0" />
              ) : (
                <Sparkles className="w-4 h-4 shrink-0" />
              )}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
