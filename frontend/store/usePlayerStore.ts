"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Track } from "@/lib/types";

export type RepeatMode = "off" | "one" | "all";

type PlayerState = {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  playError: string | null;
  analyserBins: number[];
  play: (track: Track, queue?: Track[]) => void;
  togglePlay: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
  setMuted: (m: boolean) => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  setProgress: (t: number, d: number) => void;
  setPlaying: (p: boolean) => void;
  setPlayError: (m: string | null) => void;
  setAnalyserBins: (bins: number[]) => void;
  reorderQueue: (from: number, to: number) => void;
  addToQueue: (track: Track) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
};

export const usePlayerStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      currentTrack: null,
      queue: [],
      queueIndex: -1,
      isPlaying: false,
      progress: 0,
      duration: 0,
      volume: 0.85,
      muted: false,
      shuffle: false,
      repeatMode: "off",
      playError: null,
      analyserBins: [0.2, 0.35, 0.5, 0.35, 0.2],
      play: (track, queue) => {
        const q = queue && queue.length ? queue : [track];
        const idx = Math.max(
          0,
          q.findIndex((t) => t.videoId === track.videoId)
        );
        set({
          currentTrack: track,
          queue: q,
          queueIndex: idx === -1 ? 0 : idx,
          isPlaying: true,
          progress: 0,
          playError: null,
        });
      },
      togglePlay: () => {
        const { currentTrack, isPlaying } = get();
        if (!currentTrack) return;
        set({ isPlaying: !isPlaying });
      },
      next: () => {
        const { queue, queueIndex, shuffle, repeatMode } = get();
        if (!queue.length) return;
        if (repeatMode === "one") {
          set({ progress: 0, isPlaying: true });
          return;
        }
        let nextIndex: number;
        if (shuffle) {
          if (queue.length === 1) nextIndex = 0;
          else {
            do {
              nextIndex = Math.floor(Math.random() * queue.length);
            } while (nextIndex === queueIndex && queue.length > 1);
          }
        } else {
          nextIndex = queueIndex + 1;
          if (nextIndex >= queue.length) {
            if (repeatMode === "all") nextIndex = 0;
            else {
              set({ isPlaying: false });
              return;
            }
          }
        }
        set({
          currentTrack: queue[nextIndex],
          queueIndex: nextIndex,
          isPlaying: true,
          progress: 0,
          playError: null,
        });
      },
      previous: () => {
        const { queue, queueIndex, progress } = get();
        if (!queue.length) return;
        if (progress > 3 && queue[queueIndex]) {
          set({ progress: 0 });
          return;
        }
        const prev = queueIndex <= 0 ? 0 : queueIndex - 1;
        set({
          currentTrack: queue[prev],
          queueIndex: prev,
          isPlaying: true,
          progress: 0,
          playError: null,
        });
      },
      seek: (time) => set({ progress: time }),
      setVolume: (v) => set({ volume: Math.min(1, Math.max(0, v)), muted: v === 0 }),
      setMuted: (m) => set({ muted: m }),
      toggleShuffle: () => set({ shuffle: !get().shuffle }),
      cycleRepeat: () => {
        const order: RepeatMode[] = ["off", "all", "one"];
        const i = order.indexOf(get().repeatMode);
        set({ repeatMode: order[(i + 1) % order.length] });
      },
      setProgress: (t, d) => set({ progress: t, duration: d }),
      setPlaying: (p) => set({ isPlaying: p }),
      setPlayError: (m) => set({ playError: m, isPlaying: false }),
      setAnalyserBins: (bins) => set({ analyserBins: bins }),
      reorderQueue: (from, to) => {
        const queue = [...get().queue];
        if (from < 0 || to < 0 || from >= queue.length || to >= queue.length) return;
        const [item] = queue.splice(from, 1);
        queue.splice(to, 0, item);
        const current = get().currentTrack;
        const queueIndex = current
          ? Math.max(
              0,
              queue.findIndex((t) => t.videoId === current.videoId)
            )
          : 0;
        set({ queue, queueIndex });
      },
      addToQueue: (track) => set({ queue: [...get().queue, track] }),
      removeFromQueue: (index) => {
        const queue = get().queue.filter((_, i) => i !== index);
        const current = get().currentTrack;
        const queueIndex = current
          ? queue.findIndex((t) => t.videoId === current.videoId)
          : -1;
        set({ queue, queueIndex });
      },
      clearQueue: () => set({ queue: get().currentTrack ? [get().currentTrack!] : [], queueIndex: get().currentTrack ? 0 : -1 }),
    }),
    {
      name: "geekify-player",
      partialize: (s) => ({
        currentTrack: s.currentTrack,
        queue: s.queue,
        queueIndex: s.queueIndex,
        volume: s.volume,
        muted: s.muted,
        shuffle: s.shuffle,
        repeatMode: s.repeatMode,
      }),
    }
  )
);
