import { afterEach, describe, expect, it } from "bun:test";
import { useEffect } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { useApiErrorMessage } from "./useApiErrorMessage";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import type { UiLocale } from "@/lib/i18n/config";

afterEach(() => cleanup());

const noop = () => {};

async function resolveMessage(locale: UiLocale, response: Response) {
  let text: string | null = null;
  function Probe() {
    const readErrorMessage = useApiErrorMessage({ setAuthState: noop, setReloginAccountId: noop, setReloginDescription: noop });
    useEffect(() => {
      void readErrorMessage(response).then((value) => { text = value; });
    }, [readErrorMessage]);
    return null;
  }
  render(<I18nTestProvider locale={locale}><Probe /></I18nTestProvider>);
  await waitFor(() => expect(text).not.toBeNull());
  return text as unknown as string;
}

describe("useApiErrorMessage body limits", () => {
  it("shows a translated message for an oversized send, draft or settings body", async () => {
    const tooLarge = () => Response.json({ ok: false, message: "Request body too large", code: "request_body_too_large" }, { status: 413 });
    expect(await resolveMessage("de", tooLarge())).toContain("zu groß");
    cleanup();
    expect(await resolveMessage("en", tooLarge())).toContain("too large for the server");
  });

  it("translates a 413 without JSON and a body timeout", async () => {
    expect(await resolveMessage("de", new Response("Payload Too Large", { status: 413 }))).toContain("zu groß");
    cleanup();
    const timeout = Response.json({ ok: false, message: "Request body timed out", code: "request_body_timeout" }, { status: 408 });
    expect(await resolveMessage("de", timeout)).toBe("Die Übertragung hat zu lange gedauert. Bitte erneut versuchen.");
  });
});
