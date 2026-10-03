"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { AccountMenu } from "@/components/auth/AccountMenu";

/** Desktop top bar: search + account. (Mobile uses the bottom nav and the Home header instead.) */
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
    <header className="hidden shrink-0 items-center gap-3 md:flex">
      <form
        onSubmit={onSubmit}
        className="glass group relative flex h-12 w-full max-w-2xl items-center rounded-2xl ring-1 ring-transparent transition focus-within:ring-brand"
      >
        <Search className="pointer-events-none ml-4 h-5 w-5 shrink-0 text-[#aeabcf] group-focus-within:text-brand" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Search songs, artists, moods…"
          className="h-full min-w-0 flex-1 bg-transparent px-3 text-sm outline-none placeholder:text-[#9d9bbd]"
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
            className="mr-3 rounded-full p-1 text-[#aeabcf] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>
      <div className="ml-auto">
        <AccountMenu />
      </div>
    </header>
  );
}
