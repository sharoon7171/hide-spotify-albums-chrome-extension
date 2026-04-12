import { albumIdFromPathname } from "@/lib/spotify-album-url";
import {
  getHideAlbumTilesEnabled,
  HIDE_ALBUM_TILES_KEY,
} from "@/lib/extension-settings";
import {
  getHiddenAlbumIds,
  getSavedAlbums,
  SAVED_ALBUMS_KEY,
} from "@/lib/saved-albums";

const STYLE_ID = "spotify-ext-hide-album-css-rules";

let hidden = new Set<string>();
let tilesOn = true;
let lastCss = "";
let lastPath = "";

function buildCss(ids: Set<string>, pathname: string): string {
  const skip = albumIdFromPathname(pathname);
  const out: string[] = [];
  for (const id of [...ids].sort()) {
    if (id === skip) continue;
    const e = CSS.escape(id);
    out.push(
      `main [data-encore-id="card"]:has(a[href="/album/${e}"]){display:none!important}`,
      `main [data-encore-id="card"]:has(a[href$="/album/${e}"]){display:none!important}`,
    );
  }
  return out.join("\n");
}

function paint(): void {
  const next = !tilesOn || hidden.size === 0 ? "" : buildCss(hidden, location.pathname);
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

async function reload(): Promise<void> {
  const albums = await getSavedAlbums();
  hidden = getHiddenAlbumIds(albums);
  tilesOn = await getHideAlbumTilesEnabled();
  lastPath = location.pathname;
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

export async function applyHiddenAlbumsFromStorage(): Promise<void> {
  await reload();
}

export function ensureHiddenAlbumDomIntegration(): void {
  const w = window as WindowWithHiddenInit;
  if (!w[INIT_KEY]) {
    w[INIT_KEY] = true;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (!changes[SAVED_ALBUMS_KEY] && !changes[HIDE_ALBUM_TILES_KEY]) return;
      void reload();
    });
    patchHistory("pushState");
    patchHistory("replaceState");
    window.addEventListener("popstate", onRoute);
  }
  void applyHiddenAlbumsFromStorage();
}
