import type {
  ArtistPage,
  CollectionPage,
  HomeResponse,
  MixResponse,
  SearchResponse,
  Track,
} from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function looksLikeHtml(text: string): boolean {
  return /^\s*<(!doctype|html|head|body|script)/i.test(text) || /<\/html>/i.test(text.slice(-200));
}

function friendlyStatus(status: number): string {
  if (status === 403 || status === 429 || status === 503)
    return "The server is busy or temporarily blocked the request. Retrying usually works - try again in a few seconds.";
  if (status >= 500) return "The server is waking up or had a problem. Please try again in a few seconds.";
  return `Request failed (${status}).`;
}

async function getJson<T>(path: string, attempt = 0): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { cache: "no-store" });
  } catch {
    // Network blip / server cold start: retry a couple of times before giving up.
    if (attempt < 2) {
      await sleep(1200 * (attempt + 1));
      return getJson<T>(path, attempt + 1);
    }
    throw new Error("Cannot reach the server. Check your connection and try again.");
  }
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    json = text;
  }
  const htmlBody = typeof json === "string" && looksLikeHtml(json);
  // A Cloudflare/host challenge page (HTML) or a 5xx while the backend wakes up: retry.
  if ((!res.ok || htmlBody) && (htmlBody || res.status >= 500 || res.status === 429) && attempt < 2) {
    await sleep(1500 * (attempt + 1));
    return getJson<T>(path, attempt + 1);
  }
  if (!res.ok || htmlBody) {
    // Never show raw HTML to the user.
    const reason =
      (!htmlBody && extractReason(json)) ||
      (!htmlBody && typeof json === "string" && json.trim() ? json.slice(0, 200) : "") ||
      friendlyStatus(res.status);
    const err = new Error(reason);
    (err as Error & { status: number; detail: unknown }).status = res.status;
    (err as Error & { status: number; detail: unknown }).detail = htmlBody ? null : json;
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

export type Signal = { videoId: string; artist: string; title: string };

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
}

async function postJson<T>(path: string, body: unknown, attempt = 0): Promise<T> {
  try {
    const res = await fetch(`${apiBase()}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (res.status >= 500 && attempt < 2) throw new Error("retry");
    if (!res.ok) throw new Error(friendlyStatus(res.status));
    return (await res.json()) as T;
  } catch (e) {
    if (attempt < 2) {
      await sleep(1500 * (attempt + 1));
      return postJson<T>(path, body, attempt + 1);
    }
    throw e instanceof Error && e.message !== "retry" ? e : new Error("Cannot reach the server. Try again shortly.");
  }
}

export const api = {
  search: (q: string, type?: string) => {
    const params = new URLSearchParams({ q });
    if (type) params.set("type", type);
    return getJson<SearchResponse>(`/api/search?${params}`);
  },
  track: (id: string) => getJson<Track>(`/api/track/${id}`),
  home: () => getJson<HomeResponse>(`/api/home?seed=${Math.floor(Math.random() * 1e9)}`),
  recommend: (liked: Signal[], recent: Signal[]) =>
    postJson<MixResponse>("/api/recommend/mix", { liked, recent }),
  related: (id: string) => getJson<Track[]>(`/api/related/${id}`),
  artist: (id: string) => getJson<ArtistPage>(`/api/artist/${encodeURIComponent(id)}`),
  album: (id: string) => getJson<CollectionPage>(`/api/album/${encodeURIComponent(id)}`),
  playlist: (id: string) => getJson<CollectionPage>(`/api/playlist/${encodeURIComponent(id)}`),
};

export function streamUrl(videoId: string): string {
  // Stream directly from the backend — bypasses Vercel's proxy which times out on audio
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
  return `${base}/api/stream/${videoId}`;
}

/** Ask the backend to resolve a stream URL in the background so the track starts instantly later. */
export function prewarmStream(videoId: string): void {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
  fetch(`${base}/api/prewarm/${videoId}`, { cache: "no-store", keepalive: true }).catch(() => undefined);
}

/** Wake the backend (free hosts sleep when idle) as soon as the app opens. */
export function warmBackend(): void {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
  fetch(`${base}/api/health`, { cache: "no-store" }).catch(() => undefined);
}
