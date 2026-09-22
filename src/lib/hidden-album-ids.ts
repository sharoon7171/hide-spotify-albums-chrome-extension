export const HIDDEN_IDS_MESSAGE_TYPE = "__spotifyExtHiddenAlbumIds_v1";

export type HiddenIdsMessage = {
  type: typeof HIDDEN_IDS_MESSAGE_TYPE;
  ids: string[];
};

let hiddenIds = new Set<string>();

export function hiddenAlbumIdSet(): Set<string> {
  return hiddenIds;
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
  hiddenIds = new Set(
    ids.filter((x) => typeof x === "string" && x.length > 0),
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
}
