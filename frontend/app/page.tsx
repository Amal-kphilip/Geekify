"use client";

import { useEffect, useMemo, useState } from "react";
import { Play, RefreshCw, Sparkles, X } from "lucide-react";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { ShelfRow, ShelfSkeleton } from "@/components/ui/ShelfRow";
import { TrackRow } from "@/components/ui/TrackRow";
import type { Card, Mix, Shelf } from "@/lib/types";
import { artUrl, isTrack } from "@/lib/types";
import { useAuthStore } from "@/store/useAuthStore";
import { useHistoryStore } from "@/store/useHistoryStore";
import { useHomeStore } from "@/store/useHomeStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useRecommendStore } from "@/store/useRecommendStore";
import { useUiStore } from "@/store/useUiStore";

const FILTERS = [
  { id: "all", label: "Everything" },
  { id: "song", label: "Songs" },
  { id: "album", label: "Albums" },
  { id: "playlist", label: "Playlists" },
  { id: "artist", label: "Artists" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

const TINTS = [
  "from-violet-500/35 to-fuchsia-500/10",
  "from-teal-400/30 to-sky-500/10",
  "from-amber-400/25 to-rose-500/10",
  "from-indigo-400/30 to-cyan-400/10",
  "from-pink-400/30 to-purple-500/10",
];

function applyFilter(shelf: Shelf, filter: FilterId): Shelf | null {
  if (filter === "all") return shelf;
  const items = shelf.items.filter((i) =>
    filter === "song" ? isTrack(i) : !isTrack(i) && (i as Card).type === filter
  );
  return items.length ? { ...shelf, items } : null;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function MixCard({ mix, index, open, onOpen }: { mix: Mix; index: number; open: boolean; onOpen: () => void }) {
  const play = usePlayerStore((s) => s.play);
  const arts = mix.tracks.slice(0, 4).map((t) => artUrl(t.thumbnails, 120));
  return (
    <div
      className={`group w-[212px] shrink-0 rounded-3xl bg-gradient-to-br ${TINTS[index % TINTS.length]} p-3 ring-1 transition ${
        open ? "ring-brand" : "ring-white/10 hover:ring-white/25"
      }`}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left" aria-expanded={open}>
        <div className="grid aspect-square grid-cols-2 gap-1 overflow-hidden rounded-2xl bg-black/20">
          {[0, 1, 2, 3].map((i) =>
            arts[i] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={arts[i]} alt="" loading="lazy" className="aspect-square h-full w-full object-cover" />
            ) : (
              <div key={i} className="aspect-square bg-white/5" />
            )
          )}
        </div>
      </button>
      <div className="mt-3 flex items-end gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <div className="truncate font-bold">{mix.title}</div>
          <div className="line-clamp-2 text-xs text-[#aeabcf]">
            {mix.subtitle} &middot; {mix.tracks.length} songs
          </div>
        </button>
        <button
          type="button"
          aria-label={`Play ${mix.title}`}
          onClick={() => play(mix.tracks[0], mix.tracks)}
          className="accent-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-black shadow-lg shadow-violet-500/30 transition hover:scale-105"
        >
          <Play className="h-4 w-4 fill-black" />
        </button>
      </div>
    </div>
  );
}

export default function HomePage() {
  const play = usePlayerStore((s) => s.play);
  const { data, error, loading, load } = useHomeStore();
  const recent = useHistoryStore((s) => s.recent);
  const liked = useLibraryStore((s) => s.liked);
  const status = useAuthStore((s) => s.status);
  const firstName = useAuthStore((s) => s.user?.name.split(" ")[0] ?? null);
  const setAuthOpen = useUiStore((s) => s.setAuthOpen);
  const { mixes, loading: mixLoading, error: mixError, load: loadMixes } = useRecommendStore();
  const [filter, setFilter] = useState<FilterId>("all");
  const [openMix, setOpenMix] = useState<string | null>(null);
  const [hello, setHello] = useState("Welcome");

  useEffect(() => setHello(greeting()), []);

  // Kick off (or refresh, if older than 5 min) the feed. The app shell already started it at page load.
  useEffect(() => {
    void load();
  }, [load]);

  // Build / refresh the personalised mixes when favourites change or the first plays arrive.
  const likedKey = liked
    .slice(0, 40)
    .map((t) => t.videoId)
    .join(",");
  const hasRecent = recent.length > 0;
  useEffect(() => {
    void loadMixes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [likedKey, hasRecent]);

  const hasSignals = liked.length > 0 || recent.length > 0;
  const activeMix = mixes.find((m) => m.id === openMix) ?? null;

  const shelves = useMemo(() => {
    const all: Shelf[] = [...(data?.shelves ?? [])];
    return all.map((s) => applyFilter(s, filter)).filter((s): s is Shelf => !!s);
  }, [data, filter]);

  const jumpBack: Shelf | null = recent.length
    ? { title: "Jump back in", items: recent.slice(0, 14) }
    : null;

  return (
    <div>
      {/* Header: greeting, view switcher, refresh (+ account on small screens) */}
      <div className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight md:text-3xl">
            <span className="accent-text">{hello}</span>
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-sm text-[#aeabcf]">Your music, tuned to your taste.</p>
        </div>
        <div className="md:hidden">
          <AccountMenu />
        </div>
        <div className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto rounded-2xl bg-white/[0.05] p-1 md:w-auto">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`shrink-0 rounded-xl px-3.5 py-1.5 text-sm font-medium transition ${
                filter === f.id ? "accent-bg text-black" : "text-[#aeabcf] hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              void load(true);
              void loadMixes(true);
            }}
            disabled={loading || mixLoading}
            aria-label="Refresh home"
            title="Refresh"
            className="ml-1 shrink-0 rounded-xl p-2 text-[#aeabcf] transition hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading || mixLoading ? "spinner" : ""}`} />
          </button>
        </div>
      </div>

      {filter === "all" && (
        <>
          {/* Personalised mixes */}
          {hasSignals ? (
            <section className="mb-8">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-brand" />
                <h2 className="text-xl font-bold tracking-tight md:text-2xl">Your mixes</h2>
              </div>
              {mixes.length > 0 ? (
                <div className="no-scrollbar -mx-1 flex gap-4 overflow-x-auto px-1 pb-2">
                  {mixes.map((m, i) => (
                    <MixCard key={m.id} mix={m} index={i} open={openMix === m.id} onOpen={() => setOpenMix(openMix === m.id ? null : m.id)} />
                  ))}
                </div>
              ) : mixLoading ? (
                <div className="flex gap-4 overflow-hidden">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-[292px] w-[212px] shrink-0 animate-pulse rounded-3xl bg-white/[0.06]" />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[#9d9bbd]">
                  {mixError ?? "Play or favourite a few more songs and your mixes will appear here."}
                </p>
              )}

              {activeMix && (
                <div className="mt-4 rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10">
                  <div className="mb-2 flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-lg font-bold">{activeMix.title}</div>
                      <div className="text-xs text-[#aeabcf]">{activeMix.subtitle}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => play(activeMix.tracks[0], activeMix.tracks)}
                      className="accent-bg flex h-10 items-center gap-2 rounded-full px-5 text-sm font-bold text-black transition hover:brightness-110"
                    >
                      <Play className="h-4 w-4 fill-black" />
                      Play all
                    </button>
                    <button type="button" aria-label="Close mix" onClick={() => setOpenMix(null)} className="rounded-full p-2 text-[#aeabcf] hover:bg-white/10 hover:text-white">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div>
                    {activeMix.tracks.slice(0, 15).map((t, i) => (
                      <TrackRow key={t.videoId} track={t} index={i} queue={activeMix.tracks} />
                    ))}
                  </div>
                </div>
              )}
            </section>
          ) : (
            <section className="mb-8 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-500/25 via-transparent to-teal-400/15 p-6 ring-1 ring-white/10">
              <div className="flex items-start gap-4">
                <div className="accent-bg flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-black">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-bold">Mixes made just for you</h2>
                  <p className="mt-1 max-w-xl text-sm text-[#aeabcf]">
                    Play a few songs or tap the heart on the ones you love. Geekify learns your taste and builds
                    personal mixes here{status === "guest" ? ", and an account keeps them on every device." : "."}
                  </p>
                  {status === "guest" && (
                    <button
                      type="button"
                      onClick={() => setAuthOpen(true)}
                      className="mt-3 rounded-full bg-white px-5 py-2 text-sm font-semibold text-black transition hover:bg-white/90"
                    >
                      Create a free account
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {jumpBack && <ShelfRow shelf={jumpBack} />}
        </>
      )}

      {error && !data && (
        <div className="mb-6 rounded-2xl bg-white/[0.06] p-4 text-sm text-amber-200" role="alert">
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

      {data && !shelves.length && filter !== "all" && (
        <p className="text-[#9d9bbd]">Nothing to show for this view. Try another one.</p>
      )}
    </div>
  );
}
