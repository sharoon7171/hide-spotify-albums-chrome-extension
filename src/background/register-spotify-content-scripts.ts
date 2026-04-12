const SPOTIFY_CONTENT_SCRIPT_ID = "spotify-customization-main";

const spotifyContentScriptDef = {
  id: SPOTIFY_CONTENT_SCRIPT_ID,
  matches: ["https://open.spotify.com/*"],
  js: ["content.js"],
  runAt: "document_idle" as const,
};

let registerQueue: Promise<void> = Promise.resolve();

export function registerSpotifyContentScripts(): Promise<void> {
  const run = registerQueue.then(async () => {
    const list = await chrome.scripting.getRegisteredContentScripts();
    const exists = list.some((s) => s.id === SPOTIFY_CONTENT_SCRIPT_ID);
    if (exists) {
      await chrome.scripting.updateContentScripts([spotifyContentScriptDef]);
    } else {
      await chrome.scripting.registerContentScripts([spotifyContentScriptDef]);
    }
  });
  registerQueue = run.catch(() => {});
  return run;
}

export async function ensureSpotifyContentScriptsRegistered(): Promise<void> {
  const list = await chrome.scripting.getRegisteredContentScripts();
  if (list.some((s) => s.id === SPOTIFY_CONTENT_SCRIPT_ID)) return;
  await registerSpotifyContentScripts();
}
