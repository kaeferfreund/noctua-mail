import { afterEach, describe, expect, it } from "bun:test";
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { useRef, useState } from "react";
import ThreadCollaborationBar from "./ThreadCollaborationBar";
import InternalNoteComposer from "./InternalNoteComposer";
import { useInternalNoteDrafts } from "./useInternalNoteDrafts";
import ThreadActivityPanel, { focusThreadActivity } from "./ThreadActivityPanel";
import CollabRowBadges from "./CollabRowBadges";
import { CollabRowsContext } from "./types";
import { useMessageData } from "../mailclient/useMessageData";
import type { CollabMember, ThreadCollabState } from "./types";
import {
  useThreadCollab,
  type ThreadCollabController,
} from "@/app/hooks/useThreadCollab";
import {
  COLLAB_FOLDERS,
  DEFAULT_SEARCH_BADGES,
  useSearchState,
} from "@/app/components/mailclient/useSearchState";
const members: CollabMember[] = [
  {
    userId: "alex",
    name: "Alex Example",
    email: "alex@example.test",
    role: "editor",
    isOwner: false,
  },
  {
    userId: "toni",
    name: "Toni Example",
    email: "toni@example.test",
    role: "manager",
    isOwner: true,
  },
  {
    userId: "disabled",
    name: "Disabled Example",
    email: "disabled@example.test",
    role: "editor",
    isOwner: false,
    disabled: true,
  },
];
const state: ThreadCollabState = {
  accountId: "a",
  threadId: "<t@example.test>",
  status: "open",
  assigneeUserId: null,
  assignedByUserId: null,
  assignedAt: null,
  statusChangedAt: null,
  statusChangedByUserId: null,
  commentCount: 2,
  lastActivityAt: 1,
  updatedAt: 1,
  revision: 0,
  updatedByUserId: null,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
afterEach(async () => {
  cleanup();
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
});
function controller(
  update: ThreadCollabController["update"],
): ThreadCollabController {
  return {
    state,
    readDenied: false,
    members,
    me: "alex",
    comments: [],
    activity: [],
    pending: false,
    loading: false,
    error: null,
    reload: async () => {},
    update,
    addNote: async () => true,
    deleteNote: async () => true,
  };
}

describe("ThreadCollaborationBar", () => {
  it("assigns Me, Unassigned and a userId member and changes status", async () => {
    const updates: unknown[] = [];
    const view = render(
      <Theme>
        <ThreadCollaborationBar
          collab={controller(async (p) => {
            updates.push(p);
            return true;
          })}
          role="editor"
          onNote={() => {}}
          onActivity={() => {}}
        />
      </Theme>,
    );
    expect(view.getByRole("button", { name: "2 internal notes" })).toBeTruthy();
    for (const [label, id] of [
      ["Me", "alex"],
      ["Unassigned", null],
      ["Toni Example", "toni"],
    ] as const) {
      fireEvent.click(view.getByRole("combobox", { name: "Assignee" }));
      fireEvent.click(await view.findByRole("option", { name: label }));
      expect(updates.at(-1)).toEqual({ assigneeUserId: id });
    }
    expect(view.queryByRole("option", { name: "Disabled Example" })).toBeNull();
    fireEvent.pointerDown(
      view.getByRole("combobox", { name: "Thread status" }),
      { button: 0, ctrlKey: false, pointerType: "mouse" },
    );
    fireEvent.click(await view.findByRole("option", { name: "Waiting" }));
    expect(updates.at(-1)).toEqual({ status: "waiting" });
  });
  it("viewers read state but cannot mutate", () => {
    const view = render(
      <Theme>
        <ThreadCollaborationBar
          collab={controller(async () => {
            throw new Error("viewer wrote");
          })}
          role="viewer"
          onNote={() => {}}
          onActivity={() => {}}
        />
      </Theme>,
    );
    expect(
      (view.getByRole("combobox", { name: "Assignee" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        view.getByRole("combobox", {
          name: "Thread status",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(view.queryByRole("button", { name: "Internal note" })).toBeNull();
  });
  it("a denied collaboration read disables stale editor controls", () => {
    const collab = { ...controller(async () => true), readDenied: true };
    const view = render(<ThreadCollaborationBar collab={collab} role="editor" onNote={() => {}} onActivity={() => {}} />);
    expect((view.getByRole("combobox", { name: "Assignee" }) as HTMLButtonElement).disabled).toBe(true);
    expect((view.getByRole("combobox", { name: "Thread status" }) as HTMLButtonElement).disabled).toBe(true);
    expect(view.queryByRole("button", { name: "Internal note" })).toBeNull();
  });
});
function NoteHarness({ onSubmit }: { onSubmit: (body: string) => Promise<boolean> }) {
  const [account, setAccount] = useState("a");
  const [thread, setThread] = useState("one");
  const [open, setOpen] = useState(true);
  const draft = useInternalNoteDrafts(account, thread);
  return <>
    <button onClick={() => setOpen(value => !value)}>Toggle note</button>
    <button onClick={() => setThread(value => value === "one" ? "two" : "one")}>Switch thread</button>
    <button onClick={() => setAccount(value => value === "a" ? "b" : "a")}>Switch account</button>
    {open && <InternalNoteComposer key={`${account}:${thread}`} onSubmit={onSubmit} body={draft.body} onBodyChange={draft.setBody} onSaved={draft.clearSaved} />}
  </>;
}
describe("InternalNoteComposer", () => {
  it("posts Markdown and clears only after success", async () => {
    const bodies: string[] = [];
    const view = render(
      <NoteHarness
        onSubmit={async (body) => {
          bodies.push(body);
          return true;
        }}
      />,
    );
    const input = view.getByRole("textbox") as HTMLTextAreaElement;
    fireEvent.change(input, { target: { value: "**Internal** note" } });
    fireEvent.click(view.getByRole("button", { name: "Add note" }));
    await waitFor(() => expect(input.value).toBe(""));
    expect(bodies).toEqual(["**Internal** note"]);
  });
  it("keeps text after a failed post", async () => {
    const view = render(<NoteHarness onSubmit={async () => false} />);
    fireEvent.change(view.getByRole("textbox"), {
      target: { value: "Keep me" },
    });
    fireEvent.click(view.getByRole("button", { name: "Add note" }));
    await view.findByRole("alert");
    expect((view.getByRole("textbox") as HTMLTextAreaElement).value).toBe(
      "Keep me",
    );
  });
});
describe("ThreadActivityPanel", () => {
  const comments = ["alex", "toni", "revoked"].map((authorUserId, i) => ({
    id: `c${i}`,
    accountId: "a",
    threadId: state.threadId,
    authorUserId,
    body: "**Private** [safe link](https://example.test) <script>bad()</script>",
    createdAt: 1,
    updatedAt: 1,
    revision: 0,
    deletedAt: null,
  }));
  it("renders safe Markdown and author delete permission", async () => {
    const deleted: string[] = [];
    const view = render(
      <ThreadActivityPanel
        comments={comments}
        activity={[]}
        members={members}
        me="alex"
        role="editor"
        onDelete={async (id) => {
          deleted.push(id);
          return true;
        }}
      />,
    );
    expect(view.container.querySelectorAll("strong").length).toBe(3);
    expect(view.container.querySelector("script")).toBeNull();
    expect(view.getAllByText("Former member").length).toBe(1);
    expect(view.getAllByRole("button", { name: /Delete note/ }).length).toBe(1);
    fireEvent.click(
      view.getByRole("button", { name: "Delete note by Alex Example" }),
    );
    await waitFor(() => expect(deleted).toEqual(["c0"]));
  });
  it("managers delete all notes and viewers delete none", () => {
    const props = {
      comments,
      activity: [],
      members,
      me: "alex",
      onDelete: async () => true,
    };
    const view = render(<ThreadActivityPanel {...props} role="manager" />);
    expect(view.getAllByRole("button", { name: /Delete note/ }).length).toBe(3);
    view.rerender(<ThreadActivityPanel {...props} role="viewer" />);
    expect(view.queryByRole("button", { name: /Delete note/ })).toBeNull();
  });
});
it("list chips hide defaults, show status, and use Former member for missing/disabled members", () => {
  const message = { threadId: state.threadId, collab: state };
  const view = render(<CollabRowBadges message={message} members={members} />);
  expect(view.container.textContent).toBe("");
  view.rerender(
    <CollabRowBadges
      message={{
        ...message,
        collab: { ...state, status: "in_progress", assigneeUserId: "alex" },
      }}
      members={members}
    />,
  );
  expect(view.getByLabelText("Assignee: Alex Example")).toBeTruthy();
  expect(view.getByText("In progress")).toBeTruthy();
  for (const name of [null, "", "   "]) {
    view.rerender(
      <CollabRowBadges
        message={{ ...message, collab: { ...state, assigneeUserId: "alex" } }}
        members={members.map(member => member.userId === "alex" ? { ...member, name } : member)}
      />,
    );
    expect(view.getByLabelText(`Assignee: ${members.find(member => member.userId === "alex")!.email}`)).toBeTruthy();
  }
  for (const assigneeUserId of ["revoked", "disabled"]) {
    view.rerender(
      <CollabRowBadges
        message={{ ...message, collab: { ...state, assigneeUserId } }}
        members={members}
      />,
    );
    expect(view.getByLabelText("Assignee: Former member")).toBeTruthy();
  }
});
it("useThreadCollab optimistically publishes a mutation and rolls it back on failure", async () => {
  let rejectRequest!: (response: Response) => void;
  const updates: string[] = [];
  const calls: { url: string; method: string }[] = [];
  const apiFetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), method: init?.method ?? "GET" });
    if (init?.method === "PATCH")
      return new Promise<Response>((r) => {
        rejectRequest = r;
      });
    if (String(url).endsWith("/me")) return json({ user: { id: "alex" } });
    if (String(url).endsWith("/members")) return json({ members });
    return json({ ok: true, state, members, comments: [], activity: [] });
  }) as typeof fetch;
  function Harness() {
    const collab = useThreadCollab("a", state.threadId, {
      apiFetch,
      onUpdate: (value) => updates.push(value.status),
    });
    return (
      <>
        <output>{collab.state?.status}</output>
        <button
          onClick={() => {
            void collab.update({ status: "waiting" });
          }}
        >
          Wait
        </button>
        {collab.error && <p role="alert">{collab.error}</p>}
      </>
    );
  }
  const view = render(<Harness />);
  await view.findByText("open");
  fireEvent.click(view.getByText("Wait"));
  await view.findByText("waiting");
  await act(async () => rejectRequest(json({ message: "Forbidden" }, 403)));
  await view.findByRole("alert");
  expect(view.getByText("open")).toBeTruthy();
  expect(updates).toEqual(["open", "waiting", "open"]);
  expect(
    calls.some(
      (call) =>
        call.url.includes("%3Ct%40example.test%3E/collab") &&
        call.method === "PATCH",
    ),
  ).toBe(true);
});
it("collaboration sidebar definitions activate their server badge filter; summary owns every collaboration count", async () => {
  const requests: URLSearchParams[] = [];
  const apiFetch = (async (url: RequestInfo | URL) => {
    requests.push(new URL(String(url), "http://example.test").searchParams);
    return json({ total: 4 });
  }) as typeof fetch;
  function Harness() {
    const [folder, setFolder] = useState("inbox");
    const [query, setQuery] = useState("");
    const restore = useRef(null);
    const { state, actions } = useSearchState({
      activeAccountId: "a",
      activeFolderId: folder,
      setActiveFolderId: setFolder,
      accountFolders: [],
      folderById: new Map(),
      query,
      setQuery,
      isRelatedSearch: false,
      relatedRestoreRef: restore,
      relatedQueryId: null,
      virtualDefaultExcludedFolderIdsKey: "trash",
      apiFetch,
    });
    return (
      <>
        <nav aria-label="Views">
          {COLLAB_FOLDERS.map((f) => (
            <button
              key={f.id}
              onClick={() => actions.activateVirtualFolder(f.id)}
            >
              {f.name}
            </button>
          ))}
        </nav>
        <output data-testid="filter">
          {state.activeVirtualFolder?.queryBadges.join(",")}
        </output>
        <output data-testid="scope">
          {state.searchScope}:{folder}
        </output>
      </>
    );
  }
  const view = render(<Harness />);
  for (const folder of COLLAB_FOLDERS) {
    fireEvent.click(view.getByRole("button", { name: folder.name }));
    expect(view.getByTestId("filter").textContent).toBe(
      folder.queryBadges.join(","),
    );
    expect(view.getByTestId("scope").textContent).toBe("all:");
  }
  // All collaboration counts come from the canonical summary, leaving only
  // the four existing non-collaboration view counts.
  await waitFor(() => expect(requests.length).toBe(4));
  expect(requests.map(request => [request.get("badges"), request.get("excludeFolderIds")]).sort()).toEqual([
    ["focused", "trash"], ["todo", "trash"], ["calendar", "trash"], ["calendar,unread", "trash"]
  ].sort());
});

it("retains note drafts through collapse and account/thread navigation and bounds long notes", async () => {
  const view = render(<NoteHarness onSubmit={async () => true} />);
  const input = () => view.getByRole("textbox") as HTMLTextAreaElement;
  const longNote = Array.from({ length: 24 }, (_, i) => `Synthetic line ${i}`).join("\n");
  fireEvent.change(input(), { target: { value: longNote } });
  expect(input().style.maxHeight).toBe("min(10rem, 25dvh)");
  expect(input().style.overflowY).toBe("auto");
  fireEvent.click(view.getByText("Toggle note"));
  fireEvent.click(view.getByText("Toggle note"));
  expect(input().value).toBe(longNote);
  for (const action of ["Switch thread", "Switch account"]) {
    fireEvent.click(view.getByText(action));
    expect(input().value).toBe("");
    fireEvent.change(input(), { target: { value: "Other draft" } });
    fireEvent.click(view.getByText(action));
    expect(input().value).toBe(longNote);
  }
  fireEvent.click(view.getByRole("button", { name: "Add note" }));
  await waitFor(() => expect(input().value).toBe(""));
});
it("the notes shortcut moves keyboard focus to the labelled timeline", () => {
  function Harness() {
    const ref = useRef<HTMLElement>(null);
    return <><ThreadCollaborationBar collab={controller(async () => true)} role="viewer" onNote={() => {}} onActivity={() => focusThreadActivity(ref.current)} /><ThreadActivityPanel ref={ref} comments={[]} activity={[]} members={[]} me={null} onDelete={async () => true} /></>;
  }
  const view = render(<Harness />);
  const region = view.getByRole("region", { name: "Internal notes and activity" });
  expect(region.tabIndex).toBe(-1);
  fireEvent.click(view.getByRole("button", { name: "2 internal notes" }));
  expect(document.activeElement === region).toBe(true);
});

for (const navigateAccount of [false, true]) {
  for (const succeeds of [false, true]) {
    it(`publishes originating collaboration ${succeeds ? "commit" : "rollback"} after ${navigateAccount ? "account" : "thread"} navigation`, async () => {
      let settle!: (response: Response) => void;
      const updates: ThreadCollabState[] = [];
      const commits: string[] = [];
      const apiFetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === "PATCH") return new Promise<Response>(resolve => { settle = resolve; });
        if (String(url).endsWith("/me")) return json({ user: { id: "alex" } });
        if (String(url).endsWith("/members")) return json({ members });
        const parts = String(url).split("/");
        return json({ ok: true, state: { ...state, accountId: parts[3], threadId: decodeURIComponent(parts[5]) }, members, comments: [], activity: [] });
      }) as typeof fetch;
      const hook = renderHook(({ account, thread }) => useThreadCollab(account, thread, { apiFetch, onUpdate: value => updates.push(value), onCommit: accountId => commits.push(accountId) }), { initialProps: { account: "a", thread: "one" } });
      await waitFor(() => expect(hook.result.current.state?.threadId).toBe("one"));
      let mutation!: Promise<boolean>;
      act(() => { mutation = hook.result.current.update({ status: "waiting" }); });
      hook.rerender({ account: navigateAccount ? "b" : "a", thread: "two" });
      await waitFor(() => expect(hook.result.current.state?.threadId).toBe("two"));
      await act(async () => { settle(succeeds ? json({ ok: true, state: { ...state, revision: 1, threadId: "one", status: "waiting" } }) : json({ message: "Denied" }, 403)); await mutation; });
      expect(updates.at(-1)?.accountId).toBe("a");
      expect(updates.at(-1)?.threadId).toBe("one");
      expect(updates.at(-1)?.status).toBe(succeeds ? "waiting" : "open");
      expect(commits).toEqual(succeeds ? ["a"] : []);
      expect(hook.result.current.state?.threadId).toBe("two");
      expect(hook.result.current.state?.status).toBe("open");
    });
  }
}
it("authoritative list refresh reloads selected collaboration and timeline even at equal timestamps", async () => {
  let closed = false;
  let collaborationReads = 0;
  const apiFetch = (async (url: RequestInfo | URL) => {
    if (String(url).endsWith("/me")) return json({ user: { id: "alex" } });
    if (String(url).endsWith("/members")) return json({ members });
    const summary = { ...state, revision: closed ? 1 : 0, status: closed ? "closed" : "open", commentCount: closed ? 1 : 0 };
    if (String(url).endsWith("/collab")) {
      collaborationReads++;
      return json({ ok: true, state: summary, members, comments: closed ? [{ id: "new-comment", body: "New synthetic note" }] : [], activity: closed ? [{ id: "new-activity" }] : [] });
    }
    return json({ items: [{ id: "m", accountId: "a", threadId: state.threadId, collab: summary }], hasMore: false });
  }) as typeof fetch;
  const hook = renderHook(() => {
    const currentKeyRef = useRef("mailbox-a");
    const messages = useMessageData({ messagesKey: "mailbox-a", activeAccountId: "a", searchScope: "folder", activeFolderId: "inbox", isRelatedSearch: false, relatedQueryId: "", selectedSearchFields: [], searchBadges: DEFAULT_SEARCH_BADGES, effectiveSearchBadges: [], currentSearchExcludedFolderIds: [], supportsThreads: true, groupBy: "date", threadDateSource: "latestReceivedDateValue", sortBy: "date", query: "", authState: "ok", apiFetch, readErrorMessage: async () => "Error", reportError: () => {}, setRelatedContext: () => {}, relatedContext: null, setCollapsedGroups: () => {}, setCollapsedThreads: () => {}, currentKeyRef });
    const collab = useThreadCollab("a", state.threadId, { apiFetch, refreshVersion: messages.authoritativeRevision });
    return { messages, collab };
  });
  await waitFor(() => expect(hook.result.current.collab.state?.status).toBe("open"));
  const readsBefore = collaborationReads;
  closed = true;
  await act(async () => { await hook.result.current.messages.refreshMailboxData(); });
  await waitFor(() => expect(hook.result.current.collab.state?.status).toBe("closed"));
  expect(collaborationReads).toBeGreaterThan(readsBefore);
  expect(hook.result.current.collab.comments[0]?.id).toBe("new-comment");
  expect(hook.result.current.collab.activity[0]?.id).toBe("new-activity");
});
it("authoritative row data wins over a cached summary with an equal timestamp", () => {
  const view = render(<CollabRowsContext.Provider value={{ members, threadCollabById: new Map([[state.threadId, { ...state, status: "waiting" }]]) }}><CollabRowBadges message={{ threadId: state.threadId, collab: { ...state, status: "closed" } }} /></CollabRowsContext.Provider>);
  expect(view.getByText("Closed")).toBeTruthy();
  expect(view.queryByText("Waiting")).toBeNull();
});
it("a collaboration GET 403 purges the account cache and disables writes without logging out", async () => {
  let denyRead = false;
  let writes = 0;
  const invalidated: string[] = [];
  const apiFetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "PATCH") { writes++; return json({ message: "Write forbidden" }, 403); }
    if (String(url).endsWith("/me")) return json({ user: { id: "alex" } });
    if (String(url).endsWith("/members")) return json({ members });
    if (denyRead) return json({ message: "Mailbox access revoked" }, 403);
    return json({ ok: true, state, members, comments: [{ id: "cached-note" }], activity: [] });
  }) as typeof fetch;
  const hook = renderHook(({ thread }) => useThreadCollab("a", thread, { apiFetch, currentUserId: "alex", onReadDenied: account => invalidated.push(account) }), { initialProps: { thread: state.threadId } });
  await waitFor(() => expect(hook.result.current.state).toBeTruthy());
  await act(async () => { await hook.result.current.update({ status: "waiting" }); });
  expect(hook.result.current.state?.status).toBe("open");
  expect(hook.result.current.comments.length).toBe(1);
  expect(hook.result.current.readDenied).toBe(false);
  denyRead = true;
  hook.rerender({ thread: "other" });
  await waitFor(() => expect(hook.result.current.readDenied).toBe(true));
  hook.rerender({ thread: state.threadId });
  expect(hook.result.current.state).toBeUndefined();
  expect(hook.result.current.comments).toEqual([]);
  expect(hook.result.current.members).toEqual([]);
  expect(hook.result.current.me).toBe("alex");
  await act(async () => { expect(await hook.result.current.update({ status: "closed" })).toBe(false); });
  expect(writes).toBe(1);
  expect(invalidated).toContain("a");
});
