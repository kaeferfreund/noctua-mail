import { expect, it } from "bun:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MessageLinkPreviewProvider } from "../mailclient/message/MessageLinkPreviewContext";
import type { ThreadComment } from "./types";

// Other DOM tests can warm the viewer. Keep the cold-import assertions in a
// fresh Bun process, as in the lazy account-settings tests, without module mocks.
if (!process.env.NOCTUA_LAZY_ACTIVITY_TEST) {
  it("loads the collaboration Markdown viewer only for visible notes", () => {
    const child = Bun.spawnSync([
      process.execPath, "test", "--config=bunfig.dom.toml", fileURLToPath(import.meta.url),
    ], {
      cwd: process.cwd(),
      env: { ...process.env, NOCTUA_LAZY_ACTIVITY_TEST: "1" },
      stdout: "pipe",
      stderr: "pipe",
    });
    expect(child.exitCode, child.stdout.toString() + child.stderr.toString()).toBe(0);
  }, 15000);
} else {
  it("keeps empty activity cold and preserves note Markdown, links and delete errors", async () => {
    const require = createRequire(import.meta.url);
    const viewerPath = require.resolve("../mailclient/message/MarkdownPanel");
    const loaded = () => Boolean(require.cache[viewerPath]);
    expect(loaded()).toBe(false);
    const { default: ThreadActivityPanel } = await import("./ThreadActivityPanel");
    expect(loaded()).toBe(false);

    const comment: ThreadComment = {
      id: "synthetic-note",
      accountId: "synthetic-account",
      threadId: "<synthetic-thread@example.test>",
      authorUserId: "synthetic-author",
      body: "**Private** ~~old~~ [safe link](https://example.test/note)\n\n- first item\n- `inline code`\n\n<script>bad()</script>",
      createdAt: 1,
      updatedAt: 1,
      revision: 0,
      deletedAt: null,
    };
    const previews: (string | null)[] = [];
    const deleted: string[] = [];
    let deleteSucceeds = false;
    const props = {
      activity: [],
      members: [{
        userId: comment.authorUserId,
        name: "Synthetic Author",
        email: "author@example.test",
        role: "editor" as const,
        isOwner: false,
      }],
      me: comment.authorUserId,
      role: "editor" as const,
      onDelete: async (id: string) => {
        deleted.push(id);
        return deleteSucceeds;
      },
    };
    const preview = (url: string | null) => previews.push(url);
    const panel = (comments: ThreadComment[], pending = false) => (
      <MessageLinkPreviewProvider value={preview}>
        <ThreadActivityPanel {...props} comments={comments} pending={pending} />
      </MessageLinkPreviewProvider>
    );
    const view = render(panel([]));
    try {
      expect(view.getByText("No activity yet.")).toBeTruthy();
      await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
      expect(loaded()).toBe(false);

      view.rerender(panel([{ ...comment, deletedAt: 2 }]));
      expect(view.getByText("No activity yet.")).toBeTruthy();
      expect(loaded()).toBe(false);

      view.rerender(panel([comment]));
      expect(view.queryByRole("status")).toBeNull();
      expect(view.queryByText("Loading Markdown…")).toBeNull();
      const link = await view.findByRole("link", { name: "safe link" });
      expect(loaded()).toBe(true);
      expect(view.container.querySelector("strong")?.textContent).toBe("Private");
      expect(view.container.querySelector("del")?.textContent).toBe("old");
      expect(view.container.querySelectorAll("ul li").length).toBe(2);
      expect(view.container.querySelector("code")?.textContent).toBe("inline code");
      expect(view.container.querySelector("script")).toBeNull();
      // Import the old eager path only after the cold-boundary assertions. Both
      // callers must produce identical HTML using the unchanged viewer/plugins.
      const { default: EagerMarkdownPanel } = await import("../mailclient/message/MarkdownPanel");
      const eager = render(<EagerMarkdownPanel body={comment.body} />);
      expect(view.container.querySelector(".markdown-view")?.outerHTML).toBe(
        eager.container.querySelector(".markdown-view")?.outerHTML,
      );
      eager.unmount();
      expect(link.getAttribute("href")).toBe("https://example.test/note");
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toBe("noreferrer");
      fireEvent.mouseEnter(link);
      expect(previews.at(-1)).toBe("https://example.test/note");
      fireEvent.mouseLeave(link);
      expect(previews.at(-1)).toBeNull();
      fireEvent.focus(link);
      expect(previews.at(-1)).toBe("https://example.test/note");
      fireEvent.blur(link);
      expect(previews.at(-1)).toBeNull();

      const deleteButton = view.getByRole("button", { name: "Delete note by Synthetic Author" });
      view.rerender(panel([comment], true));
      expect((deleteButton as HTMLButtonElement).disabled).toBe(true);
      view.rerender(panel([comment]));
      fireEvent.click(deleteButton);
      expect((await view.findByRole("alert")).textContent).toBe("Could not delete note.");
      expect(deleted).toEqual([comment.id]);
      deleteSucceeds = true;
      fireEvent.click(deleteButton);
      await waitFor(() => expect(view.queryByRole("alert")).toBeNull());
      expect(deleted).toEqual([comment.id, comment.id]);

      fireEvent.focus(link);
      view.rerender(panel([]));
      expect(previews.at(-1)).toBeNull();
    } finally {
      cleanup();
    }
  });
}
