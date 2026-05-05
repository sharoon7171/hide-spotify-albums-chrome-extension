import { countHiddenInArtist } from "./discography-state";

export type GraphqlBody = {
  operationName?: string;
  variables?: Record<string, unknown>;
  extensions?: unknown;
  query?: unknown;
};

export function clearDiscographyCaches(): void {}

export function patchDiscographyOverview(
  data: unknown,
  hidden: Set<string>,
): unknown {
  const block = (data as Record<string, unknown> | null)?.["data"] as
    | Record<string, unknown>
    | undefined;
  const artist = block?.["artistUnion"] as Record<string, unknown> | undefined;
  const artistUri = artist?.["uri"];
  if (typeof artistUri !== "string") return data;
  const decrement = countHiddenInArtist(artistUri, hidden);
  if (decrement <= 0) return data;
  const disc = artist?.["discography"] as Record<string, unknown> | undefined;
  if (!disc) return data;
  const allBlock = disc["all"] as Record<string, unknown> | undefined;
  if (allBlock && typeof allBlock["totalCount"] === "number") {
    allBlock["totalCount"] = Math.max(
      0,
      (allBlock["totalCount"] as number) - decrement,
    );
  }
  return data;
}

export function isDiscographyAllOperation(opName: string | undefined): boolean {
  if (!opName) return false;
  const n = opName.toLowerCase();
  return (
    n === "queryartistdiscographyall" || n.includes("artistdiscographyall")
  );
}

export function isDiscographyPagePathname(pathname: string): boolean {
  return /\/discography\//.test(pathname);
}

export function isDiscographyOverviewOperation(
  opName: string | undefined,
): boolean {
  return opName === "queryArtistDiscographyOverview";
}
