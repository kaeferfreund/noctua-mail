import { afterEach, expect, test } from "bun:test";
import { act, cleanup, render } from "@testing-library/react";
import { ThemeProvider, useTheme } from "next-themes";
import { useEffect } from "react";
import { APP_BAR_COLORS, APP_BAR_TOKEN, cssColorToHex } from "@/lib/ui/theme";
import ThemeColorSync from "./ThemeColorSync";

// The top bar token per theme, as app/globals.css declares it.
const style = document.createElement("style");
style.textContent = `:root { ${APP_BAR_TOKEN}: #fff; } .dark { ${APP_BAR_TOKEN}: oklch(0.145 0 0); }`;

afterEach(() => {
  cleanup();
  document.head.querySelectorAll('meta[name="theme-color"]').forEach(meta => meta.remove());
  style.remove();
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

const contents = () => [...document.head.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')].map(meta => meta.content);
const topBarColor = () => cssColorToHex(getComputedStyle(document.documentElement).getPropertyValue(APP_BAR_TOKEN));

test("theme-color is the computed top bar colour of the theme chosen in the app", async () => {
  document.head.append(style);
  addMeta("(prefers-color-scheme: light)", APP_BAR_COLORS.light);
  addMeta("(prefers-color-scheme: dark)", APP_BAR_COLORS.dark);
  render(<ThemeProvider attribute="class" storageKey="noctua:theme" enableSystem defaultTheme="light"><Chooser /><ThemeColorSync /></ThemeProvider>);
  expect(topBarColor()).toBe("#ffffff");
  expect(contents()).toEqual(["#ffffff", "#ffffff"]);
  await act(async () => choose("dark"));
  expect(topBarColor()).toBe("#0a0a0a");
  expect(contents()).toEqual(["#0a0a0a", "#0a0a0a"]);
});

test("falls back to the static colours when the token is not readable", async () => {
  addMeta("(prefers-color-scheme: light)", APP_BAR_COLORS.light);
  await act(async () => {
    render(<ThemeProvider attribute="class" storageKey="noctua:theme" enableSystem defaultTheme="dark"><ThemeColorSync /></ThemeProvider>);
  });
  expect(contents()).toEqual([APP_BAR_COLORS.dark]);
});
