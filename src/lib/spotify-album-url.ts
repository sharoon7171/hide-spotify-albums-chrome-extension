export function spotifyAlbumUrl(albumId: string): string {
  return `https://open.spotify.com/album/${albumId}`;
}

export function albumIdFromPathname(pathname: string): string | null {
  const m = pathname.match(/\/album\/([^/?#]+)/);
  return m ? m[1] : null;
}

export function normalizeOpenSpotifyAlbumUrl(href: string): string | null {
  try {
    const u = new URL(href);
    if (u.hostname !== "open.spotify.com") return null;
    const id = albumIdFromPathname(u.pathname);
    if (!id) return null;
    u.hash = "";
    u.search = "";
    u.pathname = `/album/${id}`;
    return u.toString();
  } catch {
    return null;
  }
}
