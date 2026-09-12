"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import type { SearchResponse } from "@/lib/types";
import { TrackRow } from "@/components/ui/TrackRow";
import { GlassCard } from "@/components/ui/GlassCard";
import { ShelfRow } from "@/components/ui/ShelfRow";
import { useRouter } from "next/navigation";

const TABS = ["all", "song", "album", "artist", "playlist"] as const;
const QUICK_TAGS = [
  "Top Hits",
  "Pop",
  "Hip-Hop",
  "Lo-Fi",
  "Synthwave",
  "Electronic",
  "Rock",
  "Bollywood",
  "R&B",
  "Indie",
  "Chill Beats",
];

function SearchInner() {
  const params = useSearchParams();
  const router = useRouter();
  const initialQ = params.get("q") || "";
  const [searchInput, setSearchInput] = useState(initialQ);
  const [type, setType] = useState<(typeof TABS)[number]>("all");
  const [data, setData] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSearchInput(params.get("q") || "");
  }, [params]);

  const activeQuery = searchInput.trim();

  useEffect(() => {
    if (!activeQuery) {
      setData(null);
      setLoading(false);
      return;
    }
    const handle = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      api
        .search(activeQuery, type === "all" ? undefined : type)
        .then((res) => {
          setData(res);
          setError(null);
        })
        .catch((e: Error) => setError(e.message || "Search failed"))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [activeQuery, type]);

  const handleQueryChange = (val: string) => {
    setSearchInput(val);
    if (val.trim()) {
      router.replace(`/search?q=${encodeURIComponent(val.trim())}`);
    } else {
      router.replace("/search");
    }
  };

  const empty = useMemo(() => {
    if (!data || loading) return false;
    return (
      !data.songs.length &&
      !data.albums.length &&
      !data.artists.length &&
      !data.playlists.length &&
      !data.shelves.length
    );
  }, [data, loading]);

  const open = (kind: string, id: string) => {
    if (kind === "artist") router.push(`/artist/${encodeURIComponent(id)}`);
    if (kind === "album") router.push(`/album/${encodeURIComponent(id)}`);
    if (kind === "playlist") router.push(`/playlist/${encodeURIComponent(id)}`);
  };

  return (
    <div className="pb-8">
      {/* Search Header and Main Search Bar */}
      <div className="mb-6">
        <h1 className="mb-4 text-3xl font-bold tracking-tight">Search</h1>
        <div className="relative max-w-2xl">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search songs, artists, albums, or playlists..."
            className="w-full rounded-2xl bg-white/10 px-5 py-3.5 text-base font-medium text-white placeholder:text-white/40 outline-none ring-1 ring-white/15 transition focus:bg-white/15 focus:ring-2 focus:ring-cyan-400/50"
            autoFocus={!initialQ}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => handleQueryChange("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/60 hover:bg-white/20 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Quick Suggestions Chips */}
      {!activeQuery && (
        <div className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-white/50">
            Explore Genres & Vibes
          </h2>
          <div className="flex flex-wrap gap-2">
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleQueryChange(tag)}
                className="cursor-pointer rounded-xl glass px-4 py-2 text-sm font-medium text-white/80 transition hover:scale-105 hover:bg-white/15 hover:text-white"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category Tabs */}
      {activeQuery && (
        <div className="mb-6 flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium capitalize transition ${
                type === t
                  ? "bg-white text-black shadow-lg"
                  : "bg-white/10 text-white/70 hover:bg-white/15 hover:text-white"
              }`}
            >
              {t === "song" ? "songs" : t}
            </button>
          ))}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="space-y-3">
          <div className="h-5 w-32 animate-pulse rounded bg-white/10" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      )}

      {/* Error Message */}
      {error && !loading && (
        <div className="glass rounded-2xl p-4 text-sm text-amber-200">
          {error}
        </div>
      )}

      {/* Empty State */}
      {empty && (
        <div className="glass rounded-2xl p-8 text-center text-white/50">
          No music found for &ldquo;{activeQuery}&rdquo;. Try another search.
        </div>
      )}

      {/* Search Results */}
      {!loading && data && (
        <div className="space-y-8">
          {data.songs.length > 0 && (type === "all" || type === "song") && (
            <section>
              <h2 className="mb-3 text-lg font-semibold tracking-tight">Songs</h2>
              <div className="space-y-1">
                {data.songs.map((t, idx) => (
                  <TrackRow key={t.videoId + idx} track={t} queue={data.songs} />
                ))}
              </div>
            </section>
          )}

          {data.artists.length > 0 && (type === "all" || type === "artist") && (
            <section>
              <h2 className="mb-3 text-lg font-semibold tracking-tight">Artists</h2>
              <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-2">
                {data.artists.map((c) => (
                  <GlassCard
                    key={c.id}
                    item={c}
                    onClick={() => open("artist", c.browseId || c.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {data.albums.length > 0 && (type === "all" || type === "album") && (
            <section>
              <h2 className="mb-3 text-lg font-semibold tracking-tight">Albums</h2>
              <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-2">
                {data.albums.map((c) => (
                  <GlassCard
                    key={c.id}
                    item={c}
                    onClick={() => open("album", c.browseId || c.playlistId || c.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {data.playlists.length > 0 && (type === "all" || type === "playlist") && (
            <section>
              <h2 className="mb-3 text-lg font-semibold tracking-tight">Playlists</h2>
              <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-2">
                {data.playlists.map((c) => (
                  <GlassCard
                    key={c.id}
                    item={c}
                    onClick={() => open("playlist", c.playlistId || c.browseId || c.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {type === "all" &&
            data.shelves
              .filter(
                (s) =>
                  !["songs", "artists", "albums", "playlists", "community playlists"].includes(
                    s.title.toLowerCase()
                  )
              )
              .map((s, i) => <ShelfRow key={s.title + i} shelf={s} />)}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-white/5" />}>
      <SearchInner />
    </Suspense>
  );
}
