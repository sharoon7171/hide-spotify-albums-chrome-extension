function isOpenSpotifyAlbumUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.hostname !== "open.spotify.com") return false;
    return /\/album\/[^/?#]+/.test(u.pathname);
  } catch {
    return false;
  }
}

async function injectAlbumToggleContentScript(tabId: number): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["content.js"],
    });
  } catch {
    return;
  }
}

export function registerSpotifyAlbumToggleInjection(): void {
  const onNav = (details: { tabId: number; frameId: number; url?: string }) => {
    if (details.frameId !== 0) return;
    const url = details.url;
    if (!url || !isOpenSpotifyAlbumUrl(url)) return;
    void injectAlbumToggleContentScript(details.tabId);
  };

  chrome.webNavigation.onHistoryStateUpdated.addListener(onNav);
  chrome.webNavigation.onCompleted.addListener(onNav);
}
