import {
  albumIdFromPathname,
  normalizeOpenSpotifyAlbumUrl,
  spotifyAlbumUrl,
} from "@/lib/spotify-album-url";

export const SAVED_ALBUMS_KEY = "savedAlbums";

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

export function getHiddenAlbumIds(albums: SavedAlbum[]): Set<string> {
  const s = new Set<string>();
  for (const a of albums) {
    const id = albumIdFromSavedAlbum(a);
    if (id) s.add(id);
  }
  return s;
}

function migrateEntry(raw: unknown): SavedAlbum | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const savedAt = typeof o.savedAt === "number" ? o.savedAt : Date.now();
  const title =
    typeof o.title === "string" && o.title.length > 0 ? o.title : undefined;
  if (typeof o.url === "string") {
    const nu = normalizeOpenSpotifyAlbumUrl(o.url);
    if (nu) return { savedAt, url: nu, title };
  }
  if (typeof o.id === "string" && o.id.length > 0) {
    return { savedAt, url: spotifyAlbumUrl(o.id), title };
  }
  if (title) return { savedAt, title };
  return null;
}

export async function getSavedAlbums(): Promise<SavedAlbum[]> {
  const r = await chrome.storage.local.get(SAVED_ALBUMS_KEY);
  const v = r[SAVED_ALBUMS_KEY];
  if (!Array.isArray(v)) return [];
  const next = v.map(migrateEntry).filter((x): x is SavedAlbum => x != null);
  if (JSON.stringify(v) !== JSON.stringify(next)) {
    await chrome.storage.local.set({ [SAVED_ALBUMS_KEY]: next });
  }
  return next;
}

export async function setSavedAlbums(albums: SavedAlbum[]): Promise<void> {
  await chrome.storage.local.set({ [SAVED_ALBUMS_KEY]: albums });
}
