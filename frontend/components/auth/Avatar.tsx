"use client";

import type { AccountUser } from "@/store/useAuthStore";

/** Round profile picture (PNG/JPG/WebP/animated GIF), or the first letter of the name. */
export function Avatar({ user, className = "h-11 w-11 text-sm" }: { user: AccountUser; className?: string }) {
  const initial = (user.name[0] || "?").toUpperCase();
  return (
    <span className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-lime font-bold text-ink ${className}`}>
      {user.photoURL ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.photoURL} alt="" referrerPolicy="no-referrer" draggable={false} className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}
