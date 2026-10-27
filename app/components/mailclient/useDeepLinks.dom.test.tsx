import { afterEach, beforeEach, expect, it, mock, spyOn } from "bun:test";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { useLayoutEffect, useRef, useState } from "react";
import { useDeepLinks, type DeepLinkTransaction } from "./useDeepLinks";
import { emptyDeepLink, parseDeepLink, type DeepLinkState } from "@/lib/navigation/deepLinks";
import type { MessageResolution } from "@/lib/navigation/resolveMessage";
import { useMobileOverlayHistory } from "@/app/hooks/useMobileOverlayHistory";
import type { Message } from "@/lib/data";
import { useMobileNavigation } from "@/app/hooks/useMobileNavigation";

type TestWindow = Window & { happyDOM: { setURL: (url: string) => void; waitUntilComplete: () => Promise<void> } };
beforeEach(() => {
  (window as unknown as TestWindow).happyDOM.setURL("http://localhost:4000/");
  // Start on an empty entry and discard Forward entries left by the previous case.
  // setURL alone preserves both history.state and the Forward stack.
  window.history.pushState(null, "", "/");
});
const restores: Array<() => void> = [];
afterEach(async () => {
  restores.splice(0).forEach(fn => fn());
  // Unmount may request Back for a sheet; finish its popstate/timers before the next case.
  await act(async () => {
    cleanup();
    await (window as unknown as TestWindow).happyDOM.waitUntilComplete();
  });
  window.history.replaceState(null, "", "/");
});
const message = { id: "imap-one", accountId: "a", folderId: "a:INBOX" } as Message;
function Harness({ switcher, resolver, resolution, expired, deferFolder = false, notice = () => {}, onTransaction, accountIds = ["a", "b"], onForbidden }: {
  /** Resolving to false: the switch did not commit, the controller kept the mailbox on screen. */
  switcher?: (id: string) => Promise<void | boolean>; resolver?: (account: string, id: string, signal: AbortSignal) => Promise<Message | null>;
  deferFolder?: boolean; accountIds?: string[]; onForbidden?: () => void;
  resolution?: () => Promise<MessageResolution>; expired?: () => void;
  notice?: (kind: string) => void; onTransaction?: (event: DeepLinkTransaction) => void;
}) {
  const [state, setState] = useState<DeepLinkState>({ ...emptyDeepLink(), accountId: "a", folderId: "a:INBOX" });
  const version = useRef(0);
  const [messages, setMessages] = useState([message, { ...message, id: "imap-two" }]);
  const [ready, setReady] = useState(true);
  const [authenticated, setAuthenticated] = useState(true);
  const [, rerender] = useState(0);
  const [overlay, setOverlay] = useState(false);
  useMobileOverlayHistory(overlay, () => setOverlay(false));
  const { navigateAccount, navigateMessage, queueFolderChoice } = useDeepLinks({ ready, authenticated, state, messages, accountIds, onForbidden,
    switchAccount: async id => { const epoch = ++version.current; const committed = await switcher?.(id); if (committed !== false && epoch === version.current) setState(old => ({ ...old, accountId: id })); },
    applyPlace: target => { const applied = { ...target, folderId: target.folderId || `${target.accountId}:INBOX`, messageId: "" }; if (deferFolder) { setState({ ...applied, folderId: "" }); setTimeout(() => setState(applied), 0); } else setState(applied); return applied; },
    onUnauthenticated: () => { setReady(false); setAuthenticated(false); expired?.(); },
    resolveMessage: resolution ?? (async (account, id, signal) => { const value = await (resolver ?? (async () => message))(account, id, signal); return value ? { status: "ready", message: value } : { status: "missing" }; }), openMessage: value => setState(old => ({ ...old, messageId: value.id })), notice, onTransaction });
  const { back } = useMobileNavigation(true, state.messageId || null, () => setState(old => ({ ...old, messageId: "" })), true);
  return <><output data-testid="state">{JSON.stringify(state)}</output>
    <button onClick={() => { setOverlay(false); void navigateAccount("b"); }}>Mailbox B</button><button onClick={() => navigateAccount("a")}>Mailbox A</button>
    <button onClick={() => setState(old => ({ ...old, messageId: "imap-one" }))}>Message</button>
    <button onClick={() => setState(old => ({ ...old, messageId: "imap-two" }))}>Next message</button>
    <button onClick={() => { setMessages(old => old.filter(item => item.id !== state.messageId)); setState(old => ({ ...old, messageId: "imap-two" })); }}>Remove message</button>
    <button onClick={() => navigateMessage("imap-one", "b")}>Notification</button>
    <button onClick={() => setState(old => ({ ...old, panel: "reminder", calendar: true }))}>Open panels</button>
    <button onClick={() => { navigateMessage("imap-one"); setState(old => ({ ...old, panel: null })); }}>Reminder entry</button>
    <button onClick={() => { setState(old => ({ ...old, folderId: `${old.accountId}:Sent` })); setOverlay(false); }}>Folder Sent</button>
    <button onClick={() => { if (!queueFolderChoice("b:Drafts")) setState(old => ({ ...old, folderId: "b:Drafts" })); }}>Destination drafts</button>
    <button onClick={() => setOverlay(true)}>Show overlay</button><output data-testid="overlay">{String(overlay)}</output>
    <button onClick={back}>Back</button><button onClick={() => setReady(value => !value)}>Ready</button>
    <button onClick={() => { setAuthenticated(false); setReady(false); }}>Expire</button>
    <button onClick={() => rerender(value => value + 1)}>Render</button>
    {/* The sign-in's bootstrap restores the server's mailbox selection, here A. */}
    <button onClick={() => { setState({ ...emptyDeepLink(), accountId: "a", folderId: "a:INBOX" }); setAuthenticated(true); setReady(true); }}>Sign in</button>
    <input aria-label="Search" onChange={event => setState(old => ({ ...old, query: event.target.value }))} />
  </>;
}
async function settled() { await waitFor(() => expect(window.history.state?.noctuaUrl).toBe(true)); }
async function pop(url: string) {
  act(() => { window.history.replaceState({ noctuaUrl: true }, "", url); window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state })); });
  await act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
}
it("restores initial RFC message, canonicalizes once, seeds list Back and preserves Next metadata", async () => {
  window.history.replaceState({ __NA: true }, "", "/?a=~a&m=~%3Cone%40example.test%3E");
  const resolver = mock(async () => message);
  const pushes = spyOn(window.history, "pushState"); restores.push(() => pushes.mockRestore());
  const page = render(<Harness resolver={resolver} />); await settled();
  await waitFor(() => expect(parseDeepLink(window.location.search).messageId).toBe("imap-one"));
  expect(resolver).toHaveBeenCalledTimes(1); expect(pushes).toHaveBeenCalledTimes(1);
  expect(window.history.state.__NA).toBe(true);
  const back = spyOn(window.history, "back").mockImplementation(() => {}); restores.push(() => back.mockRestore());
  fireEvent.click(page.getByText("Back")); expect(back).toHaveBeenCalledTimes(1);
  await pop("/?a=~a&f=INBOX");
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"messageId":""'));
});
it("writes user places once, replaces search typing and restores popstate without pushing", async () => {
  const page = render(<Harness />); await settled();
  const pushes = spyOn(window.history, "pushState"); restores.push(() => pushes.mockRestore());
  const replacements = spyOn(window.history, "replaceState"); restores.push(() => replacements.mockRestore());
  fireEvent.click(page.getByText("Message")); expect(pushes).toHaveBeenCalledTimes(1);
  fireEvent.change(page.getByRole("textbox"), { target: { value: "typed" } });
  expect(window.location.search).toContain("q=typed"); expect(pushes).toHaveBeenCalledTimes(1); expect(replacements).toHaveBeenCalledTimes(1);
  await pop("/?a=~b&f=INBOX");
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"accountId":"b"'));
  expect(pushes).toHaveBeenCalledTimes(1);
});
it("forbidden mailbox never resolves its message, missing messages finish on the folder", async () => {
  window.history.replaceState(null, "", "/?a=~secret&m=~private");
  const resolver = mock(async () => null); const notice = mock(() => {});
  render(<Harness resolver={resolver} notice={notice} />); await settled();
  expect(resolver).not.toHaveBeenCalled(); expect(notice).toHaveBeenCalledWith("forbidden");
  expect(window.location.search).not.toContain("secret");
  await pop("/?a=~a&f=INBOX&m=~deleted");
  await waitFor(() => expect(notice).toHaveBeenCalledWith("missing"));
  await waitFor(() => expect(parseDeepLink(window.location.search).messageId).toBe(""));
});
it("cancels stale message loads when Back arrives; last account navigation wins A → B → A", async () => {
  let finishMessage: (value: Message) => void = () => {};
  const resolver = mock((_a: string, _id: string, _signal: AbortSignal) => new Promise<Message>(resolve => { finishMessage = resolve; }));
  const page = render(<Harness resolver={resolver} />); await settled();
  await pop("/?a=~a&m=~imap-one");
  await waitFor(() => expect(resolver).toHaveBeenCalledTimes(1));
  const signal = resolver.mock.calls[0][2];
  await pop("/?a=~a");
  await act(async () => { finishMessage(message); });
  expect(signal.aborted).toBe(true);
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"messageId":""'));
  const switchCalls: string[] = []; let finishSwitch: () => void = () => {};
  cleanup();
  const next = render(<Harness switcher={id => { switchCalls.push(id); return id === "b" ? new Promise<void>(resolve => { finishSwitch = resolve; }) : Promise.resolve(); }} />);
  await settled(); await waitFor(() => expect(switchCalls).toContain("a"));
  fireEvent.click(next.getByText("Mailbox B")); await waitFor(() => expect(switchCalls).toContain("b"));
  await pop("/?a=~a"); await waitFor(() => expect(switchCalls.filter(id => id === "a").length).toBe(2));
  // The real account controller cancels the superseded switch; assert that URL
  // orchestration issued the cancelling reselect while B was still in flight.
  expect(parseDeepLink(window.location.search).accountId).toBe("a");
  await act(async () => { finishSwitch(); });
  await waitFor(() => expect(next.getByTestId("state").textContent).toContain('"accountId":"a"'));
  expect(parseDeepLink(window.location.search).accountId).not.toBe("b");
});

it("retains an expired-session destination until authentication resumes; network failure never reports missing", async () => {
  window.history.replaceState(null, "", "/?a=~a&m=~imap-one");
  const expired = mock(() => {}); const notice = mock(() => {});
  const result = mock<() => Promise<MessageResolution>>(async () => ({ status: "unauthenticated" }));
  const page = render(<Harness resolution={result} expired={expired} notice={notice} />);
  await waitFor(() => expect(expired).toHaveBeenCalledTimes(1));
  expect(parseDeepLink(window.location.search).messageId).toBe("imap-one"); expect(notice).not.toHaveBeenCalled();
  result.mockImplementation(async () => ({ status: "ready", message }));
  fireEvent.click(page.getByText("Ready")); await settled();
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"messageId":"imap-one"'));
  result.mockImplementation(async () => { throw new TypeError("offline"); });
  await pop("/?a=~a&m=~retry-message");
  await waitFor(() => expect(notice).toHaveBeenCalledWith("failed"));
  expect(notice).not.toHaveBeenCalledWith("missing");
  expect(parseDeepLink(window.location.search).messageId).toBe("retry-message");
});
it("reopens a notified message after a sign-in that restored another mailbox, waiting for the new switch", async () => {
  // The message read finds the session expired after the switch to B had finished.
  // The app renders while the switch after the sign-in still runs (its own state updates).
  let page: ReturnType<typeof render>;
  const switcher = mock((_id: string) => new Promise<void>(resolve => {
    setTimeout(() => fireEvent.click(page.getByText("Render")), 0);
    setTimeout(resolve, 20);
  }));
  const result = mock<() => Promise<MessageResolution>>(async () => ({ status: "unauthenticated" }));
  page = render(<Harness switcher={switcher} resolution={result} />); await settled();
  fireEvent.click(page.getByText("Notification"));
  await waitFor(() => expect(result).toHaveBeenCalledTimes(1));
  result.mockImplementation(async () => ({ status: "ready", message: { ...message, accountId: "b", folderId: "b:INBOX" } }));
  fireEvent.click(page.getByText("Sign in"));
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"messageId":"imap-one"'));
  expect(page.getByTestId("state").textContent).toContain('"accountId":"b"');
  expect(switcher.mock.calls.filter(([id]) => id === "b")).toHaveLength(2);
  await waitFor(() => expect(parseDeepLink(window.location.search)).toMatchObject({ accountId: "b", messageId: "imap-one" }));
});
it("keeps a notified message whose mailbox switch the expired session interrupted", async () => {
  let page: ReturnType<typeof render>;
  // First switch: the selection write gets 401, the app shows the sign-in, nothing commits.
  const switcher = mock(async (id: string) => {
    if (id !== "b") return true;
    fireEvent.click(page.getByText("Expire")); return false;
  });
  const resolver = mock(async (account: string) => ({ ...message, accountId: account, folderId: `${account}:INBOX` }));
  page = render(<Harness switcher={switcher} resolver={resolver} />); await settled();
  fireEvent.click(page.getByText("Notification"));
  await waitFor(() => expect(switcher).toHaveBeenCalledWith("b"));
  for (let i = 0; i < 3; i += 1) await act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
  expect(resolver).not.toHaveBeenCalled();
  switcher.mockImplementation(async () => true);
  fireEvent.click(page.getByText("Sign in"));
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"messageId":"imap-one"'));
  expect(page.getByTestId("state").textContent).toContain('"accountId":"b"');
  expect(resolver).toHaveBeenCalledTimes(1);
});
it("falls back to the mailbox on screen once when a switch is denied with a live session", async () => {
  const switcher = mock(async (id: string) => id !== "b");
  const resolver = mock(async () => message);
  const page = render(<Harness switcher={switcher} resolver={resolver} />); await settled();
  fireEvent.click(page.getByText("Notification"));
  await waitFor(() => expect(switcher).toHaveBeenCalledWith("b"));
  await waitFor(() => expect(parseDeepLink(window.location.search)).toMatchObject({ accountId: "a", messageId: "" }));
  for (let i = 0; i < 3; i += 1) await act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
  expect(switcher.mock.calls.filter(([id]) => id === "b")).toHaveLength(1); expect(resolver).not.toHaveBeenCalled();
  expect(page.getByTestId("state").textContent).toContain('"accountId":"a"');
});
it("shares the warm notification destination lifecycle, while transient overlays intercept Back before the reader", async () => {
  const page = render(<Harness resolver={async account => ({ ...message, accountId: account, folderId: `${account}:INBOX` })} />); await settled();
  fireEvent.click(page.getByText("Notification"));
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"accountId":"b"'));
  await waitFor(() => expect(parseDeepLink(window.location.search).messageId).toBe("imap-one"));
  fireEvent.click(page.getByText("Show overlay")); expect(page.getByTestId("overlay").textContent).toBe("true");
  await pop("/?a=~b&f=INBOX&m=~imap-one");
  expect(page.getByTestId("overlay").textContent).toBe("false");
  expect(page.getByTestId("state").textContent).toContain('"messageId":"imap-one"');
  await pop("/?a=~b&f=INBOX");
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"messageId":""'));
});

it("uses exactly one account entry followed by one message entry across real Back/Forward", async () => {
  const page = render(<Harness resolver={async account => ({ ...message, accountId: account })} />); await settled();
  const pushes = spyOn(window.history, "pushState"); restores.push(() => pushes.mockRestore());
  fireEvent.click(page.getByText("Mailbox B"));
  await waitFor(() => expect(parseDeepLink(window.location.search).folderId).toBe("b:INBOX"));
  expect(pushes).toHaveBeenCalledTimes(1);
  fireEvent.click(page.getByText("Message")); expect(pushes).toHaveBeenCalledTimes(2);
  act(() => window.history.back());
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"messageId":""'));
  act(() => window.history.back());
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"accountId":"a"'));
  expect(pushes).toHaveBeenCalledTimes(2);
  act(() => window.history.forward());
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"accountId":"b"'));
  act(() => window.history.forward());
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"messageId":"imap-one"'));
  expect(pushes).toHaveBeenCalledTimes(2);
});

it("waits for all adapter state slices before canonicalizing a mailbox switch", async () => {
  const page = render(<Harness deferFolder />); await settled();
  const pushes = spyOn(window.history, "pushState"); restores.push(() => pushes.mockRestore());
  fireEvent.click(page.getByText("Mailbox B"));
  await waitFor(() => expect(parseDeepLink(window.location.search).folderId).toBe("b:INBOX"));
  expect(pushes).toHaveBeenCalledTimes(1);
  act(() => window.history.back());
  await waitFor(() => expect(parseDeepLink(window.location.search).accountId).toBe("a"));
  expect(pushes).toHaveBeenCalledTimes(1);
});

it("replaces a removed reader with its continuation so Back returns to the original list", async () => {
  const page = render(<Harness />); await settled();
  const pushes = spyOn(window.history, "pushState"); restores.push(() => pushes.mockRestore());
  fireEvent.click(page.getByText("Message"));
  expect(pushes).toHaveBeenCalledTimes(1);
  fireEvent.click(page.getByText("Remove message"));
  expect(parseDeepLink(window.location.search).messageId).toBe("imap-two");
  expect(pushes).toHaveBeenCalledTimes(1);
  act(() => window.history.back());
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"messageId":""'));
  expect(parseDeepLink(window.location.search).folderId).toBe("a:INBOX");
});

it("publishes a folder picked in a sheet after its own Back has settled", async () => {
  const page = render(<Harness />); await settled();
  fireEvent.click(page.getByText("Show overlay"));
  fireEvent.click(page.getByText("Folder Sent"));
  await waitFor(() => expect(parseDeepLink(window.location.search).folderId).toBe("a:Sent"));
  expect(page.getByTestId("state").textContent).toContain('"folderId":"a:Sent"');
});

it("settles a mailbox picked while its sidebar sheet closes with Back, without a duplicate Forward entry", async () => {
  const page = render(<Harness />); await settled();
  const entries = window.history.length;
  fireEvent.click(page.getByText("Show overlay"));
  fireEvent.click(page.getByText("Mailbox B"));
  await waitFor(() => expect(parseDeepLink(window.location.search).folderId).toBe("b:INBOX"));
  expect(page.getByTestId("state").textContent).toContain('"accountId":"b"');
  // The sheet's entry was stepped back off and replaced by B: list A, then B.
  expect(window.history.length).toBe(entries + 1);
  expect(window.history.state.noctuaMobileOverlay).toBeUndefined();
  act(() => window.history.back());
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"accountId":"a"'));
  act(() => window.history.forward());
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"accountId":"b"'));
});

it.each(["window", "document", "body", "input"] as const)("tracks navigation keys from %s without replacing history for typed input", async target => {
  const page = render(<Harness />); await settled();
  fireEvent.click(page.getByText("Message"));
  const pushes = spyOn(window.history, "pushState"); restores.push(() => pushes.mockRestore());
  const replacements = spyOn(window.history, "replaceState"); restores.push(() => replacements.mockRestore());
  const eventTarget = target === "window" ? window : target === "document" ? document : target === "body" ? document.body : page.getByRole("textbox");
  fireEvent.keyDown(eventTarget, { key: "j" });
  // Simulate the reader's subsequent selection without a pointerdown resetting the keyboard flag.
  fireEvent.click(page.getByText("Next message"));
  expect(parseDeepLink(window.location.search).messageId).toBe("imap-two");
  expect(pushes).toHaveBeenCalledTimes(target === "input" ? 1 : 0);
  expect(replacements).toHaveBeenCalledTimes(target === "input" ? 0 : 1);
});
it("gives each pushed entry its own id, keeps it on replace and reports transaction origins", async () => {
  const events: DeepLinkTransaction[] = [];
  const page = render(<Harness onTransaction={event => events.push(event)}
    resolver={async account => ({ ...message, accountId: account, folderId: `${account}:INBOX` })} />); await settled();
  await waitFor(() => expect(events.at(-1)).toEqual({ phase: "settled", origin: "initial", messageId: "" }));
  const list = window.history.state.noctuaEntry;
  expect(typeof list).toBe("string");
  fireEvent.click(page.getByText("Message"));
  const reader = window.history.state.noctuaEntry;
  expect(reader).not.toBe(list);
  fireEvent.change(page.getByRole("textbox"), { target: { value: "typed" } });
  expect(window.location.search).toContain("q=typed");
  expect(window.history.state.noctuaEntry).toBe(reader);
  events.length = 0;
  act(() => { window.history.replaceState({ noctuaUrl: true, noctuaEntry: list }, "", "/?a=~a&f=INBOX"); window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state })); });
  await waitFor(() => expect(events.at(-1)?.phase).toBe("settled"));
  expect(events).toEqual([{ phase: "start", origin: "history", messageId: "" }, { phase: "settled", origin: "history", messageId: "" }]);
  expect(window.history.state.noctuaEntry).toBe(list);
  events.length = 0;
  fireEvent.click(page.getByText("Notification"));
  await waitFor(() => expect(events.at(-1)).toEqual({ phase: "settled", origin: "link", messageId: "imap-one" }));
  expect(events[0]).toEqual({ phase: "start", origin: "link", messageId: "imap-one" });
});

it("keeps the calendar sidebar for a message opened from a reminder, while the reminder popover closes itself", async () => {
  const page = render(<Harness />); await settled();
  fireEvent.click(page.getByText("Open panels"));
  await waitFor(() => expect(parseDeepLink(window.location.search).calendar).toBe(true));
  fireEvent.click(page.getByText("Reminder entry"));
  await waitFor(() => expect(parseDeepLink(window.location.search).messageId).toBe("imap-one"));
  const state = JSON.parse(page.getByTestId("state").textContent ?? "{}") as DeepLinkState;
  expect(state.calendar).toBe(true);
  expect(state.panel).toBeNull();
});
it("arrow keys scroll and never make a later selection change replace history", async () => {
  const page = render(<Harness />); await settled();
  fireEvent.click(page.getByText("Message"));
  const pushes = spyOn(window.history, "pushState"); restores.push(() => pushes.mockRestore());
  fireEvent.keyDown(document.body, { key: "ArrowDown" });
  fireEvent.click(page.getByText("Next message"));
  expect(parseDeepLink(window.location.search).messageId).toBe("imap-two");
  expect(pushes).toHaveBeenCalledTimes(1);
});
it("finishes a link once when the mailbox on screen is revoked too, and leaves the selection to the bootstrap", async () => {
  let finishMessage: (value: Message) => void = () => {};
  const notice = mock(() => {}); const onForbidden = mock(() => {});
  const page = render(<Harness notice={notice} onForbidden={onForbidden}
    resolver={() => new Promise<Message>(resolve => { finishMessage = resolve; })} />); await settled();
  await pop("/?a=~b&m=~imap-one");
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"accountId":"b"'));
  // An access refresh revokes both the destination and the mailbox on screen.
  page.rerender(<Harness notice={notice} onForbidden={onForbidden} accountIds={[]}
    resolver={() => new Promise<Message>(resolve => { finishMessage = resolve; })} />);
  for (let i = 0; i < 5; i += 1) await act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
  await act(async () => { finishMessage(message); });
  expect(notice).toHaveBeenCalledTimes(1);
  expect(notice).toHaveBeenCalledWith("forbidden");
  expect(onForbidden).toHaveBeenCalledTimes(1);
  expect(page.getByTestId("state").textContent).toContain('"messageId":""');
});
it("leaves the switching phase only in a render that carries the switch's commit", async () => {
  // Chromium: a render of mailbox A commits, the switch response arrives before that
  // render's passive effects are flushed, and the switch commits B and resolves. The
  // late effect still sees A and must not read it as the controller's fallback.
  window.history.replaceState(null, "", "/?a=~b");
  function LateEffectHarness() {
    const [state, setState] = useState<DeepLinkState>({ ...emptyDeepLink(), accountId: "a", folderId: "a:INBOX" });
    const [tick, setTick] = useState(0);
    const respond = useRef<() => void>(() => {});
    useLayoutEffect(() => { if (tick === 1) respond.current(); }, [tick]);
    useDeepLinks({ ready: true, authenticated: true, state, messages: [], accountIds: ["a", "b"],
      switchAccount: id => new Promise<void>(resolve => {
        respond.current = () => { void Promise.resolve().then(() => { setState(old => ({ ...old, accountId: id })); resolve(); }); };
        setTimeout(() => setTick(1), 0);
      }),
      applyPlace: target => { const applied = { ...target, folderId: target.folderId || `${target.accountId}:INBOX`, messageId: "" }; setState(applied); return applied; },
      resolveMessage: async () => ({ status: "missing" }), openMessage: () => {}, notice: () => {} });
    return <output data-testid="state">{JSON.stringify(state)}</output>;
  }
  const page = render(<LateEffectHarness />); await settled();
  expect(new URLSearchParams(window.location.search).get("a")).toBe("~b");
  expect(new URLSearchParams(window.location.search).get("f")).toBe("INBOX");
  expect(page.getByTestId("state").textContent).toContain('"folderId":"b:INBOX"');
});

it("keeps the last folder choice made while a mailbox switch is pending", async () => {
  let finish = () => {};
  const switcher = (id: string) => id === "b" ? new Promise<void>(resolve => { finish = resolve; }) : Promise.resolve();
  const page = render(<Harness switcher={switcher} />);
  await settled();
  fireEvent.click(page.getByText("Mailbox B"));
  fireEvent.click(page.getByText("Destination drafts"));
  await act(async () => { finish(); });
  await waitFor(() => expect(parseDeepLink(window.location.search).folderId).toBe("b:Drafts"));
  expect(JSON.parse(page.getByTestId("state").textContent!).accountId).toBe("b");
});
