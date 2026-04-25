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
const MAX_BACKFILL_ROUNDS = 8;

const offsetMaps: Map<string, Map<number, number>> = new Map();

function keyFor(vars: DiscographyAllVars): string {
  return `${vars.uri}|${vars.order ?? ""}`;
}

function getServerOffsetFor(vars: DiscographyAllVars): number {
  const map = offsetMaps.get(keyFor(vars));
  if (!map) return vars.offset;
  const exact = map.get(vars.offset);
  if (typeof exact === "number") return exact;
  let bestClient = -1;
  let bestServer = vars.offset;
  for (const [c, s] of map) {
    if (c <= vars.offset && c > bestClient) {
      bestClient = c;
      bestServer = s + (vars.offset - c);
    }
  }
  return bestServer;
}

function rememberServerOffset(
  vars: DiscographyAllVars,
  nextClientOffset: number,
  serverOffset: number,
): void {
  let map = offsetMaps.get(keyFor(vars));
  if (!map) {
    map = new Map();
    offsetMaps.set(keyFor(vars), map);
  }
  map.set(nextClientOffset, serverOffset);
}

function extractAllItems(data: unknown): unknown[] {
  const all = (data as Record<string, unknown> | null)?.["data"];
  const artist = (all as Record<string, unknown> | null)?.["artistUnion"];
  const disc = (artist as Record<string, unknown> | null)?.["discography"];
  const allBlock = (disc as Record<string, unknown> | null)?.["all"];
  const items = (allBlock as Record<string, unknown> | null)?.["items"];
  return Array.isArray(items) ? items : [];
}

function setAllItems(data: unknown, items: unknown[]): void {
  const root = data as Record<string, unknown> | null;
  const block = root?.["data"] as Record<string, unknown> | undefined;
  const artist = block?.["artistUnion"] as Record<string, unknown> | undefined;
  const disc = artist?.["discography"] as Record<string, unknown> | undefined;
  const all = disc?.["all"] as Record<string, unknown> | undefined;
  if (all) all["items"] = items;
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

function buildBackfillRequest(
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
  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
    body,
    credentials: request.credentials,
    mode: request.mode,
    cache: request.cache,
    referrer: request.referrer,
    referrerPolicy: request.referrerPolicy,
  };
  return { url: request.url, init };
}

export async function handleDiscographyAll(
  request: Request,
  parsed: GraphqlBody,
  vars: DiscographyAllVars,
  hidden: Set<string>,
  realFetch: typeof fetch,
): Promise<Response> {
  const collected: unknown[] = [];
  let serverOffset = getServerOffsetFor(vars);
  let template: unknown = null;
  let exhausted = false;
  let lastUpstreamResponse: Response | null = null;

  for (
    let round = 0;
    round < MAX_BACKFILL_ROUNDS && collected.length < vars.limit && !exhausted;
    round += 1
  ) {
    const need = vars.limit - collected.length;
    const reqLimit = round === 0 ? vars.limit : Math.max(need * 2, 5);
    const { url, init } = buildBackfillRequest(
      request,
      parsed,
      vars,
      serverOffset,
      reqLimit,
    );
    const upstream = await realFetch(url, init);
    lastUpstreamResponse = upstream;
    let data: unknown;
    try {
      data = JSON.parse(await upstream.clone().text());
    } catch {
      return upstream;
    }
    const itemsBefore = extractAllItems(data);
    const serverGot = itemsBefore.length;
    if (template === null) template = data;
    if (serverGot === 0) {
      exhausted = true;
      break;
    }
    const beforeIds = collectAlbumIdsFromItems(itemsBefore);
    const removedIds = new Set<string>();
    for (const id of beforeIds) if (hidden.has(id)) removedIds.add(id);
    if (removedIds.size > 0) recordHiddenInArtist(vars.uri, removedIds);
    pruneHiddenAlbums(data, hidden);
    const itemsAfter = extractAllItems(data);
    const take = itemsAfter.slice(0, need);
    for (const t of take) collected.push(t);
    serverOffset += serverGot;
    if (serverGot < reqLimit) exhausted = true;
  }

  rememberServerOffset(vars, vars.offset + vars.limit, serverOffset);

  if (template === null) {
    if (lastUpstreamResponse) return lastUpstreamResponse;
    return new Response(
      JSON.stringify({
        data: {
          artistUnion: {
            __typename: "Artist",
            discography: { all: { items: [] } },
          },
        },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }

  setAllItems(template, collected);
  return new Response(JSON.stringify(template), {
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
