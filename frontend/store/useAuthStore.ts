"use client";

import { create } from "zustand";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { loadAvatar, removeAvatar, saveAvatar } from "@/lib/avatar";
import { firebaseConfigured, getFirebase } from "@/lib/firebase";

export type AccountUser = {
  uid: string;
  email: string | null;
  name: string;
  /** The picture to show: the custom one if set, otherwise the Google photo (or null). */
  photoURL: string | null;
  /** True when photoURL is a picture the user uploaded here. */
  customPhoto: boolean;
  /** Signs in with an email + password (needed to re-confirm before deleting the account). */
  hasPassword: boolean;
};

export type SyncState = "idle" | "syncing" | "saved" | "error";

type AuthState = {
  /** "loading" until Firebase has told us whether someone is signed in. */
  status: "loading" | "guest" | "signed-in";
  user: AccountUser | null;
  configured: boolean;
  sync: SyncState;
  setSync: (s: SyncState) => void;
  init: () => void;
  signInEmail: (email: string, password: string) => Promise<void>;
  signUpEmail: (name: string, email: string, password: string) => Promise<void>;
  signInGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateName: (name: string) => Promise<void>;
  /** Save a new profile picture (a data URL), or pass null to go back to the default. */
  setAvatar: (dataUrl: string | null) => Promise<void>;
  /** Called once the account has been deleted. */
  afterDeleted: () => void;
};

export const MAX_NAME_LENGTH = 40;

function toAccount(u: User): AccountUser {
  const fallback = u.email ? u.email.split("@")[0] : "Listener";
  return {
    uid: u.uid,
    email: u.email,
    name: u.displayName?.trim() || fallback,
    photoURL: u.photoURL,
    customPhoto: false,
    hasPassword: u.providerData.some((p) => p.providerId === "password"),
  };
}

/** Turns Firebase error codes into sentences a person can act on. */
export function friendlyAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-email":
      return "That email address doesn't look right.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "Incorrect email or password.";
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try signing in instead.";
    case "auth/weak-password":
      return "Choose a stronger password (at least 6 characters).";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a minute and try again.";
    case "auth/network-request-failed":
      return "Network problem. Check your connection and try again.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in window. Allow pop-ups for this site and try again.";
    case "auth/unauthorized-domain":
      return "This website isn't authorised for sign-in yet (add it under Firebase \u2192 Authentication \u2192 Settings \u2192 Authorized domains).";
    case "auth/operation-not-allowed":
      return "This sign-in method isn't enabled in Firebase yet.";
    case "auth/requires-recent-login":
      return "For your security, please sign out, sign back in, and try again.";
    case "auth/user-mismatch":
      return "That's a different account from the one you're signed in with.";
    case "auth/credential-already-in-use":
      return "That sign-in is already linked to another account.";
    default:
      return "Something went wrong. Please try again.";
  }
}

let started = false;

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "loading",
  user: null,
  configured: firebaseConfigured,
  sync: "idle",
  setSync: (sync) => set({ sync }),

  init: () => {
    if (started) return;
    started = true;
    const fb = getFirebase();
    if (!fb) {
      set({ status: "guest", user: null });
      return;
    }
    onAuthStateChanged(fb.auth, (u) => {
      if (!u) {
        set({ status: "guest", user: null });
        return;
      }
      set({ status: "signed-in", user: toAccount(u) });
      // The custom picture lives in Firestore: fetch it after the page is already usable.
      void loadAvatar(u.uid)
        .then((url) => {
          const cur = get().user;
          if (url && cur && cur.uid === u.uid) set({ user: { ...cur, photoURL: url, customPhoto: true } });
        })
        .catch(() => undefined);
    });
  },

  signInEmail: async (email, password) => {
    const fb = getFirebase();
    if (!fb) throw new Error("Accounts are not set up.");
    await signInWithEmailAndPassword(fb.auth, email.trim(), password);
  },

  signUpEmail: async (name, email, password) => {
    const fb = getFirebase();
    if (!fb) throw new Error("Accounts are not set up.");
    const cred = await createUserWithEmailAndPassword(fb.auth, email.trim(), password);
    if (name.trim()) {
      await updateProfile(cred.user, { displayName: name.trim() });
      set({ user: toAccount(cred.user), status: "signed-in" });
    }
  },

  signInGoogle: async () => {
    const fb = getFirebase();
    if (!fb) throw new Error("Accounts are not set up.");
    await signInWithPopup(fb.auth, new GoogleAuthProvider());
  },

  resetPassword: async (email) => {
    const fb = getFirebase();
    if (!fb) throw new Error("Accounts are not set up.");
    await sendPasswordResetEmail(fb.auth, email.trim());
  },

  signOut: async () => {
    const fb = getFirebase();
    if (fb) await firebaseSignOut(fb.auth);
    set({ user: null, status: "guest", sync: "idle" });
  },

  updateName: async (name) => {
    const fb = getFirebase();
    const u = fb?.auth.currentUser;
    if (!u) throw new Error("You're not signed in.");
    const clean = name.trim().replace(/\s+/g, " ");
    if (!clean) throw new Error("Enter a name.");
    if (clean.length > MAX_NAME_LENGTH) throw new Error(`Keep your name under ${MAX_NAME_LENGTH} characters.`);
    await updateProfile(u, { displayName: clean });
    const cur = get().user;
    if (cur && cur.uid === u.uid) set({ user: { ...cur, name: clean } });
  },

  setAvatar: async (dataUrl) => {
    const fb = getFirebase();
    const u = fb?.auth.currentUser;
    if (!u) throw new Error("You're not signed in.");
    if (dataUrl) await saveAvatar(u.uid, dataUrl);
    else await removeAvatar(u.uid);
    const cur = get().user;
    if (cur && cur.uid === u.uid) {
      set({ user: { ...cur, photoURL: dataUrl ?? u.photoURL, customPhoto: Boolean(dataUrl) } });
    }
  },

  afterDeleted: () => set({ user: null, status: "guest", sync: "idle" }),
}));
