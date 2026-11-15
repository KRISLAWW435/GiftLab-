import type { MusicTrackId } from '../types/project';

/**
 * Generates seamless, royalty-free instrumental ambient WAV tracks offline
 * using pure mathematical synthesis (celesta bells, warm pads, harmonic shimmer).
 * Returns real audio/wav Blobs that work in both browser preview and offline ZIP exports.
 */

const SAMPLE_RATE = 22050;
const wavCache = new Map<Exclude<MusicTrackId, 'none'>, Blob>();

interface NoteEvent {
  time: number;
  freq: number;
  duration: number;
  gain: number;
  timbre: 'celesta' | 'pad' | 'harp';
}

function encodeWavMono(samples: Float32Array, sampleRate: number): Blob {
  const numSamples = samples.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, numSamples * 2, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const clamped = Math.max(-0.98, Math.min(0.98, samples[i]));
    view.setInt16(offset, Math.round(clamped * 32767), true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function renderSequence(durationSec: number, events: NoteEvent[]): Blob {
  const totalSamples = Math.floor(durationSec * SAMPLE_RATE);
  const dry = new Float32Array(totalSamples);

  for (const ev of events) {
    const startIdx = Math.floor(ev.time * SAMPLE_RATE);
    const lenIdx = Math.floor(ev.duration * SAMPLE_RATE);

    for (let i = 0; i < lenIdx; i++) {
      const idx = (startIdx + i) % totalSamples;
      const t = i / SAMPLE_RATE;
      const norm = i / lenIdx;

      let env = 1;
      let wave = 0;

      if (ev.timbre === 'celesta') {
        const attack = Math.min(1, t / 0.015);
        const decay = Math.exp(-t * 3.2);
        const fadeOut = norm > 0.85 ? (1 - norm) / 0.15 : 1;
        env = attack * decay * fadeOut;
        wave =
          Math.sin(2 * Math.PI * ev.freq * t) * 0.72 +
          Math.sin(2 * Math.PI * ev.freq * 2 * t) * 0.22 * Math.exp(-t * 5) +
          Math.sin(2 * Math.PI * ev.freq * 3 * t) * 0.06 * Math.exp(-t * 8);
      } else if (ev.timbre === 'harp') {
        const attack = Math.min(1, t / 0.01);
        const decay = Math.exp(-t * 2.5);
        const fadeOut = norm > 0.8 ? (1 - norm) / 0.2 : 1;
        env = attack * decay * fadeOut;
        wave =
          Math.sin(2 * Math.PI * ev.freq * t) * 0.65 +
          Math.sin(2 * Math.PI * ev.freq * 2 * t) * 0.25 +
          Math.sin(2 * Math.PI * ev.freq * 4 * t) * 0.1 * Math.exp(-t * 7);
      } else {
        // Warm cosmic pad
        const attack = Math.min(1, norm / 0.25);
        const release = Math.min(1, (1 - norm) / 0.3);
        env = attack * release;
        wave =
          Math.sin(2 * Math.PI * ev.freq * t) * 0.65 +
          Math.sin(2 * Math.PI * ev.freq * 1.003 * t) * 0.25 +
          Math.sin(2 * Math.PI * ev.freq * 2 * t) * 0.1;
      }

      dry[idx] += wave * env * ev.gain;
    }
  }

  // Gentle lush feedback delay for space atmosphere (wrapped seamlessly for perfect loop)
  const wet = new Float32Array(totalSamples);
  const delayA = Math.floor(0.32 * SAMPLE_RATE);
  const delayB = Math.floor(0.51 * SAMPLE_RATE);

  for (let i = 0; i < totalSamples; i++) {
    const a = dry[(i - delayA + totalSamples) % totalSamples];
    const b = dry[(i - delayB + totalSamples) % totalSamples];
    wet[i] = dry[i] * 0.78 + a * 0.22 + b * 0.14;
  }

  // Soft peak normalization
  let maxAmp = 0.001;
  for (let i = 0; i < totalSamples; i++) {
    const abs = Math.abs(wet[i]);
    if (abs > maxAmp) maxAmp = abs;
  }
  const scale = Math.min(1, 0.72 / maxAmp);
  for (let i = 0; i < totalSamples; i++) {
    wet[i] *= scale;
  }

  return encodeWavMono(wet, SAMPLE_RATE);
}

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function buildStardustTrack(): Blob {
  // 16-second loop in F major (warm celesta lullaby)
  const duration = 16;
  const chords = [
    [53, 60, 65, 69], // Fmaj
    [50, 57, 62, 65], // Dm
    [46, 53, 58, 62], // Bbmaj
    [48, 55, 60, 64], // Cmaj
  ];
  const melody = [77, 81, 84, 81, 79, 77, 74, 77, 76, 79, 81, 79, 77, 72, 74, 76];
  const events: NoteEvent[] = [];

  chords.forEach((chord, bar) => {
    const barStart = bar * 4;
    chord.forEach((note, idx) => {
      events.push({
        time: barStart,
        freq: midiToHz(note),
        duration: 4.1,
        gain: idx === 0 ? 0.24 : 0.14,
        timbre: 'pad',
      });
    });

    for (let step = 0; step < 4; step++) {
      const mIdx = bar * 4 + step;
      events.push({
        time: barStart + step * 1.0,
        freq: midiToHz(melody[mIdx]),
        duration: 1.6,
        gain: 0.34,
        timbre: 'celesta',
      });
      events.push({
        time: barStart + step * 1.0 + 0.5,
        freq: midiToHz(chord[step % chord.length] + 12),
        duration: 1.1,
        gain: 0.16,
        timbre: 'celesta',
      });
    }
  });

  return renderSequence(duration, events);
}

function buildAuroraChimesTrack(): Blob {
  // 14.4-second shimmering D lydian harp & bell chimes
  const duration = 14.4;
  const chords = [
    [50, 57, 62, 66], // Dmaj
    [52, 59, 64, 68], // E/D shimmer
    [47, 54, 59, 62], // Bm
    [45, 52, 57, 61], // A
  ];
  const arpPattern = [0, 1, 2, 3, 2, 1];
  const events: NoteEvent[] = [];

  chords.forEach((chord, bar) => {
    const barStart = bar * 3.6;
    chord.slice(0, 3).forEach((note, idx) => {
      events.push({
        time: barStart,
        freq: midiToHz(note),
        duration: 3.7,
        gain: idx === 0 ? 0.22 : 0.12,
        timbre: 'pad',
      });
    });

    arpPattern.forEach((p, idx) => {
      events.push({
        time: barStart + idx * 0.6,
        freq: midiToHz(chord[p] + (idx % 2 === 0 ? 12 : 24)),
        duration: 1.7,
        gain: 0.26,
        timbre: 'harp',
      });
    });
  });

  return renderSequence(duration, events);
}

function buildGalaxyWaltzTrack(): Blob {
  // 16-second gentle 3/4 cosmic music-box waltz in C major
  const duration = 16;
  const beat = 16 / 24; // 8 bars * 3 beats = 24 beats
  const bars = [
    { bass: 48, triad: [60, 64, 67], mel: [72, 76, 79] },
    { bass: 45, triad: [57, 60, 64], mel: [81, 79, 76] },
    { bass: 41, triad: [53, 57, 60], mel: [77, 74, 72] },
    { bass: 43, triad: [55, 59, 62], mel: [74, 76, 74] },
    { bass: 48, triad: [60, 64, 67], mel: [79, 83, 84] },
    { bass: 45, triad: [57, 60, 64], mel: [81, 79, 76] },
    { bass: 41, triad: [53, 57, 60], mel: [74, 77, 76] },
    { bass: 43, triad: [55, 59, 62], mel: [74, 72, 71] },
  ];
  const events: NoteEvent[] = [];

  bars.forEach((b, barIdx) => {
    const start = barIdx * 3 * beat;
    events.push({
      time: start,
      freq: midiToHz(b.bass),
      duration: beat * 3.1,
      gain: 0.24,
      timbre: 'pad',
    });

    for (let k = 0; k < 3; k++) {
      events.push({
        time: start + k * beat,
        freq: midiToHz(b.mel[k]),
        duration: beat * 2.2,
        gain: 0.34,
        timbre: 'celesta',
      });
      if (k > 0) {
        b.triad.forEach((n) => {
          events.push({
            time: start + k * beat,
            freq: midiToHz(n),
            duration: beat * 1.4,
            gain: 0.11,
            timbre: 'harp',
          });
        });
      }
    }
  });

  return renderSequence(duration, events);
}

export function getMusicTrackBlob(trackId: MusicTrackId): Blob | null {
  if (trackId === 'none') return null;
  const cached = wavCache.get(trackId);
  if (cached) return cached;

  let blob: Blob;
  if (trackId === 'stardust') {
    blob = buildStardustTrack();
  } else if (trackId === 'aurora_chimes') {
    blob = buildAuroraChimesTrack();
  } else {
    blob = buildGalaxyWaltzTrack();
  }
  wavCache.set(trackId, blob);
  return blob;
}
