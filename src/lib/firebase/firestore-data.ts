import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  writeBatch,
  type DocumentData,
  type QuerySnapshot,
} from "firebase/firestore";
import { firestoreDb } from "./app";
import {
  docIdForSavedAlbum,
  type SavedAlbum,
} from "@/lib/saved-albums";

export type AlbumDoc = SavedAlbum;

const ALBUMS = "savedAlbums";
const SETTINGS = "settings";
const OPTIONS_DOC = "options";

function userRef(uid: string) {
  return doc(firestoreDb(), "users", uid);
}

function albumsCol(uid: string) {
  return collection(userRef(uid), ALBUMS);
}

function albumDoc(uid: string, docId: string) {
  return doc(userRef(uid), ALBUMS, docId);
}

function settingsDoc(uid: string) {
  return doc(userRef(uid), SETTINGS, OPTIONS_DOC);
}

export function subscribeAlbums(
  uid: string,
  next: (albums: Record<string, SavedAlbum>) => void,
  error?: (e: Error) => void,
): () => void {
  return onSnapshot(
    albumsCol(uid),
    (snap: QuerySnapshot<DocumentData>) => {
      const out: Record<string, SavedAlbum> = {};
      for (const d of snap.docs) {
        const data = d.data();
        const album: SavedAlbum = {
          savedAt:
            typeof data.savedAt === "number"
              ? data.savedAt
              : Date.now(),
        };
        if (typeof data.url === "string" && data.url.length > 0) {
          album.url = data.url;
        }
        if (typeof data.title === "string" && data.title.length > 0) {
          album.title = data.title;
        }
        out[d.id] = album;
      }
      next(out);
    },
    error,
  );
}

export function subscribeHideTiles(
  uid: string,
  next: (enabled: boolean) => void,
  error?: (e: Error) => void,
): () => void {
  return onSnapshot(
    settingsDoc(uid),
    (snap) => {
      const data = snap.data();
      if (!data) {
        next(true);
        return;
      }
      next(data.hideAlbumTiles !== false);
    },
    error,
  );
}

export async function upsertAlbum(
  uid: string,
  entry: SavedAlbum,
): Promise<void> {
  const id = docIdForSavedAlbum(entry);
  const payload: Record<string, unknown> = {
    savedAt: entry.savedAt,
    updatedAt: serverTimestamp(),
  };
  if (entry.url) payload.url = entry.url;
  if (entry.title) payload.title = entry.title;
  await setDoc(albumDoc(uid, id), payload);
}

export async function removeAlbum(uid: string, docId: string): Promise<void> {
  await deleteDoc(albumDoc(uid, docId));
}

const CLEAR_BATCH_SIZE = 450;

export async function clearAllAlbums(uid: string): Promise<number> {
  const db = firestoreDb();
  const col = albumsCol(uid);
  let removed = 0;
  for (;;) {
    const snap = await getDocs(query(col, limit(CLEAR_BATCH_SIZE)));
    if (snap.empty) break;
    const batch = writeBatch(db);
    for (const d of snap.docs) batch.delete(d.ref);
    await batch.commit();
    removed += snap.size;
    if (snap.size < CLEAR_BATCH_SIZE) break;
  }
  return removed;
}

export async function setHideTilesEnabled(
  uid: string,
  value: boolean,
): Promise<void> {
  await setDoc(
    settingsDoc(uid),
    { hideAlbumTiles: value, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
