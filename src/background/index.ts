import { registerActionClick } from "./on-action-click";
import { registerOnInstalled } from "./on-installed";
import { registerSpotifyAlbumToggleInjection } from "./spotify-album-toggle-inject";

registerOnInstalled();
registerActionClick();
registerSpotifyAlbumToggleInjection();
