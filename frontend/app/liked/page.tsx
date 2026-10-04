"use client";

import { Heart } from "lucide-react";
import { TrackRow } from "@/components/ui/TrackRow";
import { CollectionHeader, PlayButton } from "@/components/ui/CollectionHeader";
import { useLibraryStore } from "@/store/useLibraryStore";
import { usePlayerStore } from "@/store/usePlayerStore";

export default function LikedPage() {
  const liked = useLibraryStore((s) => s.liked);
  const play = usePlayerStore((s) => s.play);
  return (
    <div>
      <CollectionHeader
        kind="Playlist"
        title="Favourites"
        meta={`${liked.length} tracks`}
        coverNode={
          <div className="flex h-48 w-48 shrink-0 items-center justify-center rounded-[32px] bg-lime">
            <Heart className="h-16 w-16 fill-ink text-ink" />
          </div>
        }
      >
        {liked[0] && <PlayButton onClick={() => play(liked[0], liked)} />}
      </CollectionHeader>
      {liked.length === 0 ? (
        <p className="text-muted">Heart a track to save it here.</p>
      ) : (
        liked.map((t, i) => <TrackRow key={t.videoId} track={t} index={i} queue={liked} />)
      )}
    </div>
  );
}
