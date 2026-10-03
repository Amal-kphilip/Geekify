"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, ListMusic, RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import type { Card, Shelf, Track } from "@/lib/types";
import { artUrl, isTrack } from "@/lib/types";
import { ShelfRow, ShelfSkeleton } from "@/components/ui/ShelfRow";
import { useOpenCard } from "@/components/ui/useOpenCard";
import { useHomeStore } from "@/store/useHomeStore";
import { useHistoryStore } from "@/store/useHistoryStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { usePlayerStore } from "@/store/usePlayerStore";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "song", label: "Songs" },
  { id: "album", label: "Albums" },
  { id: "playlist", label: "Playlists" },
  { id: "artist", label: "Artists" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

type QuickItem = { key: string; title: string; thumb?: string; kind: "liked" | "playlist" | "art"; onClick: () => void };

function applyFilter(shelf: Shelf, filter: FilterId): Shelf | null {
  if (filter === "all") return shelf;
  const items = shelf.items.filter((i) =>
    filter === "song" ? isTrack(i) : !isTrack(i) && (i as Card).type === filter
  );
  return items.length ? { ...shelf, items } : null;
}

export default function HomePage() {
  const router = useRouter();
  const openCard = useOpenCard();
  const play = usePlayerStore((s) => s.play);
  const { data, error, loading, load } = useHomeStore();
  const recent = useHistoryStore((s) => s.recent);
  const liked = useLibraryStore((s) => s.liked);
  const playlists = useLibraryStore((s) => s.playlists);
  const [filter, setFilter] = useState<FilterId>("all");
  const [because, setBecause] = useState<Shelf[]>([]);

  // Kick off (or refresh, if older than 5 min) the feed. The app shell already started it at page load.
  useEffect(() => {
    void load();
  }, [load]);

  // "Because you listened to ..." - recommendations seeded from the last two different artists played.
  const seeds = useMemo(() => {
    const out: Track[] = [];
    for (const t of recent) {
      if (out.length >= 2) break;
      if (!out.some((o) => o.artist === t.artist)) out.push(t);
    }
    return out;
  }, [recent]);
  const seedKey = seeds.map((s) => s.videoId).join(",");

  useEffect(() => {
    if (!seeds.length) {
      setBecause([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      seeds.map((t) =>
        api
          .related(t.videoId)
          .then((tracks): Shelf | null =>
            tracks.length ? { title: `Because you listened to ${t.title}`, items: tracks.slice(0, 20) } : null
          )
          .catch(() => null)
      )
    ).then((res) => {
      if (!cancelled) setBecause(res.filter((r): r is Shelf => !!r));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey]);

  // Quick-access grid: Liked Songs, your playlists, then what you played recently.
  const quick = useMemo(() => {
    const items: QuickItem[] = [
      { key: "liked", title: "Liked Songs", kind: "liked", onClick: () => router.push("/liked") },
    ];
    playlists.slice(0, 3).forEach((p) =>
      items.push({
        key: `pl-${p.id}`,
        title: p.name,
        kind: "playlist",
        thumb: artUrl(p.tracks[0]?.thumbnails, 80),
        onClick: () => router.push(`/playlist/local/${p.id}`),
      })
    );
    for (const t of recent) {
      if (items.length >= 8) break;
      items.push({ key: `rc-${t.videoId}`, title: t.title, kind: "art", thumb: artUrl(t.thumbnails, 80), onClick: () => play(t, recent) });
    }
    // New listener: fill the grid with cards from the feed.
    if (items.length < 8 && data) {
      for (const shelf of data.shelves) {
        for (const it of shelf.items) {
          if (items.length >= 8) break;
          if (isTrack(it)) continue;
          const c = it as Card;
          items.push({ key: `fd-${c.type}-${c.id}`, title: c.title, kind: "art", thumb: artUrl(c.thumbnails, 80), onClick: () => openCard(c) });
        }
        if (items.length >= 8) break;
      }
    }
    return items.slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlists, recent, data, liked.length]);

  const shelves = useMemo(() => {
    const all: Shelf[] = [...because, ...(data?.shelves ?? [])];
    return all.map((s) => applyFilter(s, filter)).filter((s): s is Shelf => !!s);
  }, [because, data, filter]);

  return (
    <div className="-mx-4 -mt-4 md:mx-0 md:mt-0">
      {/* Filter chips (+ avatar on mobile) */}
      <div className="no-scrollbar sticky top-0 z-10 -mb-1 flex items-center gap-2 overflow-x-auto bg-panel px-4 py-3 md:static md:px-0 md:pt-0">
        <Link
          href="/library"
          aria-label="Your library"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-black md:hidden"
        >
          G
        </Link>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
              filter === f.id ? "bg-brand text-black" : "bg-[#2a2a2a] text-white hover:bg-[#333]"
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={loading}
          aria-label="Refresh home"
          title="Refresh"
          className="ml-auto shrink-0 rounded-full p-2 text-[#b3b3b3] transition hover:text-white disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "spinner" : ""}`} />
        </button>
      </div>

      <div className="px-4 pb-4 pt-2 md:px-0">
        {filter === "all" && (
          <div className="mb-8 grid grid-cols-2 gap-2 lg:grid-cols-4">
            {quick.map((q) => (
              <button
                key={q.key}
                type="button"
                onClick={q.onClick}
                className="group flex h-14 items-center gap-3 overflow-hidden rounded bg-white/10 text-left transition hover:bg-white/20 md:h-16"
              >
                {q.kind === "liked" ? (
                  <span className="flex h-full w-14 shrink-0 items-center justify-center bg-[#4b3fd6] md:w-16">
                    <Heart className="h-5 w-5 fill-white text-white" />
                  </span>
                ) : q.thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={q.thumb} alt="" className="h-full w-14 shrink-0 object-cover md:w-16" />
                ) : (
                  <span className="flex h-full w-14 shrink-0 items-center justify-center bg-[#282828] md:w-16">
                    <ListMusic className="h-5 w-5 text-[#a7a7a7]" />
                  </span>
                )}
                <span className="line-clamp-2 pr-2 text-sm font-bold">{q.title}</span>
              </button>
            ))}
          </div>
        )}

        {error && !data && (
          <div className="mb-6 rounded-lg bg-[#1f1f1f] p-4 text-sm text-amber-200" role="alert">
            {error}
            <div className="mt-3">
              <button
                type="button"
                onClick={() => void load(true)}
                className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-black"
              >
                Try again
              </button>
            </div>
          </div>
        )}

        {!data && !error && (
          <>
            <ShelfSkeleton />
            <ShelfSkeleton />
          </>
        )}

        {shelves.map((s, i) => (
          <ShelfRow key={`${s.title}-${i}`} shelf={s} />
        ))}

        {data && !shelves.length && (
          <p className="text-[#a7a7a7]">Nothing to show for this filter. Try another one.</p>
        )}
      </div>
    </div>
  );
}
