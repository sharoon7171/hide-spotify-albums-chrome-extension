const FONT =
  "system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif";

export const SPOTIFY_ACTION_BAR_ITEM_GAP_PX = 22;

export const HIDE_BUTTON_WIDTH = "clamp(68px, 15vw, 88px)";
export const HIDE_BUTTON_HEIGHT_PX = 32;

export const hostInnerStyle = [
  `font-family:${FONT}`,
  "display:flex",
  "align-items:center",
  "justify-content:center",
  "width:100%",
  "height:auto",
  "min-height:0",
  "box-sizing:border-box",
].join(";");

export const hostChromeStyle = [
  "display:inline-flex",
  "align-items:center",
  "justify-content:center",
  "align-self:center",
  "flex-shrink:0",
  "flex-grow:0",
  `width:${HIDE_BUTTON_WIDTH}`,
  `height:${HIDE_BUTTON_HEIGHT_PX}px`,
  `min-height:${HIDE_BUTTON_HEIGHT_PX}px`,
  `max-height:${HIDE_BUTTON_HEIGHT_PX}px`,
  "margin:0",
  "margin-inline-start:0",
  `margin-inline-end:${SPOTIFY_ACTION_BAR_ITEM_GAP_PX}px`,
  "padding:0",
  "border:none",
  "vertical-align:middle",
  "box-sizing:border-box",
  "contain:layout",
].join(";");

const buttonBase = [
  "box-sizing:border-box",
  "display:inline-flex",
  "align-items:center",
  "justify-content:center",
  "width:100%",
  `height:${HIDE_BUTTON_HEIGHT_PX}px`,
  `min-height:${HIDE_BUTTON_HEIGHT_PX}px`,
  `max-height:${HIDE_BUTTON_HEIGHT_PX}px`,
  "padding:0 clamp(5px,1.4vw,9px)",
  "border-radius:9999px",
  "font-size:clamp(10px,2.5vw,11px)",
  "font-weight:600",
  "letter-spacing:0.01em",
  "white-space:nowrap",
  "cursor:pointer",
  "outline:none",
  "border:none",
  "box-shadow:none",
  "-webkit-appearance:none",
  "appearance:none",
  "-webkit-tap-highlight-color:transparent",
  "transition:background-color 0.15s ease,color 0.15s ease",
  "contain:layout",
].join(";");

export const buttonNotHidden = `${buttonBase};background:#16a34a;color:#ffffff;`;

export const buttonIsHidden = `${buttonBase};background:#dc2626;color:#ffffff;`;
