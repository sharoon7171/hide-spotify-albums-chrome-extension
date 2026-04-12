export const SAVED_ALBUMS_KEY = "savedAlbums";

export type SavedAlbum = {
  id: string;
  title: string;
  savedAt: number;
};

export async function getSavedAlbums(): Promise<SavedAlbum[]> {
  const r = await chrome.storage.local.get(SAVED_ALBUMS_KEY);
  const v = r[SAVED_ALBUMS_KEY];
  return Array.isArray(v) ? (v as SavedAlbum[]) : [];
}

export async function setSavedAlbums(albums: SavedAlbum[]): Promise<void> {
  await chrome.storage.local.set({ [SAVED_ALBUMS_KEY]: albums });
}
