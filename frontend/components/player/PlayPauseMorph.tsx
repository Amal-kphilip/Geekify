"use client";

import { AnimatePresence, motion } from "framer-motion";

export function PlayPauseMorph({ playing }: { playing: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 fill-black">
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
