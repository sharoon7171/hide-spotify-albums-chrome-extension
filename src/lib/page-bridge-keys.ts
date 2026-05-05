export const HIDDEN_IDS_STORAGE_KEY = "__spotifyExtHiddenAlbumIds_v1";
export const HIDDEN_IDS_MESSAGE_TYPE = "__spotifyExtHiddenAlbumIds_v1";

export type HiddenIdsMessage = {
  type: typeof HIDDEN_IDS_MESSAGE_TYPE;
  ids: string[];
};
