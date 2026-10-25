"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { APP_BAR_COLORS } from "@/lib/ui/theme";

/**
 * Keeps meta theme-color on the app's own theme. The server renders one meta
 * per prefers-color-scheme (app/layout.tsx); a theme chosen in the app can
 * differ from the system one, and theme-color also fills the opaque iOS
 * home-screen status bar above the header.
 */
export default function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (resolvedTheme !== "light" && resolvedTheme !== "dark") return;
    const color = APP_BAR_COLORS[resolvedTheme];
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(meta => {
      if (meta.content !== color) meta.content = color;
    });
  }, [resolvedTheme]);
  return null;
}
