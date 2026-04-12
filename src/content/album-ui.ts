import {
  buttonIsHidden,
  buttonNotHidden,
  hostChromeStyle,
  hostInnerStyle,
} from "@/content/injected-hide-button-styles";

const STORAGE_KEY = "savedAlbums";
const HOST_ID = "spotify-customization-album-host";

type StoredAlbum = { id: string; title: string; savedAt: number };

function albumIdFromPathname(pathname: string): string | null {
  const m = pathname.match(/\/album\/([^/?#]+)/);
  return m ? m[1] : null;
}

function currentAlbumId(): string | null {
  return albumIdFromPathname(location.pathname);
}

function isAlbumPath(pathname: string): boolean {
  return /\/album\/[^/?#]+/.test(pathname);
}

function readAlbumTitle(): string {
  const h = document.querySelector("main h1")?.textContent?.trim();
  if (h) return h;
  const t = document.title;
  const i = t.indexOf(" - ");
  const head = i > 0 ? t.slice(0, i) : t;
  return head.replace(/\s*\|\s*Spotify\s*$/i, "").trim();
}

async function loadList(): Promise<StoredAlbum[]> {
  const r = await chrome.storage.local.get(STORAGE_KEY);
  const v = r[STORAGE_KEY];
  return Array.isArray(v) ? (v as StoredAlbum[]) : [];
}

async function isInHiddenList(id: string): Promise<boolean> {
  const list = await loadList();
  return list.some((a) => a.id === id);
}

async function addToHiddenList(id: string, title: string): Promise<void> {
  const list = await loadList();
  const next = list.filter((a) => a.id !== id);
  next.push({ id, title, savedAt: Date.now() });
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
}

async function removeFromHiddenList(id: string): Promise<void> {
  const list = await loadList();
  await chrome.storage.local.set({
    [STORAGE_KEY]: list.filter((a) => a.id !== id),
  });
}

function removeHost(): void {
  document.getElementById(HOST_ID)?.remove();
}

function findAddToLibraryButton(): HTMLElement | null {
  const bar = document.querySelector(
    "main [data-testid=\"action-bar-row\"]",
  );
  const add = bar?.querySelector("[data-testid=\"add-button\"]");
  return add instanceof HTMLElement ? add : null;
}

function attachAfterAddToLibrary(host: HTMLElement): boolean {
  const add = findAddToLibraryButton();
  if (!add) return false;
  host.style.cssText = hostChromeStyle;
  if (host.previousElementSibling !== add) {
    add.insertAdjacentElement("afterend", host);
  }
  return true;
}

function applyHideButtonPresentation(
  btn: HTMLButtonElement,
  albumIsHidden: boolean,
): void {
  btn.style.cssText = albumIsHidden ? buttonIsHidden : buttonNotHidden;
}

async function refreshHideToggle(): Promise<void> {
  const id = currentAlbumId();
  const host = document.getElementById(HOST_ID) as HTMLDivElement | null;
  if (!id || !host?.shadowRoot) return;
  host.dataset.albumId = id;
  const btn = host.shadowRoot.querySelector(
    "[data-role=\"hide-list-button\"]",
  ) as HTMLButtonElement | null;
  if (!btn) return;
  const inList = await isInHiddenList(id);
  btn.textContent = inList ? "Unhide" : "Hide";
  btn.setAttribute(
    "aria-label",
    inList
      ? "Show this album on Spotify again by removing its album ID from this extension"
      : "Hide this album on Spotify by saving its album ID in this extension",
  );
  applyHideButtonPresentation(btn, inList);
}

function buildHostShell(): HTMLDivElement {
  const host = document.createElement("div");
  host.id = HOST_ID;

  const shadow = host.attachShadow({ mode: "open" });
  const wrap = document.createElement("div");
  wrap.style.cssText = hostInnerStyle;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.role = "hide-list-button";
  wrap.appendChild(btn);
  shadow.appendChild(wrap);

  btn.addEventListener("click", async () => {
    const clickId = currentAlbumId();
    if (!clickId) return;
    const inList = await isInHiddenList(clickId);
    if (inList) {
      await removeFromHiddenList(clickId);
    } else {
      await addToHiddenList(clickId, readAlbumTitle());
    }
    await refreshHideToggle();
  });

  return host;
}

async function ensureHideToggle(): Promise<void> {
  if (!isAlbumPath(location.pathname)) {
    removeHost();
    return;
  }
  const id = currentAlbumId();
  if (!id) {
    removeHost();
    return;
  }

  let host = document.getElementById(HOST_ID) as HTMLDivElement | null;
  if (!host) {
    host = buildHostShell();
  }
  host.dataset.albumId = id;
  if (!attachAfterAddToLibrary(host)) {
    if (!document.documentElement.contains(host)) {
      host.remove();
    }
    return;
  }
  await refreshHideToggle();
}

function debounce(fn: () => void, ms: number): () => void {
  let t: ReturnType<typeof setTimeout> | undefined;
  return () => {
    if (t !== undefined) clearTimeout(t);
    t = setTimeout(() => {
      t = undefined;
      fn();
    }, ms);
  };
}

const scheduleSync = debounce(() => {
  syncAlbumPageUi();
}, 160);

function observeSpotifyDom(): void {
  const run = () => scheduleSync();
  const moMain = new MutationObserver(run);
  const attachMain = (main: Element) => {
    moMain.disconnect();
    moMain.observe(main, { childList: true, subtree: true });
  };
  const main0 = document.querySelector("main");
  if (main0) attachMain(main0);

  const moBody = new MutationObserver(() => {
    const m = document.querySelector("main");
    if (m) attachMain(m);
    run();
  });
  moBody.observe(document.body, { childList: true, subtree: true });

  const titleEl = document.querySelector("title");
  if (titleEl) {
    const moTitle = new MutationObserver(run);
    moTitle.observe(titleEl, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
}

export function syncAlbumPageUi(): void {
  void ensureHideToggle();
}

function patchHistory(fnName: "pushState" | "replaceState"): void {
  const original = history[fnName];
  history[fnName] = function (
    this: History,
    ...args: Parameters<History[typeof fnName]>
  ) {
    const ret = original.apply(this, args);
    queueMicrotask(() => syncAlbumPageUi());
    return ret;
  };
}

const INIT_KEY = "__spotifyCustomizationAlbumPage" as const;

type WindowWithAlbumInit = typeof window & {
  [INIT_KEY]?: boolean;
};

export function ensureAlbumPageIntegration(): void {
  const w = window as WindowWithAlbumInit;
  if (!w[INIT_KEY]) {
    w[INIT_KEY] = true;
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[STORAGE_KEY]) return;
      void refreshHideToggle();
    });
    patchHistory("pushState");
    patchHistory("replaceState");
    window.addEventListener("popstate", () => syncAlbumPageUi());
    observeSpotifyDom();
    let lastPath = location.pathname;
    setInterval(() => {
      if (location.pathname !== lastPath) {
        lastPath = location.pathname;
        syncAlbumPageUi();
      }
    }, 400);
  }
  syncAlbumPageUi();
}
