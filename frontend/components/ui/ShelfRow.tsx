"use client";

import { useRouter } from "next/navigation";
import type { Card, Shelf } from "@/lib/types";
import { isTrack } from "@/lib/types";
import { GlassCard } from "./GlassCard";
import { TrackRow } from "./TrackRow";
import { usePlayerStore } from "@/store/usePlayerStore";

export function ShelfRow({ shelf }: { shelf: Shelf }) {
  const router = useRouter();
  const play = usePlayerStore((s) => s.play);
  const tracks = shelf.items.filter(isTrack);
  const cards = shelf.items.filter((i) => !isTrack(i)) as Card[];

  const openCard = (item: Card) => {
    if (item.type === "artist" && (item.browseId || item.id)) {
      router.push(`/artist/${encodeURIComponent(item.browseId || item.id)}`);
      return;
    }
    if (item.type === "album") {
      router.push(`/album/${encodeURIComponent(item.browseId || item.playlistId || item.id)}`);
      return;
    }
    if (item.type === "playlist") {
      router.push(`/playlist/${encodeURIComponent(item.playlistId || item.browseId || item.id)}`);
      return;
    }
    if (item.videoId) {
      play(
        {
          videoId: item.videoId,
          title: item.title,
          artist: item.subtitle || "Unknown",
          artists: [],
          thumbnails: item.thumbnails,
        },
        tracks.length ? tracks : undefined
      );
    }
  };

  return (
    <section className="mb-8">
      <h2 className="mb-3 px-1 text-lg font-semibold tracking-tight">{shelf.title}</h2>
      {cards.length > 0 ? (
        <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-3">
          {cards.map((c) => (
            <GlassCard key={`${c.type}-${c.id}`} item={c} onClick={() => openCard(c)} />
          ))}
        </div>
      ) : (
        <div className="space-y-0.5">
          {tracks.slice(0, 8).map((t, i) => (
            <TrackRow key={t.videoId + i} track={t} queue={tracks} />
          ))}
        </div>
      )}
    </section>
  );
}

export function ShelfSkeleton() {
  return (
    <div className="mb-8 animate-pulse">
      <div className="mb-3 h-5 w-40 rounded bg-white/10" />
      <div className="flex gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 w-40 shrink-0 rounded-xl bg-white/5" />
        ))}
      </div>
    </div>
  );
}
