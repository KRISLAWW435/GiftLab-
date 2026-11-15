export type CosmicPaletteId = 'lavender' | 'aurora' | 'galaxy' | 'dawn';

export type GlowColorId = 'gold' | 'blue' | 'lilac' | 'pink' | 'turquoise';

export type BuiltinIllustrationId = 'heart' | 'flower' | 'moon' | 'comet' | 'planet';

export type StarShapeId = 'star' | 'heart' | 'flower' | 'moon' | 'comet' | 'planet' | 'spark';

export type CompositionPresetId = 'free' | 'heart' | 'flower';

export type OccasionId = 'new_year' | 'mothers_day' | 'birthday' | 'teachers_day' | 'custom';

export type MusicTrackId = 'none' | 'stardust' | 'aurora_chimes' | 'galaxy_waltz';

export type EditorInteractionMode = 'arrange' | 'connect' | 'orbit';

export type RecipientPhase =
  | 'sealed'
  | 'birthing'
  | 'starStory'
  | 'finalReveal'
  | 'constellation';

export interface StarPosition3D {
  x: number;
  y: number;
  z: number;
}

export type StarImageFitMode = 'contain' | 'cover';

export interface StarImageSettings {
  fit: StarImageFitMode;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export type MessageFontId = 'manrope' | 'comfortaa' | 'caveat' | 'cormorant' | 'lora';

export type MessageFontCategory = 'handwritten' | 'elegant' | 'classic' | 'modern';

export type MessageTextWeight = 'normal' | 'semibold';

export type MessageTextAlign = 'left' | 'center' | 'right';

export type MessageTextShadow = 'soft' | 'none' | 'glow';

export type MessageTextAccent = 'none' | 'line' | 'frame' | 'quote';

export interface StarTextStyle {
  fontId: MessageFontId;
  /** Message body font size in px (14..24) */
  fontSize: number;
  fontWeight: MessageTextWeight;
  textAlign: MessageTextAlign | 'auto';
  /** Line height multiplier (1.2..2.0) */
  lineHeight: number;
  color: string;
  shadow: MessageTextShadow;
  accent: MessageTextAccent;
  /** Bounded horizontal offset (-100..100) */
  offsetX: number;
  /** Bounded vertical offset (-100..100) */
  offsetY: number;
  /** Text block width percentage within safe stage (56..100) */
  widthPct: number;
}

export interface StarIllustrationRef {
  type: 'builtin' | 'custom';
  /** BuiltinIllustrationId when type === 'builtin', or imageId in IndexedDB when type === 'custom' */
  id: string;
}

export interface ConstellationStar {
  id: string;
  order: number;
  title: string;
  message: string;
  illustration: StarIllustrationRef;
  /** Optional non-destructive image presentation & crop settings */
  imageSettings?: StarImageSettings;
  /** Optional typography and bounded block placement settings */
  textStyle?: StarTextStyle;
  /** 3D crystal form; migrated to 'star' when absent in legacy projects */
  shape: StarShapeId;
  /** If 'inherit' or undefined, uses project.globalGlowColor */
  glowColor: GlowColorId | 'inherit';
  position: StarPosition3D;
}

export interface StarConnection {
  id: string;
  from: string;
  to: string;
}

export interface ConstellationProject {
  id: string;
  title: string;
  recipientName: string;
  senderName?: string;
  occasion: OccasionId;
  occasionLabel: string;
  paletteId: CosmicPaletteId;
  globalGlowColor: GlowColorId;
  composition?: CompositionPresetId;
  stars: ConstellationStar[];
  connections: StarConnection[];
  finalMessage: string;
  finalTextStyle?: StarTextStyle;
  musicTrackId: MusicTrackId;
  createdAt: number;
  updatedAt: number;
}

export interface StoredImageRecord {
  id: string;
  projectId: string;
  blob: Blob;
  mimeType: string;
  size: number;
  updatedAt: number;
}

export function isStarComplete(star: ConstellationStar): boolean {
  return star.title.trim().length > 0 && star.message.trim().length > 0;
}

export function canExportProject(project: ConstellationProject): boolean {
  if (project.stars.length < 5) return false;
  const primaryFive = project.stars.slice(0, 5);
  return (
    project.title.trim().length > 0 &&
    project.finalMessage.trim().length > 0 &&
    primaryFive.every(isStarComplete)
  );
}

