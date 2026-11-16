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

  if (motif === 'soft_flowers') {
    return (
      <svg
        viewBox="0 0 120 120"
        fill="none"
        className={className}
        aria-hidden="true"
        style={{ filter: `drop-shadow(0 2px 10px ${glowHex}44)` }}
      >
        <path
          d="M22 96C34 74 52 54 78 36"
          stroke={glowHex}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeOpacity="0.65"
        />
        <path
          d="M44 74C32 68 26 57 32 48C38 44 48 53 48 66"
          fill={glowHex}
          fillOpacity="0.16"
          stroke={glowHex}
          strokeWidth="1.4"
        />
        <path
          d="M62 54C74 58 86 54 88 45C84 38 72 41 64 49"
          fill={glowHex}
          fillOpacity="0.16"
          stroke={glowHex}
          strokeWidth="1.4"
        />
        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <ellipse
            key={deg}
            cx="78"
            cy="24"
            rx="6"
            ry="11"
            transform={`rotate(${deg} 78 36)`}
            fill={coreHex}
            fillOpacity="0.28"
            stroke={glowHex}
            strokeWidth="1.5"
          />
        ))}
        <circle cx="78" cy="36" r="5" fill={glowHex} fillOpacity="0.85" />
        {[0, 72, 144, 216, 288].map((deg) => (
          <ellipse
            key={`s-${deg}`}
            cx="36"
            cy="78"
            rx="4"
            ry="7.2"
            transform={`rotate(${deg} 36 86)`}
            fill={coreHex}
            fillOpacity="0.26"
            stroke={glowHex}
            strokeWidth="1.2"
          />
        ))}
        <circle cx="36" cy="86" r="3.4" fill={glowHex} fillOpacity="0.8" />
      </svg>
    );
  }

  if (motif === 'petals') {
    return (
      <svg
        viewBox="0 0 120 120"
        fill="none"
        className={className}
        aria-hidden="true"
        style={{ filter: `drop-shadow(0 2px 10px ${glowHex}44)` }}
      >
        <path
          d="M34 26C48 22 56 32 52 44C46 52 34 50 28 40C24 33 27 28 34 26Z"
          fill={glowHex}
          fillOpacity="0.22"
          stroke={glowHex}
          strokeWidth="1.6"
        />
        <path
          d="M78 24C90 28 92 40 84 48C76 52 66 46 66 36C66 28 71 22 78 24Z"
          fill={coreHex}
          fillOpacity="0.3"
          stroke={glowHex}
          strokeWidth="1.5"
        />
        <path
          d="M54 58C68 54 78 64 74 78C67 86 53 84 46 74C42 66 46 60 54 58Z"
          fill={glowHex}
          fillOpacity="0.26"
          stroke={glowHex}
          strokeWidth="1.7"
        />
        <path
          d="M24 78C32 74 39 79 37 87C33 93 24 92 20 86C18 82 20 79 24 78Z"
          fill={coreHex}
          fillOpacity="0.28"
          stroke={glowHex}
          strokeWidth="1.4"
        />
        <path
          d="M88 76C98 76 102 85 96 92C90 97 81 93 80 85C79 79 83 76 88 76Z"
          fill={glowHex}
          fillOpacity="0.2"
          stroke={glowHex}
          strokeWidth="1.4"
        />
        <circle cx="62" cy="42" r="2" fill={glowHex} fillOpacity="0.7" />
        <circle cx="88" cy="60" r="1.8" fill={glowHex} fillOpacity="0.65" />
      </svg>
    );
  }

  if (motif === 'magic_rays') {
    return (
      <svg
        viewBox="0 0 120 120"
        fill="none"
        className={className}
        aria-hidden="true"
        style={{ filter: `drop-shadow(0 0 14px ${glowHex}77)` }}
      >
        <circle
          cx="60"
          cy="60"
          r="26"
          stroke={glowHex}
          strokeWidth="1.2"
          strokeDasharray="3 5"
          strokeOpacity="0.6"
        />
        <line x1="60" y1="10" x2="60" y2="110" stroke={coreHex} strokeWidth="1.4" strokeOpacity="0.65" />
        <line x1="10" y1="60" x2="110" y2="60" stroke={coreHex} strokeWidth="1.4" strokeOpacity="0.65" />
        <line x1="25" y1="25" x2="95" y2="95" stroke={glowHex} strokeWidth="1.2" strokeOpacity="0.55" />
        <line x1="95" y1="25" x2="25" y2="95" stroke={glowHex} strokeWidth="1.2" strokeOpacity="0.55" />
        <path
          d="M60 34L65 55L86 60L65 65L60 86L55 65L34 60L55 55L60 34Z"
          fill={coreHex}
          fillOpacity="0.9"
          stroke={glowHex}
          strokeWidth="1.4"
        />
        <circle cx="92" cy="28" r="2.2" fill={coreHex} fillOpacity="0.85" />
        <circle cx="28" cy="92" r="2.2" fill={glowHex} fillOpacity="0.8" />
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
