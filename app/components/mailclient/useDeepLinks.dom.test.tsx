import { afterEach, beforeEach, expect, it, mock, spyOn } from "bun:test";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { useDeepLinks } from "./useDeepLinks";
import { emptyDeepLink, type DeepLinkState } from "@/lib/navigation/deepLinks";
import type { MessageResolution } from "@/lib/navigation/resolveMessage";
import { useMobileOverlayHistory } from "@/app/hooks/useMobileOverlayHistory";
import type { Message } from "@/lib/data";
import { useMobileNavigation } from "@/app/hooks/useMobileNavigation";

beforeEach(() => { (window as unknown as { happyDOM: { setURL: (url: string) => void } }).happyDOM.setURL("http://localhost:4000/"); });
const restores: Array<() => void> = [];
afterEach(() => { cleanup(); restores.splice(0).forEach(fn => fn()); window.history.replaceState(null, "", "/"); });
const message = { id: "imap-one", accountId: "a", folderId: "a:INBOX" } as Message;
function Harness({ switcher, resolver, resolution, expired, deferFolder = false, notice = () => {} }: {
  switcher?: (id: string) => Promise<void>; resolver?: (account: string, id: string, signal: AbortSignal) => Promise<Message | null>;
  deferFolder?: boolean;
  resolution?: () => Promise<MessageResolution>; expired?: () => void;
  notice?: (kind: string) => void;
}) {
  const [state, setState] = useState<DeepLinkState>({ ...emptyDeepLink(), accountId: "a", folderId: "a:INBOX" });
  const version = useRef(0);
  const [messages, setMessages] = useState([message, { ...message, id: "imap-two" }]);
  const [ready, setReady] = useState(true);
  const [overlay, setOverlay] = useState(false);
  useMobileOverlayHistory(overlay, () => setOverlay(false));
  const { navigateAccount, navigateMessage } = useDeepLinks({ ready, state, messages, accountIds: ["a", "b"],
    switchAccount: async id => { const epoch = ++version.current; await switcher?.(id); if (epoch === version.current) setState(old => ({ ...old, accountId: id })); },
    applyPlace: target => { const applied = { ...target, folderId: target.folderId || `${target.accountId}:INBOX`, messageId: "" }; if (deferFolder) { setState({ ...applied, folderId: "" }); setTimeout(() => setState(applied), 0); } else setState(applied); return applied; },
    onUnauthenticated: () => { setReady(false); expired?.(); },
    resolveMessage: resolution ?? (async (account, id, signal) => { const value = await (resolver ?? (async () => message))(account, id, signal); return value ? { status: "ready", message: value } : { status: "missing" }; }), openMessage: value => setState(old => ({ ...old, messageId: value.id })), notice });
  const { back } = useMobileNavigation(true, state.messageId || null, () => setState(old => ({ ...old, messageId: "" })), true);
  return <><output data-testid="state">{JSON.stringify(state)}</output>
    <button onClick={() => { setOverlay(false); void navigateAccount("b"); }}>Mailbox B</button><button onClick={() => navigateAccount("a")}>Mailbox A</button>
    <button onClick={() => setState(old => ({ ...old, messageId: "imap-one" }))}>Message</button>
    <button onClick={() => { setMessages(old => old.filter(item => item.id !== state.messageId)); setState(old => ({ ...old, messageId: "imap-two" })); }}>Remove message</button>
    <button onClick={() => navigateMessage("imap-one", "b")}>Notification</button>
    <button onClick={() => { setState(old => ({ ...old, folderId: `${old.accountId}:Sent` })); setOverlay(false); }}>Folder Sent</button>
    <button onClick={() => setOverlay(true)}>Show overlay</button><output data-testid="overlay">{String(overlay)}</output>
    <button onClick={back}>Back</button><button onClick={() => setReady(value => !value)}>Ready</button>
    <input aria-label="Search" onChange={event => setState(old => ({ ...old, query: event.target.value }))} />
  </>;
}
async function settled() { await waitFor(() => expect(window.history.state?.noctuaUrl).toBe(true)); }
async function pop(url: string) {
  act(() => { window.history.replaceState({ noctuaUrl: true }, "", url); window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state })); });
  await act(() => new Promise<void>(resolve => setTimeout(resolve, 0)));
}
it("restores initial legacy message, canonicalizes once, seeds list Back and preserves Next metadata", async () => {
  window.history.replaceState({ __NA: true }, "", "/?accountId=a&messageId=%3Cone%40example.test%3E");
  const resolver = mock(async () => message);
  const pushes = spyOn(window.history, "pushState"); restores.push(() => pushes.mockRestore());
  const page = render(<Harness resolver={resolver} />); await settled();
  await waitFor(() => expect(window.location.search).toContain("openMessageId=imap-one"));
  expect(resolver).toHaveBeenCalledTimes(1); expect(pushes).toHaveBeenCalledTimes(1);
  expect(window.history.state.__NA).toBe(true);
  const back = spyOn(window.history, "back").mockImplementation(() => {}); restores.push(() => back.mockRestore());
  fireEvent.click(page.getByText("Back")); expect(back).toHaveBeenCalledTimes(1);
  await pop("/?accountId=a&folderId=a%3AINBOX");
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"messageId":""'));
});
it("writes user places once, replaces search typing and restores popstate without pushing", async () => {
  const page = render(<Harness />); await settled();
  const pushes = spyOn(window.history, "pushState"); restores.push(() => pushes.mockRestore());
  const replacements = spyOn(window.history, "replaceState"); restores.push(() => replacements.mockRestore());
  fireEvent.click(page.getByText("Message")); expect(pushes).toHaveBeenCalledTimes(1);
  fireEvent.change(page.getByRole("textbox"), { target: { value: "typed" } });
  expect(window.location.search).toContain("q=typed"); expect(pushes).toHaveBeenCalledTimes(1); expect(replacements).toHaveBeenCalledTimes(1);
  await pop("/?accountId=b&folderId=b%3AINBOX");
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"accountId":"b"'));
  expect(pushes).toHaveBeenCalledTimes(1);
});
it("forbidden mailbox never resolves its message, missing messages finish on the folder", async () => {
  window.history.replaceState(null, "", "/?accountId=secret&openMessageId=private");
  const resolver = mock(async () => null); const notice = mock(() => {});
  render(<Harness resolver={resolver} notice={notice} />); await settled();
  expect(resolver).not.toHaveBeenCalled(); expect(notice).toHaveBeenCalledWith("forbidden");
  expect(window.location.search).not.toContain("secret");
  await pop("/?accountId=a&folderId=a%3AINBOX&openMessageId=deleted");
  await waitFor(() => expect(notice).toHaveBeenCalledWith("missing"));
  await waitFor(() => expect(window.location.search).not.toContain("openMessageId"));
});
it("cancels stale message loads when Back arrives; last account navigation wins A → B → A", async () => {
  let finishMessage: (value: Message) => void = () => {};
  const resolver = mock((_a: string, _id: string, _signal: AbortSignal) => new Promise<Message>(resolve => { finishMessage = resolve; }));
  const page = render(<Harness resolver={resolver} />); await settled();
  await pop("/?accountId=a&openMessageId=imap-one");
  await waitFor(() => expect(resolver).toHaveBeenCalledTimes(1));
  const signal = resolver.mock.calls[0][2];
  await pop("/?accountId=a");
  await act(async () => { finishMessage(message); });
  expect(signal.aborted).toBe(true);
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"messageId":""'));
  const switchCalls: string[] = []; let finishSwitch: () => void = () => {};
  cleanup();
  const next = render(<Harness switcher={id => { switchCalls.push(id); return id === "b" ? new Promise<void>(resolve => { finishSwitch = resolve; }) : Promise.resolve(); }} />);
  await settled(); await waitFor(() => expect(switchCalls).toContain("a"));
  fireEvent.click(next.getByText("Mailbox B")); await waitFor(() => expect(switchCalls).toContain("b"));
  await pop("/?accountId=a"); await waitFor(() => expect(switchCalls.filter(id => id === "a").length).toBe(2));
  // The real account controller cancels the superseded switch; assert that URL
  // orchestration issued the cancelling reselect while B was still in flight.
  expect(new URLSearchParams(window.location.search).get("accountId")).toBe("a");
  await act(async () => { finishSwitch(); });
  await waitFor(() => expect(next.getByTestId("state").textContent).toContain('"accountId":"a"'));
  expect(window.location.search).not.toContain("accountId=b");
});

it("retains an expired-session destination until authentication resumes; network failure never reports missing", async () => {
  window.history.replaceState(null, "", "/?accountId=a&openMessageId=imap-one");
  const expired = mock(() => {}); const notice = mock(() => {});
  const result = mock<() => Promise<MessageResolution>>(async () => ({ status: "unauthenticated" }));
  const page = render(<Harness resolution={result} expired={expired} notice={notice} />);
  await waitFor(() => expect(expired).toHaveBeenCalledTimes(1));
  expect(window.location.search).toContain("openMessageId=imap-one"); expect(notice).not.toHaveBeenCalled();
  result.mockImplementation(async () => ({ status: "ready", message }));
  fireEvent.click(page.getByText("Ready")); await settled();
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"messageId":"imap-one"'));
  result.mockImplementation(async () => { throw new TypeError("offline"); });
  await pop("/?accountId=a&openMessageId=retry-message");
  await waitFor(() => expect(notice).toHaveBeenCalledWith("failed"));
  expect(notice).not.toHaveBeenCalledWith("missing");
  expect(window.location.search).toContain("openMessageId=retry-message");
});
it("shares the warm notification destination lifecycle, while transient overlays intercept Back before the reader", async () => {
  const page = render(<Harness resolver={async account => ({ ...message, accountId: account, folderId: `${account}:INBOX` })} />); await settled();
  fireEvent.click(page.getByText("Notification"));
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"accountId":"b"'));
  await waitFor(() => expect(window.location.search).toContain("openMessageId=imap-one"));
  fireEvent.click(page.getByText("Show overlay")); expect(page.getByTestId("overlay").textContent).toBe("true");
  await pop("/?accountId=b&folderId=b%3AINBOX&openMessageId=imap-one");
  expect(page.getByTestId("overlay").textContent).toBe("false");
  expect(page.getByTestId("state").textContent).toContain('"messageId":"imap-one"');
  await pop("/?accountId=b&folderId=b%3AINBOX");
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"messageId":""'));
});

it("uses exactly one account entry followed by one message entry across real Back/Forward", async () => {
  const page = render(<Harness resolver={async account => ({ ...message, accountId: account })} />); await settled();
  const pushes = spyOn(window.history, "pushState"); restores.push(() => pushes.mockRestore());
  fireEvent.click(page.getByText("Mailbox B"));
  await waitFor(() => expect(new URLSearchParams(window.location.search).get("folderId")).toBe("b:INBOX"));
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
  await waitFor(() => expect(new URLSearchParams(window.location.search).get("folderId")).toBe("b:INBOX"));
  expect(pushes).toHaveBeenCalledTimes(1);
  act(() => window.history.back());
  await waitFor(() => expect(new URLSearchParams(window.location.search).get("accountId")).toBe("a"));
  expect(pushes).toHaveBeenCalledTimes(1);
});

it("replaces a removed reader with its continuation so Back returns to the original list", async () => {
  const page = render(<Harness />); await settled();
  const pushes = spyOn(window.history, "pushState"); restores.push(() => pushes.mockRestore());
  fireEvent.click(page.getByText("Message"));
  expect(pushes).toHaveBeenCalledTimes(1);
  fireEvent.click(page.getByText("Remove message"));
  expect(new URLSearchParams(window.location.search).get("openMessageId")).toBe("imap-two");
  expect(pushes).toHaveBeenCalledTimes(1);
  act(() => window.history.back());
  await waitFor(() => expect(page.getByTestId("state").textContent).toContain('"messageId":""'));
  expect(new URLSearchParams(window.location.search).get("folderId")).toBe("a:INBOX");
});

it("publishes a folder picked in a sheet after its own Back has settled", async () => {
  const page = render(<Harness />); await settled();
  fireEvent.click(page.getByText("Show overlay"));
  fireEvent.click(page.getByText("Folder Sent"));
  await waitFor(() => expect(new URLSearchParams(window.location.search).get("folderId")).toBe("a:Sent"));
  expect(page.getByTestId("state").textContent).toContain('"folderId":"a:Sent"');
});

it("settles a mailbox picked while its sidebar sheet closes with Back", async () => {
  const page = render(<Harness />); await settled();
  fireEvent.click(page.getByText("Show overlay"));
  fireEvent.click(page.getByText("Mailbox B"));
  await waitFor(() => expect(new URLSearchParams(window.location.search).get("folderId")).toBe("b:INBOX"));
  expect(page.getByTestId("state").textContent).toContain('"accountId":"b"');
});
