"use client";

import { FormEvent, useEffect, useState } from "react";
import { Eye, EyeOff, Lock, Mail, RefreshCw, User, X } from "lucide-react";
import { friendlyAuthError, useAuthStore } from "@/store/useAuthStore";
import { useUiStore } from "@/store/useUiStore";

type Mode = "signin" | "signup";

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.3-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.9z" />
    </svg>
  );
}

const FIELD =
  "flex h-12 items-center gap-3 rounded-2xl bg-white/[0.06] px-4 ring-1 ring-white/10 transition focus-within:ring-brand";
const INPUT = "h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[#9d9bbd]";

export function AuthModal() {
  const open = useUiStore((s) => s.authOpen);
  const setOpen = useUiStore((s) => s.setAuthOpen);
  const configured = useAuthStore((s) => s.configured);
  const signInEmail = useAuthStore((s) => s.signInEmail);
  const signUpEmail = useAuthStore((s) => s.signUpEmail);
  const signInGoogle = useAuthStore((s) => s.signInGoogle);
  const resetPassword = useAuthStore((s) => s.resetPassword);
  const status = useAuthStore((s) => s.status);

  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // Close on success, and on Escape.
  useEffect(() => {
    if (status === "signed-in" && open) setOpen(false);
  }, [status, open, setOpen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  useEffect(() => {
    if (open) {
      setError(null);
      setInfo(null);
      setPassword("");
    }
  }, [open, mode]);

  if (!open) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (e) {
      const code = (e as { code?: string })?.code;
      if (code !== "auth/popup-closed-by-user" && code !== "auth/cancelled-popup-request") {
        setError(friendlyAuthError(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return setError("Enter your email and password.");
    if (mode === "signup" && password.length < 6) return setError("Password must be at least 6 characters.");
    void run(() => (mode === "signin" ? signInEmail(email, password) : signUpEmail(name, email, password)));
  };

  const onReset = () => {
    if (!email.trim()) return setError("Type your email above first, then tap \u201cForgot password\u201d.");
    void run(async () => {
      await resetPassword(email);
      setInfo("If an account exists for that email, a reset link is on its way.");
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Sign in">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="glass-strong relative w-full max-w-md rounded-t-3xl p-6 shadow-2xl sm:rounded-3xl sm:p-8">
        <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="absolute right-4 top-4 rounded-full p-2 text-[#aeabcf] transition hover:bg-white/10 hover:text-white">
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6">
          <div className="accent-text text-2xl font-bold tracking-tight">Geekify</div>
          <h2 className="mt-1 text-xl font-semibold">{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
          <p className="mt-1 text-sm text-[#aeabcf]">
            Keep your favourites, playlists and mixes on every device.
          </p>
        </div>

        {!configured ? (
          <div className="rounded-2xl bg-amber-400/10 p-4 text-sm text-amber-200" role="alert">
            Accounts aren&apos;t set up on this site yet. The owner needs to add the Firebase settings
            (see the README), then redeploy. You can keep using Geekify as a guest in the meantime.
          </div>
        ) : (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(signInGoogle)}
              className="flex h-12 w-full items-center justify-center gap-3 rounded-2xl bg-white text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
            >
              <GoogleMark />
              Continue with Google
            </button>

            <div className="my-5 flex items-center gap-3 text-xs text-[#9d9bbd]">
              <span className="h-px flex-1 bg-white/10" />
              or use email
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <form onSubmit={onSubmit} className="space-y-3" noValidate>
              {mode === "signup" && (
                <label className={FIELD}>
                  <User className="h-4 w-4 shrink-0 text-[#9d9bbd]" />
                  <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" autoComplete="nickname" className={INPUT} />
                </label>
              )}
              <label className={FIELD}>
                <Mail className="h-4 w-4 shrink-0 text-[#9d9bbd]" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" autoComplete="email" className={INPUT} />
              </label>
              <label className={FIELD}>
                <Lock className="h-4 w-4 shrink-0 text-[#9d9bbd]" />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  className={INPUT}
                />
                <button type="button" aria-label={showPw ? "Hide password" : "Show password"} onClick={() => setShowPw((v) => !v)} className="text-[#9d9bbd] hover:text-white">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </label>

              {error && <p className="text-sm text-rose-300" role="alert">{error}</p>}
              {info && <p className="text-sm text-emerald-300" role="status">{info}</p>}

              <button
                type="submit"
                disabled={busy}
                className="accent-bg flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold text-black transition hover:brightness-110 disabled:opacity-60"
              >
                {busy && <RefreshCw className="spinner h-4 w-4" />}
                {mode === "signin" ? "Sign in" : "Create account"}
              </button>
            </form>

            <div className="mt-4 flex items-center justify-between text-sm text-[#aeabcf]">
              {mode === "signin" ? (
                <>
                  <button type="button" onClick={onReset} className="hover:text-white hover:underline">Forgot password?</button>
                  <button type="button" onClick={() => setMode("signup")} className="font-semibold text-white hover:underline">Create account</button>
                </>
              ) : (
                <>
                  <span>Already have an account?</span>
                  <button type="button" onClick={() => setMode("signin")} className="font-semibold text-white hover:underline">Sign in</button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
