import { afterEach, expect, it, spyOn } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { Sheet, SheetContent, SheetTitle } from "./sheet";
afterEach(cleanup);
it("QA-013 opts sheet content and backdrop out of motion when the user requests reduction", async () => {
  const original = window.matchMedia.bind(window);
  const media = spyOn(window, "matchMedia").mockImplementation(query => ({ ...original(query), matches: query === "(prefers-reduced-motion: reduce)", addEventListener() {}, removeEventListener() {} } as MediaQueryList));
  try {
    expect(window.matchMedia("(prefers-reduced-motion: reduce)").matches).toBe(true);
    const page = render(<Sheet open><SheetContent aria-describedby={undefined}><SheetTitle>Synthetic sidebar</SheetTitle></SheetContent></Sheet>);
    const sheet = await page.findByRole("dialog", { name: "Synthetic sidebar" });
    const overlay = document.querySelector('[data-slot="sheet-overlay"]')!;
    for (const element of [sheet, overlay]) {
      expect(element.classList.contains("motion-reduce:data-open:animate-none")).toBe(true);
      expect(element.classList.contains("motion-reduce:data-closed:animate-none")).toBe(true);
      expect(element.classList.contains("motion-reduce:transition-none")).toBe(true);
      expect(element.classList.contains("motion-reduce:duration-0")).toBe(true);
    }
  } finally { media.mockRestore(); }
});
