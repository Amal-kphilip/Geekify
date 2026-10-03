"use client";

import { useState } from "react";
import { usePlayerStore } from "@/store/usePlayerStore";

export function fmtTime(t: number) {
  if (!Number.isFinite(t) || t < 0) return "0:00";
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  return h
    ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
    : `${m}:${s.toString().padStart(2, "0")}`;
}

/** Seekable timeline with elapsed / total time. Safe to drag on touch screens. */
export function SeekBar({ className = "", large = false }: { className?: string; large?: boolean }) {
  const progress = usePlayerStore((s) => s.progress);
  const duration = usePlayerStore((s) => s.duration);
  const seek = usePlayerStore((s) => s.seek);
  const hasTrack = usePlayerStore((s) => !!s.currentTrack);
  // While dragging, show the finger position and only commit on release,
  // so timeupdate events don't fight the thumb.
  const [drag, setDrag] = useState<number | null>(null);

  const shown = drag ?? progress;
  const pct = duration ? Math.min(100, (shown / duration) * 100) : 0;

  const commit = () => {
    if (drag !== null) {
      seek(drag);
      setDrag(null);
    }
  };

  return (
    <div className={`flex w-full items-center gap-2 ${className}`}>
      <span className="w-10 text-right text-[11px] tabular-nums text-[#9d9bbd]">{fmtTime(shown)}</span>
      <input
        type="range"
        aria-label="Seek"
        min={0}
        max={duration || 0}
        step={0.1}
        disabled={!hasTrack || !duration}
        value={Math.min(shown, duration || 0)}
        onChange={(e) => setDrag(Number(e.target.value))}
        onPointerUp={commit}
        onTouchEnd={commit}
        onMouseUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className={`seekbar w-full touch-pan-x ${large ? "seekbar-lg" : ""}`}
        style={{
          background: `linear-gradient(90deg, var(--seek-fill, #fff), var(--seek-fill, #fff)) 0 / ${pct}% 100% no-repeat, rgba(255,255,255,0.3)`,
          borderRadius: 99,
          height: large ? 6 : 4,
        }}
      />
      <span className="w-10 text-[11px] tabular-nums text-[#9d9bbd]">{fmtTime(duration)}</span>
    </div>
  );
}
