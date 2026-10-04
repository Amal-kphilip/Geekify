"use client";

import Link from "next/link";
import { useLibraryStore } from "@/store/useLibraryStore";
import { artUrl } from "@/lib/types";
import { Disc3, Heart, ListMusic, Plus, X } from "lucide-react";
import { AccountMenu } from "@/components/auth/AccountMenu";

export default function LibraryPage() {
  const playlists = useLibraryStore((s) => s.playlists);
  const liked = useLibraryStore((s) => s.liked);
  const saved = useLibraryStore((s) => s.saved);
  const removeSaved = useLibraryStore((s) => s.removeSaved);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-[34px] font-semibold leading-tight tracking-tight md:text-4xl">Your Collection</h1>
        <div className="flex items-center gap-2.5">
          <div className="md:hidden">
            <AccountMenu />
          </div>
          <button
            type="button"
            className="flex h-11 items-center gap-2 rounded-full bg-lime px-5 text-sm font-semibold text-ink transition-transform active:scale-95"
            onClick={() => {
              const name = window.prompt("Playlist name", "My playlist");
              if (name) createPlaylist(name);
            }}
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
            <span className="hidden sm:inline">New playlist</span>
            <span className="sm:hidden">New</span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Link href="/liked" className="group">
          <div className="flex aspect-square items-center justify-center rounded-[28px] bg-lime">
            <Heart className="h-12 w-12 fill-ink text-ink" />
          </div>
          <div className="mt-3">
            <div className="text-[15px] font-semibold">Favourites</div>
            <div className="text-[13px] text-muted">{liked.length} songs</div>
          </div>
        </Link>
        {playlists.map((p) => {
          const cover = artUrl(p.tracks[0]?.thumbnails, 300);
          return (
            <Link key={p.id} href={`/playlist/local/${p.id}`} className="group">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cover} alt="" loading="lazy" decoding="async" className="aspect-square w-full rounded-[28px] object-cover" />
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-[28px] bg-elevated">
                  <ListMusic className="h-10 w-10 text-white/25" />
                </div>
              )}
              <div className="mt-3">
                <div className="truncate text-[15px] font-semibold">{p.name}</div>
                <div className="text-[13px] text-muted">{p.tracks.length} songs</div>
              </div>
            </Link>
          );
        })}
        {saved.map((c) => {
          const cover = artUrl(c.thumbnails, 300);
          const Icon = c.type === "album" ? Disc3 : ListMusic;
          return (
            <div key={`${c.type}-${c.id}`} className="group relative">
              <Link href={`/${c.type}/${encodeURIComponent(c.id)}`} className="block">
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt="" loading="lazy" decoding="async" className="aspect-square w-full rounded-[28px] object-cover" />
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded-[28px] bg-elevated">
                    <Icon className="h-10 w-10 text-white/25" />
                  </div>
                )}
                <div className="mt-3">
                  <div className="truncate text-[15px] font-semibold">{c.title}</div>
                  <div className="truncate text-[13px] text-muted">
                    {c.type === "album" ? "Album" : "Playlist"}
                    {c.subtitle ? ` \u00b7 ${c.subtitle}` : ""}
                  </div>
                </div>
              </Link>
              <button
                type="button"
                aria-label={`Remove ${c.title} from your library`}
                title="Remove from library"
                onClick={() => removeSaved(c.type, c.id)}
                className="absolute right-2.5 top-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white/90 transition-colors hover:bg-black/80 hover:text-red-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
