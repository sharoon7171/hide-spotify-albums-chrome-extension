export const HIDDEN_IDS_STORAGE_KEY = "__spotifyExtHiddenAlbumIds_v1";
export const HIDDEN_IDS_MESSAGE_TYPE = "__spotifyExtHiddenAlbumIds_v1";

/** Page world posts this after merging discography Pathfinder JSON → track→album map (same-tab Storage does not notify). */
export const DISCOGRAPHY_TRACK_MAP_UPDATED_MESSAGE_TYPE =
  "__spotifyExtDiscographyTrackMapUpdated_v1";

export type HiddenIdsMessage = {
  type: typeof HIDDEN_IDS_MESSAGE_TYPE;
  ids: string[];
};
