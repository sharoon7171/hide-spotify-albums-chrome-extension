import {
  SYNC_PORT_NAME,
  type FirebaseUserView,
  type PortServerEvent,
  type SyncSnapshot,
} from "@/lib/messages";

export type SyncListener = {
  onSnapshot?: (snapshot: SyncSnapshot) => void;
  onAuth?: (user: FirebaseUserView | null) => void;
};

export function connectSync(listener: SyncListener): () => void {
  let port: chrome.runtime.Port | null = null;
  let stopped = false;
  let reconnectScheduled = false;

  const open = (): void => {
    if (stopped) return;
    try {
      port = chrome.runtime.connect({ name: SYNC_PORT_NAME });
    } catch {
      scheduleReconnect();
      return;
    }
    port.onMessage.addListener((raw: unknown) => {
      const ev = raw as PortServerEvent | null;
      if (!ev || typeof ev.type !== "string") return;
      if (ev.type === "auth") listener.onAuth?.(ev.user);
      else if (ev.type === "sync") listener.onSnapshot?.(ev.snapshot);
    });
    port.onDisconnect.addListener(() => {
      port = null;
      void chrome.runtime.lastError;
      scheduleReconnect();
    });
  };

  const scheduleReconnect = (): void => {
    if (stopped || reconnectScheduled) return;
    reconnectScheduled = true;
    queueMicrotask(() => {
      reconnectScheduled = false;
      open();
    });
  };

  open();

  return () => {
    stopped = true;
    try {
      port?.disconnect();
    } catch {
      void 0;
    }
    port = null;
  };
}
