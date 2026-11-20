import { afterEach, describe, expect, it } from "bun:test";
import { useEffect } from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import { useApiErrorMessage } from "./useApiErrorMessage";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import type { UiLocale } from "@/lib/i18n/config";

afterEach(() => cleanup());

const noop = () => {};

async function resolveMessage(locale: UiLocale, response: Response, relogin: { requestRelogin?: (accountId: string) => void; closeRelogin?: (accountId: string) => void } = {}) {
  let text: string | null = null;
  const { requestRelogin = noop, closeRelogin = noop } = relogin;
  function Probe() {
    const readErrorMessage = useApiErrorMessage({ setAuthState: noop, requestRelogin, closeRelogin, setReloginDescription: noop });
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

describe("useApiErrorMessage mailbox repair", () => {
  it("asks the relogin prompt instead of opening the dialog itself for a manager", async () => {
    const calls: string[] = [];
    const failure = Response.json({ ok: false, code: "mailbox_credentials_invalid", accountId: "synthetic-a", repairAllowed: true, reauthRequired: true }, { status: 503 });
    expect(await resolveMessage("en", failure, { requestRelogin: id => calls.push(`request:${id}`), closeRelogin: id => calls.push(`close:${id}`) })).toBe("Mailbox credentials need repair.");
    expect(calls).toEqual(["request:synthetic-a"]);
  });

  it("closes only that mailbox's dialog when the person cannot repair it", async () => {
    const calls: string[] = [];
    const failure = Response.json({ ok: false, code: "mailbox_credentials_invalid", accountId: "synthetic-b", repairAllowed: false }, { status: 503 });
    expect(await resolveMessage("en", failure, { requestRelogin: id => calls.push(`request:${id}`), closeRelogin: id => calls.push(`close:${id}`) })).toBe("Mailbox unavailable; contact a manager.");
    expect(calls).toEqual(["close:synthetic-b"]);
  });

  it("leaves the dialog alone for an outage, which is no credentials problem", async () => {
    const calls: string[] = [];
    const outage = Response.json({ ok: false, message: "Could not reach the mail server. It may be temporarily unavailable." }, { status: 503 });
    expect(await resolveMessage("en", outage, { requestRelogin: id => calls.push(`request:${id}`), closeRelogin: id => calls.push(`close:${id}`) })).toContain("Could not reach the mail server");
    expect(calls).toEqual([]);
  });
});
