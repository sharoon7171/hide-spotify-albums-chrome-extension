const ALBUM_URI_RE = /^spotify:album:([0-9A-Za-z]{16,32})$/;
const ALBUM_URL_RE = /\/album\/([0-9A-Za-z]{16,32})(?:[/?#]|$)/;

const TOTAL_KEYS = ["totalCount", "total", "count", "totalNumberOfItems"] as const;

export function pruneHiddenAlbums(value: unknown, hidden: Set<string>): unknown {
  if (hidden.size === 0) return value;
  return prune(value, hidden);
}

function prune(value: unknown, hidden: Set<string>): unknown {
  if (Array.isArray(value)) {
    return pruneArray(value, hidden).value;
  }
  if (!value || typeof value !== "object") return value;
  return pruneObject(value as Record<string, unknown>, hidden);
}

function pruneArray(arr: unknown[], hidden: Set<string>): { value: unknown[]; removed: number } {
  const out: unknown[] = [];
  let removed = 0;
  for (const el of arr) {
    if (subtreeOnlyReferencesHidden(el, hidden)) {
      removed += 1;
      continue;
    }
    out.push(prune(el, hidden));
  }
  return { value: out, removed };
}

function pruneObject(
  obj: Record<string, unknown>,
  hidden: Set<string>,
): Record<string, unknown> {
  let removedHere = 0;
  for (const key of Object.keys(obj)) {
    const v = obj[key];
    if (Array.isArray(v)) {
      const next = pruneArray(v, hidden);
      removedHere += next.removed;
      obj[key] = next.value;
    } else if (v && typeof v === "object") {
      obj[key] = prune(v, hidden);
    }
  }
  if (removedHere > 0) {
    decrementSiblingTotals(obj, removedHere);
  }
  return obj;
}

function decrementSiblingTotals(obj: Record<string, unknown>, by: number): void {
  for (const key of TOTAL_KEYS) {
    const v = obj[key];
    if (typeof v === "number" && Number.isFinite(v)) {
      obj[key] = Math.max(0, v - by);
    }
  }
}

const ALBUM_OWN_PATHS: ReadonlyArray<ReadonlyArray<string>> = [
  [],
  ["data"],
  ["item"],
  ["item", "data"],
  ["node"],
  ["node", "data"],
  ["node", "item"],
  ["node", "item", "data"],
  ["entity"],
  ["entity", "data"],
  ["target"],
  ["target", "data"],
  ["content"],
  ["content", "data"],
  ["album"],
  ["album", "data"],
  ["resource"],
  ["releases", "items", "0"],
];

function subtreeOnlyReferencesHidden(node: unknown, hidden: Set<string>): boolean {
  if (!node || typeof node !== "object") return false;
  const own = ownAlbumIdOf(node);
  if (own !== null) return hidden.has(own);
  if (Array.isArray(node)) {
    if (node.length === 0) return false;
    for (const el of node) {
      if (!subtreeOnlyReferencesHidden(el, hidden)) return false;
    }
    return true;
  }
  return false;
}

function ownAlbumIdOf(node: unknown): string | null {
  for (const path of ALBUM_OWN_PATHS) {
    const target = followPath(node, path);
    const id = idFromAlbumLikeNode(target);
    if (id !== null) return id;
  }
  return null;
}

function followPath(node: unknown, path: ReadonlyArray<string>): unknown {
  let cur: unknown = node;
  for (const k of path) {
    if (Array.isArray(cur)) {
      const idx = Number(k);
      if (!Number.isInteger(idx)) return null;
      cur = cur[idx];
    } else if (cur && typeof cur === "object") {
      cur = (cur as Record<string, unknown>)[k];
    } else {
      return null;
    }
    if (cur === undefined) return null;
  }
  return cur;
}

function idFromAlbumLikeNode(node: unknown): string | null {
  if (!node || typeof node !== "object" || Array.isArray(node)) return null;
  const obj = node as Record<string, unknown>;
  for (const key of ["uri", "spotifyUri"]) {
    const v = obj[key];
    if (typeof v === "string") {
      const m = ALBUM_URI_RE.exec(v);
      if (m) return m[1];
    }
  }
  for (const key of ["href", "url", "shareUrl"]) {
    const v = obj[key];
    if (typeof v === "string") {
      const m = ALBUM_URL_RE.exec(v);
      if (m) return m[1];
    }
  }
  return null;
}
