import { useCallback, useEffect, useMemo, useState } from "react";
import {
  albumIdFromSavedAlbum,
  type SavedAlbum,
} from "@/lib/saved-albums";
import { spotifyAlbumUrl } from "@/lib/spotify-album-url";
import {
  displayTitle,
  formatUpdatedAt,
  sortedAlbums,
} from "@/options/options-helpers";
import { useFirestoreSync } from "@/options/use-firestore-sync";
import { sendToBackground } from "@/lib/messages";

type AlbumRow = SavedAlbum & { docId: string };

export function OptionsApp() {
  const sync = useFirestoreSync();
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<{
    kind: "signin" | "signout" | "clear" | null;
  }>({ kind: null });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingHideTiles, setPendingHideTiles] = useState<boolean | null>(
    null,
  );
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (pendingHideTiles === null) return;
    if (sync.hideAlbumTiles === pendingHideTiles) setPendingHideTiles(null);
  }, [pendingHideTiles, sync.hideAlbumTiles]);

  const albums: AlbumRow[] = useMemo(() => {
    return sortedAlbums(
      Object.entries(sync.albums).map(([docId, a]) => ({ ...a, docId })),
    );
  }, [sync.albums]);

  const filteredAlbums = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return albums;
    return albums.filter((a) => {
      const id = albumIdFromSavedAlbum(a);
      return [a.title ?? "", a.url ?? "", id ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [albums, query]);

  const removeOne = useCallback(async (docId: string) => {
    const res = await sendToBackground({ kind: "albums/remove", docId });
    if (!res.ok) console.warn("[hide-albums] remove failed", res);
  }, []);

  const removeAll = useCallback(async () => {
    if (!albums.length) return;
    if (
      !window.confirm(
        `Clear all ${albums.length} hidden album${albums.length === 1 ? "" : "s"}? This updates every signed-in device.`,
      )
    )
      return;
    setBusy({ kind: "clear" });
    const res = await sendToBackground({ kind: "albums/clear" });
    setBusy({ kind: null });
    if (!res.ok) console.warn("[hide-albums] clear failed", res);
    setQuery("");
  }, [albums.length]);

  const setHideTiles = useCallback(async (value: boolean) => {
    setPendingHideTiles(value);
    const res = await sendToBackground({
      kind: "settings/set-hide-tiles",
      value,
    });
    if (!res.ok) {
      setPendingHideTiles(null);
      console.warn("[hide-albums] set-hide-tiles failed", res);
    }
  }, []);

  const submitSignIn = useCallback(async () => {
    const e = email.trim();
    if (!e || !password) {
      setAuthError("Enter email and password.");
      return;
    }
    setBusy({ kind: "signin" });
    setAuthError(null);
    const res = await sendToBackground({
      kind: "auth/sign-in",
      email: e,
      password,
    });
    if (!res.ok) setAuthError(res.message);
    else setPassword("");
    setBusy({ kind: null });
  }, [email, password]);

  const signOut = useCallback(async () => {
    setBusy({ kind: "signout" });
    setAuthError(null);
    const res = await sendToBackground({ kind: "auth/sign-out" });
    if (!res.ok) setAuthError(res.message);
    setBusy({ kind: null });
  }, []);

  const total = albums.length;
  const shown = filteredAlbums.length;
  const loading = !sync.ready;
  const hideTilesEnabled = pendingHideTiles ?? sync.hideAlbumTiles;
  const searching = query.trim().length > 0;

  return (
    <div className="min-h-screen bg-[#121212] font-[Figtree,ui-sans-serif,system-ui,sans-serif] text-white">
      <main className="mx-auto flex min-h-screen max-w-[680px] flex-col gap-5 px-5 py-8 sm:px-6 sm:py-10">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Hide Albums in Spotify
          </h1>
          <p className="max-w-lg text-sm leading-relaxed text-white/55">
            Hide albums from Home, Artist, Search, and carousels on
            open.spotify.com. Unhide from any album page. Sign in to sync with
            Hide Albums in Spicetify.
          </p>
        </header>

        <section className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.06]">
          {!sync.ready ? (
            <div className="h-16 animate-pulse bg-white/5" />
          ) : sync.user ? (
            <>
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-x-4 gap-y-2 px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-bold">
                    {sync.user.email ?? "Signed in"}
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    Signed in · syncs with Hide Albums in Spicetify
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  disabled={busy.kind === "signout"}
                  className="h-8 w-full rounded-full border border-white/15 text-xs font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
                >
                  {busy.kind === "signout" ? "…" : "Sign Out"}
                </button>
              </div>
              <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-x-4 border-t border-white/10 px-4 py-4 sm:px-5">
                <div className="min-w-0">
                  <p className="text-[15px] font-bold">Hide in Grids</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/50">
                    When on, hidden albums stay off Home, Artist, and Search.
                    Album pages stay open.
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={hideTilesEnabled}
                    aria-label="Hide albums in grids"
                    onClick={() => void setHideTiles(!hideTilesEnabled)}
                    className={`relative h-6 w-[42px] shrink-0 rounded-full transition-colors ${
                      hideTilesEnabled ? "bg-[#1ed760]" : "bg-white/25"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                        hideTilesEnabled ? "translate-x-[18px]" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              </div>
              {authError && (
                <p className="border-t border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs font-medium text-rose-200 sm:px-5">
                  {authError}
                </p>
              )}
            </>
          ) : (
            <form
              className="space-y-3 px-4 py-5 sm:px-5"
              onSubmit={(ev) => {
                ev.preventDefault();
                void submitSignIn();
              }}
            >
              <div>
                <p className="text-[15px] font-bold">Sign In</p>
                <p className="mt-1 text-xs leading-relaxed text-white/50">
                  Sign in to sync with Hide Albums in Spicetify.
                </p>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-white/70">Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2.5 text-sm outline-none focus:border-[#1ed760]/60 focus:ring-2 focus:ring-[#1ed760]/25"
                  required
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-white/70">
                  Password
                </span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-black/35 px-3 py-2.5 text-sm outline-none focus:border-[#1ed760]/60 focus:ring-2 focus:ring-[#1ed760]/25"
                  required
                  minLength={6}
                />
              </label>
              {authError && (
                <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-200">
                  {authError}
                </p>
              )}
              <button
                type="submit"
                disabled={busy.kind === "signin"}
                className="inline-flex h-10 w-full items-center justify-center rounded-full bg-[#1ed760] text-sm font-bold text-black transition hover:bg-[#1fdf64] disabled:opacity-50"
              >
                {busy.kind === "signin" ? "Signing in…" : "Sign In"}
              </button>
            </form>
          )}
        </section>

        {sync.user && (
          <section className="flex flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[15px] font-bold">
                  {loading
                    ? "Loading…"
                    : total === 0
                      ? "No hidden albums"
                      : searching
                        ? `${shown} of ${total}`
                        : `${total} hidden album${total === 1 ? "" : "s"}`}
                </p>
                <p className="mt-1 text-xs text-white/50">
                  {total > 0
                    ? searching
                      ? shown === 0
                        ? "No matches"
                        : `${shown} match${shown === 1 ? "" : "es"}`
                      : "Newest first · synced when signed in"
                    : "Open an album and choose Hide."}
                </p>
              </div>
              {total > 0 && (
                <button
                  type="button"
                  onClick={() => void removeAll()}
                  disabled={busy.kind === "clear"}
                  className="h-8 rounded-full border border-rose-400/50 px-3 text-xs font-bold text-[#ff8a9a] transition hover:bg-rose-500/15 disabled:opacity-50"
                >
                  {busy.kind === "clear" ? "Clearing…" : "Clear All"}
                </button>
              )}
            </div>

            {total > 0 && (
              <label className="block space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-white/45">
                  Search
                </span>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Album name or ID"
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full rounded-lg border border-white/10 bg-white/[0.06] px-3 py-3 text-sm outline-none placeholder:text-white/35 focus:border-[#1ed760]/45 focus:bg-white/[0.09]"
                />
              </label>
            )}

            <div className="min-h-[260px] flex-1 overflow-hidden rounded-xl border border-white/10 bg-black/25">
              {loading ? (
                <div
                  className="divide-y divide-white/5"
                  role="status"
                  aria-label="Loading"
                >
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className="flex animate-pulse items-center gap-4 px-4 py-4"
                    >
                      <div className="h-3.5 flex-1 rounded bg-white/10" />
                      <div className="h-7 w-16 rounded-full bg-white/10" />
                    </div>
                  ))}
                </div>
              ) : total === 0 ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                  <p className="text-base font-bold">No hidden albums</p>
                  <p className="max-w-[34ch] text-sm leading-relaxed text-white/50">
                    Open an album and choose Hide.
                  </p>
                </div>
              ) : shown === 0 ? (
                <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                  <p className="text-base font-bold">No matching albums</p>
                  <p className="text-sm text-white/50">
                    Try another title or album ID.
                  </p>
                </div>
              ) : (
                <ul className="max-h-[min(70vh,480px)] overflow-y-auto overscroll-contain p-1.5">
                  {filteredAlbums.map((a) => {
                    const id = albumIdFromSavedAlbum(a);
                    const href = a.url ?? (id ? spotifyAlbumUrl(id) : null);
                    return (
                      <li
                        key={a.docId}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3.5 py-3 hover:bg-white/[0.08]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-semibold">
                            {displayTitle(a)}
                          </p>
                          <p className="mt-1 truncate font-mono text-[11px] text-white/45">
                            {id ?? a.docId}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40">
                            <time
                              dateTime={
                                Number.isFinite(a.updatedAt)
                                  ? new Date(a.updatedAt).toISOString()
                                  : undefined
                              }
                            >
                              {formatUpdatedAt(a.updatedAt)}
                            </time>
                            {href && (
                              <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-semibold text-[#1ed760] hover:underline"
                              >
                                Open
                              </a>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void removeOne(a.docId)}
                          className="h-[30px] rounded-full border border-rose-400/50 px-3 text-xs font-bold text-[#ff8a9a] transition hover:bg-rose-500/15"
                        >
                          Remove
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
