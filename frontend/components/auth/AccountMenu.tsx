"use client";

import { useState } from "react";
import { Check, LogOut, RefreshCw, Settings, SlidersHorizontal, User } from "lucide-react";
import { Avatar } from "@/components/auth/Avatar";
import { toggleTweaksPanel } from "@/components/layout/ButterflyBackground";
import { signOutAndClear } from "@/lib/cloudSync";
import { useAuthStore } from "@/store/useAuthStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useUiStore } from "@/store/useUiStore";

/** Sign-in button for guests, avatar + dropdown for signed-in listeners, plus the Tweaks button next to it. */
export function AccountMenu({ align = "right" }: { align?: "left" | "right" }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const sync = useAuthStore((s) => s.sync);
  const setAuthOpen = useUiStore((s) => s.setAuthOpen);
  const setAccountOpen = useUiStore((s) => s.setAccountOpen);
  const likedCount = useLibraryStore((s) => s.liked.length);
  const playlistCount = useLibraryStore((s) => s.playlists.length);
  const [open, setOpen] = useState(false);

  const tweaksBtn = (
    <button
      type="button"
      onClick={toggleTweaksPanel}
      aria-label="Open butterfly tweaks"
      className="tweaks-open-inline tweaks-glass flex h-11 shrink-0 items-center gap-2 rounded-full px-3.5 text-xs font-medium text-white/85 transition-colors hover:text-white active:scale-95"
    >
      <SlidersHorizontal className="h-4 w-4" />
      <span>Tweaks</span>
    </button>
  );

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2.5">
        {align === "right" && tweaksBtn}
        <div className="h-11 w-11 animate-pulse rounded-full bg-chip" aria-hidden="true" />
        {align === "left" && tweaksBtn}
      </div>
    );
  }

  if (status === "guest" || !user) {
    return (
      <div className="flex items-center gap-2.5">
        {align === "right" && tweaksBtn}
        <button
          type="button"
          onClick={() => setAuthOpen(true)}
          className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-lime px-5 text-sm font-semibold text-ink transition-transform active:scale-95"
        >
          <User className="h-4 w-4" />
          Sign in
        </button>
        {align === "left" && tweaksBtn}
      </div>
    );
  }

  const syncLabel =
    sync === "syncing" ? "Syncing\u2026" : sync === "error" ? "Sync paused \u2013 will retry" : "Synced to your account";

  return (
    <div className="flex items-center gap-2.5">
      {align === "right" && tweaksBtn}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Account menu"
          aria-expanded={open}
          className=" block rounded-full transition-transform active:scale-95"
        >
          <Avatar user={user} />
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
                  setAccountOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/10"
              >
                <Settings className="h-4 w-4" />
                Account settings
              </button>
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
      {align === "left" && tweaksBtn}
    </div>
  );
}
