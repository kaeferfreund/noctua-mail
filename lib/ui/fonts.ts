// The app uses the platform UI font (San Francisco on Apple devices) instead of
// a webfont. app/globals.css declares the same stack as --font-sans; documents
// that do not load the app stylesheet (the HtmlMessage srcdoc iframe) use this
// constant. app/globals.test.ts keeps the two in sync.
export const APP_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", Arial, system-ui, sans-serif';
