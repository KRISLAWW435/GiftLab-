import type {
  BuiltinIllustrationId,
  CardDecorMotif,
  CompositionPresetId,
  ConstellationProject,
  ConstellationStar,
  CosmicPaletteId,
  GlowColorId,
  MessageFontCategory,
  MessageFontId,
  MessageTextAccent,
  MessageTextShadow,
  MusicTrackId,
  OccasionId,
  StarConnection,
  StarDecorSettings,
  StarIllustrationLayout,
  StarImageSettings,
  StarPosition3D,
  StarShapeId,
  StarTextStyle,
} from '../types/project';

export interface CosmicPaletteConfig {
  id: CosmicPaletteId;
  name: string;
  description: string;
  deepColor: string;
  midColor: string;
  nebulaPrimary: string;
  nebulaSecondary: string;
  dustTint: string;
  lineTint: string;
  fogColor: string;
  cssGradient: string;
}

export const COSMIC_PALETTES: Record<CosmicPaletteId, CosmicPaletteConfig> = {
  lavender: {
    id: 'lavender',
    name: 'Лавандовая туманность',
    description: 'Тёмно-синий космос, фиолетовые облака и мягкое сиренево-розовое свечение',
    deepColor: '#090e26',
    midColor: '#1f1647',
    nebulaPrimary: '#7c4dff',
    nebulaSecondary: '#f48fb1',
    dustTint: '#e9d5ff',
    lineTint: '#c4b5fd',
    fogColor: '#0c102b',
    cssGradient:
      'radial-gradient(circle at 22% 28%, rgba(124,77,255,0.42), transparent 54%), radial-gradient(circle at 78% 72%, rgba(244,143,177,0.30), transparent 52%), linear-gradient(155deg, #090e26 0%, #1f1647 52%, #130f33 100%)',
  },
  aurora: {
    id: 'aurora',
    name: 'Северное сияние',
    description: 'Глубокий океан звёзд, бирюзовые всполохи и изумрудное свечение',
    deepColor: '#061524',
    midColor: '#0b384a',
    nebulaPrimary: '#2dd4bf',
    nebulaSecondary: '#38bdf8',
    dustTint: '#a7f3d0',
    lineTint: '#7dd3fc',
    fogColor: '#071a2b',
    cssGradient:
      'radial-gradient(circle at 25% 24%, rgba(45,212,191,0.36), transparent 54%), radial-gradient(circle at 76% 74%, rgba(56,189,248,0.32), transparent 52%), linear-gradient(155deg, #061524 0%, #0b384a 52%, #07262d 100%)',
  },
  galaxy: {
    id: 'galaxy',
    name: 'Золотая галактика',
    description: 'Тёмный индиго, сине-фиолетовая глубина и тёплая золотая пыльца',
    deepColor: '#090b22',
    midColor: '#22184a',
    nebulaPrimary: '#f59e0b',
    nebulaSecondary: '#6366f1',
    dustTint: '#fde68a',
    lineTint: '#fcd34d',
    fogColor: '#0b0e28',
    cssGradient:
      'radial-gradient(circle at 28% 26%, rgba(245,158,11,0.30), transparent 50%), radial-gradient(circle at 75% 70%, rgba(99,102,241,0.36), transparent 55%), linear-gradient(155deg, #090b22 0%, #22184a 55%, #121032 100%)',
  },
  dawn: {
    id: 'dawn',
    name: 'Космический рассвет',
    description: 'Сливовый небосвод, розово-коралловые облака и нежный сиреневый свет',
    deepColor: '#120d29',
    midColor: '#3a1545',
    nebulaPrimary: '#fb7185',
    nebulaSecondary: '#c084fc',
    dustTint: '#fecdd3',
    lineTint: '#fda4af',
    fogColor: '#180f30',
    cssGradient:
      'radial-gradient(circle at 24% 28%, rgba(251,113,133,0.34), transparent 52%), radial-gradient(circle at 78% 72%, rgba(192,132,252,0.32), transparent 54%), linear-gradient(155deg, #120d29 0%, #3a1545 52%, #1d1238 100%)',
  },
};

export interface GlowColorConfig {
  id: GlowColorId;
  name: string;
  hex: string;
  coreHex: string;
  haloHex: string;
}

export const GLOW_COLORS: Record<GlowColorId, GlowColorConfig> = {
  gold: {
    id: 'gold',
    name: 'Золотой',
    hex: '#fcd34d',
    coreHex: '#fffbeb',
    haloHex: '#f59e0b',
  },
  blue: {
    id: 'blue',
    name: 'Голубой',
    hex: '#60a5fa',
    coreHex: '#eff6ff',
    haloHex: '#3b82f6',
  },
  lilac: {
    id: 'lilac',
    name: 'Сиреневый',
    hex: '#c084fc',
    coreHex: '#faf5ff',
    haloHex: '#9333ea',
  },
  pink: {
    id: 'pink',
    name: 'Розовый',
    hex: '#f472b6',
    coreHex: '#fdf2f8',
    haloHex: '#ec4899',
  },
  turquoise: {
    id: 'turquoise',
    name: 'Бирюзовый',
    hex: '#2dd4bf',
    coreHex: '#f0fdfa',
    haloHex: '#0d9488',
  },
};

export interface StarShapeMeta {
  id: StarShapeId;
  name: string;
  shortHint: string;
}

export const STAR_SHAPES: StarShapeMeta[] = [
  { id: 'star', name: 'Звезда', shortHint: 'Пятиконечный кристалл' },
  { id: 'heart', name: 'Сердце', shortHint: 'Объёмное кристальное сердце' },
  { id: 'flower', name: 'Цветок', shortHint: 'Светящиеся лепестки' },
  { id: 'moon', name: 'Полумесяц', shortHint: 'Лунный кристалл' },
  { id: 'comet', name: 'Комета', shortHint: 'Ядро со световым хвостом' },
  { id: 'planet', name: 'Планета', shortHint: 'Кристалл с кольцами' },
  { id: 'spark', name: 'Искра', shortHint: 'Четырёхлучевая объёмная искра' },
];

export const VALID_STAR_SHAPES = new Set<StarShapeId>(
  STAR_SHAPES.map((s) => s.id),
);

export interface CompositionPresetMeta {
  id: CompositionPresetId;
  name: string;
  description: string;
}

export const COMPOSITION_PRESETS: CompositionPresetMeta[] = [
  {
    id: 'free',
    name: 'Свободная композиция',
    description: 'Плавная дуга звёзд в пространстве',
  },
  {
    id: 'heart',
    name: 'Сердце',
    description: 'Звёзды и линии образуют сердце',
  },
  {
    id: 'flower',
    name: 'Цветок',
    description: 'Центр и лепестки вокруг него',
  },
];

export interface OccasionPreset {
  id: OccasionId;
  label: string;
  defaultTitle: string;
  defaultRecipient: string;
  defaultPalette: CosmicPaletteId;
  defaultGlow: GlowColorId;
  defaultFinalMessage: string;
  starterStars: Array<{
    title: string;
    message: string;
    illustration: BuiltinIllustrationId;
    shape?: StarShapeId;
  }>;
}

export const OCCASION_PRESETS: OccasionPreset[] = [
  {
    id: 'new_year',
    label: 'Новый год',
    defaultTitle: 'Созвездие новогодних желаний',
    defaultRecipient: 'Дорогой друг',
    defaultPalette: 'aurora',
    defaultGlow: 'gold',
    defaultFinalMessage:
      'Пусть в новом году сбудется каждое загаданное желание, а рядом всегда будут тепло и чудеса!',
    starterStars: [
      {
        title: 'Звезда чудес',
        message: 'Пусть каждый зимний вечер приносит маленькое волшебство и уютные улыбки.',
        illustration: 'comet',
        shape: 'comet',
      },
      {
        title: 'Звезда тепла',
        message: 'Желаю, чтобы дома всегда было светло, тепло и радостно.',
        illustration: 'moon',
        shape: 'moon',
      },
      {
        title: 'Звезда смелых мечт',
        message: 'Пусть самые яркие мечты смело ведут к новым открытиям!',
        illustration: 'planet',
        shape: 'star',
      },
      {
        title: 'Звезда добра',
        message: 'Спасибо за доброту, поддержку и самые весёлые моменты года.',
        illustration: 'heart',
        shape: 'heart',
      },
      {
        title: 'Звезда вдохновения',
        message: 'Пусть впереди ждёт целый год ярких идей, друзей и праздников!',
        illustration: 'flower',
        shape: 'flower',
      },
    ],
  },
  {
    id: 'mothers_day',
    label: 'День матери',
    defaultTitle: 'Моя вселенная для тебя',
    defaultRecipient: 'Любимая мама',
    defaultPalette: 'dawn',
    defaultGlow: 'pink',
    defaultFinalMessage:
      'Мама, ты — самое яркое солнце в моей вселенной! Спасибо за твою любовь и заботу каждый день.',
    starterStars: [
      {
        title: 'Сердце заботы',
        message: 'Спасибо за твои добрые объятия, которые согревают в любой день.',
        illustration: 'heart',
        shape: 'heart',
      },
      {
        title: 'Нежный цветок',
        message: 'Пусть твоя улыбка расцветает чаще, а поводов для радости будет бесконечно много.',
        illustration: 'flower',
        shape: 'flower',
      },
      {
        title: 'Уютная луна',
        message: 'С тобой дома всегда спокойно, светло и очень уютно.',
        illustration: 'moon',
        shape: 'moon',
      },
      {
        title: 'Звезда мечтаний',
        message: 'Желаю тебе побольше времени для твоих любимых дел и отдыха!',
        illustration: 'comet',
        shape: 'comet',
      },
      {
        title: 'Наш общий мир',
        message: 'Люблю наши разговоры, прогулки и каждый праздник вместе.',
        illustration: 'planet',
        shape: 'star',
      },
    ],
  },
  {
    id: 'birthday',
    label: 'День рождения',
    defaultTitle: 'Пять звёзд для именинника',
    defaultRecipient: 'Именинник',
    defaultPalette: 'galaxy',
    defaultGlow: 'gold',
    defaultFinalMessage:
      'С днём рождения! Сияй ярко, верь в свои мечты и открывай самые удивительные галактики!',
    starterStars: [
      {
        title: 'Звезда приключений',
        message: 'Пусть этот год подарит невероятные путешествия и яркие впечатления!',
        illustration: 'comet',
        shape: 'comet',
      },
      {
        title: 'Звезда дружбы',
        message: 'Рядом всегда будут верные друзья, с которыми весело в любую минуту.',
        illustration: 'planet',
        shape: 'planet',
      },
      {
        title: 'Звезда радости',
        message: 'Желаю смеха, приятных сюрпризов и отличного настроения каждый день!',
        illustration: 'heart',
        shape: 'heart',
      },
      {
        title: 'Звезда гармонии',
        message: 'Пусть всё получается легко, а вечера будут уютными и вдохновляющими.',
        illustration: 'moon',
        shape: 'moon',
      },
      {
        title: 'Звезда талантов',
        message: 'Пусть все твои идеи расцветают и приносят настоящую гордость!',
        illustration: 'flower',
        shape: 'star',
      },
    ],
  },
  {
    id: 'teachers_day',
    label: 'День учителя',
    defaultTitle: 'Созвездие благодарности',
    defaultRecipient: 'Любимый учитель',
    defaultPalette: 'lavender',
    defaultGlow: 'lilac',
    defaultFinalMessage:
      'Спасибо за знания, терпение и веру в нас! Вы зажигаете в каждом ученике настоящую звезду.',
    starterStars: [
      {
        title: 'Свет знаний',
        message: 'Спасибо, что делаете каждый урок интересным открытием нового мира.',
        illustration: 'planet',
        shape: 'star',
      },
      {
        title: 'Звезда терпения',
        message: 'Благодарим за поддержку, внимание и добрые советы в нужный момент.',
        illustration: 'moon',
        shape: 'moon',
      },
      {
        title: 'Искры вдохновения',
        message: 'Благодаря вам хочется мечтать смелее и узнавать всё больше!',
        illustration: 'comet',
        shape: 'comet',
      },
      {
        title: 'Цветок признательности',
        message: 'От всей души желаем вам радости, здоровья и благодарных учеников.',
        illustration: 'flower',
        shape: 'flower',
      },
      {
        title: 'Доброе сердце',
        message: 'Пусть ваша доброта возвращается к вам тёплым светом каждый день!',
        illustration: 'heart',
        shape: 'heart',
      },
    ],
  },
  {
    id: 'custom',
    label: 'Свой повод',
    defaultTitle: 'Моё космическое послание',
    defaultRecipient: 'Близкий человек',
    defaultPalette: 'lavender',
    defaultGlow: 'turquoise',
    defaultFinalMessage:
      'Это маленькое созвездие создано специально для тебя — помни, как ярко ты светишь!',
    starterStars: [
      {
        title: 'Первая звезда',
        message: 'Пусть в твоём сердце всегда горит тёплый огонёк радости.',
        illustration: 'heart',
        shape: 'star',
      },
      {
        title: 'Вторая звезда',
        message: 'Желаю спокойных вечеров и самых приятных воспоминаний.',
        illustration: 'moon',
        shape: 'star',
      },
      {
        title: 'Третья звезда',
        message: 'Пусть каждый новый день приносит повод для искренней улыбки.',
        illustration: 'flower',
        shape: 'star',
      },
      {
        title: 'Четвёртая звезда',
        message: 'Мечтай смело — пусть твои желания летят быстрее комет!',
        illustration: 'comet',
        shape: 'star',
      },
      {
        title: 'Пятая звезда',
        message: 'Спасибо, что делаешь наш общий мир добрее и светлее.',
        illustration: 'planet',
        shape: 'star',
      },
    ],
  },
];

export const MUSIC_TRACKS: Array<{
  id: MusicTrackId;
  name: string;
  mood: string;
}> = [
  { id: 'none', name: 'Без музыки', mood: 'Тишина космического пространства' },
  { id: 'stardust', name: 'Колыбельная звёзд', mood: 'Нежная челеста и мягкие аккорды' },
  { id: 'aurora_chimes', name: 'Переливы сияния', mood: 'Кристальные колокольчики и арфа' },
  { id: 'galaxy_waltz', name: 'Звёздный вальс', mood: 'Тёплая музыкальная шкатулка' },
];

/** Default 3D layout positions forming a graceful spatial constellation arc */
export const DEFAULT_STAR_POSITIONS: StarPosition3D[] = [
  { x: -3.2, y: 1.15, z: 0.9 },
  { x: -1.45, y: 2.05, z: -0.65 },
  { x: 0.25, y: 0.45, z: 1.25 },
  { x: 1.95, y: 1.75, z: -0.45 },
  { x: 3.15, y: -0.55, z: 0.75 },
  { x: 0.85, y: -1.85, z: -0.95 },
  { x: -2.05, y: -1.35, z: -0.35 },
];

export function computeAutoDepthForIndex(index: number, x: number, y: number): number {
  const wave = Math.sin(index * 1.45 + x * 0.35) * 1.15 + Math.cos(y * 0.45) * 0.45;
  return Number(Math.max(-1.8, Math.min(1.8, wave)).toFixed(2));
}

export function resolveStarGlowHex(
  star: ConstellationStar,
  globalGlow: GlowColorId,
): GlowColorId {
  return star.glowColor === 'inherit' ? globalGlow : star.glowColor;
}

export const DEFAULT_STAR_IMAGE_SETTINGS: StarImageSettings = {
  fit: 'contain',
  scale: 1,
  offsetX: 0,
  offsetY: 0,
};

export function resolveStarImageSettings(
  star?: Partial<ConstellationStar>,
): StarImageSettings {
  const raw = star?.imageSettings;
  if (!raw) return { ...DEFAULT_STAR_IMAGE_SETTINGS };

  const fit = raw.fit === 'cover' ? 'cover' : 'contain';
  const scale =
    typeof raw.scale === 'number' && Number.isFinite(raw.scale)
      ? Math.max(1, Math.min(2.5, Number(raw.scale.toFixed(2))))
      : 1;
  const offsetX =
    typeof raw.offsetX === 'number' && Number.isFinite(raw.offsetX)
      ? Math.max(-50, Math.min(50, Math.round(raw.offsetX)))
      : 0;
  const offsetY =
    typeof raw.offsetY === 'number' && Number.isFinite(raw.offsetY)
      ? Math.max(-50, Math.min(50, Math.round(raw.offsetY)))
      : 0;

  return { fit, scale, offsetX, offsetY };
}

export const DEFAULT_ILLUSTRATION_LAYOUT: StarIllustrationLayout = {
  offsetX: 0,
  offsetY: 0,
  scale: 1,
};

export function resolveStarIllustrationLayout(
  rawHolder?: { illustrationLayout?: Partial<StarIllustrationLayout> } | Partial<StarIllustrationLayout>,
  fallbackOffsetX = 0,
): StarIllustrationLayout {
  const raw =
    rawHolder && 'illustrationLayout' in rawHolder
      ? rawHolder.illustrationLayout
      : (rawHolder as Partial<StarIllustrationLayout> | undefined);

  if (!raw) {
    return { offsetX: fallbackOffsetX, offsetY: 0, scale: 1 };
  }

  const offsetX =
    typeof raw.offsetX === 'number' && Number.isFinite(raw.offsetX)
      ? Math.max(-100, Math.min(100, Math.round(raw.offsetX)))
      : fallbackOffsetX;
  const offsetY =
    typeof raw.offsetY === 'number' && Number.isFinite(raw.offsetY)
      ? Math.max(-100, Math.min(100, Math.round(raw.offsetY)))
      : 0;
  const scale =
    typeof raw.scale === 'number' && Number.isFinite(raw.scale)
      ? Math.max(0.65, Math.min(1.45, Number(raw.scale.toFixed(2))))
      : 1;

  return { offsetX, offsetY, scale };
}

export const CARD_DECOR_MOTIFS: Array<{ id: CardDecorMotif; name: string }> = [
  { id: 'none', name: 'Без узора' },
  { id: 'sparkles', name: 'Искры' },
  { id: 'orbital', name: 'Орбита' },
  { id: 'hearts', name: 'Сердечки' },
  { id: 'corners', name: 'Уголки' },
];

export const VALID_CARD_DECOR_MOTIFS = new Set<CardDecorMotif>(
  CARD_DECOR_MOTIFS.map((m) => m.id),
);

export const DEFAULT_STAR_DECOR: StarDecorSettings = {
  motif: 'none',
  xPct: 82,
  yPct: 16,
  scale: 1,
};

export function resolveStarDecor(
  rawHolder?: { decor?: Partial<StarDecorSettings> } | Partial<StarDecorSettings>,
): StarDecorSettings {
  const raw =
    rawHolder && 'decor' in rawHolder
      ? rawHolder.decor
      : (rawHolder as Partial<StarDecorSettings> | undefined);

  if (!raw) return { ...DEFAULT_STAR_DECOR };

  const motif: CardDecorMotif =
    raw.motif && VALID_CARD_DECOR_MOTIFS.has(raw.motif) ? raw.motif : 'none';
  const xPct =
    typeof raw.xPct === 'number' && Number.isFinite(raw.xPct)
      ? Math.max(6, Math.min(94, Math.round(raw.xPct)))
      : DEFAULT_STAR_DECOR.xPct;
  const yPct =
    typeof raw.yPct === 'number' && Number.isFinite(raw.yPct)
      ? Math.max(6, Math.min(88, Math.round(raw.yPct)))
      : DEFAULT_STAR_DECOR.yPct;
  const scale =
    typeof raw.scale === 'number' && Number.isFinite(raw.scale)
      ? Math.max(0.7, Math.min(1.45, Number(raw.scale.toFixed(2))))
      : DEFAULT_STAR_DECOR.scale;

  return { motif, xPct, yPct, scale };
}

export interface MessageFontCategoryMeta {
  id: MessageFontCategory;
  name: string;
  hint: string;
}

export const MESSAGE_FONT_CATEGORIES: MessageFontCategoryMeta[] = [
  { id: 'handwritten', name: 'Рукописные', hint: 'Эффект личного письма' },
  { id: 'elegant', name: 'Элегантные', hint: 'Для праздничных открыток' },
  { id: 'classic', name: 'Классические', hint: 'Для длинных пожеланий' },
  { id: 'modern', name: 'Современные', hint: 'Для минималистичных композиций' },
];

export interface MessageFontMeta {
  id: MessageFontId;
  category: MessageFontCategory;
  name: string;
  cssFamily: string;
  sample: string;
  /** Optical size adjustment in px so handwritten/display faces stay balanced */
  opticalSizeBoost: number;
}

export const MESSAGE_FONTS: MessageFontMeta[] = [
  {
    id: 'caveat',
    category: 'handwritten',
    name: 'Caveat',
    cssFamily: '"Caveat", cursive',
    sample: 'Тёплые слова от всего сердца',
    opticalSizeBoost: 3,
  },
  {
    id: 'cormorant',
    category: 'elegant',
    name: 'Cormorant Garamond',
    cssFamily: '"Cormorant Garamond", Georgia, serif',
    sample: 'Сияй ярко и верь в чудеса',
    opticalSizeBoost: 2,
  },
  {
    id: 'lora',
    category: 'classic',
    name: 'Lora',
    cssFamily: '"Lora", Georgia, serif',
    sample: 'Пусть каждый день приносит радость',
    opticalSizeBoost: 0,
  },
  {
    id: 'manrope',
    category: 'modern',
    name: 'Manrope',
    cssFamily: '"Manrope", system-ui, -apple-system, sans-serif',
    sample: 'Чистота и современный ритм',
    opticalSizeBoost: 0,
  },
  {
    id: 'comfortaa',
    category: 'modern',
    name: 'Comfortaa',
    cssFamily: '"Comfortaa", ui-rounded, sans-serif',
    sample: 'Мягкое космическое настроение',
    opticalSizeBoost: 0,
  },
];

export const VALID_MESSAGE_FONT_IDS = new Set<MessageFontId>(
  MESSAGE_FONTS.map((f) => f.id),
);

export const MESSAGE_TEXT_COLORS: Array<{ hex: string; name: string }> = [
  { hex: '#F8FAFC', name: 'Лунный белый' },
  { hex: '#FEF3C7', name: 'Тёплое золото' },
  { hex: '#E0E7FF', name: 'Перламутровый' },
  { hex: '#FCE7F3', name: 'Нежно-розовый' },
  { hex: '#CCFBF1', name: 'Бирюзовый свет' },
  { hex: '#E9D5FF', name: 'Сиреневый' },
];

export const DEFAULT_STAR_TEXT_STYLE: StarTextStyle = {
  fontId: 'manrope',
  fontSize: 17,
  fontWeight: 'normal',
  textAlign: 'auto',
  lineHeight: 1.6,
  color: '#F8FAFC',
  shadow: 'soft',
  accent: 'none',
  offsetX: 0,
  offsetY: 0,
  widthPct: 100,
};

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function resolveStarTextStyle(
  rawHolder?: { textStyle?: Partial<StarTextStyle> } | Partial<StarTextStyle>,
): StarTextStyle {
  const raw =
    rawHolder && 'textStyle' in rawHolder
      ? rawHolder.textStyle
      : (rawHolder as Partial<StarTextStyle> | undefined);

  if (!raw) return { ...DEFAULT_STAR_TEXT_STYLE };

  const fontId: MessageFontId =
    raw.fontId && VALID_MESSAGE_FONT_IDS.has(raw.fontId) ? raw.fontId : 'manrope';
  const fontSize =
    typeof raw.fontSize === 'number' && Number.isFinite(raw.fontSize)
      ? Math.max(14, Math.min(24, Math.round(raw.fontSize)))
      : DEFAULT_STAR_TEXT_STYLE.fontSize;
  const fontWeight = raw.fontWeight === 'semibold' ? 'semibold' : 'normal';
  const textAlign =
    raw.textAlign === 'left' ||
    raw.textAlign === 'center' ||
    raw.textAlign === 'right'
      ? raw.textAlign
      : 'auto';
  const lineHeight =
    typeof raw.lineHeight === 'number' && Number.isFinite(raw.lineHeight)
      ? Math.max(1.2, Math.min(2.0, Number(raw.lineHeight.toFixed(2))))
      : DEFAULT_STAR_TEXT_STYLE.lineHeight;
  const color =
    typeof raw.color === 'string' && HEX_COLOR_RE.test(raw.color)
      ? raw.color.toUpperCase()
      : DEFAULT_STAR_TEXT_STYLE.color;
  const shadow: MessageTextShadow =
    raw.shadow === 'none' || raw.shadow === 'glow' ? raw.shadow : 'soft';
  const accent: MessageTextAccent =
    raw.accent === 'line' || raw.accent === 'frame' || raw.accent === 'quote'
      ? raw.accent
      : 'none';
  const offsetX =
    typeof raw.offsetX === 'number' && Number.isFinite(raw.offsetX)
      ? Math.max(-100, Math.min(100, Math.round(raw.offsetX)))
      : 0;
  const offsetY =
    typeof raw.offsetY === 'number' && Number.isFinite(raw.offsetY)
      ? Math.max(-100, Math.min(100, Math.round(raw.offsetY)))
      : 0;
  const widthPct =
    typeof raw.widthPct === 'number' && Number.isFinite(raw.widthPct)
      ? Math.max(56, Math.min(100, Math.round(raw.widthPct)))
      : 100;

  return {
    fontId,
    fontSize,
    fontWeight,
    textAlign,
    lineHeight,
    color,
    shadow,
    accent,
    offsetX,
    offsetY,
    widthPct,
  };
}

export function isDefaultStarTextStyle(style: StarTextStyle): boolean {
  return (
    style.fontId === DEFAULT_STAR_TEXT_STYLE.fontId &&
    style.fontSize === DEFAULT_STAR_TEXT_STYLE.fontSize &&
    style.fontWeight === DEFAULT_STAR_TEXT_STYLE.fontWeight &&
    style.textAlign === DEFAULT_STAR_TEXT_STYLE.textAlign &&
    style.lineHeight === DEFAULT_STAR_TEXT_STYLE.lineHeight &&
    style.color.toUpperCase() === DEFAULT_STAR_TEXT_STYLE.color.toUpperCase() &&
    style.shadow === DEFAULT_STAR_TEXT_STYLE.shadow &&
    style.accent === DEFAULT_STAR_TEXT_STYLE.accent &&
    style.offsetX === DEFAULT_STAR_TEXT_STYLE.offsetX &&
    style.offsetY === DEFAULT_STAR_TEXT_STYLE.offsetY &&
    style.widthPct === DEFAULT_STAR_TEXT_STYLE.widthPct
  );
}

export function resolveMessageFont(fontId: MessageFontId): MessageFontMeta {
  return MESSAGE_FONTS.find((f) => f.id === fontId) ?? MESSAGE_FONTS[3];
}

export function resolveTextShadowCss(
  shadow: MessageTextShadow,
  glowHex: string,
): string {
  if (shadow === 'none') return 'none';
  if (shadow === 'glow') {
    return `0 2px 10px rgba(0, 0, 0, 0.78), 0 0 18px ${glowHex}66`;
  }
  return '0 2px 12px rgba(0, 0, 0, 0.76)';
}

export function computeTextBlockMarginLeftPct(
  widthPct: number,
  offsetX: number,
): number {
  const safeW = Math.max(56, Math.min(100, widthPct));
  const slack = Math.max(0, 100 - safeW);
  const tX = (Math.max(-100, Math.min(100, offsetX)) + 100) / 200;
  return Number((slack * tX).toFixed(2));
}

export interface StarIdeaItem {
  id: string;
  title: string;
  message: string;
}

export const STAR_IDEAS_BY_OCCASION: Record<'mothers_day' | 'new_year', StarIdeaItem[]> = {
  mothers_day: [
    {
      id: 'md_warmth',
      title: 'Тёплые объятия',
      message: 'Мама, спасибо за твои самые нежные объятия, которые согревают в любой день!',
    },
    {
      id: 'md_smile',
      title: 'Сияние улыбки',
      message: 'Когда ты улыбаешься, вокруг сразу становится светлее, уютнее и радостнее.',
    },
    {
      id: 'md_care',
      title: 'Волшебная забота',
      message: 'Спасибо за каждый вкусный завтрак, добрый совет и твою заботу обо мне.',
    },
    {
      id: 'md_walk',
      title: 'Время вдвоём',
      message: 'Очень люблю наши прогулки, секреты и смешные истории перед сном.',
    },
    {
      id: 'md_dream',
      title: 'Мечтай о чуде',
      message: 'Пусть у тебя всегда будет время для отдыха, любимых книг и твоих мечтаний!',
    },
    {
      id: 'md_sun',
      title: 'Главное солнышко',
      message: 'Ты — самое яркое солнце в моей вселенной! Люблю тебя всем сердцем.',
    },
  ],
  new_year: [
    {
      id: 'ny_magic',
      title: 'Волшебная ночь',
      message: 'Пусть под бой курантов исполнится самое заветное и доброе желание!',
    },
    {
      id: 'ny_snow',
      title: 'Искры снежинок',
      message: 'Желаю уютных зимних вечеров, пушистого снега и весёлых прогулок.',
    },
    {
      id: 'ny_gifts',
      title: 'Сюрприз под ёлкой',
      message: 'Пусть весь новый год будет полон приятных сюрпризов и счастливых моментов!',
    },
    {
      id: 'ny_friends',
      title: 'Смех и друзья',
      message: 'Пусть рядом всегда будут верные друзья, с которыми тепло в любой мороз.',
    },
    {
      id: 'ny_dreams',
      title: 'Полёт к мечтам',
      message: 'Смело загадывай самые яркие мечты — пусть они сбываются быстрее комет!',
    },
    {
      id: 'ny_cozy',
      title: 'Тепло дома',
      message: 'Пусть дома всегда пахнет мандаринами, звучит смех и царит согласие.',
    },
  ],
};

export const EXTRA_OCCASION_IDEAS: Partial<Record<OccasionId, StarIdeaItem[]>> = {
  birthday: [
    {
      id: 'bd_wish',
      title: 'Загадай желание',
      message: 'Пусть этот день принесёт миллион улыбок, подарков и самых ярких эмоций!',
    },
    {
      id: 'bd_shine',
      title: 'Сияй как звезда',
      message: 'Верь в себя и смело иди к мечтам — у тебя всё обязательно получится!',
    },
    {
      id: 'bd_fun',
      title: 'Море приключений',
      message: 'Пусть каждый месяц нового года будет интереснее и веселее предыдущего!',
    },
  ],
  teachers_day: [
    {
      id: 'td_light',
      title: 'Искра открытий',
      message: 'Спасибо, что учите нас не бояться сложных задач и радоваться новым знаниям!',
    },
    {
      id: 'td_thanks',
      title: 'Слова благодарности',
      message: 'От всей души желаем вдохновения, терпения и самых дружных учеников!',
    },
    {
      id: 'td_kind',
      title: 'Доброе сердце',
      message: 'Ваша поддержка и вера в нас помогают зажигать настоящие звёзды!',
    },
  ],
  custom: [
    {
      id: 'cu_shine',
      title: 'Звезда радости',
      message: 'Пусть каждый твой день начинается с хорошего настроения и светлой улыбки!',
    },
    {
      id: 'cu_heart',
      title: 'Спасибо, что рядом',
      message: 'Очень ценю наши тёплые разговоры, смех и поддержку в любую минуту.',
    },
    {
      id: 'cu_dream',
      title: 'Счастливый полёт',
      message: 'Пусть все добрые мечты сбываются легко и приносят настоящее счастье!',
    },
  ],
};

export function getStarIdeasForCategory(
  category: 'mothers_day' | 'new_year' | OccasionId,
): StarIdeaItem[] {
  if (category === 'mothers_day' || category === 'new_year') {
    return STAR_IDEAS_BY_OCCASION[category];
  }
  return EXTRA_OCCASION_IDEAS[category] ?? STAR_IDEAS_BY_OCCASION.mothers_day;
}

export function isPresetOrIdeaStarText(
  title: string,
  message: string,
): boolean {
  const t = title.trim();
  const m = message.trim();
  const defaultTitleMatch = /^Звезда\s+\d+$/.test(t);
  if ((!t || defaultTitleMatch) && !m) return true;

  for (const preset of OCCASION_PRESETS) {
    for (const st of preset.starterStars) {
      if ((t === st.title || !t || defaultTitleMatch) && (m === st.message || !m)) {
        return true;
      }
    }
  }

  const allIdeas = [
    ...STAR_IDEAS_BY_OCCASION.mothers_day,
    ...STAR_IDEAS_BY_OCCASION.new_year,
    ...(EXTRA_OCCASION_IDEAS.birthday ?? []),
    ...(EXTRA_OCCASION_IDEAS.teachers_day ?? []),
    ...(EXTRA_OCCASION_IDEAS.custom ?? []),
  ];
  for (const idea of allIdeas) {
    if ((t === idea.title || !t || defaultTitleMatch) && (m === idea.message || !m)) {
      return true;
    }
  }

  return false;
}

export function resolveStarShape(star: Partial<ConstellationStar>): StarShapeId {
  if (star.shape && VALID_STAR_SHAPES.has(star.shape)) {
    return star.shape;
  }
  return 'star';
}

export function makeConnectionId(a: string, b: string): string {
  const [first, second] = a < b ? [a, b] : [b, a];
  return `conn_${first}__${second}`;
}

export function hasConnection(
  connections: StarConnection[],
  a: string,
  b: string,
): boolean {
  return connections.some(
    (c) => (c.from === a && c.to === b) || (c.from === b && c.to === a),
  );
}

export function buildLegacySequentialConnections(
  stars: Pick<ConstellationStar, 'id'>[],
): StarConnection[] {
  const list: StarConnection[] = [];
  for (let i = 0; i < stars.length - 1; i++) {
    const from = stars[i].id;
    const to = stars[i + 1].id;
    if (from !== to && !hasConnection(list, from, to)) {
      list.push({ id: makeConnectionId(from, to), from, to });
    }
  }
  return list;
}

export function sanitizeConnections(
  connections: StarConnection[] | undefined,
  stars: Pick<ConstellationStar, 'id'>[],
): StarConnection[] {
  if (!Array.isArray(connections)) {
    return buildLegacySequentialConnections(stars);
  }
  const starIds = new Set(stars.map((s) => s.id));
  const seen = new Set<string>();
  const clean: StarConnection[] = [];

  for (const conn of connections) {
    if (!conn || !conn.from || !conn.to || conn.from === conn.to) continue;
    if (!starIds.has(conn.from) || !starIds.has(conn.to)) continue;
    const key = conn.from < conn.to ? `${conn.from}__${conn.to}` : `${conn.to}__${conn.from}`;
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push({
      id: conn.id || `conn_${key}`,
      from: conn.from,
      to: conn.to,
    });
  }
  return clean;
}

/** Safe migration & normalization for both newly created and legacy IndexedDB projects */
export function normalizeProject(project: ConstellationProject): ConstellationProject {
  const stars: ConstellationStar[] = (project.stars ?? []).map((s, idx) => ({
    ...s,
    order: typeof s.order === 'number' ? s.order : idx,
    shape: resolveStarShape(s),
    glowColor: s.glowColor ?? 'inherit',
    imageSettings: s.imageSettings ? resolveStarImageSettings(s) : undefined,
    illustrationLayout: s.illustrationLayout
      ? resolveStarIllustrationLayout(s.illustrationLayout)
      : undefined,
    textStyle: s.textStyle ? resolveStarTextStyle(s.textStyle) : undefined,
    decor: s.decor ? resolveStarDecor(s.decor) : undefined,
  }));

  const connections = sanitizeConnections(
    (project as Partial<ConstellationProject>).connections,
    stars,
  );

  return {
    ...project,
    composition: project.composition ?? 'free',
    stars,
    connections,
    finalTextStyle: project.finalTextStyle
      ? resolveStarTextStyle(project.finalTextStyle)
      : undefined,
    finalDecor: project.finalDecor ? resolveStarDecor(project.finalDecor) : undefined,
  };
}

export function applyCompositionPreset(
  stars: ConstellationStar[],
  presetId: CompositionPresetId,
): { stars: ConstellationStar[]; connections: StarConnection[] } {
  const count = stars.length;
  if (count === 0) {
    return { stars: [], connections: [] };
  }

  let nextPositions: StarPosition3D[] = [];
  const edgePairs: Array<[number, number]> = [];

  if (presetId === 'heart') {
    if (count <= 5) {
      // 4 symmetric heart outline stars + 1 glowing center star
      nextPositions = [
        { x: -2.25, y: 1.35, z: -0.35 },
        { x: 0, y: 0.72, z: 0.85 },
        { x: 2.25, y: 1.35, z: -0.35 },
        { x: 0, y: -2.25, z: 0.35 },
        { x: 0, y: -0.45, z: 1.15 },
      ];
      edgePairs.push([0, 1], [1, 2], [2, 3], [3, 0], [1, 4]);
    } else if (count === 6) {
      // 6 symmetric heart contour points
      nextPositions = [
        { x: 0, y: 0.78, z: 0.75 },
        { x: 1.85, y: 1.75, z: -0.3 },
        { x: 2.55, y: -0.15, z: 0.45 },
        { x: 0, y: -2.25, z: 0.25 },
        { x: -2.55, y: -0.15, z: 0.45 },
        { x: -1.85, y: 1.75, z: -0.3 },
      ];
      edgePairs.push([0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]);
    } else {
      // 6 heart contour points + 1 center heart star
      nextPositions = [
        { x: 0, y: 0.78, z: 0.65 },
        { x: 1.85, y: 1.75, z: -0.3 },
        { x: 2.55, y: -0.15, z: 0.45 },
        { x: 0, y: -2.25, z: 0.25 },
        { x: -2.55, y: -0.15, z: 0.45 },
        { x: -1.85, y: 1.75, z: -0.3 },
        { x: 0, y: -0.45, z: 1.15 },
      ];
      edgePairs.push([0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0], [0, 6]);
    }
  } else if (presetId === 'flower') {
    const petalCount = count - 1;
    nextPositions.push({ x: 0, y: 0.05, z: 0.95 });
    for (let i = 0; i < petalCount; i++) {
      const angle = (i / petalCount) * Math.PI * 2 - Math.PI / 2;
      const x = Number((Math.cos(angle) * 2.75).toFixed(2));
      const y = Number((Math.sin(angle) * 2.15).toFixed(2));
      const z = Number((i % 2 === 0 ? -0.45 : 0.35).toFixed(2));
      nextPositions.push({ x, y, z });
      edgePairs.push([0, i + 1]);
      if (petalCount >= 3) {
        const nextPetal = ((i + 1) % petalCount) + 1;
        edgePairs.push([i + 1, nextPetal]);
      }
    }
  } else {
    // Free graceful constellation arc
    for (let i = 0; i < count; i++) {
      const fallback = DEFAULT_STAR_POSITIONS[i] ?? {
        x: Number((Math.cos(i * 1.1) * 2.6).toFixed(2)),
        y: Number((Math.sin(i * 1.1) * 1.7).toFixed(2)),
        z: computeAutoDepthForIndex(i, i, 0),
      };
      nextPositions.push({ ...fallback });
      if (i < count - 1) {
        edgePairs.push([i, i + 1]);
      }
    }
  }

  const nextStars = stars.map((star, idx) => ({
    ...star,
    position: nextPositions[idx] ? { ...nextPositions[idx] } : { ...star.position },
  }));

  const nextConnections: StarConnection[] = [];
  for (const [aIdx, bIdx] of edgePairs) {
    const a = nextStars[aIdx]?.id;
    const b = nextStars[bIdx]?.id;
    if (a && b && a !== b && !hasConnection(nextConnections, a, b)) {
      nextConnections.push({ id: makeConnectionId(a, b), from: a, to: b });
    }
  }

  return { stars: nextStars, connections: nextConnections };
}

export function createNewProject(
  occasionId: OccasionId = 'birthday',
  customTitle?: string,
  customRecipient?: string,
  composition: CompositionPresetId = 'free',
): ConstellationProject {
  const preset = OCCASION_PRESETS.find((p) => p.id === occasionId) ?? OCCASION_PRESETS[2];
  const now = Date.now();
  const projectId = `proj_${now.toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

  const baseStars: ConstellationStar[] = preset.starterStars.map((item, idx) => ({
    id: `star_${idx + 1}_${Math.random().toString(36).slice(2, 6)}`,
    order: idx,
    title: item.title,
    message: item.message,
    illustration: { type: 'builtin', id: item.illustration },
    shape: item.shape ?? 'star',
    glowColor: 'inherit',
    position: { ...DEFAULT_STAR_POSITIONS[idx] },
  }));

  const composed = applyCompositionPreset(baseStars, composition);

  return {
    id: projectId,
    title: customTitle?.trim() || preset.defaultTitle,
    recipientName: customRecipient?.trim() || preset.defaultRecipient,
    occasion: preset.id,
    occasionLabel: preset.label,
    paletteId: preset.defaultPalette,
    globalGlowColor: preset.defaultGlow,
    composition,
    stars: composed.stars,
    connections: composed.connections,
    finalMessage: preset.defaultFinalMessage,
    musicTrackId: 'stardust',
    createdAt: now,
    updatedAt: now,
  };
}

