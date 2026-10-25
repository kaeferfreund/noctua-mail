import { afterEach, expect, test } from "bun:test";
import { act, cleanup, render } from "@testing-library/react";
import { ThemeProvider, useTheme } from "next-themes";
import { useEffect } from "react";
import { APP_BAR_COLORS } from "@/lib/ui/theme";
import ThemeColorSync from "./ThemeColorSync";

afterEach(() => {
  cleanup();
  document.head.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.remove());
  localStorage.clear();
});

function addMeta(media: string, content: string) {
  const meta = document.createElement("meta");
  meta.name = "theme-color";
  meta.media = media;
  meta.content = content;
  document.head.append(meta);
}

let choose: (theme: string) => void = () => {};
function Chooser() {
  const { setTheme } = useTheme();
  useEffect(() => { choose = setTheme; }, [setTheme]);
  return null;
}

test("theme-color follows the theme chosen in the app, not only the system scheme", () => {
  addMeta("(prefers-color-scheme: light)", APP_BAR_COLORS.light);
  addMeta("(prefers-color-scheme: dark)", APP_BAR_COLORS.dark);
  render(<ThemeProvider attribute="class" storageKey="noctua:theme" enableSystem defaultTheme="light"><Chooser /><ThemeColorSync /></ThemeProvider>);
  const contents = () => [...document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(meta => meta.content);
  expect(contents()).toEqual([APP_BAR_COLORS.light, APP_BAR_COLORS.light]);
  act(() => choose("dark"));
  expect(contents()).toEqual([APP_BAR_COLORS.dark, APP_BAR_COLORS.dark]);
});
