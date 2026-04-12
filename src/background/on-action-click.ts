import { openOptionsPage } from "./open-options";

export function registerActionClick(): void {
  chrome.action.onClicked.addListener(() => {
    openOptionsPage();
  });
}
