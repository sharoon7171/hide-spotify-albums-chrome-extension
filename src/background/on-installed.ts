import { openOptionsPage } from "./open-options";

export function registerOnInstalled(): void {
  chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === "install" || details.reason === "update") {
      openOptionsPage();
    }
  });
}
