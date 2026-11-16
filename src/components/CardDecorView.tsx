import type { CardDecorMotif } from '../types/project';

interface CardDecorViewProps {
  motif: CardDecorMotif;
  glowHex: string;
  coreHex: string;
  className?: string;
}

export function CardDecorView({
  motif,
  glowHex,
  coreHex,
  className = 'w-24 h-24',
}: CardDecorViewProps) {
  if (motif === 'none') return null;

  if (motif === 'sparkles') {
    return (
      <svg
        viewBox="0 0 120 120"
        fill="none"
        className={className}
        aria-hidden="true"
        style={{ filter: `drop-shadow(0 0 12px ${glowHex}66)` }}
      >
        <path
          d="M54 14L59 35L80 40L59 45L54 66L49 45L28 40L49 35L54 14Z"
          fill={coreHex}
          fillOpacity="0.92"
        />
        <path
          d="M88 58L91 70L103 73L91 76L88 88L85 76L73 73L85 70L88 58Z"
          fill={glowHex}
          fillOpacity="0.88"
        />
        <path
          d="M32 76L34 84L42 86L34 88L32 96L30 88L22 86L30 84L32 76Z"
          fill={glowHex}
          fillOpacity="0.72"
        />
        <circle cx="88" cy="28" r="2.4" fill={coreHex} fillOpacity="0.85" />
        <circle cx="24" cy="48" r="2" fill={glowHex} fillOpacity="0.75" />
      </svg>
    );
  }

  if (motif === 'orbital') {
    return (
      <svg
        viewBox="0 0 120 120"
        fill="none"
        className={className}
        aria-hidden="true"
        style={{ filter: `drop-shadow(0 0 12px ${glowHex}55)` }}
      >
        <ellipse
          cx="60"
          cy="60"
          rx="44"
          ry="18"
          transform="rotate(-24 60 60)"
          stroke={glowHex}
          strokeWidth="1.6"
          strokeDasharray="4 5"
          strokeOpacity="0.85"
        />
        <ellipse
          cx="60"
          cy="60"
          rx="32"
          ry="12"
          transform="rotate(28 60 60)"
          stroke={coreHex}
          strokeWidth="1.2"
          strokeOpacity="0.55"
        />
        <circle cx="96" cy="43" r="4.5" fill={coreHex} />
        <path
          d="M31 32C26 35 23 41 24 47C25 53 31 57 37 56C32 55 29 50 29 45C29 40 31 35 35 32C33.5 31.6 32.2 31.6 31 32Z"
          fill={glowHex}
          fillOpacity="0.9"
        />
      </svg>
    );
  }

  if (motif === 'hearts') {
    return (
      <svg
        viewBox="0 0 120 120"
        fill="none"
        className={className}
        aria-hidden="true"
        style={{ filter: `drop-shadow(0 0 12px ${glowHex}66)` }}
      >
        <path
          d="M52 72C52 72 28 57 28 40C28 32 34 26 41.5 26C46.2 26 50.2 28.6 52 32.3C53.8 28.6 57.8 26 62.5 26C70 26 76 32 76 40C76 57 52 72 52 72Z"
          stroke={glowHex}
          strokeWidth="2.2"
          fill={glowHex}
          fillOpacity="0.18"
        />
        <path
          d="M86 86C86 86 73 78 73 69C73 64.8 76.2 61.6 80.2 61.6C82.8 61.6 84.9 63 86 65C87.1 63 89.2 61.6 91.8 61.6C95.8 61.6 99 64.8 99 69C99 78 86 86 86 86Z"
          stroke={coreHex}
          strokeWidth="1.8"
          fill={coreHex}
          fillOpacity="0.22"
        />
        <circle cx="88" cy="36" r="2.2" fill={coreHex} fillOpacity="0.85" />
        <circle cx="28" cy="82" r="2.5" fill={glowHex} fillOpacity="0.8" />
      </svg>
    );
  }

  // 'corners'
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      className={className}
      aria-hidden="true"
      style={{ filter: `drop-shadow(0 0 10px ${glowHex}55)` }}
    >
      <path
        d="M16 42V22C16 18.7 18.7 16 22 16H42"
        stroke={glowHex}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M104 78V98C104 101.3 101.3 104 98 104H78"
        stroke={glowHex}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M84 22L86 30L94 32L86 34L84 42L82 34L74 32L82 30L84 22Z"
        fill={coreHex}
        fillOpacity="0.9"
      />
      <path
        d="M36 78L38 86L46 88L38 90L36 98L34 90L26 88L34 86L36 78Z"
        fill={coreHex}
        fillOpacity="0.8"
      />
    </svg>
  );
}
