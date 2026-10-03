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

/** Full-screen player (mobile + desktop): cover, title, timeline, controls. */
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
  const [tint, setTint] = useState("rgb(60, 60, 60)");
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setExpanded]);

  const src = proxiedArt(artUrl(track?.thumbnails, 800)) || artUrl(track?.thumbnails, 400);

  // Background = the cover's main colour fading into the app's dark panel colour.
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const apply = () => setTint(rgbCss(sampleDominantColor(img), 1));
    if (img.complete && img.naturalWidth) apply();
    else img.addEventListener("load", apply, { once: true });
  }, [src]);

  const loading = isBuffering && isPlaying;
  const iconBtn = (active: boolean) =>
    `relative rounded-full p-2 transition ${active ? "text-brand" : "text-white/70 hover:text-white"}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[100] flex flex-col overflow-y-auto overflow-x-hidden px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]"
      style={{ background: `linear-gradient(180deg, ${tint} 0%, rgba(0,0,0,0.55) 45%, #14152e 100%), #14152e` }}
    >
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col">
        <div className="flex items-center justify-between py-2">
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="rounded-full p-2 text-white transition hover:bg-white/10"
            aria-label="Close full player"
            title="Close (Esc)"
          >
            <ChevronDown className="h-7 w-7" />
          </button>
          <div className="text-xs font-semibold uppercase tracking-wider text-white/80">Now playing</div>
          <button
            type="button"
            onClick={() => setQueueOpen(true)}
            className="rounded-full p-2 text-white transition hover:bg-white/10"
            aria-label="Open queue"
            title="Queue"
          >
            <ListMusic className="h-6 w-6" />
          </button>
        </div>

        <div className="flex flex-1 items-center justify-center py-4">
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imgRef}
              src={src}
              alt=""
              className="aspect-square rounded-2xl object-cover shadow-2xl shadow-black/50"
              style={{ width: "min(100%, 44dvh)" }}
            />
          ) : (
            <div className="aspect-square rounded-2xl bg-white/10" style={{ width: "min(100%, 44dvh)" }} />
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="line-clamp-2 text-2xl font-bold leading-tight">{track?.title || "Nothing playing"}</h2>
            <p className="mt-1 truncate text-white/70">{track?.artist}</p>
          </div>
          {track && (
            <button
              type="button"
              onClick={() => toggleLike(track)}
              className="rounded-full p-2"
              aria-label={liked ? "Unlike" : "Like"}
              aria-pressed={liked}
            >
              <Heart className={`h-7 w-7 ${liked ? "fill-brand text-brand" : "text-white/80 hover:text-white"}`} />
            </button>
          )}
        </div>

        {playError && <div className="mt-3 text-center text-xs text-amber-300">{playError}</div>}

        <SeekBar large className="mt-4" />

        <div className="mt-3 flex items-center justify-between">
          <button type="button" onClick={toggleShuffle} className={iconBtn(shuffle)} aria-label="Shuffle" aria-pressed={shuffle}>
            <Shuffle className="h-6 w-6" />
            {shuffle && <span className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brand" />}
          </button>
          <button type="button" onClick={previous} className="rounded-full p-2 text-white" aria-label="Previous">
            <SkipBack className="h-9 w-9 fill-current" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            disabled={!track}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white transition hover:scale-105 active:scale-95 disabled:opacity-40"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <PlayPauseMorph playing={isPlaying} loading={loading} />
          </button>
          <button type="button" onClick={next} className="rounded-full p-2 text-white" aria-label="Next">
            <SkipForward className="h-9 w-9 fill-current" />
          </button>
          <button type="button" onClick={cycleRepeat} className={iconBtn(repeatMode !== "off")} aria-label="Repeat" aria-pressed={repeatMode !== "off"}>
            {repeatMode === "one" ? <Repeat1 className="h-6 w-6" /> : <Repeat className="h-6 w-6" />}
            {repeatMode !== "off" && <span className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brand" />}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
