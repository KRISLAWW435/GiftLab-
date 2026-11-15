import type { CompositionPresetId, StarShapeId } from '../types/project';

interface ShapePreviewProps {
  shape: StarShapeId;
  color: string;
  coreColor?: string;
  className?: string;
}

export function StarShapePreview({
  shape,
  color,
  coreColor = '#ffffff',
  className = 'w-8 h-8',
}: ShapePreviewProps) {
  return (
    <svg viewBox="0 0 48 48" className={className} fill="none" aria-hidden="true">
      {shape === 'star' && (
        <g>
          <polygon
            points="24,5 29.3,16.5 42,18.1 32.6,26.8 35.1,39.4 24,33.2 12.9,39.4 15.4,26.8 6,18.1 18.7,16.5"
            fill={color}
            fillOpacity="0.28"
            stroke={color}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="23.5" r="4.2" fill={coreColor} fillOpacity="0.9" />
        </g>
      )}

      {shape === 'heart' && (
        <g>
          <path
            d="M24 39.5C24 39.5 8.5 29.8 8.5 18.8C8.5 13.5 12.6 9.5 17.5 9.5C20.5 9.5 22.8 11 24 13.1C25.2 11 27.5 9.5 30.5 9.5C35.4 9.5 39.5 13.5 39.5 18.8C39.5 29.8 24 39.5 24 39.5Z"
            fill={color}
            fillOpacity="0.3"
            stroke={color}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <circle cx="24" cy="22" r="4" fill={coreColor} fillOpacity="0.9" />
        </g>
      )}

      {shape === 'flower' && (
        <g>
          {[0, 60, 120, 180, 240, 300].map((deg) => (
            <ellipse
              key={deg}
              cx="24"
              cy="12.5"
              rx="5.2"
              ry="8.5"
              transform={`rotate(${deg} 24 24)`}
              fill={color}
              fillOpacity="0.26"
              stroke={color}
              strokeWidth="1.8"
            />
          ))}
          <circle cx="24" cy="24" r="5" fill={coreColor} fillOpacity="0.95" />
        </g>
      )}

      {shape === 'moon' && (
        <g>
          <path
            d="M29.8 9.2C20.6 9.9 13.5 17.3 13.5 26.2C13.5 35.1 20.8 42.1 30 42.1C33.4 42.1 36.6 41 39.2 39.1C32.2 39 26.5 33.4 26.5 25.8C26.5 18.6 31.3 12.6 38 11.4C35.5 9.9 32.7 9 29.8 9.2Z"
            fill={color}
            fillOpacity="0.3"
            stroke={color}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <circle cx="34.5" cy="20" r="2.6" fill={coreColor} fillOpacity="0.95" />
        </g>
      )}

      {shape === 'comet' && (
        <g>
          <path
            d="M28.5 19.5L8.5 38.5M26.5 15.5L11 27.5M32.5 22L20.5 37.5"
            stroke={color}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeOpacity="0.88"
          />
          <polygon
            points="32,10 38,16 32,22 26,16"
            fill={color}
            fillOpacity="0.35"
            stroke={color}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <circle cx="32" cy="16" r="3.4" fill={coreColor} fillOpacity="0.95" />
        </g>
      )}

      {shape === 'planet' && (
        <g>
          <circle
            cx="24"
            cy="24"
            r="9.5"
            fill={color}
            fillOpacity="0.32"
            stroke={color}
            strokeWidth="2.2"
          />
          <ellipse
            cx="24"
            cy="24"
            rx="18.5"
            ry="5.8"
            transform="rotate(-22 24 24)"
            stroke={coreColor}
            strokeWidth="2"
            strokeOpacity="0.9"
          />
          <circle cx="24" cy="24" r="3.5" fill={coreColor} fillOpacity="0.85" />
        </g>
      )}

      {shape === 'spark' && (
        <g>
          <polygon
            points="24,4 28.8,19.2 44,24 28.8,28.8 24,44 19.2,28.8 4,24 19.2,19.2"
            fill={color}
            fillOpacity="0.32"
            stroke={color}
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
          <line
            x1="24"
            y1="8"
            x2="24"
            y2="40"
            stroke={coreColor}
            strokeWidth="1.2"
            strokeOpacity="0.55"
          />
          <line
            x1="8"
            y1="24"
            x2="40"
            y2="24"
            stroke={coreColor}
            strokeWidth="1.2"
            strokeOpacity="0.55"
          />
          <circle cx="24" cy="24" r="3.6" fill={coreColor} fillOpacity="0.95" />
          <circle cx="35.5" cy="12.5" r="1.6" fill={coreColor} fillOpacity="0.85" />
          <circle cx="12.5" cy="35.5" r="1.3" fill={coreColor} fillOpacity="0.75" />
        </g>
      )}
    </svg>
  );
}

interface CompositionPreviewProps {
  preset: CompositionPresetId;
  color?: string;
  className?: string;
}

export function CompositionPresetPreview({
  preset,
  color = '#c4b5fd',
  className = 'w-12 h-10',
}: CompositionPreviewProps) {
  if (preset === 'heart') {
    const pts = [
      [24, 15],
      [35, 9],
      [39, 20],
      [24, 34],
      [9, 20],
      [13, 9],
    ];
    return (
      <svg viewBox="0 0 48 40" className={className} fill="none" aria-hidden="true">
        <polygon
          points={pts.map((p) => p.join(',')).join(' ')}
          stroke={color}
          strokeWidth="1.6"
          strokeOpacity="0.75"
        />
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.4" fill="#fffbeb" stroke={color} strokeWidth="1" />
        ))}
      </svg>
    );
  }

  if (preset === 'flower') {
    const petals = [0, 1, 2, 3, 4].map((i) => {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      return [24 + Math.cos(a) * 14, 20 + Math.sin(a) * 13];
    });
    return (
      <svg viewBox="0 0 48 40" className={className} fill="none" aria-hidden="true">
        <polygon
          points={petals.map((p) => p.join(',')).join(' ')}
          stroke={color}
          strokeWidth="1.4"
          strokeOpacity="0.65"
        />
        {petals.map(([x, y], i) => (
          <line
            key={`l-${i}`}
            x1="24"
            y1="20"
            x2={x}
            y2={y}
            stroke={color}
            strokeWidth="1.4"
            strokeOpacity="0.75"
          />
        ))}
        <circle cx="24" cy="20" r="2.8" fill="#fffbeb" stroke={color} strokeWidth="1.2" />
        {petals.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.2" fill="#fffbeb" stroke={color} strokeWidth="1" />
        ))}
      </svg>
    );
  }

  const freePts = [
    [8, 15],
    [17, 9],
    [25, 22],
    [34, 11],
    [40, 29],
  ];
  return (
    <svg viewBox="0 0 48 40" className={className} fill="none" aria-hidden="true">
      <polyline
        points={freePts.map((p) => p.join(',')).join(' ')}
        stroke={color}
        strokeWidth="1.6"
        strokeOpacity="0.75"
      />
      {freePts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2.3" fill="#fffbeb" stroke={color} strokeWidth="1" />
      ))}
    </svg>
  );
}
