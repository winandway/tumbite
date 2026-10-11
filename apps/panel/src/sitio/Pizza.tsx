/** Pizza dibujada (SVG): masa, salsa, queso, pepperoni y albahaca, con una porción separada. */
export function Pizza({ className }: { className?: string }) {
  const pepperoni: [number, number, number][] = [
    [150, 120, 20],
    [230, 110, 18],
    [200, 175, 21],
    [120, 200, 19],
    [265, 205, 17],
    [175, 255, 20],
    [245, 270, 16],
    [105, 140, 14],
  ];
  const queso: [number, number, number, number][] = [
    [140, 160, 34, 22],
    [215, 140, 30, 20],
    [180, 215, 36, 24],
    [250, 235, 26, 18],
    [125, 245, 28, 18],
    [205, 95, 24, 14],
  ];
  return (
    <svg className={className} viewBox="0 0 400 400" role="img" aria-label="Pizza">
      <defs>
        <radialGradient id="masa" cx="50%" cy="45%" r="55%">
          <stop offset="78%" stopColor="#F2B25C" />
          <stop offset="100%" stopColor="#C97A2B" />
        </radialGradient>
        <radialGradient id="salsa" cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#F0412A" />
          <stop offset="100%" stopColor="#B81D0C" />
        </radialGradient>
        <filter id="sombra" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="14" stdDeviation="14" floodColor="#000" floodOpacity="0.3" />
        </filter>
      </defs>
      <g filter="url(#sombra)">
        {/* La pizza entera, menos una porción */}
        <path d="M200 190 L330 100 A160 160 0 1 0 352 238 Z" fill="url(#masa)" />
        <path d="M200 190 L314 112 A140 140 0 1 0 334 232 Z" fill="url(#salsa)" />
        {queso.map(([x, y, rx, ry]) => (
          <ellipse key={`${x}-${y}`} cx={x} cy={y} rx={rx} ry={ry} fill="#FFD66B" opacity="0.92" />
        ))}
        {pepperoni.map(([x, y, r]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r={r} fill="#A3140A" />
            <circle cx={x - r / 3} cy={y - r / 3} r={r / 4} fill="#7E0E06" opacity="0.6" />
            <circle cx={x + r / 3} cy={y + r / 4} r={r / 5} fill="#7E0E06" opacity="0.5" />
          </g>
        ))}
        <path
          d="M150 300 q14 -18 30 -4 q-14 16 -30 4z M290 160 q10 -20 28 -8 q-12 16 -28 8z M110 185 q8 -16 24 -6 q-10 14 -24 6z"
          fill="#2E8B3A"
        />
        <path
          d="M200 190 L72 180 M200 190 L120 310 M200 190 L250 340 M200 190 L345 300"
          stroke="#9C5A1A"
          strokeWidth="2"
          opacity="0.35"
        />
      </g>
      {/* La porción separada, como si alguien la estuviera sacando */}
      <g filter="url(#sombra)" transform="translate(28 -26)">
        <path d="M222 178 L352 88 A160 160 0 0 1 374 226 Z" fill="url(#masa)" />
        <path d="M228 176 L338 100 A140 140 0 0 1 356 220 Z" fill="url(#salsa)" />
        <ellipse cx="320" cy="160" rx="22" ry="14" fill="#FFD66B" />
        <circle cx="300" cy="140" r="15" fill="#A3140A" />
        <circle cx="335" cy="195" r="13" fill="#A3140A" />
      </g>
    </svg>
  );
}
