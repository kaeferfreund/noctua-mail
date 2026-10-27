import { afterEach, beforeEach, expect, jest, test } from "bun:test";
import { cleanup, renderHook } from "@testing-library/react";
import { installStandaloneRootTrap, isStandaloneRootPop, rememberStandaloneEntry } from "./standaloneRootTrap";
import { isMobileOverlayPop, useMobileOverlayHistory } from "./useMobileOverlayHistory";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const originalUserAgent = navigator.userAgent;
function device(userAgent: string, standalone: boolean | undefined) {
  Object.defineProperty(navigator, "userAgent", { value: userAgent, configurable: true });
  Object.defineProperty(navigator, "standalone", { value: standalone, configurable: true });
}
let remove = () => {};
beforeEach(() => device(IPHONE, true));
afterEach(() => {
  remove();
  remove = () => {};
  cleanup();
  device(originalUserAgent, undefined);
});

/** history.back()/go() report their popstate asynchronously, as in a browser. */
function traverse(delta: number) {
  return new Promise<PopStateEvent>((resolve) => {
    window.addEventListener("popstate", resolve as (event: Event) => void, { once: true });
    window.history.go(delta);
  });
}

test("the home-screen app's first entry gets a root marker and a trap copy of the same URL", async () => {
  window.history.replaceState(null, "", "/?a=~qa-shared&m=~imap-1");
  const length = window.history.length;
  remove = installStandaloneRootTrap();
  expect(window.history.length).toBe(length + 1);
  expect(window.history.state).toEqual({ noctuaRootTrap: true });
  expect(`${window.location.pathname}${window.location.search}`).toBe("/?a=~qa-shared&m=~imap-1");
  const event = await traverse(-1);
  expect(event.state).toEqual({ noctuaRoot: true });
  expect(isStandaloneRootPop(event)).toBe(true);
});

test("Back onto the root pushes the trap again with the URL and state on screen", async () => {
  window.history.replaceState(null, "", "/");
  remove = installStandaloneRootTrap();
  // The deep-link owner settles the start URL into the mailbox URL.
  window.history.replaceState({ ...window.history.state, noctuaUrl: true, noctuaEntry: "e1" }, "", "/?a=~qa-shared&f=INBOX");
  rememberStandaloneEntry();
  const length = window.history.length;
  const push = jest.spyOn(window.history, "pushState");
  await traverse(-1);
  expect(push).toHaveBeenCalledTimes(1);
  push.mockRestore();
  expect(window.history.length).toBe(length);
  expect(`${window.location.pathname}${window.location.search}`).toBe("/?a=~qa-shared&f=INBOX");
  expect(window.history.state).toEqual({ noctuaUrl: true, noctuaEntry: "e1", noctuaRootTrap: true });
  // A second swipe behaves the same: the app never leaves the screen.
  await traverse(-1);
  expect(`${window.location.pathname}${window.location.search}`).toBe("/?a=~qa-shared&f=INBOX");
  expect(window.history.state?.noctuaRootTrap).toBe(true);
});

test("a reload keeps the installed trap; a reload on the root entry adds only the trap", () => {
  window.history.replaceState({ noctuaRootTrap: true, noctuaUrl: true }, "", "/?a=~qa-shared");
  let length = window.history.length;
  remove = installStandaloneRootTrap();
  expect(window.history.length).toBe(length);
  remove();
  window.history.replaceState({ noctuaRoot: true }, "", "/?a=~qa-shared");
  length = window.history.length;
  remove = installStandaloneRootTrap();
  expect(window.history.length).toBe(length + 1);
  expect(window.history.state).toEqual({ noctuaRootTrap: true });
});

test("no trap in a browser tab or in an Android home-screen app", () => {
  for (const [userAgent, standalone] of [[IPHONE, false], ["Mozilla/5.0 (Linux; Android 15; Pixel 7) Mobile", undefined]] as const) {
    device(userAgent, standalone);
    window.history.replaceState(null, "", "/");
    const length = window.history.length;
    const stop = installStandaloneRootTrap();
    expect(window.history.length).toBe(length);
    expect(window.history.state).toBeNull();
    stop();
  }
});

test("a Sheet sits on top of the trap: its Back closes it once and does not push the trap again", async () => {
  window.history.replaceState(null, "", "/?a=~qa-shared&f=INBOX");
  remove = installStandaloneRootTrap();
  const close = jest.fn();
  const view = renderHook(() => useMobileOverlayHistory(true, close));
  expect(window.history.state).toMatchObject({ noctuaRootTrap: true, noctuaMobileOverlay: expect.any(Number) });
  const length = window.history.length;
  const push = jest.spyOn(window.history, "pushState");
  const event = await traverse(-1);
  expect(isStandaloneRootPop(event)).toBe(false);
  expect(isMobileOverlayPop(event)).toBe(true);
  expect(close).toHaveBeenCalledTimes(1);
  expect(push).not.toHaveBeenCalled();
  push.mockRestore();
  expect(window.history.length).toBe(length);
  expect(window.history.state).toEqual({ noctuaRootTrap: true });
  view.unmount();
});

test("going back past an open Sheet onto the root closes the Sheet and pushes the trap once", async () => {
  window.history.replaceState(null, "", "/?a=~qa-shared&f=INBOX");
  remove = installStandaloneRootTrap();
  rememberStandaloneEntry();
  const close = jest.fn();
  const view = renderHook(() => useMobileOverlayHistory(true, close));
  const push = jest.spyOn(window.history, "pushState");
  await traverse(-2);
  expect(close).toHaveBeenCalledTimes(1);
  expect(push).toHaveBeenCalledTimes(1);
  push.mockRestore();
  expect(`${window.location.pathname}${window.location.search}`).toBe("/?a=~qa-shared&f=INBOX");
  // The closed Sheet's entry is not restored.
  expect(window.history.state).toEqual({ noctuaRootTrap: true });
  view.unmount();
});
