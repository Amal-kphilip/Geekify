"use client";

import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, X } from "lucide-react";
import { usePlayerStore } from "@/store/usePlayerStore";
import { artUrl } from "@/lib/types";
import { useUiStore } from "@/store/useUiStore";

function SortableItem({
  id,
  index,
  title,
  artist,
  thumb,
  active,
}: {
  id: string;
  index: number;
  title: string;
  artist: string;
  thumb?: string;
  active: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const play = usePlayerStore((s) => s.play);
  const queue = usePlayerStore((s) => s.queue);
  const removeFromQueue = usePlayerStore((s) => s.removeFromQueue);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-xl px-2 py-2 ${active ? "bg-white/10" : "hover:bg-white/5"}`}
    >
      <button className="cursor-grab text-white/30" {...attributes} {...listeners} aria-label="Reorder">
        <GripVertical className="h-4 w-4" />
      </button>
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={() => queue[index] && play(queue[index], queue)}
      >
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-9 w-9 rounded object-cover" />
        ) : (
          <div className="h-9 w-9 rounded bg-white/10" />
        )}
        <div className="min-w-0">
          <div className="truncate text-sm">{title}</div>
          <div className="truncate text-xs text-white/45">{artist}</div>
        </div>
      </button>
      <button type="button" onClick={() => removeFromQueue(index)} className="p-1 text-white/35 hover:text-white">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function QueuePanel() {
  const queue = usePlayerStore((s) => s.queue);
  const current = usePlayerStore((s) => s.currentTrack);
  const reorderQueue = usePlayerStore((s) => s.reorderQueue);
  const setQueueOpen = useUiStore((s) => s.setQueueOpen);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const ids = queue.map((t, i) => `${t.videoId}-${i}`);

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    reorderQueue(from, to);
  };

  return (
    <aside className="glass-strong flex h-full w-full flex-col rounded-2xl p-3 md:w-[300px]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Queue</h3>
        <button type="button" className="text-white/50 md:hidden" onClick={() => setQueueOpen(false)}>
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
        {queue.length === 0 ? (
          <p className="px-2 text-sm text-white/40">Queue is empty.</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy}>
              {queue.map((t, i) => (
                <SortableItem
                  key={ids[i]}
                  id={ids[i]}
                  index={i}
                  title={t.title}
                  artist={t.artist}
                  thumb={artUrl(t.thumbnails, 80)}
                  active={current?.videoId === t.videoId}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </aside>
  );
}
