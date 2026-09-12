"use client";

import { Suspense } from "react";
import { AnimatePresence } from "framer-motion";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { AudioEngine } from "@/components/player/AudioEngine";
import { NowPlayingBar } from "@/components/player/NowPlayingBar";
import { QueuePanel } from "@/components/player/QueuePanel";
import { ExpandedPlayer } from "@/components/player/ExpandedPlayer";
import { useUiStore } from "@/store/useUiStore";

export function AppShell({ children }: { children: React.ReactNode }) {
  const queueOpen = useUiStore((s) => s.queueOpen);
  const expanded = useUiStore((s) => s.expanded);

  return (
    <div className="flex h-[100dvh] flex-col gap-2 bg-[#0a0a0f] p-2">
      <AudioEngine />
      <div className="flex min-h-0 flex-1 gap-2">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Suspense fallback={<div className="h-14 rounded-2xl bg-white/5" />}>
            <TopBar />
          </Suspense>
          <main className="scrollbar-thin min-h-0 flex-1 overflow-y-auto rounded-2xl bg-white/[0.03] p-4 md:p-6">
            {children}
          </main>
        </div>
        {queueOpen && (
          <div className="hidden md:block">
            <QueuePanel />
          </div>
        )}
      </div>
      {queueOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 p-3 md:hidden">
          <QueuePanel />
        </div>
      )}
      <NowPlayingBar />
      <AnimatePresence>{expanded && <ExpandedPlayer />}</AnimatePresence>
    </div>
  );
}
