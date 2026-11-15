import { ConstellationEngine } from '../scene/ConstellationEngine';
import {
  COSMIC_PALETTES,
  GLOW_COLORS,
  computeTextBlockMarginLeftPct,
  isDefaultStarTextStyle,
  resolveMessageFont,
  resolveStarGlowHex,
  resolveStarShape,
  resolveStarTextStyle,
  resolveTextShadowCss,
  sanitizeConnections,
} from '../scene/paletteConfig';
import type {
  ConstellationStar,
  CosmicPaletteId,
  GlowColorId,
  MessageTextAlign,
  RecipientPhase,
  StarConnection,
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
  stars: StandaloneStar[];
  connections?: StarConnection[];
  finalMessage: string;
  finalTextStyle?: StarTextStyle;
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
  const storyContent = el('article', 'gl-story-content');

  const topOuterSpacer = el('div', 'gl-story-spacer');
  const illuWrap = el('div', 'gl-illu-wrap');
  const illuGlow = el('div', 'gl-illu-glow');
  const illuImg = document.createElement('img');
  illuImg.className = 'gl-illu-img';
  illuWrap.append(illuGlow, illuImg);

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
    illuWrap,
    topInnerSpacer,
    storyBlock,
    bottomInnerSpacer,
  );
  storyMotionWrap.appendChild(storyContent);

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

  // PHASE 5: Final Rotating Constellation Top Greeting & Dock
  const finaleScrim = el('div', 'gl-finale-scrim gl-hidden');
  const finaleTop = el('header', 'gl-finale-top gl-hidden');
  const finaleBox = el('div', 'gl-finale-box');
  const finaleKicker = el(
    'p',
    'gl-finale-kicker',
    payload.recipientName ? `Для ${payload.recipientName} · ${payload.title}` : payload.title,
  );
  const finaleAccentLine = el('div', 'gl-story-accent-line gl-hidden');
  const finaleHeading = el('h1', 'gl-finale-heading', payload.finalMessage);
  const finaleSignEl = el('p', 'gl-finale-sign', signatureText);
  if (!signatureText) finaleSignEl.classList.add('gl-hidden');
  finaleBox.append(finaleKicker, finaleAccentLine, finaleHeading, finaleSignEl);
  finaleTop.appendChild(finaleBox);
  stage.append(finaleScrim, finaleTop);

  function applyFinaleTextFormatting(): void {
    if (!payload.finalTextStyle) return;
    const style = resolveStarTextStyle(payload.finalTextStyle);
    if (isDefaultStarTextStyle(style)) return;

    const fontMeta = resolveMessageFont(style.fontId);
    const isPortrait = window.innerHeight > window.innerWidth || window.innerWidth < 540;
    const align: Exclude<MessageTextAlign, 'auto'> =
      style.textAlign !== 'auto' ? style.textAlign : 'center';
    const shadowCss = resolveTextShadowCss(style.shadow, globalGlow.hex);

    finaleBox.classList.remove(
      'gl-story-block-frame',
      'gl-story-block-quote-left',
      'gl-story-block-quote-right',
    );
    finaleBox.style.textAlign = align;
    finaleBox.style.fontFamily = fontMeta.cssFamily;
    finaleBox.style.borderColor = '';

    if (style.accent === 'frame') {
      finaleBox.classList.add('gl-story-block-frame');
      finaleBox.style.borderColor = `${globalGlow.hex}44`;
    } else if (style.accent === 'quote') {
      finaleBox.classList.add(
        align === 'right' ? 'gl-story-block-quote-right' : 'gl-story-block-quote-left',
      );
      finaleBox.style.borderColor = globalGlow.hex;
    }

    if (style.accent === 'line') {
      finaleAccentLine.classList.remove('gl-hidden');
      finaleAccentLine.style.background = `linear-gradient(90deg, ${globalGlow.hex}, ${globalGlow.coreHex})`;
      finaleAccentLine.style.marginLeft = align === 'left' ? '0' : 'auto';
      finaleAccentLine.style.marginRight = align === 'center' ? 'auto' : '0';
    } else {
      finaleAccentLine.classList.add('gl-hidden');
    }

    const finalePx = Math.min(
      isPortrait ? 24 : 34,
      Math.max(16, Math.round((style.fontSize + fontMeta.opticalSizeBoost) * 1.28)),
    );
    finaleHeading.style.fontFamily = fontMeta.cssFamily;
    finaleHeading.style.fontWeight = style.fontWeight === 'semibold' ? '600' : '400';
    finaleHeading.style.fontSize = `${finalePx}px`;
    finaleHeading.style.lineHeight = String(Math.min(1.65, style.lineHeight));
    finaleHeading.style.color = style.color;
    finaleHeading.style.textShadow = shadowCss;

    if (signatureText) {
      finaleSignEl.style.color = style.color;
      finaleSignEl.style.opacity = '0.78';
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

  const resetBtn = el('button', 'gl-btn gl-btn-ghost', 'Сброс');
  resetBtn.type = 'button';
  const dockMotionBtn = el(
    'button',
    'gl-btn gl-btn-ghost',
    reducedMotion ? 'Вращение: выкл' : 'Меньше движения',
  );
  dockMotionBtn.type = 'button';
  dock.append(starPillsWrap, resetBtn, dockMotionBtn);

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
    const glow = GLOW_COLORS[resolveStarGlowHex(star, payload.globalGlowColor)];
    const style = resolveStarTextStyle(star);
    const fontMeta = resolveMessageFont(style.fontId);

    const w = window.innerWidth;
    const h = window.innerHeight;
    const isPortrait = h > w || w < 540;
    const isCompactLandscape = !isPortrait && h < 520;

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

    const absYRatio = Math.min(1, Math.abs(style.offsetY) / 100);
    const spacerBase = isPortrait || isCompactLandscape ? 0.35 : 0.9;
    const topOuterGrow = Number(((1 - absYRatio) * spacerBase).toFixed(3));
    const topInnerGrow = Number(
      (style.offsetY <= 0
        ? 0.08 * (1 + style.offsetY / 100)
        : 0.08 + (style.offsetY / 100) * 1.92
      ).toFixed(3),
    );
    const bottomInnerGrow = Number(
      (style.offsetY >= 0
        ? (1 - absYRatio) * spacerBase
        : spacerBase + (-style.offsetY / 100) * (2 - spacerBase)
      ).toFixed(3),
    );

    topOuterSpacer.style.flexGrow = String(topOuterGrow);
    topInnerSpacer.style.flexGrow = String(topInnerGrow);
    bottomInnerSpacer.style.flexGrow = String(bottomInnerGrow);

    const shadowCss = resolveTextShadowCss(style.shadow, glow.hex);

    storyBlock.style.width = `${style.widthPct}%`;
    storyBlock.style.marginLeft = `${marginLeftPct}%`;
    storyBlock.style.textAlign = effectiveAlign;
    storyBlock.style.fontFamily = fontMeta.cssFamily;
    storyBlock.style.borderColor = '';
    storyBlock.classList.remove(
      'gl-story-block-frame',
      'gl-story-block-quote-left',
      'gl-story-block-quote-right',
    );
    if (style.accent === 'frame') {
      storyBlock.classList.add('gl-story-block-frame');
      storyBlock.style.borderColor = `${glow.hex}44`;
    } else if (style.accent === 'quote') {
      storyBlock.classList.add(
        effectiveAlign === 'right'
          ? 'gl-story-block-quote-right'
          : 'gl-story-block-quote-left',
      );
      storyBlock.style.borderColor = glow.hex;
    }

    if (style.accent === 'line') {
      storyAccentLine.classList.remove('gl-hidden');
      storyAccentLine.style.background = `linear-gradient(90deg, ${glow.hex}, ${glow.coreHex})`;
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
    storyTitle.style.color = style.color;
    storyTitle.style.textShadow = shadowCss;

    storyMsg.style.fontFamily = fontMeta.cssFamily;
    storyMsg.style.fontSize = `${bodyPx}px`;
    storyMsg.style.fontWeight = style.fontWeight === 'semibold' ? '600' : '400';
    storyMsg.style.lineHeight = String(style.lineHeight);
    storyMsg.style.color = style.color;
    storyMsg.style.textShadow = shadowCss;

    if (signatureText) {
      storySign.style.color = style.color;
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
    storyOrd.style.color = glow.coreHex;
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
    finaleScrim.classList.toggle('gl-hidden', next !== 'constellation');
    finaleTop.classList.toggle('gl-hidden', next !== 'constellation');
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
  const fallbackButtons = new Map<string, { btn: HTMLButtonElement; label: HTMLSpanElement; iconWrap: HTMLSpanElement }>();

  function toPct(x: number, y: number): { left: number; top: number } {
    return {
      left: Math.max(10, Math.min(90, 50 + (x / 5.2) * 40)),
      top: Math.max(14, Math.min(86, 50 - (y / 3.4) * 38)),
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
    for (const conn of resolvedConnections) {
      const fromStar = starMap.get(conn.from);
      const toStar = starMap.get(conn.to);
      if (!fromStar || !toStar) continue;
      const p1 = toPct(fromStar.position.x, fromStar.position.y);
      const p2 = toPct(toStar.position.x, toStar.position.y);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(p1.left));
      line.setAttribute('y1', String(p1.top));
      line.setAttribute('x2', String(p2.left));
      line.setAttribute('y2', String(p2.top));
      line.setAttribute('stroke', palette.lineTint);
      line.setAttribute('stroke-width', '0.45');
      line.setAttribute('stroke-opacity', '0.78');
      svg.appendChild(line);
    }
    canvasHost.appendChild(svg);

    normalizedStars.forEach((star, idx) => {
      const p = toPct(star.position.x, star.position.y);
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
    if (fallbackSvg) {
      fallbackSvg.style.display = phase === 'constellation' || phase === 'finalReveal' ? 'block' : 'none';
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
        : toPct(star.position.x, star.position.y);

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
