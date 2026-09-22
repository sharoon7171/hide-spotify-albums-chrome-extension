import { firebaseAuth, firebaseAuthReady } from "@/lib/firebase/app";
import {
  currentUserReady,
  signInWithEmail,
  signOutCurrent,
  userView,
  watchAuth,
} from "@/lib/firebase/auth";
import {
  clearAllAlbums,
  loadAlbumsFromCache,
  removeAlbum,
  subscribeAlbums,
  upsertAlbum,
} from "@/lib/firebase/firestore-data";
import { docIdForSavedAlbum } from "@/lib/saved-albums";
import {
  SYNC_PORT_NAME,
  type FirebaseUserView,
  type PortServerEvent,
  type RuntimeMessage,
  type RuntimeResponse,
  type SyncSnapshot,
} from "@/lib/messages";

const HIDE_TILES_KEY = "hideAlbumTiles";

let currentUser: FirebaseUserView | null = null;
let snapshot: SyncSnapshot = {
  uid: null,
  user: null,
  albums: {},
  hideAlbumTiles: true,
};
let unsubAlbums: (() => void) | null = null;
let syncEpoch = 0;
const ports = new Set<chrome.runtime.Port>();

function setSnapshot(next: Partial<SyncSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  broadcast({ type: "sync", snapshot });
}

function broadcast(event: PortServerEvent): void {
  for (const port of ports) {
    try {
      port.postMessage(event);
    } catch {
      ports.delete(port);
    }
  }
}

async function readLocalHideTiles(): Promise<boolean> {
  const r = await chrome.storage.local.get(HIDE_TILES_KEY);
  return r[HIDE_TILES_KEY] !== false;
}

async function writeLocalHideTiles(value: boolean): Promise<void> {
  await chrome.storage.local.set({ [HIDE_TILES_KEY]: value });
}

function detachListeners(): void {
  unsubAlbums?.();
  unsubAlbums = null;
}

function attachListenersForUser(uid: string): void {
  detachListeners();
  const epoch = ++syncEpoch;
  void hydrateFromCache(uid, epoch);
  unsubAlbums = subscribeAlbums(uid, (albums) => {
    if (epoch !== syncEpoch || currentUser?.uid !== uid) return;
    setSnapshot({ uid, user: currentUser, albums });
  });
}

async function hydrateFromCache(uid: string, epoch: number): Promise<void> {
  const cached = await loadAlbumsFromCache(uid);
  if (epoch !== syncEpoch || currentUser?.uid !== uid || !cached) return;
  setSnapshot({ uid, user: currentUser, albums: cached });
}

function onAuthChanged(user: FirebaseUserView | null): void {
  currentUser = user;
  if (user) {
    const switched = snapshot.uid !== user.uid;
    if (switched) {
      setSnapshot({
        uid: user.uid,
        user,
        albums: {},
      });
      attachListenersForUser(user.uid);
      return;
    }
    setSnapshot({ user });
    if (!unsubAlbums) attachListenersForUser(user.uid);
    return;
  }
  syncEpoch += 1;
  detachListeners();
  setSnapshot({ uid: null, user: null, albums: {} });
}

export function startSync(): void {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== SYNC_PORT_NAME) return;
    ports.add(port);
    port.onDisconnect.addListener(() => {
      ports.delete(port);
    });
    try {
      port.postMessage({ type: "sync", snapshot } satisfies PortServerEvent);
    } catch {
      ports.delete(port);
    }
  });

  chrome.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    const msg = raw as Partial<RuntimeMessage> | null;
    if (!msg || typeof msg.kind !== "string") return false;
    if (
      !msg.kind.startsWith("auth/") &&
      !msg.kind.startsWith("albums/") &&
      !msg.kind.startsWith("settings/")
    ) {
      return false;
    }
    void handleMessage(msg as RuntimeMessage).then(sendResponse);
    return true;
  });

  void firebaseAuthReady().then(async () => {
    const hideAlbumTiles = await readLocalHideTiles();
    snapshot = { ...snapshot, hideAlbumTiles };
    const auth = firebaseAuth();
    onAuthChanged(userView(auth.currentUser));
    watchAuth((u) => onAuthChanged(userView(u)));
  });
}

async function handleMessage(msg: RuntimeMessage): Promise<RuntimeResponse> {
  try {
    switch (msg.kind) {
      case "auth/sign-in": {
        await signInWithEmail(msg.email, msg.password);
        return { ok: true };
      }
      case "auth/sign-out":
        await signOutCurrent();
        return { ok: true };
      case "albums/upsert": {
        await requireUid();
        const id = docIdForSavedAlbum(msg.entry);
        const now = Date.now();
        const entry = {
          ...msg.entry,
          updatedAt: now,
        };
        const prev = snapshot.albums[id];
        setSnapshot({
          albums: { ...snapshot.albums, [id]: entry },
        });
        try {
          await upsertAlbum(currentUser!.uid, entry);
        } catch (e) {
          const albums = { ...snapshot.albums };
          if (prev) albums[id] = prev;
          else delete albums[id];
          setSnapshot({ albums });
          throw e;
        }
        return { ok: true };
      }
      case "albums/remove": {
        await requireUid();
        const prev = snapshot.albums[msg.docId];
        if (prev) {
          const albums = { ...snapshot.albums };
          delete albums[msg.docId];
          setSnapshot({ albums });
        }
        try {
          await removeAlbum(currentUser!.uid, msg.docId);
        } catch (e) {
          if (prev) {
            setSnapshot({
              albums: { ...snapshot.albums, [msg.docId]: prev },
            });
          }
          throw e;
        }
        return { ok: true };
      }
      case "albums/clear": {
        await requireUid();
        const prev = snapshot.albums;
        const ids = Object.keys(prev);
        setSnapshot({ albums: {} });
        try {
          await clearAllAlbums(currentUser!.uid, ids);
        } catch (e) {
          setSnapshot({ albums: prev });
          throw e;
        }
        return { ok: true };
      }
      case "settings/set-hide-tiles": {
        await writeLocalHideTiles(msg.value);
        setSnapshot({ hideAlbumTiles: msg.value });
        return { ok: true };
      }
    }
  } catch (e) {
    return {
      ok: false,
      code: getErrCode(e),
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

async function requireUid(): Promise<void> {
  if (currentUser) return;
  const restored = await currentUserReady();
  const u = userView(restored);
  if (!u) throw Object.assign(new Error("not signed in"), { code: "not-signed-in" });
  currentUser = u;
}

function getErrCode(e: unknown): string {
  if (e && typeof e === "object" && "code" in e) {
    const c = (e as { code?: unknown }).code;
    if (typeof c === "string") return c;
  }
  return "unknown";
}
