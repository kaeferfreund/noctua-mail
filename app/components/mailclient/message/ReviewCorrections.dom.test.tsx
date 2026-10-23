import { afterEach, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import { RemoveAttachmentConfirmDialog } from "./AttachmentRemoval";
import ThreadTopicSuggestionsRow from "./ThreadTopicSuggestionsRow";
import FullSyncConfirmDialog from "./FullSyncConfirmDialog";
import ThreadMessageCard from "./ThreadMessageCard";
import MessageDisplayOptionsMenu from "./MessageDisplayOptionsMenu";
import { reviewReaderProps } from "@/tests/helpers/i18nSlice2b";

const originalWidth = window.innerWidth;
afterEach(() => { cleanup(); window.innerWidth = originalWidth; });
const noop = () => {};
for (const [locale, kind, name] of [
  ["de", "application/pdf", "Anhang entfernen"], ["de", "image/png", "Bild entfernen"],
  ["en", "application/pdf", "Remove attachment"], ["en", "image/png", "Remove image"]
] as const) test(`attachment removal action: ${locale} ${kind} is a complete message`, () => {
  window.innerWidth = 320;
  let removed = 0;
  const page = render(<I18nTestProvider locale={locale}><Theme><RemoveAttachmentConfirmDialog
    attachment={{ id: "synthetic-attachment", filename: "Synthetic.pdf", contentType: kind, size: 1024, inline: false }}
    removing={false} onCancel={noop} onConfirm={() => removed++} /></Theme></I18nTestProvider>);
  fireEvent.click(page.getByRole("button", { name }));
  expect(removed).toBe(1);
  expect(page.queryByText(/(?:Entfernen|Remove)(?:attachment|image)/)).toBeNull();
});

test("320 px German reader uses Neu for Recent and spaces the priority value beside long badges", () => {
  window.innerWidth = 320;
  const page = render(<I18nTestProvider locale="de"><Theme><ThreadMessageCard {...reviewReaderProps()} /></Theme></I18nTestProvider>);
  expect(page.getByText("Neu", { exact: true })).toBeTruthy();
  expect(page.getByText("Priorität: high", { exact: true })).toBeTruthy();
  expect(page.getByText(/Transaktions-E-Mails/)).toBeTruthy();
  expect(page.queryByText("Zuletzt verwendet")).toBeNull();
  expect(page.container.querySelector('[data-message-action="menu"]')).toBeTruthy();
});

test("German full-sync action and cancel remain separate actionable buttons", () => {
  window.innerWidth = 320;
  const calls: boolean[] = [];
  const page = render(<I18nTestProvider locale="de"><Theme><FullSyncConfirmDialog
    confirmState={{ accountId: "synthetic-review", scopeLabel: "Synthetic scope", mode: "full", reason: "Synthetic reason" }}
    onOpenChange={noop} resolveConfirm={value => calls.push(value)} /></Theme></I18nTestProvider>);
  expect(page.getByRole("button", { name: "Abbrechen" })).toBeTruthy();
  fireEvent.click(page.getByRole("button", { name: "Synchronisierung starten" }));
  expect(calls).toEqual([true]);
});

test("German display option percentages use locale spacing in the chip and action names", async () => {
  window.innerWidth = 320;
  const page = render(<I18nTestProvider locale="de"><Theme><MessageDisplayOptionsMenu
    formats={["text"]} format="text" defaultFormat="text" textScale={1.1} zoom={1}
    onFormatChange={noop} onAdjustTextScale={noop} onResetTextScale={noop} onAdjustZoom={noop} onResetZoom={noop}
  /></Theme></I18nTestProvider>);
  expect(page.container.textContent).toBe("Text 110\u00a0%");
  fireEvent.keyDown(page.getByRole("button"), { key: "Enter" });
  await page.findByRole("menu");
  expect(page.getAllByRole("menuitem").every(item => item.getAttribute("aria-label")?.includes("110\u00a0%"))).toBe(true);
});


test("German suggestion formulas separate colon labels and localize fractional thread scores", async () => {
  const topic: import("@/lib/data").Topic = { accountId: "synthetic-review", imapKeyword: "synthetic-topic", createdAt: 1, updatedAt: 1, id: "synthetic-topic", name: "Synthetic topic", color: "blue", suggestionScore: 1.5 };
  const signal = { type: "sender", value: "sender@example.test", weight: 1.5 };
  const page = render(<I18nTestProvider locale="de"><Theme><ThreadTopicSuggestionsRow
    threadId="synthetic-thread" hasAssignedTopics={false} suggestions={[topic]}
    explanationOpen explanationLoading={false} explanationError=""
    onExplanationOpenChange={noop} onLoadExplanation={noop} onToggleTopic={noop}
    explanation={{ signals: [signal], topics: [{ topic, suggestionScore: 1.5, matchCount: 1,
      matchedSignals: [signal], matchedThreads: [{ threadId: "synthetic-thread", score: 1.5, signals: [signal] }] }] }}
  /></Theme></I18nTestProvider>);
  await act(async () => {});
  for (const label of ["Je passendem früheren Thread:", "Je Thema:", "Signale:"]) {
    const element = page.getByText((_, node) => Boolean(node?.textContent?.startsWith(label) && node?.tagName === "SPAN"));
    expect(element.textContent).toStartWith(`${label} `);
  }
  expect(page.getByText("synthetic-thread: 1,5 (sender=sender@example.test) = 1,5")).toBeTruthy();
});
