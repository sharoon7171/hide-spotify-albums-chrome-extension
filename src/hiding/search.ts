import { albumIdFromEncoreElement } from "@/hiding/dom";
import { isSearchActive, XpuiDom } from "@/hiding/routes";

const SEARCH_HIDDEN_ATTR = "data-spotify-ext-search-album-hidden";

const SEARCH_CARD_SELECTOR = [
  '[data-testid^="search-category-card"]',
  '[data-encore-id="card"]',
  '[data-encore-id="listRow"]',
  '[data-carousel-gridlist-item="true"]',
].join(",");

let searchObserver: MutationObserver | null = null;
let searchScheduled = false;

function searchResultsRoot(): Element | null {
  return document.querySelector(XpuiDom.searchResults);
}

function searchApplyRoot(): ParentNode | null {
  return searchResultsRoot() ?? document.querySelector("main");
}

function albumIdFromSearchElement(el: Element): string | null {
  const fromEncore = albumIdFromEncoreElement(el);
  if (fromEncore) return fromEncore;
  const card = el.closest('[data-testid^="search-category-card"]');
  if (!card) return null;
  const inner = card.querySelector('[id*="spotify:album:"]');
  if (inner?.id) {
    const m = inner.id.match(/spotify:album:([0-9A-Za-z]+)/);
    if (m) return m[1];
  }
  const cardLink = card.querySelector('a[href*="/album/"]');
  if (cardLink) {
    const m = cardLink.getAttribute("href")?.match(/\/album\/([^/?#]+)/);
    if (m) return m[1];
  }
  return null;
}

function searchAlbumHideTarget(el: Element): HTMLElement | null {
  const category = el.closest('[data-testid^="search-category-card"]');
  if (category?.parentElement instanceof HTMLElement) return category.parentElement;
  const carousel = el.closest('[data-carousel-gridlist-item="true"]');
  if (carousel instanceof HTMLElement) return carousel;
  const gridCell = el.closest('[role="gridcell"]');
  if (gridCell instanceof HTMLElement) return gridCell;
  if (el instanceof HTMLElement) return el;
  return null;
}

export function restoreSearchDomHiding(): void {
  const root = searchApplyRoot();
  if (!root) return;
  for (const el of root.querySelectorAll(`[${SEARCH_HIDDEN_ATTR}="1"]`)) {
    if (!(el instanceof HTMLElement)) continue;
    el.removeAttribute(SEARCH_HIDDEN_ATTR);
    el.style.display = "";
  }
}

export function applySearchAlbumDomHide(hidden: Set<string>): void {
  if (!isSearchActive()) return;
  const root = searchApplyRoot();
  if (!root) return;
  const inResults = searchResultsRoot();
  for (const el of root.querySelectorAll(SEARCH_CARD_SELECTOR)) {
    if (inResults && !inResults.contains(el)) continue;
    const target = searchAlbumHideTarget(el);
    if (!target) continue;
    const id = albumIdFromSearchElement(el);
    if (!id) continue;
    if (!hidden.has(id)) {
      if (target.getAttribute(SEARCH_HIDDEN_ATTR) === "1") {
        target.removeAttribute(SEARCH_HIDDEN_ATTR);
        target.style.display = "";
      }
      continue;
    }
    if (target.getAttribute(SEARCH_HIDDEN_ATTR) === "1") continue;
    target.setAttribute(SEARCH_HIDDEN_ATTR, "1");
    target.style.display = "none";
  }
}

export function disarmSearchDomObserver(): void {
  searchObserver?.disconnect();
  searchObserver = null;
  searchScheduled = false;
}

export function armSearchDomObserver(hidden: () => Set<string>): void {
  disarmSearchDomObserver();
  const root = document.querySelector("main");
  if (!root) return;
  searchObserver = new MutationObserver(() => {
    if (searchScheduled || !isSearchActive()) return;
    searchScheduled = true;
    requestAnimationFrame(() => {
      searchScheduled = false;
      if (!isSearchActive()) return;
      applySearchAlbumDomHide(hidden());
    });
  });
  searchObserver.observe(root, { childList: true, subtree: true });
}
