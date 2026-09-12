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

export function isTrack(item: Card | Track): item is Track {
  return "videoId" in item && Boolean((item as Track).videoId) && "artist" in item;
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
