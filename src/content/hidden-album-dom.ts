import { albumIdFromPathname } from "@/lib/spotify-album-url";
import { readDiscographyTrackMap } from "@/lib/discography-track-map-storage";
import { DISCOGRAPHY_TRACK_MAP_UPDATED_MESSAGE_TYPE } from "@/lib/page-bridge-keys";
import { getHiddenAlbumIds, type SavedAlbum } from "@/lib/saved-albums";
import { connectSync } from "@/lib/sync-port";

const STYLE_ID = "spotify-ext-hide-album-css-rules";

let hidden = new Set<string>();
let tilesOn = true;
let lastCss = "";
let lastPath = "";

function artistIdFromPath(pathname: string): string | null {
  const m = /\/artist\/([^/]+)\//.exec(pathname);
  return m?.[1] ?? null;
}

/** List-mode rows use `/track/id` from discography payloads; keyed by Pathfinder ingestion in page script. */
function trackIdsForHiddenAlbums(ids: Set<string>, pathname: string): string[] {
  const aid = artistIdFromPath(pathname);
  const stored = readDiscographyTrackMap();
  if (!aid || !stored || stored.artistId !== aid) return [];
  const out: string[] = [];
  for (const [trackId, albumId] of Object.entries(stored.trackToAlbum)) {
    if (ids.has(albumId)) out.push(trackId);
  }
  return [...new Set(out)].sort();
}

function buildCss(ids: Set<string>, pathname: string): string {
  const skip = albumIdFromPathname(pathname);
  /** Collapse layout; discography JSON is left unpruned so totals stay in sync with the virtualizer. */
  const hide = "display:none!important";
  /** List / intl / full open.spotify.com links — not always `/album/id` or `…/album/id` only. */
  const wrappers = [
    '[data-encore-id="card"]',
    '[data-carousel-gridlist-item="true"]',
    '[data-encore-id="listitem"]',
    '[role="listitem"]',
    '[role="gridcell"]',
  ] as const;
  const out: string[] = [];
  for (const id of [...ids].sort()) {
    if (id === skip) continue;
    const e = CSS.escape(id);
    const link = `a[href*="/album/${e}"]`;
    /** List layout often skips `card` / carousel wrappers; Spotify still binds rows via labelledby → `spotify:album:id`. */
    const uriFrag = `spotify:album:${id}`;
    out.push(`main [aria-labelledby*="${uriFrag}" i]{${hide}}`);
    for (const w of wrappers) {
      out.push(`main ${w}:has(${link}){${hide}}`);
    }
  }
  for (const trackId of trackIdsForHiddenAlbums(ids, pathname)) {
    const t = CSS.escape(trackId);
    out.push(
      `main [data-testid="tracklist-row"]:has(a[data-testid="internal-track-link"][href*="/track/${t}"]){${hide}}`,
    );
  }
  return out.join("\n");
}

function paint(): void {
  const next =
    !tilesOn || hidden.size === 0 ? "" : buildCss(hidden, location.pathname);
  if (next === lastCss) return;
  lastCss = next;
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = next;
}

function onRoute(): void {
  const p = location.pathname;
  if (p === lastPath) return;
  lastPath = p;
  paint();
}

function patchHistory(fn: "pushState" | "replaceState"): void {
  const orig = history[fn];
  history[fn] = function (
    this: History,
    ...args: Parameters<History[typeof fn]>
  ) {
    const ret = orig.apply(this, args);
    queueMicrotask(onRoute);
    return ret;
  };
}

const INIT_KEY = "__spotifyCustomizationHiddenAlbumDom" as const;

type WindowWithHiddenInit = typeof window & {
  [INIT_KEY]?: boolean;
};

export function ensureHiddenAlbumDomIntegration(): void {
  const w = window as WindowWithHiddenInit;
  if (w[INIT_KEY]) return;
  w[INIT_KEY] = true;

  connectSync({
    onSnapshot: (snap) => {
      const albums: SavedAlbum[] = Object.values(snap.albums);
      hidden = getHiddenAlbumIds(albums);
      tilesOn = snap.hideAlbumTiles;
      lastPath = location.pathname;
      paint();
    },
  });

  window.addEventListener(
    "message",
    (event: MessageEvent) => {
      if (event.source !== window || event.origin !== location.origin) return;
      if (
        typeof event.data === "object" &&
        event.data &&
        (event.data as { type?: string }).type ===
          DISCOGRAPHY_TRACK_MAP_UPDATED_MESSAGE_TYPE
      ) {
        lastCss = "";
        paint();
      }
    },
    false,
  );

  patchHistory("pushState");
  patchHistory("replaceState");
  window.addEventListener("popstate", onRoute);
}
