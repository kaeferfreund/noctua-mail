import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import RemoteContentBanner from "./RemoteContentBanner";
import { useRemoteContent } from "@/app/hooks/useRemoteContent";
import { I18nTestProvider } from "@/lib/i18n/testRender";

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
  cleanup();
});

function Banner() {
  const remote = useRemoteContent({ accountId: "acc-1", senderKey: "news@example.test", messageId: "msg-1" });
  return <RemoteContentBanner remote={remote} />;
}

function renderBanner() {
  render(<I18nTestProvider locale="de"><Banner /></I18nTestProvider>);
}

describe("RemoteContentBanner sender status", () => {
  it("shows a neutral checking state, not 'unknown sender', while the decision loads", async () => {
    let answer: (response: Response) => void = () => {};
    globalThis.fetch = (() => new Promise<Response>((resolve) => { answer = resolve; })) as unknown as typeof fetch;
    renderBanner();
    expect(screen.getByText("Absender wird geprüft …")).toBeTruthy();
    expect(screen.queryByText("Absender unbekannt")).toBeNull();
    answer(Response.json({ allowed: false, senderVerified: true }));
    await waitFor(() => expect(screen.queryByText("Absender wird geprüft …")).toBeNull());
    expect(screen.queryByText("Absender unbekannt")).toBeNull();
    expect((screen.getByRole("button", { name: /Immer|Absender/ }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("says nothing about the sender when the decision is unavailable", async () => {
    globalThis.fetch = (async () => new Response("", { status: 503 })) as unknown as typeof fetch;
    renderBanner();
    await waitFor(() => expect(screen.queryByText("Absender wird geprüft …")).toBeNull());
    expect(screen.queryByText("Absender unbekannt")).toBeNull();
    expect(screen.queryByText("Absender nicht bestätigt")).toBeNull();
  });

  it("names an unverified sender", async () => {
    globalThis.fetch = (async () => Response.json({ allowed: false, senderVerified: false })) as unknown as typeof fetch;
    renderBanner();
    await waitFor(() => expect(screen.getByText("Absender nicht bestätigt")).toBeTruthy());
  });
});
