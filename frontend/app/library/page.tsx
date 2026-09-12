"use client";

import Link from "next/link";
import { useLibraryStore } from "@/store/useLibraryStore";
import { artUrl } from "@/lib/types";
import { Heart, ListMusic } from "lucide-react";

export default function LibraryPage() {
  const playlists = useLibraryStore((s) => s.playlists);
  const liked = useLibraryStore((s) => s.liked);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-semibold">Your library</h1>
        <button
          type="button"
          className="rounded-full bg-white px-4 py-2 text-sm font-medium text-black"
          onClick={() => {
            const name = window.prompt("Playlist name", "My playlist");
            if (name) createPlaylist(name);
          }}
        >
          New playlist
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Link href="/liked" className="glass group overflow-hidden rounded-2xl">
          <div className="flex aspect-square items-center justify-center bg-gradient-to-br from-fuchsia-600 to-cyan-500">
            <Heart className="h-12 w-12 fill-white text-white" />
          </div>
          <div className="p-3">
            <div className="font-medium">Liked songs</div>
            <div className="text-xs text-white/50">{liked.length} tracks</div>
          </div>
        </Link>
        {playlists.map((p) => {
          const cover = artUrl(p.tracks[0]?.thumbnails, 300);
          return (
            <Link key={p.id} href={`/playlist/local/${p.id}`} className="glass overflow-hidden rounded-2xl">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt="" className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center bg-white/5">
                  <ListMusic className="h-10 w-10 text-white/30" />
                </div>
              )}
              <div className="p-3">
                <div className="truncate font-medium">{p.name}</div>
                <div className="text-xs text-white/50">{p.tracks.length} tracks</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
