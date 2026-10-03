"use client";

import type { Card, Shelf, Track } from "@/lib/types";
import { isTrack } from "@/lib/types";
import { GlassCard, TrackCard } from "./GlassCard";
import { useOpenCard } from "./useOpenCard";

export function ShelfRow({ shelf }: { shelf: Shelf }) {
  const openCard = useOpenCard();
  const tracks = shelf.items.filter(isTrack) as Track[];
  const cards = shelf.items.filter((i) => !isTrack(i)) as Card[];
  if (!tracks.length && !cards.length) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-2 text-xl font-bold tracking-tight md:text-2xl">{shelf.title}</h2>
      <div className="no-scrollbar -mx-3 flex gap-0 overflow-x-auto px-0 pb-2 md:-mx-3">
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
    <div className="mb-8 animate-pulse">
      <div className="mb-3 h-6 w-48 rounded bg-white/10" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="w-[148px] shrink-0 sm:w-[172px]">
            <div className="aspect-square rounded-xl bg-white/10" />
            <div className="mt-3 h-3 w-24 rounded bg-white/10" />
            <div className="mt-2 h-3 w-16 rounded bg-white/5" />
          </div>
        ))}
      </div>
    </div>
  );
}
