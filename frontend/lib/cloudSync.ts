"use client";

import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { useAuthStore, type SyncState } from "@/store/useAuthStore";
import { useHistoryStore } from "@/store/useHistoryStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useRecommendStore } from "@/store/useRecommendStore";
import type { LocalPlaylist, Thumbnail, Track } from "@/lib/types";

/**
 * Keeps the signed-in user's library (favourites, playlists) and listening history in
 * Firestore at users/{uid}. Guests are unaffected: everything still lives in localStorage.
 *
 *  - On sign-in: if this device last synced as the same account, the cloud copy wins;
 *    otherwise (first sign-in here) local guest data is merged into the cloud copy.
 *  - While signed in: changes are pushed after a short debounce.
 *  - On sign-out: pending changes are flushed, then local data is cleared so the next
 *    person on a shared device doesn't see it.
 */

const SYNC_UID_KEY = "geekify-sync-uid";
const PUSH_DELAY_MS = 2000;
const STALE_PULL_MS = 60_000;
const MAX_HISTORY = 40;

type CloudDoc = { liked?: Track[]; playlists?: LocalPlaylist[]; history?: Track[]; updatedAt?: number };

let generation = 0;
let activeUid: string | null = null;
let pushTimer: number | undefined;
let unsubs: Array<() => void> = [];
let applying = false;
let lastPull = 0;

const setSync = (s: SyncState) => useAuthStore.getState().setSync(s);

function slimThumbs(thumbs: Thumbnail[] | undefined): Thumbnail[] {
  if (!thumbs?.length) return [];
  const sorted = [...thumbs].sort((a, b) => (a.width || 0) - (b.width || 0));
  const pick = sorted.length > 1 ? [sorted[0], sorted[sorted.length - 1]] : sorted;
  return pick.map((t) => ({ url: t.url, width: t.width ?? null, height: t.height ?? null }));
}

/** Firestore rejects undefined and has a 1 MB document cap, so store compact tracks. */
function slim(t: Track): Track {
  return {
    videoId: t.videoId,
    title: t.title,
    artist: t.artist,
    artists: (t.artists ?? []).map((a) => ({ name: a.name, id: a.id ?? null })),
    album: t.album ?? null,
    albumId: t.albumId ?? null,
    thumbnails: slimThumbs(t.thumbnails),
    duration: t.duration ?? null,
    durationSeconds: t.durationSeconds ?? null,
    explicit: Boolean(t.explicit),
    type: t.type ?? "song",
  };
}

function mergeTracks(first: Track[], second: Track[]): Track[] {
  const seen = new Set<string>();
  const out: Track[] = [];
  for (const t of [...first, ...second]) {
    if (!t?.videoId || seen.has(t.videoId)) continue;
    seen.add(t.videoId);
    out.push(t);
  }
  return out;
}

function mergePlaylists(local: LocalPlaylist[], cloud: LocalPlaylist[]): LocalPlaylist[] {
  const byId = new Map<string, LocalPlaylist>();
  for (const p of cloud) byId.set(p.id, p);
  for (const p of local) {
    const existing = byId.get(p.id);
    byId.set(p.id, existing ? { ...existing, tracks: mergeTracks(p.tracks, existing.tracks) } : p);
  }
  return [...byId.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function snapshot(): CloudDoc {
  const lib = useLibraryStore.getState();
  const hist = useHistoryStore.getState();
  return {
    liked: lib.liked.map(slim),
    playlists: lib.playlists.map((p) => ({ ...p, tracks: p.tracks.map(slim) })),
    history: hist.recent.slice(0, MAX_HISTORY).map(slim),
    updatedAt: Date.now(),
  };
}

async function writeNow(uid: string): Promise<void> {
  const fb = getFirebase();
  if (!fb) return;
  setSync("syncing");
  try {
    // JSON round-trip strips any stray undefined values.
    const payload = JSON.parse(JSON.stringify(snapshot()));
    await setDoc(doc(fb.db, "users", uid), payload);
    setSync("saved");
  } catch {
    setSync("error");
  }
}

function schedulePush(uid: string) {
  window.clearTimeout(pushTimer);
  pushTimer = window.setTimeout(() => {
    pushTimer = undefined;
    void writeNow(uid);
  }, PUSH_DELAY_MS);
}

function applyCloud(liked: Track[], playlists: LocalPlaylist[], history: Track[]) {
  applying = true;
  try {
    useLibraryStore.setState({ liked, playlists });
    useHistoryStore.setState({ recent: history.slice(0, MAX_HISTORY) });
  } finally {
    applying = false;
  }
}

async function ensureHydrated() {
  if (!useLibraryStore.persist.hasHydrated()) await useLibraryStore.persist.rehydrate();
  if (!useHistoryStore.persist.hasHydrated()) await useHistoryStore.persist.rehydrate();
}

async function pull(uid: string, token: number, firstTime: boolean): Promise<boolean> {
  const fb = getFirebase();
  if (!fb) return false;
  const snap = await getDoc(doc(fb.db, "users", uid));
  if (token !== generation) return false;
  const cloud = snap.exists() ? (snap.data() as CloudDoc) : null;
  const lastUid = window.localStorage.getItem(SYNC_UID_KEY);
  const lib = useLibraryStore.getState();
  const hist = useHistoryStore.getState();

  if (cloud && lastUid === uid) {
    applyCloud(cloud.liked ?? [], cloud.playlists ?? [], cloud.history ?? []);
  } else if (firstTime) {
    applyCloud(
      mergeTracks(lib.liked, cloud?.liked ?? []),
      mergePlaylists(lib.playlists, cloud?.playlists ?? []),
      mergeTracks(hist.recent, cloud?.history ?? [])
    );
  }
  window.localStorage.setItem(SYNC_UID_KEY, uid);
  lastPull = Date.now();
  return true;
}

function onVisible() {
  if (document.visibilityState !== "visible" || !activeUid) return;
  if (pushTimer !== undefined || Date.now() - lastPull < STALE_PULL_MS) return;
  const uid = activeUid;
  const token = generation;
  void pull(uid, token, false).catch(() => undefined);
}

export function stopCloudSync() {
  generation += 1;
  activeUid = null;
  window.clearTimeout(pushTimer);
  pushTimer = undefined;
  unsubs.forEach((u) => u());
  unsubs = [];
  document.removeEventListener("visibilitychange", onVisible);
}

export async function startCloudSync(uid: string): Promise<void> {
  stopCloudSync();
  const token = generation;
  if (!getFirebase()) return;
  setSync("syncing");
  try {
    await ensureHydrated();
    const ok = await pull(uid, token, true);
    if (!ok || token !== generation) return;
    activeUid = uid;
    await writeNow(uid); // publishes merged guest data (and creates the doc for new accounts)
    if (token !== generation) return;
    const onChange = () => {
      if (!applying) schedulePush(uid);
    };
    unsubs = [useLibraryStore.subscribe(onChange), useHistoryStore.subscribe(onChange)];
    document.addEventListener("visibilitychange", onVisible);
  } catch {
    if (token === generation) setSync("error");
  }
}

/** Sign out: flush pending changes, sign out, then wipe local data from this device. */
export async function signOutAndClear(): Promise<void> {
  const uid = activeUid;
  if (uid && pushTimer !== undefined) {
    window.clearTimeout(pushTimer);
    pushTimer = undefined;
    await writeNow(uid);
  }
  stopCloudSync();
  await useAuthStore.getState().signOut();
  applyCloud([], [], []);
  useRecommendStore.getState().clear();
  window.localStorage.removeItem(SYNC_UID_KEY);
}
