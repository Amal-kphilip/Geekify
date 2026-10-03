"use client";

import {
  Heart,
  ListMusic,
  Maximize2,
  Music2,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { artUrl, proxiedArt } from "@/lib/types";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useUiStore } from "@/store/useUiStore";
import { PlayPauseMorph } from "./PlayPauseMorph";
import { SeekBar } from "./SeekBar";

/**
 * Player bar. Desktop: 3-column dock. Mobile: compact card above the bottom nav
 * (tap it to open the full player, which has the timeline).
 */
export function NowPlayingBar() {
  const track = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
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
  const setVolume = usePlayerStore((s) => s.setVolume);
  const setMuted = usePlayerStore((s) => s.setMuted);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const cycleRepeat = usePlayerStore((s) => s.cycleRepeat);
  const queueOpen = useUiStore((s) => s.queueOpen);
  const setQueueOpen = useUiStore((s) => s.setQueueOpen);
  const nowPlayingOpen = useUiStore((s) => s.nowPlayingOpen);
  const setNowPlayingOpen = useUiStore((s) => s.setNowPlayingOpen);
  const setExpanded = useUiStore((s) => s.setExpanded);
  const liked = useLibraryStore((s) => (track ? s.liked.some((t) => t.videoId === track.videoId) : false));
  const toggleLike = useLibraryStore((s) => s.toggleLike);

  if (!track) return null;

  const src = proxiedArt(artUrl(track.thumbnails, 200)) || artUrl(track.thumbnails, 80);
  const loading = isBuffering && isPlaying;
  const pct = duration ? Math.min(100, (progress / duration) * 100) : 0;
  const vol = muted ? 0 : volume;
  const VolIcon = vol === 0 ? VolumeX : vol < 0.5 ? Volume1 : Volume2;

  const likeBtn = (cls: string) => (
    <button
      type="button"
      onClick={() => toggleLike(track)}
      className={`rounded-full p-2 transition hover:scale-105 ${cls}`}
      title={liked ? "Remove from Favourites" : "Save to Favourites"}
      aria-label={liked ? "Unlike" : "Like"}
      aria-pressed={liked}
    >
      <Heart className={`h-5 w-5 ${liked ? "fill-brand text-brand" : "text-[#aeabcf] hover:text-white"}`} />
    </button>
  );

  const iconBtn = (active: boolean) =>
    `relative rounded-full p-2 transition ${active ? "text-brand" : "text-[#aeabcf] hover:text-white"}`;

  return (
    <>
      {playError && (
        <div className="shrink-0 bg-ink px-4 py-1 text-center text-xs text-amber-300" role="alert">
          {playError}
        </div>
      )}

      {/* ---------- Mobile mini player ---------- */}
      <div className="relative mx-2 mb-1 shrink-0 overflow-hidden rounded-2xl glass-strong md:hidden">
        <div className="flex items-center gap-2 p-2 pr-1">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label="Open full player"
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
            ) : (
              <div className="h-10 w-10 shrink-0 rounded bg-white/10" />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{track.title}</div>
              <div className="truncate text-xs text-[#aeabcf]">{track.artist}</div>
            </div>
          </button>
          {likeBtn("")}
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <PlayPauseMorph playing={isPlaying} loading={loading} tone="light" />
          </button>
        </div>
        <div className="absolute inset-x-2 bottom-0 h-[2px] rounded bg-white/20">
          <div className="h-full rounded bg-white" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {/* ---------- Desktop bar ---------- */}
      <div className="glass-strong mx-3 mb-3 hidden h-[88px] shrink-0 grid-cols-[1fr_minmax(0,2fr)_1fr] items-center gap-4 rounded-3xl px-5 shadow-2xl shadow-black/40 md:grid">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label="Open full player"
            className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full ring-2 ring-white/10"
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" className={`record h-full w-full rounded-full object-cover ${isPlaying ? "is-playing" : ""}`} />
            ) : (
              <div className="h-full w-full rounded-full bg-white/10" />
            )}
            <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-white/25" />
          </button>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{track.title}</div>
            <div className="truncate text-xs text-[#aeabcf]">{track.artist}</div>
          </div>
          {likeBtn("")}
        </div>

        <div className="flex flex-col items-center justify-center gap-1">
          <div className="flex items-center gap-3">
            <button type="button" onClick={toggleShuffle} className={iconBtn(shuffle)} aria-label="Shuffle" aria-pressed={shuffle}>
              <Shuffle className="h-4 w-4" />
              {shuffle && <span className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brand" />}
            </button>
            <button type="button" onClick={previous} className="rounded-full p-2 text-[#aeabcf] transition hover:text-white" aria-label="Previous">
              <SkipBack className="h-5 w-5 fill-current" />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              className="accent-bg flex h-10 w-10 items-center justify-center rounded-full shadow-lg shadow-violet-500/30 transition hover:scale-105"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              <PlayPauseMorph playing={isPlaying} loading={loading} />
            </button>
            <button type="button" onClick={next} className="rounded-full p-2 text-[#aeabcf] transition hover:text-white" aria-label="Next">
              <SkipForward className="h-5 w-5 fill-current" />
            </button>
            <button type="button" onClick={cycleRepeat} className={iconBtn(repeatMode !== "off")} aria-label="Repeat" aria-pressed={repeatMode !== "off"}>
              {repeatMode === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
              {repeatMode !== "off" && <span className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-brand" />}
            </button>
          </div>
          <SeekBar className="max-w-[560px]" />
        </div>

        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setNowPlayingOpen(!nowPlayingOpen || queueOpen)}
            className={`hidden lg:block ${iconBtn(nowPlayingOpen && !queueOpen)}`}
            aria-label="Now playing view"
            title="Now playing view"
          >
            <Music2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setQueueOpen(!queueOpen)}
            className={iconBtn(queueOpen)}
            aria-label="Queue"
            title="Queue"
          >
            <ListMusic className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setMuted(!muted)} className={iconBtn(false)} aria-label="Mute">
            <VolIcon className="h-4 w-4" />
          </button>
          <input
            type="range"
            aria-label="Volume"
            min={0}
            max={1}
            step={0.01}
            value={vol}
            onChange={(e) => setVolume(Number(e.target.value))}
            className="w-24"
            style={{
              background: `linear-gradient(90deg, var(--seek-fill, #fff), var(--seek-fill, #fff)) 0 / ${vol * 100}% 100% no-repeat, rgba(255,255,255,0.3)`,
              borderRadius: 99,
            }}
          />
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className={iconBtn(false)}
            aria-label="Full screen"
            title="Full screen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}
