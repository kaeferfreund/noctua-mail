import { afterEach, expect, test } from "bun:test";
import { act, cleanup, render } from "@testing-library/react";
import { refreshOutreachStatus, resetOutreachStatusForTests, useOutreachStatus } from "./useOutreachStatus";

/** Review fix AP: an older, slower status answer never overwrites a newer one (synthetic data only). */

const originalFetch = globalThis.fetch;
afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  resetOutreachStatusForTests();
});

const answer = (enabled: boolean) => Response.json({ ok: true, available: true, accounts: [{ accountId: "mailbox-a", enabled, trackMailDefault: false }], sesConfigured: true, trackingConfigured: true });

function Probe() {
  const status = useOutreachStatus();
  return <p data-testid="status">{status.loaded ? status.accounts.map(account => `${account.accountId}:${account.enabled}`).join(",") || "off" : "loading"}</p>;
}

test("AP: the newest status request wins over an older one that answers later", async () => {
  const pending: ((response: Response) => void)[] = [];
  globalThis.fetch = (() => new Promise<Response>(resolve => { pending.push(resolve); })) as unknown as typeof fetch;
  resetOutreachStatusForTests();
  const page = render(<Probe />);
  // The page's first request is still in flight when the settings save asks again.
  expect(pending.length).toBe(1);
  const second = refreshOutreachStatus();
  expect(pending.length).toBe(2);
  await act(async () => { pending[1](answer(true)); await second; });
  expect(page.getByTestId("status").textContent).toBe("mailbox-a:true");
  await act(async () => { pending[0](answer(false)); await new Promise(resolve => setTimeout(resolve, 10)); });
  expect(page.getByTestId("status").textContent).toBe("mailbox-a:true");
});

test("AP: a failing older request does not turn a newer answer off", async () => {
  const pending: { resolve: (response: Response) => void; reject: (error: unknown) => void }[] = [];
  globalThis.fetch = (() => new Promise<Response>((resolve, reject) => { pending.push({ resolve, reject }); })) as unknown as typeof fetch;
  resetOutreachStatusForTests();
  const page = render(<Probe />);
  const second = refreshOutreachStatus();
  await act(async () => { pending[1].resolve(answer(true)); await second; });
  await act(async () => { pending[0].reject(new TypeError("offline")); await new Promise(resolve => setTimeout(resolve, 10)); });
  expect(page.getByTestId("status").textContent).toBe("mailbox-a:true");
});
