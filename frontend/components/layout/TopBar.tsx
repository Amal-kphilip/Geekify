"use client";

import { FormEvent, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Menu, Search, User } from "lucide-react";
import { useUiStore } from "@/store/useUiStore";

export function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const setSidebarOpen = useUiStore((s) => s.setSidebarOpen);
  const [q, setQ] = useState(params.get("q") || "");

  useEffect(() => {
    if (pathname === "/search") {
      setQ(params.get("q") || "");
    } else {
      setQ("");
    }
  }, [pathname, params]);

  const onInputChange = (val: string) => {
    setQ(val);
    const query = val.trim();
    if (query) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    } else if (pathname === "/search") {
      router.push("/search");
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const query = q.trim();
    if (query) {
      router.push(`/search?q=${encodeURIComponent(query)}`);
    }
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
          value={q}
          onChange={(e) => onInputChange(e.target.value)}
          placeholder="Search songs, artists, albums..."
          className="w-full rounded-full bg-white/8 py-2.5 pl-10 pr-4 text-sm outline-none ring-1 ring-white/10 placeholder:text-white/35 focus:ring-fuchsia-400/40"
        />
      </form>
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-400 text-xs font-semibold text-black">
        <User className="h-4 w-4" />
      </div>
    </header>
  );
}
