"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, Library, Plus, Search } from "lucide-react";
import { useLibraryStore } from "@/store/useLibraryStore";

const items = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Your Collection", icon: Library },
] as const;

/** Mobile bottom navigation: Home / Search / Your Collection / Create. */
export function MobileNav() {
  const pathname = usePathname();
  const router = useRouter();
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);

  const cls = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-1 py-2 text-[11px] transition ${active ? "text-brand" : "text-[#9d9bbd]"}`;

  return (
    <nav
      className="glass-strong mx-2 mb-2 flex shrink-0 rounded-3xl pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="Main navigation"
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link key={href} href={href} className={cls(active)} aria-current={active ? "page" : undefined}>
            <Icon className={`h-6 w-6 ${active ? "stroke-[2.5]" : ""}`} />
            {label}
          </Link>
        );
      })}
      <button
        type="button"
        className={cls(false)}
        onClick={() => {
          const name = window.prompt("Playlist name", "My playlist");
          if (!name) return;
          const pl = createPlaylist(name);
          router.push(`/playlist/local/${pl.id}`);
        }}
      >
        <Plus className="h-6 w-6" />
        Create
      </button>
    </nav>
  );
}
