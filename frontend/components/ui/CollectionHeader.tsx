import { Play } from "lucide-react";
import type { ReactNode } from "react";

/** Lime "Play" pill used on every collection page. */
export function PlayButton({ onClick, label = "Play" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-12 items-center gap-2 rounded-full bg-lime px-7 text-[15px] font-semibold text-ink transition-transform active:scale-95"
    >
      <Play className="h-4 w-4 fill-ink" />
      {label}
    </button>
  );
}

/** Round-cornered cover + title block shared by album / playlist / favourites pages. */
export function CollectionHeader({
  cover,
  kind,
  title,
  meta,
  children,
  coverNode,
}: {
  cover?: string;
  kind: string;
  title: string;
  meta?: ReactNode;
  children?: ReactNode;
  coverNode?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end">
      {coverNode ??
        (cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" decoding="async" className="h-48 w-48 shrink-0 rounded-[32px] object-cover" />
        ) : (
          <div className="h-48 w-48 shrink-0 rounded-[32px] bg-elevated" />
        ))}
      <div className="min-w-0">
        <div className="text-sm font-medium text-muted">{kind}</div>
        <h1 className="mt-1 text-4xl font-semibold leading-tight tracking-tight md:text-5xl">{title}</h1>
        {meta && <p className="mt-2 text-[15px] text-muted">{meta}</p>}
        {children && <div className="mt-5 flex flex-wrap items-center gap-2.5">{children}</div>}
      </div>
    </div>
  );
}
