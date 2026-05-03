import { registerActionClick } from "./on-action-click";
import { openOptionsPage } from "./open-options";
import { startSync } from "./sync";

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install" || details.reason === "update") {
    openOptionsPage();
  }
});

registerActionClick();

startSync();
