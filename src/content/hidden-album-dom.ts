import { albumIdFromPathname } from "@/lib/spotify-album-url";
import { getHiddenAlbumIds, type SavedAlbum } from "@/lib/saved-albums";
import { connectSync } from "@/lib/sync-port";

const STYLE_ID = "spotify-ext-hide-album-css-rules";
const DOM_HIDDEN_ATTR = "data-spotify-ext-hidden-album-section";
const ALBUM_HREF_RE = /\/album\/([0-9A-Za-z]{16,32})(?:[/?#]|$)/;

let hidden = new Set<string>();
let tilesOn = true;
let lastCss = "";
let lastPath = "";
let domHideTimer: ReturnType<typeof setTimeout> | undefined;

function buildCss(ids: Set<string>, pathname: string): string {
  const skip = albumIdFromPathname(pathname);
  const hide = "display:none!important";
  const wrappers = [
    '[data-encore-id="card"]',
    '[data-carousel-gridlist-item="true"]',
    '[data-testid="card-click-handler"]',
    '[data-testid="entity-card"]',
    '[data-testid="grid-card"]',
  ] as const;
  const out: string[] = [];
  out.push(`main [${DOM_HIDDEN_ATTR}]{${hide}}`);
  for (const id of [...ids].sort()) {
    if (id === skip) continue;
    const e = CSS.escape(id);
    const link = `a[href*="/album/${e}"]`;
    for (const w of wrappers) {
      out.push(`main ${w}:has(${link}){${hide}}`);
    }
  }
  return out.join("\n");
}

function albumIdFromAlbumHref(href: string | null): string | null {
  if (!href) return null;
  const m = ALBUM_HREF_RE.exec(href);
  return m?.[1] ?? null;
}

function findAlbumSectionRoot(link: HTMLAnchorElement): HTMLElement | null {
  let cur = link.parentElement as HTMLElement | null;
  while (cur && cur !== document.body) {
    if (cur.tagName === "MAIN") return null;
    const linkCount = cur.querySelectorAll('a[href*="/album/"]').length;
    if (linkCount === 1) {
      const cardLike = cur.matches(
        [
          '[data-encore-id="card"]',
          '[data-carousel-gridlist-item="true"]',
          '[data-testid="card-click-handler"]',
          '[data-testid="entity-card"]',
          '[data-testid="grid-card"]',
        ].join(","),
      );
      if (cardLike) return cur;
    }
    cur = cur.parentElement;
  }
  return null;
}

function applyDomHides(ids: Set<string>, pathname: string): void {
  const skip = albumIdFromPathname(pathname);
  for (const el of document.querySelectorAll<HTMLElement>(`main [${DOM_HIDDEN_ATTR}]`)) {
    el.removeAttribute(DOM_HIDDEN_ATTR);
  }
  if (!tilesOn || ids.size === 0) return;
  const roots = new Set<HTMLElement>();
  for (const link of document.querySelectorAll<HTMLAnchorElement>(
    'main a[href*="/album/"]',
  )) {
    const id = albumIdFromAlbumHref(link.getAttribute("href") ?? link.href);
    if (!id || id === skip || !ids.has(id)) continue;
    const root = findAlbumSectionRoot(link);
    if (root) roots.add(root);
  }
  for (const root of roots) root.setAttribute(DOM_HIDDEN_ATTR, "1");
}

function scheduleDomHidePass(): void {
  if (domHideTimer !== undefined) clearTimeout(domHideTimer);
  domHideTimer = setTimeout(() => {
    domHideTimer = undefined;
    applyDomHides(hidden, location.pathname);
  }, 90);
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
  applyDomHides(hidden, location.pathname);
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

  patchHistory("pushState");
  patchHistory("replaceState");
  window.addEventListener("popstate", onRoute);
  const mo = new MutationObserver(() => scheduleDomHidePass());
  mo.observe(document.body, { childList: true, subtree: true });
}
