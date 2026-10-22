// Runs only under `bun run test:dom` (preloads happy-dom before component load).
import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { Theme } from "@radix-ui/themes";
import MessageDisplayOptionsMenu from "./MessageDisplayOptionsMenu";
import type { MessageTab } from "./types";

const originalWidth = window.innerWidth;
afterEach(() => {
  cleanup();
  window.innerWidth = originalWidth;
});

type Props = ComponentProps<typeof MessageDisplayOptionsMenu>;

function setup(overrides: Partial<Props> = {}) {
  const calls = {
    format: [] as MessageTab[],
    textScale: [] as number[],
    textReset: 0,
    zoom: [] as number[],
    zoomReset: 0
  };
  const props: Props = {
    formats: ["html", "text", "markdown", "source"],
    format: "html",
    defaultFormat: "html",
    onFormatChange: (format) => calls.format.push(format),
    textScale: 1,
    onAdjustTextScale: (delta) => calls.textScale.push(delta),
    onResetTextScale: () => {
      calls.textReset++;
    },
    zoom: 1,
    onAdjustZoom: (delta) => calls.zoom.push(delta),
    onResetZoom: () => {
      calls.zoomReset++;
    },
    ...overrides
  };
  const page = render(
    <Theme>
      <MessageDisplayOptionsMenu {...props} />
    </Theme>
  );
  const open = async (name: string | RegExp = /^Display options/) => {
    fireEvent.keyDown(page.getByRole("button", { name }), { key: "Enter" });
    return page.findByRole("menu");
  };
  return { page, calls, open };
}

describe("MessageDisplayOptionsMenu", () => {
  it("offers only the message's formats and switches through the radio group", async () => {
    const { page, calls, open } = setup({ formats: ["html", "source"] });
    await open("Display options");
    const formats = page.getByRole("group", { name: "Show as" });
    const html = within(formats).getByRole("menuitemradio", { name: "HTML" });
    expect(html.getAttribute("aria-checked")).toBe("true");
    expect(page.queryByRole("menuitemradio", { name: "Plain text" })).toBeNull();
    fireEvent.click(page.getByRole("menuitemradio", { name: "Source" }));
    expect(calls.format).toEqual(["source"]);
  });

  it("ignores picking the format that is already shown", async () => {
    const { page, calls, open } = setup({ formats: ["html", "source"], format: "source" });
    await open();
    fireEvent.click(page.getByRole("menuitemradio", { name: "Source" }));
    expect(calls.format).toEqual([]);
  });

  it("steps text size and zoom while keeping the menu open", async () => {
    const { page, calls, open } = setup({ textScale: 1.2, zoom: 0.9 });
    await open();
    expect(page.getByRole("group", { name: "Text size" })).toBeTruthy();
    fireEvent.click(page.getByRole("menuitem", { name: "Increase text size, currently 120%" }));
    fireEvent.click(page.getByRole("menuitem", { name: "Decrease text size, currently 120%" }));
    fireEvent.click(page.getByRole("menuitem", { name: "Reset text size (currently 120%)" }));
    fireEvent.click(page.getByRole("menuitem", { name: "Zoom in, currently 90%" }));
    fireEvent.click(page.getByRole("menuitem", { name: "Reset zoom (currently 90%)" }));
    expect(calls.textScale).toEqual([0.1, -0.1]);
    expect(calls.textReset).toBe(1);
    expect(calls.zoom).toEqual([0.1]);
    expect(calls.zoomReset).toBe(1);
    expect(page.queryByRole("menu")).toBeTruthy();
  });

  it("hides zoom outside HTML and both scales for Source", async () => {
    const text = setup({ formats: ["text", "markdown"], format: "text", defaultFormat: "text" });
    await text.open();
    expect(text.page.getByRole("group", { name: "Text size" })).toBeTruthy();
    expect(text.page.queryByRole("group", { name: "Zoom" })).toBeNull();
    cleanup();

    const source = setup({ format: "source" });
    await source.open();
    expect(source.page.queryByRole("group", { name: "Text size" })).toBeNull();
    expect(source.page.queryByRole("group", { name: "Zoom" })).toBeNull();
  });

  it("names a non-default presentation on the trigger and its chip", () => {
    const plain = setup();
    expect(plain.page.getByRole("button", { name: "Display options" })).toBeTruthy();
    expect(plain.page.container.textContent).toBe("");
    cleanup();

    const changed = setup({ format: "text", textScale: 1.2, zoom: 1.5 });
    // Zoom only applies to HTML, so it is not reported for the text view.
    expect(
      changed.page.getByRole("button", { name: "Display options (Plain text · Text 120%)" })
    ).toBeTruthy();
    expect(changed.page.container.textContent).toBe("Plain text · Text 120%");
  });

  it("renders the shadcn menu parts on mobile", async () => {
    window.innerWidth = 390;
    const { page, open } = setup();
    await open();
    const item = page.getByRole("menuitemradio", { name: "Markdown" });
    expect(item.getAttribute("data-slot")).toBe("dropdown-menu-radio-item");
    expect(item.closest(".radix-themes")).toBeTruthy();
  });
});
