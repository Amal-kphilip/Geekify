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
 * The mini player's thin progress line. It owns the `progress` subscription so the (much bigger)
 * bar around it does NOT re-render on every audio timeupdate.
 */
function MiniProgress() {
  const pct = usePlayerStore((s) => (s.duration ? Math.min(100, (s.progress / s.duration) * 100) : 0));
  return (
    <div className="absolute inset-x-4 bottom-0 h-[3px] overflow-hidden rounded-full bg-white/10">
      <div className="h-full rounded-full bg-lime" style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * Player bar. Desktop: 3-column dock. Mobile: compact card above the bottom nav
 * (tap it to open the full player, which has the timeline).
 */
export function NowPlayingBar() {
  const track = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isBuffering = usePlayerStore((s) => s.isBuffering);
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
  const vol = muted ? 0 : volume;
  const VolIcon = vol === 0 ? VolumeX : vol < 0.5 ? Volume1 : Volume2;

  const likeBtn = (
    <button
      type="button"
      onClick={() => toggleLike(track)}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-90"
      title={liked ? "Remove from Favourites" : "Save to Favourites"}
      aria-label={liked ? "Unlike" : "Like"}
      aria-pressed={liked}
    >
      <Heart className={`h-5 w-5 ${liked ? "fill-lime text-lime" : "text-muted hover:text-white"}`} />
    </button>
  );

  const iconBtn = (active: boolean) =>
    `relative flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
      active ? "text-lime" : "text-muted hover:text-white"
    }`;

  const ctrlBtn =
    "flex h-10 w-10 items-center justify-center rounded-full bg-chip text-white transition-colors hover:bg-white/15 active:scale-95";

  return (
    <>
      {playError && (
        <div className="shrink-0 bg-ink px-4 py-1 text-center text-xs text-amber-300" role="alert">
          {playError}
        </div>
      )}

      {/* ---------- Mobile mini player ---------- */}
      <div className="relative mx-4 mb-2 shrink-0 overflow-hidden rounded-[22px] bg-elevated md:hidden">
        <div className="flex items-center gap-2 p-2 pb-2.5 pr-2">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label="Open full player"
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" decoding="async" className="h-11 w-11 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="h-11 w-11 shrink-0 rounded-full bg-chip" />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{track.title}</div>
              <div className="truncate text-xs text-muted">{track.artist}</div>
            </div>
          </button>
          {likeBtn}
          <button
            type="button"
            onClick={togglePlay}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lime transition-transform active:scale-90"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <PlayPauseMorph playing={isPlaying} loading={loading} />
          </button>
        </div>
        <MiniProgress />
      </div>

      {/* ---------- Desktop bar ---------- */}
      <div className="mx-3 mb-3 hidden h-[88px] shrink-0 grid-cols-[1fr_minmax(0,2fr)_1fr] items-center gap-4 rounded-[28px] bg-surface px-5 md:grid">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label="Open full player"
            className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full bg-elevated"
          >
            {src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={src} alt="" decoding="async" className="h-full w-full rounded-full object-cover" />
            ) : (
              <div className="h-full w-full rounded-full bg-chip" />
            )}
          </button>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{track.title}</div>
            <div className="truncate text-xs text-muted">{track.artist}</div>
          </div>
          {likeBtn}
        </div>

        <div className="flex flex-col items-center justify-center gap-1">
          <div className="flex items-center gap-3">
            <button type="button" onClick={toggleShuffle} className={iconBtn(shuffle)} aria-label="Shuffle" aria-pressed={shuffle}>
              <Shuffle className="h-4 w-4" />
              {shuffle && <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-lime" />}
            </button>
            <button type="button" onClick={previous} className={ctrlBtn} aria-label="Previous">
              <SkipBack className="h-4 w-4 fill-current" />
            </button>
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-lime transition-transform hover:scale-105 active:scale-95"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              <PlayPauseMorph playing={isPlaying} loading={loading} />
            </button>
            <button type="button" onClick={next} className={ctrlBtn} aria-label="Next">
              <SkipForward className="h-4 w-4 fill-current" />
            </button>
            <button type="button" onClick={cycleRepeat} className={iconBtn(repeatMode !== "off")} aria-label="Repeat" aria-pressed={repeatMode !== "off"}>
              {repeatMode === "one" ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
              {repeatMode !== "off" && <span className="absolute bottom-0.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-lime" />}
            </button>
          </div>
          <SeekBar className="max-w-[560px]" />
        </div>

        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setNowPlayingOpen(!nowPlayingOpen || queueOpen)}
            className={`hidden lg:flex ${iconBtn(nowPlayingOpen && !queueOpen)}`}
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
              background: `linear-gradient(90deg, var(--seek-fill), var(--seek-fill)) 0 / ${vol * 100}% 100% no-repeat, var(--seek-track)`,
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
