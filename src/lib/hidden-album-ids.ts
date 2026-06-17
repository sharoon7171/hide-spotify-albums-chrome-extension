export const HIDDEN_IDS_STORAGE_KEY = "__spotifyExtHiddenAlbumIds_v1";
export const HIDDEN_IDS_MESSAGE_TYPE = "__spotifyExtHiddenAlbumIds_v1";

export type HiddenIdsMessage = {
  type: typeof HIDDEN_IDS_MESSAGE_TYPE;
  ids: string[];
};

let hiddenIds = readHiddenIdsFromStorage();

function parseIds(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(
      parsed.filter(
        (x): x is string => typeof x === "string" && x.length > 0,
      ),
    );
  } catch {
    return new Set();
  }
}

function readHiddenIdsFromStorage(): Set<string> {
  try {
    return parseIds(window.localStorage.getItem(HIDDEN_IDS_STORAGE_KEY));
  } catch {
    return new Set();
  }
}

export function readHiddenAlbumIdsEarly(): Set<string> {
  try {
    return parseIds(globalThis.localStorage?.getItem(HIDDEN_IDS_STORAGE_KEY) ?? null);
  } catch {
    return new Set();
  }
}

export function hiddenAlbumIdSet(): Set<string> {
  return hiddenIds;
}

function setHiddenIds(next: Set<string>): void {
  hiddenIds = next;
}

type HiddenListener = () => void;

const listeners = new Set<HiddenListener>();

function emit(): void {
  for (const fn of listeners) fn();
}

export function subscribeHiddenAlbumIds(fn: HiddenListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function applyIdsFromArray(ids: string[]): void {
  setHiddenIds(
    new Set(ids.filter((x) => typeof x === "string" && x.length > 0)),
  );
  emit();
}

export function installHiddenIdsListener(): void {
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window) return;
    const data = event.data as Partial<HiddenIdsMessage> | null;
    if (
      !data ||
      data.type !== HIDDEN_IDS_MESSAGE_TYPE ||
      !Array.isArray(data.ids)
    )
      return;
    applyIdsFromArray(data.ids);
  });
  window.addEventListener("storage", (event: StorageEvent) => {
    if (event.key !== HIDDEN_IDS_STORAGE_KEY) return;
    setHiddenIds(readHiddenIdsFromStorage());
    emit();
  });
  setHiddenIds(readHiddenIdsFromStorage());
}
