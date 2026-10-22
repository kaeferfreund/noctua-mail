// Inter Variable is vendored in public/fonts (see README.md there) instead of
// next/font, so Docker and Tauri builds stay hermetic. app/globals.css declares
// the @font-face for the app document; documents that do not load the app
// stylesheet (the HtmlMessage srcdoc iframe) inject APP_FONT_FACE_CSS. The
// root-absolute URL resolves against the app origin in both. app/globals.test.ts
// checks that globals.css declares the same face.
export const APP_FONT_FAMILY = "Inter";
export const APP_FONT_URL = "/fonts/InterVariable.woff2";
export const APP_FONT_STACK = `"${APP_FONT_FAMILY}", system-ui, -apple-system, sans-serif`;
export const APP_FONT_FACE_CSS =
  `@font-face { font-family: "${APP_FONT_FAMILY}"; font-style: normal; font-weight: 100 900; ` +
  `font-display: swap; src: url("${APP_FONT_URL}") format("woff2"); }`;
