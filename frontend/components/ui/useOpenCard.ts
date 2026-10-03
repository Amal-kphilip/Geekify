"use client";

import { useRouter } from "next/navigation";
import type { Card, Track } from "@/lib/types";
import { usePlayerStore } from "@/store/usePlayerStore";

/** Shared click behaviour for cards: open artist/album/playlist pages, or play a song card. */
export function useOpenCard() {
  const router = useRouter();
  const play = usePlayerStore((s) => s.play);

  return (item: Card, queue?: Track[]) => {
    if (item.type === "artist" && (item.browseId || item.id)) {
      router.push(`/artist/${encodeURIComponent(item.browseId || item.id)}`);
    } else if (item.type === "album") {
      router.push(`/album/${encodeURIComponent(item.browseId || item.playlistId || item.id)}`);
    } else if (item.type === "playlist") {
      router.push(`/playlist/${encodeURIComponent(item.playlistId || item.browseId || item.id)}`);
    } else if (item.videoId) {
      play(
        {
          videoId: item.videoId,
          title: item.title,
          artist: item.subtitle || "Unknown",
          artists: [],
          thumbnails: item.thumbnails,
        },
        queue?.length ? queue : undefined
      );
    }
  };
}
