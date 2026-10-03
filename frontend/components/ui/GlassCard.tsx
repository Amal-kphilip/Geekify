"use client";

import { Album, Play } from "lucide-react";
import type { Card, Track } from "@/lib/types";
import { artUrl } from "@/lib/types";
import { usePlayerStore } from "@/store/usePlayerStore";

const CARD =
  "group w-[148px] shrink-0 rounded-3xl p-2.5 text-left transition hover:bg-white/[0.06] sm:w-[172px]";

/** Album / playlist / artist card . Name kept for existing imports. */
export function GlassCard({ item, onClick }: { item: Card; onClick?: () => void }) {
  const src = artUrl(item.thumbnails, 300);
  const round = item.type === "artist" ? "rounded-full" : "rounded-2xl";
  return (
    <button type="button" onClick={onClick} className={CARD}>
      <div className={`relative ${round} overflow-hidden bg-[#202145] shadow-lg shadow-black/40`}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" className={`aspect-square w-full object-cover ${round}`} />
        ) : (
          <div className={`flex aspect-square items-center justify-center ${round}`}>
            <Album className="h-10 w-10 text-white/30" />
          </div>
        )}
      </div>
      <div className={`mt-3 ${item.type === "artist" ? "text-center sm:text-left" : ""}`}>
        <div className="truncate text-sm font-bold">{item.title}</div>
        <div className="line-clamp-2 text-sm text-[#9d9bbd]">{item.subtitle || item.type}</div>
      </div>
    </button>
  );
}

/** Song card: tap to play the shelf as a queue. */
export function TrackCard({ track, queue }: { track: Track; queue?: Track[] }) {
  const play = usePlayerStore((s) => s.play);
  const active = usePlayerStore((s) => s.currentTrack?.videoId === track.videoId);
  const src = artUrl(track.thumbnails, 300);
  return (
    <button type="button" onClick={() => play(track, queue)} className={CARD}>
      <div className="relative overflow-hidden rounded-2xl bg-[#202145] shadow-lg shadow-black/40">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" loading="lazy" className="aspect-square w-full rounded-2xl object-cover" />
        ) : (
          <div className="aspect-square w-full" />
        )}
        <span className="absolute bottom-2 right-2 flex h-10 w-10 translate-y-2 items-center justify-center accent-bg rounded-full text-black opacity-0 shadow-xl transition group-hover:translate-y-0 group-hover:opacity-100">
          <Play className="h-5 w-5 fill-black" />
        </span>
      </div>
      <div className="mt-3">
        <div className={`truncate text-sm font-bold ${active ? "text-brand" : ""}`}>{track.title}</div>
        <div className="truncate text-sm text-[#9d9bbd]">{track.artist}</div>
      </div>
    </button>
  );
}
