"use client";

import { memo, useState } from "react";
import { Heart, ListMusic, ListPlus, Play } from "lucide-react";
import type { Track } from "@/lib/types";
import { artUrl } from "@/lib/types";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useLibraryStore } from "@/store/useLibraryStore";

/** The "add to playlist" popover. Only mounted while open, so closed rows never subscribe to playlists. */
function PlaylistMenu({ track, onClose }: { track: Track; onClose: () => void }) {
  const playlists = useLibraryStore((s) => s.playlists);
  const addToPlaylist = useLibraryStore((s) => s.addToPlaylist);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);

  return (
    <>
      <button type="button" aria-label="Close menu" className="fixed inset-0 z-30 cursor-default" onClick={onClose} />
      <div className="scrollbar-thin absolute right-0 z-40 mt-1 max-h-60 w-56 animate-pop overflow-y-auto rounded-2xl bg-chip p-1.5 text-sm text-white shadow-xl shadow-black/50 [transform-origin:top_right]">
        {playlists.map((pl) => (
          <button
            key={pl.id}
            type="button"
            className="block w-full truncate rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/10"
            onClick={() => {
              addToPlaylist(pl.id, track);
              onClose();
            }}
          >
            {pl.name}
          </button>
        ))}
        <button
          type="button"
          className="block w-full rounded-xl px-3 py-2.5 text-left font-medium text-lime transition-colors hover:bg-white/10"
          onClick={() => {
            const name = window.prompt("Playlist name", "My playlist");
            if (name) addToPlaylist(createPlaylist(name).id, track);
            onClose();
          }}
        >
          + New playlist
        </button>
      </div>
    </>
  );
}

export const TrackRow = memo(function TrackRow({
  track,
  index,
  queue,
}: {
  track: Track;
  index?: number;
  queue?: Track[];
}) {
  const play = usePlayerStore((s) => s.play);
  // Boolean selector: rows only re-render when *their* active state flips, not on every track change.
  const active = usePlayerStore((s) => s.currentTrack?.videoId === track.videoId);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const toggleLike = useLibraryStore((s) => s.toggleLike);
  const liked = useLibraryStore((s) => s.isLiked(track.videoId));
  const [menuOpen, setMenuOpen] = useState(false);
  const src = artUrl(track.thumbnails, 80);

  const iconBtn =
    "flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/10 hover:text-white sm:h-9 sm:w-9";

  return (
    <div
      className={`group grid grid-cols-[auto_1fr_auto] items-center gap-3.5 rounded-3xl px-2 py-2 transition-colors hover:bg-white/[0.04] ${
        active ? "bg-white/[0.06]" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => play(track, queue)}
        aria-label={`Play ${track.title}`}
        className="relative h-14 w-14 overflow-hidden rounded-2xl bg-elevated"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-elevated" />
        )}
        <span className="absolute inset-0 hidden items-center justify-center bg-ink/55 group-hover:flex">
          <Play className="h-4 w-4 fill-white text-white" />
        </span>
        {typeof index === "number" && (
          <span className="absolute -left-6 top-1/2 hidden -translate-y-1/2 text-xs text-white/35 sm:block">
            {index + 1}
          </span>
        )}
      </button>
      <button type="button" className="min-w-0 text-left" onClick={() => play(track, queue)}>
        <div className={`truncate text-[15px] font-medium ${active ? "text-lime" : ""}`}>{track.title}</div>
        <div className="truncate text-[13px] text-muted">{track.artist}</div>
      </button>
      <div className="flex items-center gap-0.5">
        <span className="mr-2 hidden text-xs tabular-nums text-muted sm:inline">{track.duration}</span>
        <button
          type="button"
          title={liked ? "Unlike" : "Like"}
          aria-label={liked ? "Unlike" : "Like"}
          aria-pressed={liked}
          onClick={() => toggleLike(track)}
          className={iconBtn}
        >
          <Heart className={`h-[18px] w-[18px] ${liked ? "fill-lime text-lime" : ""}`} />
        </button>
        <button type="button" title="Add to queue" aria-label="Add to queue" onClick={() => addToQueue(track)} className={iconBtn}>
          <ListPlus className="h-[18px] w-[18px]" />
        </button>
        <div className="relative">
          <button
            type="button"
            title="Add to playlist"
            aria-label="Add to playlist"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className={iconBtn}
          >
            <ListMusic className="h-[18px] w-[18px]" />
          </button>
          {menuOpen && <PlaylistMenu track={track} onClose={() => setMenuOpen(false)} />}
        </div>
        <button
          type="button"
          aria-label={`Play ${track.title}`}
          onClick={() => play(track, queue)}
          className={`ml-1 hidden h-10 w-10 items-center justify-center rounded-full transition-colors sm:flex ${
            active ? "bg-lime text-ink" : "bg-chip text-white hover:bg-lime hover:text-ink"
          }`}
        >
          <Play className="h-4 w-4 fill-current" />
        </button>
      </div>
    </div>
  );
});
