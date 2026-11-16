import { useEffect, useRef, type RefObject } from 'react';
import { Pencil, Sparkles, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import type { EditableCardTarget, EditableTextField } from '../preview/previewProtocol';
import {
  GLOW_COLORS,
  computeTextBlockMarginLeftPct,
  isDefaultStarTextStyle,
  resolveCardColors,
  resolveCardTheme,
  resolveEffectiveCardLayout,
  resolveEffectiveFinalDecor,
  resolveEffectiveFinalTextStyle,
  resolveMessageFont,
  resolveTextShadowCss,
} from '../scene/paletteConfig';
import type {
  ConstellationProject,
  DeviceLayoutKey,
  MessageTextAlign,
} from '../types/project';
import { CardDecorView } from './CardDecorView';

export type FinalLetterDragKind =
  | 'final-text-move'
  | 'final-text-resize-left'
  | 'final-text-resize-right'
  | 'final-card-move'
  | 'final-decor-move'
  | 'final-decor-scale';

interface FinalLetterCardProps {
  project: ConstellationProject;
  deviceMode?: DeviceLayoutKey;
  signatureText: string;
  isPortrait: boolean;
  isCompactLandscape: boolean;
  reducedMotion: boolean;
  isOpen: boolean;
  onClose: () => void;
  editMode?: boolean;
  selectedTarget?: EditableCardTarget | null;
  activeInlineField?: EditableTextField | null;
  onSelectTarget?: (target: EditableCardTarget | null, field?: EditableTextField) => void;
  onCloseInlineEdit?: () => void;
  onPatchProject?: (patch: Partial<ConstellationProject>) => void;
  letterContainerRef?: RefObject<HTMLElement | null>;
  onBeginElementDrag?: (
    kind: FinalLetterDragKind,
    e: React.PointerEvent<HTMLElement>,
  ) => void;
  onMoveElementDrag?: (e: React.PointerEvent<HTMLElement>) => void;
  onEndElementDrag?: (e: React.PointerEvent<HTMLElement>) => void;
}

export function FinalLetterCard({
  project,
  deviceMode,
  signatureText,
  isPortrait,
  isCompactLandscape,
  reducedMotion,
  isOpen,
  onClose,
  editMode = false,
  selectedTarget = null,
  activeInlineField = null,
  onSelectTarget,
  onCloseInlineEdit,
  onPatchProject,
  letterContainerRef,
  onBeginElementDrag,
  onMoveElementDrag,
  onEndElementDrag,
}: FinalLetterCardProps) {
  const inlineInputRef = useRef<HTMLInputElement | null>(null);
  const inlineTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!editMode || !activeInlineField) return;
    if (activeInlineField === 'finalMessage') {
      const el = inlineTextareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    } else {
      const el = inlineInputRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }
  }, [editMode, activeInlineField]);
  const activeDevice: DeviceLayoutKey =
    deviceMode ?? (isPortrait || isCompactLandscape ? 'phone' : 'desktop');

  const cardTheme = resolveCardTheme(project.cardTheme);
  const cardColors = resolveCardColors(project);
  const globalGlow = GLOW_COLORS[project.globalGlowColor];

  const resolvedText = resolveEffectiveFinalTextStyle(project, activeDevice);
  const isDefaultSharedText =
    !project.finalTextStyle || isDefaultStarTextStyle(resolvedText);

  const fontMeta = resolveMessageFont(resolvedText.fontId);

  const effectiveAlign: Exclude<MessageTextAlign, 'auto'> =
    resolvedText.textAlign !== 'auto' ? resolvedText.textAlign : 'center';

  const effectiveTextColor =
    project.finalTextStyle && !isDefaultSharedText
      ? resolvedText.color
      : project.cardColors?.textColor ??
        (project.cardTheme ? cardColors.textColor : resolvedText.color);

  const effectiveShadow =
    cardColors.isLightPaper && resolvedText.shadow === 'soft' && !project.finalTextStyle
      ? 'none'
      : cardColors.isLightPaper && resolvedText.shadow !== 'glow'
        ? 'none'
        : resolvedText.shadow;

  const textShadowCss = resolveTextShadowCss(effectiveShadow, globalGlow.hex);
  const finalDecor = resolveEffectiveFinalDecor(project, activeDevice);
  const cardLayout = resolveEffectiveCardLayout(project, activeDevice);

  const bodyPx = Math.min(
    isCompactLandscape ? 19 : isPortrait ? 22 : 27,
    Math.max(
      14,
      Math.round((resolvedText.fontSize + fontMeta.opticalSizeBoost) * 1.15),
    ),
  );

  const effectiveAccent = resolvedText.accent;
  const accentStroke = cardColors.accentColor || globalGlow.hex;
  const crestGlowHex = cardColors.isLightPaper ? cardColors.accentColor : globalGlow.hex;
  const crestCoreHex = cardColors.isLightPaper ? cardColors.badgeColor : globalGlow.coreHex;

  const widthClass = isCompactLandscape
    ? 'max-w-xl'
    : activeDevice === 'phone'
      ? cardLayout.width === 'compact'
        ? 'max-w-[min(86vw,330px)]'
        : cardLayout.width === 'wide'
          ? 'max-w-[min(96vw,440px)]'
          : 'max-w-[min(92vw,390px)]'
      : cardLayout.width === 'compact'
        ? 'max-w-[min(92vw,440px)]'
        : cardLayout.width === 'wide'
          ? 'max-w-[min(92vw,680px)]'
          : 'max-w-[min(92vw,540px)]';

  const headerPadClass =
    cardLayout.padding === 'compact'
      ? 'px-4 sm:px-5 pt-3 pb-1.5'
      : cardLayout.padding === 'spacious'
        ? 'px-6 sm:px-9 pt-5 sm:pt-6 pb-3'
        : 'px-5 sm:px-7 pt-4 sm:pt-5 pb-2';

  const bodyPadClass =
    cardLayout.padding === 'compact'
      ? isCompactLandscape
        ? 'max-h-[42dvh] px-4 py-2.5'
        : isPortrait
          ? 'max-h-[48dvh] px-4 py-3'
          : 'max-h-[50dvh] px-5 py-3.5'
      : cardLayout.padding === 'spacious'
        ? isCompactLandscape
          ? 'max-h-[46dvh] px-6 py-4'
          : isPortrait
            ? 'max-h-[54dvh] px-6 py-5'
            : 'max-h-[58dvh] px-9 py-6 sm:py-7'
        : isCompactLandscape
          ? 'max-h-[44dvh] px-5 py-3'
          : isPortrait
            ? 'max-h-[50dvh] px-5 py-4'
            : 'max-h-[54dvh] px-5 sm:px-8 py-5 sm:py-6';

  const footerPadClass =
    cardLayout.padding === 'compact'
      ? 'px-4 sm:px-5 pb-2.5 pt-1'
      : cardLayout.padding === 'spacious'
        ? 'px-6 sm:px-9 pb-5 pt-2'
        : 'px-5 sm:px-7 pb-3.5 sm:pb-4 pt-1';

  const alignItemsClass =
    cardLayout.verticalAlign === 'top' ? 'items-start' : 'items-center';

  const cardShiftY = Math.round(cardLayout.offsetY * 1.4);
  const textMarginLeftPct = computeTextBlockMarginLeftPct(
    resolvedText.widthPct,
    resolvedText.offsetX,
  );
  const textShiftY = Math.round(resolvedText.offsetY * 0.25);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className={`pointer-events-none fixed inset-x-0 top-0 bottom-20 z-20 flex ${alignItemsClass} justify-center px-3 sm:px-6 ${
            isCompactLandscape ? 'pt-10 pb-2' : 'pt-14 sm:pt-16 pb-4'
          }`}
        >
          <motion.article
            ref={letterContainerRef}
            role="dialog"
            aria-modal="false"
            aria-label="Финальное поздравительное письмо"
            data-testid="final-letter-card"
            data-device={activeDevice}
            data-card-width={cardLayout.width}
            data-card-padding={cardLayout.padding}
            initial={
              reducedMotion
                ? { opacity: 0, y: cardShiftY }
                : { opacity: 0, y: cardShiftY + 145, scale: 0.86 }
            }
            animate={
              reducedMotion
                ? { opacity: 1, y: cardShiftY }
                : { opacity: 1, y: cardShiftY, scale: 1 }
            }
            exit={
              reducedMotion
                ? { opacity: 0, y: cardShiftY }
                : { opacity: 0, y: cardShiftY + 115, scale: 0.9 }
            }
            transition={{
              duration: reducedMotion ? 0.1 : 0.65,
              ease: [0.16, 1, 0.3, 1],
            }}
            onClick={(e) => {
              if (editMode && e.target === e.currentTarget) {
                onSelectTarget?.('card');
              }
            }}
            style={{
              background: `linear-gradient(155deg, ${cardColors.surfaceBg} 0%, ${cardColors.surfaceBgAlt} 100%)`,
              borderColor: `${cardColors.borderColor}88`,
              boxShadow: cardColors.isLightPaper
                ? `0 24px 64px rgba(4, 7, 20, 0.55), 0 0 0 1px ${cardColors.accentColor}26, inset 0 1px 0 rgba(255,255,255,0.65)`
                : `0 24px 70px rgba(3, 5, 16, 0.78), 0 0 42px ${cardColors.accentColor}24`,
            }}
            className={`pointer-events-auto relative w-full ${widthClass} rounded-[26px] border overflow-hidden flex flex-col ${
              editMode && selectedTarget === 'card'
                ? 'ring-2 ring-amber-400/90'
                : ''
            }`}
          >
            {/* Theme Paper Textures & Subtle Borders */}
            {cardTheme.paperPattern === 'paper' && (
              <>
                <div
                  className="pointer-events-none absolute inset-0 opacity-45"
                  style={{
                    backgroundImage:
                      'repeating-linear-gradient(0deg, rgba(140,108,80,0.03) 0px, rgba(140,108,80,0.03) 1px, transparent 1px, transparent 26px)',
                  }}
                  aria-hidden="true"
                />
                <div
                  className="pointer-events-none absolute inset-2.5 sm:inset-3 rounded-[18px] border"
                  style={{ borderColor: `${cardColors.accentColor}40` }}
                  aria-hidden="true"
                />
              </>
            )}

            {cardTheme.paperPattern === 'stars' && (
              <>
                <div
                  className="pointer-events-none absolute inset-0 opacity-45"
                  style={{
                    backgroundImage: `radial-gradient(${cardColors.accentColor}66 1px, transparent 1px)`,
                    backgroundSize: '26px 26px',
                  }}
                  aria-hidden="true"
                />
                <div
                  className="pointer-events-none absolute inset-2.5 sm:inset-3 rounded-[18px] border"
                  style={{ borderColor: `${cardColors.accentColor}45` }}
                  aria-hidden="true"
                />
              </>
            )}

            {cardTheme.paperPattern === 'botanical' && (
              <>
                <div
                  className="pointer-events-none absolute inset-0 opacity-50"
                  style={{
                    background: `radial-gradient(circle at 12% 10%, ${cardColors.accentColor}20, transparent 42%), radial-gradient(circle at 88% 92%, ${cardColors.accentColor}20, transparent 42%)`,
                  }}
                  aria-hidden="true"
                />
                <div
                  className="pointer-events-none absolute inset-2.5 sm:inset-3 rounded-[18px] border border-dashed"
                  style={{ borderColor: `${cardColors.accentColor}50` }}
                  aria-hidden="true"
                />
              </>
            )}

            {cardTheme.paperPattern === 'aurora' && (
              <div
                className="pointer-events-none absolute inset-0 opacity-60"
                style={{
                  background: `radial-gradient(circle at 18% 12%, ${cardColors.accentColor}30, transparent 48%), radial-gradient(circle at 84% 88%, ${globalGlow.hex}24, transparent 50%)`,
                }}
                aria-hidden="true"
              />
            )}

            {/* User-editable or theme ornament inside the letter sheet */}
            {finalDecor.motif !== 'none' && (
              <div
                data-testid="finale-card-decor"
                data-selected={editMode && selectedTarget === 'decor'}
                onPointerDown={
                  editMode && onBeginElementDrag
                    ? (e) => onBeginElementDrag('final-decor-move', e)
                    : undefined
                }
                onPointerMove={editMode ? onMoveElementDrag : undefined}
                onPointerUp={editMode ? onEndElementDrag : undefined}
                onPointerCancel={editMode ? onEndElementDrag : undefined}
                onClick={
                  editMode
                    ? (e) => {
                        e.stopPropagation();
                        onSelectTarget?.('decor');
                      }
                    : undefined
                }
                style={{
                  left: `${finalDecor.xPct}%`,
                  top: `${finalDecor.yPct}%`,
                  transform: `translate(-50%, -50%) scale(${finalDecor.scale})`,
                }}
                className={`absolute ${
                  editMode
                    ? `pointer-events-auto z-30 cursor-grab active:cursor-grabbing touch-none rounded-2xl p-1 ${
                        selectedTarget === 'decor'
                          ? 'ring-2 ring-amber-400 bg-amber-500/15'
                          : 'ring-1 ring-dashed ring-current/30 hover:ring-amber-400/75'
                      }`
                    : 'z-0 pointer-events-none opacity-80'
                }`}
              >
                <CardDecorView
                  motif={finalDecor.motif}
                  glowHex={crestGlowHex}
                  coreHex={crestCoreHex}
                  className={isPortrait ? 'w-20 h-20' : 'w-24 h-24'}
                />
                {editMode && selectedTarget === 'decor' && onBeginElementDrag && (
                  <button
                    type="button"
                    aria-label="Изменить размер декора письма"
                    onPointerDown={(e) => onBeginElementDrag('final-decor-scale', e)}
                    onPointerMove={onMoveElementDrag}
                    onPointerUp={onEndElementDrag}
                    onPointerCancel={onEndElementDrag}
                    className="absolute -bottom-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-400 border-2 border-white cursor-nwse-resize touch-none shadow"
                  />
                )}
              </div>
            )}

            {/* Letter Sheet Header: draggable handle for whole card vertical placement + click-to-edit recipient/title */}
            <div
              onPointerDown={
                editMode && onBeginElementDrag
                  ? (e) => {
                      const target = e.target as HTMLElement;
                      if (target.closest('button, input, textarea')) return;
                      onBeginElementDrag('final-card-move', e);
                    }
                  : undefined
              }
              onPointerMove={editMode ? onMoveElementDrag : undefined}
              onPointerUp={editMode ? onEndElementDrag : undefined}
              onPointerCancel={editMode ? onEndElementDrag : undefined}
              onClick={
                editMode
                  ? (e) => {
                      if ((e.target as HTMLElement).closest('button, input, textarea, [data-inline-field]')) return;
                      e.stopPropagation();
                      onSelectTarget?.('card');
                    }
                  : undefined
              }
              className={`relative z-10 flex items-center justify-between gap-3 ${headerPadClass} shrink-0 ${
                editMode ? 'cursor-grab active:cursor-grabbing touch-none' : ''
              }`}
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span
                  className="inline-flex items-center justify-center w-6 h-6 rounded-full shrink-0 border"
                  style={{
                    borderColor: `${cardColors.accentColor}55`,
                    backgroundColor: `${cardColors.accentColor}1c`,
                    color: cardColors.accentColor,
                  }}
                  aria-hidden="true"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                </span>

                {editMode ? (
                  <div
                    className="flex flex-wrap items-center gap-1 min-w-0 flex-1 text-xs sm:text-sm font-semibold tracking-wide"
                    style={{ color: cardColors.badgeColor }}
                  >
                    {activeInlineField === 'recipientName' ? (
                      <input
                        ref={inlineInputRef}
                        type="text"
                        maxLength={40}
                        value={project.recipientName}
                        placeholder="Имя получателя"
                        data-testid="inline-edit-recipientName"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onPatchProject?.({ recipientName: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') {
                            e.preventDefault();
                            onCloseInlineEdit?.();
                          }
                        }}
                        onBlur={() => onCloseInlineEdit?.()}
                        style={{ color: cardColors.badgeColor, borderColor: `${cardColors.accentColor}88` }}
                        className="w-32 sm:w-40 rounded-md border bg-white/15 px-1.5 py-0.5 text-xs sm:text-sm font-semibold outline-none"
                      />
                    ) : (
                      <span
                        data-inline-field="recipientName"
                        data-testid="card-text-recipientName"
                        title="Нажми, чтобы изменить имя получателя"
                        className="inline-flex items-center gap-1 rounded px-1 -mx-0.5 py-0.5 cursor-text hover:bg-black/10 transition-colors truncate max-w-[180px]"
                      >
                        {project.recipientName.trim()
                          ? `Для ${project.recipientName}`
                          : 'Для кого?'}
                      </span>
                    )}

                    <span className="opacity-60">·</span>

                    {activeInlineField === 'title' ? (
                      <input
                        ref={inlineInputRef}
                        type="text"
                        maxLength={50}
                        value={project.title}
                        placeholder="Название открытки"
                        data-testid="inline-edit-title"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => onPatchProject?.({ title: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === 'Escape') {
                            e.preventDefault();
                            onCloseInlineEdit?.();
                          }
                        }}
                        onBlur={() => onCloseInlineEdit?.()}
                        style={{ color: cardColors.badgeColor, borderColor: `${cardColors.accentColor}88` }}
                        className="min-w-[120px] flex-1 rounded-md border bg-white/15 px-1.5 py-0.5 text-xs sm:text-sm font-semibold outline-none"
                      />
                    ) : (
                      <span
                        data-inline-field="title"
                        data-testid="card-text-title"
                        title="Нажми, чтобы изменить заголовок открытки"
                        className="inline-flex items-center gap-1 rounded px-1 py-0.5 cursor-text hover:bg-black/10 transition-colors truncate max-w-[220px]"
                      >
                        {project.title.trim() || 'Название открытки'}
                      </span>
                    )}
                  </div>
                ) : (
                  <p
                    className="text-xs sm:text-sm font-semibold tracking-wide truncate"
                    style={{ color: cardColors.badgeColor }}
                  >
                    {project.recipientName
                      ? `Для ${project.recipientName} · ${project.title}`
                      : project.title}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                title="Скрыть письмо и любоваться созвездием"
                aria-label="Скрыть письмо"
                data-testid="close-final-letter-btn"
                style={{
                  color: cardColors.badgeColor,
                  borderColor: `${cardColors.borderColor}66`,
                  backgroundColor: cardColors.isLightPaper
                    ? 'rgba(255,255,255,0.65)'
                    : 'rgba(255,255,255,0.08)',
                }}
                className="inline-flex items-center justify-center w-8 h-8 rounded-full border transition-transform hover:scale-105 active:scale-95 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Subtle Paper Hairline Divider */}
            <div className="relative z-10 px-5 sm:px-7 shrink-0">
              <div
                className="h-px w-full opacity-40"
                style={{
                  background: `linear-gradient(90deg, transparent, ${cardColors.accentColor}, transparent)`,
                }}
              />
            </div>

            {/* Scrollable Body for Short or Long Greeting Text */}
            <div className={`relative z-10 overflow-y-auto overscroll-contain ${bodyPadClass}`}>
              <div
                data-testid="finale-text-block"
                data-selected={editMode && selectedTarget === 'text'}
                onPointerDown={
                  editMode && onBeginElementDrag
                    ? (e) => {
                        if ((e.target as HTMLElement).closest('input, textarea')) return;
                        onBeginElementDrag('final-text-move', e);
                      }
                    : undefined
                }
                onPointerMove={editMode ? onMoveElementDrag : undefined}
                onPointerUp={editMode ? onEndElementDrag : undefined}
                onPointerCancel={editMode ? onEndElementDrag : undefined}
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
                  width: `${resolvedText.widthPct}%`,
                  marginLeft: `${textMarginLeftPct}%`,
                  transform: textShiftY !== 0 ? `translateY(${textShiftY}px)` : undefined,
                  textAlign: effectiveAlign,
                  fontFamily: fontMeta.cssFamily,
                  borderColor:
                    effectiveAccent === 'frame'
                      ? `${accentStroke}55`
                      : effectiveAccent === 'quote'
                        ? accentStroke
                        : undefined,
                }}
                className={`relative max-w-full space-y-3 ${
                  effectiveAccent === 'frame'
                    ? 'rounded-2xl border px-4 py-3.5 sm:px-5 sm:py-4'
                    : effectiveAccent === 'quote'
                      ? effectiveAlign === 'right'
                        ? 'border-r-2 pr-4 py-0.5'
                        : 'border-l-2 pl-4 py-0.5'
                      : ''
                } ${
                  editMode
                    ? `cursor-grab active:cursor-grabbing touch-none rounded-xl transition-[box-shadow] ${
                        selectedTarget === 'text'
                          ? 'ring-2 ring-violet-400'
                          : 'ring-1 ring-dashed ring-current/25 hover:ring-violet-400/60'
                      }`
                    : ''
                }`}
              >
                {editMode && selectedTarget === 'text' && onBeginElementDrag && (
                  <>
                    <button
                      type="button"
                      data-testid="finale-text-resize-left"
                      aria-label="Изменить ширину текста слева"
                      onPointerDown={(e) => onBeginElementDrag('final-text-resize-left', e)}
                      onPointerMove={onMoveElementDrag}
                      onPointerUp={onEndElementDrag}
                      onPointerCancel={onEndElementDrag}
                      className="absolute top-1/2 -left-2 -translate-y-1/2 w-3.5 h-8 rounded-full bg-violet-500 border-2 border-white cursor-ew-resize touch-none shadow z-20"
                    />
                    <button
                      type="button"
                      data-testid="finale-text-resize-right"
                      aria-label="Изменить ширину текста справа"
                      onPointerDown={(e) => onBeginElementDrag('final-text-resize-right', e)}
                      onPointerMove={onMoveElementDrag}
                      onPointerUp={onEndElementDrag}
                      onPointerCancel={onEndElementDrag}
                      className="absolute top-1/2 -right-2 -translate-y-1/2 w-3.5 h-8 rounded-full bg-violet-500 border-2 border-white cursor-ew-resize touch-none shadow z-20"
                    />
                  </>
                )}

                {effectiveAccent === 'line' && (
                  <div
                    className="h-0.5 w-16 rounded-full"
                    style={{
                      background: `linear-gradient(90deg, ${cardColors.accentColor}, ${cardColors.badgeColor})`,
                      marginLeft: effectiveAlign === 'left' ? 0 : 'auto',
                      marginRight: effectiveAlign === 'center' ? 'auto' : 0,
                    }}
                  />
                )}

                {editMode && activeInlineField === 'finalMessage' ? (
                  <textarea
                    ref={inlineTextareaRef}
                    rows={4}
                    maxLength={800}
                    value={project.finalMessage}
                    placeholder="Напиши финальное поздравление..."
                    data-testid="inline-edit-finalMessage"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onPatchProject?.({ finalMessage: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        onCloseInlineEdit?.();
                      }
                    }}
                    onBlur={() => onCloseInlineEdit?.()}
                    style={{
                      fontFamily: fontMeta.cssFamily,
                      fontWeight: resolvedText.fontWeight === 'semibold' ? 600 : 400,
                      fontSize: `${bodyPx}px`,
                      lineHeight: Math.min(1.85, resolvedText.lineHeight),
                      color: effectiveTextColor,
                      textShadow: textShadowCss,
                      textAlign: effectiveAlign,
                      borderColor: `${cardColors.accentColor}88`,
                    }}
                    className="w-full rounded-xl border bg-black/15 px-2.5 py-1.5 outline-none resize-y"
                  />
                ) : (
                  <p
                    data-selectable-text={editMode ? undefined : 'true'}
                    data-inline-field={editMode ? 'finalMessage' : undefined}
                    data-testid="card-text-finalMessage"
                    title={editMode ? 'Нажми, чтобы изменить текст поздравления' : undefined}
                    style={{
                      fontFamily: fontMeta.cssFamily,
                      fontWeight: resolvedText.fontWeight === 'semibold' ? 600 : 400,
                      fontSize: `${bodyPx}px`,
                      lineHeight: Math.min(1.85, resolvedText.lineHeight),
                      color: effectiveTextColor,
                      textShadow: textShadowCss,
                    }}
                    className={`whitespace-pre-wrap break-words [overflow-wrap:anywhere] ${
                      editMode
                        ? 'select-none cursor-text rounded-lg px-1 -mx-1 hover:bg-black/10 transition-colors'
                        : 'select-text'
                    }`}
                  >
                    {project.finalMessage ||
                      'Пусть это созвездие всегда напоминает о самом светлом и добром!'}
                  </p>
                )}

                {editMode && activeInlineField === 'senderName' ? (
                  <input
                    ref={inlineInputRef}
                    type="text"
                    maxLength={40}
                    value={project.senderName ?? ''}
                    placeholder="Твоё имя"
                    data-testid="inline-edit-senderName"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => onPatchProject?.({ senderName: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === 'Escape') {
                        e.preventDefault();
                        onCloseInlineEdit?.();
                      }
                    }}
                    onBlur={() => onCloseInlineEdit?.()}
                    style={{
                      fontFamily: fontMeta.cssFamily,
                      color: effectiveTextColor,
                      textShadow: textShadowCss,
                      textAlign: effectiveAlign,
                      borderColor: `${cardColors.accentColor}88`,
                    }}
                    className="w-48 max-w-full rounded-lg border bg-black/15 px-2 py-0.5 text-sm sm:text-base italic outline-none"
                  />
                ) : (signatureText || editMode) ? (
                  <p
                    data-selectable-text={editMode ? undefined : 'true'}
                    data-inline-field={editMode ? 'senderName' : undefined}
                    data-testid="card-text-senderName"
                    title={editMode ? 'Нажми, чтобы изменить подпись' : undefined}
                    style={{
                      fontFamily: fontMeta.cssFamily,
                      color: effectiveTextColor,
                      opacity: signatureText ? 0.8 : 0.52,
                      textShadow: textShadowCss,
                    }}
                    className={`pt-1 text-sm sm:text-base italic ${
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
            </div>

            {/* Subtle Bottom Seal Footer */}
            <div className={`relative z-10 ${footerPadClass} flex items-center justify-between gap-2 shrink-0`}>
              {editMode && activeInlineField === 'occasionLabel' ? (
                <input
                  ref={inlineInputRef}
                  type="text"
                  maxLength={36}
                  value={project.occasionLabel}
                  placeholder="Повод"
                  data-testid="inline-edit-occasionLabel"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => onPatchProject?.({ occasionLabel: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === 'Escape') {
                      e.preventDefault();
                      onCloseInlineEdit?.();
                    }
                  }}
                  onBlur={() => onCloseInlineEdit?.()}
                  style={{
                    color: cardColors.badgeColor,
                    borderColor: `${cardColors.accentColor}88`,
                  }}
                  className="w-40 rounded-md border bg-white/15 px-1.5 py-0.5 text-[11px] outline-none"
                />
              ) : (
                <span
                  data-inline-field={editMode ? 'occasionLabel' : undefined}
                  data-testid="card-text-occasionLabel"
                  onClick={
                    editMode
                      ? (e) => {
                          e.stopPropagation();
                          onSelectTarget?.('text', 'occasionLabel');
                        }
                      : undefined
                  }
                  title={editMode ? 'Нажми, чтобы изменить подпись повода' : undefined}
                  className={`text-[11px] opacity-75 truncate ${
                    editMode
                      ? 'cursor-text rounded px-1 -mx-1 py-0.5 hover:bg-black/10 transition-colors'
                      : ''
                  }`}
                  style={{ color: cardColors.badgeColor }}
                >
                  {project.occasionLabel || (editMode ? 'Добавить повод' : '')}
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                style={{ color: cardColors.badgeColor }}
                className="text-[11px] font-semibold underline underline-offset-4 decoration-current/40 hover:opacity-100 opacity-85 cursor-pointer"
              >
                Скрыть письмо
              </button>
            </div>
          </motion.article>
        </div>
      )}
    </AnimatePresence>
  );
}
