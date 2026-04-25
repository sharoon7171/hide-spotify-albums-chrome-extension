import {
  getHideAlbumTilesEnabled,
  HIDE_ALBUM_TILES_KEY,
} from "@/lib/extension-settings";
import {
  HIDDEN_IDS_MESSAGE_TYPE,
  HIDDEN_IDS_STORAGE_KEY,
  type HiddenIdsMessage,
} from "@/lib/page-bridge-keys";
import {
  getHiddenAlbumIds,
  getSavedAlbums,
  SAVED_ALBUMS_KEY,
} from "@/lib/saved-albums";

const INIT_KEY = "__spotifyExtBridgeInstalled_v1" as const;

type WindowWithInit = typeof window & { [INIT_KEY]?: boolean };

function install(): void {
  const w = window as WindowWithInit;
  if (w[INIT_KEY]) return;
  w[INIT_KEY] = true;
  void publishCurrent();
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (!changes[SAVED_ALBUMS_KEY] && !changes[HIDE_ALBUM_TILES_KEY]) return;
    void publishCurrent();
  });
}

async function publishCurrent(): Promise<void> {
  const [albums, enabled] = await Promise.all([
    getSavedAlbums(),
    getHideAlbumTilesEnabled(),
  ]);
  const ids = enabled ? [...getHiddenAlbumIds(albums)].sort() : [];
  writeLocalStorage(ids);
  postIdsMessage(ids);
}

function writeLocalStorage(ids: string[]): void {
  try {
    window.localStorage.setItem(HIDDEN_IDS_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    void 0;
  }
}

function postIdsMessage(ids: string[]): void {
  const message: HiddenIdsMessage = { type: HIDDEN_IDS_MESSAGE_TYPE, ids };
  try {
    window.postMessage(message, location.origin);
  } catch {
    void 0;
  }
}

install();
