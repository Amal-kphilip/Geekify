"use client";

import { create } from "zustand";
import { api, type Signal } from "@/lib/api";
import type { Mix, Track } from "@/lib/types";
import { useHistoryStore } from "@/store/useHistoryStore";
import { useLibraryStore } from "@/store/useLibraryStore";

const CACHE_KEY = "geekify-mixes-v1";
const MAX_AGE_MS = 10 * 60 * 1000;

const toSignal = (t: Track): Signal => ({ videoId: t.videoId, artist: t.artist, title: t.title });

type RecState = {
  mixes: Mix[];
  seeds: string[];
  loading: boolean;
  error: string | null;
  fetchedAt: number;
  /** Fingerprint of the favourites the current mixes were built from. */
  likedKey: string;
  /** Fetch mixes. Skipped when fresh, unless favourites changed or `force` is set. */
  load: (force?: boolean) => Promise<void>;
  /** Restore the last mixes from this device so Home isn't empty while loading. */
  restore: () => void;
  clear: () => void;
};

export const useRecommendStore = create<RecState>((set, get) => ({
  mixes: [],
  seeds: [],
  loading: false,
  error: null,
  fetchedAt: 0,
  likedKey: "",

  restore: () => {
    if (get().mixes.length) return;
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const c = JSON.parse(raw) as { mixes: Mix[]; seeds: string[] };
        if (Array.isArray(c.mixes)) set({ mixes: c.mixes, seeds: c.seeds ?? [] });
      }
    } catch {
      /* ignore corrupt cache */
    }
  },

  clear: () => {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {
      /* ignore */
    }
    set({ mixes: [], seeds: [], fetchedAt: 0, likedKey: "", error: null });
  },

  load: async (force = false) => {
    const s = get();
    if (s.loading) return;
    const liked = useLibraryStore.getState().liked.slice(0, 40);
    const recent = useHistoryStore.getState().recent.slice(0, 30);
    if (!liked.length && !recent.length) {
      if (s.mixes.length) get().clear();
      return;
    }
    const likedKey = liked.map((t) => t.videoId).join(",");
    const fresh = Date.now() - s.fetchedAt < MAX_AGE_MS;
    if (!force && fresh && s.likedKey === likedKey && s.mixes.length) return;

    set({ loading: true, error: null });
    try {
      const res = await api.recommend(liked.map(toSignal), recent.map(toSignal));
      set({ mixes: res.mixes, seeds: res.seeds, loading: false, fetchedAt: Date.now(), likedKey });
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ mixes: res.mixes, seeds: res.seeds }));
      } catch {
        /* storage full / disabled */
      }
    } catch (e) {
      set({ loading: false, error: s.mixes.length ? null : (e as Error).message || "Could not build your mixes." });
    }
  },
}));
