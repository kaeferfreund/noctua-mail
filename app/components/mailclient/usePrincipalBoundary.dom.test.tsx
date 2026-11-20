import { afterEach, describe, expect, it } from "bun:test";
import { useState } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { usePrincipalBoundary } from "./usePrincipalBoundary";

// SD26, SD43: search text and open dialogs of one person never reach the next person in this tab.
type Auth = { principal: string | null; signedOut: boolean };
function harness(initial: Auth) {
  const view = renderHook((auth: Auth) => {
    const [query, setQuery] = useState("");
    const [leaves, setLeaves] = useState(0);
    usePrincipalBoundary(auth.principal, auth.signedOut, () => { setQuery(""); setLeaves(count => count + 1); });
    return { query, setQuery, leaves };
  }, { initialProps: initial });
  return view;
}
afterEach(() => { cleanup(); window.history.replaceState(null, "", "/"); });

describe("usePrincipalBoundary", () => {
  it("resets after sign-out and drops the private place from the address bar", () => {
    window.history.replaceState(null, "", "/?q=synthetic-private-term&a=synthetic-mailbox");
    const view = harness({ principal: "user-a", signedOut: false });
    act(() => { view.result.current.setQuery("synthetic-private-term"); });
    view.rerender({ principal: null, signedOut: true });
    expect(view.result.current.query).toBe("");
    expect(view.result.current.leaves).toBe(1);
    expect(window.location.search).toBe("");
    view.rerender({ principal: "user-b", signedOut: false });
    expect(view.result.current.leaves).toBe(1);
  });
  it("resets when another person signs in without a visible sign-out", () => {
    const view = harness({ principal: "user-a", signedOut: false });
    act(() => { view.result.current.setQuery("synthetic-private-term"); });
    view.rerender({ principal: "user-b", signedOut: false });
    expect(view.result.current.query).toBe("");
    expect(view.result.current.leaves).toBe(1);
  });
  it("keeps a link opened while signed out for the first person who signs in", () => {
    window.history.replaceState(null, "", "/?q=synthetic-linked-term");
    const view = harness({ principal: null, signedOut: true });
    act(() => { view.result.current.setQuery("synthetic-linked-term"); });
    view.rerender({ principal: null, signedOut: false });
    view.rerender({ principal: "user-a", signedOut: false });
    expect(view.result.current.query).toBe("synthetic-linked-term");
    expect(view.result.current.leaves).toBe(0);
    expect(window.location.search).toBe("?q=synthetic-linked-term");
  });
  it("does not reset while the same person's session is refreshed", () => {
    const view = harness({ principal: "user-a", signedOut: false });
    act(() => { view.result.current.setQuery("synthetic-term"); });
    view.rerender({ principal: null, signedOut: false });
    view.rerender({ principal: "user-a", signedOut: false });
    expect(view.result.current.query).toBe("synthetic-term");
    expect(view.result.current.leaves).toBe(0);
  });
});
