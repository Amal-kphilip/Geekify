"use client";

import { useParams, useRouter } from "next/navigation";
import { TrackRow } from "@/components/ui/TrackRow";
import { useLibraryStore } from "@/store/useLibraryStore";
import { usePlayerStore } from "@/store/usePlayerStore";
import { artUrl } from "@/lib/types";

export default function LocalPlaylistPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const playlists = useLibraryStore((s) => s.playlists);
  const renamePlaylist = useLibraryStore((s) => s.renamePlaylist);
  const deletePlaylist = useLibraryStore((s) => s.deletePlaylist);
  const removeFromPlaylist = useLibraryStore((s) => s.removeFromPlaylist);
  const play = usePlayerStore((s) => s.play);
  const pl = playlists.find((p) => p.id === id);

  if (!pl) return <div className="text-white/50">Playlist not found.</div>;
  const cover = artUrl(pl.tracks[0]?.thumbnails, 400);

  return (
    <div>
      <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-48 w-48 rounded-2xl object-cover" />
        ) : (
          <div className="h-48 w-48 rounded-2xl bg-white/10" />
        )}
        <div>
          <div className="text-xs uppercase tracking-widest text-white/45">Playlist</div>
          <h1 className="text-4xl font-semibold">{pl.name}</h1>
          <p className="mt-2 text-sm text-white/50">{pl.tracks.length} tracks · saved on this device</p>
          <div className="mt-4 flex gap-2">
            {pl.tracks[0] && (
              <button
                type="button"
                onClick={() => play(pl.tracks[0], pl.tracks)}
                className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black"
              >
                Play
              </button>
            )}
            <button
              type="button"
              className="rounded-full bg-white/10 px-4 py-2 text-sm"
              onClick={() => {
                const name = window.prompt("Rename playlist", pl.name);
                if (name) renamePlaylist(pl.id, name);
              }}
            >
              Rename
            </button>
            <button
              type="button"
              className="rounded-full bg-white/10 px-4 py-2 text-sm text-red-300"
              onClick={() => {
                if (window.confirm("Delete this playlist?")) {
                  deletePlaylist(pl.id);
                  router.push("/library");
                }
              }}
            >
              Delete
            </button>
          </div>
        </div>
      </div>
      {pl.tracks.map((t, i) => (
        <div key={t.videoId} className="group">
          <TrackRow track={t} index={i} queue={pl.tracks} />
          <button
            type="button"
            className="ml-16 text-xs text-white/30 hover:text-white"
            onClick={() => removeFromPlaylist(pl.id, t.videoId)}
          >
            Remove
          </button>
        </div>
      ))}
      {!pl.tracks.length && <p className="text-white/45">Add tracks from search using the heart or play them into your library.</p>}
    </div>
  );
}
