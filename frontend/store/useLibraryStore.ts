"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LocalPlaylist, Track } from "@/lib/types";

type LibraryState = {
  liked: Track[];
  playlists: LocalPlaylist[];
  toggleLike: (track: Track) => void;
  isLiked: (videoId: string) => boolean;
  createPlaylist: (name: string) => LocalPlaylist;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (id: string, track: Track) => void;
  removeFromPlaylist: (id: string, videoId: string) => void;
};

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      liked: [],
      playlists: [],
      toggleLike: (track) => {
        const liked = get().liked;
        const exists = liked.some((t) => t.videoId === track.videoId);
        set({
          liked: exists
            ? liked.filter((t) => t.videoId !== track.videoId)
            : [track, ...liked],
        });
      },
      isLiked: (videoId) => get().liked.some((t) => t.videoId === videoId),
      createPlaylist: (name) => {
        const pl: LocalPlaylist = {
          id: crypto.randomUUID(),
          name: name.trim() || "New playlist",
          tracks: [],
          createdAt: Date.now(),
        };
        set({ playlists: [pl, ...get().playlists] });
        return pl;
      },
      renamePlaylist: (id, name) =>
        set({
          playlists: get().playlists.map((p) =>
            p.id === id ? { ...p, name } : p
          ),
        }),
      deletePlaylist: (id) =>
        set({ playlists: get().playlists.filter((p) => p.id !== id) }),
      addToPlaylist: (id, track) =>
        set({
          playlists: get().playlists.map((p) =>
            p.id === id && !p.tracks.some((t) => t.videoId === track.videoId)
              ? { ...p, tracks: [...p.tracks, track] }
              : p
          ),
        }),
      removeFromPlaylist: (id, videoId) =>
        set({
          playlists: get().playlists.map((p) =>
            p.id === id
              ? { ...p, tracks: p.tracks.filter((t) => t.videoId !== videoId) }
              : p
          ),
        }),
    }),
    { name: "geekify-library" }
  )
);
