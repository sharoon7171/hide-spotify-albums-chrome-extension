import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getSavedAlbums,
  SAVED_ALBUMS_KEY,
  setSavedAlbums,
  type SavedAlbum,
} from "@/lib/saved-albums";
import { spotifyAlbumUrl } from "@/lib/spotify-album-url";

function sortedAlbums(list: SavedAlbum[]): SavedAlbum[] {
  return [...list].sort((a, b) => b.savedAt - a.savedAt);
}

function formatSavedAt(ts: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(ts);
  } catch {
    return "";
  }
}

export function OptionsApp() {
  const [albums, setAlbums] = useState<SavedAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const filteredAlbums = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return albums;
    return albums.filter(
      (a) =>
        a.title.toLowerCase().includes(q) || a.id.toLowerCase().includes(q),
    );
  }, [albums, query]);

  const reload = useCallback(async () => {
    const list = await getSavedAlbums();
    setAlbums(sortedAlbums(list));
    setLoading(false);
  }, []);

  useEffect(() => {
    void reload();
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "local" || !changes[SAVED_ALBUMS_KEY]) return;
      void reload();
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, [reload]);

  const removeOne = async (id: string) => {
    const next = (await getSavedAlbums()).filter((a) => a.id !== id);
    await setSavedAlbums(next);
    await reload();
  };

  const removeAll = async () => {
    if (!albums.length) return;
    if (
      !window.confirm(
        "Remove every stored album ID? Those albums will no longer be treated as hidden on Spotify.",
      )
    )
      return;
    await setSavedAlbums([]);
    setQuery("");
    await reload();
  };

  const total = albums.length;
  const shown = filteredAlbums.length;

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
                Album IDs · open.spotify.com
              </span>
            </div>
            <h1 className="text-balance text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl sm:leading-[1.08]">
              Hide and show albums{" "}
              <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
                using stored IDs
              </span>
            </h1>
            <p className="max-w-xl text-pretty text-sm leading-relaxed text-zinc-600 sm:text-base">
              Each Spotify album has an ID in its URL (
              <code className="rounded-md border border-zinc-200 bg-white px-2 py-0.5 font-mono text-[0.8em] font-medium text-emerald-800">
                /album/&lt;id&gt;
              </code>
              ). This extension saves those IDs when you hide an album on the
              web; the same IDs are used to hide or show albums on{" "}
              <span className="whitespace-nowrap">open.spotify.com</span>.
              Additional options and behavior will ship in a later update.
            </p>
          </div>
        </header>

        <div className="space-y-6">
          {!loading && total > 0 && (
            <section className="rounded-3xl border border-zinc-200/90 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                <div className="relative min-w-0 flex-1">
                  <label htmlFor="album-search" className="sr-only">
                    Search by title or album ID
                  </label>
                  <input
                    id="album-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search by title or album ID"
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
                    className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-800 transition hover:border-rose-300 hover:bg-rose-100"
                  >
                    Clear all
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
                No album IDs stored yet
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-600">
                On an album at{" "}
                <span className="whitespace-nowrap">open.spotify.com</span>,
                choose Hide next to Save to Your Library. The album ID is saved
                here and used to hide or show that album on Spotify. More
                options will be added later.
              </p>
            </section>
          ) : shown === 0 ? (
            <section className="rounded-3xl border border-zinc-200/90 bg-white px-6 py-12 text-center shadow-sm">
              <p className="text-sm font-medium text-zinc-800">{`No matches for “${query.trim()}”.`}</p>
              <p className="mt-2 text-xs text-zinc-500">
                Try another part of the title or album ID.
              </p>
            </section>
          ) : (
            <section className="overflow-hidden rounded-3xl border border-zinc-200/90 bg-white shadow-md shadow-zinc-900/5">
              <div className="flex flex-col gap-1 border-b border-zinc-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <h2 className="text-sm font-semibold text-zinc-900">
                  Stored album IDs
                </h2>
                <p className="text-xs text-zinc-500">
                  Newest first · {shown}{" "}
                  {shown === 1 ? "ID" : "IDs"}
                </p>
              </div>
              <div className="max-h-[min(85vh,calc(5*6.5rem))] overflow-y-auto overscroll-contain sm:max-h-[min(80vh,calc(5*5.5rem))]">
                <ul className="divide-y divide-zinc-100">
                  {filteredAlbums.map((a) => {
                    const href = spotifyAlbumUrl(a.id);
                    return (
                      <li key={a.id}>
                        <div className="group flex flex-col gap-4 px-4 py-4 transition sm:flex-row sm:items-center sm:gap-5 sm:px-5 sm:py-4 hover:bg-zinc-50/80">
                          <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-semibold leading-snug text-zinc-900">
                              {a.title}
                            </p>
                            <p className="mt-1 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
                              Album ID
                            </p>
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-0.5 block max-w-full truncate font-mono text-[11px] text-blue-700 underline underline-offset-2 hover:text-blue-900"
                            >
                              {a.id}
                            </a>
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
                              onClick={() => void removeOne(a.id)}
                              className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800"
                            >
                              Remove ID
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
      </main>
    </div>
  );
}
