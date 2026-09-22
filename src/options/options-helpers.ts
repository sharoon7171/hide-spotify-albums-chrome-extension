import {
  albumIdFromSavedAlbum,
  type SavedAlbum,
} from "@/lib/saved-albums";

export function sortedAlbums<T extends SavedAlbum>(list: T[]): T[] {
  return [...list].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function formatUpdatedAt(ts: number): string {
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
  return "Untitled album";
}
