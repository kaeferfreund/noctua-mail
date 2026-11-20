type OpenDetachedWindowOptions = {
  width?: number;
  height?: number;
  left?: number;
  top?: number;
  /**
   * Accepted so existing callers can name the window. Browsers ignore it —
   * the opened page sets `document.title` itself.
   */
  title?: string;
};

export type DetachedWindowOpenResult = {
  opened: boolean;
  window: Window | null;
  error?: unknown;
};

function resolveDetachedWindowSize(options: OpenDetachedWindowOptions) {
  const fallbackWidth = Math.min(
    1180,
    Math.max(760, Math.floor(window.screen.availWidth * 0.64))
  );
  const fallbackHeight = Math.min(
    900,
    Math.max(620, Math.floor(window.screen.availHeight * 0.78))
  );
  return {
    width: options.width ?? fallbackWidth,
    height: options.height ?? fallbackHeight
  };
}

// Windows opened from this window. Sign-out closes them: a later user of the browser must not
// find a previous user's mail, draft or attachment there (detached pages also end their own view).
const openedWindows = new Set<Window>();

export function closeDetachedWindows() {
  for (const opened of openedWindows) {
    try {
      if (!opened.closed) opened.close();
    } catch {
      // ignore
    }
  }
  openedWindows.clear();
}

export function openDetachedWindow(
  url: string,
  options: OpenDetachedWindowOptions = {}
) {
  if (typeof window === "undefined") return null;
  const { width, height } = resolveDetachedWindowSize(options);

  const left =
    options.left ?? Math.max(0, Math.floor((window.screen.availWidth - width) / 2));
  const top =
    options.top ?? Math.max(0, Math.floor((window.screen.availHeight - height) / 2));
  const features = [
    "popup=yes",
    `width=${width}`,
    `height=${height}`,
    `left=${left}`,
    `top=${top}`,
    "resizable=yes",
    "scrollbars=yes"
  ].join(",");
  const opened = window.open(url, "_blank", features);
  // Some browsers return `null` when `noopener/noreferrer` is requested via features.
  // We clear opener manually so callers can reliably detect blocked popups.
  if (opened) {
    try {
      opened.opener = null;
    } catch {
      // ignore
    }
  }
  if (opened) {
    for (const known of openedWindows) if (known.closed) openedWindows.delete(known);
    openedWindows.add(opened);
  }
  opened?.focus();
  return opened;
}

/**
 * Opens a detached window while reporting creation failures.
 * Browser `window.open` still runs synchronously before this function returns
 * its promise, preserving the user gesture required by popup blockers.
 */
export function openDetachedWindowConfirmed(
  url: string,
  options: OpenDetachedWindowOptions = {}
): Promise<DetachedWindowOpenResult> {
  if (typeof window === "undefined") {
    return Promise.resolve({ opened: false, window: null });
  }

  const openedWindow = openDetachedWindow(url, options);
  return Promise.resolve({
    opened: Boolean(openedWindow),
    window: openedWindow
  });
}
