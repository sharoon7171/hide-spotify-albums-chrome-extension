import { useCallback, useEffect, useMemo, useState } from "react";
import {
  albumIdFromSavedAlbum,
  type SavedAlbum,
} from "@/lib/saved-albums";
import { spotifyAlbumUrl } from "@/lib/spotify-album-url";
import {
  displayTitle,
  formatSavedAt,
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
  }>({
    kind: null,
  });
  const [pendingHideTiles, setPendingHideTiles] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  useEffect(() => {
    if (pendingHideTiles === null) return;
    if (sync.hideAlbumTiles === pendingHideTiles) {
      setPendingHideTiles(null);
    }
  }, [pendingHideTiles, sync.hideAlbumTiles]);


  const albums: AlbumRow[] = useMemo(() => {
    const list: AlbumRow[] = Object.entries(sync.albums).map(([docId, a]) => ({
      ...a,
      docId,
    }));
    return sortedAlbums(list);
  }, [sync.albums]);

  const filteredAlbums = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return albums;
    return albums.filter((a) => {
      const id = albumIdFromSavedAlbum(a);
      const hay = [a.title ?? "", a.url ?? "", id ?? ""].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [albums, query]);

  const removeOne = useCallback(async (docId: string) => {
    const res = await sendToBackground({ kind: "albums/remove", docId });
    if (!res.ok) console.warn("[spotify-ext] remove failed", res);
  }, []);

  const removeAll = useCallback(async () => {
    if (!albums.length) return;
    if (
      !window.confirm(
        `Remove all ${albums.length} stored entries? Hidden albums will show again on Spotify until you hide them from an album page.`,
      )
    )
      return;
    setBusy({ kind: "clear" });
    const res = await sendToBackground({ kind: "albums/clear" });
    setBusy({ kind: null });
    if (!res.ok) console.warn("[spotify-ext] clear failed", res);
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
      console.warn("[spotify-ext] set-hide-tiles failed", res);
    }
  }, []);

  const signIn = useCallback(async () => {
    setBusy({ kind: "signin" });
    setAuthError(null);
    const res = await sendToBackground({ kind: "auth/sign-in" });
    if (!res.ok) setAuthError(res.message);
    setBusy({ kind: null });
  }, []);

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

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-zinc-50 text-zinc-900">
      <div
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_120%_80%_at_0%_-20%,rgba(167,243,208,0.45),transparent_55%),radial-gradient(ellipse_100%_60%_at_100%_0%,rgba(221,214,254,0.4),transparent_50%),radial-gradient(ellipse_80%_50%_at_50%_100%,rgba(186,230,253,0.35),transparent_45%)]"
        aria-hidden
      />

      <main className="relative mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 sm:pt-12 lg:px-10">
        <header className="mb-12 border-b border-zinc-200/90 pb-10">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-800">
                Options
              </span>
              <span className="h-1 w-1 rounded-full bg-zinc-300" aria-hidden />
              <span className="text-xs font-medium text-zinc-500">
                Stored albums · open.spotify.com
              </span>
            </div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-balance text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl sm:leading-[1.08]">
                  Hidden albums
                </h1>
                <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-zinc-600 sm:text-base">
                  Use Hide next to Save to Your Library on an album page.
                  Entries store the canonical album URL and optional title and
                  sync to your account in real time across every device where
                  this extension is signed in.
                </p>
              </div>
              <AccountBadge
                user={sync.user}
                ready={sync.ready}
                busyKind={
                  busy.kind === "signin" || busy.kind === "signout"
                    ? busy.kind
                    : null
                }
                onSignIn={signIn}
                onSignOut={signOut}
              />
            </div>
            {authError && (
              <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
                {authError}
              </p>
            )}
          </div>
        </header>

        {!sync.user && sync.ready ? (
          <section className="rounded-3xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center shadow-sm sm:px-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-200 bg-emerald-50 text-3xl text-emerald-700">
              ↪
            </div>
            <h2 className="mt-6 text-xl font-semibold text-zinc-900">
              Sign in to sync
            </h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-600">
              Your hidden albums and settings live in Firestore so every browser
              you sign in on stays in sync, in real time, with no data loss.
            </p>
            <button
              type="button"
              onClick={() => void signIn()}
              disabled={busy.kind === "signin"}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-progress disabled:bg-emerald-400"
            >
              {busy.kind === "signin" ? "Opening sign-in…" : "Sign in with Google"}
            </button>
          </section>
        ) : (
          <div className="space-y-6">
            {!loading && (
              <section className="rounded-3xl border border-zinc-200/90 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1">
                    <h2 className="text-sm font-semibold text-zinc-900">
                      Hide albums in grids and carousels
                    </h2>
                    <p className="max-w-xl text-xs leading-relaxed text-zinc-600">
                      When on, matching albums are hidden as tiles on home,
                      artist, search, and in carousels such as More by. List and
                      discography views are not covered. The album page itself
                      stays visible when you open its URL so you can use Hide or
                      Unhide. Turn off to show those tiles everywhere while
                      keeping your stored list.
                    </p>
                  </div>
                  <label className="flex shrink-0 cursor-pointer items-center gap-3 sm:pt-0.5">
                    <span className="text-xs font-medium text-zinc-700">
                      {hideTilesEnabled ? "On" : "Off"}
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={hideTilesEnabled}
                      onClick={() => void setHideTiles(!hideTilesEnabled)}
                      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                        hideTilesEnabled ? "bg-emerald-600" : "bg-zinc-300"
                      }`}
                    >
                      <span
                        className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                          hideTilesEnabled ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </label>
                </div>
              </section>
            )}

            {!loading && total > 0 && (
              <section className="rounded-3xl border border-zinc-200/90 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="relative min-w-0 flex-1">
                    <label htmlFor="album-search" className="sr-only">
                      Search by title, URL, or album id
                    </label>
                    <input
                      id="album-search"
                      type="search"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search by title, URL, or album id"
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 py-3 pl-4 pr-4 text-sm text-zinc-900 shadow-inner shadow-zinc-900/5 placeholder:text-zinc-400 focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200/80"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium tabular-nums text-zinc-700">
                      {query.trim() ? `${shown} of ${total}` : `${total} total`}
                    </span>
                    <button
                      type="button"
                      onClick={() => void removeAll()}
                      disabled={busy.kind === "clear"}
                      className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800 transition hover:border-rose-300 hover:bg-rose-100 disabled:cursor-progress disabled:opacity-60"
                    >
                      {busy.kind === "clear" ? "Clearing…" : "Clear all"}
                    </button>
                  </div>
                </div>
              </section>
            )}

            {loading ? (
              <section
                className="overflow-hidden rounded-3xl border border-zinc-200/90 bg-white shadow-sm"
                role="status"
                aria-label="Loading"
              >
                <div className="divide-y divide-zinc-100">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="flex animate-pulse items-center gap-4 px-4 py-4 sm:px-5"
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="h-3.5 w-2/3 max-w-xs rounded-full bg-zinc-200" />
                        <div className="h-3 w-1/3 max-w-[180px] rounded-full bg-zinc-100" />
                      </div>
                      <div className="hidden h-3 w-20 rounded-full bg-zinc-200 sm:block" />
                      <div className="h-8 w-16 rounded-lg bg-zinc-200" />
                    </div>
                  ))}
                </div>
              </section>
            ) : total === 0 ? (
              <section className="rounded-3xl border border-dashed border-zinc-300 bg-white px-6 py-14 text-center shadow-sm sm:px-10">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-200 bg-emerald-50 text-3xl text-emerald-700">
                  ♪
                </div>
                <h2 className="mt-6 text-xl font-semibold text-zinc-900">
                  No albums stored yet
                </h2>
                <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-600">
                  On an album at{" "}
                  <span className="whitespace-nowrap">open.spotify.com</span>,
                  choose Hide next to Save to Your Library. The list appears
                  here so you can review or remove entries.
                </p>
              </section>
            ) : shown === 0 ? (
              <section className="rounded-3xl border border-zinc-200/90 bg-white px-6 py-12 text-center shadow-sm">
                <p className="text-sm font-medium text-zinc-800">{`No matches for “${query.trim()}”.`}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  Try another part of the title, URL, or album id.
                </p>
              </section>
            ) : (
              <section className="overflow-hidden rounded-3xl border border-zinc-200/90 bg-white shadow-md shadow-zinc-900/5">
                <div className="flex flex-col gap-1 border-b border-zinc-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <h2 className="text-sm font-semibold text-zinc-900">
                    Stored entries
                  </h2>
                  <p className="text-xs text-zinc-500">
                    Newest first · {shown} {shown === 1 ? "row" : "rows"}
                  </p>
                </div>
                <div className="max-h-[min(85vh,calc(5*6.5rem))] overflow-y-auto overscroll-contain sm:max-h-[min(80vh,calc(5*5.5rem))]">
                  <ul className="divide-y divide-zinc-100">
                    {filteredAlbums.map((a) => {
                      const id = albumIdFromSavedAlbum(a);
                      const href = a.url ?? (id ? spotifyAlbumUrl(id) : null);
                      return (
                        <li key={a.docId}>
                          <div className="group flex flex-col gap-4 px-4 py-4 transition sm:flex-row sm:items-center sm:gap-5 sm:px-5 sm:py-4 hover:bg-zinc-50/80">
                            <div className="min-w-0 flex-1">
                              <p className="text-[15px] font-semibold leading-snug text-zinc-900">
                                {displayTitle(a)}
                              </p>
                              <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                                {href ? "Album URL" : "Title only"}
                              </p>
                              {href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="mt-0.5 block max-w-full truncate font-mono text-[11px] text-blue-700 underline underline-offset-2 hover:text-blue-900"
                                >
                                  {href}
                                </a>
                              ) : (
                                <p className="mt-0.5 text-xs text-zinc-500">
                                  Add a Spotify album URL for this row to affect
                                  hiding.
                                </p>
                              )}
                            </div>
                            <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
                              <time
                                className="text-xs tabular-nums text-zinc-500"
                                dateTime={
                                  Number.isFinite(a.savedAt)
                                    ? new Date(a.savedAt).toISOString()
                                    : undefined
                                }
                              >
                                {formatSavedAt(a.savedAt)}
                              </time>
                              <button
                                type="button"
                                onClick={() => void removeOne(a.docId)}
                                className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

type AccountBadgeProps = {
  user: ReturnType<typeof useFirestoreSync>["user"];
  ready: boolean;
  busyKind: "signin" | "signout" | null;
  onSignIn: () => void;
  onSignOut: () => void;
};

function AccountBadge({
  user,
  ready,
  busyKind,
  onSignIn,
  onSignOut,
}: AccountBadgeProps) {
  if (!ready) {
    return (
      <div className="h-9 w-32 animate-pulse rounded-full bg-zinc-200/70" />
    );
  }
  if (!user) {
    return (
      <button
        type="button"
        onClick={onSignIn}
        disabled={busyKind === "signin"}
        className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-progress disabled:bg-emerald-400"
      >
        {busyKind === "signin" ? "Opening sign-in…" : "Sign in with Google"}
      </button>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-full border border-zinc-200 bg-white px-3 py-1.5 shadow-sm">
      {user.photoURL && (
        <img
          src={user.photoURL}
          alt=""
          width={24}
          height={24}
          className="h-6 w-6 rounded-full"
          referrerPolicy="no-referrer"
        />
      )}
      <div className="min-w-0 leading-tight">
        <p className="truncate text-xs font-semibold text-zinc-900">
          {user.displayName ?? user.email ?? "Signed in"}
        </p>
        <p className="truncate text-[10px] uppercase tracking-wide text-zinc-500">
          Synced
        </p>
      </div>
      <button
        type="button"
        onClick={onSignOut}
        disabled={busyKind === "signout"}
        className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-[11px] font-semibold text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 disabled:cursor-progress disabled:opacity-60"
      >
        {busyKind === "signout" ? "…" : "Sign out"}
      </button>
    </div>
  );
}
