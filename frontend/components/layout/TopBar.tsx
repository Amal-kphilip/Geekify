"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Menu, Search, User } from "lucide-react";
import { useUiStore } from "@/store/useUiStore";

export function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const [q, setQ] = useState(params.get("q") || "");
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);

  // Mirror the URL into the box, but never while the user is typing in it
  // (a late URL update would otherwise overwrite freshly typed characters).
  useEffect(() => {
    if (document.activeElement === inputRef.current) return;
    setQ(pathname === "/search" ? params.get("q") || "" : "");
  }, [pathname, params]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const go = (query: string) => {
    const url = query ? `/search?q=${encodeURIComponent(query)}` : "/search";
    // replace while already searching so Back doesn't walk through every keystroke
    if (pathname === "/search") router.replace(url);
    else if (query) router.push(url);
  };

  const onInputChange = (val: string) => {
    setQ(val);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => go(val.trim()), 300);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    window.clearTimeout(timer.current);
    const query = q.trim();
    if (query) go(query);
  };

  return (
    <header className="glass flex items-center gap-3 rounded-2xl px-3 py-2">
      <button
        type="button"
        className="rounded-full p-2 hover:bg-white/10 md:hidden"
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-4 w-4" />
      </button>
      <div className="hidden items-center gap-1 md:flex">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-full bg-black/30 p-2 hover:bg-white/10"
          aria-label="Back"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => router.forward()}
          className="rounded-full bg-black/30 p-2 hover:bg-white/10"
          aria-label="Forward"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <form onSubmit={onSubmit} className="relative mx-auto w-full max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Search songs, artists, albums..."
          className="w-full rounded-full bg-white/[0.08] py-2.5 pl-10 pr-4 text-sm outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-fuchsia-400/40"
        />
      </form>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-400 text-xs font-semibold text-black">
        <User className="h-4 w-4" />
      </div>
    </header>
  );
}
