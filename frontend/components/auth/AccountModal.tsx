"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { Camera, Check, Lock, RefreshCw, Trash2, TriangleAlert, X } from "lucide-react";
import { Avatar } from "@/components/auth/Avatar";
import { AVATAR_ACCEPT, MAX_GIF_BYTES, avatarErrorMessage, prepareAvatar } from "@/lib/avatar";
import { PasswordRequiredError, deleteAccountAndClear } from "@/lib/cloudSync";
import { MAX_NAME_LENGTH, friendlyAuthError, useAuthStore } from "@/store/useAuthStore";
import { useUiStore } from "@/store/useUiStore";

const FIELD =
  "flex h-12 items-center gap-3 rounded-full bg-chip px-5 ring-1 ring-transparent transition-shadow focus-within:ring-lime";
const INPUT = "h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted";
const QUIET = ["auth/popup-closed-by-user", "auth/cancelled-popup-request"];

/** Account settings: change name, change/remove profile picture (GIFs stay animated), delete account. */
export function AccountModal() {
  const open = useUiStore((s) => s.accountOpen);
  const setOpen = useUiStore((s) => s.setAccountOpen);
  const user = useAuthStore((s) => s.user);
  const status = useAuthStore((s) => s.status);
  const updateName = useAuthStore((s) => s.updateName);
  const setAvatar = useAuthStore((s) => s.setAvatar);

  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [nameBusy, setNameBusy] = useState(false);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoMsg, setPhotoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState("");
  const [delBusy, setDelBusy] = useState(false);
  const [delError, setDelError] = useState<string | null>(null);

  // Fresh state every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setName(useAuthStore.getState().user?.name ?? "");
    setNameMsg(null);
    setPhotoMsg(null);
    setConfirming(false);
    setPassword("");
    setDelError(null);
  }, [open]);

  useEffect(() => {
    if (open && status !== "signed-in") setOpen(false);
  }, [open, status, setOpen]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !delBusy && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, delBusy, setOpen]);

  if (!open || !user) return null;
  const close = () => !delBusy && setOpen(false);
  const nameChanged = name.trim().replace(/\s+/g, " ") !== user.name;

  const onSaveName = async (e: FormEvent) => {
    e.preventDefault();
    if (!nameChanged || nameBusy) return;
    setNameBusy(true);
    setNameMsg(null);
    try {
      await updateName(name);
      setNameMsg({ ok: true, text: "Name updated." });
    } catch (err) {
      setNameMsg({ ok: false, text: (err as { code?: string }).code ? friendlyAuthError(err) : (err as Error).message });
    } finally {
      setNameBusy(false);
    }
  };

  const onPickFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // so picking the same file again still fires
    if (!file) return;
    setPhotoBusy(true);
    setPhotoMsg(null);
    try {
      await setAvatar(await prepareAvatar(file));
      setPhotoMsg({ ok: true, text: "Profile picture updated." });
    } catch (err) {
      setPhotoMsg({ ok: false, text: avatarErrorMessage(err) });
    } finally {
      setPhotoBusy(false);
    }
  };

  const onRemovePhoto = async () => {
    setPhotoBusy(true);
    setPhotoMsg(null);
    try {
      await setAvatar(null);
      setPhotoMsg({ ok: true, text: "Profile picture removed." });
    } catch (err) {
      setPhotoMsg({ ok: false, text: avatarErrorMessage(err) });
    } finally {
      setPhotoBusy(false);
    }
  };

  const onDelete = async (e: FormEvent) => {
    e.preventDefault();
    if (delBusy) return;
    setDelBusy(true);
    setDelError(null);
    try {
      await deleteAccountAndClear(user.hasPassword ? password : undefined);
      setOpen(false);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? "";
      if (QUIET.includes(code)) {
        // closed the Google window: nothing to report
      } else if (err instanceof PasswordRequiredError) {
        setDelError(err.message);
      } else if (code === "auth/wrong-password" || code === "auth/invalid-credential" || code === "auth/invalid-login-credentials") {
        setDelError("That password isn't right.");
      } else {
        setDelError(code ? friendlyAuthError(err) : "Couldn't delete your account. Please try again.");
      }
    } finally {
      setDelBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Account settings">
      <button type="button" aria-label="Close" className="absolute inset-0 animate-fade cursor-default bg-black/70" onClick={close} />
      <div className="scroll-area scrollbar-thin relative max-h-[92dvh] w-full max-w-md animate-sheet overflow-y-auto rounded-t-[32px] bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl shadow-black/60 sm:rounded-[32px] sm:p-8">
        <button type="button" aria-label="Close" onClick={close} className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-chip text-muted transition-colors hover:text-white">
          <X className="h-5 w-5" />
        </button>

        <h2 className="text-xl font-semibold">Account settings</h2>
        {user.email && <p className="mt-1 truncate pr-12 text-sm text-muted">{user.email}</p>}

        {/* Profile picture */}
        <section className="mt-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Avatar user={user} className="h-20 w-20 text-3xl" />
              {photoBusy && (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
                  <RefreshCw className="spinner h-5 w-5" />
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={photoBusy}
                onClick={() => fileRef.current?.click()}
                className="flex h-10 items-center gap-2 rounded-full bg-lime px-4 text-sm font-semibold text-ink transition-transform active:scale-95 disabled:opacity-60"
              >
                <Camera className="h-4 w-4" />
                {user.customPhoto ? "Change" : "Add photo"}
              </button>
              {user.customPhoto && (
                <button
                  type="button"
                  disabled={photoBusy}
                  onClick={() => void onRemovePhoto()}
                  className="h-10 rounded-full bg-chip px-4 text-sm font-medium transition-colors hover:bg-white/15 disabled:opacity-60"
                >
                  Remove
                </button>
              )}
            </div>
            <input ref={fileRef} type="file" accept={AVATAR_ACCEPT} onChange={onPickFile} className="hidden" />
          </div>
          <p className="mt-2.5 text-xs text-muted">
            PNG, JPG, WebP or GIF. Animated GIFs up to {Math.round(MAX_GIF_BYTES / 1024)} KB keep their animation.
          </p>
          {photoMsg && (
            <p className={`mt-2 text-sm ${photoMsg.ok ? "text-emerald-300" : "text-red-300"}`} role={photoMsg.ok ? "status" : "alert"}>
              {photoMsg.text}
            </p>
          )}
        </section>

        {/* Name */}
        <form onSubmit={onSaveName} className="mt-6" noValidate>
          <label htmlFor="acct-name" className="mb-2 block text-sm font-medium text-muted">
            Display name
          </label>
          <div className="flex gap-2.5">
            <div className={`${FIELD} min-w-0 flex-1`}>
              <input
                id="acct-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameMsg(null);
                }}
                maxLength={MAX_NAME_LENGTH}
                autoComplete="nickname"
                className={INPUT}
              />
            </div>
            <button
              type="submit"
              disabled={!nameChanged || nameBusy || !name.trim()}
              className="flex h-12 shrink-0 items-center gap-2 rounded-full bg-lime px-5 text-sm font-semibold text-ink transition-transform active:scale-95 disabled:opacity-40"
            >
              {nameBusy ? <RefreshCw className="spinner h-4 w-4" /> : <Check className="h-4 w-4" strokeWidth={2.6} />}
              Save
            </button>
          </div>
          {nameMsg && (
            <p className={`mt-2 text-sm ${nameMsg.ok ? "text-emerald-300" : "text-red-300"}`} role={nameMsg.ok ? "status" : "alert"}>
              {nameMsg.text}
            </p>
          )}
        </form>

        {/* Danger zone */}
        <section className="mt-8 rounded-3xl bg-red-500/10 p-5">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-red-200">
            <TriangleAlert className="h-4 w-4" />
            Delete account
          </h3>
          {!confirming ? (
            <>
              <p className="mt-2 text-sm text-red-100/70">
                Permanently removes your account, favourites, playlists, saved albums and listening history from every device.
              </p>
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="mt-4 flex h-11 items-center gap-2 rounded-full bg-red-500/20 px-5 text-sm font-semibold text-red-200 transition-colors hover:bg-red-500/30"
              >
                <Trash2 className="h-4 w-4" />
                Delete my account
              </button>
            </>
          ) : (
            <form onSubmit={onDelete} className="mt-2 space-y-3" noValidate>
              <p className="text-sm text-red-100/80">
                This can&apos;t be undone.{" "}
                {user.hasPassword ? "Enter your password to confirm." : "You'll be asked to confirm with Google."}
              </p>
              {user.hasPassword && (
                <label className={FIELD}>
                  <Lock className="h-4 w-4 shrink-0 text-muted" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Your password"
                    autoComplete="current-password"
                    autoFocus
                    className={INPUT}
                  />
                </label>
              )}
              {delError && (
                <p className="text-sm text-red-300" role="alert">
                  {delError}
                </p>
              )}
              <div className="flex gap-2.5">
                <button
                  type="submit"
                  disabled={delBusy || (user.hasPassword && !password)}
                  className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-red-500 px-5 text-sm font-semibold text-white transition-transform active:scale-95 disabled:opacity-50"
                >
                  {delBusy ? <RefreshCw className="spinner h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                  Delete forever
                </button>
                <button
                  type="button"
                  disabled={delBusy}
                  onClick={() => {
                    setConfirming(false);
                    setPassword("");
                    setDelError(null);
                  }}
                  className="h-11 rounded-full bg-chip px-5 text-sm font-medium transition-colors hover:bg-white/15 disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
