"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Heart, Home, Library, Music2, Plus, Search } from "lucide-react";
import { useLibraryStore } from "@/store/useLibraryStore";

const ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Collection", icon: Library },
  { href: "/liked", label: "Favourites", icon: Heart },
] as const;

/** Desktop navigation: a slim vertical pill; the active destination gets the lime circle. */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);

  const tip =
    "pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-full bg-chip px-3 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100";

  return (
    <aside
      className="relative z-20 hidden w-[76px] shrink-0 flex-col items-center gap-2 rounded-[28px] bg-surface py-4 md:flex"
      aria-label="Main navigation"
    >
      <Link
        href="/"
        aria-label="Geekify home"
        className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-lime text-ink"
      >
        <Music2 className="h-5 w-5" strokeWidth={2.4} />
      </Link>

      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={`group relative flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
              active ? "bg-lime text-ink" : "text-muted hover:bg-chip hover:text-white"
            }`}
          >
            <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.3 : 1.8} />
            <span className={tip}>{label}</span>
          </Link>
        );
      })}

      <div className="my-2 h-px w-8 bg-white/10" />

      <button
        type="button"
        aria-label="New playlist"
        onClick={() => {
          const name = window.prompt("Name your playlist", "My playlist");
          if (!name) return;
          const pl = createPlaylist(name);
          router.push(`/playlist/local/${pl.id}`);
        }}
        className="group relative flex h-12 w-12 items-center justify-center rounded-full bg-chip text-muted transition-colors hover:text-lime"
      >
        <Plus className="h-5 w-5" />
        <span className={tip}>New playlist</span>
      </button>
    </aside>
  );
}
