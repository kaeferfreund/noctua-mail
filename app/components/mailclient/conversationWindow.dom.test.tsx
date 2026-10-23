import { afterEach, describe, expect, test } from "bun:test";
import { act, cleanup, fireEvent, renderHook, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { useState, type ComponentProps } from "react";
import { render } from "@/lib/i18n/testRender";
import { reviewReaderProps } from "@/tests/helpers/i18nSlice2b";
import type { Message } from "@/lib/data";
import ThreadView from "./message/ThreadView";
import { printWithLoadedBodies } from "./message/threadViewState";
import { useThreadContent, type ThreadReadRequest } from "./useThreadContent";

afterEach(cleanup);

const ACCOUNT = "synthetic-window";

function header(index: number, overrides: Partial<Message> = {}): Message {
  const id = `window-m${index}`;
  return {
    id,
    accountId: ACCOUNT,
    folderId: `${ACCOUNT}:INBOX`,
    threadId: "window-thread",
    messageId: `<${id}@example.test>`,
    subject: "Synthetic conversation",
    from: "Synthetic Sender <sender@example.test>",
    to: "owner@example.test",
    preview: `Preview ${index}`,
    date: new Date(Date.UTC(2026, 0, 1, 8, index)).toISOString(),
    dateValue: Date.UTC(2026, 0, 1, 8, index),
    body: "",
    contentState: "omitted",
    seen: true,
    attachments: [],
    ...overrides
  };
}

function detail(message: Message, overrides: Partial<Message> = {}): Message {
  return {
    ...message,
    body: `Stored body of ${message.id}`,
    htmlBody: undefined,
    contentState: "stored",
    hasSource: true,
    ...overrides
  };
}

type Call = { url: string; method: string; body?: any; signal?: AbortSignal | null };
type Responder = (call: Call) => Promise<Response> | Response;

function fakeApi(responder: Responder) {
  const calls: Call[] = [];
  const apiFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: init?.method ?? "GET",
      body: typeof init?.body === "string" ? JSON.parse(init.body) : undefined,
      signal: init?.signal
    };
    calls.push(call);
    return responder(call);
  };
  return { apiFetch, calls };
}

function renderThreadContent(apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) {
  return renderHook(() =>
    useThreadContent({
      activeAccountId: ACCOUNT,
      apiFetch,
      readErrorMessage: async () => "error",
      reportError: () => {},
      updateMessagesWithCurrentResultPrune: () => {},
      messageById: new Map(),
      threadMessagesRef: { current: [] }
    })
  );
}

function threadRequest(threadId: string, anchor: string): ThreadReadRequest {
  return {
    key: `${ACCOUNT}|${threadId}|${anchor}`,
    threadId,
    anchorMessageId: anchor,
    windowed: true,
    messageIds: [anchor],
    excludeFolderIds: [],
    groupBy: "date",
    threadDateSource: "received"
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("reader bodies on expand", () => {
  function renderView(
    overrides: Partial<ComponentProps<typeof ThreadView>> = {},
    cardOverrides: Partial<ComponentProps<typeof ThreadView>["messageCardProps"]> = {}
  ) {
    const { message: _m, actionPending: _a, isCollapsed: _c, contentLoading: _l, fontScale: _f, zoomValue: _z, ...shared } =
      reviewReaderProps();
    const thread = [header(1), header(2), header(3)];
    const ensured: string[] = [];
    const props: ComponentProps<typeof ThreadView> = {
      activeMessage: thread[1],
      activeThread: thread,
      supportsThreads: true,
      showComposeInline: false,
      composeDraftId: null,
      composeReplyMessageId: null,
      renderComposeInlineCard: null,
      threadContentById: { "window-thread": thread },
      threadContentLoading: null,
      threadContentErrorById: {},
      messageCardProps: {
        ...shared,
        threadViewMode: "compact",
        pendingMessageActions: new Set(),
        collapsedMessages: {},
        messageTabs: {},
        messageContentLoading: {},
        messageFontScale: {},
        messageZoom: {},
        messageByMessageId: new Map(),
        ensureMessageContent: async (message: Message) => {
          ensured.push(message.id);
          return null;
        },
        ...cardOverrides
      },
      ...overrides
    };
    return { view: render(<Theme><ThreadView {...props} /></Theme>), ensured, thread, props };
  }

  test("only expanded cards read their body; expanding a collapsed card reads it", async () => {
    const { props } = renderView();
    cleanup();
    const ensured: string[] = [];
    const ensureMessageContent = async (message: Message) => {
      ensured.push(message.id);
      return null;
    };
    function Harness() {
      const [collapsedMessages, setCollapsedMessages] = useState<Record<string, boolean>>({});
      return (
        <Theme>
          <ThreadView
            {...props}
            messageCardProps={{
              ...props.messageCardProps,
              collapsedMessages,
              setCollapsedMessages,
              ensureMessageContent
            }}
          />
        </Theme>
      );
    }
    const view = render(<Harness />);
    await waitFor(() => expect(ensured).toEqual(["window-m2"]));
    // The selected card shows a loading state until its body arrives.
    expect(view.getByText("Loading message content…")).toBeTruthy();
    fireEvent.click(view.getByRole("button", { name: /Synthetic Sender.*Preview 1/ }));
    await waitFor(() => expect(ensured).toEqual(["window-m2", "window-m1"]));
    expect(ensured).not.toContain("window-m3");
  });

  test("the newest unread message is expanded by default as well", async () => {
    const thread = [header(1), header(2), header(3, { seen: false })];
    const { ensured } = renderView({ activeMessage: thread[0], activeThread: thread });
    await waitFor(() => expect([...ensured].sort()).toEqual([thread[0].id, thread[2].id]));
  });

  test("older messages are offered when the window has more history", () => {
    const pages: string[] = [];
    const { view } = renderView({
      threadWindow: {
        anchorId: "window-m2",
        total: 200,
        hasOlder: true,
        olderCursor: "older",
        hasNewer: true,
        newerCursor: "newer",
        placeholders: [],
        loading: null,
        error: null
      },
      onLoadThreadPage: (direction) => pages.push(direction)
    });
    fireEvent.click(view.getByRole("button", { name: "Load older messages" }));
    fireEvent.click(view.getByRole("button", { name: "Load more messages" }));
    expect(pages).toEqual(["older", "newer"]);
  });

  test("a failed body read shows an error with a manual retry", async () => {
    const manual: Array<boolean | undefined> = [];
    const { view } = renderView(
      {},
      {
        messageContentErrorById: { "window-m2": "Failed to load message content." },
        ensureMessageContent: async (_message: Message, options?: { manual?: boolean }) => {
          manual.push(options?.manual);
          return null;
        }
      }
    );
    fireEvent.click(view.getByRole("button", { name: "Try again" }));
    expect(manual).toEqual([true]);
  });
});

describe("useThreadContent conversation reads", () => {
  test("a fast thread switch aborts the superseded read and keeps loading owned by the current one", async () => {
    const pending = new Map<string, ReturnType<typeof deferred<Response>>>();
    const { apiFetch, calls } = fakeApi((call) => {
      const gate = deferred<Response>();
      pending.set(call.body.threadIds[0], gate);
      return gate.promise;
    });
    const { result } = renderThreadContent(apiFetch);
    act(() => {
      void result.current.loadThreadContent(threadRequest("thread-a", "a1"));
    });
    expect(result.current.threadContentLoading).toBe("thread-a");
    act(() => {
      void result.current.loadThreadContent(threadRequest("thread-b", "b1"));
    });
    expect(calls[0].signal?.aborted).toBe(true);
    expect(calls[1].signal?.aborted).toBe(false);
    expect(calls[1].body).toMatchObject({ projection: "headers", window: { anchorMessageId: "b1" } });
    // The late response for A must not fill the cache or clear B's loading state.
    await act(async () => {
      pending.get("thread-a")!.resolve(Response.json({ items: [header(1, { threadId: "thread-a" })] }));
    });
    expect(result.current.threadContentById["thread-a"]).toBeUndefined();
    expect(result.current.threadContentLoading).toBe("thread-b");
    await act(async () => {
      pending.get("thread-b")!.resolve(
        Response.json({
          items: [header(1, { threadId: "thread-b" })],
          placeholders: [],
          window: { total: 1, anchorId: "window-m1", hasOlder: false, olderCursor: null, hasNewer: false, newerCursor: null }
        })
      );
    });
    expect(result.current.threadContentById["thread-b"]?.map((m) => m.id)).toEqual(["window-m1"]);
    expect(result.current.threadContentLoading).toBeNull();
  });

  test("older pages merge into the cached window", async () => {
    const { apiFetch, calls } = fakeApi((call) =>
      call.body.window?.cursor
        ? Response.json({
            items: [header(1), header(2)],
            placeholders: [],
            window: { total: 5, anchorId: null, hasOlder: false, olderCursor: null, hasNewer: false, newerCursor: null }
          })
        : Response.json({
            items: [header(3), header(4), header(5)],
            placeholders: [header(2)],
            window: { total: 5, anchorId: "window-m4", hasOlder: true, olderCursor: "cursor-older", hasNewer: false, newerCursor: null }
          })
    );
    const { result } = renderThreadContent(apiFetch);
    await act(async () => {
      await result.current.loadThreadContent(threadRequest("window-thread", "window-m4"));
    });
    expect(result.current.threadWindowById["window-thread"]?.hasOlder).toBe(true);
    await act(async () => {
      await result.current.loadThreadPage({
        threadId: "window-thread",
        direction: "older",
        excludeFolderIds: [],
        groupBy: "date",
        threadDateSource: "received"
      });
    });
    expect(calls[1].body.window).toEqual({ cursor: "cursor-older" });
    expect(result.current.threadContentById["window-thread"]?.map((m) => m.id)).toEqual([
      "window-m1",
      "window-m2",
      "window-m3",
      "window-m4",
      "window-m5"
    ]);
    const windowState = result.current.threadWindowById["window-thread"];
    expect(windowState?.hasOlder).toBe(false);
    expect(windowState?.placeholders).toEqual([]);
  });

  test("reply on a not-yet-loaded body reads the local detail without a resync", async () => {
    const target = header(7);
    const { apiFetch, calls } = fakeApi(() => Response.json({ ok: true, message: detail(target) }));
    const { result } = renderThreadContent(apiFetch);
    let loaded: Message | null = null;
    await act(async () => {
      loaded = await result.current.ensureMessageContent(target, { manual: true });
    });
    expect(loaded!.body).toBe("Stored body of window-m7");
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      `GET /api/accounts/${ACCOUNT}/messages/window-m7`
    ]);
    expect(result.current.messageBodyById[`${ACCOUNT}:window-m7`]?.body).toBe("Stored body of window-m7");
  });

  test("resync runs only when the server reports the content as not stored", async () => {
    const target = header(8, { mailboxPath: "INBOX", imapUid: 8 });
    let detailReads = 0;
    const { apiFetch, calls } = fakeApi((call) => {
      if (call.method === "POST") return Response.json({ ok: true });
      detailReads += 1;
      return Response.json({
        ok: true,
        message:
          detailReads === 1
            ? detail(target, { body: "", contentState: "missing", hasSource: false })
            : detail(target)
      });
    });
    const { result } = renderThreadContent(apiFetch);
    let loaded: Message | null = null;
    await act(async () => {
      loaded = await result.current.ensureMessageContent(target);
    });
    expect(calls.map((call) => call.method)).toEqual(["GET", "POST", "GET"]);
    expect(calls[1].url).toContain("/resync");
    expect(loaded!.body).toBe("Stored body of window-m8");
  });

  test("an empty stored message is not resynced", async () => {
    const target = header(9, { mailboxPath: "INBOX", imapUid: 9 });
    const { apiFetch, calls } = fakeApi(() =>
      Response.json({ ok: true, message: detail(target, { body: "", contentState: "empty", hasSource: true }) })
    );
    const { result } = renderThreadContent(apiFetch);
    await act(async () => {
      await result.current.ensureMessageContent(target);
    });
    expect(calls.map((call) => call.method)).toEqual(["GET"]);
  });
});

describe("print", () => {
  test("loads expanded bodies before printing and leaves collapsed ones alone", async () => {
    const thread = [header(1), header(2), header(3, { body: "Already loaded", contentState: "stored" })];
    const order: string[] = [];
    await printWithLoadedBodies({
      renderedThread: thread,
      collapsedMessages: { [thread[2].id]: false },
      activeMessageId: thread[1].id,
      ensureMessageContent: async (message) => {
        order.push(`load:${message.id}`);
        return null;
      },
      afterRender: async () => {
        order.push("render");
      },
      print: () => order.push("print")
    });
    expect(order).toEqual(["load:window-m2", "render", "print"]);
  });
});
