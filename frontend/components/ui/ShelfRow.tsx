"use client";

import type { Card, Shelf, Track } from "@/lib/types";
import { toTrack } from "@/lib/types";
import { GlassCard, TrackCard } from "./GlassCard";
import { useOpenCard } from "./useOpenCard";

export function ShelfRow({ shelf }: { shelf: Shelf }) {
  const openCard = useOpenCard();
  // A song can arrive as a Track or as a "song" card: treat both as songs.
  const tracks: Track[] = [];
  const cards: Card[] = [];
  for (const item of shelf.items) {
    const t = toTrack(item);
    if (t) tracks.push(t);
    else cards.push(item as Card);
  }
  if (!tracks.length && !cards.length) return null;

  return (
    <section className="cv-auto mb-9">
      <h2 className="mb-3.5 text-[22px] font-semibold tracking-tight">{shelf.title}</h2>
      <div className="no-scrollbar h-scroll flex gap-3.5 pb-1">
        {cards.map((c) => (
          <GlassCard key={`${c.type}-${c.id}`} item={c} onClick={() => openCard(c, tracks)} />
        ))}
        {tracks.map((t, i) => (
          <TrackCard key={t.videoId + i} track={t} queue={tracks} />
        ))}
      </div>
    </section>
  );
}

export function ShelfSkeleton() {
  return (
    <div className="mb-9 animate-pulse">
      <div className="mb-4 h-6 w-48 rounded-full bg-chip" />
      <div className="flex gap-3.5 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="w-[148px] shrink-0 sm:w-[172px]">
            <div className="aspect-square rounded-3xl bg-elevated" />
            <div className="mt-3 h-3 w-24 rounded-full bg-chip" />
            <div className="mt-2 h-3 w-16 rounded-full bg-elevated" />
          </div>
        ))}
      </div>
    </div>
  );
}
