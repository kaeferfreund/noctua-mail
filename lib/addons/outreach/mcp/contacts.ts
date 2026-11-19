import { z } from "zod";
import { changeContactSubscription } from "../contacts/consent";
import { contactFilters, contactInput, idSchema, listInput, parseContactInput, subscriptionInput } from "../contacts/input";
import { createContactList, getContactDetail, listContactLists, searchContacts, updateContactList, upsertContact } from "../contacts/records";
import type { OutreachMcpHost } from "./index";

const account = { accountId: idSchema.optional() };
const readOnly = { readOnlyHint: true, openWorldHint: false };

/** MCP tools of the contacts area. Names and scopes: ../mcpScopes.ts. */
export function registerOutreachContactTools(host: OutreachMcpHost) {
  const { server } = host;
  server.registerTool("list_contact_lists", {
    title: "List newsletter contact lists",
    description: "List active contact lists and their subscriber counts.",
    inputSchema: z.strictObject(account),
    annotations: readOnly
  }, async ({ accountId }) => {
    const mailbox = await host.outreachAccount(accountId);
    return host.result("Contact lists.", { ok: true, lists: await listContactLists(mailbox.accountId), url: host.appUrl(mailbox.accountId) });
  });

  server.registerTool("search_contacts", {
    title: "Search newsletter contacts",
    description: "Search contact names or email addresses, filter by list, consent or suppression, and page through the results.",
    inputSchema: contactFilters.extend(account),
    annotations: readOnly
  }, async ({ accountId, ...filters }) => {
    const mailbox = await host.outreachAccount(accountId);
    return host.result("Contact search results.", { ...await searchContacts(mailbox.accountId, filters), url: host.appUrl(mailbox.accountId) });
  });

  server.registerTool("get_contact", {
    title: "Get a newsletter contact",
    description: "Read a contact's profile, list memberships, send totals and recent sends.",
    inputSchema: z.strictObject({ ...account, contactId: idSchema }),
    annotations: readOnly
  }, async ({ accountId, contactId }) => {
    const mailbox = await host.outreachAccount(accountId);
    const contact = await getContactDetail(mailbox.accountId, contactId);
    return host.result("Contact details.", { ok: true, contact, url: host.appUrl(mailbox.accountId) });
  });

  server.registerTool("upsert_contact", {
    title: "Save a newsletter contact",
    description: "Create or update a contact by email address. Omitted profile fields are preserved.",
    inputSchema: contactInput.extend(account),
    annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false }
  }, async ({ accountId, ...input }) => {
    const mailbox = await host.outreachAccount(accountId, "editor");
    const saved = await upsertContact(mailbox.accountId, input);
    return host.result(saved.created ? "Contact created." : "Contact updated.", { ok: true, ...saved, url: host.appUrl(mailbox.accountId) });
  });

  server.registerTool("save_contact_list", {
    title: "Save a newsletter contact list",
    description: "Create a list by name, or update an active list by ID.",
    inputSchema: listInput.partial().extend({ ...account, listId: idSchema.optional() }),
    annotations: { destructiveHint: false, openWorldHint: false }
  }, async ({ accountId, ...input }) => {
    const mailbox = await host.outreachAccount(accountId, "editor");
    const { listId, ...fields } = input;
    const list = listId ? await updateContactList(mailbox.accountId, listId, fields)
      : await createContactList(mailbox.accountId, parseContactInput(listInput, fields));
    return host.result("Contact list saved.", { ok: true, list, url: host.appUrl(mailbox.accountId) });
  });

  for (const action of ["subscribe", "unsubscribe"] as const) {
    server.registerTool(`${action}_contact`, {
      title: action === "subscribe" ? "Subscribe a contact to a list" : "Unsubscribe a contact from a list",
      description: action === "subscribe"
        ? "Record fresh email consent and subscribe the contact to one list. This can enroll the contact in a live newsletter sequence. "
          + "If the contact has unsubscribed before (globally or from this list), the call fails with resubscribe_confirmation_required "
          + "and the unsubscribe date; only after the person has asked to receive mail again, repeat it with confirmResubscribe: true."
        : "Unsubscribe the contact from one list.",
      inputSchema: subscriptionInput.omit({ action: true, ...(action === "unsubscribe" ? { confirmResubscribe: true } : {}) })
        .extend({ ...account, contactId: idSchema }),
      annotations: { destructiveHint: action === "unsubscribe", idempotentHint: true, openWorldHint: action === "subscribe" }
    }, async ({ accountId, contactId, ...change }) => {
      const mailbox = await host.outreachAccount(accountId, "editor");
      const contact = await changeContactSubscription(mailbox.accountId, contactId, { ...change, action });
      return host.result(action === "subscribe" ? "Contact subscribed." : "Contact unsubscribed.", {
        ok: true, contact, url: host.appUrl(mailbox.accountId)
      });
    });
  }
}
