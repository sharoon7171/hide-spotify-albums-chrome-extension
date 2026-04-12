export const HIDE_ALBUM_TILES_KEY = "hideAlbumTilesEnabled";

export async function getHideAlbumTilesEnabled(): Promise<boolean> {
  const r = await chrome.storage.local.get(HIDE_ALBUM_TILES_KEY);
  if (r[HIDE_ALBUM_TILES_KEY] === undefined) return true;
  return Boolean(r[HIDE_ALBUM_TILES_KEY]);
}

export async function setHideAlbumTilesEnabled(value: boolean): Promise<void> {
  await chrome.storage.local.set({ [HIDE_ALBUM_TILES_KEY]: value });
}
