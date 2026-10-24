import { afterEach, describe, expect, it } from "bun:test";
import { expectFocused } from "./testDomAssertions";

afterEach(() => { document.body.innerHTML = ""; });

describe("expectFocused", () => {
  it("passes on the focused element and fails fast with a short description otherwise", () => {
    document.body.innerHTML = "<h1 tabindex='-1'>Verify your sign-in</h1><input aria-label='Code' />";
    const heading = document.querySelector("h1")!;
    heading.focus();
    expectFocused(heading);
    const input = document.querySelector("input")!;
    let message = "";
    try { expectFocused(input); } catch (error) { message = (error as Error).message; }
    expect(message).toBe('Expected focus on <input> "", found <h1> "Verify your sign-in"');
  });
});
