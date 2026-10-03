"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { CollectionPage } from "@/lib/types";
import { TrackRow } from "@/components/ui/TrackRow";
import { artUrl } from "@/lib/types";
import { usePlayerStore } from "@/store/usePlayerStore";

export default function AlbumPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<CollectionPage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const play = usePlayerStore((s) => s.play);

  useEffect(() => {
    if (!id) return;
    api
      .album(id)
      .then(setData)
      .catch(() => {
        return api
          .playlist(id)
          .then(setData)
          .catch((e: Error) => setError(e.message || "Could not load album"));
      });
  }, [id]);

  if (error) return <div className="glass rounded-2xl p-6 text-amber-200">{error}</div>;
  if (!data) return <div className="h-64 animate-pulse rounded-3xl bg-white/5" />;
  const cover = artUrl(data.thumbnails, 400);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end">
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-48 w-48 rounded-2xl object-cover shadow-2xl" />
        )}
        <div>
          <div className="text-xs uppercase tracking-widest text-white/45">Album</div>
          <h1 className="text-4xl font-semibold">{data.title}</h1>
          <p className="mt-2 text-sm text-white/50">
            {data.artist}
            {data.year ? ` • ${data.year}` : ""} • {data.tracks.length} tracks
          </p>
          {data.tracks[0] && (
            <button
              type="button"
              onClick={() => play(data.tracks[0], data.tracks)}
              className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-medium text-black"
            >
              Play
            </button>
          )}
        </div>
      </div>
      {data.tracks.map((t, i) => (
        <TrackRow key={t.videoId} track={t} index={i} queue={data.tracks} />
      ))}
    </div>
  );
}
