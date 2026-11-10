import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import DomainViewBar from "./DomainViewBar";
import { DOMAIN_FOLDER_ROLES, type DomainFolderRole } from "@/lib/domainView";

afterEach(cleanup);

function renderBar(props: Partial<React.ComponentProps<typeof DomainViewBar>> = {}) {
  const changes: DomainFolderRole[] = [];
  const view = render(
    <Theme>
      <DomainViewBar
        roles={DOMAIN_FOLDER_ROLES}
        activeRole="inbox"
        onRoleChange={(role) => changes.push(role)}
        {...props}
      />
    </Theme>
  );
  return { view, changes };
}

const pressed = (view: ReturnType<typeof render>) =>
  view.getAllByRole("button").filter((button) => button.getAttribute("aria-pressed") === "true")
    .map((button) => button.getAttribute("data-domain-role"));

describe("DomainViewBar", () => {
  it("shows one row of folder buttons without a heading and without a close button in a single mailbox", () => {
    const { view } = renderBar({ roles: ["inbox", "sent", "trash"], activeRole: "sent" });
    const group = view.getByRole("group", { name: "Mailbox folders" });
    expect(Array.from(group.querySelectorAll("[data-domain-role]")).map((node) => node.getAttribute("data-domain-role")))
      .toEqual(["inbox", "sent", "trash"]);
    expect(pressed(view)).toEqual(["sent"]);
    expect(view.queryByRole("button", { name: "Close domain view" })).toBeNull();
    expect(view.container.textContent).not.toContain("All mailboxes");
  });

  it("marks no button active when the open folder has none of the roles", () => {
    const { view } = renderBar({ activeRole: null });
    expect(pressed(view)).toEqual([]);
    expect(view.getAllByRole("button")).toHaveLength(DOMAIN_FOLDER_ROLES.length);
  });

  it("reports a click on another role and ignores a click on the active one", () => {
    const { view, changes } = renderBar({ activeRole: "inbox" });
    fireEvent.click(view.getByRole("button", { name: "Inbox" }));
    fireEvent.click(view.getByRole("button", { name: "Spam" }));
    expect(changes).toEqual(["spam"]);
  });

  it("puts the close button after the folder row in the domain view", () => {
    let closed = 0;
    const { view } = renderBar({ onClose: () => { closed += 1; } });
    const group = view.getByRole("group", { name: "Folder in the domain view" });
    const close = view.getByRole("button", { name: "Close domain view" });
    expect(group.contains(close)).toBe(false);
    expect(group.compareDocumentPosition(close) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(close);
    expect(closed).toBe(1);
  });
});
