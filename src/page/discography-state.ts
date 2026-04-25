const STORAGE_KEY = "__spotifyExtArtistHiddenAlbums_v1";

type Stored = Record<string, string[]>;

function loadStored(): Stored {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw) as unknown;
    if (!obj || typeof obj !== "object") return {};
    const out: Stored = {};
    for (const k of Object.keys(obj as Record<string, unknown>)) {
      const v = (obj as Record<string, unknown>)[k];
      if (Array.isArray(v)) {
        out[k] = v.filter((x): x is string => typeof x === "string");
      }
    }
    return out;
  } catch {
    return {};
  }
}

function saveStored(value: Stored): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    void 0;
  }
}

const stored: Stored = loadStored();
const sets: Map<string, Set<string>> = new Map(
  Object.entries(stored).map(([k, v]) => [k, new Set(v)]),
);

export function recordHiddenInArtist(
  artistUri: string,
  albumIds: Iterable<string>,
): void {
  let set = sets.get(artistUri);
  if (!set) {
    set = new Set();
    sets.set(artistUri, set);
  }
  let dirty = false;
  for (const id of albumIds) {
    if (!set.has(id)) {
      set.add(id);
      dirty = true;
    }
  }
  if (dirty) {
    stored[artistUri] = [...set];
    saveStored(stored);
  }
}

export function countHiddenInArtist(
  artistUri: string,
  currentHidden: Set<string>,
): number {
  const set = sets.get(artistUri);
  if (!set) return 0;
  let n = 0;
  for (const id of set) if (currentHidden.has(id)) n += 1;
  return n;
}
