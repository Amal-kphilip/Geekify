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

/** Desktop navigation: a slim floating rail with tooltips (the collection lives on its own page). */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);

  const tip =
    "pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lg ring-1 ring-white/10 transition group-hover:opacity-100 group-focus-visible:opacity-100";

  return (
    <aside
      className="glass relative z-20 hidden w-[76px] shrink-0 flex-col items-center gap-2 rounded-3xl py-4 md:flex"
      aria-label="Main navigation"
    >
      <Link href="/" aria-label="Geekify home" className="accent-bg mb-3 flex h-11 w-11 items-center justify-center rounded-2xl text-black shadow-lg shadow-violet-500/20">
        <Music2 className="h-5 w-5" />
      </Link>

      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={`group relative flex h-12 w-12 items-center justify-center rounded-2xl transition ${
              active ? "bg-white/10 text-white" : "text-[#aeabcf] hover:bg-white/[0.06] hover:text-white"
            }`}
          >
            {active && <span className="accent-bg absolute -left-[14px] h-6 w-1 rounded-r-full" />}
            <Icon className={`h-5 w-5 ${active ? "text-brand" : ""}`} />
            <span className={tip}>{label}</span>
          </Link>
        );
      })}

      <div className="my-1 h-px w-8 bg-white/10" />

      <button
        type="button"
        aria-label="New playlist"
        onClick={() => {
          const name = window.prompt("Name your playlist", "My playlist");
          if (!name) return;
          const pl = createPlaylist(name);
          router.push(`/playlist/local/${pl.id}`);
        }}
        className="group relative flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-white/20 text-[#aeabcf] transition hover:border-brand hover:text-brand"
      >
        <Plus className="h-5 w-5" />
        <span className={tip}>New playlist</span>
      </button>
    </aside>
  );
}
