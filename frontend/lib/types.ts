export type Thumbnail = {
  url: string;
  width?: number | null;
  height?: number | null;
};

export type ArtistRef = {
  name: string;
  id?: string | null;
};

export type Track = {
  videoId: string;
  title: string;
  artist: string;
  artists: ArtistRef[];
  album?: string | null;
  albumId?: string | null;
  thumbnails: Thumbnail[];
  duration?: string | null;
  durationSeconds?: number | null;
  explicit?: boolean;
  type?: "song" | "video";
};

export type Card = {
  id: string;
  title: string;
  subtitle?: string | null;
  thumbnails: Thumbnail[];
  type: "album" | "playlist" | "artist" | "song" | "station";
  videoId?: string | null;
  playlistId?: string | null;
  browseId?: string | null;
};

export type Shelf = {
  title: string;
  items: Array<Card | Track>;
};

export type SearchResponse = {
  query: string;
  songs: Track[];
  albums: Card[];
  artists: Card[];
  playlists: Card[];
  shelves: Shelf[];
};

export type HomeResponse = { shelves: Shelf[] };

export type Mix = {
  id: string;
  title: string;
  subtitle: string;
  tracks: Track[];
};

export type MixResponse = { mixes: Mix[]; seeds: string[] };

export type ArtistPage = {
  id: string;
  name: string;
  description?: string | null;
  thumbnails: Thumbnail[];
  songs: Track[];
  albums: Card[];
  singles: Card[];
  related: Card[];
};

export type CollectionPage = {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  type: "album" | "playlist";
  year?: string | null;
  thumbnails: Thumbnail[];
  tracks: Track[];
  artist?: string | null;
  artistId?: string | null;
};

export type LocalPlaylist = {
  id: string;
  name: string;
  tracks: Track[];
  createdAt: number;
};

/** An album or playlist from YouTube Music that the user saved to their library (metadata only; tracks load on open). */
export type SavedCollection = {
  /** The id used in the page URL (/album/{id} or /playlist/{id}). */
  id: string;
  type: "album" | "playlist";
  title: string;
  subtitle?: string | null;
  thumbnails: Thumbnail[];
  savedAt: number;
};

export const savedKey = (c: Pick<SavedCollection, "type" | "id">) => `${c.type}:${c.id}`;

/** Keep just the smallest + largest thumbnail: plenty for a cover, and tiny in storage. */
export function slimThumbnails(thumbs: Thumbnail[] | undefined): Thumbnail[] {
  if (!thumbs?.length) return [];
  const sorted = [...thumbs].sort((a, b) => (a.width || 0) - (b.width || 0));
  const pick = sorted.length > 1 ? [sorted[0], sorted[sorted.length - 1]] : sorted;
  return pick.map((t) => ({ url: t.url, width: t.width ?? null, height: t.height ?? null }));
}

export function isTrack(item: Card | Track): item is Track {
  return "videoId" in item && Boolean((item as Track).videoId) && "artist" in item;
}

const SUBTITLE_NOISE = new Set(["song", "songs", "video", "videos", "single", "ep"]);

/** True for a song that arrived as a card (type "song" + videoId) rather than as a full Track. */
export function isSongCard(item: Card | Track): item is Card & { videoId: string } {
  return !isTrack(item) && (item as Card).type === "song" && Boolean((item as Card).videoId);
}

/** "Song \u2022 Artist \u2022 12M plays" -> "Artist" */
function artistFromSubtitle(subtitle?: string | null): string {
  const parts = (subtitle ?? "")
    .split("\u2022")
    .map((p) => p.trim())
    .filter((p) => p && !SUBTITLE_NOISE.has(p.toLowerCase()) && !/\b(plays?|views?)$/i.test(p));
  return parts[0] ?? "Unknown";
}

/**
 * Anything playable as a Track, or null for albums / playlists / artists.
 * The feed can describe the same song either as a Track or as a "song" card, so every
 * "is this a song?" decision goes through here.
 */
export function toTrack(item: Card | Track): Track | null {
  if (isTrack(item)) return item;
  if (isSongCard(item)) {
    return {
      videoId: item.videoId,
      title: item.title,
      artist: artistFromSubtitle(item.subtitle),
      artists: [],
      thumbnails: item.thumbnails,
      type: "song",
    };
  }
  return null;
}

export function artUrl(thumbs: Thumbnail[] | undefined, size = 300): string | undefined {
  if (!thumbs?.length) return undefined;
  const sorted = [...thumbs].sort((a, b) => (b.width || 0) - (a.width || 0));
  const fit = [...sorted].reverse().find((t) => (t.width || 0) >= size) || sorted[0];
  return fit?.url;
}

export function proxiedArt(url?: string | null): string | undefined {
  if (!url) return undefined;
  return `/api/thumb?u=${encodeURIComponent(url)}`;
}
