/**
 * Theme-aware Talia wordmark: outline leaf mark + Cinzel “TALIA”.
 * Color follows `currentColor` (set via CSS / `--theme-accent`).
 */
export default function TaliaBrandMark({
  className = '',
  title = 'Talia',
  ...rest
}) {
  return (
    <svg
      className={`talia-brand-mark ${className}`.trim()}
      viewBox="0 0 236 64"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="2.55"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Stem with slight base curve */}
        <path d="M30.5 55c-1.2-2.5-1.8-5-1.8-8 0-8-.5-16-1.2-23.5" />
        {/* Left leaf (hollow outline) */}
        <path d="M28.8 39.5C17.5 35.5 9 26.5 10.8 14.5c8 4 15.2 13.2 17.5 22" />
        {/* Right leaf */}
        <path d="M29.5 37.5c11.5-4.2 19.5-13.5 17.8-25.5-7.5 3.5-14.5 12.5-17 22" />
        {/* Top leaf */}
        <path d="M28.5 28.5C22 17 22.5 7.5 28.5 3c6 4.5 6.5 14 0 25.5z" />
      </g>
      <text
        className="talia-brand-mark__word"
        x="56"
        y="44"
        fill="currentColor"
        fontFamily="Cinzel, Trajan Pro, Times New Roman, Georgia, serif"
        fontSize="34"
        fontWeight="600"
        letterSpacing="0.14em"
      >
        TALIA
      </text>
    </svg>
  );
}
