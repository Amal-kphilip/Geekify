"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Track } from "@/lib/types";

type HistoryState = {
  recent: Track[];
  add: (track: Track) => void;
  clear: () => void;
};

/** Recently played tracks (most recent first). Feeds Home personalisation. */
export const useHistoryStore = create<HistoryState>()(
  persist(
    (set, get) => ({
      recent: [],
      add: (track) => {
        const rest = get().recent.filter((t) => t.videoId !== track.videoId);
        set({ recent: [track, ...rest].slice(0, 40) });
      },
      clear: () => set({ recent: [] }),
    }),
    { name: "geekify-history", skipHydration: true }
  )
);
