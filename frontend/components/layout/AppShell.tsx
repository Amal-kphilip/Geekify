"use client";

import { Suspense, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileNav } from "./MobileNav";
import { AudioEngine } from "@/components/player/AudioEngine";
import { NowPlayingBar } from "@/components/player/NowPlayingBar";
import { NowPlayingPanel } from "@/components/player/NowPlayingPanel";
import { QueuePanel } from "@/components/player/QueuePanel";
import { ExpandedPlayer } from "@/components/player/ExpandedPlayer";
import { prewarmStream, warmBackend } from "@/lib/api";
import { useUiStore } from "@/store/useUiStore";
import { usePlayerStore } from "@/store/usePlayerStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useHistoryStore } from "@/store/useHistoryStore";
import { useHomeStore } from "@/store/useHomeStore";

export function AppShell({ children }: { children: React.ReactNode }) {
  const queueOpen = useUiStore((s) => s.queueOpen);
  const nowPlayingOpen = useUiStore((s) => s.nowPlayingOpen);
  const expanded = useUiStore((s) => s.expanded);
  const hasTrack = usePlayerStore((s) => !!s.currentTrack);

  useEffect(() => {
    // 1) Restore persisted state (after mount so server and client markup match).
    void usePlayerStore.persist.rehydrate();
    void useLibraryStore.persist.rehydrate();
    void useHistoryStore.persist.rehydrate();

    // 2) Talk to the backend right away - don't wait for the user to press play:
    //    wake it up, start loading a fresh home feed, and pre-resolve the last track.
    warmBackend();
    void useHomeStore.getState().load();
    const last = usePlayerStore.getState().currentTrack;
    if (last) prewarmStream(last.videoId);
  }, []);

  // Desktop right panel: queue OR now-playing view.
  const rightPanel = queueOpen ? (
    <QueuePanel />
  ) : nowPlayingOpen && hasTrack ? (
    <NowPlayingPanel />
  ) : null;

  return (
    <div className="flex h-[100dvh] flex-col bg-black">
      <AudioEngine />
      <Suspense fallback={<div className="hidden h-16 md:block" />}>
        <TopBar />
      </Suspense>
      <div className="flex min-h-0 flex-1 gap-2 px-0 md:px-2">
        <Sidebar />
        <main className="scrollbar-thin min-h-0 min-w-0 flex-1 overflow-y-auto bg-panel p-4 md:rounded-lg md:p-6">
          {children}
        </main>
        {rightPanel && <div className="hidden lg:flex">{rightPanel}</div>}
      </div>
      {/* Small screens: the queue opens full-screen (above the expanded player too). */}
      {queueOpen && <div className="fixed inset-0 z-[120] bg-panel lg:hidden">{<QueuePanel />}</div>}
      <NowPlayingBar />
      <MobileNav />
      <AnimatePresence>{expanded && <ExpandedPlayer />}</AnimatePresence>
    </div>
  );
}
