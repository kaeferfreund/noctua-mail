import { afterEach, expect, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import MessageListView from "./MessageListView";
import { reviewListProps } from "@/tests/helpers/i18nSlice2b";

const originalWidth = window.innerWidth;
afterEach(() => { cleanup(); window.innerWidth = originalWidth; });
for (const view of ["threads", "compact", "table", "card"] as const) test(`320 px ${view} renderer supplies semantic action identities`, () => {
  window.innerWidth = 320;
  const props = reviewListProps();
  const page = render(<I18nTestProvider locale="de"><Theme><MessageListView {...props} view={view} /></Theme></I18nTestProvider>);
  // Browser verification checks computed CSS geometry; happy-dom checks the
  // consumer attributes that the narrow-row stylesheet requires.
  if (view !== "card") {
    const button = page.getByRole("button", { name: "Löschen" });
    expect(button.getAttribute("data-message-action")).toBe("delete");
  }
  expect(page.container.querySelector('[data-message-action="menu"]')).toBeTruthy();
});
