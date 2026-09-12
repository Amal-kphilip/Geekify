"use client";

import { Heart } from "lucide-react";
import { TrackRow } from "@/components/ui/TrackRow";
import { useLibraryStore } from "@/store/useLibraryStore";
import { usePlayerStore } from "@/store/usePlayerStore";

export default function LikedPage() {
  const liked = useLibraryStore((s) => s.liked);
  const play = usePlayerStore((s) => s.play);
  return (
    <div>
      <div className="mb-6 flex items-end gap-5">
        <div className="flex h-36 w-36 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-600 to-cyan-500 shadow-glow">
          <Heart className="h-14 w-14 fill-white text-white" />
        </div>
        <div>
          <div className="text-xs uppercase tracking-widest text-white/45">Playlist</div>
          <h1 className="text-4xl font-semibold">Liked songs</h1>
          <p className="mt-2 text-sm text-white/50">{liked.length} tracks</p>
          {liked[0] && (
            <button
              type="button"
              onClick={() => play(liked[0], liked)}
              className="mt-4 rounded-full bg-white px-5 py-2 text-sm font-medium text-black"
            >
              Play
            </button>
          )}
        </div>
      </div>
      {liked.length === 0 ? (
        <p className="text-white/45">Heart a track to save it here.</p>
      ) : (
        liked.map((t, i) => <TrackRow key={t.videoId} track={t} index={i} queue={liked} />)
      )}
    </div>
  );
}
