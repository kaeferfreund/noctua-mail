import { CLIENT_ERROR_LIMITS, clientErrorLocation, type ClientErrorReport, type ClientErrorSource } from "@/lib/clientErrors";

/** The same message is reported at most once per minute and tab. */
export const CLIENT_ERROR_DEDUPE_MS = 60_000;
const recent = new Map<string, number>();
let build = "";

/** The build of the running bundle; a long-lived PWA can run an older build than the server. */
export function setClientErrorBuild(label: string) {
  build = label.trim();
}

function text(value: unknown) {
  if (typeof value === "string") return value;
  try { return JSON.stringify(value) ?? String(value); } catch { return String(value); }
}

function describe(error: unknown): { message: string; stack: string; digest: string } {
  if (!(error instanceof Error)) return { message: text(error), stack: "", digest: "" };
  const digest = (error as Error & { digest?: unknown }).digest;
  return { message: `${error.name}: ${error.message}`, stack: error.stack ?? "", digest: typeof digest === "string" ? digest : "" };
}

function isStandalone() {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true ||
    (typeof window.matchMedia === "function" && window.matchMedia("(display-mode: standalone)").matches);
}

/** Never throws: it runs on error paths, including inside an error boundary. */
export function reportClientError(source: ClientErrorSource, error: unknown, now = Date.now(), detail?: Pick<ClientErrorReport, "kind" | "count" | "blank">) {
  try {
    const { message, stack, digest } = describe(error);
    if (!message) return;
    const key = message.slice(0, CLIENT_ERROR_LIMITS.message);
    const last = recent.get(key);
    if (last !== undefined && now - last < CLIENT_ERROR_DEDUPE_MS) return;
    for (const [entry, at] of recent) if (now - at >= CLIENT_ERROR_DEDUPE_MS) recent.delete(entry);
    recent.set(key, now);
    const report: ClientErrorReport = {
      source, ...detail, message: key, stack: stack.slice(0, CLIENT_ERROR_LIMITS.stack), digest: digest.slice(0, CLIENT_ERROR_LIMITS.digest),
      ...clientErrorLocation(window.location.href), build: build.slice(0, CLIENT_ERROR_LIMITS.build),
      userAgent: navigator.userAgent.slice(0, CLIENT_ERROR_LIMITS.userAgent), standalone: isStandalone()
    };
    // keepalive: the report still leaves when the user reloads right away.
    void fetch("/api/client-errors", { method: "POST", credentials: "same-origin", keepalive: true,
      headers: { "content-type": "application/json" }, body: JSON.stringify(report) }).catch(() => {});
  } catch { /* Reporting must not add a second failure. */ }
}

let installed = false;
/** Uncaught errors and unhandled rejections of the whole tab. */
export function installClientErrorReporting() {
  if (installed) return () => {};
  installed = true;
  const onError = (event: ErrorEvent) => {
    // Resource load failures are no ErrorEvent and do not reach this listener.
    reportClientError("error", event.error ?? event.message);
  };
  const onRejection = (event: PromiseRejectionEvent) => {
    // Cancelled requests (navigation, unmount) are expected.
    if (event.reason instanceof DOMException && event.reason.name === "AbortError") return;
    reportClientError("unhandledrejection", event.reason);
  };
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);
  return () => {
    installed = false;
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onRejection);
  };
}

export function resetClientErrorReporterForTests() {
  recent.clear();
  build = "";
  overlayFallbackCount = 0;
  overlayFallbackReported = false;
  overlayFallbackListening = false;
  window.removeEventListener("pagehide", flushOverlayFallbacks);
  document.removeEventListener("visibilitychange", flushHiddenOverlayFallbacks);
  window.sessionStorage.removeItem(OVERLAY_FALLBACK_REPORT_KEY);
}

const OVERLAY_FALLBACK_REPORT_KEY = "noctua:overlay-back-fallback-reported";
let overlayFallbackCount = 0;
let overlayFallbackReported = false;
let overlayFallbackListening = false;
function flushOverlayFallbacks() {
  if (!overlayFallbackCount || overlayFallbackReported) return;
  overlayFallbackReported = true;
  try { window.sessionStorage.setItem(OVERLAY_FALLBACK_REPORT_KEY, "1"); } catch { /* In-memory dedupe remains. */ }
  window.removeEventListener("pagehide", flushOverlayFallbacks);
  document.removeEventListener("visibilitychange", flushHiddenOverlayFallbacks);
  overlayFallbackListening = false;
  reportClientError("error", "Mobile overlay Back timeout", Date.now(), { kind: "overlay-back-fallback", count: overlayFallbackCount });
}
function flushHiddenOverlayFallbacks() { if (document.hidden) flushOverlayFallbacks(); }

/** Aggregate cheaply, then send once per tab session when it first leaves view. */
export function recordOverlayBackFallback() {
  if (overlayFallbackReported) return;
  try { if (window.sessionStorage.getItem(OVERLAY_FALLBACK_REPORT_KEY)) { overlayFallbackReported = true; return; } } catch { /* In-memory dedupe remains. */ }
  overlayFallbackCount++;
  if (overlayFallbackListening) return;
  overlayFallbackListening = true;
  window.addEventListener("pagehide", flushOverlayFallbacks);
  document.addEventListener("visibilitychange", flushHiddenOverlayFallbacks);
}
