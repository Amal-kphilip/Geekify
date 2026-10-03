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
import { firebaseConfigured, getFirebase } from "@/lib/firebase";

export type AccountUser = {
  uid: string;
  email: string | null;
  name: string;
  photoURL: string | null;
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
};

function toAccount(u: User): AccountUser {
  const fallback = u.email ? u.email.split("@")[0] : "Listener";
  return { uid: u.uid, email: u.email, name: u.displayName?.trim() || fallback, photoURL: u.photoURL };
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
    default:
      return "Something went wrong. Please try again.";
  }
}

let started = false;

export const useAuthStore = create<AuthState>((set) => ({
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
      set(u ? { status: "signed-in", user: toAccount(u) } : { status: "guest", user: null });
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
}));
