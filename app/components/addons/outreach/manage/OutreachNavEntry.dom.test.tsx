import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { SidebarProvider } from "@/app/components/ui/sidebar";
import { resetOutreachStatusForTests } from "../useOutreachStatus";
import OutreachNavEntry from "./OutreachNavEntry";

const OFF = { loaded: true, available: false, accounts: [], sesConfigured: false, trackingConfigured: false };

afterEach(() => { cleanup(); resetOutreachStatusForTests(); });

function mount(accountId: string) {
  return render(<SidebarProvider><OutreachNavEntry accountId={accountId} /></SidebarProvider>);
}

describe("newsletter navigation entry", () => {
  it("is absent while the addon is off on the server", () => {
    resetOutreachStatusForTests(OFF);
    expect(mount("acc-a").queryByRole("link", { name: "Newsletter" })).toBeNull();
  });

  it("is absent for a mailbox that has not activated the addon", () => {
    resetOutreachStatusForTests({ ...OFF, available: true, accounts: [{ accountId: "acc-b", enabled: true, trackMailDefault: false }, { accountId: "acc-a", enabled: false, trackMailDefault: false }] });
    expect(mount("acc-a").queryByRole("link", { name: "Newsletter" })).toBeNull();
  });

  it("links to the mailbox's newsletter area once activated, and follows a status refresh", () => {
    resetOutreachStatusForTests(OFF);
    const page = mount("acc-a");
    expect(page.queryByRole("link", { name: "Newsletter" })).toBeNull();
    act(() => resetOutreachStatusForTests({ ...OFF, available: true, accounts: [{ accountId: "acc-a", enabled: true, trackMailDefault: false }] }));
    expect(page.getByRole("link", { name: "Newsletter" }).getAttribute("href")).toBe("/newsletter?accountId=acc-a");
  });
});
