import { describe, expect, it } from "bun:test";
import { removeDateLabelsFromTabOrder } from "./calendarFocus";

describe("calendar date labels", () => {
  it("takes href-less date anchors out of the tab order and leaves real links alone", () => {
    const el = document.createElement("td");
    el.innerHTML = '<a class="fc-daygrid-day-number" aria-label="November 1, 2026">1</a><a href="#synthetic">Link</a><a tabindex="0" data-navlink="">Nav</a>';
    removeDateLabelsFromTabOrder({ el });
    const [label, link, nav] = el.querySelectorAll("a");
    expect(label.getAttribute("tabindex")).toBe("-1");
    expect(link.hasAttribute("tabindex")).toBe(false);
    expect(nav.getAttribute("tabindex")).toBe("0");
  });
});
