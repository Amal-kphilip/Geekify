import { deleteDoc, doc, getDoc, setDoc } from "firebase/firestore";
import { getFirebase } from "@/lib/firebase";

/**
 * Profile pictures live in Firestore (users/{uid}/profile/avatar) as a data URL, so no paid
 * Firebase Storage bucket is needed. A Firestore document is capped at 1 MiB and base64 adds a
 * third on top, hence the limits below.
 *
 *  - PNG / JPG / WebP are centre-cropped and shrunk to 256x256 (a few KB).
 *  - GIFs are stored untouched: re-drawing them on a canvas would freeze the animation.
 */
export const AVATAR_PX = 256;
export const MAX_GIF_BYTES = 600 * 1024;
const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const AVATAR_ACCEPT = ACCEPTED.join(",");

export class AvatarError extends Error {}

const avatarRef = (uid: string) => {
  const fb = getFirebase();
  return fb ? doc(fb.db, "users", uid, "profile", "avatar") : null;
};

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new AvatarError("Couldn't read that file."));
    r.readAsDataURL(blob);
  });
}

async function isGif(file: File): Promise<boolean> {
  const head = new Uint8Array(await file.slice(0, 6).arrayBuffer());
  return String.fromCharCode(...head).startsWith("GIF8");
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new AvatarError("That doesn't look like a valid image."));
    };
    img.src = url;
  });
}

/** Validate a picked file and turn it into the data URL we store. Throws AvatarError with a readable message. */
export async function prepareAvatar(file: File): Promise<string> {
  if (!ACCEPTED.includes(file.type)) throw new AvatarError("Choose a PNG, JPG, WebP or GIF image.");

  if (file.type === "image/gif") {
    if (!(await isGif(file))) throw new AvatarError("That file isn't a real GIF.");
    if (file.size > MAX_GIF_BYTES) {
      const kb = Math.round(file.size / 1024);
      throw new AvatarError(`That GIF is ${kb} KB. Pick one under ${Math.round(MAX_GIF_BYTES / 1024)} KB so it can be saved.`);
    }
    return readAsDataUrl(file);
  }

  if (file.size > MAX_INPUT_BYTES) throw new AvatarError("That image is too large. Pick one under 10 MB.");
  const img = await loadImage(file);
  const side = Math.min(img.naturalWidth, img.naturalHeight);
  if (!side) throw new AvatarError("That doesn't look like a valid image.");

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = AVATAR_PX;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AvatarError("Your browser can't process images.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, AVATAR_PX, AVATAR_PX);

  let url = canvas.toDataURL("image/webp", 0.86);
  if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", 0.88); // Safari can't encode WebP
  return url;
}

export async function loadAvatar(uid: string): Promise<string | null> {
  const ref = avatarRef(uid);
  if (!ref) return null;
  const snap = await getDoc(ref);
  const url = snap.exists() ? (snap.data() as { dataUrl?: string }).dataUrl : null;
  return typeof url === "string" && url.startsWith("data:image/") ? url : null;
}

export async function saveAvatar(uid: string, dataUrl: string): Promise<void> {
  const ref = avatarRef(uid);
  if (!ref) throw new AvatarError("Accounts are not set up.");
  await setDoc(ref, { dataUrl, updatedAt: Date.now() });
}

export async function removeAvatar(uid: string): Promise<void> {
  const ref = avatarRef(uid);
  if (ref) await deleteDoc(ref);
}

/** Human message for the errors people actually hit when saving a picture. */
export function avatarErrorMessage(e: unknown): string {
  if (e instanceof AvatarError) return e.message;
  const code = (e as { code?: string })?.code ?? "";
  if (code === "permission-denied") {
    return "Profile pictures need the updated Firestore rules. Publish firestore.rules from the project in the Firebase console, then try again.";
  }
  if (code === "unavailable" || code === "network-request-failed") return "Network problem. Check your connection and try again.";
  return "Couldn't save your picture. Please try again.";
}
