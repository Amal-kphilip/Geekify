"use client";

import { EmailAuthProvider, GoogleAuthProvider, deleteUser, reauthenticateWithCredential, reauthenticateWithPopup } from "firebase/auth";
import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";
import { useAuthStore, type SyncState } from "@/store/useAuthStore";
import { useHistoryStore } from "@/store/useHistoryStore";
import { useLibraryStore } from "@/store/useLibraryStore";
import { useRecommendStore } from "@/store/useRecommendStore";
import type { LocalPlaylist, SavedCollection, Track } from "@/lib/types";
import { savedKey, slimThumbnails } from "@/lib/types";

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

type CloudDoc = {
  liked?: Track[];
  playlists?: LocalPlaylist[];
  history?: Track[];
  saved?: SavedCollection[];
  updatedAt?: number;
};

let generation = 0;
let activeUid: string | null = null;
let pushTimer: number | undefined;
let unsubs: Array<() => void> = [];
let applying = false;
let lastPull = 0;

const setSync = (s: SyncState) => useAuthStore.getState().setSync(s);

/** Firestore rejects undefined and has a 1 MB document cap, so store compact tracks. */
function slim(t: Track): Track {
  return {
    videoId: t.videoId,
    title: t.title,
    artist: t.artist,
    artists: (t.artists ?? []).map((a) => ({ name: a.name, id: a.id ?? null })),
    album: t.album ?? null,
    albumId: t.albumId ?? null,
    thumbnails: slimThumbnails(t.thumbnails),
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

function mergeSaved(local: SavedCollection[], cloud: SavedCollection[]): SavedCollection[] {
  const byKey = new Map<string, SavedCollection>();
  for (const c of [...cloud, ...local]) if (c?.id && !byKey.has(savedKey(c))) byKey.set(savedKey(c), c);
  return [...byKey.values()].sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
}

function snapshot(): CloudDoc {
  const lib = useLibraryStore.getState();
  const hist = useHistoryStore.getState();
  return {
    liked: lib.liked.map(slim),
    playlists: lib.playlists.map((p) => ({ ...p, tracks: p.tracks.map(slim) })),
    history: hist.recent.slice(0, MAX_HISTORY).map(slim),
    saved: lib.saved.map((c) => ({
      id: c.id,
      type: c.type,
      title: c.title,
      subtitle: c.subtitle ?? null,
      thumbnails: slimThumbnails(c.thumbnails),
      savedAt: c.savedAt,
    })),
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

function applyCloud(liked: Track[], playlists: LocalPlaylist[], history: Track[], saved: SavedCollection[]) {
  applying = true;
  try {
    useLibraryStore.setState({ liked, playlists, saved });
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
    // Older cloud documents have no "saved" list: keep what's on this device rather than wiping it.
    applyCloud(cloud.liked ?? [], cloud.playlists ?? [], cloud.history ?? [], cloud.saved ?? lib.saved);
  } else if (firstTime) {
    applyCloud(
      mergeTracks(lib.liked, cloud?.liked ?? []),
      mergePlaylists(lib.playlists, cloud?.playlists ?? []),
      mergeTracks(hist.recent, cloud?.history ?? []),
      mergeSaved(lib.saved, cloud?.saved ?? [])
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
  applyCloud([], [], [], []);
  useRecommendStore.getState().clear();
  window.localStorage.removeItem(SYNC_UID_KEY);
}

/** Thrown when an email/password account tries to delete itself without typing the password. */
export class PasswordRequiredError extends Error {
  code = "geekify/password-required";
  constructor() {
    super("Enter your password to confirm.");
  }
}

/**
 * Permanently delete the signed-in account: re-confirm identity (Firebase requires a recent
 * login), erase the cloud copy of the library + picture, delete the login itself, then wipe
 * this device. Sync is stopped first so nothing re-creates the cloud document.
 */
export async function deleteAccountAndClear(password?: string): Promise<void> {
  const fb = getFirebase();
  const user = fb?.auth.currentUser;
  if (!fb || !user) throw new Error("You're not signed in.");
  const uid = user.uid;

  // 1) Prove it's really them (nothing is touched until this succeeds).
  if (user.providerData.some((p) => p.providerId === "password") && user.email) {
    if (!password) throw new PasswordRequiredError();
    await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
  } else {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
  }

  // 2) Stop syncing, then erase cloud data while the rules still recognise this user.
  stopCloudSync();
  try {
    await deleteDoc(doc(fb.db, "users", uid, "profile", "avatar")).catch(() => undefined);
    await deleteDoc(doc(fb.db, "users", uid));
    // 3) Finally the login itself.
    await deleteUser(user);
  } catch (e) {
    // Still signed in with local data intact: resume syncing (it re-publishes the library) and report.
    void startCloudSync(uid);
    throw e;
  }

  // 4) Wipe this device.
  useAuthStore.getState().afterDeleted();
  applyCloud([], [], [], []);
  useRecommendStore.getState().clear();
  window.localStorage.removeItem(SYNC_UID_KEY);
}
