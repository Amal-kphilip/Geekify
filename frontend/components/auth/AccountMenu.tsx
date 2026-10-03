"use client";

import { useState } from "react";
import { Check, LogOut, RefreshCw, User } from "lucide-react";
import { signOutAndClear } from "@/lib/cloudSync";
import { useAuthStore } from "@/store/useAuthStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useUiStore } from "@/store/useUiStore";

/** Sign-in button for guests, avatar + dropdown for signed-in listeners. */
export function AccountMenu() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const sync = useAuthStore((s) => s.sync);
  const setAuthOpen = useUiStore((s) => s.setAuthOpen);
  const likedCount = useLibraryStore((s) => s.liked.length);
  const playlistCount = useLibraryStore((s) => s.playlists.length);
  const [open, setOpen] = useState(false);

  if (status === "loading") {
    return <div className="h-10 w-10 animate-pulse rounded-full bg-white/10" aria-hidden="true" />;
  }

  if (status === "guest" || !user) {
    return (
      <button
        type="button"
        onClick={() => setAuthOpen(true)}
        className="accent-bg flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold text-black transition hover:brightness-110"
      >
        <User className="h-4 w-4" />
        Sign in
      </button>
    );
  }

  const initial = (user.name[0] || "?").toUpperCase();
  const syncLabel =
    sync === "syncing" ? "Syncing\u2026" : sync === "error" ? "Sync paused \u2013 will retry" : "Synced to your account";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="accent-bg flex h-10 w-10 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-black ring-2 ring-white/10 transition hover:scale-105"
      >
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
          <div className="glass-strong absolute right-0 z-40 mt-2 w-64 rounded-2xl p-2 shadow-2xl">
            <div className="px-3 py-2">
              <div className="truncate font-semibold">{user.name}</div>
              {user.email && <div className="truncate text-xs text-[#aeabcf]">{user.email}</div>}
              <div className="mt-2 flex items-center gap-1.5 text-xs text-[#9d9bbd]">
                {sync === "syncing" ? <RefreshCw className="spinner h-3 w-3" /> : <Check className="h-3 w-3 text-brand2" />}
                {syncLabel}
              </div>
              <div className="mt-1 text-xs text-[#9d9bbd]">
                {likedCount} favourites &middot; {playlistCount} playlists
              </div>
            </div>
            <div className="my-1 h-px bg-white/10" />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                void signOutAndClear();
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition hover:bg-white/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
