"use client";

import { useEffect, useRef, useState } from "react";
import {
  Heart,
  ListMusic,
  Maximize2,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";
import { artUrl, proxiedArt } from "@/lib/types";
import { rgbCss, sampleDominantColor } from "@/lib/color";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useUiStore } from "@/store/useUiStore";
import { EqualizerBars } from "./EqualizerBars";
import { PlayPauseMorph } from "./PlayPauseMorph";

function fmt(t: number) {
  if (!Number.isFinite(t) || t < 0) return "0:00";
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function NowPlayingBar() {
  const track = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const progress = usePlayerStore((s) => s.progress);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.muted);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const playError = usePlayerStore((s) => s.playError);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);
  const previous = usePlayerStore((s) => s.previous);
  const seek = usePlayerStore((s) => s.seek);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const setMuted = usePlayerStore((s) => s.setMuted);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const queueOpen = useUiStore((s) => s.queueOpen);
  const setQueueOpen = useUiStore((s) => s.setQueueOpen);
  const setExpanded = useUiStore((s) => s.setExpanded);
  const isLiked = useLibraryStore((s) => s.isLiked);
  const toggleLike = useLibraryStore((s) => s.toggleLike);
  const [glow, setGlow] = useState("rgba(168,85,247,0.35)");
  const imgRef = useRef<HTMLImageElement>(null);
  const src = proxiedArt(artUrl(track?.thumbnails, 200)) || artUrl(track?.thumbnails, 80);

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const apply = () => setGlow(rgbCss(sampleDominantColor(img), 0.5));
    if (img.complete) apply();
    else img.addEventListener("load", apply, { once: true });
  }, [src]);

  return (
    <div
      className="glass-strong relative overflow-hidden rounded-2xl px-3 py-2 md:px-4"
      style={{ boxShadow: `0 -20px 80px -20px ${glow}` }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: `radial-gradient(120% 80% at 10% 100%, ${glow}, transparent 55%)`,
        }}
      />
      {playError && (
        <div className="relative mb-1 truncate text-center text-xs text-amber-300">{playError}</div>
      )}
      <div className="relative grid grid-cols-[1fr_auto] items-center gap-3 md:grid-cols-[1fr_2fr_1fr]">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-white/15 shadow-lg">
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img ref={imgRef} src={src} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-white/10" />
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-4 bg-gradient-to-t from-white/20 to-transparent" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-medium">{track?.title || "Nothing playing"}</div>
              {track && <EqualizerBars />}
            </div>
            <div className="truncate text-xs text-white/50">{track?.artist || "Choose a track to begin"}</div>
          </div>
          {track && (
            <button
              type="button"
              onClick={() => toggleLike(track)}
              className="rounded-full p-2 text-white/60 hover:text-white transition"
              title={isLiked(track.videoId) ? "Unlike" : "Like"}
              aria-label="Like"
            >
              <Heart
                className={`h-4 w-4 ${
                  isLiked(track.videoId) ? "fill-fuchsia-400 text-fuchsia-400" : ""
                }`}
              />
            </button>
          )}
        </div>

        <div className="flex flex-col items-center justify-center">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleShuffle}
              className={`hidden rounded-full p-1.5 md:block ${shuffle ? "text-cyan-300" : "text-white/50 hover:text-white"}`}
              aria-label="Shuffle"
            >
              <Shuffle className="h-4 w-4" />
            </button>
            <button type="button" onClick={previous} className="rounded-full p-1.5 text-white/80 hover:text-white" aria-label="Previous">
              <SkipBack className="h-5 w-5 fill-current" />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              disabled={!track}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-400 to-cyan-300 shadow-glow disabled:opacity-40"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              <PlayPauseMorph playing={isPlaying} />
            </button>
            <button type="button" onClick={next} className="rounded-full p-1.5 text-white/80 hover:text-white" aria-label="Next">
              <SkipForward className="h-5 w-5 fill-current" />
            </button>
            <button
              type="button"
              onClick={cycleRepeat}
              className={`hidden rounded-full p-1.5 md:block ${repeatMode !== "off" ? "text-cyan-300" : "text-white/50 hover:text-white"}`}
              aria-label="Repeat"
            >
              {repeatMode === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-1 hidden w-full max-w-xl items-center gap-2 md:flex">
            <span className="w-10 text-right text-[11px] tabular-nums text-white/40">{fmt(progress)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              step={0.1}
              value={Math.min(progress, duration || 0)}
              onChange={(e) => seek(Number(e.target.value))}
              className="w-full"
              style={{
                background: `linear-gradient(90deg, #a855f7, #22d3ee) 0 / ${
                  duration ? (progress / duration) * 100 : 0
                }% 100% no-repeat, rgba(255,255,255,0.12)`,
                borderRadius: 99,
                height: 4,
              }}
            />
            <span className="w-10 text-[11px] tabular-nums text-white/40">{fmt(duration)}</span>
          </div>
        </div>

        <div className="hidden items-center justify-end gap-2 md:flex">
          <button
            type="button"
            onClick={() => setQueueOpen(!queueOpen)}
            className={`rounded-full p-2 ${queueOpen ? "bg-white/10 text-cyan-300" : "text-white/60 hover:bg-white/10"}`}
            aria-label="Queue"
          >
            <ListMusic className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="rounded-full p-2 text-white/60 hover:bg-white/10"
            aria-label="Expand player"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5">
            <button type="button" onClick={() => setMuted(!muted)} aria-label="Mute">
              {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-24"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
