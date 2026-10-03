"use client";

import { create } from "zustand";
import { api } from "@/lib/api";
import type { HomeResponse } from "@/lib/types";

const KEY = "geekify-home-v1";
const MAX_AGE_MS = 5 * 60 * 1000;

type HomeState = {
  data: HomeResponse | null;
  loading: boolean;
  error: string | null;
  fetchedAt: number;
  load: (force?: boolean) => Promise<void>;
};

/**
 * Home feed. Fetched as soon as the app opens (not when the Home page mounts), shows the
 * last feed instantly while a fresh one loads, and re-fetches when older than 5 minutes.
 */
export const useHomeStore = create<HomeState>((set, get) => ({
  data: null,
  loading: false,
  error: null,
  fetchedAt: 0,
  load: async (force = false) => {
    const s = get();
    if (s.loading) return;
    if (!force && s.data && Date.now() - s.fetchedAt < MAX_AGE_MS) return;
    set({ loading: true, error: null });
    if (!get().data) {
      try {
        const cached = localStorage.getItem(KEY);
        if (cached) set({ data: JSON.parse(cached) as HomeResponse });
      } catch {
        /* ignore */
      }
    }
    try {
      const fresh = await api.home();
      set({ data: fresh, loading: false, error: null, fetchedAt: Date.now() });
      try {
        localStorage.setItem(KEY, JSON.stringify(fresh));
      } catch {
        /* storage full / disabled */
      }
    } catch (e) {
      set({ loading: false, error: get().data ? null : (e as Error).message || "Could not load home feed." });
    }
  },
}));
