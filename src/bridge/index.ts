import {
  HIDDEN_IDS_MESSAGE_TYPE,
  type HiddenIdsMessage,
} from "@/lib/hidden-album-ids";
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
      const albumRows: SavedAlbum[] = Object.values(snap.albums);
      const ids = snap.hideAlbumTiles
        ? [...getHiddenAlbumIds(albumRows)].sort()
        : [];
      postIdsMessage(ids);
    },
  });
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
