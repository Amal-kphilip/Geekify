"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Heart, Minimize2, SkipBack, SkipForward } from "lucide-react";
import { artUrl, proxiedArt } from "@/lib/types";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useUiStore } from "@/store/useUiStore";
import { PlayPauseMorph } from "./PlayPauseMorph";

export function ExpandedPlayer() {
  const track = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const bins = usePlayerStore((s) => s.analyserBins);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);
  const previous = usePlayerStore((s) => s.previous);
  const setExpanded = useUiStore((s) => s.setExpanded);
  const isLiked = useLibraryStore((s) => s.isLiked);
  const toggleLike = useLibraryStore((s) => s.toggleLike);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpanded(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setExpanded]);

  const src = proxiedArt(artUrl(track?.thumbnails, 800)) || artUrl(track?.thumbnails, 400);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex flex-col justify-between overflow-hidden bg-[#0a0a0f] p-6 md:p-12"
    >
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-35 blur-3xl"
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/90" />

      {/* Top bar with close button */}
      <div className="relative z-50 flex items-center justify-between">
        <div className="text-xs uppercase tracking-widest text-white/50">Now Playing</div>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="cursor-pointer rounded-full glass p-3 text-white/80 transition hover:bg-white/20 hover:text-white"
          aria-label="Exit full screen"
          title="Exit full screen (Esc)"
        >
          <Minimize2 className="h-6 w-6" />
        </button>
      </div>

      {/* Main Center Stage */}
      <div className="relative z-10 flex flex-col items-center justify-center gap-6">
        <div className="relative overflow-hidden rounded-3xl border border-white/15 shadow-2xl">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt="" className="h-64 w-64 object-cover md:h-80 md:w-80" />
          ) : (
            <div className="h-64 w-64 bg-white/10 md:h-80 md:w-80" />
          )}
        </div>

        {/* Audio-reactive visualizer waveform */}
        <div className="flex h-16 items-end gap-1.5">
          {Array.from({ length: 32 }).map((_, i) => {
            const v = bins[i % bins.length] || 0.15;
            const h = 8 + v * 56 * (0.5 + ((i * 13) % 10) / 20);
            return (
              <span
                key={i}
                className="w-1.5 rounded-full bg-gradient-to-t from-fuchsia-500 to-cyan-300 transition-[height] duration-75"
                style={{ height: isPlaying ? h : 8 }}
              />
            );
          })}
        </div>

        {/* Title & Artist & Like Button */}
        <div className="flex flex-col items-center text-center">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold tracking-tight md:text-3xl">
              {track?.title || "Nothing playing"}
            </h2>
            {track && (
              <button
                type="button"
                onClick={() => toggleLike(track)}
                className="rounded-full p-2 text-white/70 transition hover:scale-110 hover:text-white"
                title={isLiked(track.videoId) ? "Unlike" : "Like"}
              >
                <Heart
                  className={`h-6 w-6 ${
                    isLiked(track.videoId) ? "fill-fuchsia-400 text-fuchsia-400" : ""
                  }`}
                />
              </button>
            )}
          </div>
          <p className="mt-1 text-base text-white/60">{track?.artist}</p>
        </div>

        {/* Playback Controls */}
        <div className="mt-2 flex items-center gap-8">
          <button
            type="button"
            onClick={previous}
            className="rounded-full p-3 text-white/80 transition hover:scale-110 hover:text-white"
            aria-label="Previous"
          >
            <SkipBack className="h-8 w-8 fill-current" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            disabled={!track}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-400 to-cyan-300 text-black shadow-glow transition hover:scale-105 active:scale-95 disabled:opacity-40"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <PlayPauseMorph playing={isPlaying} />
          </button>
          <button
            type="button"
            onClick={next}
            className="rounded-full p-3 text-white/80 transition hover:scale-110 hover:text-white"
            aria-label="Next"
          >
            <SkipForward className="h-8 w-8 fill-current" />
          </button>
        </div>
      </div>

      <div className="relative z-10 text-center text-xs text-white/40">
        Press <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono">Esc</kbd> or click the minimize icon to exit
      </div>
    </motion.div>
  );
}
