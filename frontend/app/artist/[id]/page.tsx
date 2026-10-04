"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { ArtistPage } from "@/lib/types";
import { TrackRow } from "@/components/ui/TrackRow";
import { GlassCard } from "@/components/ui/GlassCard";
import { artUrl } from "@/lib/types";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useRouter } from "next/navigation";
import { PlayButton } from "@/components/ui/CollectionHeader";

export default function ArtistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<ArtistPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const play = usePlayerStore((s) => s.play);

  useEffect(() => {
    if (!id) return;
    api
      .artist(id)
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, [id]);

  if (error) return <div className="rounded-3xl bg-elevated p-6 text-amber-200">{error}</div>;
  if (!data) return <div className="h-64 animate-pulse rounded-[32px] bg-elevated" />;

  const cover = artUrl(data.thumbnails, 800);

  return (
    <div>
      <div className="relative mb-8 h-64 overflow-hidden rounded-[32px] bg-elevated">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" decoding="async" className="h-full w-full object-cover opacity-60" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/30 to-transparent" />
        <div className="absolute inset-x-6 bottom-6">
          <div className="text-sm font-medium text-white/70">Artist</div>
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">{data.name}</h1>
          {data.songs[0] && (
            <div className="mt-4">
              <PlayButton onClick={() => play(data.songs[0], data.songs)} />
            </div>
          )}
        </div>
      </div>
      {data.description && <p className="mb-8 max-w-3xl text-sm leading-relaxed text-muted">{data.description}</p>}
      {data.songs.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3.5 text-[22px] font-semibold tracking-tight">Popular</h2>
          {data.songs.map((t, i) => (
            <TrackRow key={t.videoId} track={t} index={i} queue={data.songs} />
          ))}
        </section>
      )}
      {data.albums.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3.5 text-[22px] font-semibold tracking-tight">Albums</h2>
          <div className="no-scrollbar h-scroll flex gap-3.5 pb-1">
            {data.albums.map((c) => (
              <GlassCard
                key={c.id}
                item={c}
                onClick={() => router.push(`/album/${encodeURIComponent(c.browseId || c.playlistId || c.id)}`)}
              />
            ))}
          </div>
        </section>
      )}
      {data.singles.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3.5 text-[22px] font-semibold tracking-tight">Singles</h2>
          <div className="no-scrollbar h-scroll flex gap-3.5 pb-1">
            {data.singles.map((c) => (
              <GlassCard
                key={c.id}
                item={c}
                onClick={() => router.push(`/album/${encodeURIComponent(c.browseId || c.playlistId || c.id)}`)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
