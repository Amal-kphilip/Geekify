"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import type { CollectionPage } from "@/lib/types";
import { TrackRow } from "@/components/ui/TrackRow";
import { artUrl } from "@/lib/types";
import { usePlayerStore } from "@/store/usePlayerStore";
import { CollectionHeader, PlayButton } from "@/components/ui/CollectionHeader";

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

  if (error) return <div className="rounded-3xl bg-elevated p-6 text-amber-200">{error}</div>;
  if (!data) return <div className="h-64 animate-pulse rounded-[32px] bg-elevated" />;
  const cover = artUrl(data.thumbnails, 400);

  return (
    <div>
      <CollectionHeader
        cover={cover}
        kind="Album"
        title={data.title}
        meta={`${data.artist}${data.year ? ` \u2022 ${data.year}` : ""} \u2022 ${data.tracks.length} tracks`}
      >
        {data.tracks[0] && <PlayButton onClick={() => play(data.tracks[0], data.tracks)} />}
      </CollectionHeader>
      {data.tracks.map((t, i) => (
        <TrackRow key={t.videoId} track={t} index={i} queue={data.tracks} />
      ))}
    </div>
  );
}
