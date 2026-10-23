// SPIKE ONLY (outside git, .tmp/). Counts /prefs fetches and sanitize calls per thread open.
import { afterEach, expect, test } from "bun:test";
import { act, cleanup, fireEvent } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { render } from "@/lib/i18n/testRender";
import ThreadView from "@/app/components/mailclient/message/ThreadView";
import { reviewReaderProps, syntheticReviewMessage } from "@/tests/helpers/i18nSlice2b";
import type { Message } from "@/lib/data";

const originalFetch = globalThis.fetch;
afterEach(() => { cleanup(); globalThis.fetch = originalFetch; });
const html = '<p>Hello</p><img src="https://images.example.test/photo.png"><img src="cid:logo">';
const thread: Message[] = [0, 1, 2, 3].map((i) => ({
  ...syntheticReviewMessage, id: `m${i}`, htmlBody: html, body: undefined, preview: "x", senderKey: `sender${i % 2}@example.test`,
  dateValue: syntheticReviewMessage.dateValue! + i
}));
const counter = () => (globalThis as { __spikeSanitize?: { block: number; allow: number } }).__spikeSanitize ??= { block: 0, allow: 0 };

test("prefs fetches and sanitize passes per thread open", async () => {
  const gets: string[] = []; let puts = 0;
  globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
    if (init?.method === "PUT") puts++; else gets.push(String(url));
    return Response.json({ prefs: {} });
  }) as typeof fetch;
  const { message: _ignored, ...card } = reviewReaderProps();
  const view = (collapsed: Record<string, boolean>, active = thread[3]) => (
    <Theme><ThreadView showComposeInline={false} activeMessage={active} activeThread={thread} supportsThreads
      threadContentById={{ [syntheticReviewMessage.threadId!]: thread }} threadContentLoading={null} threadContentErrorById={{}}
      messageCardProps={{ ...card, hasHtmlContent: () => true, collapsedMessages: collapsed, threadViewMode: "full" }}
      composeDraftId={null} composeReplyMessageId={null} renderComposeInlineCard={null} /></Theme>);
  const c = counter(); c.block = 0; c.allow = 0;
  const log: Record<string, unknown> = {};
  let page!: ReturnType<typeof render>;
  // 1st commit of a thread open: collapse map not yet written (the orchestrator
  // effect that collapses siblings runs after the children have rendered).
  await act(async () => { page = render(view({}), { locale: "en" } as never); });
  console.log("SPIKE-DEBUG", page.container.innerHTML.length, (page.container.innerHTML.match(/HTML message|iframe|Synthetic review body|Hello|Remote content/g) ?? []).join(","), page.container.innerHTML.slice(page.container.innerHTML.indexOf("Collapsible") , 0));
  log.firstCommit = { frames: page.container.querySelectorAll("iframe").length, prefsGets: gets.length, sanitize: { ...c } };
  // Orchestrator effect applied: only the selected message stays expanded.
  const collapsed = { m0: true, m1: true, m2: true, m3: false };
  await act(async () => { page.rerender(view(collapsed)); });
  log.afterCollapse = { frames: page.container.querySelectorAll("iframe").length, prefsGets: gets.length, sanitize: { ...c } };
  // Re-render with unrelated prop change (zoom/theme style): no new sanitize expected.
  await act(async () => { page.rerender(view({ ...collapsed })); });
  log.afterRerender = { prefsGets: gets.length, sanitize: { ...c } };
  // Expand a sibling: another HtmlMessage mounts.
  await act(async () => { page.rerender(view({ ...collapsed, m1: false })); });
  log.afterExpandSibling = { frames: page.container.querySelectorAll("iframe").length, prefsGets: gets.length, sanitize: { ...c } };
  console.log("SPIKE-PARTIAL " + JSON.stringify(log), JSON.stringify([...page.container.querySelectorAll("button")].map((b) => b.getAttribute("aria-label") ?? b.textContent)));
  // Toggle: Load once on the first visible viewer.
  await act(async () => { fireEvent.click(page.getAllByRole("button", { name: "Load once" })[0]); });
  log.afterLoadOnce = { prefsGets: gets.length, puts, sanitize: { ...c } };
  // Toggle: Always allow on the other visible viewer → PUT + PREFERENCES_CHANGED to every mounted viewer.
  const always = page.getAllByRole("button", { name: "Always load from this sender" });
  await act(async () => { fireEvent.click(always[always.length - 1]); });
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
  log.afterAlwaysAllow = { prefsGets: gets.length, puts, sanitize: { ...c } };
  console.log("SPIKE-RESULT " + JSON.stringify(log));
  expect(gets.every((u) => u.endsWith("/prefs"))).toBe(true);
});
