"use client";

import { memo } from "react";
import { Album, Play } from "lucide-react";
import type { Card, Track } from "@/lib/types";
import { artUrl } from "@/lib/types";
import { usePlayerStore } from "@/store/usePlayerStore";

const CARD = "group w-[148px] shrink-0 text-left sm:w-[172px]";

/** Album / playlist / artist card. (Name kept so existing imports keep working.) */
export const GlassCard = memo(function GlassCard({ item, onClick }: { item: Card; onClick?: () => void }) {
  const src = artUrl(item.thumbnails, 300);
  const round = item.type === "artist" ? "rounded-full" : "rounded-3xl";
  return (
    <button type="button" onClick={onClick} className={CARD}>
      <div className={`relative ${round} overflow-hidden bg-elevated`}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            className={`aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-[1.04] ${round}`}
          />
        ) : (
          <div className={`flex aspect-square items-center justify-center ${round}`}>
            <Album className="h-10 w-10 text-white/25" />
          </div>
        )}
      </div>
      <div className={`mt-3 ${item.type === "artist" ? "text-center" : ""}`}>
        <div className="truncate text-[15px] font-semibold">{item.title}</div>
        <div className="line-clamp-1 text-[13px] text-muted">{item.subtitle || item.type}</div>
      </div>
    </button>
  );
});

/** Song card: tap to play the shelf as a queue. */
export const TrackCard = memo(function TrackCard({ track, queue }: { track: Track; queue?: Track[] }) {
  const play = usePlayerStore((s) => s.play);
  const active = usePlayerStore((s) => s.currentTrack?.videoId === track.videoId);
  const src = artUrl(track.thumbnails, 300);
  return (
    <button type="button" onClick={() => play(track, queue)} className={CARD}>
      <div className="relative overflow-hidden rounded-3xl bg-elevated">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            className="aspect-square w-full rounded-3xl object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="aspect-square w-full" />
        )}
        <span className="absolute bottom-2.5 right-2.5 flex h-10 w-10 translate-y-1 items-center justify-center rounded-full bg-lime text-ink opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-y-0 group-hover:opacity-100">
          <Play className="h-4 w-4 fill-ink" />
        </span>
      </div>
      <div className="mt-3">
        <div className={`truncate text-[15px] font-semibold ${active ? "text-lime" : ""}`}>{track.title}</div>
        <div className="truncate text-[13px] text-muted">{track.artist}</div>
      </div>
    </button>
  );
});
