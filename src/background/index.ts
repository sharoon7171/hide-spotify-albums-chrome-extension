import { registerActionClick } from "./on-action-click";
import { openOptionsPage } from "./open-options";

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install" || details.reason === "update") {
    openOptionsPage();
  }
});

registerActionClick();
