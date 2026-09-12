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

  if (error) return <div className="glass rounded-2xl p-6 text-amber-200">{error}</div>;
  if (!data) return <div className="h-64 animate-pulse rounded-3xl bg-white/5" />;

  const cover = artUrl(data.thumbnails, 800);

  return (
    <div>
      <div className="relative mb-8 overflow-hidden rounded-3xl">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-64 w-full object-cover opacity-50" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0f] to-transparent" />
        <div className="absolute bottom-6 left-6">
          <div className="text-xs uppercase tracking-widest text-white/60">Artist</div>
          <h1 className="text-4xl font-semibold">{data.name}</h1>
          {data.songs[0] && (
            <button
              type="button"
              onClick={() => play(data.songs[0], data.songs)}
              className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-medium text-black"
            >
              Play
            </button>
          )}
        </div>
      </div>
      {data.description && <p className="mb-8 max-w-3xl text-sm leading-relaxed text-white/55">{data.description}</p>}
      {data.songs.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Popular</h2>
          {data.songs.map((t, i) => (
            <TrackRow key={t.videoId} track={t} index={i} queue={data.songs} />
          ))}
        </section>
      )}
      {data.albums.length > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Albums</h2>
          <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-2">
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
          <h2 className="mb-3 text-lg font-semibold">Singles</h2>
          <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-2">
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
