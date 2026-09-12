"use client";

import { motion } from "framer-motion";
import type { Card } from "@/lib/types";
import { artUrl } from "@/lib/types";
import { Album } from "lucide-react";

export function GlassCard({
  item,
  onClick,
}: {
  item: Card;
  onClick?: () => void;
}) {
  const src = artUrl(item.thumbnails, 300);
  const round = item.type === "artist" ? "rounded-full" : "rounded-xl";
  return (
    <motion.button
      type="button"
      whileHover={{ scale: 1.04, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      onClick={onClick}
      className="group w-[160px] shrink-0 text-left"
    >
      <div
        className={`relative ${round} overflow-hidden glass shadow-lg shadow-black/40 transition-[box-shadow,backdrop-filter] duration-200 group-hover:shadow-glow group-hover:backdrop-blur-xl`}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={item.title} className={`aspect-square w-full object-cover ${round}`} />
        ) : (
          <div className={`flex aspect-square items-center justify-center bg-white/5 ${round}`}>
            <Album className="h-10 w-10 text-white/30" />
          </div>
        )}
      </div>
      <div className="mt-2 px-0.5">
        <div className="truncate text-sm font-medium">{item.title}</div>
        <div className="truncate text-xs text-white/50">
          {item.subtitle || item.type}
        </div>
      </div>
    </motion.button>
  );
}
