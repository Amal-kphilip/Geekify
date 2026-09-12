"use client";

import { create } from "zustand";

type UiState = {
  queueOpen: boolean;
  lyricsOpen: boolean;
  expanded: boolean;
  sidebarOpen: boolean;
  setQueueOpen: (v: boolean) => void;
  setLyricsOpen: (v: boolean) => void;
  setExpanded: (v: boolean) => void;
  setSidebarOpen: (v: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  queueOpen: false,
  lyricsOpen: false,
  expanded: false,
  sidebarOpen: false,
  setQueueOpen: (v) => set((s) => ({ queueOpen: v, lyricsOpen: v ? false : s.lyricsOpen })),
  setLyricsOpen: (v) => set((s) => ({ lyricsOpen: v, queueOpen: v ? false : s.queueOpen })),
  setExpanded: (v) => set({ expanded: v }),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
}));
