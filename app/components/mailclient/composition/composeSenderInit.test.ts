import { describe, expect, test } from "bun:test";
import type { Message, SenderIdentity } from "@/lib/data";
import type { SenderSettings } from "@/lib/ui/senderSettings";
import { computeComposeInitState } from "./composeInitState";
import { computeDraftHash } from "./draftSaveUtils";
import { buildComposePayload } from "./composeContentBuilder";
import { loadMarkdownConverters } from "@/lib/markdownConvert";

const sender: SenderSettings = { account: { id: "a", email: "primary@example.test", settings: { signatures: [{ id: "shared", name: "Team", body: "Regards,\n{{user.name}}\n{{identity.email}}" }], defaultSignatureId: "shared" } } as SenderSettings["account"],
  identities: ["primary", "alias"].map(id => ({ id, accountId: "a", email: `${id}@example.test`, displayName: id, isDefault: id === "primary", enabled: true } as SenderIdentity)),
  prefs: { defaultIdentityId: "alias" }, user: { name: "Synthetic Jo", email: "jo@example.test" }, warnings: [] };
const message = { id: "draft", accountId: "a", from: "customer@example.test", to: "alias@example.test", subject: "Question", body: "Original", htmlBody: "<p>Original</p>", dateValue: 1, date: "2026-01-01", attachments: [] } as unknown as Message;
const deps = { stripHtml: (value: string) => value.replace(/<[^>]*>/g, ""), normalizeHtmlDerivedText: (value: string) => value };
const init = (mode: Parameters<typeof computeComposeInitState>[0], tab: "text" | "html" | "markdown", source: Message | undefined, context = sender) => computeComposeInitState(mode, source, false, { accountEmail: sender.account.email, accountDateFormat: "locale", preferredComposeTab: tab, sender: context }, deps);

describe("sender compose initializer", () => {
  for (const mode of ["new", "reply", "replyAll", "forward"] as const) for (const tab of ["text", "html", "markdown"] as const) test(`${mode}/${tab}: inserts signature exactly once before quotes and establishes stable body`, async () => {
    await loadMarkdownConverters();
    const fields = init(mode, tab, mode === "new" ? undefined : message);
    expect(fields.identityId).toBe("alias"); expect(fields.composeTab).toBe(tab);
    const output = buildComposePayload({ ...fields, composeAttachments: [], composeAssembledQuotedHtml: fields.composeQuotedHtml }, deps);
    expect(output.text.match(/Synthetic Jo/g)).toHaveLength(1);
    expect(output.text.indexOf("Synthetic Jo")).toBeLessThan(output.text.indexOf("Original") === -1 ? Infinity : output.text.indexOf("Original"));
    expect(init(mode, tab, mode === "new" ? undefined : message)).toEqual(fields);
    expect(fields.initialDraftHash).toBeNull();
  });
  test("reopened drafts preserve rendered text and saved identity, including unavailable", () => {
    const draft = { ...message, from: "primary@example.test", senderIdentityId: "primary", body: "Author's signature", htmlBody: "<p>Author's signature</p>", xComposeFormat: "text" };
    const fields = init("edit", "text", draft);
    expect(fields.composeBody).toBe("Author's signature"); expect(fields.signature).toBeUndefined(); expect(fields.identityId).toBe("primary");
    expect(fields.initialDraftHash).toBe(computeDraftHash({ identityId: "primary", to: draft.to, cc: "", bcc: "", subject: draft.subject, text: draft.body, html: undefined, attachments: [] }));
    for (const id of ["missing", "primary"]) {
      const stale = init("edit", "text", { ...draft, senderIdentityId: id }, { ...sender, identities: sender.identities.map(identity => ({ ...identity, enabled: identity.id !== "primary" })) });
      expect(stale.identityId).toBe(id); expect(stale.unavailableFrom).toBe(draft.from); expect(stale.composeBody).toBe(draft.body);
    }
  });
  test("explicit none and personal override apply without modifying the shared template", () => {
    expect(init("new", "html", undefined, { ...sender, prefs: { signatureOverride: "" } }).composeHtml).toBe("");
    expect(init("new", "html", undefined, { ...sender, prefs: { defaultSignatureId: "" } }).composeHtml).toBe("");
    expect(init("new", "text", undefined, { ...sender, prefs: { signatureOverride: "{{user.name}} <personal>" } }).composeBody).toBe("Synthetic Jo <personal>");
    expect(sender.account.settings?.signatures?.[0].body).toContain("{{user.name}}");
  });
});
