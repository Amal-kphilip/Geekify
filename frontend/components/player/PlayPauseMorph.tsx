"use client";

import { AnimatePresence, motion } from "framer-motion";

export function PlayPauseMorph({
  playing,
  loading = false,
  tone = "dark",
}: {
  playing: boolean;
  loading?: boolean;
  /** "dark" icon for use on a white button, "light" icon on a dark background. */
  tone?: "dark" | "light";
}) {
  const ink = tone === "dark" ? "black" : "white";
  if (loading) {
    return (
      <svg viewBox="0 0 24 24" className="spinner h-6 w-6" fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round">
        <circle cx="12" cy="12" r="8" strokeOpacity="0.25" />
        <path d="M12 4a8 8 0 0 1 8 8" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill={ink}>
      <AnimatePresence mode="wait" initial={false}>
        {playing ? (
          <motion.g
            key="pause"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.16 }}
          >
            <rect x="5" y="4" width="5" height="16" rx="1.2" />
            <rect x="14" y="4" width="5" height="16" rx="1.2" />
          </motion.g>
        ) : (
          <motion.path
            key="play"
            d="M8 5.5v13l11-6.5L8 5.5z"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.16 }}
          />
        )}
      </AnimatePresence>
    </svg>
  );
}
