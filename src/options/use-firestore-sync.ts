import { useEffect, useState } from "react";
import { firebaseAuthReady } from "@/lib/firebase/app";
import { watchAuth, userView } from "@/lib/firebase/auth";
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
    let offAuth: (() => void) | null = null;
    let offSync: (() => void) | null = null;

    void firebaseAuthReady().then(() => {
      if (!alive) return;
      offAuth = watchAuth((u) => {
        if (!alive) return;
        const view = userView(u);
        setState((prev) => ({
          ...prev,
          ready: true,
          user: view,
          ...(view ? {} : { albums: {} }),
        }));
      });
      offSync = connectSync({
        onSnapshot: (snap) => {
          if (!alive) return;
          setState((prev) => ({
            ...prev,
            albums: snap.albums,
            hideAlbumTiles: snap.hideAlbumTiles,
          }));
        },
      });
    });

    return () => {
      alive = false;
      offAuth?.();
      offSync?.();
    };
  }, []);

  return state;
}
