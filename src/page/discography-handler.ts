import { pruneHiddenAlbums } from "./album-pruner";
import {
  countHiddenInArtist,
  recordHiddenInArtist,
} from "./discography-state";

export type DiscographyAllVars = {
  uri: string;
  offset: number;
  limit: number;
  order?: string;
};

export type GraphqlBody = {
  operationName?: string;
  variables?: Record<string, unknown>;
  extensions?: unknown;
  query?: unknown;
};

const ALBUM_URI_RE = /^spotify:album:([0-9A-Za-z]{16,32})$/;
const FETCH_BATCH = 50;
const MAX_FETCH_ROUNDS = 12;

type DiscographyCache = {
  items: unknown[];
  seenItemKeys: Set<string>;
  serverOffsetAtEnd: number;
  serverTotal: number | null;
  template: unknown | null;
  exhausted: boolean;
};

const caches: Map<string, DiscographyCache> = new Map();

function keyFor(vars: DiscographyAllVars): string {
  return `${vars.uri}|${vars.order ?? ""}`;
}

function getOrCreateCache(vars: DiscographyAllVars): DiscographyCache {
  const key = keyFor(vars);
  let cache = caches.get(key);
  if (!cache) {
    cache = {
      items: [],
      seenItemKeys: new Set(),
      serverOffsetAtEnd: 0,
      serverTotal: null,
      template: null,
      exhausted: false,
    };
    caches.set(key, cache);
  }
  return cache;
}

export function clearDiscographyCaches(): void {
  caches.clear();
}

function extractAllBlock(data: unknown): Record<string, unknown> | null {
  const root = (data as Record<string, unknown> | null)?.["data"];
  const artist = (root as Record<string, unknown> | null)?.["artistUnion"];
  const disc = (artist as Record<string, unknown> | null)?.["discography"];
  const all = (disc as Record<string, unknown> | null)?.["all"];
  if (!all || typeof all !== "object") return null;
  return all as Record<string, unknown>;
}

function extractAllItems(data: unknown): unknown[] {
  const all = extractAllBlock(data);
  const items = all?.["items"];
  return Array.isArray(items) ? items : [];
}

function extractAllTotal(data: unknown): number | null {
  const all = extractAllBlock(data);
  const t = all?.["totalCount"];
  return typeof t === "number" ? t : null;
}

function setAllResult(
  template: unknown,
  items: unknown[],
  totalCount: number | null,
): void {
  const all = extractAllBlock(template);
  if (!all) return;
  all["items"] = items;
  if (totalCount !== null) all["totalCount"] = totalCount;
}

function firstReleaseUri(item: unknown): string | null {
  const releases = (item as Record<string, unknown> | null)?.["releases"] as
    | Record<string, unknown>
    | undefined;
  const releaseItems = releases?.["items"];
  if (!Array.isArray(releaseItems) || releaseItems.length === 0) return null;
  const uri = (releaseItems[0] as Record<string, unknown> | null)?.["uri"];
  return typeof uri === "string" ? uri : null;
}

function itemKey(item: unknown, fallbackIndex: number): string {
  const uri = firstReleaseUri(item);
  if (uri !== null) return uri;
  return `idx:${fallbackIndex}`;
}

function collectAlbumIdsFromItems(items: unknown[]): Set<string> {
  const out = new Set<string>();
  for (const item of items) {
    const releases = (item as Record<string, unknown> | null)?.["releases"] as
      | Record<string, unknown>
      | undefined;
    const releaseItems = releases?.["items"];
    if (!Array.isArray(releaseItems)) continue;
    for (const r of releaseItems) {
      const uri = (r as Record<string, unknown> | null)?.["uri"];
      if (typeof uri === "string") {
        const m = ALBUM_URI_RE.exec(uri);
        if (m) out.add(m[1]);
      }
    }
  }
  return out;
}

function buildFetchRequest(
  request: Request,
  parsed: GraphqlBody,
  vars: DiscographyAllVars,
  offset: number,
  limit: number,
): { url: string; init: RequestInit } {
  const body = JSON.stringify({
    ...parsed,
    variables: { ...vars, offset, limit },
  });
  return {
    url: request.url,
    init: {
      method: request.method,
      headers: request.headers,
      body,
      credentials: request.credentials,
      mode: request.mode,
      cache: request.cache,
      referrer: request.referrer,
      referrerPolicy: request.referrerPolicy,
    },
  };
}

async function fillCache(
  request: Request,
  parsed: GraphqlBody,
  vars: DiscographyAllVars,
  hidden: Set<string>,
  realFetch: typeof fetch,
  cache: DiscographyCache,
  needTotalItems: number,
): Promise<Response | null> {
  let lastResponse: Response | null = null;
  for (
    let round = 0;
    round < MAX_FETCH_ROUNDS &&
    cache.items.length < needTotalItems &&
    !cache.exhausted;
    round += 1
  ) {
    const remaining = needTotalItems - cache.items.length;
    const reqLimit = Math.max(FETCH_BATCH, remaining * 2);
    const { url, init } = buildFetchRequest(
      request,
      parsed,
      vars,
      cache.serverOffsetAtEnd,
      reqLimit,
    );
    const upstream = await realFetch(url, init);
    lastResponse = upstream;
    let data: unknown;
    try {
      data = JSON.parse(await upstream.clone().text());
    } catch {
      return upstream;
    }
    const itemsBefore = extractAllItems(data);
    const serverGot = itemsBefore.length;
    const serverTotal = extractAllTotal(data);
    if (serverTotal !== null) cache.serverTotal = serverTotal;
    if (cache.template === null) cache.template = data;
    if (serverGot === 0) {
      cache.exhausted = true;
      break;
    }
    const allIds = collectAlbumIdsFromItems(itemsBefore);
    const hiddenIdsHere = new Set<string>();
    for (const id of allIds) if (hidden.has(id)) hiddenIdsHere.add(id);
    if (hiddenIdsHere.size > 0) recordHiddenInArtist(vars.uri, hiddenIdsHere);
    pruneHiddenAlbums(data, hidden);
    const itemsAfter = extractAllItems(data);
    for (let i = 0; i < itemsAfter.length; i += 1) {
      const item = itemsAfter[i];
      const key = itemKey(item, cache.serverOffsetAtEnd + i);
      if (cache.seenItemKeys.has(key)) continue;
      cache.seenItemKeys.add(key);
      cache.items.push(item);
    }
    cache.serverOffsetAtEnd += serverGot;
    if (serverGot < reqLimit) cache.exhausted = true;
    if (
      cache.serverTotal !== null &&
      cache.serverOffsetAtEnd >= cache.serverTotal
    ) {
      cache.exhausted = true;
    }
  }
  return lastResponse;
}

function adjustedTotalCount(
  cache: DiscographyCache,
  vars: DiscographyAllVars,
  hidden: Set<string>,
): number {
  if (cache.exhausted) return cache.items.length;
  if (cache.serverTotal === null) return cache.items.length;
  const knownHidden = countHiddenInArtist(vars.uri, hidden);
  return Math.max(cache.items.length, cache.serverTotal - knownHidden);
}

export async function handleDiscographyAll(
  request: Request,
  parsed: GraphqlBody,
  vars: DiscographyAllVars,
  hidden: Set<string>,
  realFetch: typeof fetch,
): Promise<Response> {
  const cache = getOrCreateCache(vars);
  const needTotal = vars.offset + vars.limit;
  const lastResponse = await fillCache(
    request,
    parsed,
    vars,
    hidden,
    realFetch,
    cache,
    needTotal,
  );

  if (cache.template === null) {
    if (lastResponse) return lastResponse;
    return new Response(
      JSON.stringify({
        data: {
          artistUnion: {
            __typename: "Artist",
            discography: { all: { items: [], totalCount: 0 } },
          },
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }

  const slice = cache.items.slice(vars.offset, vars.offset + vars.limit);
  const total = adjustedTotalCount(cache, vars, hidden);
  setAllResult(cache.template, slice, total);
  return new Response(JSON.stringify(cache.template), {
    status: 200,
    statusText: "OK",
    headers: { "content-type": "application/json" },
  });
}

export function patchDiscographyOverview(
  data: unknown,
  hidden: Set<string>,
): unknown {
  const block = (data as Record<string, unknown> | null)?.["data"] as
    | Record<string, unknown>
    | undefined;
  const artist = block?.["artistUnion"] as Record<string, unknown> | undefined;
  const artistUri = artist?.["uri"];
  if (typeof artistUri !== "string") return data;
  const decrement = countHiddenInArtist(artistUri, hidden);
  if (decrement <= 0) return data;
  const disc = artist?.["discography"] as Record<string, unknown> | undefined;
  if (!disc) return data;
  const allBlock = disc["all"] as Record<string, unknown> | undefined;
  if (allBlock && typeof allBlock["totalCount"] === "number") {
    allBlock["totalCount"] = Math.max(
      0,
      (allBlock["totalCount"] as number) - decrement,
    );
  }
  return data;
}

export function isDiscographyAllOperation(opName: string | undefined): boolean {
  return opName === "queryArtistDiscographyAll";
}

export function isDiscographyOverviewOperation(
  opName: string | undefined,
): boolean {
  return opName === "queryArtistDiscographyOverview";
}

export function discographyVarsFrom(
  parsed: GraphqlBody,
): DiscographyAllVars | null {
  const v = parsed.variables;
  if (!v || typeof v !== "object") return null;
  const uri = (v as Record<string, unknown>)["uri"];
  const offset = (v as Record<string, unknown>)["offset"];
  const limit = (v as Record<string, unknown>)["limit"];
  const order = (v as Record<string, unknown>)["order"];
  if (
    typeof uri !== "string" ||
    typeof offset !== "number" ||
    typeof limit !== "number"
  )
    return null;
  return {
    uri,
    offset,
    limit,
    order: typeof order === "string" ? order : undefined,
  };
}
