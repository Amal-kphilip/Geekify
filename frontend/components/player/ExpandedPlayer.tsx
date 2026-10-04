"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Heart, ListMusic, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from "lucide-react";
import { artUrl, proxiedArt } from "@/lib/types";
import { rgbCss, sampleDominantColor } from "@/lib/color";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useUiStore } from "@/store/useUiStore";
import { PlayPauseMorph } from "./PlayPauseMorph";
import { SeekBar } from "./SeekBar";

/** Full-screen player (mobile + desktop): round cover, title, timeline, controls. */
export function ExpandedPlayer() {
  const track = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
  const playError = usePlayerStore((s) => s.playError);
  const shuffle = usePlayerStore((s) => s.shuffle);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const next = usePlayerStore((s) => s.next);
  const previous = usePlayerStore((s) => s.previous);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const setExpanded = useUiStore((s) => s.setExpanded);
  const setQueueOpen = useUiStore((s) => s.setQueueOpen);
  const liked = useLibraryStore((s) => (track ? s.liked.some((t) => t.videoId === track.videoId) : false));
  const toggleLike = useLibraryStore((s) => s.toggleLike);
  const [tint, setTint] = useState("rgba(90, 86, 110, 0.6)");
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setExpanded]);

  const src = proxiedArt(artUrl(track?.thumbnails, 800)) || artUrl(track?.thumbnails, 400);

  // Background = the cover's main colour fading into the app's dark base. A plain gradient: no blur filters.
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const apply = () => setTint(rgbCss(sampleDominantColor(img), 0.55));
    if (img.complete && img.naturalWidth) apply();
    else img.addEventListener("load", apply, { once: true });
  }, [src]);

  const loading = isBuffering && isPlaying;
  const iconBtn = (active: boolean) =>
    `relative flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
      active ? "text-lime" : "text-white/70 hover:text-white"
    }`;
  const circle =
    "flex items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 active:scale-95";

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="scroll-area fixed inset-0 z-[100] flex flex-col overflow-y-auto overflow-x-hidden px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
      style={{ background: `linear-gradient(180deg, ${tint} 0%, #0c0b11 62%), #0c0b11` }}
    >
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center py-2">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className={`h-11 w-11 justify-self-start ${circle}`}
            aria-label="Close full player"
            title="Close (Esc)"
          >
            <ChevronDown className="h-6 w-6" />
          </button>
          <div className="text-base font-semibold">Now playing</div>
          <div className="flex items-center gap-2 justify-self-end">
            <button
              type="button"
              onClick={() => setQueueOpen(true)}
              className={`h-11 w-11 ${circle}`}
              aria-label="Open queue"
              title="Queue"
            >
              <ListMusic className="h-5 w-5" />
            </button>
            {track && (
              <button
                type="button"
                onClick={() => toggleLike(track)}
                className={`h-11 w-11 ${circle}`}
                aria-label={liked ? "Unlike" : "Like"}
                aria-pressed={liked}
              >
                <Heart className={`h-5 w-5 ${liked ? "fill-lime text-lime" : ""}`} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center py-4">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={src}
              alt=""
              decoding="async"
              className="aspect-square rounded-full object-cover shadow-2xl shadow-black/50"
              style={{ width: "min(100%, 42dvh)" }}
            />
          ) : (
            <div className="aspect-square rounded-full bg-white/10" style={{ width: "min(100%, 42dvh)" }} />
          )}
        </div>

        <div className="text-center">
          <h2 className="line-clamp-2 text-[26px] font-semibold leading-tight tracking-tight">
            {track?.title || "Nothing playing"}
          </h2>
          <p className="mt-1.5 truncate text-[15px] text-white/60">{track?.artist}</p>
        </div>

        {playError && <div className="mt-3 text-center text-xs text-amber-300">{playError}</div>}

        <SeekBar large className="mt-8" />

        <div className="mt-5 flex items-center justify-between">
          <button type="button" onClick={toggleShuffle} className={iconBtn(shuffle)} aria-label="Shuffle" aria-pressed={shuffle}>
            <Shuffle className="h-5 w-5" />
            {shuffle && <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-lime" />}
          </button>
          <button type="button" onClick={previous} className={`h-14 w-14 ${circle}`} aria-label="Previous">
            <SkipBack className="h-6 w-6 fill-current" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            disabled={!track}
            className="flex h-[76px] w-[76px] items-center justify-center rounded-full bg-lime transition-transform hover:scale-105 active:scale-95 disabled:opacity-40"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <PlayPauseMorph playing={isPlaying} loading={loading} />
          </button>
          <button type="button" onClick={next} className={`h-14 w-14 ${circle}`} aria-label="Next">
            <SkipForward className="h-6 w-6 fill-current" />
          </button>
          <button type="button" onClick={cycleRepeat} className={iconBtn(repeatMode !== "off")} aria-label="Repeat" aria-pressed={repeatMode !== "off"}>
            {repeatMode === "one" ? <Repeat1 className="h-5 w-5" /> : <Repeat className="h-5 w-5" />}
            {repeatMode !== "off" && <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-lime" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
