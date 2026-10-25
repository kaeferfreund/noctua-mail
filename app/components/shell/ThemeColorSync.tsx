"use client";

import { useEffect } from "react";
import { APP_BAR_COLORS, APP_BAR_TOKEN, cssColorToHex } from "@/lib/ui/theme";

/**
 * Keeps meta theme-color on the colour of the phone's top bar in the app's own
 * theme. The server renders one meta per prefers-color-scheme (app/layout.tsx);
 * a theme chosen in the app can differ from the system one, and theme-color
 * also fills the opaque iOS home-screen status bar right above the header, so
 * it reads the live token (hex: iOS takes no oklch there). next-themes sets the
 * theme class on <html> in its own effect, after this one, so the class is
 * observed rather than read once per render.
 */
export default function ThemeColorSync() {
  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      const token = getComputedStyle(root).getPropertyValue(APP_BAR_TOKEN);
      const color = cssColorToHex(token) ?? APP_BAR_COLORS[root.classList.contains("dark") ? "dark" : "light"];
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => {
        if (meta.content !== color) meta.content = color;
      });
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return null;
}
