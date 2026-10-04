"use client";

/**
 * Play / pause / loading glyph. Pure SVG + a tiny CSS pop on swap (no JS animation runtime),
 * so toggling playback never janks the main thread.
 */
export function PlayPauseMorph({
  playing,
  loading = false,
  tone = "dark",
}: {
  playing: boolean;
  loading?: boolean;
  /** "dark" icon for use on a light/lime button, "light" icon on a dark background. */
  tone?: "dark" | "light";
}) {
  const ink = tone === "dark" ? "#0c0b11" : "white";
  if (loading) {
    return (
      <svg viewBox="0 0 24 24" className="spinner h-6 w-6" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round">
        <circle cx="12" cy="12" r="8" strokeOpacity="0.25" />
        <path d="M12 4a8 8 0 0 1 8 8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill={ink}>
      {playing ? (
        <g key="pause" className="animate-pop [transform-box:fill-box] [transform-origin:center]">
          <rect x="5.5" y="4" width="4.5" height="16" rx="1.4" />
          <rect x="14" y="4" width="4.5" height="16" rx="1.4" />
        </g>
      ) : (
        <path key="play" className="animate-pop [transform-box:fill-box] [transform-origin:center]" d="M8 5.5v13l11-6.5L8 5.5z" />
      )}
    </svg>
  );
}
