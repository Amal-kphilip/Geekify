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
        <h1 className="text-2xl font-bold md:text-3xl">Your Library</h1>
        <button
          type="button"
          className="rounded-full bg-white px-4 py-2 text-sm font-bold text-black transition hover:scale-105"
          onClick={() => {
            const name = window.prompt("Playlist name", "My playlist");
            if (name) createPlaylist(name);
          }}
        >
          New playlist
        </button>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Link href="/liked" className="group overflow-hidden rounded-md bg-[#181818] transition hover:bg-[#282828]">
          <div className="flex aspect-square items-center justify-center bg-[#4b3fd6]">
            <Heart className="h-12 w-12 fill-white text-white" />
          </div>
          <div className="p-3">
            <div className="font-bold">Liked Songs</div>
            <div className="text-xs text-[#a7a7a7]">{liked.length} songs</div>
          </div>
        </Link>
        {playlists.map((p) => {
          const cover = artUrl(p.tracks[0]?.thumbnails, 300);
          return (
            <Link key={p.id} href={`/playlist/local/${p.id}`} className="overflow-hidden rounded-md bg-[#181818] transition hover:bg-[#282828]">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt="" className="aspect-square w-full object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center bg-white/5">
                  <ListMusic className="h-10 w-10 text-white/30" />
                </div>
              )}
              <div className="p-3">
                <div className="truncate font-bold">{p.name}</div>
                <div className="text-xs text-[#a7a7a7]">{p.tracks.length} songs</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
