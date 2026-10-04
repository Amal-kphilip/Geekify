"use client";

import { useParams, useRouter } from "next/navigation";
import { TrackRow } from "@/components/ui/TrackRow";
import { useLibraryStore } from "@/store/useLibraryStore";
import { usePlayerStore } from "@/store/usePlayerStore";
import { artUrl } from "@/lib/types";
import { CollectionHeader, PlayButton } from "@/components/ui/CollectionHeader";

export default function LocalPlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const playlists = useLibraryStore((s) => s.playlists);
  const renamePlaylist = useLibraryStore((s) => s.renamePlaylist);
  const deletePlaylist = useLibraryStore((s) => s.deletePlaylist);
  const removeFromPlaylist = useLibraryStore((s) => s.removeFromPlaylist);
  const play = usePlayerStore((s) => s.play);
  const pl = playlists.find((p) => p.id === id);

  if (!pl) return <div className="text-muted">Playlist not found.</div>;
  const cover = artUrl(pl.tracks[0]?.thumbnails, 400);
  const chipBtn =
    "h-12 rounded-full bg-chip px-6 text-[15px] font-medium transition-colors hover:bg-white/15 active:scale-95";

  return (
    <div>
      <CollectionHeader cover={cover} kind="Playlist" title={pl.name} meta={`${pl.tracks.length} tracks \u00b7 saved on this device`}>
        {pl.tracks[0] && <PlayButton onClick={() => play(pl.tracks[0], pl.tracks)} />}
        <button
          type="button"
          className={chipBtn}
          onClick={() => {
            const name = window.prompt("Rename playlist", pl.name);
            if (name) renamePlaylist(pl.id, name);
          }}
        >
          Rename
        </button>
        <button
          type="button"
          className={`${chipBtn} text-rose-300`}
          onClick={() => {
            if (window.confirm("Delete this playlist?")) {
              deletePlaylist(pl.id);
              router.push("/library");
            }
          }}
        >
          Delete
        </button>
      </CollectionHeader>
      {pl.tracks.map((t, i) => (
        <div key={t.videoId} className="group">
          <TrackRow track={t} index={i} queue={pl.tracks} />
          <button
            type="button"
            className="mb-1 ml-[72px] text-xs text-muted transition-colors hover:text-rose-300"
            onClick={() => removeFromPlaylist(pl.id, t.videoId)}
          >
            Remove
          </button>
        </div>
      ))}
      {!pl.tracks.length && <p className="text-muted">Use the playlist button on any track to add it here.</p>}
    </div>
  );
}
