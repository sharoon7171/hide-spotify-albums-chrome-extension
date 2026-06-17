import {
  hiddenAlbumIdSet,
  installHiddenIdsListener,
  subscribeHiddenAlbumIds,
} from "@/lib/hidden-album-ids";
import {
  applyHideAlbumDom,
  disarmDomObserver,
  initHideAlbumDom,
  mainDomRoot,
  restoreAllDomHiding,
} from "@/hiding/dom";
import {
  applySearchAlbumDomHide,
  armSearchDomObserver,
  disarmSearchDomObserver,
  restoreSearchDomHiding,
} from "@/hiding/search";
import {
  isSearchActive,
  routePathname,
  usesDiscographyVirtualList,
  usesDomHiding,
} from "@/hiding/routes";
import {
  applyVirtualListAlbumPatch,
  getWebpackRequire,
  installWebpackEarlyHooks,
} from "@/page/webpack";

const INIT_KEY = "__spotifyExtPageWorldInstalled_v2" as const;
const ALBUM_URI = /^spotify:album:([0-9A-Za-z]+)$/;
const patchCtx = { hiddenIds: hiddenAlbumIdSet, albumUriRe: ALBUM_URI };

type WindowWithInit = typeof window & { [INIT_KEY]?: boolean };

function listenRouteChanges(fn: () => void): () => void {
  const run = () => queueMicrotask(fn);
  const patch = (name: "pushState" | "replaceState") => {
    const orig = history[name];
    history[name] = function (
      this: History,
      ...args: Parameters<History[typeof name]>
    ) {
      const ret = orig.apply(this, args);
      run();
      return ret;
    };
  };
  patch("pushState");
  patch("replaceState");
  window.addEventListener("popstate", run);
  const nav = (window as Window & { navigation?: EventTarget }).navigation;
  if (nav && typeof nav.addEventListener === "function") {
    nav.addEventListener("navigate", run);
  }
  return () => window.removeEventListener("popstate", run);
}

function hiddenSignature(): string {
  return [...hiddenAlbumIdSet()].sort().join("\0");
}

function startHiddenAlbumsApply(): () => void {
  let prevSig = hiddenSignature();
  const pathname = routePathname;
  const offDom = initHideAlbumDom();

  const sync = () => {
    if (usesDiscographyVirtualList()) {
      const req = getWebpackRequire();
      if (req) applyVirtualListAlbumPatch(req, patchCtx);
    }
    restoreSearchDomHiding();
    if (isSearchActive()) {
      applySearchAlbumDomHide(hiddenAlbumIdSet());
      armSearchDomObserver(hiddenAlbumIdSet);
    } else {
      disarmSearchDomObserver();
    }
    restoreAllDomHiding();
    if (!isSearchActive() && usesDomHiding()) {
      applyHideAlbumDom(mainDomRoot(), pathname(), hiddenAlbumIdSet());
    } else {
      disarmDomObserver();
    }
  };

  sync();

  const offStore = subscribeHiddenAlbumIds(() => {
    const next = hiddenSignature();
    if (next === prevSig) return;
    prevSig = next;
    sync();
  });

  const offNav = listenRouteChanges(sync);

  return () => {
    offStore();
    offNav();
    offDom();
    disarmSearchDomObserver();
    restoreSearchDomHiding();
    restoreAllDomHiding();
  };
}

function install(): void {
  const w = window as WindowWithInit;
  if (w[INIT_KEY]) return;
  w[INIT_KEY] = true;
  installWebpackEarlyHooks();
  installHiddenIdsListener();
  startHiddenAlbumsApply();
}

install();
