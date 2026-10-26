import { authorizeOutbound } from "./outboundAuthorization";
import { resolveComposeIdentity } from "./senderIdentitySelection";
import { createSenderIdentityWithRecompute, updateSenderIdentity, SenderIdentityError } from "./senderIdentities";
import { SIGNATURE_PLACEHOLDERS, SignatureTemplateError } from "./signatureTemplates";
import { deleteSignatureTemplate, listSignatureTemplates, saveSignatureTemplate, setDefaultSignatureTemplate, type SignatureTemplateActor } from "./signatureTemplateStore";
import { MailboxCredentialError } from "./mailboxCredentials";
import { getIdentityRecomputeJob } from "./threadRecomputeJobs";
import { accountPrefsPatchSchema } from "./accountPrefs";
import { getUserAccountPrefs, mergeUserAccountPrefs, listSenderIdentities, InvalidAccountPreferencesError } from "./serverDb";
import { getUserMailboxSummary } from "@/lib/mailboxSummary";
import { listAccountMembersForRole } from "@/lib/accountAccess";
import { getOwnAddresses } from "@/lib/ownAddresses";
import { assertMcpToolPermission, listMcpTokenAccounts, mcpTokenScopes, resolveMcpToolContext } from "@/lib/mcpAuth";
import { mcpToolScope, type McpScope } from "@/lib/mcpPermissions";
import { enrichMessagesWithThreadCollab } from "@/app/api/_helpers/enrichMessagesWithThreadCollab";
import { getThreadCollabState, listThreadComments, listThreadActivity,
  updateThreadCollabState, addThreadComment } from "@/lib/threadCollab";
import type { AccountRole } from "@/lib/data";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import {
  ErrorCode,
  JSONRPCMessageSchema,
  isJSONRPCError,
  isJSONRPCRequest,
  isJSONRPCResponse,
  type JSONRPCMessage,
  type MessageExtraInfo,
  type RequestId
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { enrichMessagesWithThreadTopics } from "@/app/api/_helpers/enrichMessagesWithThreadTopics";
import { runNewMailCheck } from "@/app/api/_helpers/newMailCheck";
import type { Account, Folder, Message, McpTokenMetadata } from "@/lib/data";
import {
  getFolders,
  getMessageById,
  listMessages,
  listRelatedMessages,
  listThreadMessages,
  updateMessageFlags
} from "@/lib/serverDb";
import {
  DraftSaveError,
  buildDraftInputForMode,
  saveDraftForAccount,
  type DraftCreateMode
} from "@/lib/drafts";
import { applyFlagMutationsToMessage } from "@/lib/messageFlagMutation";
import { buildDraftUpdateInput, getStoredDraft, toEditableDraft, type DraftUpdatePatch } from "@/lib/draftEdit";
import { findDraftsFolder } from "@/lib/specialFolders";
import {
  addThreadTopic,
  getTopicsForThread,
  listTopics,
  removeThreadTopic
} from "@/lib/topics";
import { listRecipientAliases } from "@/lib/recipientAliases";
import { readAuthEnv } from "@/lib/betterAuth";
import { appDeepLink, messageDeepLink, type DeepLinkState } from "@/lib/navigation/deepLinks";
import {
  AI_MODIFIED_FLAG,
  DONE_FLAG,
  TODO_FLAG,
  appendMessageFlags,
  hasAiModifiedFlag,
  hasDoneFlag,
  hasMessageFlag,
  hasTodoFlag
} from "@/lib/messageFlags";

const MCP_DEFAULT_PAGE_SIZE = 50;
const MCP_MAX_PAGE_SIZE = 200;

type McpAccountContext = {
  accountId: string;
  account: Account;
  tokenRecord: McpTokenMetadata;
  authInfo?: MessageExtraInfo["authInfo"];
  requestInfo?: MessageExtraInfo["requestInfo"];
  role?: AccountRole;
};

type SearchMessagesArgs = {
  query?: string;
  relatedId?: string;
  threadIds?: string[];
  messageIds?: string[];
  topics?: string[];
  from?: string[];
  recipients?: string[];
  participants?: string[];
  folderId?: string;
  fields?: string[];
  badges?: string[];
  attachmentsOnly?: boolean;
  excludedFolderIds?: string[];
  page?: number;
  pageSize?: number;
  groupBy?: string;
};

type MessageListResult = {
  items: Message[];
  groups?: { key: string; label: string; count: number }[];
  total?: number;
  baseCount?: number;
  hasMore?: boolean;
  page?: number;
  pageSize?: number;
  mode: "folder" | "search" | "related" | "thread-related";
  relatedSubject?: string;
};

const ACCOUNT_ID_ARG = {
  accountId: z.string().trim().optional()
};

const URL_OUTPUT = z.string().describe("Absolute Noctua Mail link that opens this item for the user.");

const LIST_MESSAGES_BY_FOLDER_SCHEMA = {
  ...ACCOUNT_ID_ARG,
  folderId: z.string().trim().min(1),
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(MCP_MAX_PAGE_SIZE).optional(),
  groupBy: z.string().trim().optional(),
  badges: z.array(z.string()).optional(),
  attachmentsOnly: z.boolean().optional(),
  excludedFolderIds: z.array(z.string()).optional()
};

const SEARCH_MODE_DESCRIPTION =
  "Exactly one mode is allowed: standard search, related search via relatedId, or thread-related lookup via threadIds/messageIds.";
const STANDARD_SEARCH_ONLY_DESCRIPTION =
  "Standard search mode only. Do not combine with relatedId, threadIds, or messageIds.";
const RELATED_SEARCH_ONLY_DESCRIPTION =
  "Related-search mode. Do not combine with threadIds or messageIds.";
const THREAD_RELATED_ONLY_DESCRIPTION =
  "Thread-related mode only. When provided, do not combine with standard or related-search filters except optional groupBy.";

const SEARCH_MESSAGES_SCHEMA = {
  ...ACCOUNT_ID_ARG,
  query: z.string().optional().describe(
    `Free-text search query for standard mode. Supports existing query operators such as from:, to:, in:, thread:, topic:, invite:, and event:. ${SEARCH_MODE_DESCRIPTION}`
  ),
  relatedId: z.string().trim().optional().describe(
    `${RELATED_SEARCH_ONLY_DESCRIPTION} Finds messages related to the given message id or Message-ID.`
  ),
  threadIds: z.array(z.string().trim().min(1)).optional().describe(
    `${THREAD_RELATED_ONLY_DESCRIPTION} Returns messages from the specified thread ids.`
  ),
  messageIds: z.array(z.string().trim().min(1)).optional().describe(
    `${THREAD_RELATED_ONLY_DESCRIPTION} Returns messages for the threads that contain these message ids.`
  ),
  topics: z.array(z.string().trim().min(1)).optional().describe(
    `Topic filters for standard mode. Accepts topic ids or topic names. ${STANDARD_SEARCH_ONLY_DESCRIPTION}`
  ),
  from: z.array(z.string().trim().min(1)).optional().describe(
    `Sender filters for standard mode. Each value must match the From header. ${STANDARD_SEARCH_ONLY_DESCRIPTION}`
  ),
  recipients: z.array(z.string().trim().min(1)).optional().describe(
    `Recipient filters for standard mode. Each value matches any of To, Cc, or Bcc. ${STANDARD_SEARCH_ONLY_DESCRIPTION}`
  ),
  participants: z.array(z.string().trim().min(1)).optional().describe(
    `Participant filters for standard mode. Each value matches any of From, To, Cc, or Bcc. ${STANDARD_SEARCH_ONLY_DESCRIPTION}`
  ),
  folderId: z.string().trim().optional().describe(
    `Restrict standard-mode search to one folder id. ${STANDARD_SEARCH_ONLY_DESCRIPTION}`
  ),
  fields: z.array(z.string().trim().min(1)).optional().describe(
    `Limit standard-mode free-text search to specific indexed fields such as subject, from, to, cc, bcc, body, preview, or attachments. ${STANDARD_SEARCH_ONLY_DESCRIPTION}`
  ),
  badges: z.array(z.string().trim().min(1)).optional().describe(
    "Filter results by message badges such as flagged, unread, attachments, draft, todo, or done."
  ),
  attachmentsOnly: z.boolean().optional().describe(
    "When true, only return messages with meaningful non-inline attachments."
  ),
  excludedFolderIds: z.array(z.string().trim().min(1)).optional().describe(
    "Exclude messages from these folder ids."
  ),
  page: z.number().int().min(1).optional().describe(
    "1-based page number for standard and related search modes."
  ),
  pageSize: z.number().int().min(1).max(MCP_MAX_PAGE_SIZE).optional().describe(
    `Maximum number of messages per page for standard and related search modes. Max ${MCP_MAX_PAGE_SIZE}.`
  ),
  groupBy: z.string().trim().optional().describe(
    "Optional grouping key for returned results, such as date, week, year, sender, domain, folder, or event-oriented groupings."
  )
};

const MESSAGE_ID_SCHEMA = {
  ...ACCOUNT_ID_ARG,
  messageId: z.string().trim().min(1)
};

const CREATE_DRAFT_MESSAGE_SCHEMA = {
  identityId: z.string().min(1).max(256).optional(),
  ...ACCOUNT_ID_ARG,
  mode: z.enum(["new", "reply", "forward"]).optional(),
  messageId: z.string().trim().optional(),
  to: z.string().optional(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  subject: z.string().optional(),
  text: z.string().optional(),
  markdown: z.string().optional(),
  html: z.string().optional(),
  composeFormat: z.enum(["text", "html", "markdown"]).optional(),
  quotedHtmlEdited: z.boolean().optional(),
  attachments: z.array(
    z.object({
      filename: z.string().trim().min(1),
      contentType: z.string().trim().min(1),
      inline: z.boolean().optional(),
      cid: z.string().trim().optional(),
      dataUrl: z.string().trim().optional()
    })
  ).optional()
};

const DRAFT_ID_ARG = {
  draftId: z.string().trim().min(1).describe("Draft id from create_draft_message, list_draft_messages or search_messages (badge draft).")
};

const DRAFT_EDIT_HINT =
  "Drafts are edited in place: never create a second version and ask the user to delete the old one.";

const UPDATE_DRAFT_MESSAGE_SCHEMA = {
  ...ACCOUNT_ID_ARG,
  ...DRAFT_ID_ARG,
  identityId: z.string().min(1).max(256).optional().describe("Enabled sender identity. Omit to keep the draft's sender."),
  to: z.string().optional().describe("Replaces the whole To list. Omit to keep it; empty string clears it."),
  cc: z.string().optional().describe("Replaces the whole Cc list. Omit to keep it; empty string clears it."),
  bcc: z.string().optional().describe("Replaces the whole Bcc list. Omit to keep it; empty string clears it."),
  subject: z.string().optional().describe("Replaces the subject. Omit to keep it."),
  text: z.string().optional().describe("Replaces the whole body (with html/markdown, same rules as create_draft_message)."),
  markdown: z.string().optional().describe("Replaces the whole body as Markdown."),
  html: z.string().optional().describe("Replaces the whole body as HTML."),
  composeFormat: z.enum(["text", "html", "markdown"]).optional().describe("Body format; only together with text, html or markdown."),
  appendBody: z.string().optional().describe(
    "Plain-text paragraph appended to the existing body, after the authored text and before a quoted original. Keeps the draft's format. Cannot be combined with text/html/markdown."
  )
};

const EDITABLE_DRAFT_SCHEMA = z.object({
  draftId: z.string(), identityId: z.string().nullable(), from: z.string(), to: z.string(), cc: z.string(), bcc: z.string(),
  subject: z.string(), composeFormat: z.enum(["text", "html", "markdown"]), text: z.string(), html: z.string().nullable(),
  markdown: z.string().nullable(), inReplyTo: z.string().nullable(), references: z.array(z.string()),
  forwardedMessageId: z.string().nullable(),
  attachments: z.array(z.object({ id: z.string(), filename: z.string(), contentType: z.string(), size: z.number(), inline: z.boolean() })),
  updatedAt: z.number()
});

const TOPIC_MUTATION_SCHEMA = {
  ...ACCOUNT_ID_ARG,
  threadId: z.string().trim().optional(),
  messageId: z.string().trim().optional(),
  topics: z.array(z.string()).min(1)
};

const FOLDER_SCHEMA = {
  id: z.string(),
  name: z.string(),
  count: z.number(),
  parentId: z.string().nullable().optional(),
  accountId: z.string(),
  specialUse: z.string().optional(),
  flags: z.array(z.string()).optional(),
  delimiter: z.string().optional(),
  unreadCount: z.number().optional()
};

const LIST_FOLDERS_OUTPUT_SCHEMA = {
  ok: z.boolean(),
  folders: z.array(z.object({ ...FOLDER_SCHEMA, url: URL_OUTPUT }))
};

const ACCOUNT_SUMMARY_SCHEMA = {
  id: z.string(),
  name: z.string(),
  email: z.string(),
  avatar: z.string(),
  accessRole: z.enum(["viewer", "editor", "manager"]),
  url: URL_OUTPUT
};

const LIST_ACCOUNTS_OUTPUT_SCHEMA = {
  ok: z.boolean(),
  accounts: z.array(z.object(ACCOUNT_SUMMARY_SCHEMA))
};

const LIST_MAILING_LIST_ALIASES_SCHEMA = {
  accountId: z.string().trim().optional().describe(
    "Optional account id. Omit to use the authenticated account associated with the MCP token."
  )
};

const MAILING_LIST_ALIAS_SCHEMA = {
  id: z.string(),
  accountId: z.string(),
  name: z.string(),
  recipients: z.string(),
  normalizedRecipients: z.string(),
  createdAt: z.number(),
  updatedAt: z.number()
};

const LIST_MAILING_LIST_ALIASES_OUTPUT_SCHEMA = {
  ok: z.boolean(),
  aliases: z.array(z.object(MAILING_LIST_ALIAS_SCHEMA)),
  url: URL_OUTPUT
};

const SEARCH_RESULT_TOPIC_SCHEMA = {
  id: z.string(),
  accountId: z.string(),
  name: z.string(),
  shortName: z.string().nullable().optional(),
  color: z.string().nullable(),
  imapKeyword: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  suggestionScore: z.number().optional(),
  matchCount: z.number().optional()
};

const SEARCH_RESULT_MESSAGE_SCHEMA = {
  deliveredTo: z.array(z.string()).optional(),
  originalTo: z.array(z.string()).optional(),
  senderIdentityId: z.string().optional(),
  id: z.string(),
  accountId: z.string(),
  folderId: z.string(),
  threadId: z.string(),
  subject: z.string(),
  from: z.string(),
  to: z.string(),
  cc: z.string().optional(),
  bcc: z.string().optional(),
  preview: z.string(),
  date: z.string(),
  dateValue: z.number(),
  body: z.string(),
  htmlBody: z.string().optional(),
  hasSource: z.boolean().optional(),
  hasAttachments: z.boolean().optional(),
  hasInlineAttachments: z.boolean().optional(),
  unread: z.boolean().optional(),
  priority: z.string().optional(),
  flags: z.array(z.string()).optional(),
  seen: z.boolean().optional(),
  answered: z.boolean().optional(),
  flagged: z.boolean().optional(),
  deleted: z.boolean().optional(),
  draft: z.boolean().optional(),
  recent: z.boolean().optional(),
  category: z.string().nullable().optional(),
  categoryScore: z.number().nullable().optional(),
  categorySignals: z.array(z.string()).optional(),
  listUnsubscribe: z.string().nullable().optional(),
  listId: z.string().nullable().optional(),
  groupKey: z.string().optional(),
  threadSortDateValue: z.number().optional(),
  topics: z.array(z.object(SEARCH_RESULT_TOPIC_SCHEMA)).optional(),
  topicSuggestions: z.array(z.object(SEARCH_RESULT_TOPIC_SCHEMA)).optional(),
  collab: z.object({ status: z.enum(["open", "in_progress", "waiting", "closed"]), assigneeUserId: z.string().nullable(), commentCount: z.number(), updatedAt: z.number() }).optional(),
  url: URL_OUTPUT.optional()
};

const SEARCH_RESULT_GROUP_SCHEMA = {
  key: z.string(),
  label: z.string(),
  count: z.number()
};

const SEARCH_MESSAGES_OUTPUT_SCHEMA = {
  items: z.array(z.object(SEARCH_RESULT_MESSAGE_SCHEMA)),
  groups: z.array(z.object(SEARCH_RESULT_GROUP_SCHEMA)).optional(),
  total: z.number().optional(),
  baseCount: z.number().optional(),
  hasMore: z.boolean().optional(),
  page: z.number().optional(),
  pageSize: z.number().optional(),
  mode: z.enum(["search", "related", "thread-related"]),
  relatedSubject: z.string().optional()
};

const SENDER_IDENTITY_SCHEMA = z.object({ id: z.string(), accountId: z.string(), email: z.string(), displayName: z.string(),
  replyTo: z.string().optional(), signatureId: z.string().optional(), isDefault: z.boolean(), enabled: z.boolean(),
  createdBy: z.string().nullable(), createdAt: z.number(), updatedAt: z.number() });
const IDENTITY_JOB_SCHEMA = z.object({ id: z.string(), accountId: z.string(), status: z.enum(["queued", "running", "done", "failed"]),
  startedAt: z.number(), finishedAt: z.number().optional(), error: z.string().optional(), pid: z.number().optional() }).nullable();
const SIGNATURE_TEMPLATE_SCHEMA = z.object({ id: z.string(), name: z.string(), body: z.string() });
const SIGNATURE_TEMPLATES_OUTPUT = { signatures: z.array(SIGNATURE_TEMPLATE_SCHEMA), defaultSignatureId: z.string().optional() };
const SIGNATURE_ID_ARG = z.string().min(1).max(256);
const SENDER_PREFS_SCHEMA = z.object({ defaultIdentityId: z.string().optional(), defaultSignatureId: z.string().optional(), signatureOverride: z.string().optional() });
function senderPrefs(prefs: import("./data").UserAccountPrefs) {
  return { defaultIdentityId: prefs.defaultIdentityId, defaultSignatureId: prefs.defaultSignatureId, signatureOverride: prefs.signatureOverride };
}
function senderToolOutput(shape: Record<string, z.ZodType>) {
  const variants = z.discriminatedUnion("ok", [z.object({ ok: z.literal(true), ...shape }),
    z.object({ ok: z.literal(false), code: z.string(), message: z.string() })]);
  // The MCP SDK advertises only object roots. Keep that root while publishing
  // and validating the same discriminated variants in JSON Schema and Zod.
  const optionalShape = Object.fromEntries(Object.entries(shape).map(([key, schema]) => [key, schema.optional()]));
  return z.object({ ok: z.boolean(), ...optionalShape, code: z.string().optional(),
    message: shape.message ? z.union([shape.message, z.string()]).optional() : z.string().optional() })
    .superRefine((value, context) => {
      const parsed = variants.safeParse(value);
      if (!parsed.success) context.addIssue({ code: "custom", message: "Expected a sender success or domain-error result" });
    }).meta({ anyOf: z.toJSONSchema(variants).oneOf ?? z.toJSONSchema(variants).anyOf });
}

/** Keep the mailbox service's status visible so clients can retry a conflict instead of treating it as a rejection. */
export function mailboxErrorCode(status: number) {
  return status === 409 ? "mailbox_conflict" : status === 404 ? "account_not_found" : status === 403 ? "forbidden" : "mailbox_update_rejected";
}
async function senderToolCall(run: () => Promise<ReturnType<typeof buildToolResult>>) {
  try { return await run(); }
  catch (error) {
    if (error instanceof SenderIdentityError || error instanceof SignatureTemplateError || error instanceof MailboxCredentialError ||
        error instanceof InvalidAccountPreferencesError || error instanceof DraftSaveError) {
      const code = error instanceof SenderIdentityError || error instanceof SignatureTemplateError ? error.code
        : error instanceof MailboxCredentialError ? mailboxErrorCode(error.status) : error instanceof InvalidAccountPreferencesError ? "invalid_preferences" : "invalid_draft";
      return { ...buildToolResult(error.message, { ok: false, code, message: error.message }), isError: true };
    }
    throw error;
  }
}

async function resolveAccountContext(
  baseContext: McpAccountContext,
  requestedAccountId?: string,
  minRole: import("@/lib/data").AccountRole = "viewer"
): Promise<McpAccountContext & { role: import("@/lib/data").AccountRole }> {
  const id = requestedAccountId?.trim() || baseContext.tokenRecord.accountId;
  const live = await resolveMcpToolContext(baseContext.tokenRecord.id, id, minRole);
  return { ...baseContext, ...live };
}
function mcpActor(context: McpAccountContext) {
  return { userId: context.tokenRecord.createdByUserId, clientId: `mcp:${context.tokenRecord.id}` };
}
function identityManagementActor(context: McpAccountContext): SignatureTemplateActor {
  return { ...mcpActor(context), beforeWrite: () => authorizeOutbound({ tokenId: context.tokenRecord.id }, { accountId: context.accountId, minRole: "manager", purpose: "identity-management" }) };
}

function normalizeStringList(values?: string[] | null) {
  return Array.from(
    new Set((values ?? []).map((value) => value.trim()).filter(Boolean))
  );
}

function normalizePage(value?: number) {
  return Number.isFinite(value) && value && value > 0 ? Math.floor(value) : 1;
}

function normalizePageSize(value?: number) {
  if (!Number.isFinite(value) || !value || value <= 0) {
    return MCP_DEFAULT_PAGE_SIZE;
  }
  return Math.min(MCP_MAX_PAGE_SIZE, Math.max(1, Math.floor(value)));
}

function buildSummary(result: MessageListResult) {
  const total = typeof result.total === "number" ? `${result.total} total` : `${result.items.length} total`;
  const page = typeof result.page === "number" ? `page ${result.page}` : null;
  const mode =
    result.mode === "folder"
      ? "folder listing"
      : result.mode === "search"
        ? "search"
        : result.mode === "related"
          ? "related search"
          : "thread-related search";
  return [`Returned ${result.items.length} messages from ${mode}.`, total, page].filter(Boolean).join(" ");
}

function buildToolResult(summary: string, structuredContent: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: summary }],
    structuredContent
  };
}

/** Result links use the canonical auth origin: the only origin at which the user can sign in. */
function appUrl(state: Partial<DeepLinkState>) {
  return appDeepLink(state, readAuthEnv().baseURL);
}

/** Opens the message (and its thread) in the reader; a draft opens from the Drafts folder. */
function messageUrl(message: { accountId: string; id: string; folderId: string }) {
  return messageDeepLink(message, readAuthEnv().baseURL);
}

function settingsUrl(accountId: string, settings: DeepLinkState["settings"]) {
  return appUrl({ accountId, settings });
}

/** Thread links open the given message, otherwise the thread's newest message. */
async function threadUrl(accountId: string, target: { threadId: string; messageId?: string }) {
  const message = target.messageId
    ? await getMessageById(accountId, target.messageId)
    : (await listThreadMessages({ accountId, threadIds: [target.threadId], groupBy: "date" })).items
      .reduce<Message | null>((newest, item) => !newest || item.dateValue > newest.dateValue ? item : newest, null);
  return message ? messageUrl(message) : appUrl({ accountId });
}

function withLink(summary: string, url: string | null | undefined) {
  return url ? `${summary}\nOpen in Noctua Mail: ${url}` : summary;
}

function withMessageUrls<T extends Message>(items: T[]) {
  return items.map(item => ({ ...item, url: messageUrl(item) }));
}

function formatMessageListContent(result: Omit<MessageListResult, "items"> & { items: (Message & { url: string })[] }) {
  return [buildSummary(result), ...result.items.map(item => `- ${JSON.stringify(item.subject)} id=${item.id}: ${item.url}`)].join("\n");
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true } as const;
const IDEMPOTENT_CHANGE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true } as const;
const ADDITIVE_CHANGE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false } as const;
const DESTRUCTIVE_CHANGE = { readOnlyHint: false, destructiveHint: true, idempotentHint: false } as const;

export const MCP_SERVER_INFO = {
  name: "noctua-mail",
  title: "Noctua Mail",
  version: "1.1.0",
  description: "The user's e-mail: personal and shared mailboxes in Noctua Mail."
};

export const MCP_SERVER_INSTRUCTIONS = [
  "Noctua Mail is the user's own e-mail client. These tools act on the user's personal and shared mailboxes:",
  "read, search and list messages, write drafts (new mail, replies, forwards), flag messages and track to-dos/done,",
  "collaborate on threads (status, assignee, internal comments), and manage sender identities and signatures.",
  "Use these tools whenever the user asks to write, answer, forward, find, summarise, organise or triage e-mail,",
  "or mentions a mailbox, folder, sender, message or thread. Use the real mailbox data instead of answering from memory.",
  "Typical flow: list_accounts -> search_messages or list_messages_by_folder -> get details -> create_draft_message",
  "(mode reply/forward with messageId) or update_draft_message to revise an existing draft in place.",
  "Drafts are never sent by these tools: the user reviews and sends them in Noctua Mail.",
  "Every created, changed or listed item comes back with a `url`; give that link to the user so they can open it directly.",
  "accountId selects the mailbox; omit it to use the token's own mailbox, and take other ids from list_accounts."
].join("\n");

function formatFolderListContent(folders: (Folder & { url: string })[]) {
  if (folders.length === 0) {
    return "Returned 0 folders.";
  }

  const lines = folders.map((folder) => {
    const parts = [
      `id=${folder.id}`,
      `name=${JSON.stringify(folder.name)}`
    ];
    if (folder.specialUse) parts.push(`specialUse=${folder.specialUse}`);
    if (folder.parentId) parts.push(`parentId=${folder.parentId}`);
    if (typeof folder.unreadCount === "number") parts.push(`unread=${folder.unreadCount}`);
    parts.push(`count=${folder.count}`);
    return `- ${parts.join(" ")}: ${folder.url}`;
  });

  return [`Returned ${folders.length} folders:`, ...lines].join("\n");
}

function makeJsonRpcError(id: RequestId | null, code: number, message: string) {
  return {
    jsonrpc: "2.0" as const,
    id,
    error: { code, message }
  };
}

function exactRelatedQueryId(query: string) {
  const match = query.trim().match(/^related:(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

async function resolveTopicSelectors(accountId: string, selectors: string[]) {
  const normalizedSelectors = normalizeStringList(selectors);
  if (normalizedSelectors.length === 0) return [];

  const topics = await listTopics(accountId);
  const topicById = new Map<string, (typeof topics)[number]>(
    topics.map((topic) => [topic.id, topic] as const)
  );
  const topicsByName = new Map<string, (typeof topics)[number][]>();
  topics.forEach((topic) => {
    const key = topic.name.trim().toLowerCase();
    const list = topicsByName.get(key) ?? [];
    list.push(topic);
    topicsByName.set(key, list);
  });

  const resolvedIds: string[] = [];
  normalizedSelectors.forEach((selector) => {
    const exactId = topicById.get(selector);
    if (exactId) {
      resolvedIds.push(exactId.id);
      return;
    }

    const byName = topicsByName.get(selector.toLowerCase()) ?? [];
    if (byName.length === 1) {
      resolvedIds.push(byName[0]!.id);
      return;
    }
    if (byName.length > 1) {
      throw new Error(`Topic selector "${selector}" is ambiguous; use an exact topic ID.`);
    }
    throw new Error(`Unknown topic selector "${selector}".`);
  });

  return Array.from(new Set(resolvedIds));
}

function appendTopicTerms(query: string, topicIds: string[]) {
  const topicTerms = topicIds.map((topicId) => `topic:${topicId}`);
  return [...[query.trim()].filter(Boolean), ...topicTerms].join(" ").trim();
}

async function markMessageAiModified(accountId: string, messageId: string) {
  const message = await getMessageById(accountId, messageId);
  if (!message || hasAiModifiedFlag(message.flags)) {
    return message?.flags ?? [];
  }
  const nextFlags = appendMessageFlags(message.flags, [AI_MODIFIED_FLAG]);
  await updateMessageFlags(accountId, messageId, nextFlags);
  return nextFlags;
}

async function markThreadMessagesAiModified(accountId: string, threadId: string) {
  const messages = await listThreadMessages({
    accountId,
    threadIds: [threadId],
    groupBy: "date"
  });
  await Promise.all(messages.items.map((message) => markMessageAiModified(accountId, message.id)));
  return messages.items.map((message) => message.id);
}

async function resolveThreadTarget(
  context: McpAccountContext,
  args: { threadId?: string; messageId?: string }
) {
  const threadId = args.threadId?.trim() ?? "";
  const messageId = args.messageId?.trim() ?? "";
  if (!threadId && !messageId) {
    throw new Error("Provide either threadId or messageId.");
  }
  if (threadId) {
    return { threadId };
  }
  const message = await getMessageById(context.accountId, messageId);
  if (!message) {
    throw new Error("Message not found");
  }
  if (!message.threadId?.trim()) {
    throw new Error("Message does not have a threadId.");
  }
  return {
    threadId: message.threadId,
    messageId: message.id
  };
}

async function updateThreadTopics(
  context: McpAccountContext,
  args: { threadId?: string; messageId?: string; topics: string[] },
  mode: "assign" | "unassign"
) {
  const { threadId } = await resolveThreadTarget(context, args);
  const topicIds = await resolveTopicSelectors(context.accountId, args.topics);
  if (topicIds.length === 0) {
    throw new Error("No topics resolved.");
  }

  if (mode === "assign") {
    await Promise.all(topicIds.map((topicId) => addThreadTopic(context.accountId, threadId, topicId)));
  } else {
    await Promise.all(topicIds.map((topicId) => removeThreadTopic(context.accountId, threadId, topicId)));
  }

  const topics = await getTopicsForThread(context.accountId, threadId);
  const affectedMessageIds = await markThreadMessagesAiModified(context.accountId, threadId);
  return {
    ok: true,
    threadId,
    topics,
    affectedMessageIds
  };
}

async function updateTodoState(
  context: McpAccountContext,
  messageId: string,
  targetState: "todo" | "done" | "clear"
) {
  const message = await getMessageById(context.accountId, messageId);
  if (!message) {
    throw new Error("Message not found");
  }

  const hasTodo = hasTodoFlag(message.flags);
  const hasDone = hasDoneFlag(message.flags);
  let currentFlags = message.flags ?? [];
  let changed = false;

  const applyKeyword = async (keyword: string, value: boolean) => {
    currentFlags = await applyFlagMutationsToMessage({
      accountId: context.accountId,
      account: context.account,
      messageId,
      message: {
        ...message,
        flags: currentFlags
      },
      keyword,
      value,
      clientId: `mcp:${context.tokenRecord.id}`
    });
  };

  if (targetState === "todo") {
    if (hasDone) {
      await applyKeyword(DONE_FLAG, false);
      changed = true;
    }
    if (!hasTodo) {
      await applyKeyword(TODO_FLAG, true);
      changed = true;
    }
  } else if (targetState === "done") {
    if (hasTodo) {
      await applyKeyword(TODO_FLAG, false);
      changed = true;
    }
    if (!hasDone) {
      await applyKeyword(DONE_FLAG, true);
      changed = true;
    }
  } else {
    if (hasTodo) {
      await applyKeyword(TODO_FLAG, false);
      changed = true;
    }
    if (hasDone) {
      await applyKeyword(DONE_FLAG, false);
      changed = true;
    }
  }

  const finalFlags = changed
    ? await markMessageAiModified(context.accountId, messageId)
    : currentFlags;
  return {
    ok: true,
    messageId,
    flags: finalFlags,
    changed,
    state: targetState,
    url: messageUrl(message)
  };
}

async function listMessagesForFolder(
  context: McpAccountContext,
  args: {
    folderId: string;
    page?: number;
    pageSize?: number;
    groupBy?: string;
    badges?: string[];
    attachmentsOnly?: boolean;
    excludedFolderIds?: string[];
  }
) {
  const page = normalizePage(args.page);
  const pageSize = normalizePageSize(args.pageSize);
  const badges = normalizeStringList(args.badges);
  const excludedFolderIds = normalizeStringList(args.excludedFolderIds);
  const data = await listMessages({
    accountId: context.accountId,
    viewerUserId: context.tokenRecord.createdByUserId,
    folderId: args.folderId,
    page,
    pageSize,
    query: null,
    groupBy: args.groupBy ?? "date",
    badges,
    attachmentsOnly: args.attachmentsOnly,
    excludedFolderIds
  });
  await enrichMessagesWithThreadCollab(data.items, { accountId: context.accountId });
  await enrichMessagesWithThreadTopics(data.items, { accountId: context.accountId });
  return {
    ...data,
    page,
    pageSize,
    mode: "folder" as const
  };
}

async function searchMessages(
  context: McpAccountContext,
  args: SearchMessagesArgs
) {
  const page = normalizePage(args.page);
  const pageSize = normalizePageSize(args.pageSize);
  const badges = normalizeStringList(args.badges);
  const excludedFolderIds = normalizeStringList(args.excludedFolderIds);
  const fields = normalizeStringList(args.fields);
  const from = normalizeStringList(args.from);
  const recipients = normalizeStringList(args.recipients);
  const participants = normalizeStringList(args.participants);
  const threadIds = normalizeStringList(args.threadIds);
  const messageIds = normalizeStringList(args.messageIds);
  const topicSelectors = normalizeStringList(args.topics);
  const rawQuery = args.query?.trim() ?? "";
  const normalizedRelatedId = args.relatedId?.trim() || exactRelatedQueryId(rawQuery);
  const hasRelatedMode = normalizedRelatedId.length > 0;
  const hasThreadMode = threadIds.length > 0 || messageIds.length > 0;
  const hasStandardMode = !hasRelatedMode && !hasThreadMode;
  const modeCount = [hasRelatedMode, hasThreadMode, hasStandardMode].filter(Boolean).length;

  if (modeCount !== 1) {
    throw new Error(
      "search_messages requires exactly one mode: standard search, relatedId, or threadIds/messageIds."
    );
  }

  if (hasThreadMode) {
    if (
      rawQuery ||
      normalizedRelatedId ||
      topicSelectors.length > 0 ||
      from.length > 0 ||
      recipients.length > 0 ||
      participants.length > 0 ||
      args.folderId ||
      fields.length > 0 ||
      badges.length > 0 ||
      args.attachmentsOnly ||
      excludedFolderIds.length > 0 ||
      args.page !== undefined ||
      args.pageSize !== undefined
    ) {
      throw new Error("thread-related search only supports threadIds/messageIds and optional groupBy.");
    }
    const data = await listThreadMessages({
      accountId: context.accountId,
      threadIds,
      messageIds,
      groupBy: args.groupBy ?? "date"
    });
    await enrichMessagesWithThreadCollab(data.items, { accountId: context.accountId });
    await enrichMessagesWithThreadTopics(data.items, {
      accountId: context.accountId,
      accountEmail: getOwnAddresses(context.account),
      includeSuggestions: true
    });
    return {
      ...data,
      mode: "thread-related" as const
    };
  }

  if (hasRelatedMode) {
    if (
      topicSelectors.length > 0 ||
      from.length > 0 ||
      recipients.length > 0 ||
      participants.length > 0 ||
      fields.length > 0 ||
      args.folderId
    ) {
      throw new Error(
        "related search does not support topics, from, recipients, participants, fields, or folderId."
      );
    }
    const data = await listRelatedMessages({
      accountId: context.accountId,
      viewerUserId: context.tokenRecord.createdByUserId,
      relatedId: normalizedRelatedId,
      page,
      pageSize,
      groupBy: args.groupBy ?? "date",
      badges,
      attachmentsOnly: args.attachmentsOnly,
      excludedFolderIds
    });
    await enrichMessagesWithThreadCollab(data.items, { accountId: context.accountId });
    await enrichMessagesWithThreadTopics(data.items, {
      accountId: context.accountId,
      accountEmail: getOwnAddresses(context.account),
      includeSuggestions: true
    });
    return {
      ...data,
      page,
      pageSize,
      mode: "related" as const
    };
  }

  const topicIds = await resolveTopicSelectors(context.accountId, topicSelectors);
  const query = appendTopicTerms(rawQuery, topicIds);
  const data = await listMessages({
    accountId: context.accountId,
    viewerUserId: context.tokenRecord.createdByUserId,
    folderId: args.folderId?.trim() || undefined,
    page,
    pageSize,
    query,
    groupBy: args.groupBy ?? "date",
    fields,
    from,
    recipients,
    participants,
    badges,
    attachmentsOnly: args.attachmentsOnly,
    excludedFolderIds
  });
  await enrichMessagesWithThreadCollab(data.items, { accountId: context.accountId });
  await enrichMessagesWithThreadTopics(data.items, { accountId: context.accountId });
  return {
    ...data,
    page,
    pageSize,
    mode: "search" as const
  };
}

async function createDraftMessage(
  context: McpAccountContext,
  args: {
    identityId?: string;
    mode?: DraftCreateMode;
    messageId?: string;
    to?: string;
    cc?: string;
    bcc?: string;
    subject?: string;
    text?: string;
    markdown?: string;
    html?: string;
    composeFormat?: "text" | "html" | "markdown";
    quotedHtmlEdited?: boolean;
    attachments?: Array<{
      filename: string;
      contentType: string;
      inline?: boolean;
      cid?: string;
      dataUrl?: string;
    }>;
  }
) {
  const payload = await buildDraftInputForMode(context.account, context.accountId, args);
  const result = await saveDraftForAccount({
    account: context.account,
    accountId: context.accountId,
    clientId: `mcp:${context.tokenRecord.id}`,
    payload,
    localFlags: [AI_MODIFIED_FLAG],
    actor: mcpActor(context),
    authorization: { tokenId: context.tokenRecord.id }
  });

  let message = result.message;
  if (result.draftId) {
    message = await getMessageById(context.accountId, result.draftId);
  }

  if (message) await enrichMessagesWithThreadCollab([message], { accountId: context.accountId });
  return {
    ok: true,
    mode: args.mode ?? "new",
    referenceMessageId: args.messageId?.trim() || null,
    identityId: result.identityId,
    draftId: result.draftId,
    message,
    url: message ? messageUrl(message) : null
  };
}

async function updateDraftMessage(context: McpAccountContext, args: DraftUpdatePatch & { draftId: string }) {
  const { draftId: requestedDraftId, ...patch } = args;
  const existing = await getStoredDraft(context.accountId, requestedDraftId);
  const payload = await buildDraftUpdateInput(context.accountId, existing, patch);
  const result = await saveDraftForAccount({
    account: context.account,
    accountId: context.accountId,
    clientId: `mcp:${context.tokenRecord.id}`,
    payload,
    localFlags: [AI_MODIFIED_FLAG],
    actor: mcpActor(context),
    authorization: { tokenId: context.tokenRecord.id }
  });
  const message = result.draftId ? await getMessageById(context.accountId, result.draftId) : result.message;
  if (message) await enrichMessagesWithThreadCollab([message], { accountId: context.accountId });
  return {
    ok: true,
    mode: existing.xForwardedMessageId ? "forward" as const : existing.inReplyTo ? "reply" as const : "new" as const,
    identityId: result.identityId,
    draftId: result.draftId,
    previousDraftId: existing.id,
    draftIdChanged: result.draftId !== existing.id,
    message,
    url: message ? messageUrl(message) : null
  };
}

async function listDraftMessages(context: McpAccountContext, args: { page?: number; pageSize?: number }) {
  const draftsFolder = findDraftsFolder(await getFolders(context.accountId), context.accountId);
  if (!draftsFolder) throw new DraftSaveError(400, "Drafts folder not found");
  const page = normalizePage(args.page);
  const pageSize = normalizePageSize(args.pageSize);
  const data = await listMessages({
    accountId: context.accountId,
    viewerUserId: context.tokenRecord.createdByUserId,
    folderId: draftsFolder.id,
    page,
    pageSize,
    query: null,
    groupBy: "date"
  });
  const drafts = data.items.map(item => ({ draftId: item.id, subject: item.subject, to: item.to ?? "", cc: item.cc ?? "",
    updatedAt: item.dateValue, editable: hasMessageFlag(item.flags, "\\Draft"), url: messageUrl(item) }));
  return { ok: true, folderId: draftsFolder.id, drafts, total: data.total ?? drafts.length, hasMore: data.hasMore ?? false, page, pageSize };
}

class StatelessJsonResponseTransport implements Transport {
  sessionId = undefined;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void;
  private readonly responses: JSONRPCMessage[] = [];
  private readonly extra: MessageExtraInfo;
  private responseResolvers = new Map<string, () => void>();
  private readonly toolListIds = new Set<string>();

  constructor(extra: MessageExtraInfo, private readonly authorizeTool: (name: string) => Promise<void>,
    private readonly toolScopes: () => Promise<readonly McpScope[]>) {
    this.extra = extra;
  }

  /** tools/list advertises only tools the token's stored scopes allow; an unclassified tool fails the listing. */
  private async filterToolList(message: JSONRPCMessage): Promise<JSONRPCMessage> {
    if (!isJSONRPCResponse(message) || !Array.isArray(message.result.tools)) return message;
    try {
      const scopes = await this.toolScopes();
      const tools = (message.result.tools as { name: string }[]).filter(tool => scopes.includes(mcpToolScope(tool.name)));
      return { ...message, result: { ...message.result, tools } };
    } catch (error) {
      const text = error instanceof Error ? error.message : "MCP authorization failed";
      return { jsonrpc: "2.0", id: message.id, error: { code: ErrorCode.InternalError, message: text } };
    }
  }

  async start() {}

  async send(message: JSONRPCMessage) {
    if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
      const key = String(message.id);
      this.responses.push(this.toolListIds.has(key) ? await this.filterToolList(message) : message);
      this.responseResolvers.get(key)?.();
      this.responseResolvers.delete(key);
    }
  }

  async close() {
    this.onclose?.();
  }

  async dispatch(body: unknown) {
    if (Array.isArray(body) && body.length === 0) {
      return {
        ok: false as const,
        responses: [makeJsonRpcError(null, ErrorCode.InvalidRequest, "Invalid request")]
      };
    }

    const rawMessages = Array.isArray(body) ? body : [body];
    const parsedMessages: JSONRPCMessage[] = [];
    const parseErrors: ReturnType<typeof makeJsonRpcError>[] = [];
    for (const rawMessage of rawMessages) {
      const parsed = JSONRPCMessageSchema.safeParse(rawMessage);
      if (!parsed.success || isJSONRPCResponse(parsed.data) || isJSONRPCError(parsed.data)) {
        const id =
          typeof rawMessage === "object" && rawMessage && "id" in rawMessage
            ? ((rawMessage as { id?: RequestId | null }).id ?? null)
            : null;
        parseErrors.push(makeJsonRpcError(id, ErrorCode.InvalidRequest, "Invalid request"));
      } else {
        parsedMessages.push(parsed.data);
      }
    }
    if (parseErrors.length > 0 && parsedMessages.length === 0) {
      return { ok: false as const, responses: parseErrors };
    }
    // Responses are matched to their requests by String(id): a repeated id (also 1 and "1") would never resolve.
    const requestIds = parsedMessages.filter(isJSONRPCRequest).map((message) => String(message.id));
    if (new Set(requestIds).size !== requestIds.length) {
      return {
        ok: false as const,
        responses: [makeJsonRpcError(null, ErrorCode.InvalidRequest, "Invalid request: duplicate id in batch")]
      };
    }

    const responsePromises = parsedMessages
      .filter(isJSONRPCRequest)
      .map((message) => {
        const key = String(message.id);
        return new Promise<void>((resolve) => {
          this.responseResolvers.set(key, resolve);
        });
      });

    for (const message of parsedMessages) {
      if (isJSONRPCRequest(message) && message.method === "tools/call") {
        try { await this.authorizeTool(String(message.params?.name ?? "")); }
        catch (error) {
          const text = error instanceof Error ? error.message : "MCP authorization failed";
          await this.send({ jsonrpc: "2.0", id: message.id, result: { content: [{ type: "text", text }], isError: true } });
          continue;
        }
      }
      if (isJSONRPCRequest(message) && message.method === "tools/list") this.toolListIds.add(String(message.id));
      this.onmessage?.(message, this.extra);
    }

    await Promise.all(responsePromises);
    return {
      ok: true as const,
      responses: [...parseErrors, ...this.responses]
    };
  }
}

export async function executeMcpHttpRequest(params: {
  body: unknown;
  accountId: string;
  account: Account;
  tokenRecord: McpTokenMetadata;
  authInfo?: MessageExtraInfo["authInfo"];
  requestInfo?: MessageExtraInfo["requestInfo"];
}) {
  const context: McpAccountContext = {
    accountId: params.accountId,
    account: params.account,
    tokenRecord: params.tokenRecord,
    authInfo: params.authInfo,
    requestInfo: params.requestInfo
  };

  const server = new McpServer(MCP_SERVER_INFO, { capabilities: { tools: {} }, instructions: MCP_SERVER_INSTRUCTIONS });

  server.registerTool(
    "list_accounts",
    {
      title: "List mailboxes",
      description:
        "List the user's e-mail mailboxes (personal and shared) that this connection can use, with the user's role in each. Start here to get the accountId of a mailbox; each entry links to its inbox.",
      inputSchema: ACCOUNT_ID_ARG,
      annotations: READ_ONLY,
      outputSchema: LIST_ACCOUNTS_OUTPUT_SCHEMA
    },
    async ({ accountId }) => {
      if (accountId) await resolveAccountContext(context, accountId);
      const accounts = await listMcpTokenAccounts(context.tokenRecord.id);
      const summaries = accounts.map(({ account: { id, name, email, avatar }, role }) => ({ id, name, email, avatar, accessRole: role, url: appUrl({ accountId: id }) }));
      return buildToolResult([`Returned ${summaries.length} accounts.`,
        ...summaries.map(item => `- ${JSON.stringify(item.name)} <${item.email}> id=${item.id} role=${item.accessRole}: ${item.url}`)].join("\n"), {
        ok: true,
        accounts: summaries
      });
    }
  );

  server.registerTool(
    "list_mailbox_summary",
    {
      title: "Mailbox overview",
      description:
        "Show how much needs attention in a mailbox: unread messages, threads assigned to the user and unassigned open threads. Counts are for the user who created this connection.",
      inputSchema: ACCOUNT_ID_ARG,
      annotations: READ_ONLY,
      outputSchema: {
        ok: z.literal(true), generatedAt: z.number(), mailboxes: z.array(z.object({
          accountId: z.string(), name: z.string(), email: z.string(), accessRole: z.enum(["viewer", "editor", "manager"]),
          isOwner: z.boolean(), shared: z.boolean(), unread: z.number().nullable(), assignedToMe: z.number(), unassignedOpen: z.number(),
          watcher: z.object({ state: z.enum(["disabled", "starting", "idling", "backoff", "auth_failed", "stopped"]), lastEventAt: z.number().optional() }),
          url: URL_OUTPUT
        }))
      }
    },
    async ({ accountId }) => {
      const live = await resolveAccountContext(context, accountId);
      const summary = await getUserMailboxSummary(live.tokenRecord.createdByUserId, [live.accountId]);
      await resolveAccountContext(context, accountId);
      const mailboxes = summary.mailboxes.map(mailbox => ({ ...mailbox, url: appUrl({ accountId: mailbox.accountId }) }));
      return buildToolResult([`Returned ${mailboxes.length} mailbox summaries.`, ...mailboxes.map(item => `- ${item.email}: ${item.url}`)].join("\n"),
        { ...summary, mailboxes });
    }
  );

  server.registerTool(
    "list_folders",
    {
      title: "List folders",
      description:
        "List the folders of a mailbox (Inbox, Sent, Drafts, Archive, custom folders) with message and unread counts. Use a folder id with list_messages_by_folder or search_messages.",
      inputSchema: ACCOUNT_ID_ARG,
      annotations: READ_ONLY,
      outputSchema: LIST_FOLDERS_OUTPUT_SCHEMA
    },
    async ({ accountId: requestedAccountId }) => {
      const ctx = await resolveAccountContext(context, requestedAccountId);
      const folders = (await getFolders(ctx.accountId)).map(folder => ({ ...folder, url: appUrl({ accountId: ctx.accountId, folderId: folder.id }) }));
      return buildToolResult(formatFolderListContent(folders), {
        ok: true,
        folders
      });
    }
  );

  server.registerTool(
    "list_topics",
    {
      title: "List topics",
      description: "List the topics (labels) defined in a mailbox. Use topic ids or names with search_messages, assign_topics and unassign_topics.",
      inputSchema: ACCOUNT_ID_ARG,
      annotations: READ_ONLY
    },
    async ({ accountId: requestedAccountId }) => {
      const ctx = await resolveAccountContext(context, requestedAccountId);
      const topics = await listTopics(ctx.accountId);
      const url = settingsUrl(ctx.accountId, "topics");
      return buildToolResult(withLink(`Returned ${topics.length} topics.`, url), {
        ok: true,
        topics,
        url
      });
    }
  );

  server.registerTool(
    "list_mailing_list_aliases",
    {
      title: "List recipient aliases",
      description:
        "List the saved recipient aliases (mailing lists) of a mailbox. Each alias has a display name and the recipient list it expands to when writing an e-mail.",
      inputSchema: LIST_MAILING_LIST_ALIASES_SCHEMA,
      annotations: READ_ONLY,
      outputSchema: LIST_MAILING_LIST_ALIASES_OUTPUT_SCHEMA
    },
    async ({ accountId: requestedAccountId }) => {
      const ctx = await resolveAccountContext(context, requestedAccountId);
      const aliases = await listRecipientAliases(ctx.accountId);
      const url = settingsUrl(ctx.accountId, "recipient-aliases");
      return buildToolResult(withLink(`Returned ${aliases.length} mailing list aliases.`, url), {
        ok: true,
        aliases,
        url
      });
    }
  );

  server.registerTool(
    "check_new_mail",
    {
      title: "Check for new mail",
      description:
        "Fetch new e-mail from the mail server now and wait until the affected folders are synced. Use before searching when the user expects a message that just arrived.",
      inputSchema: ACCOUNT_ID_ARG,
      annotations: { ...READ_ONLY, openWorldHint: true }
    },
    async ({ accountId: requestedAccountId }) => {
      const ctx = await resolveAccountContext(context, requestedAccountId);
      const result = await runNewMailCheck(ctx.account, ctx.accountId, `mcp:${ctx.tokenRecord.id}`);
      const summary =
        result.foldersWithNewMail > 0
          ? `Synced ${result.foldersWithNewMail} folder(s) with new mail (checked ${result.foldersChecked}).${result.timedOut ? " Warning: timed out before all jobs completed." : ""}`
          : `No new mail found (checked ${result.foldersChecked} folder(s)).`;
      const url = appUrl({ accountId: ctx.accountId });
      return buildToolResult(withLink(summary, url), { ...result, url } as unknown as Record<string, unknown>);
    }
  );

  server.registerTool(
    "list_messages_by_folder",
    {
      title: "List messages in a folder",
      description:
        "List the e-mails in one folder of a mailbox, newest first, e.g. the inbox or the sent folder. Each message comes with a link that opens it. Use search_messages to find specific mail.",
      inputSchema: LIST_MESSAGES_BY_FOLDER_SCHEMA,
      annotations: READ_ONLY
    },
    async (args) => {
      const ctx = await resolveAccountContext(context, args.accountId);
      const listed = await listMessagesForFolder(ctx, args);
      const result = { ...listed, items: withMessageUrls(listed.items) };
      return buildToolResult(formatMessageListContent(result), result as unknown as Record<string, unknown>);
    }
  );

  server.registerTool(
    "search_messages",
    {
      title: "Find e-mails",
      description:
        "Find e-mails by text, sender, recipient, subject, date, topic, folder or badge (unread, flagged, to-do, attachments …) in a mailbox. Also finds related messages or all messages of a thread. Each result comes with a link that opens the message.",
      inputSchema: SEARCH_MESSAGES_SCHEMA,
      annotations: READ_ONLY,
      outputSchema: SEARCH_MESSAGES_OUTPUT_SCHEMA
    },
    async (args) => {
      const ctx = await resolveAccountContext(context, args.accountId);
      const found = await searchMessages(ctx, args);
      const result = { ...found, items: withMessageUrls(found.items) };
      return buildToolResult(formatMessageListContent(result), result as unknown as Record<string, unknown>);
    }
  );

  server.registerTool(
    "assign_topics",
    {
      title: "Add topics to a thread",
      description: "Label an e-mail conversation with one or more topics. The thread is selected by threadId or by one of its messageIds.",
      inputSchema: TOPIC_MUTATION_SCHEMA,
      annotations: IDEMPOTENT_CHANGE
    },
    async (args) => {
      const ctx = await resolveAccountContext(context, args.accountId, "editor");
      const result = await updateThreadTopics(ctx, args, "assign");
      const url = await threadUrl(ctx.accountId, { threadId: result.threadId, messageId: args.messageId?.trim() || undefined });
      return buildToolResult(withLink(`Assigned ${args.topics.length} topics to thread ${result.threadId}.`, url), { ...result, url });
    }
  );

  server.registerTool(
    "unassign_topics",
    {
      title: "Remove topics from a thread",
      description: "Remove one or more topic labels from an e-mail conversation. The thread is selected by threadId or by one of its messageIds.",
      inputSchema: TOPIC_MUTATION_SCHEMA,
      annotations: IDEMPOTENT_CHANGE
    },
    async (args) => {
      const ctx = await resolveAccountContext(context, args.accountId, "editor");
      const result = await updateThreadTopics(ctx, args, "unassign");
      const url = await threadUrl(ctx.accountId, { threadId: result.threadId, messageId: args.messageId?.trim() || undefined });
      return buildToolResult(withLink(`Removed ${args.topics.length} topics from thread ${result.threadId}.`, url), { ...result, url });
    }
  );

  server.registerTool("create_draft_message", {
    title: "Write an e-mail (draft)",
    description: `Write an e-mail: create a draft (new message, reply or forward) in the user's mailbox. For a reply or forward pass mode and the messageId of the original. The user reviews and sends the draft in Noctua Mail; nothing is sent by this tool. The result includes a link that opens the draft. identityId selects an enabled sender identity of this mailbox. To change an existing draft use update_draft_message. ${DRAFT_EDIT_HINT}`,
    inputSchema: z.object(CREATE_DRAFT_MESSAGE_SCHEMA).strict(),
    annotations: ADDITIVE_CHANGE,
    outputSchema: senderToolOutput({ mode: z.enum(["new", "reply", "forward"]), referenceMessageId: z.string().nullable(),
      identityId: z.string(), draftId: z.string().nullable(), message: z.object(SEARCH_RESULT_MESSAGE_SCHEMA).passthrough().nullable(),
      url: URL_OUTPUT.nullable() })
  }, async args => {
    const ctx = await resolveAccountContext(context, args.accountId, "editor");
    return senderToolCall(async () => {
      const result = await createDraftMessage(ctx, args);
      return buildToolResult(withLink(`Created ${result.mode} draft${result.draftId ? ` ${result.draftId}` : ""}.`, result.url), result);
    });
  });

  server.registerTool("list_draft_messages", {
    title: "List drafts",
    description: `List the unsent drafts in this mailbox's Drafts folder, newest first, each with a link that opens it. editable=false marks messages without the \\Draft flag. ${DRAFT_EDIT_HINT}`,
    inputSchema: z.object({ ...ACCOUNT_ID_ARG, page: z.number().int().min(1).optional(),
      pageSize: z.number().int().min(1).max(MCP_MAX_PAGE_SIZE).optional() }).strict(),
    annotations: READ_ONLY,
    outputSchema: senderToolOutput({ folderId: z.string(), drafts: z.array(z.object({ draftId: z.string(), subject: z.string(), to: z.string(),
      cc: z.string(), updatedAt: z.number(), editable: z.boolean(), url: URL_OUTPUT })), total: z.number(), hasMore: z.boolean(), page: z.number(), pageSize: z.number() })
  }, async args => {
    const ctx = await resolveAccountContext(context, args.accountId);
    return senderToolCall(async () => {
      const result = await listDraftMessages(ctx, args);
      return buildToolResult([`Returned ${result.drafts.length} drafts (${result.total} total).`,
        ...result.drafts.map(draft => `- ${JSON.stringify(draft.subject)} id=${draft.draftId}: ${draft.url}`)].join("\n"), result);
    });
  });

  server.registerTool("get_draft_message", {
    title: "Read a draft",
    description: `Read an existing draft with everything needed to revise it: sender identity, recipients, subject, body (text and, if stored, html/markdown), reply/forward references and attachment names/sizes, plus a link that opens it. ${DRAFT_EDIT_HINT}`,
    inputSchema: z.object({ ...ACCOUNT_ID_ARG, ...DRAFT_ID_ARG }).strict(),
    annotations: READ_ONLY,
    outputSchema: senderToolOutput({ draft: EDITABLE_DRAFT_SCHEMA, url: URL_OUTPUT })
  }, async args => {
    const ctx = await resolveAccountContext(context, args.accountId);
    return senderToolCall(async () => {
      const stored = await getStoredDraft(ctx.accountId, args.draftId);
      const draft = await toEditableDraft(ctx.accountId, stored);
      const url = messageUrl(stored);
      return buildToolResult(withLink(`Draft ${draft.draftId}: ${JSON.stringify(draft.subject)}.`, url), { ok: true, draft, url });
    });
  });

  server.registerTool("update_draft_message", {
    title: "Revise a draft",
    description: `Revise an existing draft in place (recipients, subject, sender or text). Only the fields you pass change; everything else (sender, recipients, subject, body, reply/forward headers, attachments) is kept. Use appendBody to add a sentence or paragraph, or text/html/markdown to replace the whole body (read it first with get_draft_message). Saving may assign a new draft id: always continue with the returned draftId (draftIdChanged tells you). The result includes a link that opens the draft. ${DRAFT_EDIT_HINT}`,
    inputSchema: z.object(UPDATE_DRAFT_MESSAGE_SCHEMA).strict(),
    annotations: ADDITIVE_CHANGE,
    outputSchema: senderToolOutput({ mode: z.enum(["new", "reply", "forward"]), identityId: z.string(), draftId: z.string().nullable(),
      previousDraftId: z.string(), draftIdChanged: z.boolean(), message: z.object(SEARCH_RESULT_MESSAGE_SCHEMA).passthrough().nullable(),
      url: URL_OUTPUT.nullable() })
  }, async args => {
    const ctx = await resolveAccountContext(context, args.accountId, "editor");
    return senderToolCall(async () => {
      const { accountId: _accountId, ...input } = args; void _accountId;
      const result = await updateDraftMessage(ctx, input);
      return buildToolResult(withLink(`Updated draft ${result.previousDraftId}${result.draftIdChanged ? `; its new id is ${result.draftId}` : ""}.`, result.url), result);
    });
  });

  server.registerTool("list_sender_identities", {
    title: "List sender identities",
    description: "List the sender addresses (identities) the user can write from in this mailbox, and which one is used by default.",
    inputSchema: z.object(ACCOUNT_ID_ARG).strict(),
    annotations: READ_ONLY,
    outputSchema: senderToolOutput({ identities: z.array(SENDER_IDENTITY_SCHEMA), defaultIdentityId: z.string().optional(),
      effectiveDefaultIdentityId: z.string().optional(), ownAddresses: z.array(z.string()), warnings: z.array(z.string()), recomputeJob: IDENTITY_JOB_SCHEMA,
      url: URL_OUTPUT })
  }, async args => {
    const ctx = await resolveAccountContext(context, args.accountId);
    const identities = await listSenderIdentities(ctx.accountId);
    const prefs = await getUserAccountPrefs(ctx.tokenRecord.createdByUserId, ctx.accountId);
    const resolved = resolveComposeIdentity({ accountId: ctx.accountId, identities, prefs });
    const url = settingsUrl(ctx.accountId, "identities");
    return buildToolResult(withLink("Sender identities.", url), { ok: true, identities,
      defaultIdentityId: identities.find(item => item.isDefault)?.id,
      effectiveDefaultIdentityId: resolved.identity?.id, ownAddresses: getOwnAddresses(ctx.account, identities),
      warnings: resolved.warnings, recomputeJob: getIdentityRecomputeJob(ctx.accountId), url });
  });
  server.registerTool("create_sender_identity", {
    title: "Add a sender identity",
    description: "Add a sender address (identity) the mailbox can write from, with display name, optional reply-to and signature (mailbox managers only). Does not verify the mail provider's send-as permission. The result links to the identity settings.",
    inputSchema: z.object({ ...ACCOUNT_ID_ARG, email: z.string().max(254), displayName: z.string().max(256),
      replyTo: z.string().max(254).optional(), signatureId: z.string().min(1).max(256).optional(),
      isDefault: z.boolean().optional(), enabled: z.boolean().optional() }).strict(),
    annotations: ADDITIVE_CHANGE,
    outputSchema: senderToolOutput({ identity: SENDER_IDENTITY_SCHEMA, recomputeJob: IDENTITY_JOB_SCHEMA, url: URL_OUTPUT })
  }, async args => {
    const ctx = await resolveAccountContext(context, args.accountId, "manager");
    return senderToolCall(async () => {
      const { accountId: _accountId, ...input } = args; void _accountId;
      const url = settingsUrl(ctx.accountId, "identities");
      return buildToolResult(withLink("Sender identity created.", url), { ok: true, ...await createSenderIdentityWithRecompute(ctx.accountId, input, { ...mcpActor(ctx),
        beforeWrite: () => authorizeOutbound({ tokenId: ctx.tokenRecord.id }, { accountId: ctx.accountId, minRole: "manager", purpose: "identity-management" }) }), url });
    });
  });
  server.registerTool("update_sender_identity", {
    title: "Change a sender identity",
    description: "Change a sender identity's display name, reply-to, signature or default flag, or disable it (mailbox managers only). The address itself cannot be changed. The result links to the identity settings.",
    inputSchema: z.object({ ...ACCOUNT_ID_ARG, identityId: z.string().min(1).max(256), patch: z.object({
      displayName: z.string().max(256).optional(), replyTo: z.string().max(254).nullable().optional(),
      signatureId: z.string().min(1).max(256).nullable().optional(), isDefault: z.boolean().optional(), enabled: z.boolean().optional()
    }).strict() }).strict(),
    annotations: IDEMPOTENT_CHANGE,
    outputSchema: senderToolOutput({ identity: SENDER_IDENTITY_SCHEMA, url: URL_OUTPUT })
  }, async args => {
    const ctx = await resolveAccountContext(context, args.accountId, "manager");
    const url = settingsUrl(ctx.accountId, "identities");
    return senderToolCall(async () => buildToolResult(withLink("Sender identity updated.", url), { ok: true,
      identity: await updateSenderIdentity(ctx.accountId, args.identityId, args.patch, { ...mcpActor(ctx),
        beforeWrite: () => authorizeOutbound({ tokenId: ctx.tokenRecord.id }, { accountId: ctx.accountId, minRole: "manager", purpose: "identity-management" }) }), url }));
  });
  server.registerTool("get_sender_preferences", {
    title: "Read my sender preferences",
    description: "Read which sender identity and signature the user writes with by default in this mailbox (the user's own preferences).",
    inputSchema: z.object(ACCOUNT_ID_ARG).strict(), annotations: READ_ONLY, outputSchema: senderToolOutput({ prefs: SENDER_PREFS_SCHEMA, url: URL_OUTPUT })
  }, async args => {
    const ctx = await resolveAccountContext(context, args.accountId);
    const url = settingsUrl(ctx.accountId, "preferences");
    return buildToolResult(withLink("Sender preferences.", url), { ok: true, prefs: senderPrefs(await getUserAccountPrefs(ctx.tokenRecord.createdByUserId, ctx.accountId)), url });
  });
  server.registerTool("set_sender_preferences", {
    title: "Change my sender preferences",
    description: "Change which sender identity and signature the user writes with by default in this mailbox (the user's own preferences). Null restores the mailbox default; an empty signature means none.",
    inputSchema: z.object({ ...ACCOUNT_ID_ARG, patch: accountPrefsPatchSchema.pick({ defaultIdentityId: true, defaultSignatureId: true, signatureOverride: true }) }).strict(),
    annotations: IDEMPOTENT_CHANGE,
    outputSchema: senderToolOutput({ prefs: SENDER_PREFS_SCHEMA, url: URL_OUTPUT })
  }, async args => {
    const ctx = await resolveAccountContext(context, args.accountId);
    return senderToolCall(async () => {
      if (args.patch.defaultSignatureId && !ctx.account.settings?.signatures?.some(item => item.id === args.patch.defaultSignatureId)) {
        throw new SenderIdentityError("invalid_preferences", 400, "Choose a signature template from this mailbox");
      }
      if (args.patch.defaultIdentityId && !(await listSenderIdentities(ctx.accountId)).some(identity => identity.id === args.patch.defaultIdentityId && identity.enabled)) {
        throw new InvalidAccountPreferencesError();
      }
      const prefs = await mergeUserAccountPrefs(ctx.tokenRecord.createdByUserId, ctx.accountId, args.patch,
        () => authorizeOutbound({ tokenId: ctx.tokenRecord.id }, { accountId: ctx.accountId, minRole: "viewer", purpose: "identity-management", identity: args.patch.defaultIdentityId ?? undefined }));
      const url = settingsUrl(ctx.accountId, "preferences");
      return buildToolResult(withLink("Sender preferences saved.", url), { ok: true, prefs: senderPrefs(prefs), url });
    });
  });

  server.registerTool("list_signature_templates", {
    title: "List signatures",
    description: `List the e-mail signatures (templates with body) of this mailbox and the mailbox default. Placeholders: ${SIGNATURE_PLACEHOLDERS}.`,
    inputSchema: z.object(ACCOUNT_ID_ARG).strict(),
    annotations: READ_ONLY,
    outputSchema: senderToolOutput({ ...SIGNATURE_TEMPLATES_OUTPUT, url: URL_OUTPUT })
  }, async args => {
    const ctx = await resolveAccountContext(context, args.accountId);
    const result = listSignatureTemplates(ctx.account.settings);
    const url = settingsUrl(ctx.accountId, "signatures");
    return buildToolResult(withLink(`Returned ${result.signatures.length} signature templates.`, url), { ok: true, ...result, url });
  });
  server.registerTool("save_signature_template", {
    title: "Create or edit a signature",
    description: `Create an e-mail signature for this mailbox (omit signatureId) or replace the name and text of an existing one (mailbox managers only). Plain text, at most 8 KiB; placeholders: ${SIGNATURE_PLACEHOLDERS}. The result links to the signature settings.`,
    inputSchema: z.object({ ...ACCOUNT_ID_ARG, signatureId: SIGNATURE_ID_ARG.optional(), name: z.string().trim().min(1).max(256), body: z.string() }).strict(),
    annotations: ADDITIVE_CHANGE,
    outputSchema: senderToolOutput({ signature: SIGNATURE_TEMPLATE_SCHEMA, ...SIGNATURE_TEMPLATES_OUTPUT, url: URL_OUTPUT })
  }, async args => {
    const ctx = await resolveAccountContext(context, args.accountId, "manager");
    return senderToolCall(async () => {
      const result = await saveSignatureTemplate(ctx.accountId, args, identityManagementActor(ctx));
      const url = settingsUrl(ctx.accountId, "signatures");
      return buildToolResult(withLink(`Saved signature template ${result.signature.id}.`, url), { ok: true, ...result, url });
    });
  });
  server.registerTool("delete_signature_template", {
    title: "Delete a signature",
    description: "Delete an e-mail signature of this mailbox (mailbox managers only). Fails with signature_in_use while a sender identity uses it; clears the mailbox default if it was the default.",
    inputSchema: z.object({ ...ACCOUNT_ID_ARG, signatureId: SIGNATURE_ID_ARG }).strict(),
    annotations: DESTRUCTIVE_CHANGE,
    outputSchema: senderToolOutput({ ...SIGNATURE_TEMPLATES_OUTPUT, url: URL_OUTPUT })
  }, async args => {
    const ctx = await resolveAccountContext(context, args.accountId, "manager");
    const url = settingsUrl(ctx.accountId, "signatures");
    return senderToolCall(async () => buildToolResult(withLink(`Deleted signature template ${args.signatureId}.`, url), { ok: true,
      ...await deleteSignatureTemplate(ctx.accountId, args.signatureId, identityManagementActor(ctx)), url }));
  });
  server.registerTool("set_default_signature_template", {
    title: "Set the default signature",
    description: "Choose the signature this mailbox uses by default (mailbox managers only). Null or an empty id means no default. Members' own choices (set_sender_preferences) still take precedence.",
    inputSchema: z.object({ ...ACCOUNT_ID_ARG, signatureId: z.string().trim().max(256).nullable() }).strict(),
    annotations: IDEMPOTENT_CHANGE,
    outputSchema: senderToolOutput({ ...SIGNATURE_TEMPLATES_OUTPUT, url: URL_OUTPUT })
  }, async args => {
    const ctx = await resolveAccountContext(context, args.accountId, "manager");
    return senderToolCall(async () => {
      const result = await setDefaultSignatureTemplate(ctx.accountId, args.signatureId || null, identityManagementActor(ctx));
      const url = settingsUrl(ctx.accountId, "signatures");
      return buildToolResult(withLink(result.defaultSignatureId ? `Default signature template is ${result.defaultSignatureId}.` : "No default signature template.", url),
        { ok: true, ...result, url });
    });
  });

  const setFlagged = async (requestedAccountId: string | undefined, messageId: string, value: boolean) => {
    const ctx = await resolveAccountContext(context, requestedAccountId, "editor");
    const message = await getMessageById(ctx.accountId, messageId);
    if (!message) {
      throw new Error("Message not found");
    }
    const nextFlags = await applyFlagMutationsToMessage({
      accountId: ctx.accountId,
      account: ctx.account,
      messageId,
      message,
      flag: "flagged",
      value,
      clientId: `mcp:${ctx.tokenRecord.id}`
    });
    const finalFlags = await markMessageAiModified(ctx.accountId, messageId);
    const url = messageUrl(message);
    return buildToolResult(withLink(`${value ? "Flagged" : "Unflagged"} message ${messageId}.`, url), {
      ok: true,
      messageId,
      flags: finalFlags.length > 0 ? finalFlags : nextFlags,
      url
    });
  };

  server.registerTool(
    "flag_message",
    { title: "Flag an e-mail", description: "Flag (star) an e-mail so it stands out for follow-up.", inputSchema: MESSAGE_ID_SCHEMA, annotations: IDEMPOTENT_CHANGE },
    async ({ accountId: requestedAccountId, messageId }) => setFlagged(requestedAccountId, messageId, true)
  );

  server.registerTool(
    "unflag_message",
    { title: "Unflag an e-mail", description: "Remove the flag (star) from an e-mail.", inputSchema: MESSAGE_ID_SCHEMA, annotations: IDEMPOTENT_CHANGE },
    async ({ accountId: requestedAccountId, messageId }) => setFlagged(requestedAccountId, messageId, false)
  );

  server.registerTool(
    "mark_message_todo",
    { title: "Mark an e-mail as to-do", description: "Put an e-mail on the user's to-do list (clears a done mark).", inputSchema: MESSAGE_ID_SCHEMA, annotations: IDEMPOTENT_CHANGE },
    async ({ accountId: requestedAccountId, messageId }) => {
      const ctx = await resolveAccountContext(context, requestedAccountId, "editor");
      const result = await updateTodoState(ctx, messageId, "todo");
      return buildToolResult(withLink(`Marked message ${messageId} as To-Do.`, result.url), result);
    }
  );

  server.registerTool(
    "mark_message_done",
    { title: "Mark an e-mail as done", description: "Mark an e-mail as done (clears a to-do mark).", inputSchema: MESSAGE_ID_SCHEMA, annotations: IDEMPOTENT_CHANGE },
    async ({ accountId: requestedAccountId, messageId }) => {
      const ctx = await resolveAccountContext(context, requestedAccountId, "editor");
      const result = await updateTodoState(ctx, messageId, "done");
      return buildToolResult(withLink(`Marked message ${messageId} as Done.`, result.url), result);
    }
  );

  server.registerTool(
    "clear_message_todo",
    { title: "Clear to-do and done", description: "Remove both the to-do and the done mark from an e-mail.", inputSchema: MESSAGE_ID_SCHEMA, annotations: IDEMPOTENT_CHANGE },
    async ({ accountId: requestedAccountId, messageId }) => {
      const ctx = await resolveAccountContext(context, requestedAccountId, "editor");
      const result = await updateTodoState(ctx, messageId, "clear");
      return buildToolResult(withLink(`Cleared To-Do state from message ${messageId}.`, result.url), result);
    }
  );

  const targetSchema = { ...ACCOUNT_ID_ARG, threadId: z.string().min(1).optional(), messageId: z.string().min(1).optional() };
  const statusSchema = z.enum(["open", "in_progress", "waiting", "closed"]);
  const stateSchema = z.object({ accountId: z.string(), threadId: z.string(), status: statusSchema,
    assigneeUserId: z.string().nullable(), assignedByUserId: z.string().nullable(), assignedAt: z.number().nullable(),
    statusChangedAt: z.number().nullable(), statusChangedByUserId: z.string().nullable(), commentCount: z.number(),
    lastActivityAt: z.number(), updatedAt: z.number(), updatedByUserId: z.string().nullable() });
  const commentSchema = z.object({ id: z.string(), accountId: z.string(), threadId: z.string(), authorUserId: z.string(),
    body: z.string(), createdAt: z.number(), updatedAt: z.number(), deletedAt: z.number().nullable() });
  const activitySchema = z.object({ id: z.string(), accountId: z.string(), threadId: z.string(), type: z.string(),
    actorUserId: z.string().nullable(), actorClientId: z.string(), payload: z.record(z.string(), z.unknown()), createdAt: z.number() });
  server.registerTool("list_mailbox_members", { title: "List mailbox members",
    description: "List the people who share this mailbox and their roles (e.g. to pick an assignee for assign_thread). Disabled members are visible to managers only.",
    inputSchema: ACCOUNT_ID_ARG, annotations: READ_ONLY,
    outputSchema: { ok: z.boolean(), members: z.array(z.object({ userId: z.string(), name: z.string().nullable(), email: z.string(), role: z.enum(["viewer", "editor", "manager"]), isOwner: z.boolean(), disabled: z.boolean().optional() })), url: URL_OUTPUT } },
    async args => { const ctx = await resolveAccountContext(context, args.accountId); const url = settingsUrl(ctx.accountId, "members");
      return buildToolResult(withLink("Mailbox members.", url), { ok: true, members: await listAccountMembersForRole(ctx.accountId, ctx.role), url }); });
  server.registerTool("get_thread_collaboration", { title: "Read team notes on a thread",
    description: "Read how the team handles an e-mail conversation in a shared mailbox: status, assignee, internal comments and activity. Select the thread by threadId or messageId.",
    inputSchema: targetSchema, annotations: READ_ONLY,
    outputSchema: { ok: z.boolean(), threadId: z.string(), state: stateSchema, comments: z.array(commentSchema), activity: z.array(activitySchema), url: URL_OUTPUT } },
    async args => { const ctx = await resolveAccountContext(context, args.accountId); const target = await resolveThreadTarget(ctx, args); const { threadId } = target;
      const [state, comments, activity, url] = await Promise.all([getThreadCollabState(ctx.accountId, threadId), listThreadComments(ctx.accountId, threadId), listThreadActivity(ctx.accountId, threadId), threadUrl(ctx.accountId, target)]);
      return buildToolResult(withLink("Thread collaboration.", url), { ok: true, threadId, state, comments, activity, url }); });
  server.registerTool("set_thread_status", { title: "Set thread status",
    description: "Set the team status of an e-mail conversation (open, in progress, waiting, closed) without changing message flags. The result links to the thread.",
    inputSchema: { ...targetSchema, status: statusSchema }, annotations: IDEMPOTENT_CHANGE,
    outputSchema: { ok: z.boolean(), state: stateSchema, url: URL_OUTPUT } }, async args => {
      const ctx = await resolveAccountContext(context, args.accountId, "editor"); const target = await resolveThreadTarget(ctx, args);
      const state = await updateThreadCollabState(ctx.accountId, target.threadId, { status: args.status }, mcpActor(ctx));
      if (!state) throw new Error("Thread not found"); const url = await threadUrl(ctx.accountId, target);
      return buildToolResult(withLink("Thread status updated.", url), { ok: true, state, url }); });
  server.registerTool("assign_thread", { title: "Assign a thread",
    description: "Assign an e-mail conversation to a mailbox member who should handle it; 'me' selects the user, null unassigns. The result links to the thread.",
    inputSchema: { ...targetSchema, assigneeUserId: z.string().min(1).nullable() }, annotations: IDEMPOTENT_CHANGE,
    outputSchema: { ok: z.boolean(), state: stateSchema, url: URL_OUTPUT } }, async args => {
      const ctx = await resolveAccountContext(context, args.accountId, "editor"); const target = await resolveThreadTarget(ctx, args);
      const assigneeUserId = args.assigneeUserId === "me" ? ctx.tokenRecord.createdByUserId : args.assigneeUserId;
      const state = await updateThreadCollabState(ctx.accountId, target.threadId, { assigneeUserId }, mcpActor(ctx));
      if (!state) throw new Error("Thread not found"); const url = await threadUrl(ctx.accountId, target);
      return buildToolResult(withLink("Thread assignment updated.", url), { ok: true, state, url }); });
  server.registerTool("add_internal_comment", { title: "Add an internal note",
    description: "Add an internal Markdown note to an e-mail conversation for the mailbox team; it is never sent to the correspondents. The result links to the thread.",
    inputSchema: { ...targetSchema, body: z.string().min(1).max(20000) }, annotations: ADDITIVE_CHANGE,
    outputSchema: { ok: z.boolean(), comment: commentSchema, state: stateSchema, url: URL_OUTPUT } }, async args => {
      const ctx = await resolveAccountContext(context, args.accountId, "editor"); const target = await resolveThreadTarget(ctx, args);
      const result = await addThreadComment(ctx.accountId, target.threadId, args.body, mcpActor(ctx));
      if (!result) throw new Error("Thread not found"); const url = await threadUrl(ctx.accountId, target);
      return buildToolResult(withLink("Internal comment added.", url), { ok: true, ...result, url }); });
  server.registerTool("list_thread_activity", { title: "List thread activity",
    description: "List what happened in an e-mail conversation in a shared mailbox (status changes, assignments, comments), newest first.",
    inputSchema: { ...targetSchema, limit: z.number().int().min(1).max(500).optional() }, annotations: READ_ONLY,
    outputSchema: { ok: z.boolean(), activity: z.array(activitySchema), url: URL_OUTPUT } }, async args => {
      const ctx = await resolveAccountContext(context, args.accountId); const target = await resolveThreadTarget(ctx, args);
      const [activity, url] = await Promise.all([listThreadActivity(ctx.accountId, target.threadId, { limit: args.limit }), threadUrl(ctx.accountId, target)]);
      return buildToolResult(withLink("Thread activity.", url), { ok: true, activity, url }); });

  const transport = new StatelessJsonResponseTransport({
    authInfo: params.authInfo,
    requestInfo: params.requestInfo
  }, name => assertMcpToolPermission(context.tokenRecord.id, name), () => mcpTokenScopes(context.tokenRecord.id));
  await server.connect(transport);

  try {
    return await transport.dispatch(params.body);
  } finally {
    await server.close();
    await transport.close();
  }
}
