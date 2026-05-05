import {
  HIDDEN_IDS_MESSAGE_TYPE,
  HIDDEN_IDS_STORAGE_KEY,
  type HiddenIdsMessage,
} from "@/lib/page-bridge-keys";
import { pruneHiddenAlbums } from "./album-pruner";
import {
  clearDiscographyCaches,
  type GraphqlBody,
  isDiscographyAllOperation,
  isDiscographyOverviewOperation,
  isDiscographyPagePathname,
  patchDiscographyOverview,
} from "./discography-handler";

const FILTERED_HOSTS = new Set<string>([
  "api-partner.spotify.com",
  "api.spotify.com",
  "spclient.wg.spotify.com",
  "gew1-spclient.spotify.com",
  "gew4-spclient.spotify.com",
  "guc3-spclient.spotify.com",
  "gae2-spclient.spotify.com",
]);

const FILTERED_HOST_SUFFIXES = ["-spclient.spotify.com"];

const PATHFINDER_PATH_RE = /\/pathfinder\//;

const LIBRARY_OPERATION_RE = /library/i;

function isLibraryOperation(opName: string | undefined): boolean {
  return typeof opName === "string" && LIBRARY_OPERATION_RE.test(opName);
}

const INIT_KEY = "__spotifyExtPageWorldInstalled_v1" as const;

type WindowWithInit = typeof window & { [INIT_KEY]?: boolean };

let hiddenIds: Set<string> = readHiddenIdsFromStorage();

function install(): void {
  const w = window as WindowWithInit;
  if (w[INIT_KEY]) return;
  w[INIT_KEY] = true;

  patchFetch();
  listenForUpdates();
}

function readHiddenIdsFromStorage(): Set<string> {
  try {
    const raw = window.localStorage.getItem(HIDDEN_IDS_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const ids = parsed.filter(
      (x): x is string => typeof x === "string" && x.length > 0,
    );
    return new Set(ids);
  } catch {
    return new Set();
  }
}

function listenForUpdates(): void {
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.source !== window) return;
    const data = event.data as Partial<HiddenIdsMessage> | null;
    if (
      !data ||
      data.type !== HIDDEN_IDS_MESSAGE_TYPE ||
      !Array.isArray(data.ids)
    )
      return;
    hiddenIds = new Set(
      data.ids.filter((x): x is string => typeof x === "string" && x.length > 0),
    );
    clearDiscographyCaches();
  });
  window.addEventListener("storage", (event: StorageEvent) => {
    if (event.key !== HIDDEN_IDS_STORAGE_KEY) return;
    hiddenIds = readHiddenIdsFromStorage();
    clearDiscographyCaches();
  });
}

function shouldFilterUrl(url: URL): boolean {
  const host = url.hostname;
  if (FILTERED_HOSTS.has(host)) return true;
  for (const suffix of FILTERED_HOST_SUFFIXES) {
    if (host.endsWith(suffix)) return true;
  }
  return false;
}

function targetUrlFromInput(input: RequestInfo | URL): URL | null {
  try {
    if (typeof input === "string") return new URL(input, location.href);
    if (input instanceof URL) return input;
    if (typeof Request !== "undefined" && input instanceof Request) {
      return new URL(input.url, location.href);
    }
  } catch {
    return null;
  }
  return null;
}

async function parseGraphqlBody(request: Request): Promise<GraphqlBody | null> {
  if (request.method !== "POST") return null;
  try {
    const text = await request.clone().text();
    if (!text) return null;
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as GraphqlBody;
  } catch {
    return null;
  }
}

async function defaultPruneAndForward(
  request: Request,
  realFetch: typeof fetch,
  parsed: GraphqlBody | null,
): Promise<Response> {
  const response = await realFetch(request);
  if (isDiscographyPagePathname(location.pathname)) return response;
  if (parsed && isLibraryOperation(parsed.operationName)) return response;
  if (parsed && isDiscographyAllOperation(parsed.operationName)) {
    return response;
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;
  try {
    const text = await response.clone().text();
    if (!text) return response;
    let data = JSON.parse(text) as unknown;
    if (parsed && isDiscographyOverviewOperation(parsed.operationName)) {
      data = patchDiscographyOverview(data, hiddenIds);
    } else {
      data = pruneHiddenAlbums(data, hiddenIds);
    }
    const body = JSON.stringify(data);
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  } catch {
    return response;
  }
}

function patchFetch(): void {
  const realFetch = window.fetch.bind(window);
  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    const url = targetUrlFromInput(input);
    if (!url || !shouldFilterUrl(url)) return realFetch(input, init);

    const request = new Request(input as RequestInfo, init);

    if (PATHFINDER_PATH_RE.test(url.pathname)) {
      const parsed = await parseGraphqlBody(request);
      if (parsed && isDiscographyAllOperation(parsed.operationName)) {
        return realFetch(request);
      }
      if (!parsed) {
        return realFetch(request);
      }
      if (hiddenIds.size === 0) {
        return realFetch(request);
      }
      return defaultPruneAndForward(request, realFetch, parsed);
    }

    if (hiddenIds.size === 0) {
      return realFetch(input, init);
    }
    return defaultPruneAndForward(request, realFetch, null);
  };
}

install();
