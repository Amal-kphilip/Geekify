"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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

  const inputRef = useRef<HTMLInputElement>(null);

  // Sync from the URL (e.g. top bar search) unless the user is typing here.
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setSearchInput(params.get("q") || "");
  }, [params]);

  const activeQuery = searchInput.trim();

  useEffect(() => {
    if (!activeQuery) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      api
        .search(activeQuery, type === "all" ? undefined : type)
        .then((res) => {
          if (cancelled) return;
          setData(res);
          setError(null);
        })
        .catch((e: Error) => {
          if (!cancelled) setError(e.message || "Search failed");
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
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
        <h1 className="mb-4 text-[34px] font-semibold leading-tight tracking-tight md:text-4xl">Search</h1>
        <div className="relative max-w-2xl">
          <input
            ref={inputRef}
            type="text"
            value={searchInput}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder="Search songs, artists, albums, or playlists..."
            className="w-full rounded-full bg-chip px-6 py-4 text-base font-medium text-white outline-none ring-1 ring-transparent transition-shadow placeholder:text-muted focus:ring-2 focus:ring-lime"
            autoFocus={!initialQ}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => handleQueryChange("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 px-3 py-1 text-xs text-white/70 transition-colors hover:bg-white/20 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Quick Suggestions Chips */}
      {!activeQuery && (
        <div className="mb-8">
          <h2 className="mb-3.5 text-[22px] font-semibold tracking-tight">
            Explore genres &amp; vibes
          </h2>
          <div className="flex flex-wrap gap-2">
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleQueryChange(tag)}
                className="rounded-full bg-chip px-5 py-2.5 text-[15px] font-medium text-white transition-colors hover:bg-lime hover:text-ink"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category Tabs */}
      {activeQuery && (
        <div className="no-scrollbar mb-6 flex gap-2.5 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`shrink-0 rounded-full px-5 py-2.5 text-[15px] font-medium capitalize transition-colors ${
                type === t ? "bg-lime text-ink" : "bg-chip text-white/85 hover:bg-white/15"
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
          <div className="h-5 w-32 animate-pulse rounded-full bg-chip" />
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-3xl bg-elevated" />
          ))}
        </div>
      )}

      {/* Error Message */}
      {error && !loading && (
        <div className="rounded-3xl bg-elevated p-5 text-sm text-amber-200">
          {error}
        </div>
      )}

      {/* Empty State */}
      {empty && (
        <div className="rounded-3xl bg-elevated p-8 text-center text-muted">
          No music found for &ldquo;{activeQuery}&rdquo;. Try another search.
        </div>
      )}

      {/* Search Results */}
      {!loading && data && (
        <div className="space-y-8">
          {data.songs.length > 0 && (type === "all" || type === "song") && (
            <section>
              <h2 className="mb-3.5 text-[22px] font-semibold tracking-tight">Songs</h2>
              <div className="space-y-1">
                {data.songs.map((t, idx) => (
                  <TrackRow key={t.videoId + idx} track={t} queue={data.songs} />
                ))}
              </div>
            </section>
          )}

          {data.artists.length > 0 && (type === "all" || type === "artist") && (
            <section>
              <h2 className="mb-3.5 text-[22px] font-semibold tracking-tight">Artists</h2>
              <div className="no-scrollbar scroll-area flex gap-3.5 overflow-x-auto pb-1">
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
              <h2 className="mb-3.5 text-[22px] font-semibold tracking-tight">Albums</h2>
              <div className="no-scrollbar scroll-area flex gap-3.5 overflow-x-auto pb-1">
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
              <h2 className="mb-3.5 text-[22px] font-semibold tracking-tight">Playlists</h2>
              <div className="no-scrollbar scroll-area flex gap-3.5 overflow-x-auto pb-1">
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
    <Suspense fallback={<div className="h-40 animate-pulse rounded-3xl bg-elevated" />}>
      <SearchInner />
    </Suspense>
  );
}
