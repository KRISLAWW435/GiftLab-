import { ConstellationEngine } from '../scene/ConstellationEngine';
import {
  COSMIC_PALETTES,
  GLOW_COLORS,
  computeTextBlockMarginLeftPct,
  isDefaultStarTextStyle,
  resolveCardColors,
  resolveCardTheme,
  resolveEffectiveCardLayout,
  resolveEffectiveConstellationLayout,
  resolveEffectiveFinalDecor,
  resolveEffectiveFinalTextStyle,
  resolveEffectiveIllustrationLayout,
  resolveEffectiveStarDecor,
  resolveEffectiveStarTextStyle,
  resolveMessageFont,
  resolveStarGlowHex,
  resolveStarImageSettings,
  resolveStarShape,
  resolveTextShadowCss,
  resolveViewportDeviceMode,
  sanitizeConnections,
} from '../scene/paletteConfig';
import type {
  CardDecorMotif,
  CardThemeCustomColors,
  CardThemeId,
  ConstellationStar,
  CosmicPaletteId,
  DeviceLayoutKey,
  GlowColorId,
  MessageTextAlign,
  ProjectDeviceLayouts,
  RecipientPhase,
  StarConnection,
  StarDecorSettings,
  StarShapeId,
  StarTextStyle,
} from '../types/project';

interface StandaloneStar extends ConstellationStar {
  assetImagePath: string;
}

interface StandalonePayload {
  title: string;
  recipientName: string;
  senderName?: string;
  occasionLabel: string;
  paletteId: CosmicPaletteId;
  globalGlowColor: GlowColorId;
  cardTheme?: CardThemeId;
  cardColors?: CardThemeCustomColors;
  deviceLayouts?: ProjectDeviceLayouts;
  stars: StandaloneStar[];
  connections?: StarConnection[];
  finalMessage: string;
  finalTextStyle?: StarTextStyle;
  finalDecor?: StarDecorSettings;
  musicPath: string | null;
  musicName: string | null;
}

type StoryIntent =
  | { type: 'next' }
  | { type: 'prev' }
  | { type: 'index'; index: number }
  | { type: 'constellation' };

declare global {
  interface Window {
    __GIFTLAB_PAYLOAD__?: StandalonePayload;
  }
}

const SWIPE_MIN_DISTANCE_PX = 65;
const SWIPE_HORIZONTAL_RATIO = 1.35;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function createProgressStarSvg(lit: boolean, active: boolean): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', active ? '18' : '15');
  svg.setAttribute('height', active ? '18' : '15');
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute(
    'd',
    'M12 2.4l2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 16.59l-5.56 2.93 1.06-6.2-4.5-4.39 6.22-.9L12 2.4z',
  );
  path.setAttribute('fill', lit ? 'currentColor' : 'none');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', lit ? '1.2' : '1.6');
  path.setAttribute('stroke-linejoin', 'round');
  svg.appendChild(path);
  return svg;
}

function createCardDecorSvg(
  motif: CardDecorMotif,
  glowHex: string,
  coreHex: string,
): SVGSVGElement | null {
  if (motif === 'none') return null;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('class', 'gl-card-decor-svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.style.filter = `drop-shadow(0 0 12px ${glowHex}66)`;

  const mk = (tag: string, attrs: Record<string, string>) => {
    const node = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    svg.appendChild(node);
  };

  if (motif === 'sparkles') {
    mk('path', { d: 'M54 14L59 35L80 40L59 45L54 66L49 45L28 40L49 35L54 14Z', fill: coreHex, 'fill-opacity': '0.92' });
    mk('path', { d: 'M88 58L91 70L103 73L91 76L88 88L85 76L73 73L85 70L88 58Z', fill: glowHex, 'fill-opacity': '0.88' });
    mk('path', { d: 'M32 76L34 84L42 86L34 88L32 96L30 88L22 86L30 84L32 76Z', fill: glowHex, 'fill-opacity': '0.72' });
    mk('circle', { cx: '88', cy: '28', r: '2.4', fill: coreHex, 'fill-opacity': '0.85' });
    mk('circle', { cx: '24', cy: '48', r: '2', fill: glowHex, 'fill-opacity': '0.75' });
  } else if (motif === 'orbital') {
    mk('ellipse', { cx: '60', cy: '60', rx: '44', ry: '18', transform: 'rotate(-24 60 60)', stroke: glowHex, 'stroke-width': '1.6', 'stroke-dasharray': '4 5', 'stroke-opacity': '0.85' });
    mk('ellipse', { cx: '60', cy: '60', rx: '32', ry: '12', transform: 'rotate(28 60 60)', stroke: coreHex, 'stroke-width': '1.2', 'stroke-opacity': '0.55' });
    mk('circle', { cx: '96', cy: '43', r: '4.5', fill: coreHex });
    mk('path', { d: 'M31 32C26 35 23 41 24 47C25 53 31 57 37 56C32 55 29 50 29 45C29 40 31 35 35 32C33.5 31.6 32.2 31.6 31 32Z', fill: glowHex, 'fill-opacity': '0.9' });
  } else if (motif === 'hearts') {
    mk('path', { d: 'M52 72C52 72 28 57 28 40C28 32 34 26 41.5 26C46.2 26 50.2 28.6 52 32.3C53.8 28.6 57.8 26 62.5 26C70 26 76 32 76 40C76 57 52 72 52 72Z', stroke: glowHex, 'stroke-width': '2.2', fill: glowHex, 'fill-opacity': '0.18' });
    mk('path', { d: 'M86 86C86 86 73 78 73 69C73 64.8 76.2 61.6 80.2 61.6C82.8 61.6 84.9 63 86 65C87.1 63 89.2 61.6 91.8 61.6C95.8 61.6 99 64.8 99 69C99 78 86 86 86 86Z', stroke: coreHex, 'stroke-width': '1.8', fill: coreHex, 'fill-opacity': '0.22' });
    mk('circle', { cx: '88', cy: '36', r: '2.2', fill: coreHex, 'fill-opacity': '0.85' });
    mk('circle', { cx: '28', cy: '82', r: '2.5', fill: glowHex, 'fill-opacity': '0.8' });
  } else if (motif === 'soft_flowers') {
    mk('path', { d: 'M22 96C34 74 52 54 78 36', stroke: glowHex, 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-opacity': '0.65' });
    mk('path', { d: 'M44 74C32 68 26 57 32 48C38 44 48 53 48 66', fill: glowHex, 'fill-opacity': '0.16', stroke: glowHex, 'stroke-width': '1.4' });
    mk('path', { d: 'M62 54C74 58 86 54 88 45C84 38 72 41 64 49', fill: glowHex, 'fill-opacity': '0.16', stroke: glowHex, 'stroke-width': '1.4' });
    for (let deg = 0; deg < 360; deg += 60) {
      mk('ellipse', { cx: '78', cy: '24', rx: '6', ry: '11', transform: `rotate(${deg} 78 36)`, fill: coreHex, 'fill-opacity': '0.28', stroke: glowHex, 'stroke-width': '1.5' });
    }
    mk('circle', { cx: '78', cy: '36', r: '5', fill: glowHex, 'fill-opacity': '0.85' });
    for (let deg = 0; deg < 360; deg += 72) {
      mk('ellipse', { cx: '36', cy: '78', rx: '4', ry: '7.2', transform: `rotate(${deg} 36 86)`, fill: coreHex, 'fill-opacity': '0.26', stroke: glowHex, 'stroke-width': '1.2' });
    }
    mk('circle', { cx: '36', cy: '86', r: '3.4', fill: glowHex, 'fill-opacity': '0.8' });
  } else if (motif === 'petals') {
    mk('path', { d: 'M34 26C48 22 56 32 52 44C46 52 34 50 28 40C24 33 27 28 34 26Z', fill: glowHex, 'fill-opacity': '0.22', stroke: glowHex, 'stroke-width': '1.6' });
    mk('path', { d: 'M78 24C90 28 92 40 84 48C76 52 66 46 66 36C66 28 71 22 78 24Z', fill: coreHex, 'fill-opacity': '0.3', stroke: glowHex, 'stroke-width': '1.5' });
    mk('path', { d: 'M54 58C68 54 78 64 74 78C67 86 53 84 46 74C42 66 46 60 54 58Z', fill: glowHex, 'fill-opacity': '0.26', stroke: glowHex, 'stroke-width': '1.7' });
    mk('path', { d: 'M24 78C32 74 39 79 37 87C33 93 24 92 20 86C18 82 20 79 24 78Z', fill: coreHex, 'fill-opacity': '0.28', stroke: glowHex, 'stroke-width': '1.4' });
    mk('path', { d: 'M88 76C98 76 102 85 96 92C90 97 81 93 80 85C79 79 83 76 88 76Z', fill: glowHex, 'fill-opacity': '0.2', stroke: glowHex, 'stroke-width': '1.4' });
    mk('circle', { cx: '62', cy: '42', r: '2', fill: glowHex, 'fill-opacity': '0.7' });
    mk('circle', { cx: '88', cy: '60', r: '1.8', fill: glowHex, 'fill-opacity': '0.65' });
  } else if (motif === 'magic_rays') {
    mk('circle', { cx: '60', cy: '60', r: '26', stroke: glowHex, 'stroke-width': '1.2', 'stroke-dasharray': '3 5', 'stroke-opacity': '0.6' });
    mk('line', { x1: '60', y1: '10', x2: '60', y2: '110', stroke: coreHex, 'stroke-width': '1.4', 'stroke-opacity': '0.65' });
    mk('line', { x1: '10', y1: '60', x2: '110', y2: '60', stroke: coreHex, 'stroke-width': '1.4', 'stroke-opacity': '0.65' });
    mk('line', { x1: '25', y1: '25', x2: '95', y2: '95', stroke: glowHex, 'stroke-width': '1.2', 'stroke-opacity': '0.55' });
    mk('line', { x1: '95', y1: '25', x2: '25', y2: '95', stroke: glowHex, 'stroke-width': '1.2', 'stroke-opacity': '0.55' });
    mk('path', { d: 'M60 34L65 55L86 60L65 65L60 86L55 65L34 60L55 55L60 34Z', fill: coreHex, 'fill-opacity': '0.9', stroke: glowHex, 'stroke-width': '1.4' });
    mk('circle', { cx: '92', cy: '28', r: '2.2', fill: coreHex, 'fill-opacity': '0.85' });
    mk('circle', { cx: '28', cy: '92', r: '2.2', fill: glowHex, 'fill-opacity': '0.8' });
  } else if (motif === 'corners') {
    mk('path', { d: 'M16 42V22C16 18.7 18.7 16 22 16H42', stroke: glowHex, 'stroke-width': '2', 'stroke-linecap': 'round' });
    mk('path', { d: 'M104 78V98C104 101.3 101.3 104 98 104H78', stroke: glowHex, 'stroke-width': '2', 'stroke-linecap': 'round' });
    mk('path', { d: 'M84 22L86 30L94 32L86 34L84 42L82 34L74 32L82 30L84 22Z', fill: coreHex, 'fill-opacity': '0.9' });
    mk('path', { d: 'M36 78L38 86L46 88L38 90L36 98L34 90L26 88L34 86L36 78Z', fill: coreHex, 'fill-opacity': '0.8' });
  }
  return svg;
}

function shouldIgnoreSwipeTarget(
  target: EventTarget | null,
  pointerType: string,
): boolean {
  if (!(target instanceof Element)) return false;
  if (
    target.closest(
      'button, a, input, textarea, select, [role="button"], [data-no-swipe="true"]',
    )
  ) {
    return true;
  }
  if (
    pointerType === 'mouse' &&
    target.closest('[data-selectable-text="true"]')
  ) {
    return true;
  }
  return false;
}

function hasActiveTextSelection(): boolean {
  if (!window.getSelection) return false;
  const sel = window.getSelection();
  return Boolean(sel && !sel.isCollapsed && sel.toString().trim().length > 0);
}

function bootGiftLabRecipient(): void {
  const rawPayload = window.__GIFTLAB_PAYLOAD__;
  const root = document.getElementById('app');
  if (!rawPayload || !root) return;
  const payload: StandalonePayload = rawPayload;

  const palette = COSMIC_PALETTES[payload.paletteId] ?? COSMIC_PALETTES.lavender;
  const globalGlow = GLOW_COLORS[payload.globalGlowColor] ?? GLOW_COLORS.gold;
  const cardTheme = resolveCardTheme(payload.cardTheme);
  const cardColors = resolveCardColors(payload);
  const hasExplicitCardTheme = Boolean(payload.cardTheme || payload.cardColors);
  const normalizedStars: StandaloneStar[] = payload.stars.map((s) => ({
    ...s,
    shape: resolveStarShape(s),
  }));
  const resolvedConnections = sanitizeConnections(
    payload.connections,
    normalizedStars,
  );
  document.body.style.background = palette.deepColor;

  let phase: RecipientPhase = 'sealed';
  let activeIndex = 0;
  let unlockedCount = 0;
  let finaleReached = false;
  let letterOpen = true;
  let reducedMotion =
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let engine: ConstellationEngine | null = null;
  let using2DFallback = false;

  // Unified transition lock
  let isTransitionLocked = false;
  let lockTimerId: number | null = null;

  function releaseLock(): void {
    if (lockTimerId !== null) {
      window.clearTimeout(lockTimerId);
      lockTimerId = null;
    }
    isTransitionLocked = false;
  }

  function acquireLock(ms: number): void {
    if (lockTimerId !== null) {
      window.clearTimeout(lockTimerId);
    }
    isTransitionLocked = true;
    lockTimerId = window.setTimeout(() => {
      lockTimerId = null;
      isTransitionLocked = false;
    }, ms);
  }

  const signatureText =
    payload.senderName?.trim() ||
    (payload.recipientName ? `Для ${payload.recipientName}` : '');

  // Stage container
  const stage = el('div', 'gl-stage');
  if (reducedMotion) stage.classList.add('gl-reduced');
  const canvasHost = el('div', 'gl-canvas');
  stage.appendChild(canvasHost);

  // 2D Sealed envelope fallback layer
  const sealed2DOverlay = el('div', 'gl-2d-sealed gl-hidden');
  sealed2DOverlay.style.background = palette.cssGradient;
  const sealed2DBox = el('div', 'gl-2d-envelope');
  const sealed2DSeal = el('div', 'gl-2d-seal');
  sealed2DSeal.style.background = `radial-gradient(circle, ${globalGlow.coreHex} 12%, ${globalGlow.hex} 68%, transparent 100%)`;
  sealed2DSeal.style.boxShadow = `0 0 28px ${globalGlow.hex}`;
  const sealed2DLabel = el('span', 'gl-2d-sealed-lbl', 'Запечатанное созвездие');
  sealed2DBox.append(sealed2DSeal, sealed2DLabel);
  sealed2DOverlay.appendChild(sealed2DBox);
  stage.appendChild(sealed2DOverlay);

  // PHASE 1: Sealed Envelope UI
  const sealedUi = el('div', 'gl-sealed-ui');
  const sealedHeader = el('div', 'gl-sealed-head');
  const sealedKicker = el(
    'div',
    'gl-kicker',
    payload.recipientName
      ? `Для ${payload.recipientName} · ${payload.occasionLabel}`
      : payload.occasionLabel,
  );
  const sealedTitle = el('h1', 'gl-title', payload.title);
  sealedHeader.append(sealedKicker, sealedTitle);

  const sealedFooter = el('div', 'gl-sealed-foot');
  const sealedSub = el(
    'p',
    'gl-sealed-sub',
    'Нажмите на звёздную печать или кнопку ниже, чтобы открыть первое послание',
  );
  const openBtn = el('button', 'gl-btn gl-btn-primary gl-open-btn', 'Открыть послание');
  openBtn.type = 'button';
  sealedFooter.append(sealedSub, openBtn);
  sealedUi.append(sealedHeader, sealedFooter);
  stage.appendChild(sealedUi);

  // PHASE 2 & 4: Skip + Sound Bar during Birthing / FinalReveal
  const transUi = el('div', 'gl-birth-ui gl-hidden');
  const transTopRight = el('div', 'gl-birth-actions');
  const transSoundBtn = el('button', 'gl-btn gl-btn-ghost gl-hidden', 'Звук вкл');
  transSoundBtn.type = 'button';
  const skipBtn = el('button', 'gl-btn gl-btn-ghost', 'Пропустить');
  skipBtn.type = 'button';
  transTopRight.append(transSoundBtn, skipBtn);

  const audioBlockedBanner = el('div', 'gl-audio-banner gl-hidden');
  const audioBlockedText = el('span', '', 'Нажмите, чтобы включить музыку');
  const audioManualBtn = el('button', 'gl-btn gl-btn-primary', 'Включить');
  audioManualBtn.type = 'button';
  audioBlockedBanner.append(audioBlockedText, audioManualBtn);
  transUi.append(transTopRight, audioBlockedBanner);
  stage.appendChild(transUi);

  // PHASE 3: Swipeable Borderless Star Story Experience
  const storyUi = el('div', 'gl-story-ui gl-hidden');
  const storyScrim = el('div', 'gl-story-scrim');
  const storyTop = el('header', 'gl-story-top');
  const storyBrand = el('div', 'gl-story-brand', payload.title);

  const storyProgressWrap = el('div', 'gl-story-progress');
  const dotsContainer = el('div', 'gl-dots');
  dotsContainer.setAttribute('role', 'navigation');
  dotsContainer.setAttribute('aria-label', 'Открытые звёзды');
  const progressText = el('span', 'gl-progress-txt', `1 / ${normalizedStars.length}`);
  storyProgressWrap.append(dotsContainer, progressText);

  const storyUtils = el('div', 'gl-story-utils');
  const backToConstBtn = el('button', 'gl-btn gl-btn-amber gl-hidden', 'К созвездию');
  backToConstBtn.type = 'button';
  const storySoundBtn = el('button', 'gl-btn gl-btn-ghost gl-hidden', 'Звук вкл');
  storySoundBtn.type = 'button';
  const storyMotionBtn = el(
    'button',
    'gl-btn gl-btn-ghost',
    reducedMotion ? 'Обычное движение' : 'Меньше движения',
  );
  storyMotionBtn.type = 'button';
  storyUtils.append(backToConstBtn, storySoundBtn, storyMotionBtn);

  storyTop.append(storyBrand, storyProgressWrap, storyUtils);

  const storyGrid = el('div', 'gl-story-grid');
  const storyLeft = el('div', 'gl-story-left');
  const storyRight = el('div', 'gl-story-right');
  const storyMotionWrap = el('div', 'gl-story-motion-wrap');
  if (hasExplicitCardTheme) {
    storyMotionWrap.classList.add('gl-story-paper');
    if (cardColors.isLightPaper) storyMotionWrap.classList.add('gl-paper-light');
    storyMotionWrap.style.background = cardColors.isLightPaper
      ? `linear-gradient(155deg, ${cardColors.surfaceBg}F5 0%, ${cardColors.surfaceBgAlt}F2 100%)`
      : `linear-gradient(155deg, ${cardColors.surfaceBg}CC 0%, ${cardColors.surfaceBgAlt}C4 100%)`;
    storyMotionWrap.style.borderColor = `${cardColors.borderColor}70`;
    if (cardTheme.paperPattern === 'paper' || cardTheme.paperPattern === 'botanical') {
      const innerBorder = el('div', 'gl-letter-frame-inner');
      innerBorder.style.borderColor = `${cardColors.accentColor}45`;
      if (cardTheme.paperPattern === 'botanical') innerBorder.style.borderStyle = 'dashed';
      storyMotionWrap.appendChild(innerBorder);
    } else if (cardTheme.paperPattern === 'stars') {
      const starsPat = el('div', 'gl-letter-pattern');
      starsPat.style.opacity = '0.4';
      starsPat.style.backgroundImage = `radial-gradient(${cardColors.accentColor}66 1px, transparent 1px)`;
      starsPat.style.backgroundSize = '26px 26px';
      storyMotionWrap.appendChild(starsPat);
    }
  }
  const storyContent = el('article', 'gl-story-content');

  const storyCardDecor = el('div', 'gl-card-decor gl-hidden');

  const topOuterSpacer = el('div', 'gl-story-spacer');
  const illuRow = el('div', 'gl-illu-row');
  const illuLeftSpacer = el('div', 'gl-story-spacer');
  const illuWrap = el('div', 'gl-illu-wrap');
  const illuGlow = el('div', 'gl-illu-glow');
  const illuFrame = el('div', 'gl-illu-frame');
  const illuImg = document.createElement('img');
  illuImg.className = 'gl-illu-img';
  illuFrame.appendChild(illuImg);
  illuWrap.append(illuGlow, illuFrame);
  const illuRightSpacer = el('div', 'gl-story-spacer');
  illuRow.append(illuLeftSpacer, illuWrap, illuRightSpacer);

  const topInnerSpacer = el('div', 'gl-story-spacer');
  const storyBlock = el('div', 'gl-story-block');
  const storyAccentLine = el('div', 'gl-story-accent-line gl-hidden');

  const storyOrd = el('p', 'gl-story-ord');
  const storyTitle = el('h2', 'gl-story-title');
  storyTitle.setAttribute('data-selectable-text', 'true');
  const storyMsg = el('p', 'gl-story-msg');
  storyMsg.setAttribute('data-selectable-text', 'true');
  const storySign = el('p', 'gl-story-sign', signatureText ? `— ${signatureText}` : '');
  storySign.setAttribute('data-selectable-text', 'true');
  if (!signatureText) storySign.classList.add('gl-hidden');

  storyBlock.append(storyAccentLine, storyOrd, storyTitle, storyMsg, storySign);
  const bottomInnerSpacer = el('div', 'gl-story-spacer');

  storyContent.append(
    topOuterSpacer,
    illuRow,
    topInnerSpacer,
    storyBlock,
    bottomInnerSpacer,
  );
  storyMotionWrap.append(storyCardDecor, storyContent);

  // Stably mounted secondary arrows + unobtrusive swipe hint
  const storyNav = el('div', 'gl-story-nav');
  storyNav.setAttribute('data-no-swipe', 'true');

  const prevArrowBtn = el('button', 'gl-nav-arrow', '‹');
  prevArrowBtn.type = 'button';
  prevArrowBtn.setAttribute('aria-label', 'Предыдущая звезда');

  const swipeHint = el('div', 'gl-swipe-hint');
  const swipeHintArrow = el('span', 'gl-swipe-arrow', '‹');
  const swipeHintText = el('span', '', 'Свайп влево — следующая звезда');
  swipeHint.append(swipeHintArrow, swipeHintText);

  const nextArrowBtn = el('button', 'gl-nav-arrow', '›');
  nextArrowBtn.type = 'button';
  nextArrowBtn.setAttribute('aria-label', 'Следующая звезда');

  storyNav.append(prevArrowBtn, swipeHint, nextArrowBtn);
  storyRight.append(storyMotionWrap, storyNav);
  storyGrid.append(storyLeft, storyRight);
  storyUi.append(storyScrim, storyTop, storyGrid);
  stage.appendChild(storyUi);

  // PHASE 5: Final Rotating Constellation Emerging Paper Letter & Dock
  const letterBackdrop = el('div', 'gl-letter-backdrop gl-hidden');
  const letterCard = el('article', 'gl-letter-card');
  letterCard.setAttribute('role', 'dialog');
  letterCard.setAttribute('aria-label', 'Финальное поздравительное письмо');
  letterCard.style.background = `linear-gradient(155deg, ${cardColors.surfaceBg} 0%, ${cardColors.surfaceBgAlt} 100%)`;
  letterCard.style.borderColor = `${cardColors.borderColor}88`;
  letterCard.style.boxShadow = cardColors.isLightPaper
    ? `0 24px 64px rgba(4,7,20,0.55), 0 0 0 1px ${cardColors.accentColor}26`
    : `0 24px 70px rgba(3,5,16,0.78), 0 0 42px ${cardColors.accentColor}24`;

  if (cardTheme.paperPattern === 'paper') {
    const tex = el('div', 'gl-letter-pattern');
    tex.style.opacity = '0.45';
    tex.style.backgroundImage =
      'repeating-linear-gradient(0deg, rgba(140,108,80,0.03) 0px, rgba(140,108,80,0.03) 1px, transparent 1px, transparent 26px)';
    const frame = el('div', 'gl-letter-frame-inner');
    frame.style.borderColor = `${cardColors.accentColor}40`;
    letterCard.append(tex, frame);
  } else if (cardTheme.paperPattern === 'stars') {
    const stars = el('div', 'gl-letter-pattern');
    stars.style.opacity = '0.45';
    stars.style.backgroundImage = `radial-gradient(${cardColors.accentColor}66 1px, transparent 1px)`;
    stars.style.backgroundSize = '26px 26px';
    const frame = el('div', 'gl-letter-frame-inner');
    frame.style.borderColor = `${cardColors.accentColor}45`;
    letterCard.append(stars, frame);
  } else if (cardTheme.paperPattern === 'botanical') {
    const glowPat = el('div', 'gl-letter-pattern');
    glowPat.style.opacity = '0.5';
    glowPat.style.background = `radial-gradient(circle at 12% 10%, ${cardColors.accentColor}20, transparent 42%), radial-gradient(circle at 88% 92%, ${cardColors.accentColor}20, transparent 42%)`;
    const frame = el('div', 'gl-letter-frame-inner');
    frame.style.borderStyle = 'dashed';
    frame.style.borderColor = `${cardColors.accentColor}50`;
    letterCard.append(glowPat, frame);
  } else if (cardTheme.paperPattern === 'aurora') {
    const glowPat = el('div', 'gl-letter-pattern');
    glowPat.style.opacity = '0.6';
    glowPat.style.background = `radial-gradient(circle at 18% 12%, ${cardColors.accentColor}30, transparent 48%), radial-gradient(circle at 84% 88%, ${globalGlow.hex}24, transparent 50%)`;
    letterCard.append(glowPat);
  }

  const finaleDecorEl = el('div', 'gl-card-decor gl-hidden');
  const letterHead = el('div', 'gl-letter-head');
  const letterKicker = el(
    'p',
    'gl-letter-kicker',
    payload.recipientName ? `Для ${payload.recipientName} · ${payload.title}` : payload.title,
  );
  letterKicker.style.color = cardColors.badgeColor;

  const letterCloseBtn = el('button', 'gl-letter-close', '×');
  letterCloseBtn.type = 'button';
  letterCloseBtn.setAttribute('aria-label', 'Скрыть письмо');
  letterCloseBtn.title = 'Скрыть письмо';
  letterCloseBtn.style.color = cardColors.badgeColor;
  letterCloseBtn.style.borderColor = `${cardColors.borderColor}66`;
  letterCloseBtn.style.backgroundColor = cardColors.isLightPaper
    ? 'rgba(255,255,255,0.65)'
    : 'rgba(255,255,255,0.08)';
  letterHead.append(letterKicker, letterCloseBtn);

  const letterDivider = el('div', 'gl-letter-divider');
  letterDivider.style.background = `linear-gradient(90deg, transparent, ${cardColors.accentColor}, transparent)`;

  const letterBody = el('div', 'gl-letter-body');
  const letterInner = el('div', 'gl-letter-inner');
  const finaleAccentLine = el('div', 'gl-story-accent-line gl-hidden');
  const letterMsg = el(
    'p',
    'gl-letter-msg',
    payload.finalMessage ||
      'Пусть это созвездие всегда напоминает о самом светлом и добром!',
  );
  letterMsg.setAttribute('data-selectable-text', 'true');
  const letterSign = el('p', 'gl-letter-sign', signatureText ? `— ${signatureText}` : '');
  letterSign.setAttribute('data-selectable-text', 'true');
  if (!signatureText) letterSign.classList.add('gl-hidden');
  letterInner.append(finaleAccentLine, letterMsg, letterSign);
  letterBody.appendChild(letterInner);

  const letterFoot = el('div', 'gl-letter-foot');
  const letterOccasion = el('span', '', payload.occasionLabel);
  letterOccasion.style.color = cardColors.badgeColor;
  letterOccasion.style.opacity = '0.75';
  const letterHideLink = el('button', 'gl-letter-hide-link', 'Скрыть письмо');
  letterHideLink.type = 'button';
  letterHideLink.style.color = cardColors.badgeColor;
  letterFoot.append(letterOccasion, letterHideLink);

  letterCard.append(finaleDecorEl, letterHead, letterDivider, letterBody, letterFoot);
  letterBackdrop.appendChild(letterCard);
  stage.appendChild(letterBackdrop);

  function getActiveDevice(): DeviceLayoutKey {
    return resolveViewportDeviceMode(window.innerWidth, window.innerHeight);
  }

  function applyFinaleTextFormatting(): void {
    const activeDevice = getActiveDevice();
    const isPortrait = window.innerHeight > window.innerWidth || window.innerWidth < 540;
    const isCompactLandscape = !isPortrait && window.innerHeight < 520;
    const cardLayout = resolveEffectiveCardLayout(payload, activeDevice);
    const fDecor = resolveEffectiveFinalDecor(payload, activeDevice);
    const decorGlowHex = cardColors.isLightPaper ? cardColors.accentColor : globalGlow.hex;
    const decorCoreHex = cardColors.isLightPaper ? cardColors.badgeColor : globalGlow.coreHex;
    finaleDecorEl.innerHTML = '';
    if (fDecor.motif !== 'none') {
      const svg = createCardDecorSvg(fDecor.motif, decorGlowHex, decorCoreHex);
      if (svg) finaleDecorEl.appendChild(svg);
      finaleDecorEl.classList.remove('gl-hidden');
      finaleDecorEl.style.left = `${fDecor.xPct}%`;
      finaleDecorEl.style.top = `${fDecor.yPct}%`;
      finaleDecorEl.style.transform = `translate(-50%, -50%) scale(${fDecor.scale})`;
    } else {
      finaleDecorEl.classList.add('gl-hidden');
    }

    letterBackdrop.style.alignItems =
      cardLayout.verticalAlign === 'top' ? 'flex-start' : 'center';
    letterCard.style.maxWidth = isCompactLandscape
      ? 'min(92vw, 576px)'
      : activeDevice === 'phone'
        ? cardLayout.width === 'compact'
          ? 'min(86vw, 330px)'
          : cardLayout.width === 'wide'
            ? 'min(96vw, 440px)'
            : 'min(92vw, 390px)'
        : cardLayout.width === 'compact'
          ? 'min(92vw, 440px)'
          : cardLayout.width === 'wide'
            ? 'min(92vw, 680px)'
            : 'min(92vw, 540px)';
    const cardShiftY = Math.round(cardLayout.offsetY * 1.4);
    letterCard.style.translate = cardShiftY !== 0 ? `0 ${cardShiftY}px` : '';

    if (cardLayout.padding === 'compact') {
      letterHead.style.padding = '12px 18px 6px';
      letterBody.style.padding = isCompactLandscape ? '10px 16px' : '12px 18px';
      letterFoot.style.padding = '4px 18px 10px';
    } else if (cardLayout.padding === 'spacious') {
      letterHead.style.padding = isPortrait ? '18px 22px 10px' : '22px 32px 12px';
      letterBody.style.padding = isPortrait ? '20px 24px' : '26px 36px';
      letterFoot.style.padding = isPortrait ? '8px 22px 16px' : '10px 32px 20px';
    } else {
      letterHead.style.padding = '';
      letterBody.style.padding = '';
      letterFoot.style.padding = '';
    }

    const style = resolveEffectiveFinalTextStyle(payload, activeDevice);
    const isDefault = !payload.finalTextStyle || isDefaultStarTextStyle(style);
    const fontMeta = resolveMessageFont(style.fontId);
    const align: Exclude<MessageTextAlign, 'auto'> =
      style.textAlign !== 'auto' ? style.textAlign : 'center';
    const textColor =
      payload.finalTextStyle && !isDefault
        ? style.color
        : payload.cardColors?.textColor ??
          (payload.cardTheme ? cardColors.textColor : style.color);
    const shadowMode =
      cardColors.isLightPaper && style.shadow !== 'glow' ? 'none' : style.shadow;
    const shadowCss = resolveTextShadowCss(shadowMode, globalGlow.hex);

    letterInner.classList.remove(
      'gl-story-block-frame',
      'gl-story-block-frame-light',
      'gl-story-block-quote-left',
      'gl-story-block-quote-right',
    );
    letterInner.style.width = `${style.widthPct}%`;
    letterInner.style.marginLeft = `${computeTextBlockMarginLeftPct(style.widthPct, style.offsetX)}%`;
    const textShiftY = Math.round(style.offsetY * 0.25);
    letterInner.style.translate = textShiftY !== 0 ? `0 ${textShiftY}px` : '';
    letterInner.style.textAlign = align;
    letterInner.style.fontFamily = fontMeta.cssFamily;
    letterInner.style.borderColor = '';
    letterInner.style.padding = '';
    letterInner.style.borderRadius = '';
    letterInner.style.border = '';

    if (style.accent === 'frame') {
      letterInner.style.border = `1px solid ${cardColors.accentColor}55`;
      letterInner.style.borderRadius = '16px';
      letterInner.style.padding = '14px 18px';
    } else if (style.accent === 'quote') {
      letterInner.classList.add(
        align === 'right' ? 'gl-story-block-quote-right' : 'gl-story-block-quote-left',
      );
      letterInner.style.borderColor = cardColors.accentColor || globalGlow.hex;
    }

    if (style.accent === 'line') {
      finaleAccentLine.classList.remove('gl-hidden');
      finaleAccentLine.style.background = `linear-gradient(90deg, ${cardColors.accentColor}, ${cardColors.badgeColor})`;
      finaleAccentLine.style.marginLeft = align === 'left' ? '0' : 'auto';
      finaleAccentLine.style.marginRight = align === 'center' ? 'auto' : '0';
    } else {
      finaleAccentLine.classList.add('gl-hidden');
    }

    const finalePx = Math.min(
      isCompactLandscape ? 19 : isPortrait ? 22 : 27,
      Math.max(15, Math.round((style.fontSize + fontMeta.opticalSizeBoost) * 1.15)),
    );
    letterMsg.style.fontFamily = fontMeta.cssFamily;
    letterMsg.style.fontWeight = style.fontWeight === 'semibold' ? '600' : '400';
    letterMsg.style.fontSize = `${finalePx}px`;
    letterMsg.style.lineHeight = String(Math.min(1.85, style.lineHeight));
    letterMsg.style.color = textColor;
    letterMsg.style.textShadow = shadowCss;

    if (signatureText) {
      letterSign.style.fontFamily = fontMeta.cssFamily;
      letterSign.style.color = textColor;
      letterSign.style.textShadow = shadowCss;
    }
  }
  applyFinaleTextFormatting();

  const dock = el('div', 'gl-dock gl-hidden');
  const starPillsWrap = el('div', 'gl-star-pills');
  normalizedStars.forEach((s, idx) => {
    const pill = el('button', 'gl-star-pill', String(idx + 1));
    pill.type = 'button';
    pill.title = s.title || `Звезда ${idx + 1}`;
    pill.style.borderBottom = `2px solid ${
      GLOW_COLORS[resolveStarGlowHex(s, payload.globalGlowColor)].hex
    }`;
    pill.addEventListener('click', () => {
      navigateStory({ type: 'index', index: idx });
    });
    starPillsWrap.appendChild(pill);
  });

  const dockLetterBtn = el('button', 'gl-btn gl-btn-amber', 'Скрыть письмо');
  dockLetterBtn.type = 'button';

  function setLetterOpen(open: boolean): void {
    letterOpen = open;
    letterBackdrop.classList.toggle('gl-hidden', phase !== 'constellation' || !letterOpen);
    dockLetterBtn.textContent = letterOpen ? 'Скрыть письмо' : 'Открыть письмо';
    dockLetterBtn.classList.toggle('gl-btn-amber', letterOpen);
    dockLetterBtn.classList.toggle('gl-btn-accent', !letterOpen);
  }

  letterCloseBtn.addEventListener('click', () => setLetterOpen(false));
  letterHideLink.addEventListener('click', () => setLetterOpen(false));
  dockLetterBtn.addEventListener('click', () => setLetterOpen(!letterOpen));

  const resetBtn = el('button', 'gl-btn gl-btn-ghost', 'Сброс');
  resetBtn.type = 'button';
  const dockMotionBtn = el(
    'button',
    'gl-btn gl-btn-ghost',
    reducedMotion ? 'Вращение: выкл' : 'Меньше движения',
  );
  dockMotionBtn.type = 'button';
  dock.append(starPillsWrap, dockLetterBtn, resetBtn, dockMotionBtn);

  // Audio player
  let audioEl: HTMLAudioElement | null = null;
  let musicPlaying = false;
  let musicMuted = false;
  let audioBlocked = false;
  let volume = 0.58;
  let dockSoundBtn: HTMLButtonElement | null = null;

  if (payload.musicPath) {
    audioEl = document.createElement('audio');
    audioEl.src = payload.musicPath;
    audioEl.loop = true;
    audioEl.volume = volume;

    transSoundBtn.classList.remove('gl-hidden');
    storySoundBtn.classList.remove('gl-hidden');

    dockSoundBtn = el('button', 'gl-btn gl-btn-accent', 'Звук вкл');
    dockSoundBtn.type = 'button';

    const volInput = document.createElement('input');
    volInput.type = 'range';
    volInput.min = '0';
    volInput.max = '1';
    volInput.step = '0.05';
    volInput.value = String(volume);
    volInput.className = 'gl-vol';
    volInput.setAttribute('aria-label', 'Громкость музыки');

    dock.append(dockSoundBtn, volInput);

    dockSoundBtn.addEventListener('click', toggleSound);
    transSoundBtn.addEventListener('click', toggleSound);
    storySoundBtn.addEventListener('click', toggleSound);
    audioManualBtn.addEventListener('click', () => {
      musicMuted = false;
      attemptPlayMusic();
    });

    volInput.addEventListener('input', () => {
      volume = Number(volInput.value);
      musicMuted = false;
      if (!musicPlaying) attemptPlayMusic();
      if (audioEl) audioEl.volume = volume;
      syncSoundLabels();
    });
  }

  function syncSoundLabels(): void {
    const label = audioBlocked
      ? 'Включить музыку'
      : musicMuted || !musicPlaying
        ? 'Звук выкл'
        : 'Звук вкл';
    if (dockSoundBtn) dockSoundBtn.textContent = label;
    transSoundBtn.textContent = label;
    storySoundBtn.textContent = label;
    audioBlockedBanner.classList.toggle('gl-hidden', !audioBlocked || phase === 'sealed');
  }

  function attemptPlayMusic(): void {
    if (!audioEl) return;
    audioEl.volume = musicMuted ? 0 : volume;
    const p = audioEl.play();
    if (p && typeof p.then === 'function') {
      p.then(() => {
        musicPlaying = true;
        audioBlocked = false;
        syncSoundLabels();
      }).catch(() => {
        musicPlaying = false;
        audioBlocked = true;
        syncSoundLabels();
      });
    }
  }

  function toggleSound(): void {
    if (!audioEl) return;
    if (!musicPlaying || audioBlocked) {
      musicMuted = false;
      attemptPlayMusic();
      return;
    }
    musicMuted = !musicMuted;
    audioEl.volume = musicMuted ? 0 : volume;
    syncSoundLabels();
  }

  stage.appendChild(dock);
  root.appendChild(stage);

  function applyStoryTextFormatting(): void {
    const star = normalizedStars[activeIndex] ?? normalizedStars[0];
    if (!star) return;
    const activeDevice = getActiveDevice();
    const cardLayout = resolveEffectiveCardLayout(payload, activeDevice);
    const glow = GLOW_COLORS[resolveStarGlowHex(star, payload.globalGlowColor)];
    const style = resolveEffectiveStarTextStyle(star, activeDevice);
    const fontMeta = resolveMessageFont(style.fontId);

    const w = window.innerWidth;
    const h = window.innerHeight;
    const isPortrait = h > w || w < 540;
    const isCompactLandscape = !isPortrait && h < 520;

    storyMotionWrap.style.maxWidth = isPortrait
      ? cardLayout.width === 'compact'
        ? '330px'
        : cardLayout.width === 'wide'
          ? '100%'
          : '374px'
      : cardLayout.width === 'compact'
        ? '448px'
        : cardLayout.width === 'wide'
          ? '672px'
          : '576px';
    const storyShiftY = Math.round(cardLayout.offsetY * 0.7);
    storyMotionWrap.style.translate = storyShiftY !== 0 ? `0 ${storyShiftY}px` : '';
    if (hasExplicitCardTheme) {
      storyMotionWrap.style.padding =
        cardLayout.padding === 'compact'
          ? isPortrait
            ? '8px 12px'
            : '12px 16px'
          : cardLayout.padding === 'spacious'
            ? isPortrait
              ? '16px 20px'
              : '24px 32px'
            : isPortrait
              ? '12px 16px'
              : '16px 24px';
    } else {
      storyMotionWrap.style.padding =
        cardLayout.padding === 'compact'
          ? '2px'
          : cardLayout.padding === 'spacious'
            ? isPortrait
              ? '8px 12px'
              : '12px 20px'
            : '0';
    }

    const effectiveAlign: Exclude<MessageTextAlign, 'auto'> =
      style.textAlign === 'auto' ? (isPortrait ? 'center' : 'left') : style.textAlign;
    const bodyPx = Math.min(
      style.fontSize + fontMeta.opticalSizeBoost,
      isCompactLandscape ? 16 : isPortrait ? 20 : 26,
    );
    const titlePx = Math.round(
      Math.min(isCompactLandscape ? 25 : isPortrait ? 31 : 38, bodyPx * 1.48),
    );
    const marginLeftPct = computeTextBlockMarginLeftPct(style.widthPct, style.offsetX);

    const illuLayout = resolveEffectiveIllustrationLayout(star, activeDevice);
    const illuLeftGrow = Number(((illuLayout.offsetX + 100) / 200).toFixed(3));
    const illuRightGrow = Number((1 - illuLeftGrow).toFixed(3));
    illuLeftSpacer.style.flexGrow = String(illuLeftGrow);
    illuRightSpacer.style.flexGrow = String(illuRightGrow);

    const clampedIlluScale = Math.min(isPortrait ? 1.28 : 1.45, illuLayout.scale);
    const baseIlluPx = isCompactLandscape
      ? 80
      : isPortrait
        ? w >= 640
          ? 156
          : 118
        : w >= 1024
          ? 196
          : 158;
    const effectiveIlluPx = Math.round(baseIlluPx * clampedIlluScale);
    illuFrame.style.width = `${effectiveIlluPx}px`;
    illuFrame.style.height = `${effectiveIlluPx}px`;

    const imgSettings = star.imageSettings ? resolveStarImageSettings(star) : null;
    if (imgSettings) {
      illuImg.style.objectFit = imgSettings.fit;
      illuImg.style.transform = `translate(${imgSettings.offsetX}%, ${imgSettings.offsetY}%) scale(${imgSettings.scale})`;
      illuImg.style.transformOrigin = 'center center';
    } else {
      illuImg.style.objectFit = 'contain';
      illuImg.style.transform = '';
    }

    const illuYShift = illuLayout.offsetY / 100;
    const textYShift = style.offsetY / 100;
    const spacerBase = isPortrait || isCompactLandscape ? 0.35 : 0.9;
    const rawTopOuterGrow = Math.max(
      0,
      Math.min(
        2.0,
        spacerBase * (1 + illuYShift * 0.85) - Math.max(0, -textYShift) * 0.45,
      ),
    );
    const rawTopInnerGrow = Math.max(
      0.06,
      Math.min(
        2.2,
        0.14 + Math.max(0, textYShift) * 1.4 + Math.max(0, -illuYShift) * 0.7,
      ),
    );
    const rawBottomInnerGrow = Math.max(
      0,
      Math.min(
        2.4,
        spacerBase + Math.max(0, -textYShift) * 1.35 - Math.max(0, textYShift) * 0.65,
      ),
    );

    const topOuterGrow = Number(
      (cardLayout.verticalAlign === 'top'
        ? rawTopOuterGrow * 0.2
        : cardLayout.verticalAlign === 'spread'
          ? rawTopOuterGrow * 0.4
          : rawTopOuterGrow
      ).toFixed(3),
    );
    const topInnerGrow = Number(
      (cardLayout.verticalAlign === 'spread'
        ? rawTopInnerGrow + 0.75
        : rawTopInnerGrow
      ).toFixed(3),
    );
    const bottomInnerGrow = Number(
      (cardLayout.verticalAlign === 'top'
        ? rawBottomInnerGrow + 1.15
        : cardLayout.verticalAlign === 'spread'
          ? rawBottomInnerGrow * 0.4
          : rawBottomInnerGrow
      ).toFixed(3),
    );

    topOuterSpacer.style.flexGrow = String(topOuterGrow);
    topInnerSpacer.style.flexGrow = String(topInnerGrow);
    bottomInnerSpacer.style.flexGrow = String(bottomInnerGrow);

    const starDecor = resolveEffectiveStarDecor(star, activeDevice);
    storyCardDecor.innerHTML = '';
    if (starDecor.motif !== 'none') {
      const dGlowHex = cardColors.isLightPaper ? cardColors.accentColor : glow.hex;
      const dCoreHex = cardColors.isLightPaper ? cardColors.badgeColor : glow.coreHex;
      const decorSvg = createCardDecorSvg(starDecor.motif, dGlowHex, dCoreHex);
      if (decorSvg) storyCardDecor.appendChild(decorSvg);
      storyCardDecor.classList.remove('gl-hidden');
      storyCardDecor.style.left = `${starDecor.xPct}%`;
      storyCardDecor.style.top = `${starDecor.yPct}%`;
      storyCardDecor.style.transform = `translate(-50%, -50%) scale(${starDecor.scale})`;
    } else {
      storyCardDecor.classList.add('gl-hidden');
    }

    const effectiveTextColor =
      star.textStyle || !cardColors.isLightPaper ? style.color : cardColors.textColor;
    const effectiveShadowMode =
      cardColors.isLightPaper && style.shadow !== 'glow' ? 'none' : style.shadow;
    const shadowCss = resolveTextShadowCss(effectiveShadowMode, glow.hex);

    storyBlock.style.width = `${style.widthPct}%`;
    storyBlock.style.marginLeft = `${marginLeftPct}%`;
    storyBlock.style.textAlign = effectiveAlign;
    storyBlock.style.fontFamily = fontMeta.cssFamily;
    storyBlock.style.borderColor = '';
    storyBlock.classList.remove(
      'gl-story-block-frame',
      'gl-story-block-frame-light',
      'gl-story-block-quote-left',
      'gl-story-block-quote-right',
    );
    if (style.accent === 'frame') {
      storyBlock.classList.add('gl-story-block-frame');
      if (cardColors.isLightPaper) storyBlock.classList.add('gl-story-block-frame-light');
      storyBlock.style.borderColor = `${cardColors.isLightPaper ? cardColors.accentColor : glow.hex}44`;
    } else if (style.accent === 'quote') {
      storyBlock.classList.add(
        effectiveAlign === 'right'
          ? 'gl-story-block-quote-right'
          : 'gl-story-block-quote-left',
      );
      storyBlock.style.borderColor = cardColors.isLightPaper ? cardColors.accentColor : glow.hex;
    }

    if (style.accent === 'line') {
      storyAccentLine.classList.remove('gl-hidden');
      storyAccentLine.style.background = cardColors.isLightPaper
        ? `linear-gradient(90deg, ${cardColors.accentColor}, ${cardColors.badgeColor})`
        : `linear-gradient(90deg, ${glow.hex}, ${glow.coreHex})`;
      storyAccentLine.style.marginLeft = effectiveAlign === 'left' ? '0' : 'auto';
      storyAccentLine.style.marginRight = effectiveAlign === 'center' ? 'auto' : '0';
    } else {
      storyAccentLine.classList.add('gl-hidden');
    }

    storyTitle.style.fontFamily = fontMeta.cssFamily;
    storyTitle.style.fontSize = `${titlePx}px`;
    storyTitle.style.fontWeight = '600';
    storyTitle.style.lineHeight = String(
      Math.min(1.4, Math.max(1.12, Number((style.lineHeight * 0.78).toFixed(2)))),
    );
    storyTitle.style.color = effectiveTextColor;
    storyTitle.style.textShadow = shadowCss;

    storyMsg.style.fontFamily = fontMeta.cssFamily;
    storyMsg.style.fontSize = `${bodyPx}px`;
    storyMsg.style.fontWeight = style.fontWeight === 'semibold' ? '600' : '400';
    storyMsg.style.lineHeight = String(style.lineHeight);
    storyMsg.style.color = effectiveTextColor;
    storyMsg.style.textShadow = shadowCss;

    if (signatureText) {
      storySign.style.color = effectiveTextColor;
      storySign.style.opacity = '0.78';
      storySign.style.textShadow = shadowCss;
    }
  }

  function renderStoryUI(): void {
    const star = normalizedStars[activeIndex] ?? normalizedStars[0];
    if (!star) return;
    const total = normalizedStars.length;
    const glow = GLOW_COLORS[resolveStarGlowHex(star, payload.globalGlowColor)];

    progressText.textContent = `${activeIndex + 1} / ${total}`;
    dotsContainer.innerHTML = '';
    normalizedStars.forEach((s, idx) => {
      const isUnlocked = idx < unlockedCount || finaleReached;
      const isCurrent = idx === activeIndex;
      const dot = el(
        'button',
        `gl-star-dot${isCurrent ? ' gl-star-dot-active' : ''}`,
      );
      dot.type = 'button';
      dot.disabled = !isUnlocked;
      const hex = GLOW_COLORS[resolveStarGlowHex(s, payload.globalGlowColor)].hex;
      dot.style.color = isUnlocked ? hex : '#94a3b8';
      if (isCurrent) {
        dot.style.filter = `drop-shadow(0 0 8px ${hex})`;
        dot.setAttribute('aria-current', 'step');
      }
      dot.title = isUnlocked
        ? s.title || `Звезда ${idx + 1}`
        : `Звезда ${idx + 1} ещё не открыта`;
      dot.setAttribute(
        'aria-label',
        isUnlocked
          ? `Открыть звезду ${idx + 1}: ${s.title || ''}`
          : `Звезда ${idx + 1} закрыта`,
      );
      dot.appendChild(createProgressStarSvg(isUnlocked, isCurrent));
      if (isUnlocked) {
        dot.addEventListener('click', () => {
          navigateStory({ type: 'index', index: idx });
        });
      }
      dotsContainer.appendChild(dot);
    });

    illuGlow.style.background = `radial-gradient(circle, ${glow.hex}3a 0%, transparent 70%)`;
    illuImg.src = star.assetImagePath;
    illuImg.alt = star.title;

    storyOrd.textContent = `Звезда ${activeIndex + 1} из ${total}`;
    storyOrd.style.color = cardColors.isLightPaper ? cardColors.badgeColor : glow.coreHex;
    storyTitle.textContent = star.title || `Звезда ${activeIndex + 1}`;
    storyMsg.textContent = star.message || 'Здесь хранится особое тёплое пожелание.';
    applyStoryTextFormatting();

    prevArrowBtn.disabled = activeIndex <= 0;
    backToConstBtn.classList.toggle('gl-hidden', !finaleReached);

    const isLast = activeIndex >= total - 1;
    nextArrowBtn.textContent = isLast ? '✦' : '›';
    nextArrowBtn.classList.toggle('gl-nav-arrow-finale', isLast);
    nextArrowBtn.setAttribute(
      'aria-label',
      isLast ? 'Завершить и зажечь созвездие' : 'Следующая звезда',
    );
    swipeHint.classList.toggle('gl-swipe-hint-finale', isLast);
    swipeHintText.textContent = isLast
      ? 'Свайп влево завершит создание созвездия'
      : 'Свайп влево — следующая звезда';

    storyUi.classList.remove('gl-story-anim');
    void storyUi.offsetWidth;
    storyUi.classList.add('gl-story-anim');
  }

  function updateEngine(): void {
    const activeStar = normalizedStars[activeIndex];
    const activeId =
      phase === 'starStory' || phase === 'birthing' ? activeStar?.id ?? null : null;
    const activeDevice = getActiveDevice();

    engine?.updateState({
      paletteId: payload.paletteId,
      globalGlowColor: payload.globalGlowColor,
      stars: normalizedStars,
      connections: resolvedConnections,
      selectedStarId: activeId,
      visitedStarIds: normalizedStars
        .slice(0, Math.max(0, unlockedCount))
        .map((s) => s.id),
      interactionMode: 'recipient',
      recipientPhase: phase,
      unlockedCount,
      finaleActive: phase === 'finalReveal' || phase === 'constellation' || finaleReached,
      constellationLayout: resolveEffectiveConstellationLayout(payload, activeDevice),
      lowPerformance: window.innerWidth < 768,
      reducedMotion,
    });
  }

  function setPhase(next: RecipientPhase): void {
    phase = next;
    sealedUi.classList.toggle('gl-hidden', next !== 'sealed');
    sealed2DOverlay.classList.toggle('gl-hidden', !(next === 'sealed' && using2DFallback));
    transUi.classList.toggle('gl-hidden', next !== 'birthing' && next !== 'finalReveal');
    storyUi.classList.toggle('gl-hidden', next !== 'starStory');
    if (next === 'constellation') {
      setLetterOpen(true);
    } else {
      letterBackdrop.classList.add('gl-hidden');
    }
    dock.classList.toggle('gl-hidden', next !== 'constellation');

    if (next === 'starStory') {
      renderStoryUI();
    }
    syncSoundLabels();
    updateEngine();
    if (using2DFallback) refresh2DFallback();
  }

  function handleOpenEnvelope(): void {
    if (phase !== 'sealed' || isTransitionLocked) return;
    attemptPlayMusic();
    unlockedCount = 1;
    activeIndex = 0;

    if (using2DFallback || reducedMotion) {
      engine?.skipBirthSequence();
      acquireLock(90);
      setPhase('starStory');
      return;
    }

    setPhase('birthing');
    engine?.playBirthSequence();
  }

  function handleTriggerFinalReveal(): void {
    unlockedCount = normalizedStars.length;
    if (using2DFallback || reducedMotion) {
      engine?.skipFinalReveal();
      finaleReached = true;
      acquireLock(100);
      setPhase('constellation');
      return;
    }
    releaseLock();
    setPhase('finalReveal');
    engine?.playFinalReveal();
  }

  /**
   * Unified transition handler for swipes, arrows, star progress buttons, 3D star clicks, and keyboard.
   */
  function navigateStory(intent: StoryIntent): void {
    const total = normalizedStars.length;
    if (total === 0) return;
    if (isTransitionLocked) return;
    if (phase === 'sealed' || phase === 'birthing' || phase === 'finalReveal') return;

    const instant = reducedMotion || using2DFallback;
    const lockMs = instant ? 90 : 460;

    if (intent.type === 'constellation') {
      if (!finaleReached || phase === 'constellation') return;
      acquireLock(lockMs);
      setPhase('constellation');
      return;
    }

    if (phase === 'constellation') {
      if (intent.type !== 'index') return;
      if (intent.index < 0 || intent.index >= total) return;
      acquireLock(lockMs);
      activeIndex = intent.index;
      setPhase('starStory');
      return;
    }

    // phase === 'starStory'
    if (intent.type === 'next') {
      if (activeIndex >= total - 1) {
        handleTriggerFinalReveal();
        return;
      }
      const nextIdx = activeIndex + 1;
      const nextStar = normalizedStars[nextIdx];
      const isBrandNew = nextIdx >= unlockedCount;

      acquireLock(lockMs);
      if (isBrandNew) unlockedCount = nextIdx + 1;
      activeIndex = nextIdx;

      renderStoryUI();
      updateEngine();
      if (using2DFallback) refresh2DFallback();

      if (isBrandNew && nextStar && !instant) {
        engine?.triggerStarBirth(nextStar.id);
      }
      return;
    }

    if (intent.type === 'prev') {
      if (activeIndex <= 0) return;
      acquireLock(lockMs);
      activeIndex -= 1;
      renderStoryUI();
      updateEngine();
      if (using2DFallback) refresh2DFallback();
      return;
    }

    if (intent.type === 'index') {
      if (intent.index < 0 || intent.index >= total) return;
      if (intent.index >= unlockedCount && !finaleReached) return;
      if (intent.index === activeIndex) return;

      acquireLock(lockMs);
      activeIndex = intent.index;
      renderStoryUI();
      updateEngine();
      if (using2DFallback) refresh2DFallback();
    }
  }

  openBtn.addEventListener('click', handleOpenEnvelope);

  skipBtn.addEventListener('click', () => {
    releaseLock();
    if (phase === 'birthing') {
      engine?.skipBirthSequence();
      unlockedCount = Math.max(1, unlockedCount);
      activeIndex = 0;
      setPhase('starStory');
    } else if (phase === 'finalReveal') {
      engine?.skipFinalReveal();
      finaleReached = true;
      setPhase('constellation');
    }
  });

  prevArrowBtn.addEventListener('click', () => navigateStory({ type: 'prev' }));
  nextArrowBtn.addEventListener('click', () => navigateStory({ type: 'next' }));
  backToConstBtn.addEventListener('click', () => navigateStory({ type: 'constellation' }));

  // Pointer Events swipe handler on story content container ONLY (independent of 3D canvas OrbitControls)
  let swipeActive = false;
  let swipePointerId: number | null = null;
  let swipeStartX = 0;
  let swipeStartY = 0;
  let swipeHasHorizontalIntent = false;

  function resetSwipe(): void {
    swipeActive = false;
    swipePointerId = null;
    swipeHasHorizontalIntent = false;
    storyMotionWrap.style.transform = '';
  }

  storyRight.addEventListener('pointerdown', (e) => {
    if (phase !== 'starStory' || isTransitionLocked) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    if (swipeActive && swipePointerId !== e.pointerId) {
      resetSwipe();
      return;
    }
    if (shouldIgnoreSwipeTarget(e.target, e.pointerType)) return;
    if (hasActiveTextSelection()) return;

    swipeActive = true;
    swipePointerId = e.pointerId;
    swipeStartX = e.clientX;
    swipeStartY = e.clientY;
    swipeHasHorizontalIntent = false;
  });

  storyRight.addEventListener('pointermove', (e) => {
    if (!swipeActive || swipePointerId !== e.pointerId) return;
    if (isTransitionLocked || hasActiveTextSelection()) {
      resetSwipe();
      return;
    }

    const dx = e.clientX - swipeStartX;
    const dy = e.clientY - swipeStartY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (!swipeHasHorizontalIntent && absY > 20 && absY >= absX * 1.05) {
      resetSwipe();
      return;
    }

    if (!swipeHasHorizontalIntent && absX > 16 && absX > absY * SWIPE_HORIZONTAL_RATIO) {
      swipeHasHorizontalIntent = true;
    }

    if (swipeHasHorizontalIntent && !reducedMotion) {
      const clamped = Math.max(-26, Math.min(26, dx * 0.24));
      storyMotionWrap.style.transform = `translate3d(${clamped}px, 0, 0)`;
    }
  });

  storyRight.addEventListener('pointerup', (e) => {
    if (!swipeActive || swipePointerId !== e.pointerId) return;

    const dx = e.clientX - swipeStartX;
    const dy = e.clientY - swipeStartY;
    resetSwipe();

    if (isTransitionLocked || hasActiveTextSelection()) return;

    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX >= SWIPE_MIN_DISTANCE_PX && absX > absY * SWIPE_HORIZONTAL_RATIO) {
      if (dx < 0) {
        navigateStory({ type: 'next' });
      } else {
        navigateStory({ type: 'prev' });
      }
    }
  });

  storyRight.addEventListener('pointercancel', resetSwipe);
  storyRight.addEventListener('lostpointercapture', resetSwipe);

  window.addEventListener('keydown', (e) => {
    if (phase !== 'starStory') return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      navigateStory({ type: 'next' });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      navigateStory({ type: 'prev' });
    }
  });

  resetBtn.addEventListener('click', () => {
    engine?.resetCamera();
  });

  function toggleMotionMode(): void {
    reducedMotion = !reducedMotion;
    stage.classList.toggle('gl-reduced', reducedMotion);
    storyMotionBtn.textContent = reducedMotion ? 'Обычное движение' : 'Меньше движения';
    dockMotionBtn.textContent = reducedMotion ? 'Вращение: выкл' : 'Меньше движения';
    updateEngine();
  }
  storyMotionBtn.addEventListener('click', toggleMotionMode);
  dockMotionBtn.addEventListener('click', toggleMotionMode);

  function create2DShapeSvg(shape: StarShapeId, hex: string, coreHex: string, sizePx: number): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 48 48');
    svg.setAttribute('width', String(sizePx));
    svg.setAttribute('height', String(sizePx));
    svg.setAttribute('fill', 'none');

    const ns = 'http://www.w3.org/2000/svg';
    if (shape === 'heart') {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', 'M24 39.5C24 39.5 8.5 29.8 8.5 18.8C8.5 13.5 12.6 9.5 17.5 9.5C20.5 9.5 22.8 11 24 13.1C25.2 11 27.5 9.5 30.5 9.5C35.4 9.5 39.5 13.5 39.5 18.8C39.5 29.8 24 39.5 24 39.5Z');
      p.setAttribute('fill', hex);
      p.setAttribute('fill-opacity', '0.35');
      p.setAttribute('stroke', hex);
      p.setAttribute('stroke-width', '2.4');
      svg.appendChild(p);
    } else if (shape === 'flower') {
      for (let d = 0; d < 360; d += 60) {
        const e = document.createElementNS(ns, 'ellipse');
        e.setAttribute('cx', '24');
        e.setAttribute('cy', '12.5');
        e.setAttribute('rx', '5.2');
        e.setAttribute('ry', '8.5');
        e.setAttribute('transform', `rotate(${d} 24 24)`);
        e.setAttribute('fill', hex);
        e.setAttribute('fill-opacity', '0.3');
        e.setAttribute('stroke', hex);
        e.setAttribute('stroke-width', '1.8');
        svg.appendChild(e);
      }
      const c = document.createElementNS(ns, 'circle');
      c.setAttribute('cx', '24');
      c.setAttribute('cy', '24');
      c.setAttribute('r', '5');
      c.setAttribute('fill', coreHex);
      svg.appendChild(c);
    } else if (shape === 'moon') {
      const p = document.createElementNS(ns, 'path');
      p.setAttribute('d', 'M29.8 9.2C20.6 9.9 13.5 17.3 13.5 26.2C13.5 35.1 20.8 42.1 30 42.1C33.4 42.1 36.6 41 39.2 39.1C32.2 39 26.5 33.4 26.5 25.8C26.5 18.6 31.3 12.6 38 11.4C35.5 9.9 32.7 9 29.8 9.2Z');
      p.setAttribute('fill', hex);
      p.setAttribute('fill-opacity', '0.34');
      p.setAttribute('stroke', hex);
      p.setAttribute('stroke-width', '2.4');
      svg.appendChild(p);
    } else if (shape === 'comet') {
      const tail = document.createElementNS(ns, 'path');
      tail.setAttribute('d', 'M28.5 19.5L8.5 38.5M26.5 15.5L11 27.5M32.5 22L20.5 37.5');
      tail.setAttribute('stroke', hex);
      tail.setAttribute('stroke-width', '2.4');
      tail.setAttribute('stroke-linecap', 'round');
      const head = document.createElementNS(ns, 'polygon');
      head.setAttribute('points', '32,10 38,16 32,22 26,16');
      head.setAttribute('fill', coreHex);
      head.setAttribute('stroke', hex);
      head.setAttribute('stroke-width', '2.2');
      svg.append(tail, head);
    } else if (shape === 'planet') {
      const body = document.createElementNS(ns, 'circle');
      body.setAttribute('cx', '24');
      body.setAttribute('cy', '24');
      body.setAttribute('r', '9.5');
      body.setAttribute('fill', hex);
      body.setAttribute('fill-opacity', '0.36');
      body.setAttribute('stroke', hex);
      body.setAttribute('stroke-width', '2.2');
      const ring = document.createElementNS(ns, 'ellipse');
      ring.setAttribute('cx', '24');
      ring.setAttribute('cy', '24');
      ring.setAttribute('rx', '18.5');
      ring.setAttribute('ry', '5.8');
      ring.setAttribute('transform', 'rotate(-22 24 24)');
      ring.setAttribute('stroke', coreHex);
      ring.setAttribute('stroke-width', '2.1');
      svg.append(body, ring);
    } else if (shape === 'spark') {
      const poly = document.createElementNS(ns, 'polygon');
      poly.setAttribute('points', '24,4 28.8,19.2 44,24 28.8,28.8 24,44 19.2,28.8 4,24 19.2,19.2');
      poly.setAttribute('fill', hex);
      poly.setAttribute('fill-opacity', '0.32');
      poly.setAttribute('stroke', hex);
      poly.setAttribute('stroke-width', '2.2');
      poly.setAttribute('stroke-linejoin', 'round');
      const core = document.createElementNS(ns, 'circle');
      core.setAttribute('cx', '24');
      core.setAttribute('cy', '24');
      core.setAttribute('r', '3.5');
      core.setAttribute('fill', coreHex);
      svg.append(poly, core);
    } else {
      const poly = document.createElementNS(ns, 'polygon');
      poly.setAttribute('points', '24,5 29.3,16.5 42,18.1 32.6,26.8 35.1,39.4 24,33.2 12.9,39.4 15.4,26.8 6,18.1 18.7,16.5');
      poly.setAttribute('fill', hex);
      poly.setAttribute('fill-opacity', '0.32');
      poly.setAttribute('stroke', hex);
      poly.setAttribute('stroke-width', '2.2');
      svg.appendChild(poly);
    }
    return svg;
  }

  // 2D fallback renderer if WebGL2 is unavailable
  let fallbackSvg: SVGSVGElement | null = null;
  const fallbackLines: Array<{
    from: StandaloneStar;
    to: StandaloneStar;
    line: SVGLineElement;
  }> = [];
  const fallbackButtons = new Map<string, { btn: HTMLButtonElement; label: HTMLSpanElement; iconWrap: HTMLSpanElement }>();

  function toPct(
    x: number,
    y: number,
    constLayout?: { offsetX: number; offsetY: number; scale: number },
  ): { left: number; top: number } {
    const scale = constLayout?.scale ?? 1;
    const shiftX = ((constLayout?.offsetX ?? 0) / 100) * 18;
    const shiftY = ((constLayout?.offsetY ?? 0) / 100) * 18;
    return {
      left: Math.max(10, Math.min(90, 50 + ((x * scale) / 5.2) * 40 + shiftX)),
      top: Math.max(14, Math.min(86, 50 - ((y * scale) / 3.4) * 38 + shiftY)),
    };
  }

  function mount2DFallback(): void {
    using2DFallback = true;
    canvasHost.innerHTML = '';
    canvasHost.style.background = palette.cssGradient;

    if (phase === 'sealed') {
      sealed2DOverlay.classList.remove('gl-hidden');
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('class', 'gl-2d-lines');
    fallbackSvg = svg;

    const starMap = new Map(normalizedStars.map((s) => [s.id, s]));
    const constLayout = resolveEffectiveConstellationLayout(payload, getActiveDevice());
    fallbackLines.length = 0;
    for (const conn of resolvedConnections) {
      const fromStar = starMap.get(conn.from);
      const toStar = starMap.get(conn.to);
      if (!fromStar || !toStar) continue;
      const p1 = toPct(fromStar.position.x, fromStar.position.y, constLayout);
      const p2 = toPct(toStar.position.x, toStar.position.y, constLayout);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(p1.left));
      line.setAttribute('y1', String(p1.top));
      line.setAttribute('x2', String(p2.left));
      line.setAttribute('y2', String(p2.top));
      line.setAttribute('stroke', palette.lineTint);
      line.setAttribute('stroke-width', '0.45');
      line.setAttribute('stroke-opacity', '0.78');
      svg.appendChild(line);
      fallbackLines.push({ from: fromStar, to: toStar, line });
    }
    canvasHost.appendChild(svg);

    normalizedStars.forEach((star, idx) => {
      const p = toPct(star.position.x, star.position.y, constLayout);
      const glow = GLOW_COLORS[resolveStarGlowHex(star, payload.globalGlowColor)];
      const btn = el('button', 'gl-2d-star');
      btn.type = 'button';
      btn.style.left = `${p.left}%`;
      btn.style.top = `${p.top}%`;

      const iconWrap = el('span');
      iconWrap.style.filter = `drop-shadow(0 0 12px ${glow.hex})`;
      iconWrap.appendChild(
        create2DShapeSvg(resolveStarShape(star), glow.hex, glow.coreHex, 34),
      );
      const lbl = el('span', 'gl-2d-label', star.title);
      btn.append(iconWrap, lbl);
      btn.addEventListener('click', () => navigateStory({ type: 'index', index: idx }));
      canvasHost.appendChild(btn);
      fallbackButtons.set(star.id, { btn, label: lbl, iconWrap });
    });

    refresh2DFallback();
  }

  function refresh2DFallback(): void {
    if (!using2DFallback) return;
    const isStory = phase === 'starStory';
    const isPortrait = window.innerHeight > window.innerWidth || window.innerWidth < 540;
    const constLayout = resolveEffectiveConstellationLayout(payload, getActiveDevice());
    if (fallbackSvg) {
      fallbackSvg.style.display = phase === 'constellation' || phase === 'finalReveal' ? 'block' : 'none';
      for (const item of fallbackLines) {
        const p1 = toPct(item.from.position.x, item.from.position.y, constLayout);
        const p2 = toPct(item.to.position.x, item.to.position.y, constLayout);
        item.line.setAttribute('x1', String(p1.left));
        item.line.setAttribute('y1', String(p1.top));
        item.line.setAttribute('x2', String(p2.left));
        item.line.setAttribute('y2', String(p2.top));
      }
    }

    normalizedStars.forEach((star, idx) => {
      const slot = fallbackButtons.get(star.id);
      if (!slot) return;
      if (idx >= unlockedCount) {
        slot.btn.style.display = 'none';
        return;
      }
      slot.btn.style.display = 'flex';
      const isHero = isStory && idx === activeIndex;
      const p = isHero
        ? isPortrait
          ? { left: 50, top: 20 }
          : { left: 22, top: 50 }
        : toPct(star.position.x, star.position.y, constLayout);

      slot.btn.style.left = `${p.left}%`;
      slot.btn.style.top = `${p.top}%`;
      slot.btn.style.opacity = isStory && !isHero ? '0.52' : '1';
      slot.btn.style.transform = `translate(-50%, -50%) scale(${isHero ? 2.15 : 1})`;
      slot.label.style.display = isHero ? 'none' : 'block';
    });
  }

  const handleViewportUpdate = () => {
    if (phase === 'starStory') applyStoryTextFormatting();
    applyFinaleTextFormatting();
    updateEngine();
    if (using2DFallback) refresh2DFallback();
  };
  window.addEventListener('resize', handleViewportUpdate);
  window.addEventListener('orientationchange', handleViewportUpdate);

  engine = new ConstellationEngine(
    canvasHost,
    {
      paletteId: payload.paletteId,
      globalGlowColor: payload.globalGlowColor,
      stars: normalizedStars,
      connections: resolvedConnections,
      selectedStarId: null,
      visitedStarIds: [],
      interactionMode: 'recipient',
      recipientPhase: 'sealed',
      unlockedCount: 0,
      finaleActive: false,
      constellationLayout: resolveEffectiveConstellationLayout(payload, getActiveDevice()),
      lowPerformance: window.innerWidth < 768,
      reducedMotion,
    },
    {
      onSelectStar: (id) => {
        const idx = normalizedStars.findIndex((s) => s.id === id);
        if (idx !== -1) navigateStory({ type: 'index', index: idx });
      },
      onOpenEnvelope: () => handleOpenEnvelope(),
      onBirthComplete: () => {
        releaseLock();
        unlockedCount = Math.max(1, unlockedCount);
        activeIndex = 0;
        setPhase('starStory');
      },
      onFinalRevealComplete: () => {
        releaseLock();
        finaleReached = true;
        setPhase('constellation');
      },
      onWebGLUnavailable: () => {
        engine = null;
        mount2DFallback();
      },
    },
    { startSealed: true },
  );
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootGiftLabRecipient);
} else {
  bootGiftLabRecipient();
}
