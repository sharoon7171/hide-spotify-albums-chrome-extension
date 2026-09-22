# Hide Albums in Spotify

Chrome extension (Manifest V3) that hides albums on [open.spotify.com](https://open.spotify.com). Home, Artist, Search, and carousels drop those releases; album pages stay open. Pair it with [Hide Albums in Spicetify](https://github.com/sharoon7171/hide-spotify-albums-spicetify-extension) by pointing both at the **same Firebase project** and signing in with the **same account**.

This package is meant to be built and loaded locally. There is no public store listing and no hosted backend to plug into—you run your own Firebase project and create accounts yourself.

## How to Use

1. Load the built extension in Chrome and open [open.spotify.com](https://open.spotify.com)
2. Open the options page and sign in with an email and password you created in Firebase Authentication
3. Open any album and choose **Hide** in the action bar
4. With **Hide in Grids** on, that album leaves Home, Artist, Search, and carousels
5. Unhide from the album page, or remove the row from the options list

### Options Page

- **Sign in / Sign out** — use an account that already exists in your Firebase project
- **Hide in Grids** — local on/off for grid hiding; does not delete albums
- **Hidden list** — search, open, remove one, or **Clear All**

Clear All removes every album doc for that signed-in user in your Firestore project, so every client using that account updates.

## Setup

### Requirements

- Node.js 20.19+ or 22.12+ (Vite 8)
- Google Chrome
- Your own Firebase project with Email/Password authentication and Cloud Firestore

### Create Accounts Manually

The options UI only supports sign-in. There is no signup flow in the extension.

1. In the Firebase console, open **Authentication** → **Users**
2. Add each email and password you want to allow
3. Use those credentials in the extension (and in Spicetify if you sync)

Disable public self-registration in Firebase Auth if it is on, so only accounts you add can sign in.

### Environment

Copy `.env.example` to `.env` and fill in values from **your** Firebase web app config:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

### Firestore Rules

Deploy `firestore.rules` from this directory to that same project. Rules allow each signed-in user to read and write only `users/{uid}/savedAlbums/{albumId}`.

### Build and Load in Chrome

1. `npm install`
2. `npm run build`
3. `chrome://extensions` → Developer mode → **Load unpacked** → select `dist`
4. Reload any open Spotify Web tabs

`package.json` already lists `allowScripts` for Firebase’s `@firebase/util` and `protobufjs` postinstall hooks ([npm install-scripts](https://docs.npmjs.com/cli/v11/commands/npm-install-scripts)). After a dependency bump, if npm warns about new install scripts, run `npm install-scripts ls` then `npm install-scripts approve <pkg>`.

`npm run dev` watches background, content, page, bridge, and options for local iteration.

## Storage Model

| Layer | What it holds |
| --- | --- |
| Firebase Auth (IndexedDB) | Signed-in user (`uid`); restored before album reads |
| Firestore `users/{uid}/savedAlbums/{albumId}` | Server copy of each hidden album (`updatedAt`, optional `title` / `url`) |
| Firestore persistent cache | Local album list for that `uid`; filled with `getDocsFromCache` (works offline once seeded) |
| `onSnapshot` | Live sync with the server after the cache hydrate |
| `chrome.storage.local` | **Hide in Grids** only (device-local, not synced) |

The **service worker** owns Auth and Firestore. It waits until Auth state is settled, hydrates albums from the persistent cache, then keeps them in sync with `onSnapshot`. Options, content, and the page bridge only receive snapshots over the extension sync port — they do not open Firebase themselves.

## Project Layout

| Path | Role |
| --- | --- |
| `src/background` | Service worker, auth, sync, messaging |
| `src/content` | Hide / Unhide control on album pages |
| `src/page` | MAIN-world DOM hiding for grids and search |
| `src/bridge` | Hidden ID bridge into the page world |
| `src/options` | React options UI |
| `public/manifest.json` | MV3 entry points and host permissions |
| `firestore.rules` | Per-user album rules |

Stack: TypeScript, Vite, React, Tailwind CSS, Firebase Auth, Cloud Firestore.

## Permissions

| Permission | Purpose |
| --- | --- |
| `storage` | Local **Hide in Grids** preference |
| `https://open.spotify.com/*` | Hide UI and grid filtering on Spotify Web |
| Firebase / Google API hosts | Auth and Firestore against **your** project |

## Scripts

| Command | Action |
| --- | --- |
| `npm run build` | Typecheck and write `dist` |
| `npm run dev` | Watch all extension entry points |
