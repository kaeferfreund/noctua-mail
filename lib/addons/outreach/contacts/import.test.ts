import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import "@/lib/testDbHarness";
import { importKlaviyoContacts } from "@/scripts/outreach-import-klaviyo-contacts";
import { getOutreachDb } from "../db";
import { createContactList, findContactByEmail, listContactLists, upsertContact } from "./records";
import { changeContactSubscription, getMembership } from "./consent";

test("imports synthetic JSON:API files, previews without changes and preserves later unsubscribes on rerun", async () => {
  const dir = mkdtempSync(join(tmpdir(), "outreach-import-"));
  const accountId = crypto.randomUUID();
  const lists = join(dir, "lists.json");
  const profiles = join(dir, "profiles.json");
  const members = join(dir, "members");
  const created = Date.parse("2025-04-01T08:00:00Z");
  const consent = Date.parse("2025-04-02T08:00:00Z");
  const joined = Date.parse("2025-04-03T08:00:00Z");
  const now = Date.parse("2025-04-10T08:00:00Z");
  mkdirSync(members);
  const write = (file: string, data: unknown[]) => Bun.write(file, JSON.stringify({ data }));
  const profile = (id: string, attributes: object, marketing = {}) => ({
    id, attributes: { ...attributes, subscriptions: { email: { marketing } } }
  });
  try {
    await Promise.all([
      write(lists, [
        { id: "list-1", attributes: { name: "Synthetic Updates", opt_in_process: "double_opt_in" } },
        { id: "list-2", attributes: { name: "Synthetic News" } }
      ]),
      write(profiles, [
        profile("profile-a", { email: "UPDATES@EXAMPLE.TEST", first_name: "Synthetic", created: new Date(created).toISOString(),
          properties: { score: 2, active: true, tier: "example", nested: { ignored: true } } },
          { consent: "SUBSCRIBED", consent_timestamp: new Date(consent).toISOString(), can_receive_email_marketing: true }),
        profile("profile-b", { email: "bounce@example.test" }, { consent: "SUBSCRIBED",
          suppression: [{ reason: "HARD_BOUNCE", timestamp: new Date(joined).toISOString() }] }),
        profile("profile-c", { email: "pending@example.test" }),
        profile("profile-d", { email: "opt-out@example.test" }, { consent: "UNSUBSCRIBED" }),
        profile("profile-e", { email: "complaint@example.test" }, { consent: "SUBSCRIBED",
          suppression: [{ reason: "spam complaint" }, { reason: "bounce" }] }),
        profile("profile-f", { email: "manual@example.test" }, { suppression: [{ reason: "user suppressed" }] }),
        profile("profile-g", { email: "not-marketable@example.test" }, { consent: "SUBSCRIBED", can_receive_email_marketing: false }),
        profile("profile-h", { email: "invalid" })
      ]),
      write(join(members, "list-1.json"), [
        { id: "profile-a", attributes: { joined_group_at: new Date(joined).toISOString() } },
        ...["profile-b", "profile-c", "profile-d", "missing"].map(id => ({ id }))
      ])
    ]);

    // An existing case-insensitive address is linked to its export profile instead of duplicating it.
    const { contact } = await upsertContact(accountId, { email: "updates@example.test", lastName: "Preserved" }, created);
    const list = await createContactList(accountId, { name: "Locally created" }, now);
    const db = await getOutreachDb();
    const options = { accountId, lists, profiles, members };
    const preview = await importKlaviyoContacts(options, now);
    expect(preview).toMatchObject({ mode: "dry-run", lists: { created: 2 }, profiles: { created: 6, updated: 1, skipped: { invalid_email: 1 } },
      memberships: { created: 4, skipped: { missing_member_file: 1, profile_not_imported: 1 } } });
    expect(await listContactLists(accountId)).toMatchObject([{ id: list.id }]);
    expect(findContactByEmail(db, accountId, contact.email)).toMatchObject({ firstName: "", emailConsent: "never", externalId: null });
    expect(findContactByEmail(db, accountId, "bounce@example.test")).toBeNull();

    expect(await importKlaviyoContacts({ ...options, write: true }, now)).toEqual({ ...preview, mode: "write" });
    const imported = findContactByEmail(db, accountId, contact.email)!;
    expect(imported).toMatchObject({ id: contact.id, externalId: "profile-a", firstName: "Synthetic", lastName: "Preserved",
      emailConsent: "subscribed", consentAt: consent, consentSource: "klaviyo", createdAt: created });
    expect(JSON.parse(imported.properties)).toEqual({ score: 2, active: true, tier: "example" });
    const importedList = (await listContactLists(accountId)).find(item => item.name === "Synthetic Updates")!;
    expect(importedList).toMatchObject({ optIn: "double", memberCount: 2 });
    expect(getMembership(db, accountId, contact.id, importedList.id)).toMatchObject({ status: "subscribed", subscribedAt: joined });
    const bounce = findContactByEmail(db, accountId, "bounce@example.test")!;
    expect(bounce).toMatchObject({ suppressedReason: "hard_bounce", suppressedAt: joined });
    expect(findContactByEmail(db, accountId, "complaint@example.test")).toMatchObject({ suppressedReason: "complaint" });
    expect(findContactByEmail(db, accountId, "manual@example.test")).toMatchObject({ suppressedReason: "manual" });
    expect(findContactByEmail(db, accountId, "not-marketable@example.test")).toMatchObject({ suppressedReason: "manual" });
    expect(getMembership(db, accountId, findContactByEmail(db, accountId, "pending@example.test")!.id, importedList.id)).toMatchObject({ status: "pending" });
    expect(getMembership(db, accountId, findContactByEmail(db, accountId, "opt-out@example.test")!.id, importedList.id)).toMatchObject({ status: "unsubscribed" });
    expect(db.query("SELECT count(*) AS count FROM sequence_enrollments WHERE accountId = ?").get(accountId)).toEqual({ count: 0 });

    await changeContactSubscription(accountId, contact.id, { action: "unsubscribe", listId: importedList.id }, now + 1);
    expect(await importKlaviyoContacts({ ...options, write: true }, now + 2)).toMatchObject({
      profiles: { created: 0, updated: 0, unchanged: 7 }, lists: { created: 0, updated: 0, unchanged: 2 },
      memberships: { created: 0, updated: 0, unchanged: 4 }
    });
    expect(getMembership(db, accountId, contact.id, importedList.id)).toMatchObject({ status: "unsubscribed", unsubscribedAt: now + 1 });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
