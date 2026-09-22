export const XpuiRoute = {
  search: /^\/search(?:\/|$)/i,
  discography: /\/discography(?:\/|$)/,
  collection: /^\/collection/,
  library: /^\/library(?:\/|$)/,
} as const;

export const XpuiDom = {
  searchResults: '[data-testid="search-results"]',
  searchInput:
    'input[data-testid="search-input"], input[type="search"]',
  searchInputSection: ".main-globalNav-searchInputSection",
  leftLibraryNav: "nav.main-navBar-mainNav",
  yourLibraryX: ".main-yourLibraryX-library",
  yourLibraryXEntry: ".main-yourLibraryX-entryPoints",
  yourLibraryXContainer: ".main-yourLibraryX-libraryContainer",
  yourLibraryXFilter: ".main-yourLibraryX-filterArea",
  legacyLeftSidebar: "#Desktop_LeftSidebar_Id",
  legacyNavBar: ".Root__nav-bar",
  globalNav: ".Root__globalNav",
  libraryRoot: '[data-testid="library-root"]',
  libraryPage: '[data-testid="library-page"]',
} as const;

export const VIRTUAL_LIST_MODULE = "67310" as const;

function isSearchRoute(pathname: string): boolean {
  return XpuiRoute.search.test(pathname.trim());
}

export function isDiscographyPath(pathname: string): boolean {
  if (isSearchRoute(pathname)) return false;
  return XpuiRoute.discography.test(pathname);
}

export function routePathname(): string {
  return globalThis.location?.pathname ?? "";
}

export function isSearchActive(): boolean {
  const path = routePathname();
  if (isSearchRoute(path)) return true;
  if (document.querySelector(XpuiDom.searchResults)) return true;
  const input = document.querySelector(XpuiDom.searchInput);
  if (input instanceof HTMLInputElement && document.activeElement === input) {
    return true;
  }
  return false;
}

export function usesDiscographyVirtualList(): boolean {
  return isDiscographyPath(routePathname());
}

export function usesDomHiding(): boolean {
  return !usesDiscographyVirtualList() && !isSearchActive();
}

export function domHideSelector(): string {
  return [
    '[data-encore-id="card"]',
    '[data-encore-id="listRow"]',
    '[data-carousel-gridlist-item="true"]',
  ].join(",");
}
