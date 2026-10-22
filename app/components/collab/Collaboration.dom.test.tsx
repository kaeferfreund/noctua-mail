import { afterEach, describe, expect, it } from "bun:test";
import {
  act,
  cleanup,
  fireEvent,
  render,
  waitFor,
} from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { useRef, useState } from "react";
import ThreadCollaborationBar from "./ThreadCollaborationBar";
import InternalNoteComposer from "./InternalNoteComposer";
import ThreadActivityPanel from "./ThreadActivityPanel";
import CollabRowBadges from "./CollabRowBadges";
import type { CollabMember, ThreadCollabState } from "./types";
import {
  useThreadCollab,
  type ThreadCollabController,
} from "@/app/hooks/useThreadCollab";
import {
  COLLAB_FOLDERS,
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
});
describe("InternalNoteComposer", () => {
  it("posts Markdown and clears only after success", async () => {
    const bodies: string[] = [];
    const view = render(
      <InternalNoteComposer
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
    const view = render(<InternalNoteComposer onSubmit={async () => false} />);
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
it("collaboration sidebar definitions activate their server badge filter and counts exclude folders", async () => {
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
  await waitFor(() => expect(requests.length).toBe(7));
  for (const request of requests)
    expect(request.get("excludeFolderIds")).toBe("trash");
});
