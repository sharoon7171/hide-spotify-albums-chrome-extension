import type { SavedAlbum } from "@/lib/saved-albums";

export type FirebaseUserView = {
  uid: string;
  email: string | null;
};

type AuthMessage =
  | { kind: "auth/sign-in"; email: string; password: string }
  | { kind: "auth/sign-out" };

type WriteMessage =
  | { kind: "albums/upsert"; entry: SavedAlbum }
  | { kind: "albums/remove"; docId: string }
  | { kind: "albums/clear" }
  | { kind: "settings/set-hide-tiles"; value: boolean };

export type RuntimeMessage = AuthMessage | WriteMessage;

export type RuntimeResponse =
  | { ok: true }
  | { ok: false; code: string; message: string };

export async function sendToBackground(
  message: RuntimeMessage,
): Promise<RuntimeResponse> {
  try {
    const res = (await chrome.runtime.sendMessage(message)) as
      | RuntimeResponse
      | undefined;
    if (!res) return { ok: false, code: "no-response", message: "no response" };
    return res;
  } catch (e) {
    return {
      ok: false,
      code: "send-error",
      message: e instanceof Error ? e.message : String(e),
    };
  }
}

export const SYNC_PORT_NAME = "spotify-ext-sync-v1";

export type SyncSnapshot = {
  uid: string | null;
  user: FirebaseUserView | null;
  albums: Record<string, SavedAlbum>;
  hideAlbumTiles: boolean;
};

export type PortServerEvent = { type: "sync"; snapshot: SyncSnapshot };
