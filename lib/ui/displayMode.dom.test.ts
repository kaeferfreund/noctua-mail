// Runs only under `bun run test:dom`.
import { afterEach, describe, expect, it } from "bun:test";
import { emulateDisplayMode } from "@/lib/testFixtures/displayMode";
import { isSingleWindowApp, isStandaloneDisplay } from "./displayMode";

let restore = () => {};
afterEach(() => restore());

describe("display mode", () => {
  it("a browser tab is neither standalone nor a single-window app", () => {
    restore = emulateDisplayMode({ touch: true });
    expect(isStandaloneDisplay()).toBe(false);
    expect(isSingleWindowApp()).toBe(false);
  });

  it("a home-screen app on a touch device opens no separate windows", () => {
    restore = emulateDisplayMode({ standalone: true, touch: true });
    expect(isStandaloneDisplay()).toBe(true);
    expect(isSingleWindowApp()).toBe(true);
  });

  it("an iOS home-screen app counts by navigator.standalone alone", () => {
    restore = emulateDisplayMode({ iosStandalone: true });
    expect(isStandaloneDisplay()).toBe(true);
    expect(isSingleWindowApp()).toBe(true);
  });

  it("an installed desktop app keeps its separate windows", () => {
    restore = emulateDisplayMode({ standalone: true, touch: false });
    expect(isStandaloneDisplay()).toBe(true);
    expect(isSingleWindowApp()).toBe(false);
  });
});
