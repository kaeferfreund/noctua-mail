import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, fireEvent, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import { render } from "@testing-library/react";
import type { Message } from "@/lib/data";
import SpamBadge, { SpamCorrectionButton, SpamCorrectionProvider } from "./SpamBadge";

afterEach(cleanup);
const message = (overrides: Partial<Message> = {}): Message => ({
  id: "synthetic-1", threadId: "t", accountId: "a", folderId: "a:INBOX", subject: "Gewinn", from: "x@example.test", to: "y@example.test",
  preview: "", date: "", dateValue: 0, body: "", spamVerdict: "spam", spamConfidence: 0.92, spamReasons: ["Gewinnversprechen", "Unbekannter Absender"], ...overrides
});
const wrap = (node: React.ReactNode) => render(<I18nTestProvider locale="de"><Theme>{node}</Theme></I18nTestProvider>);

describe("SpamBadge", () => {
  it("shows Verdächtig with the reasons on hover, and nothing for other verdicts", () => {
    const page = wrap(<><SpamBadge message={message()} /><SpamBadge message={message({ id: "2", spamVerdict: "unsure" })} /><SpamBadge message={message({ id: "3", spamVerdict: undefined })} /></>);
    const badges = page.container.querySelectorAll("[data-spam-badge]");
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe("Verdächtig");
    expect(badges[0].getAttribute("title")).toBe("Verdächtig: Gewinnversprechen · Unbekannter Absender");
  });

  it("explains the mark when the model gave no reasons", () => {
    const page = wrap(<SpamBadge message={message({ spamReasons: [] })} />);
    expect(page.getByLabelText("Von der Spam-Erkennung als verdächtig markiert")).toBeTruthy();
  });

  it("offers the correction only to managers and reports the message", async () => {
    const corrected: string[] = [];
    const markNotSuspicious = async (item: Message) => { corrected.push(item.id); };
    const viewer = wrap(<SpamCorrectionProvider value={{ canCorrect: false, markNotSuspicious }}><SpamCorrectionButton message={message()} /></SpamCorrectionProvider>);
    expect(viewer.queryByRole("button", { name: "Kein Spam" })).toBeNull();
    viewer.unmount();
    const noProvider = wrap(<SpamCorrectionButton message={message()} />);
    expect(noProvider.queryByRole("button")).toBeNull();
    noProvider.unmount();
    const manager = wrap(<SpamCorrectionProvider value={{ canCorrect: true, markNotSuspicious }}>
      <SpamCorrectionButton message={message()} /><SpamCorrectionButton message={message({ id: "ham", spamVerdict: "ham" })} />
    </SpamCorrectionProvider>);
    const buttons = manager.getAllByRole("button", { name: "Kein Spam" });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    await waitFor(() => expect(corrected).toEqual(["synthetic-1"]));
  });
});
