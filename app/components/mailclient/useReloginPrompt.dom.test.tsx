import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useReloginPrompt } from "./useReloginPrompt";

afterEach(() => cleanup());

describe("useReloginPrompt", () => {
  it("opens for a mailbox whose request asked for credentials", () => {
    const { result } = renderHook(useReloginPrompt);
    act(() => result.current.requestRelogin("acc-1"));
    expect(result.current.reloginAccountId).toBe("acc-1");
  });

  it("stays closed after Cancel while requests keep failing", () => {
    const { result } = renderHook(useReloginPrompt);
    act(() => result.current.requestRelogin("acc-1"));
    act(() => result.current.dismissRelogin());
    expect(result.current.reloginAccountId).toBe("");
    act(() => result.current.requestRelogin("acc-1"));
    act(() => result.current.requestRelogin("acc-1"));
    expect(result.current.reloginAccountId).toBe("");
  });

  it("still prompts for other mailboxes after a cancel", () => {
    const { result } = renderHook(useReloginPrompt);
    act(() => result.current.requestRelogin("acc-1"));
    act(() => result.current.dismissRelogin());
    act(() => result.current.requestRelogin("acc-2"));
    expect(result.current.reloginAccountId).toBe("acc-2");
  });

  it("opens on the person's own request after a cancel and prompts again from then on", () => {
    const { result } = renderHook(useReloginPrompt);
    act(() => result.current.requestRelogin("acc-1"));
    act(() => result.current.dismissRelogin());
    act(() => result.current.openRelogin("acc-1"));
    expect(result.current.reloginAccountId).toBe("acc-1");
    act(() => result.current.completeRelogin("acc-1"));
    act(() => result.current.requestRelogin("acc-1"));
    expect(result.current.reloginAccountId).toBe("acc-1");
  });

  it("does not treat the close after a successful re-login as a cancel", () => {
    const { result } = renderHook(useReloginPrompt);
    act(() => result.current.requestRelogin("acc-1"));
    act(() => {
      // AccountReloginDialog reports its own closing right after `onSuccess`.
      result.current.completeRelogin("acc-1");
      result.current.dismissRelogin();
    });
    expect(result.current.reloginAccountId).toBe("");
    act(() => result.current.requestRelogin("acc-1"));
    expect(result.current.reloginAccountId).toBe("acc-1");
  });

  it("closes only the named mailbox's dialog when that mailbox cannot be repaired, without a cancel", () => {
    const { result } = renderHook(useReloginPrompt);
    act(() => result.current.requestRelogin("acc-1"));
    act(() => result.current.closeRelogin("acc-2"));
    expect(result.current.reloginAccountId).toBe("acc-1");
    act(() => result.current.closeRelogin("acc-1"));
    expect(result.current.reloginAccountId).toBe("");
    act(() => result.current.requestRelogin("acc-1"));
    expect(result.current.reloginAccountId).toBe("acc-1");
  });

  it("forgets a cancel when another person signs in", () => {
    const { result } = renderHook(useReloginPrompt);
    act(() => result.current.requestRelogin("acc-1"));
    act(() => result.current.dismissRelogin());
    act(() => result.current.resetRelogin());
    act(() => result.current.requestRelogin("acc-1"));
    expect(result.current.reloginAccountId).toBe("acc-1");
  });
});
