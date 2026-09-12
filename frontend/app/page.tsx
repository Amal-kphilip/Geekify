"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { HomeResponse } from "@/lib/types";
import { ShelfRow, ShelfSkeleton } from "@/components/ui/ShelfRow";

export default function HomePage() {
  const [data, setData] = useState<HomeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .home()
      .then(setData)
      .catch((e: Error) => setError(e.message || "Could not load home feed. Is the API running?"));
  }, []);

  return (
    <div>
      <h1 className="mb-1 text-3xl font-semibold tracking-tight">Home</h1>
      <p className="mb-8 text-sm text-white/50">Quick picks, trending shelves, and new music.</p>
      {error && (
        <div className="glass mb-6 rounded-2xl p-4 text-sm text-amber-200">
          {error}
          <div className="mt-1 text-white/50">Start the FastAPI backend on port 8000, then refresh.</div>
        </div>
      )}
      {!data && !error && (
        <>
          <ShelfSkeleton />
          <ShelfSkeleton />
        </>
      )}
      {data?.shelves.map((s, i) => (
        <ShelfRow key={`${s.title}-${i}`} shelf={s} />
      ))}
    </div>
  );
}
