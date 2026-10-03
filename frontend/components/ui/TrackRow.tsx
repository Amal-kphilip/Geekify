"use client";

import { useState } from "react";
import { Heart, ListMusic, ListPlus, Play } from "lucide-react";
import type { Track } from "@/lib/types";
import { artUrl } from "@/lib/types";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useLibraryStore } from "@/store/useLibraryStore";

export function TrackRow({
  track,
  index,
  queue,
}: {
  track: Track;
  index?: number;
  queue?: Track[];
}) {
  const play = usePlayerStore((s) => s.play);
  const current = usePlayerStore((s) => s.currentTrack);
  const addToQueue = usePlayerStore((s) => s.addToQueue);
  const toggleLike = useLibraryStore((s) => s.toggleLike);
  const playlists = useLibraryStore((s) => s.playlists);
  const addToPlaylist = useLibraryStore((s) => s.addToPlaylist);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const [menuOpen, setMenuOpen] = useState(false);
  const liked = useLibraryStore((s) => s.isLiked(track.videoId));
  const active = current?.videoId === track.videoId;
  const src = artUrl(track.thumbnails, 80);

  return (
    <div
      className={`group grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/10 ${
        active ? "bg-white/10" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => play(track, queue)}
        className="relative h-11 w-11 overflow-hidden rounded-2xl"
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full bg-white/10" />
        )}
        <span className="absolute inset-0 hidden items-center justify-center bg-ink/45 group-hover:flex">
          <Play className="h-4 w-4 fill-white text-white" />
        </span>
        {typeof index === "number" && (
          <span className="absolute -left-6 top-1/2 hidden -translate-y-1/2 text-xs text-white/40 sm:block">
            {index + 1}
          </span>
        )}
      </button>
      <button type="button" className="min-w-0 text-left" onClick={() => play(track, queue)}>
        <div className={`truncate text-sm ${active ? "text-brand" : ""}`}>
          {track.title}
        </div>
        <div className="truncate text-xs text-[#9d9bbd]">{track.artist}</div>
      </button>
      <div className="flex items-center gap-1 text-white/60">
        <span className="mr-2 hidden text-xs tabular-nums sm:inline">{track.duration}</span>
        <button
          type="button"
          title={liked ? "Unlike" : "Like"}
          onClick={() => toggleLike(track)}
          className="rounded-full p-1.5 hover:bg-white/10"
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-brand text-brand" : ""}`} />
        </button>
        <button
          type="button"
          title="Add to queue"
          onClick={() => addToQueue(track)}
          className="rounded-full p-1.5 hover:bg-white/10"
        >
          <ListPlus className="h-4 w-4" />
        </button>
        <div className="relative">
          <button
            type="button"
            title="Add to playlist"
            onClick={() => setMenuOpen((o) => !o)}
            className="rounded-full p-1.5 hover:bg-white/10"
          >
            <ListMusic className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-30 cursor-default"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-40 mt-1 max-h-60 w-52 overflow-y-auto rounded-xl bg-[#202145] p-1 text-sm text-white shadow-xl scrollbar-thin">
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    className="block w-full truncate rounded px-3 py-2 text-left hover:bg-white/10"
                    onClick={() => {
                      addToPlaylist(pl.id, track);
                      setMenuOpen(false);
                    }}
                  >
                    {pl.name}
                  </button>
                ))}
                <button
                  type="button"
                  className="block w-full rounded px-3 py-2 text-left text-brand hover:bg-white/10"
                  onClick={() => {
                    const name = window.prompt("Playlist name", "My playlist");
                    if (name) addToPlaylist(createPlaylist(name).id, track);
                    setMenuOpen(false);
                  }}
                >
                  + New playlist
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
