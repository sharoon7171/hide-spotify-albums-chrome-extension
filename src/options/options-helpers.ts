import {
  albumIdFromSavedAlbum,
  type SavedAlbum,
} from "@/lib/saved-albums";

export function savedAlbumRowKey(a: SavedAlbum): string {
  const id = albumIdFromSavedAlbum(a);
  if (id) return id;
  return `t:${a.savedAt}:${a.title ?? ""}`;
}

export function sortedAlbums(list: SavedAlbum[]): SavedAlbum[] {
  return [...list].sort((a, b) => b.savedAt - a.savedAt);
}

export function formatSavedAt(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(ts);
  } catch {
    return "";
  }
}

export function displayTitle(a: SavedAlbum): string {
  if (a.title?.trim()) return a.title.trim();
  const id = albumIdFromSavedAlbum(a);
  if (id) return id;
  return "Untitled";
}
