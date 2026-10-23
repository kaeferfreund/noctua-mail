import { authorizeOutbound } from "./outboundAuthorization";
import { resolveComposeIdentity } from "./senderIdentitySelection";
import { createSenderIdentityWithRecompute, updateSenderIdentity, SenderIdentityError } from "./senderIdentities";
import { getIdentityRecomputeJob } from "./threadRecomputeJobs";
import { accountPrefsPatchSchema } from "./accountPrefs";
import { getUserAccountPrefs, mergeUserAccountPrefs, listSenderIdentities, InvalidAccountPreferencesError } from "./serverDb";
import { getUserMailboxSummary } from "@/lib/mailboxSummary";
import { listAccessibleAccountsForUser, listAccountMembersForRole } from "@/lib/accountAccess";
import { getOwnAddresses } from "@/lib/ownAddresses";
import { resolveMcpToolContext } from "@/lib/mcpAuth";
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
import {
  addThreadTopic,
  getTopicsForThread,
  listTopics,
  removeThreadTopic
} from "@/lib/topics";
import { listRecipientAliases } from "@/lib/recipientAliases";
import {
  AI_MODIFIED_FLAG,
  DONE_FLAG,
  TODO_FLAG,
  appendMessageFlags,
  hasAiModifiedFlag,
  hasDoneFlag,
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
  folders: z.array(z.object(FOLDER_SCHEMA))
};

const ACCOUNT_SUMMARY_SCHEMA = {
  id: z.string(),
  name: z.string(),
  email: z.string(),
  avatar: z.string(),
  accessRole: z.enum(["viewer", "editor", "manager"])
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
  aliases: z.array(z.object(MAILING_LIST_ALIAS_SCHEMA))
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
  collab: z.object({ status: z.enum(["open", "in_progress", "waiting", "closed"]), assigneeUserId: z.string().nullable(), commentCount: z.number(), updatedAt: z.number() }).optional()
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

async function senderToolCall(run: () => Promise<ReturnType<typeof buildToolResult>>) {
  try { return await run(); }
  catch (error) {
    if (error instanceof SenderIdentityError || error instanceof InvalidAccountPreferencesError || error instanceof DraftSaveError) {
      const code = error instanceof SenderIdentityError ? error.code : error instanceof InvalidAccountPreferencesError ? "invalid_preferences" : "invalid_draft";
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
  const id = requestedAccountId?.trim() || baseContext.accountId;
  if (id !== baseContext.accountId) throw new Error("MCP token is bound to another mailbox");
  const live = await resolveMcpToolContext(baseContext.tokenRecord.id, id, minRole);
  return { ...baseContext, ...live };
}
function mcpActor(context: McpAccountContext) {
  return { userId: context.tokenRecord.createdByUserId, clientId: `mcp:${context.tokenRecord.id}` };
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

function formatFolderListContent(folders: Folder[]) {
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
    return `- ${parts.join(" ")}`;
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
    state: targetState
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
    actor: mcpActor(context),
    authorization: { tokenId: context.tokenRecord.id }
  });

  let message = result.message;
  if (result.draftId) {
    await markMessageAiModified(context.accountId, result.draftId);
    message = await getMessageById(context.accountId, result.draftId);
  }

  if (message) await enrichMessagesWithThreadCollab([message], { accountId: context.accountId });
  return {
    ok: true,
    mode: args.mode ?? "new",
    referenceMessageId: args.messageId?.trim() || null,
    identityId: result.identityId,
    draftId: result.draftId,
    message
  };
}

class StatelessJsonResponseTransport implements Transport {
  sessionId = undefined;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage, extra?: MessageExtraInfo) => void;
  private readonly responses: JSONRPCMessage[] = [];
  private readonly extra: MessageExtraInfo;
  private responseResolvers = new Map<string, () => void>();

  constructor(extra: MessageExtraInfo) {
    this.extra = extra;
  }

  async start() {}

  async send(message: JSONRPCMessage) {
    if (isJSONRPCResponse(message) || isJSONRPCError(message)) {
      this.responses.push(message);
      const key = String(message.id);
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

    const responsePromises = parsedMessages
      .filter(isJSONRPCRequest)
      .map((message) => {
        const key = String(message.id);
        return new Promise<void>((resolve) => {
          this.responseResolvers.set(key, resolve);
        });
      });

    for (const message of parsedMessages) {
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

  const server = new McpServer(
    {
      name: "mywebmail-mcp",
      version: "0.1.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  server.registerTool(
    "list_accounts",
    {
      description: "List all accounts accessible to the authenticated user.",
      inputSchema: ACCOUNT_ID_ARG,
      outputSchema: LIST_ACCOUNTS_OUTPUT_SCHEMA
    },
    async ({ accountId }) => {
      await resolveAccountContext(context, accountId);
      const userId = context.authInfo?.extra?.["userId"] as string | undefined;
      if (!userId) {
        throw new Error("User identity not available in token.");
      }
      const accounts = await listAccessibleAccountsForUser(userId);
      const summaries = accounts.map(({ account: { id, name, email, avatar }, role }) => ({ id, name, email, avatar, accessRole: role }));
      return buildToolResult(`Returned ${summaries.length} accounts.`, {
        ok: true,
        accounts: summaries
      });
    }
  );

  server.registerTool(
    "list_mailbox_summary",
    {
      description: "Read unread, assigned-to-me and unassigned-open counts for the token's accessible mailbox. Counts use the token creator as viewer.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true },
      outputSchema: {
        ok: z.literal(true), generatedAt: z.number(), mailboxes: z.array(z.object({
          accountId: z.string(), name: z.string(), email: z.string(), accessRole: z.enum(["viewer", "editor", "manager"]),
          isOwner: z.boolean(), shared: z.boolean(), unread: z.number().nullable(), assignedToMe: z.number(), unassignedOpen: z.number(),
          watcher: z.object({ state: z.enum(["disabled", "starting", "idling", "backoff", "auth_failed", "stopped"]), lastEventAt: z.number().optional() })
        }))
      }
    },
    async () => {
      const live = await resolveAccountContext(context);
      // MCP tokens are mailbox-bound: metadata enumeration is not authority
      // to read counts from the creator's other mailboxes.
      const summary = await getUserMailboxSummary(live.tokenRecord.createdByUserId, [live.accountId]);
      await resolveAccountContext(context);
      return buildToolResult(`Returned ${summary.mailboxes.length} mailbox summaries.`, summary);
    }
  );

  server.registerTool(
    "list_folders",
    {
      description: "List folders for the authenticated account.",
      inputSchema: ACCOUNT_ID_ARG,
      outputSchema: LIST_FOLDERS_OUTPUT_SCHEMA
    },
    async ({ accountId: requestedAccountId }) => {
      const ctx = await resolveAccountContext(context, requestedAccountId);
      const folders = await getFolders(ctx.accountId);
      return buildToolResult(formatFolderListContent(folders), {
        ok: true,
        folders
      });
    }
  );

  server.tool(
    "list_topics",
    "List topics for the authenticated account.",
    ACCOUNT_ID_ARG,
    async ({ accountId: requestedAccountId }) => {
      const ctx = await resolveAccountContext(context, requestedAccountId);
      const topics = await listTopics(ctx.accountId);
      return buildToolResult(`Returned ${topics.length} topics.`, {
        ok: true,
        topics
      });
    }
  );

  server.registerTool(
    "list_mailing_list_aliases",
    {
      description:
        "List saved mailing list aliases for the authenticated account. Each alias includes its display name and the expanded recipient list that will be inserted during compose.",
      inputSchema: LIST_MAILING_LIST_ALIASES_SCHEMA,
      outputSchema: LIST_MAILING_LIST_ALIASES_OUTPUT_SCHEMA
    },
    async ({ accountId: requestedAccountId }) => {
      const ctx = await resolveAccountContext(context, requestedAccountId);
      const aliases = await listRecipientAliases(ctx.accountId);
      return buildToolResult(`Returned ${aliases.length} mailing list aliases.`, {
        ok: true,
        aliases
      });
    }
  );

  server.tool(
    "check_new_mail",
    "Check for new mail and sync any folders with new messages. Waits for sync to complete before returning.",
    ACCOUNT_ID_ARG,
    async ({ accountId: requestedAccountId }) => {
      const ctx = await resolveAccountContext(context, requestedAccountId);
      const result = await runNewMailCheck(ctx.account, ctx.accountId, `mcp:${ctx.tokenRecord.id}`);
      const summary =
        result.foldersWithNewMail > 0
          ? `Synced ${result.foldersWithNewMail} folder(s) with new mail (checked ${result.foldersChecked}).${result.timedOut ? " Warning: timed out before all jobs completed." : ""}`
          : `No new mail found (checked ${result.foldersChecked} folder(s)).`;
      return buildToolResult(summary, result as unknown as Record<string, unknown>);
    }
  );

  server.tool(
    "list_messages_by_folder",
    "List lightweight message rows for one folder.",
    LIST_MESSAGES_BY_FOLDER_SCHEMA,
    async (args: {
      accountId?: string;
      folderId: string;
      page?: number;
      pageSize?: number;
      groupBy?: string;
      badges?: string[];
      attachmentsOnly?: boolean;
      excludedFolderIds?: string[];
    }) => {
      const ctx = await resolveAccountContext(context, args.accountId);
      const result = await listMessagesForFolder(ctx, args);
      return buildToolResult(buildSummary(result), result as unknown as Record<string, unknown>);
    }
  );

  server.registerTool(
    "search_messages",
    {
      description:
        "Search messages using standard, related, or thread-related modes. Standard mode supports query, topic, sender, recipient, participant, folder, badge, attachment, pagination, and grouping filters.",
      inputSchema: SEARCH_MESSAGES_SCHEMA,
      outputSchema: SEARCH_MESSAGES_OUTPUT_SCHEMA
    },
    async (args) => {
      const ctx = await resolveAccountContext(context, args.accountId);
      const result = await searchMessages(ctx, args);
      return buildToolResult(buildSummary(result), result as unknown as Record<string, unknown>);
    }
  );

  server.tool(
    "assign_topics",
    "Assign one or more topics to a thread, resolved by threadId or messageId.",
    TOPIC_MUTATION_SCHEMA,
    async (args: { accountId?: string; threadId?: string; messageId?: string; topics: string[] }) => {
      const ctx = await resolveAccountContext(context, args.accountId, "editor");
      const result = await updateThreadTopics(ctx, args, "assign");
      return buildToolResult(`Assigned ${args.topics.length} topics to thread ${result.threadId}.`, result);
    }
  );

  server.tool(
    "unassign_topics",
    "Remove one or more topics from a thread, resolved by threadId or messageId.",
    TOPIC_MUTATION_SCHEMA,
    async (args: { accountId?: string; threadId?: string; messageId?: string; topics: string[] }) => {
      const ctx = await resolveAccountContext(context, args.accountId, "editor");
      const result = await updateThreadTopics(ctx, args, "unassign");
      return buildToolResult(`Removed ${args.topics.length} topics from thread ${result.threadId}.`, result);
    }
  );

  server.registerTool("create_draft_message", {
    description: "Create a draft message. Supports new drafts, replies, and forwards. identityId selects an enabled sender in this mailbox.",
    inputSchema: z.object(CREATE_DRAFT_MESSAGE_SCHEMA).strict(),
    outputSchema: senderToolOutput({ mode: z.enum(["new", "reply", "forward"]), referenceMessageId: z.string().nullable(),
      identityId: z.string(), draftId: z.string().nullable(), message: z.object(SEARCH_RESULT_MESSAGE_SCHEMA).passthrough().nullable() })
  }, async args => {
    const ctx = await resolveAccountContext(context, args.accountId, "editor");
    return senderToolCall(async () => {
      const result = await createDraftMessage(ctx, args);
      return buildToolResult(`Created ${result.mode} draft${result.draftId ? ` ${result.draftId}` : ""}.`, result);
    });
  });

  server.registerTool("list_sender_identities", {
    description: "List this mailbox's configured sender identities and the token creator's effective default.",
    inputSchema: z.object(ACCOUNT_ID_ARG).strict(),
    outputSchema: senderToolOutput({ identities: z.array(SENDER_IDENTITY_SCHEMA), defaultIdentityId: z.string().optional(),
      effectiveDefaultIdentityId: z.string().optional(), ownAddresses: z.array(z.string()), warnings: z.array(z.string()), recomputeJob: IDENTITY_JOB_SCHEMA })
  }, async args => {
    const ctx = await resolveAccountContext(context, args.accountId);
    const identities = await listSenderIdentities(ctx.accountId);
    const prefs = await getUserAccountPrefs(ctx.tokenRecord.createdByUserId, ctx.accountId);
    const resolved = resolveComposeIdentity({ accountId: ctx.accountId, identities, prefs });
    return buildToolResult("Sender identities.", { ok: true, identities,
      defaultIdentityId: identities.find(item => item.isDefault)?.id,
      effectiveDefaultIdentityId: resolved.identity?.id, ownAddresses: getOwnAddresses(ctx.account, identities),
      warnings: resolved.warnings, recomputeJob: getIdentityRecomputeJob(ctx.accountId) });
  });
  server.registerTool("create_sender_identity", {
    description: "Configure a sender identity in this mailbox (manager). Does not verify provider send-as permission.",
    inputSchema: z.object({ ...ACCOUNT_ID_ARG, email: z.string().max(254), displayName: z.string().max(256),
      replyTo: z.string().max(254).optional(), signatureId: z.string().min(1).max(256).optional(),
      isDefault: z.boolean().optional(), enabled: z.boolean().optional() }).strict(),
    outputSchema: senderToolOutput({ identity: SENDER_IDENTITY_SCHEMA, recomputeJob: IDENTITY_JOB_SCHEMA })
  }, async args => {
    const ctx = await resolveAccountContext(context, args.accountId, "manager");
    return senderToolCall(async () => {
      const { accountId: _accountId, ...input } = args; void _accountId;
      return buildToolResult("Sender identity created.", { ok: true, ...await createSenderIdentityWithRecompute(ctx.accountId, input, { ...mcpActor(ctx),
        beforeWrite: () => authorizeOutbound({ tokenId: ctx.tokenRecord.id }, { accountId: ctx.accountId, minRole: "manager" }) }) });
    });
  });
  server.registerTool("update_sender_identity", {
    description: "Update or soft-disable a sender identity in this mailbox (manager). Address is immutable.",
    inputSchema: z.object({ ...ACCOUNT_ID_ARG, identityId: z.string().min(1).max(256), patch: z.object({
      displayName: z.string().max(256).optional(), replyTo: z.string().max(254).nullable().optional(),
      signatureId: z.string().min(1).max(256).nullable().optional(), isDefault: z.boolean().optional(), enabled: z.boolean().optional()
    }).strict() }).strict(),
    outputSchema: senderToolOutput({ identity: SENDER_IDENTITY_SCHEMA })
  }, async args => {
    const ctx = await resolveAccountContext(context, args.accountId, "manager");
    return senderToolCall(async () => buildToolResult("Sender identity updated.", { ok: true,
      identity: await updateSenderIdentity(ctx.accountId, args.identityId, args.patch, { ...mcpActor(ctx),
        beforeWrite: () => authorizeOutbound({ tokenId: ctx.tokenRecord.id }, { accountId: ctx.accountId, minRole: "manager" }) }) }));
  });
  server.registerTool("get_sender_preferences", {
    description: "Read the token creator's own sender preferences for this mailbox.",
    inputSchema: z.object(ACCOUNT_ID_ARG).strict(), outputSchema: senderToolOutput({ prefs: SENDER_PREFS_SCHEMA })
  }, async args => {
    const ctx = await resolveAccountContext(context, args.accountId);
    return buildToolResult("Sender preferences.", { ok: true, prefs: senderPrefs(await getUserAccountPrefs(ctx.tokenRecord.createdByUserId, ctx.accountId)) });
  });
  server.registerTool("set_sender_preferences", {
    description: "Patch the token creator's own sender preferences. Null restores inheritance; empty signature means none.",
    inputSchema: z.object({ ...ACCOUNT_ID_ARG, patch: accountPrefsPatchSchema.pick({ defaultIdentityId: true, defaultSignatureId: true, signatureOverride: true }) }).strict(),
    outputSchema: senderToolOutput({ prefs: SENDER_PREFS_SCHEMA })
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
        () => authorizeOutbound({ tokenId: ctx.tokenRecord.id }, { accountId: ctx.accountId, minRole: "viewer", identity: args.patch.defaultIdentityId ?? undefined }));
      return buildToolResult("Sender preferences saved.", { ok: true, prefs: senderPrefs(prefs) });
    });
  });

  server.tool(
    "flag_message",
    "Add the IMAP flagged marker to one message.",
    MESSAGE_ID_SCHEMA,
    async ({ accountId: requestedAccountId, messageId }) => {
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
        value: true,
        clientId: `mcp:${ctx.tokenRecord.id}`
      });
      const finalFlags = await markMessageAiModified(ctx.accountId, messageId);
      return buildToolResult(`Flagged message ${messageId}.`, {
        ok: true,
        messageId,
        flags: finalFlags.length > 0 ? finalFlags : nextFlags
      });
    }
  );

  server.tool(
    "unflag_message",
    "Remove the IMAP flagged marker from one message.",
    MESSAGE_ID_SCHEMA,
    async ({ accountId: requestedAccountId, messageId }) => {
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
        value: false,
        clientId: `mcp:${ctx.tokenRecord.id}`
      });
      const finalFlags = await markMessageAiModified(ctx.accountId, messageId);
      return buildToolResult(`Unflagged message ${messageId}.`, {
        ok: true,
        messageId,
        flags: finalFlags.length > 0 ? finalFlags : nextFlags
      });
    }
  );

  server.tool(
    "mark_message_todo",
    "Mark a message as To-Do.",
    MESSAGE_ID_SCHEMA,
    async ({ accountId: requestedAccountId, messageId }) => {
      const ctx = await resolveAccountContext(context, requestedAccountId, "editor");
      const result = await updateTodoState(ctx, messageId, "todo");
      return buildToolResult(`Marked message ${messageId} as To-Do.`, result);
    }
  );

  server.tool(
    "mark_message_done",
    "Mark a message as Done.",
    MESSAGE_ID_SCHEMA,
    async ({ accountId: requestedAccountId, messageId }) => {
      const ctx = await resolveAccountContext(context, requestedAccountId, "editor");
      const result = await updateTodoState(ctx, messageId, "done");
      return buildToolResult(`Marked message ${messageId} as Done.`, result);
    }
  );

  server.tool(
    "clear_message_todo",
    "Clear To-Do and Done state from a message.",
    MESSAGE_ID_SCHEMA,
    async ({ accountId: requestedAccountId, messageId }) => {
      const ctx = await resolveAccountContext(context, requestedAccountId, "editor");
      const result = await updateTodoState(ctx, messageId, "clear");
      return buildToolResult(`Cleared To-Do state from message ${messageId}.`, result);
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
  server.registerTool("list_mailbox_members", { description: "List mailbox members; disabled members are visible to managers only.", inputSchema: ACCOUNT_ID_ARG,
    outputSchema: { ok: z.boolean(), members: z.array(z.object({ userId: z.string(), name: z.string().nullable(), email: z.string(), role: z.enum(["viewer", "editor", "manager"]), isOwner: z.boolean(), disabled: z.boolean().optional() })) } },
    async args => { const ctx = await resolveAccountContext(context, args.accountId);
      return buildToolResult("Mailbox members.", { ok: true, members: await listAccountMembersForRole(ctx.accountId, ctx.role) }); });
  server.registerTool("get_thread_collaboration", { description: "Read thread state, internal comments and activity.", inputSchema: targetSchema,
    outputSchema: { ok: z.boolean(), threadId: z.string(), state: stateSchema, comments: z.array(commentSchema), activity: z.array(activitySchema) } },
    async args => { const ctx = await resolveAccountContext(context, args.accountId); const { threadId } = await resolveThreadTarget(ctx, args);
      const [state, comments, activity] = await Promise.all([getThreadCollabState(ctx.accountId, threadId), listThreadComments(ctx.accountId, threadId), listThreadActivity(ctx.accountId, threadId)]);
      return buildToolResult("Thread collaboration.", { ok: true, threadId, state, comments, activity }); });
  server.registerTool("set_thread_status", { description: "Set thread status without changing message flags.", inputSchema: { ...targetSchema, status: statusSchema },
    outputSchema: { ok: z.boolean(), state: stateSchema } }, async args => {
      const ctx = await resolveAccountContext(context, args.accountId, "editor"); const { threadId } = await resolveThreadTarget(ctx, args);
      const state = await updateThreadCollabState(ctx.accountId, threadId, { status: args.status }, mcpActor(ctx));
      if (!state) throw new Error("Thread not found"); return buildToolResult("Thread status updated.", { ok: true, state }); });
  server.registerTool("assign_thread", { description: "Assign an enabled mailbox member; 'me' selects the token creator; null unassigns.",
    inputSchema: { ...targetSchema, assigneeUserId: z.string().min(1).nullable() }, outputSchema: { ok: z.boolean(), state: stateSchema } }, async args => {
      const ctx = await resolveAccountContext(context, args.accountId, "editor"); const { threadId } = await resolveThreadTarget(ctx, args);
      const assigneeUserId = args.assigneeUserId === "me" ? ctx.tokenRecord.createdByUserId : args.assigneeUserId;
      const state = await updateThreadCollabState(ctx.accountId, threadId, { assigneeUserId }, mcpActor(ctx));
      if (!state) throw new Error("Thread not found"); return buildToolResult("Thread assignment updated.", { ok: true, state }); });
  server.registerTool("add_internal_comment", { description: "Add an internal Markdown comment.", inputSchema: { ...targetSchema, body: z.string().min(1).max(20000) },
    outputSchema: { ok: z.boolean(), comment: commentSchema, state: stateSchema } }, async args => {
      const ctx = await resolveAccountContext(context, args.accountId, "editor"); const { threadId } = await resolveThreadTarget(ctx, args);
      const result = await addThreadComment(ctx.accountId, threadId, args.body, mcpActor(ctx));
      if (!result) throw new Error("Thread not found"); return buildToolResult("Internal comment added.", { ok: true, ...result }); });
  server.registerTool("list_thread_activity", { description: "List recent thread activity, newest first.",
    inputSchema: { ...targetSchema, limit: z.number().int().min(1).max(500).optional() }, outputSchema: { ok: z.boolean(), activity: z.array(activitySchema) } }, async args => {
      const ctx = await resolveAccountContext(context, args.accountId); const { threadId } = await resolveThreadTarget(ctx, args);
      return buildToolResult("Thread activity.", { ok: true, activity: await listThreadActivity(ctx.accountId, threadId, { limit: args.limit }) }); });

  const transport = new StatelessJsonResponseTransport({
    authInfo: params.authInfo,
    requestInfo: params.requestInfo
  });
  await server.connect(transport);

  try {
    return await transport.dispatch(params.body);
  } finally {
    await server.close();
    await transport.close();
  }
}
