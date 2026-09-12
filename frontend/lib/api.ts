import type {
  ArtistPage,
  CollectionPage,
  HomeResponse,
  SearchResponse,
  Track,
} from "./types";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { cache: "no-store" });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  if (!res.ok) {
    const reason = extractReason(json) || (typeof json === "string" ? json : `Request failed (${res.status})`);
    const err = new Error(reason);
    (err as Error & { status: number; detail: unknown }).status = res.status;
    (err as Error & { status: number; detail: unknown }).detail = json;
    throw err;
  }
  return json as T;
}

function extractReason(detail: unknown): string | undefined {
  if (!detail || typeof detail !== "object") return undefined;
  const d = detail as Record<string, unknown>;
  const inner = d.detail;
  if (typeof inner === "string") return inner;
  if (inner && typeof inner === "object") {
    const r = inner as Record<string, unknown>;
    if (typeof r.reason === "string") return r.reason;
    if (typeof r.error === "string") return r.error;
  }
  if (typeof d.reason === "string") return d.reason;
  return undefined;
}

export const api = {
  search: (q: string, type?: string) => {
    const params = new URLSearchParams({ q });
    if (type) params.set("type", type);
    return getJson<SearchResponse>(`/api/search?${params}`);
  },
  track: (id: string) => getJson<Track>(`/api/track/${id}`),
  home: () => getJson<HomeResponse>("/api/home"),
  related: (id: string) => getJson<Track[]>(`/api/related/${id}`),
  artist: (id: string) => getJson<ArtistPage>(`/api/artist/${encodeURIComponent(id)}`),
  album: (id: string) => getJson<CollectionPage>(`/api/album/${encodeURIComponent(id)}`),
  playlist: (id: string) => getJson<CollectionPage>(`/api/playlist/${encodeURIComponent(id)}`),
};

export function streamUrl(videoId: string): string {
  // Stream directly from the backend — bypasses Vercel's proxy which times out on audio
  const base =
    typeof window !== "undefined"
      ? (process.env.NEXT_PUBLIC_API_URL ?? "")
      : "";
  return `${base}/api/stream/${videoId}`;
}
