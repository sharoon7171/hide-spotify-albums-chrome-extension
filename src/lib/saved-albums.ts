import { albumIdFromPathname } from "@/lib/spotify-album-url";

export type SavedAlbum = {
  savedAt: number;
  url?: string;
  title?: string;
};

export function albumIdFromSavedAlbum(a: SavedAlbum): string | null {
  if (a.url) {
    try {
      const u = new URL(a.url);
      if (u.hostname !== "open.spotify.com") return null;
      return albumIdFromPathname(u.pathname);
    } catch {
      return null;
    }
  }
  return null;
}

export function getHiddenAlbumIds(albums: Iterable<SavedAlbum>): Set<string> {
  const s = new Set<string>();
  for (const a of albums) {
    const id = albumIdFromSavedAlbum(a);
    if (id) s.add(id);
  }
  return s;
}

export function docIdForSavedAlbum(a: SavedAlbum): string {
  const id = albumIdFromSavedAlbum(a);
  if (id) return id;
  const title = (a.title ?? "").trim();
  return `t-${encodeBase36(title)}`;
}

function encodeBase36(input: string): string {
  let hash = 0n;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 131n + BigInt(input.charCodeAt(i))) & 0xffffffffffffffffn;
  }
  const hex = hash.toString(36);
  return hex || "0";
}
