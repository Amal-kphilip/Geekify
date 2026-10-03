"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Heart, Library, ListMusic, Plus } from "lucide-react";
import { artUrl } from "@/lib/types";
import { useLibraryStore } from "@/store/useLibraryStore";

/** Desktop "Your Library" panel. */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const playlists = useLibraryStore((s) => s.playlists);
  const liked = useLibraryStore((s) => s.liked);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);

  const row = (active: boolean) =>
    `flex items-center gap-3 rounded-md p-2 transition ${active ? "bg-[#2a2a2a]" : "hover:bg-[#1f1f1f]"}`;

  return (
    <aside className="hidden h-full w-[300px] shrink-0 flex-col rounded-lg bg-panel md:flex lg:w-[340px]">
      <div className="flex items-center justify-between px-4 pb-2 pt-4">
        <Link href="/library" className="flex items-center gap-2 font-semibold text-[#b3b3b3] transition hover:text-white">
          <Library className="h-6 w-6" />
          Your Library
        </Link>
        <button
          type="button"
          title="Create playlist"
          aria-label="Create playlist"
          className="rounded-full p-2 text-[#b3b3b3] transition hover:bg-[#1f1f1f] hover:text-white"
          onClick={() => {
            const name = window.prompt("Playlist name", "My playlist");
            if (!name) return;
            const pl = createPlaylist(name);
            router.push(`/playlist/local/${pl.id}`);
          }}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
        <Link href="/liked" className={row(pathname === "/liked")}>
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#4b3fd6]">
            <Heart className="h-5 w-5 fill-white text-white" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[15px] font-medium">Liked Songs</div>
            <div className="truncate text-sm text-[#a7a7a7]">Playlist &middot; {liked.length} songs</div>
          </div>
        </Link>
        {playlists.map((p) => {
          const cover = artUrl(p.tracks[0]?.thumbnails, 80);
          return (
            <Link key={p.id} href={`/playlist/local/${p.id}`} className={row(pathname === `/playlist/local/${p.id}`)}>
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt="" className="h-12 w-12 shrink-0 rounded-md object-cover" />
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-[#282828]">
                  <ListMusic className="h-5 w-5 text-[#a7a7a7]" />
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-[15px] font-medium">{p.name}</div>
                <div className="truncate text-sm text-[#a7a7a7]">Playlist &middot; {p.tracks.length} songs</div>
              </div>
            </Link>
          );
        })}
        {!playlists.length && (
          <div className="m-1 rounded-lg bg-[#1f1f1f] p-4">
            <div className="font-semibold">Create your first playlist</div>
            <p className="mt-1 text-sm text-[#a7a7a7]">It&apos;s easy, we&apos;ll help you.</p>
          </div>
        )}
      </div>
    </aside>
  );
}
