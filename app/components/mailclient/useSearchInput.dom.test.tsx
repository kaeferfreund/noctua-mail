import { afterEach, describe, expect, it } from "bun:test";
import { useState } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useSearchInput } from "./useSearchInput";

afterEach(() => cleanup());

const DEBOUNCE_MS = 20;

function useHarness() {
  const [query, setQueryState] = useState("");
  const [applied, setApplied] = useState<string[]>([]);
  const setQuery = (next: string) => {
    setQueryState(next);
    setApplied((list) => [...list, next]);
  };
  const input = useSearchInput({ query, setQuery, debounceMs: DEBOUNCE_MS });
  return { query, setQueryState, applied, ...input };
}

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, DEBOUNCE_MS * 3));
  });

describe("useSearchInput", () => {
  it("applies typed text only after the debounce", async () => {
    const { result } = renderHook(useHarness);
    act(() => result.current.setSearchInput("e"));
    expect(result.current.searchInput).toBe("e");
    expect(result.current.query).toBe("");
    await settle();
    expect(result.current.query).toBe("e");
  });

  it("applies only the last value of a typing burst", async () => {
    const { result } = renderHook(useHarness);
    for (const value of ["r", "re", "rec", "rech", "rechnung"]) {
      act(() => result.current.setSearchInput(value));
    }
    await settle();
    expect(result.current.query).toBe("rechnung");
    expect(result.current.applied).toEqual(["rechnung"]);
  });

  it("Enter applies the box at once and cancels the pending debounce", async () => {
    const { result } = renderHook(useHarness);
    act(() => result.current.setSearchInput("eb"));
    act(() => result.current.submitSearchInput());
    expect(result.current.query).toBe("eb");
    await settle();
    expect(result.current.applied).toEqual(["eb"]);
  });

  it("clearing the box clears the applied query immediately", async () => {
    const { result } = renderHook(useHarness);
    act(() => result.current.setSearchInput("ebay"));
    await settle();
    expect(result.current.query).toBe("ebay");
    act(() => result.current.setSearchInput(""));
    expect(result.current.query).toBe("");
  });

  it("typing back to the applied text drops the pending search", async () => {
    const { result } = renderHook(useHarness);
    act(() => result.current.setSearchInput("ebay"));
    await settle();
    act(() => result.current.setSearchInput("ebayx"));
    act(() => result.current.setSearchInput("ebay"));
    await settle();
    expect(result.current.applied).toEqual(["ebay"]);
  });

  it("mirrors a query set elsewhere into the box and drops a pending search", async () => {
    const { result } = renderHook(useHarness);
    act(() => result.current.setSearchInput("eba"));
    act(() => result.current.setQueryState("topic:steuern"));
    expect(result.current.searchInput).toBe("topic:steuern");
    await settle();
    expect(result.current.query).toBe("topic:steuern");
    act(() => result.current.setQueryState(""));
    expect(result.current.searchInput).toBe("");
  });
});

describe("useSearchInput scope change", () => {
  it("drops a pending search when resetSearchInput runs before the debounce fires", async () => {
    const { result } = renderHook(useHarness);
    act(() => result.current.setSearchInput("re"));
    act(() => result.current.resetSearchInput());
    expect(result.current.searchInput).toBe("");
    await settle();
    expect(result.current.query).toBe("");
    expect(result.current.applied).toEqual([]);
  });
});
