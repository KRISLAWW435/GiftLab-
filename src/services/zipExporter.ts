import JSZip from 'jszip';
import { renderBuiltinIllustrationToBlob } from '../assets/illustrations';
import {
  MUSIC_TRACKS,
  resolveStarShape,
  sanitizeConnections,
} from '../scene/paletteConfig';
import type { BuiltinIllustrationId, ConstellationProject } from '../types/project';
import { getImageBlob } from './database';
import { getMusicTrackBlob } from './musicEngine';
import runtimeBundle from '../standalone/runtime.bundle.txt?raw';

function escapeHtmlText(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeJsonForScriptTag(obj: unknown): string {
  return JSON.stringify(obj)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

function sanitizeFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_');
  return cleaned || 'Моё_созвездие';
}

const STANDALONE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #app { width: 100%; height: 100%; overflow: hidden; font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #f8fafc; background: #090d1f; }
  .gl-stage { position: relative; width: 100%; height: 100dvh; overflow: hidden; }
  .gl-canvas { position: absolute; inset: 0; width: 100%; height: 100%; }

  /* Sealed & Birthing & FinalReveal Chrome */
  .gl-sealed-ui { position: fixed; inset: 0; z-index: 20; display: flex; flex-direction: column; justify-content: space-between; padding: 28px 20px; pointer-events: none; }
  .gl-sealed-head { text-align: center; max-width: 680px; margin: 0 auto; }
  .gl-sealed-foot { pointer-events: auto; display: flex; flex-direction: column; align-items: center; gap: 12px; padding-bottom: 16px; }
  .gl-sealed-sub { font-size: 13px; color: #cbd5e1; text-align: center; }
  .gl-open-btn { padding: 14px 28px !important; font-size: 16px !important; border-radius: 16px !important; box-shadow: 0 12px 32px rgba(124,58,237,0.45); }

  .gl-birth-ui { position: fixed; inset: 0; z-index: 20; display: flex; flex-direction: column; justify-content: space-between; align-items: flex-end; padding: 18px; pointer-events: none; }
  .gl-birth-actions { pointer-events: auto; display: flex; align-items: center; gap: 8px; }
  .gl-audio-banner { pointer-events: auto; margin: 0 auto 14px; display: flex; align-items: center; gap: 12px; padding: 9px 14px; border-radius: 12px; background: rgba(11,16,38,0.92); border: 1px solid rgba(252,211,77,0.42); font-size: 12px; color: #fef3c7; }

  .gl-2d-sealed { position: fixed; inset: 0; z-index: 12; display: flex; align-items: center; justify-content: center; }
  .gl-2d-envelope { width: 270px; height: 180px; border-radius: 18px; border: 1px solid rgba(255,255,255,0.22); background: rgba(17,24,58,0.92); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }
  .gl-2d-seal { width: 64px; height: 64px; border-radius: 999px; border: 1px solid rgba(254,243,199,0.7); }
  .gl-2d-sealed-lbl { font-size: 12px; color: #cbd5e1; }

  /* Swipeable Borderless Star Story Experience */
  .gl-story-ui { position: fixed; inset: 0; z-index: 20; display: flex; flex-direction: column; pointer-events: none; overflow-x: hidden; }
  .gl-story-scrim { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(to left, rgba(6,9,24,0.78), rgba(6,9,24,0.36) 48%, transparent); }
  .gl-story-top { position: relative; z-index: 10; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 14px 24px 6px; flex-shrink: 0; }
  .gl-story-brand { font-size: 13px; color: rgba(203,213,225,0.9); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px; }
  .gl-story-progress { pointer-events: auto; display: flex; align-items: center; gap: 8px; }
  .gl-dots { display: flex; align-items: center; gap: 4px; }
  .gl-star-dot { width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; background: transparent; border: none; padding: 0; cursor: pointer; transition: transform 180ms ease, opacity 180ms ease; }
  .gl-star-dot:hover:not(:disabled) { transform: scale(1.15); }
  .gl-star-dot:disabled { cursor: default; opacity: 0.25; }
  .gl-star-dot-active { transform: scale(1.18); }
  .gl-progress-txt { font-size: 12px; font-weight: 600; color: #e2e8f0; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .gl-story-utils { pointer-events: auto; display: flex; align-items: center; gap: 6px; }

  .gl-story-grid { position: relative; z-index: 10; flex: 1; min-height: 0; overflow: hidden; display: grid; grid-template-columns: 44% 56%; }
  .gl-story-left { min-height: 0; pointer-events: none; }
  .gl-story-right { pointer-events: auto; min-height: 0; overflow-y: auto; overflow-x: hidden; touch-action: pan-y; display: flex; flex-direction: column; justify-content: space-between; padding: 12px 48px 22px 16px; }
  @keyframes glStoryIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
  .gl-story-motion-wrap { width: 100%; max-width: 560px; margin: auto 0; transition: transform 220ms ease-out; }
  .gl-story-content { width: 100%; display: flex; flex-direction: column; align-items: flex-start; text-align: left; gap: 16px; }
  .gl-story-anim .gl-story-content { animation: glStoryIn 280ms cubic-bezier(0.16, 1, 0.3, 1) forwards; }
  .gl-reduced .gl-story-anim .gl-story-content { animation: none; }

  .gl-illu-wrap { position: relative; display: flex; align-items: center; justify-content: center; padding: 4px 0; }
  .gl-illu-glow { position: absolute; inset: -20px; border-radius: 999px; pointer-events: none; opacity: 0.58; }
  .gl-illu-img { position: relative; width: 196px; height: 196px; object-fit: contain; filter: drop-shadow(0 14px 30px rgba(0,0,0,0.6)); }

  .gl-story-ord { font-size: 13px; font-weight: 600; letter-spacing: 0.02em; font-variant-numeric: tabular-nums; }
  .gl-story-title { font-size: clamp(22px, 3vw, 36px); font-weight: 700; line-height: 1.18; color: #ffffff; text-shadow: 0 2px 14px rgba(0,0,0,0.65); user-select: text; }
  .gl-story-msg { font-size: clamp(15px, 1.4vw, 19px); line-height: 1.6; color: rgba(241,245,249,0.95); white-space: pre-wrap; text-shadow: 0 2px 10px rgba(0,0,0,0.75); user-select: text; }
  .gl-story-sign { font-size: 13px; font-style: italic; color: rgba(203,213,225,0.9); user-select: text; }

  /* Compact Secondary Arrows & Unobtrusive Swipe Hint */
  .gl-story-nav { width: 100%; max-width: 560px; padding-top: 12px; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .gl-nav-arrow { width: 36px; height: 36px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.16); background: rgba(11,16,38,0.75); color: #ffffff; display: inline-flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 600; cursor: pointer; transition: background 150ms ease, transform 150ms ease, opacity 150ms ease; flex-shrink: 0; }
  .gl-nav-arrow:hover:not(:disabled) { background: rgba(21,28,61,0.95); }
  .gl-nav-arrow:active:not(:disabled) { transform: scale(0.94); }
  .gl-nav-arrow:disabled { opacity: 0.25; cursor: default; }
  .gl-nav-arrow-finale { border-color: rgba(252,211,77,0.48); background: rgba(245,158,11,0.22); color: #fef3c7; }
  .gl-swipe-hint { display: flex; align-items: center; justify-content: center; gap: 7px; font-size: 13px; color: rgba(203,213,225,0.92); text-align: center; user-select: none; }
  .gl-swipe-hint-finale { color: rgba(254,243,199,0.95); font-weight: 500; }
  @keyframes glNudgeLeft { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-6px); } }
  .gl-swipe-arrow { display: inline-flex; color: #c4b5fd; animation: glNudgeLeft 2.1s ease-in-out infinite; }
  .gl-swipe-hint-finale .gl-swipe-arrow { color: #fcd34d; }
  .gl-reduced .gl-swipe-arrow { animation: none; }

  /* Finale Top Greeting & Bottom Dock */
  .gl-finale-scrim { position: fixed; inset: 0 0 auto 0; height: 210px; z-index: 10; pointer-events: none; background: linear-gradient(to bottom, rgba(6,9,26,0.82), rgba(6,9,26,0.38) 55%, transparent); }
  .gl-finale-top { position: fixed; top: 0; inset-x: 0; z-index: 20; padding: 20px 24px; text-align: center; pointer-events: none; }
  .gl-finale-kicker { font-size: 13px; color: rgba(253,230,138,0.92); margin-bottom: 6px; font-weight: 500; }
  .gl-finale-heading { max-width: 720px; margin: 0 auto; font-size: clamp(18px, 2.5vw, 30px); font-weight: 700; line-height: 1.3; color: #ffffff; text-shadow: 0 2px 16px rgba(0,0,0,0.85); }
  .gl-finale-sign { margin-top: 6px; font-size: 13px; color: #cbd5e1; font-style: italic; }

  .gl-kicker { font-size: 13px; color: #cbd5e1; margin-bottom: 4px; letter-spacing: 0.01em; }
  .gl-title { font-size: clamp(22px, 3.2vw, 34px); font-weight: 700; line-height: 1.2; color: #ffffff; text-shadow: 0 2px 14px rgba(0,0,0,0.65); }
  .gl-dock { position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px; padding: 8px 12px; border-radius: 16px; background: rgba(10, 14, 34, 0.9); border: 1px solid rgba(255,255,255,0.15); z-index: 22; max-width: 95vw; }
  .gl-star-pills { display: flex; align-items: center; gap: 4px; padding-right: 8px; border-right: 1px solid rgba(255,255,255,0.16); }
  .gl-star-pill { width: 28px; height: 28px; border-radius: 8px; border: none; background: rgba(255,255,255,0.07); color: #ffffff; font-size: 12px; font-weight: 600; cursor: pointer; font-variant-numeric: tabular-nums; }
  .gl-star-pill:hover { background: rgba(255,255,255,0.18); }

  .gl-btn { border: 1px solid rgba(255,255,255,0.16); background: rgba(30, 41, 59, 0.85); color: #f8fafc; padding: 8px 14px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: background 150ms ease, transform 150ms ease; }
  .gl-btn:hover { background: rgba(51, 65, 85, 0.95); }
  .gl-btn:active { transform: scale(0.98); }
  .gl-btn-primary { background: #7c3aed; border-color: #a78bfa; color: #ffffff; }
  .gl-btn-primary:hover { background: #6d28d9; }
  .gl-btn-accent { background: rgba(124, 58, 237, 0.35); border-color: rgba(167, 139, 250, 0.6); }
  .gl-btn-ghost { background: rgba(15, 23, 42, 0.72); border-color: rgba(255,255,255,0.12); }
  .gl-btn-amber { background: rgba(245, 158, 11, 0.22); border-color: rgba(252, 211, 77, 0.4); color: #fef3c7; }
  .gl-vol { width: 78px; accent-color: #a78bfa; cursor: pointer; }
  .gl-hidden { display: none !important; }

  .gl-2d-lines { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .gl-2d-star { position: absolute; transform: translate(-50%, -50%); background: transparent; border: none; color: #fff; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px; transition: left 450ms ease, top 450ms ease, opacity 300ms ease; }
  .gl-2d-label { font-size: 12px; font-weight: 600; text-shadow: 0 1px 6px rgba(0,0,0,0.85); white-space: nowrap; }

  /* Portrait orientation (priority for phones & vertical tablets) */
  @media (orientation: portrait), (max-width: 539px) {
    .gl-story-scrim { background: linear-gradient(to top, rgba(6,9,24,0.9), rgba(6,9,24,0.44) 56%, transparent); }
    .gl-story-top { padding: 12px 14px 4px; }
    .gl-story-brand { display: none; }
    .gl-story-grid { display: flex; flex-direction: column; }
    .gl-story-left { height: 32vh; min-height: 185px; max-height: 290px; flex-shrink: 0; }
    .gl-story-right { flex: 1; padding: 4px 18px 18px; align-items: center; text-align: center; }
    .gl-story-motion-wrap { margin: auto; }
    .gl-story-content { align-items: center; text-align: center; gap: 12px; }
    .gl-illu-img { width: 124px; height: 124px; }
    .gl-story-nav { margin: 0 auto; }
  }

  /* Compact landscape phones (e.g. 667x375, 844x390) */
  @media (orientation: landscape) and (max-height: 520px) {
    .gl-story-top { padding: 8px 16px 4px; }
    .gl-story-brand { display: none; }
    .gl-story-right { padding: 4px 20px 10px 10px; }
    .gl-story-content { gap: 7px; }
    .gl-illu-img { width: 82px; height: 82px; }
    .gl-story-title { font-size: 20px; }
    .gl-story-msg { font-size: 14px; line-height: 1.45; }
    .gl-story-nav { padding-top: 6px; }
  }
`;

export async function exportProjectToZip(
  project: ConstellationProject,
): Promise<{ blob: Blob; filename: string }> {
  const zip = new JSZip();
  const assetsFolder = zip.folder('assets')!;
  const imagesFolder = assetsFolder.folder('images')!;

  const builtinCache = new Map<string, string>();
  const standaloneStars = [];

  for (let i = 0; i < project.stars.length; i++) {
    const star = project.stars[i];
    const padNum = String(i + 1).padStart(2, '0');
    let assetImagePath = '';

    if (star.illustration.type === 'builtin') {
      const builtinId = star.illustration.id as BuiltinIllustrationId;
      const existingPath = builtinCache.get(builtinId);
      if (existingPath) {
        assetImagePath = existingPath;
      } else {
        const { blob, ext } = await renderBuiltinIllustrationToBlob(builtinId, 640);
        const fileName = `builtin-${builtinId}.${ext}`;
        imagesFolder.file(fileName, blob);
        assetImagePath = `assets/images/${fileName}`;
        builtinCache.set(builtinId, assetImagePath);
      }
    } else {
      const customBlob = await getImageBlob(star.illustration.id);
      if (customBlob) {
        const ext = customBlob.type === 'image/png' ? 'png' : 'webp';
        const fileName = `star-${padNum}.${ext}`;
        imagesFolder.file(fileName, customBlob);
        assetImagePath = `assets/images/${fileName}`;
      } else {
        const { blob, ext } = await renderBuiltinIllustrationToBlob('heart', 640);
        const fileName = `builtin-heart.${ext}`;
        if (!builtinCache.has('heart')) {
          imagesFolder.file(fileName, blob);
          builtinCache.set('heart', `assets/images/${fileName}`);
        }
        assetImagePath = builtinCache.get('heart')!;
      }
    }

    standaloneStars.push({
      ...star,
      shape: resolveStarShape(star),
      assetImagePath,
    });
  }

  let musicPath: string | null = null;
  let musicName: string | null = null;
  if (project.musicTrackId !== 'none') {
    const musicBlob = getMusicTrackBlob(project.musicTrackId);
    if (musicBlob) {
      const musicFolder = assetsFolder.folder('music')!;
      const fileName = `${project.musicTrackId}.wav`;
      musicFolder.file(fileName, musicBlob);
      musicPath = `assets/music/${fileName}`;
      musicName =
        MUSIC_TRACKS.find((t) => t.id === project.musicTrackId)?.name ?? null;
    }
  }

  const payload = {
    title: project.title,
    recipientName: project.recipientName,
    senderName: project.senderName ?? '',
    occasionLabel: project.occasionLabel,
    paletteId: project.paletteId,
    globalGlowColor: project.globalGlowColor,
    stars: standaloneStars,
    connections: sanitizeConnections(project.connections, project.stars),
    finalMessage: project.finalMessage,
    musicPath,
    musicName,
  };

  const html = `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>${escapeHtmlText(project.title)} — GiftLab</title>
  <style>${STANDALONE_CSS}</style>
</head>
<body>
  <div id="app"></div>
  <script>window.__GIFTLAB_PAYLOAD__ = ${safeJsonForScriptTag(payload)};</script>
  <script>${runtimeBundle}</script>
</body>
</html>`;

  zip.file('index.html', html);

  const instructions = [
    `${project.title}`,
    '==============================',
    '',
    'Как открыть подарок:',
    '1. Скачайте ZIP-архив.',
    '2. Распакуйте его.',
    '3. Откройте папку.',
    '4. Запустите файл index.html через браузер.',
    '5. Нажмите «Открыть послание» и зажигайте звёзды одну за другой.',
    '6. В финале вращайте готовое созвездие и при желании включите музыку.',
    '',
    'Важно: не отделяйте файл index.html от папки assets — в ней хранятся иллюстрации и музыка подарка.',
  ].join('\n');

  zip.file('ИНСТРУКЦИЯ.txt', instructions);

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  return {
    blob,
    filename: `${sanitizeFileName(project.title)}.zip`,
  };
}
