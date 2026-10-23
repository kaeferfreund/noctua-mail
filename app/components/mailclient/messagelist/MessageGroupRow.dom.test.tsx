import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import type { Message } from "@/lib/data";
import MessageGroupRow from "./MessageGroupRow";
import type { MessageGroup } from "./listModel";

afterEach(cleanup);

const message = (id: string): Message => ({
  id, threadId: `${id}-thread`, subject: "Synthetic subject", from: "sender@example.test",
  to: "recipient@example.test", preview: "Synthetic preview", date: "2026-10-22T00:00:00.000Z",
  dateValue: 1792627200000, folderId: "synthetic-inbox", accountId: "synthetic-account",
  body: "Synthetic body"
});

function renderGroupRow(group: MessageGroup, isCollapsed = false) {
  const changes: boolean[] = [];
  const page = render(
    <Theme>
      <MessageGroupRow
        group={group}
        isCollapsed={isCollapsed}
        height={28}
        getGroupLabel={(entry) => entry.label ?? entry.key}
        onOpenChange={(open) => changes.push(open)}
      />
    </Theme>
  );
  return { page, changes };
}

describe("MessageGroupRow", () => {
  it("is a toggle button named by label and count whose aria-expanded follows the state", () => {
    const { page, changes } = renderGroupRow({ key: "Today", items: [message("a"), message("b"), message("c")] });
    const toggle = page.getByRole("button", { name: "Today 3" });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(toggle.querySelector("svg")).toBeTruthy();
    fireEvent.click(toggle);
    expect(changes).toEqual([false]);

    cleanup();
    const collapsed = renderGroupRow({ key: "Today", items: [message("a")] }, true);
    expect(collapsed.page.getByRole("button", { name: "Today 1" }).getAttribute("aria-expanded")).toBe("false");
  });

  it("shows loaded and total counts while a group is only partially loaded", () => {
    const { page } = renderGroupRow({ key: "This Week", items: [message("a"), message("b")], count: 9 });
    expect(page.getByRole("button", { name: "This Week 2 / 9" })).toBeTruthy();
  });

  it("disables an empty group without a chevron unless it may toggle when empty", () => {
    const { page, changes } = renderGroupRow({ key: "Older", items: [], count: 4 });
    const toggle = page.getByRole("button", { name: "Older 0 / 4" }) as HTMLButtonElement;
    expect(toggle.disabled).toBe(true);
    expect(toggle.querySelector("svg")).toBeNull();
    fireEvent.click(toggle);
    expect(changes).toEqual([]);

    cleanup();
    const suggestions = renderGroupRow(
      { key: "topic-suggestions", label: "Suggested", items: [], showCount: false, allowToggleWhenEmpty: true, variant: "topic-suggestions" },
      true
    );
    const suggestionToggle = suggestions.page.getByRole("button", { name: "Suggested" }) as HTMLButtonElement;
    expect(suggestionToggle.disabled).toBe(false);
    fireEvent.click(suggestionToggle);
    expect(suggestions.changes).toEqual([true]);
  });
});
