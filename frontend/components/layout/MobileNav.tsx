"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Heart, Home, Library, Plus, Search } from "lucide-react";
import { useLibraryStore } from "@/store/useLibraryStore";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Your Collection", icon: Library },
  { href: "/liked", label: "Favourites", icon: Heart },
] as const;

/** Mobile bottom navigation: a floating pill; the active tab becomes a lime circle. */
export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);

  const base = "flex h-12 w-12 items-center justify-center rounded-full transition-colors";

  return (
    <nav
      className="mx-4 mb-[max(0.5rem,env(safe-area-inset-bottom))] flex shrink-0 items-center justify-between rounded-full bg-elevated px-2 py-2 md:hidden"
      aria-label="Main navigation"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={`${base} ${active ? "bg-lime text-ink" : "text-muted active:text-white"}`}
          >
            <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.3 : 1.8} />
          </Link>
        );
      })}
      <button
        type="button"
        aria-label="Create playlist"
        className={`${base} text-muted active:text-white`}
        onClick={() => {
          const name = window.prompt("Playlist name", "My playlist");
          if (!name) return;
          const pl = createPlaylist(name);
          router.push(`/playlist/local/${pl.id}`);
        }}
      >
        <Plus className="h-[22px] w-[22px]" strokeWidth={1.8} />
      </button>
    </nav>
  );
}
