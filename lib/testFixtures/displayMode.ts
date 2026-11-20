import { spyOn } from "bun:test";

/**
 * Emulates how the page is shown for lib/ui/displayMode.ts: `standalone` sets
 * `(display-mode: standalone)`, `touch` sets `(pointer: coarse)` and
 * `iosStandalone` sets navigator.standalone. Returns a restore function.
 */
export function emulateDisplayMode({ standalone = false, touch = false, iosStandalone }: { standalone?: boolean; touch?: boolean; iosStandalone?: boolean } = {}) {
  const original = window.matchMedia.bind(window);
  const media = spyOn(window, "matchMedia").mockImplementation((query: string) => ({
    ...original(query),
    matches: (query === "(display-mode: standalone)" && standalone) || (query === "(pointer: coarse)" && touch),
    addEventListener() {},
    removeEventListener() {}
  } as MediaQueryList));
  // Always pin navigator.standalone for the emulation: other DOM tests may leave
  // it set on the shared navigator, which would leak into this one.
  const previous = Object.getOwnPropertyDescriptor(navigator, "standalone");
  Object.defineProperty(navigator, "standalone", { configurable: true, value: iosStandalone ?? false });
  return () => {
    media.mockRestore();
    if (previous) Object.defineProperty(navigator, "standalone", previous);
    else delete (navigator as Navigator & { standalone?: boolean }).standalone;
  };
}

/** Home-screen app on a phone. */
export const emulateSingleWindowApp = () => emulateDisplayMode({ standalone: true, touch: true });
