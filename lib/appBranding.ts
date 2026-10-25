/** Product name shown to users; code identifiers and env vars keep "Noctua". */
export const BASE_APP_TITLE = "Mail";

/**
 * Bumped whenever public/icons/base.svg changes (build-scripts/generate_icons.sh).
 * Icon files keep their names and are cached for a day, so every reference
 * carries this version to make browsers and notifications fetch the new art.
 * public/sw.js cannot import this module and repeats the value.
 */
export const APP_ICON_VERSION = "3";

export function versionedIconUrl(path: string) {
  return `${path}?v=${APP_ICON_VERSION}`;
}

export const NOTIFICATION_ICON = versionedIconUrl("/icons/icon-192.png");
/** White silhouette: Android draws notification badges from the alpha channel. */
export const NOTIFICATION_BADGE_ICON = versionedIconUrl("/icons/icon-96-mono.png");

type RuntimeConfig = { appEnvironmentLabel?: string };

/**
 * `APP_ENV_LABEL` is a server-only variable, so the browser reads the same
 * label from `public/runtime-config.js` instead — without this, titles set
 * from client components would silently drop the environment suffix.
 */
function readEnvLabel() {
  if (typeof window !== "undefined") {
    const runtimeConfig = (
      window as unknown as { __NOCTUA_RUNTIME_CONFIG__?: RuntimeConfig }
    ).__NOCTUA_RUNTIME_CONFIG__;
    return runtimeConfig?.appEnvironmentLabel?.trim() ?? "";
  }
  return process.env.APP_ENV_LABEL?.trim() ?? "";
}

function resolveAppTitle() {
  const staticTitle = process.env.NOCTUA_STATIC_APP_TITLE?.trim() ?? "";
  if (staticTitle) return staticTitle;
  const envLabel = readEnvLabel();
  return envLabel ? `${BASE_APP_TITLE} (${envLabel})` : BASE_APP_TITLE;
}

export const DEFAULT_APP_TITLE = resolveAppTitle();

const TITLE_SEPARATOR = " — ";

// Display modes that mean "running as an installed app window" rather than
// as a browser tab.
const INSTALLED_DISPLAY_MODES = ["standalone", "minimal-ui", "window-controls-overlay"];

/**
 * Chromium requires an installed web app's window title to begin with the app
 * name and prepends `<app name> - ` when it does not, so naming the app again
 * at the end spends the window title's truncation budget saying it twice.
 * Safari's web apps add no such prefix and keep the suffix.
 */
function browserPrependsAppTitle() {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  if (!("userAgentData" in navigator)) return false;
  if (typeof window.matchMedia !== "function") return false;
  return INSTALLED_DISPLAY_MODES.some(
    (mode) => window.matchMedia(`(display-mode: ${mode})`).matches
  );
}

/**
 * Window titles lead with the segment that distinguishes one window from
 * another, because tab strips and taskbar buttons truncate the tail.
 */
function buildPageTitle(...segments: Array<string | null | undefined>) {
  const parts = segments.map((segment) => segment?.trim() ?? "").filter(Boolean);
  if (!parts.length) return resolveAppTitle();
  if (browserPrependsAppTitle()) return parts.join(TITLE_SEPARATOR);
  return [...parts, resolveAppTitle()].join(TITLE_SEPARATOR);
}

export function formatMessagePageTitle(subject?: string | null) {
  return buildPageTitle(subject);
}

/**
 * Kept distinct from `formatMessagePageTitle` so the raw-HTML view of a mail
 * is not indistinguishable from the detached window showing the same mail.
 */
export function formatMessageHtmlPageTitle(subject?: string | null) {
  const trimmed = subject?.trim() ?? "";
  return buildPageTitle(trimmed ? `HTML: ${trimmed}` : "HTML view");
}

export function formatComposePageTitle(subject?: string | null) {
  return buildPageTitle(subject?.trim() || "New message", "Compose");
}

export function formatCalendarPageTitle(accountEmail?: string | null) {
  return buildPageTitle("Calendar", accountEmail);
}

export function formatCalendarImportPageTitle(filename?: string | null) {
  const trimmed = filename?.trim() ?? "";
  return buildPageTitle(trimmed ? `Import ${trimmed}` : "Import invitation");
}

export function formatAttachmentPageTitle(filename?: string | null) {
  return buildPageTitle(filename?.trim() || "Attachment");
}

export function formatMailboxPageTitle(input: {
  folderName?: string | null;
  accountEmail?: string | null;
  unreadCount?: number | null;
}) {
  // Without a folder (sign-in, loading) the app name alone names the window;
  // a "Mail" placeholder would repeat the product name.
  const folderName = input.folderName?.trim() ?? "";
  const unread =
    typeof input.unreadCount === "number" && input.unreadCount > 0
      ? `(${input.unreadCount}) `
      : "";
  return buildPageTitle(folderName && `${unread}${folderName}`, input.accountEmail);
}
