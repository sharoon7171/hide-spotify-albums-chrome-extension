import { registerActionClick } from "./on-action-click";
import { openOptionsPage } from "./open-options";
import {
  ensureSpotifyContentScriptsRegistered,
  registerSpotifyContentScripts,
} from "./register-spotify-content-scripts";

void ensureSpotifyContentScriptsRegistered().catch(() => {
  void registerSpotifyContentScripts();
});

chrome.runtime.onInstalled.addListener((details) => {
  void registerSpotifyContentScripts();
  if (details.reason === "install" || details.reason === "update") {
    openOptionsPage();
  }
});

registerActionClick();
