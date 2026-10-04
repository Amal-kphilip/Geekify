"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Heart, Play, RefreshCw, Search, Sparkles, X } from "lucide-react";
import { AccountMenu } from "@/components/auth/AccountMenu";
import { ShelfRow, ShelfSkeleton } from "@/components/ui/ShelfRow";
import { TrackRow } from "@/components/ui/TrackRow";
import type { Card, Mix, Shelf, Track } from "@/lib/types";
import { artUrl, isTrack, toTrack } from "@/lib/types";
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

const MIX_COLORS = ["bg-lilac", "bg-lime", "bg-peach", "bg-sky", "bg-rose"];

function applyFilter(shelf: Shelf, filter: FilterId): Shelf | null {
  if (filter === "all") return shelf;
  if (filter === "song") {
    // Songs can come as full Tracks or as "song" cards; keep both, de-duplicated.
    const seen = new Set<string>();
    const songs: Track[] = [];
    for (const item of shelf.items) {
      const t = toTrack(item);
      if (t && !seen.has(t.videoId)) {
        seen.add(t.videoId);
        songs.push(t);
      }
    }
    return songs.length ? { ...shelf, items: songs } : null;
  }
  const items = shelf.items.filter((i) => !isTrack(i) && (i as Card).type === filter);
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
      className={`flex h-[204px] w-[300px] shrink-0 flex-col justify-between rounded-[28px] p-5 text-ink ${
        MIX_COLORS[index % MIX_COLORS.length]
      } ${open ? "ring-2 ring-white" : ""}`}
    >
      <div className="flex gap-3">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <div className="line-clamp-2 text-[22px] font-semibold leading-tight tracking-tight">{mix.title}</div>
          <div className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-ink/70">
            {mix.subtitle} &middot; {mix.tracks.length} songs
          </div>
        </button>
        <div className="grid h-[92px] w-[92px] shrink-0 grid-cols-2 gap-1 overflow-hidden rounded-2xl bg-ink/10">
          {[0, 1, 2, 3].map((i) =>
            arts[i] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={arts[i]} alt="" loading="lazy" decoding="async" className="aspect-square h-full w-full object-cover" />
            ) : (
              <div key={i} className="aspect-square bg-ink/10" />
            )
          )}
        </div>
      </div>
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          aria-label={`Play ${mix.title}`}
          onClick={() => play(mix.tracks[0], mix.tracks)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-white transition-transform active:scale-90"
        >
          <Play className="h-[18px] w-[18px] fill-white" />
        </button>
        <button
          type="button"
          onClick={onOpen}
          className="h-10 rounded-full bg-ink/10 px-4 text-sm font-semibold transition-colors hover:bg-ink/20"
        >
          {open ? "Hide songs" : "View songs"}
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

  // The "Songs" view isn't only the YouTube feed: your recent plays and personal mixes are songs too,
  // so it still has content when the feed itself happens to be light on single tracks.
  const personalSongShelves = useMemo<Shelf[]>(() => {
    if (filter !== "song") return [];
    const out: Shelf[] = [];
    if (jumpBack) out.push(jumpBack);
    for (const m of mixes) if (m.tracks.length) out.push({ title: m.title, items: m.tracks.slice(0, 24) });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, mixes, recent]);

  const nothingToShow = !!data && filter !== "all" && shelves.length === 0 && personalSongShelves.length === 0;

  const chip = (active: boolean) =>
    `shrink-0 rounded-full px-5 py-2.5 text-[15px] font-medium transition-colors ${
      active ? "bg-lime text-ink" : "bg-chip text-white/85 hover:bg-white/15"
    }`;
  const circleBtn =
    "flex h-11 w-11 items-center justify-center rounded-full bg-chip text-white transition-colors hover:bg-white/15 active:scale-95";

  return (
    <div className="relative">
      {/* Soft colour bloom behind the greeting (static gradient: no blur filter, nothing to repaint) */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 -top-24 h-[320px] w-[320px]"
        style={{ background: "radial-gradient(closest-side, rgba(212,162,246,0.28), rgba(212,162,246,0))" }}
      />

      <div className="relative">
        {/* Mobile top row: account on the left, quick actions on the right */}
        <div className="mb-5 flex items-center justify-between md:hidden">
          <AccountMenu align="left" />
          <div className="flex items-center gap-2.5">
            <Link href="/search" aria-label="Search" className={circleBtn}>
              <Search className="h-5 w-5" />
            </Link>
            <Link href="/liked" aria-label="Favourites" className={circleBtn}>
              <Heart className="h-5 w-5" />
            </Link>
          </div>
        </div>

        {/* Greeting */}
        <div className="mb-5 md:mb-6">
          <h1 className="break-words text-[34px] font-semibold leading-tight tracking-tight md:text-4xl">
            {hello}
            {firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-1 text-[15px] text-muted">Your music, tuned to your taste.</p>
        </div>

        {/* View switcher + refresh */}
        <div className="no-scrollbar -mx-5 mb-8 flex items-center gap-2.5 overflow-x-auto px-5 md:mx-0 md:px-0">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)} aria-pressed={filter === f.id} className={chip(filter === f.id)}>
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
            className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-chip text-muted transition-colors hover:text-white disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading || mixLoading ? "spinner" : ""}`} />
          </button>
        </div>

        {filter === "all" && (
          <>
            {/* Personalised mixes */}
            {hasSignals ? (
              <section className="mb-9">
                <h2 className="mb-3.5 text-[22px] font-semibold tracking-tight">Your mixes</h2>
                {mixes.length > 0 ? (
                  <div className="no-scrollbar h-scroll flex gap-3.5 pb-1">
                    {mixes.map((m, i) => (
                      <MixCard key={m.id} mix={m} index={i} open={openMix === m.id} onOpen={() => setOpenMix(openMix === m.id ? null : m.id)} />
                    ))}
                  </div>
                ) : mixLoading ? (
                  <div className="flex gap-3.5 overflow-hidden">
                    {[0, 1, 2].map((i) => (
                      <div key={i} className="h-[204px] w-[300px] shrink-0 animate-pulse rounded-[28px] bg-elevated" />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted">{mixError ?? "Play or favourite a few more songs and your mixes will appear here."}</p>
                )}

                {activeMix && (
                  <div className="mt-4 rounded-[28px] bg-elevated p-4">
                    <div className="mb-2 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-lg font-semibold">{activeMix.title}</div>
                        <div className="truncate text-xs text-muted">{activeMix.subtitle}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => play(activeMix.tracks[0], activeMix.tracks)}
                        className="flex h-11 items-center gap-2 rounded-full bg-lime px-5 text-sm font-semibold text-ink transition-transform active:scale-95"
                      >
                        <Play className="h-4 w-4 fill-ink" />
                        Play all
                      </button>
                      <button type="button" aria-label="Close mix" onClick={() => setOpenMix(null)} className="flex h-11 w-11 items-center justify-center rounded-full bg-chip text-muted transition-colors hover:text-white">
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
              <section className="mb-9 rounded-[28px] bg-lilac p-6 text-ink">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink text-lilac">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl font-semibold tracking-tight">Mixes made just for you</h2>
                    <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink/70">
                      Play a few songs or tap the heart on the ones you love. Geekify learns your taste and builds
                      personal mixes here{status === "guest" ? ", and an account keeps them on every device." : "."}
                    </p>
                    {status === "guest" && (
                      <button
                        type="button"
                        onClick={() => setAuthOpen(true)}
                        className="mt-4 h-11 rounded-full bg-ink px-6 text-sm font-semibold text-white transition-transform active:scale-95"
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
          <div className="mb-6 rounded-3xl bg-elevated p-5 text-sm text-amber-200" role="alert">
            {error}
            <div className="mt-3">
              <button type="button" onClick={() => void load(true)} className="h-10 rounded-full bg-lime px-5 text-sm font-semibold text-ink">
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

        {personalSongShelves.map((s, i) => (
          <ShelfRow key={`mine-${s.title}-${i}`} shelf={s} />
        ))}

        {shelves.map((s, i) => (
          <ShelfRow key={`${s.title}-${i}`} shelf={s} />
        ))}

        {nothingToShow && (
          <div className="rounded-3xl bg-elevated p-5 text-sm text-muted">
            <p>Nothing in the feed matches this view right now.</p>
            <div className="mt-3 flex gap-2.5">
              <button type="button" onClick={() => setFilter("all")} className="h-10 rounded-full bg-lime px-5 text-sm font-semibold text-ink">
                Show everything
              </button>
              <button type="button" onClick={() => void load(true)} className="h-10 rounded-full bg-chip px-5 text-sm font-semibold text-white">
                Refresh
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
