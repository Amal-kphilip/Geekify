"use client";

import { Heart, X } from "lucide-react";
import { artUrl, proxiedArt } from "@/lib/types";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useUiStore } from "@/store/useUiStore";

/** Desktop right-hand "Now playing" view: cover art, title, like, next in queue. */
export function NowPlayingPanel() {
  const track = usePlayerStore((s) => s.currentTrack);
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const play = usePlayerStore((s) => s.play);
  const setNowPlayingOpen = useUiStore((s) => s.setNowPlayingOpen);
  const setQueueOpen = useUiStore((s) => s.setQueueOpen);
  const liked = useLibraryStore((s) => (track ? s.liked.some((t) => t.videoId === track.videoId) : false));
  const toggleLike = useLibraryStore((s) => s.toggleLike);

  if (!track) return null;
  const src = proxiedArt(artUrl(track.thumbnails, 600)) || artUrl(track.thumbnails, 300);
  const upNext = queue[queueIndex + 1];
  const upNextSrc = upNext ? artUrl(upNext.thumbnails, 80) : undefined;

  return (
    <aside className="scrollbar-thin flex h-full w-[320px] shrink-0 flex-col overflow-y-auto rounded-2xl glass-strong p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="truncate text-base font-bold">{track.album || "Now playing"}</h3>
        <button
          type="button"
          onClick={() => setNowPlayingOpen(false)}
          className="rounded-full p-1.5 text-[#aeabcf] transition hover:text-white"
          aria-label="Close now playing view"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="aspect-square w-full rounded-2xl object-cover" />
      ) : (
        <div className="aspect-square w-full rounded-2xl bg-white/10" />
      )}
      <div className="mt-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-2xl font-bold">{track.title}</div>
          <div className="truncate text-[#aeabcf]">{track.artist}</div>
        </div>
        <button
          type="button"
          onClick={() => toggleLike(track)}
          className="rounded-full p-2"
          aria-label={liked ? "Unlike" : "Like"}
          aria-pressed={liked}
        >
          <Heart className={`h-6 w-6 ${liked ? "fill-brand text-brand" : "text-[#aeabcf] hover:text-white"}`} />
        </button>
      </div>

      <div className="mt-6 rounded-2xl bg-[#1d1e3d] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="font-bold">Next in queue</h4>
          <button
            type="button"
            onClick={() => setQueueOpen(true)}
            className="text-sm font-semibold text-[#aeabcf] transition hover:text-white hover:underline"
          >
            Open queue
          </button>
        </div>
        {upNext ? (
          <button
            type="button"
            onClick={() => play(upNext, queue)}
            className="flex w-full items-center gap-3 text-left"
          >
            {upNextSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={upNextSrc} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
            ) : (
              <div className="h-12 w-12 shrink-0 rounded bg-white/10" />
            )}
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{upNext.title}</div>
              <div className="truncate text-sm text-[#aeabcf]">{upNext.artist}</div>
            </div>
          </button>
        ) : (
          <p className="text-sm text-[#9d9bbd]">Nothing up next yet.</p>
        )}
      </div>
    </aside>
  );
}
