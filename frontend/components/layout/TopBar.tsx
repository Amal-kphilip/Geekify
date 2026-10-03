"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Home, Music2, Search, X } from "lucide-react";

/** Desktop top bar: logo, home, search, profile. (Mobile uses the bottom nav instead.) */
export function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<number | undefined>(undefined);

  // Mirror the URL into the box, but never while the user is typing in it.
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
    <header className="hidden h-16 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 md:grid">
      <Link href="/" className="flex items-center gap-2 justify-self-start" aria-label="Geekify home">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-black">
          <Music2 className="h-4 w-4" />
        </span>
        <span className="hidden text-lg font-bold tracking-tight lg:inline">Geekify</span>
      </Link>

      <div className="flex items-center gap-2">
        <Link
          href="/"
          aria-label="Home"
          className={`flex h-12 w-12 items-center justify-center rounded-full bg-elevated transition hover:scale-105 ${
            pathname === "/" ? "text-white" : "text-[#b3b3b3] hover:text-white"
          }`}
        >
          <Home className="h-6 w-6" />
        </Link>
        <form
          onSubmit={onSubmit}
          className="group relative flex h-12 w-[min(480px,38vw)] items-center rounded-full bg-elevated ring-1 ring-transparent transition hover:bg-[#2a2a2a] focus-within:ring-white"
        >
          <Search className="pointer-events-none ml-4 h-5 w-5 shrink-0 text-[#b3b3b3] group-focus-within:text-white" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="What do you want to play?"
            className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-[#a7a7a7]"
          />
          {q && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQ("");
                inputRef.current?.focus();
                if (pathname === "/search") router.replace("/search");
              }}
              className="mr-3 rounded-full p-1 text-[#b3b3b3] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>
      </div>

      <div className="justify-self-end">
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand text-sm font-bold text-black"
          aria-label="Profile"
        >
          G
        </div>
      </div>
    </header>
  );
}
