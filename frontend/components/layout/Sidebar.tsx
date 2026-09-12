"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Heart,
  Home,
  Library,
  ListMusic,
  Plus,
  Search,
} from "lucide-react";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useUiStore } from "@/store/useUiStore";

const nav = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Library", icon: Library },
  { href: "/liked", label: "Liked songs", icon: Heart },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const playlists = useLibraryStore((s) => s.playlists);
  const createPlaylist = useLibraryStore((s) => s.createPlaylist);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);

  const content = (
    <>
      <Link href="/" className="mb-6 block px-2" onClick={() => setSidebarOpen(false)}>
        <span className="text-xl font-semibold tracking-tight accent-text">Geekify</span>
      </Link>
      <nav className="space-y-1">
        {nav.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition ${
                active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-6 flex items-center justify-between px-2">
        <span className="text-xs uppercase tracking-wider text-white/40">Playlists</span>
        <button
          type="button"
          className="rounded-full p-1 hover:bg-white/10"
          title="New playlist"
          onClick={() => {
            const name = window.prompt("Playlist name", "My playlist");
            if (!name) return;
            const pl = createPlaylist(name);
            router.push(`/playlist/local/${pl.id}`);
            setSidebarOpen(false);
          }}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 max-h-[40vh] space-y-1 overflow-y-auto scrollbar-thin">
        {playlists.map((p) => (
          <Link
            key={p.id}
            href={`/playlist/local/${p.id}`}
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-2 truncate rounded-xl px-3 py-2 text-sm text-white/65 hover:bg-white/5"
          >
            <ListMusic className="h-4 w-4 shrink-0" />
            {p.name}
          </Link>
        ))}
        {!playlists.length && (
          <p className="px-3 text-xs text-white/35">Create a playlist to get started.</p>
        )}
      </div>
    </>
  );

  return (
    <>
      <aside className="glass-strong hidden h-full w-[240px] shrink-0 flex-col rounded-2xl p-4 md:flex">
        {content}
      </aside>
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            className="absolute inset-0 bg-black/60"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          />
          <aside className="glass-strong absolute left-3 top-3 h-[calc(100%-1.5rem)] w-[260px] rounded-2xl p-4">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
