"use client";

import { create } from "zustand";

type UiState = {
  queueOpen: boolean;
  lyricsOpen: boolean;
  expanded: boolean;
  nowPlayingOpen: boolean;
  sidebarOpen: boolean;
  authOpen: boolean;
  setAuthOpen: (v: boolean) => void;
  setQueueOpen: (v: boolean) => void;
  setLyricsOpen: (v: boolean) => void;
  setExpanded: (v: boolean) => void;
  setNowPlayingOpen: (v: boolean) => void;
  setSidebarOpen: (v: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  queueOpen: false,
  lyricsOpen: false,
  expanded: false,
  nowPlayingOpen: true,
  sidebarOpen: false,
  authOpen: false,
  setAuthOpen: (v) => set({ authOpen: v }),
  setQueueOpen: (v) => set((s) => ({ queueOpen: v, nowPlayingOpen: v ? false : s.nowPlayingOpen, lyricsOpen: v ? false : s.lyricsOpen })),
  setLyricsOpen: (v) => set((s) => ({ lyricsOpen: v, queueOpen: v ? false : s.queueOpen })),
  setExpanded: (v) => set({ expanded: v }),
  // The right-hand panel shows either the queue or the now-playing view, never both.
  setNowPlayingOpen: (v) => set((s) => ({ nowPlayingOpen: v, queueOpen: v ? false : s.queueOpen })),
  setSidebarOpen: (v) => set({ sidebarOpen: v }),
}));
