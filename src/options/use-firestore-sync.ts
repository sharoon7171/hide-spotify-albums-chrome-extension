import { useEffect, useState } from "react";
import { firebaseAuthReady } from "@/lib/firebase/app";
import {
  subscribeAlbums,
  subscribeHideTiles,
} from "@/lib/firebase/firestore-data";
import { watchAuth, userView } from "@/lib/firebase/auth";
import type { FirebaseUserView } from "@/lib/messages";
import type { SavedAlbum } from "@/lib/saved-albums";

export type FirestoreSyncState = {
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
    let unsubAuth: (() => void) | null = null;
    let unsubAlbums: (() => void) | null = null;
    let unsubSettings: (() => void) | null = null;

    const detachFirestore = () => {
      unsubAlbums?.();
      unsubSettings?.();
      unsubAlbums = null;
      unsubSettings = null;
    };

    void firebaseAuthReady().then(() => {
      if (!alive) return;
      unsubAuth = watchAuth((u) => {
        if (!alive) return;
        const view = userView(u);
        setState((prev) => ({
          ...prev,
          ready: true,
          user: view,
          ...(view ? {} : { albums: {}, hideAlbumTiles: true }),
        }));
        detachFirestore();
        if (!view) return;
        unsubAlbums = subscribeAlbums(view.uid, (albums) =>
          setState((prev) => ({ ...prev, albums })),
        );
        unsubSettings = subscribeHideTiles(view.uid, (hideAlbumTiles) =>
          setState((prev) => ({ ...prev, hideAlbumTiles })),
        );
      });
    });

    return () => {
      alive = false;
      unsubAuth?.();
      detachFirestore();
    };
  }, []);

  return state;
}
