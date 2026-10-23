// Uses the existing happy-dom harness through bun run test:dom.
import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import { Theme } from "@radix-ui/themes";
import { TooltipProvider } from "@/app/components/ui/tooltip";
import MessageListHeader, { type MessageListHeaderProps } from "./MessageListHeader";
import type { MessageGroup } from "./listModel";

afterEach(cleanup);

type HeaderState = MessageListHeaderProps["state"];

const syntheticMessage = { id: "msg-1@example.test" } as MessageGroup["items"][number];

const baseState: HeaderState = {
  searchScope: "folder",
  loadedMessageCount: 349,
  totalMessages: 10848,
  listLoading: false,
  messageView: "threads",
  groupBy: "date",
  messageSort: "date",
  eventGroupingAvailable: false,
  threadDateSource: "latestReceivedDateValue",
  threadsMode: "on",
  threadsScopeAvailable: true,
  threadsAllowed: true,
  groupedMessages: [],
  collapsedGroups: {}
};

function renderHeader(overrides: Partial<HeaderState> = {}) {
  const calls: Array<[string, unknown]> = [];
  const record = (name: string) => (value: unknown) => {
    calls.push([name, value]);
  };
  const actions: MessageListHeaderProps["actions"] = {
    setMessageView: record("setMessageView"),
    setGroupBy: record("setGroupBy"),
    setMessageSort: record("setMessageSort"),
    setThreadDateSource: record("setThreadDateSource"),
    setThreadsMode: record("setThreadsMode"),
    toggleAllGroups: () => {
      calls.push(["toggleAllGroups", undefined]);
    }
  };
  // The toolbar renders in the shell header, inside the shell's TooltipProvider.
  const view = render(
    <Theme>
      <TooltipProvider>
        <MessageListHeader state={{ ...baseState, ...overrides }} actions={actions} />
      </TooltipProvider>
    </Theme>
  );
  return { view, calls };
}

// Radix positions and animates menus asynchronously; let those updates land
// inside act so they do not leak into the next assertion.
async function interact(fire: () => void) {
  await act(async () => {
    fire();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function openMenu(view: ReturnType<typeof render>, triggerName: RegExp | string) {
  await interact(() => {
    fireEvent.keyDown(view.getByRole("button", { name: triggerName }), { key: "Enter" });
  });
  return within(view.getByRole("menu"));
}

function radioNames(group: HTMLElement) {
  return within(group)
    .getAllByRole("menuitemradio")
    .map((item) => item.textContent);
}

function describedBy(element: HTMLElement) {
  const id = element.getAttribute("aria-describedby");
  return id ? document.getElementById(id)?.textContent : undefined;
}

describe("message list toolbar", () => {
  it("shows only the locale-formatted count and the compact controls", () => {
    const { view } = renderHeader();
    const count = new Intl.NumberFormat();
    const label = `${count.format(349)} of ${count.format(10848)}`;
    expect(view.getByText(label).getAttribute("title")).toBe(`${label} messages loaded`);
    // Older pages load on scroll; the toolbar has no Load more button.
    expect(view.queryByRole("button", { name: "Load more" })).toBeNull();
    expect(view.getByRole("button", { name: "View: Threads" })).toBeTruthy();
    const sort = view.getByRole("button", { name: "Sort & group: Date, grouped by Date, threads on" });
    expect(sort.textContent).toBe("Date");
    // The folder name lives in the shell breadcrumb; the toolbar renders no title text.
    expect(view.container.textContent).toBe(`${label}Date`);
  });

  it("keeps the loading state and names a count without a known total", () => {
    const { view } = renderHeader({ listLoading: true, totalMessages: null, loadedMessageCount: 1 });
    expect(view.getByText("Loading… 1 message").getAttribute("title")).toBe("Loading… 1 message loaded");
  });

  it("lets a narrow header hide the count, sort label and chevrons but keeps the state in the accessible name", () => {
    const { view } = renderHeader();
    const count = new Intl.NumberFormat();
    const label = `${count.format(349)} of ${count.format(10848)}`;
    // happy-dom does not evaluate container queries; hidden by default and
    // revealed by an @container/header variant is the contract.
    const hiddenUntil = (element: Element, reveal: string) => {
      expect(element.classList.contains("hidden")).toBe(true);
      expect(element.classList.contains(reveal)).toBe(true);
    };
    hiddenUntil(view.getByText(label), "@4xl/header:inline");
    const sort = view.getByRole("button", { name: "Sort & group: Date, grouped by Date, threads on" });
    hiddenUntil(within(sort).getByText("Date"), "@3xl/header:inline-block");
    hiddenUntil(sort.querySelector("svg.lucide-chevron-down")!, "@3xl/header:block");
  });

  it("switches the view from a radio menu and commits after the next frame", async () => {
    const { view, calls } = renderHeader();
    const menu = await openMenu(view, "View: Threads");
    const group = menu.getByRole("group", { name: "View" });
    expect(radioNames(group)).toEqual(["Threads", "Compact", "Cards", "Table"]);
    expect(menu.getByRole("menuitemradio", { name: "Threads" }).getAttribute("aria-checked")).toBe("true");
    await interact(() => fireEvent.click(menu.getByRole("menuitemradio", { name: "Table" })));
    expect(view.getByRole("button", { name: "View: Table" })).toBeTruthy();
    await waitFor(() => expect(calls).toContainEqual(["setMessageView", "table"]));
  });

  it("groups sort, grouping, thread date and threads into labelled sections", async () => {
    const { view, calls } = renderHeader();
    const menu = await openMenu(view, /^Sort & group/);
    expect(radioNames(menu.getByRole("group", { name: "Sort by" }))).toEqual(["Date", "Size"]);
    expect(radioNames(menu.getByRole("group", { name: "Group by" }))).toEqual([
      "Date",
      "Week",
      "Sender",
      "Sender domain",
      "Year",
      "None"
    ]);
    expect(radioNames(menu.getByRole("group", { name: "Thread date" }))).toEqual([
      "Received",
      "Last activity"
    ]);
    const threads = menu.getByRole("group", { name: "Threads" });
    expect(radioNames(threads)).toEqual(["Off", "On", "On in scoped views"]);
    expect(describedBy(threads)).toBeUndefined();
    await interact(() => fireEvent.click(menu.getByRole("menuitemradio", { name: "Week" })));
    expect(
      view.getByRole("button", { name: "Sort & group: Date, grouped by Week, threads on" }).textContent
    ).toBe("Week");
    await waitFor(() => expect(calls).toContainEqual(["setGroupBy", "week"]));

    const reopened = await openMenu(view, /^Sort & group/);
    await interact(() => fireEvent.click(reopened.getByRole("menuitemradio", { name: "Off" })));
    expect(calls).toContainEqual(["setThreadsMode", "off"]);
  });

  it("ignores picking the option that is already checked", async () => {
    const { view, calls } = renderHeader();
    const menu = await openMenu(view, /^Sort & group/);
    const sortBy = menu.getByRole("group", { name: "Sort by" });
    await interact(() => fireEvent.click(within(sortBy).getByRole("menuitemradio", { name: "Date" })));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls.filter(([name]) => name === "setMessageSort")).toEqual([]);
  });

  it("offers Event and Folder grouping only where they apply", async () => {
    const { view } = renderHeader({ eventGroupingAvailable: true, searchScope: "all" });
    const menu = await openMenu(view, /^Sort & group/);
    expect(radioNames(menu.getByRole("group", { name: "Group by" }))).toEqual([
      "Date",
      "Week",
      "Sender",
      "Sender domain",
      "Year",
      "Event",
      "Folder",
      "None"
    ]);
  });

  it("disables grouping and threads with a reason while sorting by size", async () => {
    const { view } = renderHeader({ messageSort: "size", threadsAllowed: false });
    expect(view.queryByRole("button", { name: /all groups/ })).toBeNull();
    const menu = await openMenu(view, "Sort & group: Size, grouping and threads off while sorting by size");
    const grouping = menu.getByRole("group", { name: "Group by" });
    expect(describedBy(grouping)).toBe("Off while sorting by size");
    for (const item of within(grouping).getAllByRole("menuitemradio")) {
      expect(item.getAttribute("aria-disabled")).toBe("true");
    }
    expect(within(grouping).getByRole("menuitemradio", { name: "None" }).getAttribute("aria-checked")).toBe("true");
    expect(menu.queryByRole("group", { name: "Thread date" })).toBeNull();
    const threads = menu.getByRole("group", { name: "Threads" });
    expect(describedBy(threads)).toBe("Off while sorting by size");
  });

  it("shows threads as off and explains the grouping requirement when they cannot apply", async () => {
    const { view } = renderHeader({ groupBy: "sender", threadsAllowed: false, threadsMode: "on" });
    const menu = await openMenu(view, "Sort & group: Date, grouped by Sender, threads off");
    expect(menu.queryByRole("group", { name: "Thread date" })).toBeNull();
    const threads = menu.getByRole("group", { name: "Threads" });
    expect(describedBy(threads)).toBe("Requires Date, Week or Year grouping");
    for (const item of within(threads).getAllByRole("menuitemradio")) {
      expect(item.getAttribute("aria-disabled")).toBe("true");
    }
    expect(within(threads).getByRole("menuitemradio", { name: "Off" }).getAttribute("aria-checked")).toBe("true");
  });

  it("keeps scoped threads unselectable while searching everywhere", async () => {
    const { view } = renderHeader({
      searchScope: "all",
      threadsMode: "scope",
      threadsScopeAvailable: false
    });
    const menu = await openMenu(view, /^Sort & group/);
    const threads = menu.getByRole("group", { name: "Threads" });
    expect(describedBy(threads)).toBe("Scoped views are inactive while searching everywhere");
    const scoped = within(threads).getByRole("menuitemradio", { name: "On in scoped views" });
    expect(scoped.getAttribute("aria-checked")).toBe("true");
    expect(scoped.getAttribute("aria-disabled")).toBe("true");
    expect(within(threads).getByRole("menuitemradio", { name: "On" }).getAttribute("aria-disabled")).toBeNull();
  });

  it("toggles all groups", () => {
    const groupedMessages: MessageGroup[] = [{ key: "Today", label: "Today", items: [syntheticMessage] }];
    const { view, calls } = renderHeader({ groupedMessages });
    fireEvent.click(view.getByRole("button", { name: "Collapse all groups" }));
    expect(calls).toContainEqual(["toggleAllGroups", undefined]);
    cleanup();

    const collapsed = renderHeader({ groupedMessages, collapsedGroups: { Today: true } });
    expect(collapsed.view.getByRole("button", { name: "Expand all groups" })).toBeTruthy();
  });

  it("keeps the toggle for the sections an ungrouped list still renders", () => {
    const groupedMessages: MessageGroup[] = [
      { key: "Flagged", label: "Flagged", items: [syntheticMessage] },
      { key: "All", label: "All", items: [syntheticMessage] }
    ];
    const ungrouped = renderHeader({ groupedMessages, groupBy: "none" });
    expect(ungrouped.view.getByRole("button", { name: "Collapse all groups" })).toBeTruthy();
    expect(
      ungrouped.view.getByRole("button", { name: "Sort & group: Date, not grouped, threads on" })
    ).toBeTruthy();
    cleanup();

    const empty = renderHeader({ groupedMessages: [{ key: "Today", label: "Today", count: 0, items: [] }] });
    expect(empty.view.queryByRole("button", { name: /all groups/ })).toBeNull();
  });
});
