import { Check, Plus, Trash2 } from 'lucide-react';
import { StarShapePreview } from '../assets/shapePreviews';
import {
  GLOW_COLORS,
  resolveStarGlowHex,
  resolveStarShape,
} from '../scene/paletteConfig';
import {
  isStarComplete,
  type ConstellationStar,
  type GlowColorId,
} from '../types/project';

interface StarListProps {
  stars: ConstellationStar[];
  selectedStarId: string;
  globalGlowColor: GlowColorId;
  onSelectStar: (starId: string) => void;
  onAddStar: () => void;
  onRemoveStar: (starId: string) => void;
}

export function StarList({
  stars,
  selectedStarId,
  globalGlowColor,
  onSelectStar,
  onAddStar,
  onRemoveStar,
}: StarListProps) {
  const canAddMore = stars.length < 7;
  const canDelete = stars.length > 5;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3.5 py-3 border-b border-white/10 flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold text-gl-text truncate">
            Мои звёзды
          </h2>
          <p className="text-[11px] text-gl-text-muted tabular-nums">
            {stars.length} из 7
          </p>
        </div>

        <button
          type="button"
          onClick={onAddStar}
          disabled={!canAddMore}
          title={canAddMore ? 'Добавить звезду' : 'Максимум 7 звёзд'}
          className="gl-btn-primary !min-h-[36px] !px-2.5 !py-1.5 text-xs shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Добавить</span>
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2.5 space-y-1.5 overscroll-contain">
        {stars.map((star, idx) => {
          const isSelected = star.id === selectedStarId;
          const complete = isStarComplete(star);
          const glowCfg = GLOW_COLORS[resolveStarGlowHex(star, globalGlowColor)];
          const shape = resolveStarShape(star);

          return (
            <div
              key={star.id}
              data-selected={isSelected}
              className="gl-choice group flex items-center gap-1.5 p-2"
            >
              <button
                type="button"
                onClick={() => onSelectStar(star.id)}
                className="flex-1 min-w-0 flex items-center gap-2.5 text-left cursor-pointer"
              >
                <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-white/10 bg-gl-input">
                  <StarShapePreview
                    shape={shape}
                    color={glowCfg.hex}
                    coreColor={glowCfg.coreHex}
                    className="w-6 h-6"
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-semibold text-gl-text-muted tabular-nums shrink-0">
                      {idx + 1}.
                    </span>
                    <span className="text-xs sm:text-[13px] font-semibold text-gl-text truncate">
                      {star.title.trim() || 'Безымянная звезда'}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[11px]">
                    {complete ? (
                      <span className="inline-flex items-center gap-1 text-emerald-300">
                        <Check className="w-3 h-3 shrink-0" />
                        Заполнена
                      </span>
                    ) : (
                      <span className="text-amber-300/90">Нужен текст</span>
                    )}
                  </div>
                </div>
              </button>

              {canDelete && (
                <button
                  type="button"
                  onClick={() => onRemoveStar(star.id)}
                  title="Удалить звезду"
                  aria-label={`Удалить ${star.title.trim() || `звезду ${idx + 1}`}`}
                  className="gl-btn-icon !min-w-[32px] !min-h-[32px] !w-8 !h-8 !p-0 border-transparent bg-transparent text-gl-text-muted hover:text-rose-300 hover:bg-rose-500/15 hover:border-rose-400/30 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
