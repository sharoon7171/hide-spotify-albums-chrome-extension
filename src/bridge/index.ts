import {
  HIDDEN_IDS_MESSAGE_TYPE,
  HIDDEN_IDS_STORAGE_KEY,
  type HiddenIdsMessage,
} from "@/lib/page-bridge-keys";
import { getHiddenAlbumIds, type SavedAlbum } from "@/lib/saved-albums";
import { connectSync } from "@/lib/sync-port";

const INIT_KEY = "__spotifyExtBridgeInstalled_v2" as const;

type WindowWithInit = typeof window & { [INIT_KEY]?: boolean };

function install(): void {
  const w = window as WindowWithInit;
  if (w[INIT_KEY]) return;
  w[INIT_KEY] = true;
  connectSync({
    onSnapshot: (snap) => {
      const albums: SavedAlbum[] = Object.values(snap.albums);
      const ids = snap.hideAlbumTiles
        ? [...getHiddenAlbumIds(albums)].sort()
        : [];
      writeLocalStorage(ids);
      postIdsMessage(ids);
    },
  });
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
