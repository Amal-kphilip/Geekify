"use client";

import { motion } from "framer-motion";
import { usePlayerStore } from "@/store/usePlayerStore";

export function EqualizerBars({ className = "" }: { className?: string }) {
  const bins = usePlayerStore((s) => s.analyserBins);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  return (
    <div className={`flex h-5 items-end gap-[3px] ${className}`} aria-hidden>
      {bins.map((v, i) => (
        <motion.span
          key={i}
          className="w-[3px] origin-bottom rounded-full bg-gradient-to-t from-fuchsia-500 to-cyan-300"
          animate={{ scaleY: isPlaying ? Math.max(0.18, v) : 0.18 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          style={{ height: "100%" }}
        />
      ))}
    </div>
  );
}
