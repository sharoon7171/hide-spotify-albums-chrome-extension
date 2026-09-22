import { useEffect, useState } from "react";
import type { FirebaseUserView } from "@/lib/messages";
import type { SavedAlbum } from "@/lib/saved-albums";
import { connectSync } from "@/lib/sync-port";

type FirestoreSyncState = {
  ready: boolean;
  user: FirebaseUserView | null;
  albums: Record<string, SavedAlbum>;
  hideAlbumTiles: boolean;
};

export function useFirestoreSync(): FirestoreSyncState {
  const [state, setState] = useState<FirestoreSyncState>({
    ready: false,
    user: null,
    albums: {},
    hideAlbumTiles: true,
  });

  useEffect(() => {
    let alive = true;
    const offSync = connectSync({
      onSnapshot: (snap) => {
        if (!alive) return;
        setState({
          ready: true,
          user: snap.user,
          albums: snap.albums,
          hideAlbumTiles: snap.hideAlbumTiles,
        });
      },
    });
    return () => {
      alive = false;
      offSync();
    };
  }, []);

  return state;
}
