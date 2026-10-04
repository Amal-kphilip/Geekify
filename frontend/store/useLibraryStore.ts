"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LocalPlaylist, SavedCollection, Track } from "@/lib/types";
import { savedKey, slimThumbnails } from "@/lib/types";

type LibraryState = {
  liked: Track[];
  playlists: LocalPlaylist[];
  /** Albums and playlists saved from YouTube Music (newest first). */
  saved: SavedCollection[];
  toggleSaved: (c: Omit<SavedCollection, "savedAt">) => void;
  removeSaved: (type: SavedCollection["type"], id: string) => void;
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
      saved: [],
      toggleSaved: (c) => {
        const key = savedKey(c);
        const saved = get().saved;
        if (saved.some((x) => savedKey(x) === key)) {
          set({ saved: saved.filter((x) => savedKey(x) !== key) });
        } else {
          set({ saved: [{ ...c, thumbnails: slimThumbnails(c.thumbnails), savedAt: Date.now() }, ...saved] });
        }
      },
      removeSaved: (type, id) => set({ saved: get().saved.filter((x) => !(x.type === type && x.id === id)) }),
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
    { name: "geekify-library", skipHydration: true }
  )
);
