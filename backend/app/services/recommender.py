"""Taste-based recommendation engine (no database, no ML libraries).

Signals come from the client: tracks the user liked and tracks they played recently.
Pipeline:
  1. Seed selection   - weight every signal (likes count more, newer counts more),
                        pick the strongest seeds with at most 2 per artist.
  2. Candidates       - ask YouTube Music's "radio" for tracks similar to each seed.
  3. Scoring          - rank-decayed score per seed; a track suggested by several seeds
                        (item-to-item co-occurrence) is boosted, as are artists the user
                        already gravitates to. Already-known tracks are dropped.
  4. Diversification  - greedy re-rank that penalises repeating an artist.
  5. Mixes            - "Made for you", "Fresh finds" (new artists) and "More like <artist>".
"""
from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field
from typing import Any, Callable, Iterable

LIKE_WEIGHT = 1.6
LIKE_DECAY = 0.96  # per position in the liked list (newest first)
RECENT_WEIGHT = 1.0
RECENT_DECAY = 0.90  # per position in the recent list (newest first)
RANK_DECAY = 0.12  # radio rank r contributes 1 / (1 + RANK_DECAY * r)
CO_OCCURRENCE_BOOST = 0.35
MAX_SEEDS = 6
MAX_SEEDS_PER_ARTIST = 2
MAX_TRACK_SECONDS = 15 * 60  # skip hour-long mixes / compilations


def akey(name: str | None) -> str:
    return (name or "").strip().lower()


@dataclass
class Signal:
    video_id: str
    artist: str = ""
    title: str = ""


@dataclass
class Candidate:
    track: Any
    score: float = 0.0
    sources: set[str] = field(default_factory=set)

    @property
    def artist(self) -> str:
        return akey(getattr(self.track, "artist", ""))


def seed_weights(liked: Iterable[Signal], recent: Iterable[Signal]) -> tuple[dict[str, float], dict[str, Signal], Counter]:
    """Return (weight per videoId, signal metadata, artist affinity)."""
    weights: dict[str, float] = defaultdict(float)
    meta: dict[str, Signal] = {}
    affinity: Counter = Counter()
    for i, s in enumerate(liked):
        w = LIKE_WEIGHT * (LIKE_DECAY**i)
        weights[s.video_id] += w
        meta.setdefault(s.video_id, s)
        affinity[akey(s.artist)] += w
    for i, s in enumerate(recent):
        w = RECENT_WEIGHT * (RECENT_DECAY**i)
        weights[s.video_id] += w
        meta.setdefault(s.video_id, s)
        affinity[akey(s.artist)] += w
    affinity.pop("", None)
    return dict(weights), meta, affinity


def pick_seeds(weights: dict[str, float], meta: dict[str, Signal], limit: int = MAX_SEEDS) -> list[str]:
    seeds: list[str] = []
    per_artist: Counter = Counter()
    for vid in sorted(weights, key=weights.get, reverse=True):  # type: ignore[arg-type]
        a = akey(meta[vid].artist)
        if a and per_artist[a] >= MAX_SEEDS_PER_ARTIST:
            continue
        seeds.append(vid)
        per_artist[a] += 1
        if len(seeds) >= limit:
            break
    return seeds


def diversify(cands: list[Candidate], n: int, max_per_artist: int = 3, decay: float = 0.65) -> list[Candidate]:
    pool = list(cands)
    out: list[Candidate] = []
    count: Counter = Counter()
    while pool and len(out) < n:
        best, best_eff = None, -1.0
        for c in pool:
            if c.artist and count[c.artist] >= max_per_artist:
                continue
            eff = c.score * (decay ** count[c.artist])
            if eff > best_eff:
                best, best_eff = c, eff
        if best is None:
            break
        out.append(best)
        pool.remove(best)
        count[best.artist] += 1
    return out


@dataclass
class MixResult:
    id: str
    title: str
    subtitle: str
    tracks: list[Any]


def build_mixes(
    liked: list[Signal],
    recent: list[Signal],
    fetch_related: Callable[[str], list[Any]],
    *,
    map_fn: Callable[..., Iterable[Any]] = map,
) -> tuple[list[MixResult], list[str]]:
    """Return (mixes, seed titles). `fetch_related(videoId)` returns tracks ordered by relevance."""
    weights, meta, affinity = seed_weights(liked, recent)
    if not weights:
        return [], []
    seeds = pick_seeds(weights, meta)
    top_w = max(weights[s] for s in seeds) or 1.0
    known = set(weights)  # never recommend what they already liked / played
    known_artists = set(affinity)
    total_aff = sum(affinity.values()) or 1.0

    related = dict(zip(seeds, map_fn(fetch_related, seeds)))

    cands: dict[str, Candidate] = {}
    for seed in seeds:
        w = weights[seed] / top_w
        for rank, t in enumerate((related.get(seed) or [])[:40]):
            vid = getattr(t, "videoId", None)
            if not vid or vid in known:
                continue
            dur = getattr(t, "durationSeconds", None)
            if dur and dur > MAX_TRACK_SECONDS:
                continue
            c = cands.setdefault(vid, Candidate(track=t))
            c.score += w / (1 + RANK_DECAY * rank)
            c.sources.add(seed)

    for c in cands.values():
        c.score *= 1 + CO_OCCURRENCE_BOOST * (len(c.sources) - 1)
        share = affinity.get(c.artist, 0.0) / total_aff
        c.score *= 1 + min(0.6, share * 3)

    everything = list(cands.values())
    mixes: list[MixResult] = []

    main = diversify(everything, 30)
    if len(main) >= 8:
        mixes.append(MixResult("for-you", "Made for you", "Built from what you play and save", [c.track for c in main]))

    fresh = diversify([c for c in everything if c.artist and c.artist not in known_artists], 25)
    if len(fresh) >= 8:
        mixes.append(MixResult("fresh", "Fresh finds", "Artists you haven't played yet", [c.track for c in fresh]))

    # "More like <artist>" for the user's two strongest artists that actually seeded something.
    seed_by_artist: dict[str, list[str]] = defaultdict(list)
    for s in seeds:
        seed_by_artist[akey(meta[s].artist)].append(s)
    names = {akey(m.artist): m.artist for m in meta.values() if m.artist}
    shown = 0
    for artist, _ in affinity.most_common():
        if shown >= 2:
            break
        a_seeds = set(seed_by_artist.get(artist, []))
        if not a_seeds:
            continue
        pool = [c for c in everything if c.sources & a_seeds and c.artist != artist]
        picked = diversify(pool, 20)
        if len(picked) >= 8:
            shown += 1
            display = names.get(artist, artist.title())
            mixes.append(MixResult(f"artist-{artist}", f"More like {display}", "Similar sound, new tracks", [c.track for c in picked]))

    return mixes, [meta[s].title for s in seeds if meta[s].title]
