"use client";

import { Check, Plus } from "lucide-react";
import type { SavedCollection } from "@/lib/types";
import { savedKey } from "@/lib/types";
import { useLibraryStore } from "@/store/useLibraryStore";

/** "Save to library" toggle for an album or playlist page. */
export function SaveCollectionButton({ item }: { item: Omit<SavedCollection, "savedAt"> }) {
  const key = savedKey(item);
  const saved = useLibraryStore((s) => s.saved.some((c) => savedKey(c) === key));
  const toggleSaved = useLibraryStore((s) => s.toggleSaved);
  const noun = item.type === "album" ? "album" : "playlist";

  return (
    <button
      type="button"
      onClick={() => toggleSaved(item)}
      aria-pressed={saved}
      title={saved ? `Remove this ${noun} from your library` : `Save this ${noun} to your library`}
      className={`flex h-12 items-center gap-2 whitespace-nowrap rounded-full px-6 text-[15px] font-semibold transition-colors active:scale-95 ${
        saved ? "bg-chip text-lime hover:bg-white/15" : "bg-chip text-white hover:bg-white/15"
      }`}
    >
      {saved ? <Check className="h-4 w-4" strokeWidth={2.6} /> : <Plus className="h-4 w-4" strokeWidth={2.6} />}
      {saved ? "Saved" : "Save to library"}
    </button>
  );
}
