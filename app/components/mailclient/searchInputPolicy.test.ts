import { describe, expect, test } from "bun:test";
import {
  SEARCH_INPUT_DEBOUNCE_MS,
  resolveSearchInputTransition,
  resolveSubmittedSearchQuery
} from "./searchInputPolicy";

describe("resolveSearchInputTransition", () => {
  test("typed text is applied after a short debounce, trimmed", () => {
    expect(SEARCH_INPUT_DEBOUNCE_MS).toBeLessThanOrEqual(300);
    expect(resolveSearchInputTransition("r", "")).toEqual({ type: "schedule", query: "r" });
    expect(resolveSearchInputTransition(" rechnung ", "")).toEqual({ type: "schedule", query: "rechnung" });
  });

  test("input that already matches the applied query changes nothing", () => {
    expect(resolveSearchInputTransition("eba", "eba")).toEqual({ type: "none" });
    expect(resolveSearchInputTransition("eba ", "eba")).toEqual({ type: "none" });
    expect(resolveSearchInputTransition("", "")).toEqual({ type: "none" });
  });

  test("an emptied box clears an applied query immediately", () => {
    expect(resolveSearchInputTransition("", "eba")).toEqual({ type: "apply", query: "" });
    expect(resolveSearchInputTransition("   ", "eba")).toEqual({ type: "apply", query: "" });
  });
});

describe("resolveSubmittedSearchQuery", () => {
  test("Enter applies the trimmed input", () => {
    expect(resolveSubmittedSearchQuery("e")).toBe("e");
    expect(resolveSubmittedSearchQuery(" eb ")).toBe("eb");
    expect(resolveSubmittedSearchQuery("   ")).toBe("");
  });
});
