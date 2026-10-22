// Runs only under `bun run test:dom` (preloads happy-dom before component load).
import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, render } from "@testing-library/react";
import { useDarkMode } from "./useDarkMode";

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
});

function Probe() {
  const darkMode = useDarkMode();
  return <output data-testid="mode">{darkMode ? "dark" : "light"}</output>;
}

describe("useDarkMode", () => {
  it("reads the html class on the first client render", () => {
    document.documentElement.classList.add("dark");
    const { getByTestId } = render(<Probe />);
    expect(getByTestId("mode").textContent).toBe("dark");
  });

  it("follows class changes made by the theme provider", async () => {
    const { getByTestId } = render(<Probe />);
    expect(getByTestId("mode").textContent).toBe("light");
    await act(async () => {
      document.documentElement.classList.add("dark");
      // MutationObserver callbacks are delivered as microtasks.
      await Promise.resolve();
    });
    expect(getByTestId("mode").textContent).toBe("dark");
    await act(async () => {
      document.documentElement.classList.remove("dark");
      await Promise.resolve();
    });
    expect(getByTestId("mode").textContent).toBe("light");
  });
});
