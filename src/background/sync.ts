import { firebaseAuth, firebaseAuthReady } from "@/lib/firebase/app";
import {
  currentUserReady,
  signInGoogle,
  signOutCurrent,
  userView,
  watchAuth,
} from "@/lib/firebase/auth";
import {
  clearAllAlbums,
  removeAlbum,
  setHideTilesEnabled,
  subscribeAlbums,
  subscribeHideTiles,
  upsertAlbum,
} from "@/lib/firebase/firestore-data";
import {
  SYNC_PORT_NAME,
  type FirebaseUserView,
  type PortServerEvent,
  type RuntimeMessage,
  type RuntimeResponse,
  type SyncSnapshot,
} from "@/lib/messages";
import type { SavedAlbum } from "@/lib/saved-albums";

let currentUser: FirebaseUserView | null = null;
let snapshot: SyncSnapshot = { uid: null, albums: {}, hideAlbumTiles: true };
let unsubAlbums: (() => void) | null = null;
let unsubSettings: (() => void) | null = null;
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

function detachListeners(): void {
  unsubAlbums?.();
  unsubSettings?.();
  unsubAlbums = null;
  unsubSettings = null;
}

function attachListenersForUser(uid: string): void {
  detachListeners();
  setSnapshot({ uid, albums: {}, hideAlbumTiles: true });
  unsubAlbums = subscribeAlbums(uid, (albums) => {
    setSnapshot({ albums });
  });
  unsubSettings = subscribeHideTiles(uid, (hideAlbumTiles) => {
    setSnapshot({ hideAlbumTiles });
  });
}

function onAuthChanged(user: FirebaseUserView | null): void {
  currentUser = user;
  broadcast({ type: "auth", user });
  if (user) {
    attachListenersForUser(user.uid);
  } else {
    detachListeners();
    setSnapshot({ uid: null, albums: {}, hideAlbumTiles: true });
  }
}

export function startSync(): void {
  void firebaseAuthReady().then(() => {
    const auth = firebaseAuth();
    onAuthChanged(userView(auth.currentUser));
    watchAuth((u) => onAuthChanged(userView(u)));
  });

  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== SYNC_PORT_NAME) return;
    ports.add(port);
    port.onDisconnect.addListener(() => {
      ports.delete(port);
    });
    try {
      port.postMessage({ type: "auth", user: currentUser } satisfies PortServerEvent);
      port.postMessage({ type: "sync", snapshot } satisfies PortServerEvent);
    } catch {
      ports.delete(port);
    }
  });

  chrome.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    const msg = raw as Partial<RuntimeMessage> | null;
    if (!msg || typeof msg.kind !== "string") return false;
    if (!msg.kind.startsWith("auth/") && !msg.kind.startsWith("albums/") && !msg.kind.startsWith("settings/")) {
      return false;
    }
    void handleMessage(msg as RuntimeMessage).then(sendResponse);
    return true;
  });
}

async function handleMessage(msg: RuntimeMessage): Promise<RuntimeResponse> {
  try {
    switch (msg.kind) {
      case "auth/get-state":
        return { ok: true, user: currentUser };
      case "auth/sign-in": {
        const user = await signInGoogle();
        return { ok: true, user };
      }
      case "auth/sign-out":
        await signOutCurrent();
        return { ok: true, user: null };
      case "albums/upsert":
        await requireUid();
        await upsertAlbum(currentUser!.uid, msg.entry);
        return { ok: true };
      case "albums/remove":
        await requireUid();
        await removeAlbum(currentUser!.uid, msg.docId);
        return { ok: true };
      case "albums/clear":
        await requireUid();
        await clearAllAlbums(currentUser!.uid, Object.keys(snapshot.albums));
        return { ok: true };
      case "settings/set-hide-tiles":
        await requireUid();
        await setHideTilesEnabled(currentUser!.uid, msg.value);
        return { ok: true };
    }
  } catch (e) {
    return {
      ok: false,
      code: getErrCode(e),
      message: e instanceof Error ? e.message : String(e),
    };
  }
  return { ok: false, code: "unhandled", message: "unhandled message" };
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

export type { SavedAlbum };
