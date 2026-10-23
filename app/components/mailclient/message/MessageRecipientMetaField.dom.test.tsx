// Runs only under `bun run test:dom` (preloads happy-dom before component load).
import { afterEach, describe, expect, it } from "bun:test";
import { cleanup } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import MessageRecipientMetaField from "./MessageRecipientMetaField";

afterEach(cleanup);

const longSender =
  '"Dr. Kim Beispiel & Robin Muster | Praxis Musterstadt – Zahnheilkunde" <info@praxis.example>';

function renderField(variant: "segment" | "line") {
  return render(
    <Theme>
      <MessageRecipientMetaField
        label="From"
        value={longSender}
        copyValue={longSender}
        variant={variant}
        onSearchByAddress={() => {}}
      />
    </Theme>
  );
}

// CSS modules resolve to empty objects in this run, so these check the
// structure the truncation CSS relies on rather than class names.
describe("MessageRecipientMetaField", () => {
  it("gives the From segment's addresses their own box, with the copy button beside it", () => {
    const page = renderField("segment");
    const trigger = page.getByRole("button", { name: /^Address actions for/ });
    const copy = page.getByRole("button", { name: "Copy addresses" });
    const text = trigger.parentElement;
    // The copy button must sit outside the clipped text box, or it would be
    // truncated away together with the sender name.
    expect(text?.contains(copy)).toBe(false);
    expect(copy.parentElement).toBe(text?.parentElement ?? null);
    expect(text?.nextElementSibling).toBe(copy);
  });

  it("keeps the To/Cc line's addresses and copy button in one wrapping flow", () => {
    const page = renderField("line");
    const trigger = page.getByRole("button", { name: /^Address actions for/ });
    const copy = page.getByRole("button", { name: "Copy addresses" });
    expect(trigger.parentElement).toBe(copy.parentElement);
  });
});
