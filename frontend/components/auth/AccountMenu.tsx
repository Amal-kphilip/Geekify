"use client";

import { useState } from "react";
import { Check, LogOut, RefreshCw, User } from "lucide-react";
import { signOutAndClear } from "@/lib/cloudSync";
import { useAuthStore } from "@/store/useAuthStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useUiStore } from "@/store/useUiStore";

/** Sign-in button for guests, avatar + dropdown for signed-in listeners. */
export function AccountMenu({ align = "right" }: { align?: "left" | "right" }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const sync = useAuthStore((s) => s.sync);
  const setAuthOpen = useUiStore((s) => s.setAuthOpen);
  const likedCount = useLibraryStore((s) => s.liked.length);
  const playlistCount = useLibraryStore((s) => s.playlists.length);
  const [open, setOpen] = useState(false);

  if (status === "loading") {
    return <div className="h-11 w-11 animate-pulse rounded-full bg-chip" aria-hidden="true" />;
  }

  if (status === "guest" || !user) {
    return (
      <button
        type="button"
        onClick={() => setAuthOpen(true)}
        className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-lime px-5 text-sm font-semibold text-ink transition-transform active:scale-95"
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
        className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-lime text-sm font-bold text-ink transition-transform active:scale-95"
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
          <div className={`absolute z-40 mt-2 w-64 animate-pop rounded-3xl bg-chip p-2 shadow-2xl shadow-black/60 ${
              align === "left" ? "left-0 [transform-origin:top_left]" : "right-0 [transform-origin:top_right]"
            }`}>
            <div className="px-3 py-2">
              <div className="truncate font-semibold">{user.name}</div>
              {user.email && <div className="truncate text-xs text-muted">{user.email}</div>}
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                {sync === "syncing" ? <RefreshCw className="spinner h-3 w-3" /> : <Check className="h-3 w-3 text-lime" />}
                {syncLabel}
              </div>
              <div className="mt-1 text-xs text-muted">
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
              className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/10"
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
