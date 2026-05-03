import {
  albumIdFromSavedAlbum,
  type SavedAlbum,
} from "@/lib/saved-albums";
import {
  albumIdFromPathname,
  normalizeOpenSpotifyAlbumUrl,
} from "@/lib/spotify-album-url";
import {
  hideButtonShadowCss,
  iconSvgEye,
  iconSvgEyeOff,
} from "@/content/hide-button-styles";
import { sendToBackground } from "@/lib/messages";
import { connectSync } from "@/lib/sync-port";

const HOST_ID = "spotify-customization-album-host";

let hiddenAlbums: Record<string, SavedAlbum> = {};

function currentAlbumId(): string | null {
  return albumIdFromPathname(location.pathname);
}

function readAlbumTitle(): string {
  const h = document.querySelector("main h1")?.textContent?.trim();
  if (h) return h;
  const t = document.title;
  const i = t.indexOf(" - ");
  const head = i > 0 ? t.slice(0, i) : t;
  return head.replace(/\s*\|\s*Spotify\s*$/i, "").trim();
}

function isHiddenLocally(id: string): boolean {
  for (const a of Object.values(hiddenAlbums)) {
    if (albumIdFromSavedAlbum(a) === id) return true;
  }
  return false;
}

function findDocIdForAlbumId(id: string): string | null {
  for (const [docId, a] of Object.entries(hiddenAlbums)) {
    if (albumIdFromSavedAlbum(a) === id) return docId;
  }
  return null;
}

function removeHost(): void {
  document.getElementById(HOST_ID)?.remove();
}

function attachHideButtonHost(host: HTMLElement): boolean {
  const bar = document.querySelector("main [data-testid=\"action-bar-row\"]");
  if (!bar) return false;
  const more = bar.querySelector<HTMLElement>("[data-testid=\"more-button\"]");
  if (more) {
    if (more.nextElementSibling !== host) {
      more.insertAdjacentElement("afterend", host);
    }
    return true;
  }
  if (host.parentElement !== bar) {
    bar.appendChild(host);
  }
  return true;
}

function applyHideButtonPresentation(
  btn: HTMLButtonElement,
  albumIsHidden: boolean,
): void {
  btn.classList.remove("ext-btn--hide", "ext-btn--unhide");
  btn.classList.add("ext-btn", albumIsHidden ? "ext-btn--unhide" : "ext-btn--hide");
}

function refreshHideToggle(): void {
  const id = currentAlbumId();
  const host = document.getElementById(HOST_ID) as HTMLDivElement | null;
  if (!id || !host?.shadowRoot) return;
  const inList = isHiddenLocally(id);
  const sig = `${id}:${inList ? "1" : "0"}`;
  if (host.dataset.extToggleSig === sig) return;
  host.dataset.extToggleSig = sig;
  host.dataset.albumId = id;
  const btn = host.shadowRoot.querySelector(
    "[data-role=\"hide-list-button\"]",
  ) as HTMLButtonElement | null;
  const icon = host.shadowRoot.querySelector(
    "[data-role=\"hide-list-icon\"]",
  ) as HTMLElement | null;
  const label = host.shadowRoot.querySelector(
    "[data-role=\"hide-list-label\"]",
  ) as HTMLElement | null;
  if (!btn || !icon || !label) return;
  label.textContent = inList ? "Unhide" : "Hide";
  icon.innerHTML = inList ? iconSvgEye : iconSvgEyeOff;
  btn.setAttribute(
    "aria-label",
    inList
      ? "Show this album on Spotify again by removing it from this extension"
      : "Hide this album on Spotify by saving its album URL in this extension",
  );
  applyHideButtonPresentation(btn, inList);
}

function buildHostShell(): HTMLDivElement {
  const host = document.createElement("div");
  host.id = HOST_ID;

  const shadow = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = hideButtonShadowCss;
  shadow.appendChild(style);
  const wrap = document.createElement("div");
  wrap.className = "ext-wrap";
  const btn = document.createElement("button");
  btn.type = "button";
  btn.dataset.role = "hide-list-button";
  const icon = document.createElement("span");
  icon.className = "ext-btn__icon";
  icon.dataset.role = "hide-list-icon";
  const label = document.createElement("span");
  label.className = "ext-btn__label";
  label.dataset.role = "hide-list-label";
  btn.append(icon, label);
  wrap.appendChild(btn);
  shadow.appendChild(wrap);

  let actionBusy = false;
  btn.addEventListener("click", async () => {
    if (actionBusy) return;
    const clickId = currentAlbumId();
    if (!clickId) return;
    actionBusy = true;
    btn.disabled = true;
    try {
      if (isHiddenLocally(clickId)) {
        const docId = findDocIdForAlbumId(clickId);
        if (docId) {
          const res = await sendToBackground({ kind: "albums/remove", docId });
          if (!res.ok) console.warn("[spotify-ext] unhide failed", res);
        }
      } else {
        const url = normalizeOpenSpotifyAlbumUrl(location.href);
        if (!url) return;
        const entry: SavedAlbum = {
          savedAt: Date.now(),
          url,
          title: readAlbumTitle(),
        };
        const res = await sendToBackground({ kind: "albums/upsert", entry });
        if (!res.ok) console.warn("[spotify-ext] hide failed", res);
      }
    } finally {
      actionBusy = false;
      btn.disabled = false;
    }
  });

  return host;
}

function ensureHideToggle(): void {
  if (!albumIdFromPathname(location.pathname)) {
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
  if (!attachHideButtonHost(host)) {
    if (!document.documentElement.contains(host)) {
      host.remove();
    }
    return;
  }
  refreshHideToggle();
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

const scheduleSync = debounce(() => syncAlbumPageUi(), 160);

function observeSpotifyDom(): void {
  const moBody = new MutationObserver(() => scheduleSync());
  moBody.observe(document.body, { childList: true, subtree: true });

  const titleEl = document.querySelector("title");
  if (titleEl) {
    const moTitle = new MutationObserver(() => scheduleSync());
    moTitle.observe(titleEl, {
      childList: true,
      subtree: true,
      characterData: true,
    });
  }
}

function attachNavigationSync(): void {
  const w = window as Window & { navigation?: EventTarget };
  const n = w.navigation;
  if (n && typeof n.addEventListener === "function") {
    n.addEventListener("navigate", () =>
      queueMicrotask(() => syncAlbumPageUi()),
    );
  }
}

function syncAlbumPageUi(): void {
  ensureHideToggle();
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
  if (w[INIT_KEY]) return;
  w[INIT_KEY] = true;

  connectSync({
    onSnapshot: (snap) => {
      hiddenAlbums = snap.albums;
      const host = document.getElementById(HOST_ID) as HTMLDivElement | null;
      if (host) delete host.dataset.extToggleSig;
      refreshHideToggle();
    },
  });

  patchHistory("pushState");
  patchHistory("replaceState");
  window.addEventListener("popstate", () => syncAlbumPageUi());
  observeSpotifyDom();
  attachNavigationSync();
  syncAlbumPageUi();
}
