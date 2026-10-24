import { authorizeOutbound, prepareOutboundAssertion, type OutboundAuthorization } from "./outboundAuthorization";
import { SenderIdentityError } from "./senderIdentities";
import { resolveSendIdentity, IDENTITY_HEADER } from "./sendIdentity";
import { validateDraftIdentity } from "./draftIdentity";
import { listSenderIdentities } from "./serverDb";
import { PostSendTimeoutError, postSendDeadlineAt, withImapDeadline } from "@/lib/mail/imapCancellation";
import { completeSend, type SentCopyResult } from "@/lib/mail/completeSend";
import type { CollabActor } from "@/lib/threadCollab";
import { parseDeliveryMetadata } from "./mail/imap/parser";
import { getOwnAddresses, isOwnAddress, parseAddressEmails } from "./ownAddresses";
import type { Account, Message } from "@/lib/data";
import type { ComposeInviteDraft } from "@/lib/composeInvite";
import { COMPOSE_INVITE_HEADER, encodeComposeInviteHeader } from "@/lib/composeInviteMetadata";
import {
  deleteMessageById,
  getAttachmentIds,
  getFolders,
  getAccountOwnAddresses,
  getMessageById,
  recordDraftTombstone,
  resolveThreadingForAccountMessages,
  upsertMessages
} from "./serverDb";
import { deleteMessageFiles, getMessageSource } from "@/lib/storage";
import {
  normalizeCalendarAttachments,
  parseComposeAttachments,
  resolveComposeHtml
} from "@/lib/mail/composePayload";
import { prefixSubject } from "@/lib/mail/subjectPrefix";
import { appendImapMessage, deleteImapMessage, syncImapMessage } from "./serverImap";
import { buildRawMessage, sendRawSmtpMessage } from "./serverSmtp";
import { appendMessageFlags, hasMessageFlag } from "@/lib/messageFlags";
import {
  injectUndisclosedRecipientsToHeader,
  stripBccHeader,
  stripIdentityHeader
} from "@/lib/mail/stripBccHeader";
import { sanitizeSyncedMessage } from "@/lib/mail/syncMessageSanitizer";
import { parseMailForCategorization } from "@/lib/mail/categorization/classifier";
import { buildImapMessageRowId } from "@/lib/messageIds";
import { folderMailboxPath } from "@/lib/mailboxPaths";
import { splitRecipientEntries } from "@/lib/recipientLists";
import { buildReplyThreadHeaders } from "@/lib/replyThreadHeaders";
import { findDraftsFolder } from "@/lib/specialFolders";
import {
  buildDraftSendEnvelopeRecipients,
  draftHasSendableRecipients
} from "@/lib/draftSendEnvelope";
import { releaseDraftSchedules, ScheduledSendBusyError, type ScheduledSendReason } from "./db/scheduledSends";

export type DraftAttachmentInput = {
  filename: string;
  contentType: string;
  inline?: boolean;
  cid?: string;
  dataUrl?: string;
};

export type SaveDraftInput = {
  identityId?: string;
  draftId?: string | null;
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  text: string;
  markdown?: string;
  html?: string;
  composeFormat?: string;
  quotedHtmlEdited?: boolean;
  inReplyTo?: string;
  references?: string[];
  xForwardedMessageId?: string;
  invite?: ComposeInviteDraft;
  attachments?: DraftAttachmentInput[];
};

export type DraftCreateMode = "new" | "reply" | "forward";

export type CreateDraftMessageInput = {
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
  composeFormat?: string;
  quotedHtmlEdited?: boolean;
  invite?: ComposeInviteDraft;
  attachments?: DraftAttachmentInput[];
};

export type SaveDraftResult = {
  identityId: string;
  draftId: string | null;
  message: Message | null;
};

export class DraftSaveError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "DraftSaveError";
    this.status = status;
  }
}

export class DraftSendError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "DraftSendError";
    this.status = status;
  }
}

export type SendDraftResult = SentCopyResult & { identityId: string };

/** Closes the open schedule of a draft before a manual change; 409 while it is being sent. */
export async function releaseScheduleForDraftChange(
  accountId: string, draftId: string, reason: ScheduledSendReason,
  ErrorType: typeof DraftSaveError | typeof DraftSendError = DraftSendError
) {
  try {
    await releaseDraftSchedules(accountId, draftId, reason);
  } catch (error) {
    if (error instanceof ScheduledSendBusyError) throw new ErrorType(409, "This draft is being sent by its schedule right now.");
    throw error;
  }
}

function getReplyRecipient(ownAddresses: readonly string[], message: Message) {
  const sentByCurrentUser = isOwnAddress(message.from, ownAddresses);
  if (!sentByCurrentUser) {
    const replyTo = message.replyTo?.trim();
    if (replyTo) return replyTo;
    return message.from?.trim() ?? "";
  }

  const firstOtherRecipient =
    [message.to, message.cc, message.bcc].flatMap(splitRecipientEntries)
      .find(recipient => !isOwnAddress(recipient, ownAddresses)) ?? "";
  return firstOtherRecipient.trim();
}

export async function buildDraftInputForMode(
  account: Account,
  accountId: string,
  input: CreateDraftMessageInput
): Promise<SaveDraftInput> {
  const mode = input.mode ?? "new";
  const referenceId = input.messageId?.trim() ?? "";
  if (mode === "new") {
    if (referenceId) {
      throw new DraftSaveError(400, 'New drafts do not accept "messageId".');
    }
    return {
      identityId: input.identityId,
      to: input.to?.trim() ?? "",
      cc: input.cc?.trim() ?? "",
      bcc: input.bcc?.trim() ?? "",
      subject: input.subject?.trim() ?? "",
      text: input.text ?? "",
      markdown: input.markdown,
      html: input.html,
      composeFormat:
        input.composeFormat ?? (input.html ? "html" : input.markdown ? "markdown" : "text"),
      quotedHtmlEdited: input.quotedHtmlEdited,
      invite: input.invite,
      attachments: input.attachments
    };
  }

  if (!referenceId) {
    throw new DraftSaveError(400, `"messageId" is required for ${mode} drafts.`);
  }

  const referenceMessage = await getMessageById(accountId, referenceId);
  if (!referenceMessage) {
    throw new DraftSaveError(404, "Message not found");
  }

  const ownAddresses = await getAccountOwnAddresses(accountId);
  const { inReplyTo, references } = buildReplyThreadHeaders(referenceMessage);

  return {
    identityId: input.identityId,
    to:
      input.to?.trim() ??
      (mode === "reply" ? getReplyRecipient(ownAddresses.length ? ownAddresses : getOwnAddresses(account), referenceMessage) : ""),
    cc: input.cc?.trim() ?? "",
    bcc: input.bcc?.trim() ?? "",
    subject:
      input.subject?.trim() ??
      (mode === "reply"
        ? prefixSubject("Re", referenceMessage.subject)
        : prefixSubject("Fwd", referenceMessage.subject)),
    text: input.text ?? "",
    markdown: input.markdown,
    html: input.html,
    composeFormat:
      input.composeFormat ?? (input.html ? "html" : input.markdown ? "markdown" : "text"),
    quotedHtmlEdited: input.quotedHtmlEdited,
    inReplyTo,
    references,
    xForwardedMessageId: mode === "forward" ? inReplyTo : undefined,
    invite: input.invite,
    attachments: input.attachments
  };
}

const APPENDED_DRAFT_FLAGS = ["\\Draft", "\\Seen"];

function normalizeHeaderId(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeHeaderIdList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => normalizeHeaderIdList(item));
  }
  if (typeof value !== "string") return [];
  return value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function addressText(value: unknown): string {
  if (!value) return "";
  if (Array.isArray(value)) {
    return value.map((item) => addressText(item)).filter(Boolean).join(", ");
  }
  if (typeof value === "object" && value !== null && "text" in value) {
    const text = (value as { text?: unknown }).text;
    return typeof text === "string" ? text : "";
  }
  return "";
}

function headerText(headers: { get?: (key: string) => unknown } | undefined, key: string) {
  const value = headers?.get?.(key);
  if (typeof value === "string") return value.trim() || undefined;
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string" && item.trim());
    return typeof first === "string" ? first.trim() : undefined;
  }
  return undefined;
}

/**
 * Build the local draft row from the RFC822 just appended. Returns null when
 * the parsed Message-ID, In-Reply-To, or References do not match what compose
 * asked to write, so the caller can still FETCH.
 */
async function messageFromAppendedDraft(params: {
  account: Account;
  draftsFolderId: string;
  mailboxPath: string;
  uid: number;
  raw: Buffer | string;
  payload: SaveDraftInput;
  preservedMessageId?: string;
}): Promise<Message | null> {
  let parsed: Awaited<ReturnType<typeof parseMailForCategorization>>;
  try {
    parsed = await parseMailForCategorization(params.raw);
  } catch {
    return null;
  }

  const messageId = normalizeHeaderId(parsed.messageId);
  if (!messageId) return null;
  const preservedMessageId = normalizeHeaderId(params.preservedMessageId);
  if (preservedMessageId && preservedMessageId !== messageId) return null;

  const parsedInReplyTo = normalizeHeaderId(parsed.inReplyTo);
  const payloadInReplyTo = normalizeHeaderId(params.payload.inReplyTo);
  if (payloadInReplyTo && parsedInReplyTo !== payloadInReplyTo) return null;
  const inReplyTo = parsedInReplyTo ?? payloadInReplyTo;

  const parsedReferences = normalizeHeaderIdList(parsed.references);
  const payloadReferences = (params.payload.references ?? [])
    .map((value) => value.trim())
    .filter(Boolean);
  if (payloadReferences.length > 0) {
    if (parsedReferences.length !== payloadReferences.length) return null;
    for (let index = 0; index < payloadReferences.length; index += 1) {
      if (parsedReferences[index] !== payloadReferences[index]) return null;
    }
  }

  const from = addressText(parsed.from) || params.account.email;
  const to = addressText(parsed.to) || params.payload.to || "";
  const subject = (parsed.subject ?? params.payload.subject ?? "").trim() || "(no subject)";
  const parsedDate =
    parsed.date instanceof Date && !Number.isNaN(parsed.date.getTime()) ? parsed.date : new Date();
  const dateValue = parsedDate.getTime();
  const body = typeof parsed.text === "string" ? parsed.text : "";
  const htmlBody = typeof parsed.html === "string" ? parsed.html : undefined;
  const source = Buffer.isBuffer(params.raw) ? params.raw.toString("utf8") : String(params.raw);
  const parsedAttachments: Array<{
    content?: Buffer | Uint8Array | string | null;
    filename?: string | null;
    contentType?: string | null;
    size?: number | null;
    contentDisposition?: string | null;
    cid?: string | null;
  }> = Array.isArray(parsed.attachments) ? parsed.attachments : [];
  const attachments = parsedAttachments.map((attachment, index) => {
    const content = attachment.content;
    const buffer = Buffer.isBuffer(content)
      ? content
      : content
        ? Buffer.from(content)
        : null;
    return {
      id: `att-${params.account.id}-${params.uid}-${index}`,
      filename: attachment.filename || `attachment-${index + 1}`,
      contentType: attachment.contentType || "application/octet-stream",
      size: buffer?.byteLength ?? attachment.size ?? 0,
      inline: attachment.contentDisposition === "inline" || Boolean(attachment.cid),
      cid: attachment.cid || undefined,
      content: buffer
    };
  });

  return {
    id: buildImapMessageRowId(messageId, {
      dateValue,
      from,
      to,
      subject,
      inReplyTo
    }),
    threadId: inReplyTo ?? messageId,
    messageId,
    inReplyTo,
    references: parsedReferences.length > 0 ? parsedReferences : payloadReferences,
    xForwardedMessageId:
      params.payload.xForwardedMessageId ??
      headerText(parsed.headers, "x-forwarded-message-id"),
    subject,
    from,
    replyTo: addressText(parsed.replyTo) || undefined,
    to,
    cc: addressText(parsed.cc) || params.payload.cc || undefined,
    bcc: addressText(parsed.bcc) || params.payload.bcc || undefined,
    preview: body.replace(/\s+/g, " ").trim().slice(0, 120),
    date: parsedDate.toLocaleString(),
    dateValue,
    folderId: params.draftsFolderId,
    accountId: params.account.id,
    mailboxPath: params.mailboxPath,
    imapUid: params.uid,
    body,
    htmlBody,
    source,
    hasSource: true,
    ...parseDeliveryMetadata(Buffer.from(source)),
    attachments,
    flags: APPENDED_DRAFT_FLAGS,
    seen: true,
    answered: false,
    flagged: false,
    deleted: false,
    draft: true,
    recent: false,
    unread: false,
    listId: headerText(parsed.headers, "list-id") ?? null
  };
}

export async function saveDraftForAccount(params: {
  account: Account;
  accountId: string;
  clientId: string;
  payload: SaveDraftInput;
  localFlags?: string[];
  actor?: CollabActor;
  authorization?: OutboundAuthorization;
}): Promise<SaveDraftResult> {
  const { account, accountId, clientId, payload } = params;
  const existingDraft = payload.draftId ? await getMessageById(accountId, payload.draftId) : null;
  if (payload.draftId && !existingDraft) throw new DraftSaveError(404, "Draft not found");
  let identityId = payload.identityId;
  if (existingDraft && identityId === undefined) {
    const from = parseAddressEmails(existingDraft.from);
    const identities = await listSenderIdentities(accountId);
    const savedIdentity = identities.find(item => item.accountId === accountId &&
      (existingDraft.senderIdentityId ? item.id === existingDraft.senderIdentityId : from.length === 1 && item.email === from[0]));
    if (!savedIdentity?.enabled || from.length !== 1 || savedIdentity.email !== from[0]) {
      throw new SenderIdentityError("identity_unavailable", 409, "Choose an enabled sender identity before saving this draft.");
    }
    identityId = savedIdentity.id;
  }
  const identity = await resolveSendIdentity({ accountId, userId: params.actor?.userId,
    identityId, inReplyTo: payload.inReplyTo, mode: payload.xForwardedMessageId ? "forward" : undefined });
  const folders = await getFolders(account.id);
  const draftsFolder = findDraftsFolder(folders, account.id);
  if (!draftsFolder) {
    throw new DraftSaveError(400, "Drafts folder not found");
  }

  const draftsMailbox = folderMailboxPath(draftsFolder, account.id);
  const attachments = normalizeCalendarAttachments(parseComposeAttachments(payload.attachments));
  const html = await resolveComposeHtml({
    composeFormat: payload.composeFormat,
    markdown: payload.markdown,
    html: payload.html,
    attachments: payload.attachments
  });
  const preservedMessageId = existingDraft?.messageId?.trim() || undefined;

  const raw = await buildRawMessage(account, {
    to: payload.to,
    cc: payload.cc,
    bcc: payload.bcc,
    keepBcc: true,
    subject: payload.subject,
    text: payload.text,
    html,
    messageId: preservedMessageId,
    inReplyTo: payload.inReplyTo,
    references: payload.references,
    xForwardedMessageId: payload.xForwardedMessageId,
    headers: { [IDENTITY_HEADER]: identity.id,
      ...(payload.invite ? { [COMPOSE_INVITE_HEADER]: encodeComposeInviteHeader(payload.invite) } : {}) },
    ...(attachments.length > 0 ? { attachments } : {})
  }, identity);

  const beforeWrite = params.authorization ? () => authorizeOutbound(params.authorization!, { accountId, minRole: "editor", identity, purpose: "draft" }) : undefined;
  const authorization = await beforeWrite?.();
  const assertCurrent = authorization ? await prepareOutboundAssertion(authorization) : () => {};
  assertCurrent();
  // Editing a planned draft cancels its schedule; a schedule that is sending right now wins.
  if (existingDraft) await releaseScheduleForDraftChange(accountId, existingDraft.id, "edited", DraftSaveError);
  const uid = await appendImapMessage(account, draftsMailbox, raw, APPENDED_DRAFT_FLAGS, clientId, undefined, { beforeAppend: assertCurrent });
  if (!uid) {
    throw new DraftSaveError(502, "Failed to save draft to IMAP server");
  }

  assertCurrent();
  let draftId: string | null = null;
  let savedMessage: Message | null = null;
  const localMessage = await messageFromAppendedDraft({
    account,
    draftsFolderId: draftsFolder.id,
    mailboxPath: draftsMailbox,
    uid,
    raw,
    payload,
    preservedMessageId
  });
  const message = localMessage ?? (await syncImapMessage(account, draftsMailbox, uid, clientId));
  if (message) {
    const [resolvedMessage] = await resolveThreadingForAccountMessages(accountId, [message]);
    const sanitized = await sanitizeSyncedMessage(resolvedMessage ?? message, account.id);
    if (payload.composeFormat) {
      sanitized.xComposeFormat = payload.composeFormat;
    }
    if (typeof payload.quotedHtmlEdited === "boolean") {
      sanitized.quotedHtmlEdited = payload.quotedHtmlEdited;
    }
    sanitized.draftInvite = payload.invite ?? null;
    if (params.localFlags) sanitized.flags = appendMessageFlags(sanitized.flags, params.localFlags);
    const stored = await upsertMessages(account.id, null, [sanitized], false, { beforeWrite, replaceDraftId: existingDraft?.id });
    draftId = stored.messageRowIds.get(sanitized.id) ?? sanitized.id;
    const storedMessage = await getMessageById(account.id, draftId);
    savedMessage = storedMessage ? {
      ...storedMessage,
      xComposeFormat: sanitized.xComposeFormat,
      quotedHtmlEdited: sanitized.quotedHtmlEdited,
      draftInvite: sanitized.draftInvite
    } : null;
  }

  if (existingDraft?.imapUid && existingDraft.mailboxPath) {
    assertCurrent();
    await deleteImapMessage(account, existingDraft.mailboxPath, existingDraft.imapUid, clientId, assertCurrent);
  }

  return { draftId, message: savedMessage, identityId: identity.id };
}

/**
 * The send preconditions of a stored draft, shared by `sendDraftForAccount` and the
 * scheduled-send preflight so a planned send is rejected for the same reasons as a send.
 */
export async function loadSendableDraft(accountId: string, draftId: string) {
  const draft = await getMessageById(accountId, draftId);
  if (!draft) {
    throw new DraftSendError(404, "Draft not found");
  }

  // SECURITY GUARD. Without this check, any message with a cached raw
  // source and parseable recipients could be relayed via SMTP —
  // including *received* messages whose `From:` header is someone else,
  // which would let this endpoint be used as an abuse/spoofing vector.
  //
  // Only messages explicitly marked with the IMAP `\Draft` flag are
  // considered sendable here. Folder placement alone is NOT enough,
  // because an arbitrary received message can be moved into the Drafts
  // folder (either deliberately by an attacker with session access, or
  // incidentally by drag-and-drop) and its raw MIME — including a
  // spoofed `From:` header — would then be eligible for relay. The
  // `\Draft` flag is set by our own `saveDraftForAccount` when the
  // compose editor saves, and is preserved only by messages written
  // that way; no legitimate draft should be missing it.
  //
  // This does not replace SMTP-level `From:` authorization (that's the
  // SMTP server's job — it will reject an unauthorized sender address
  // at MAIL FROM time), it just keeps us from attempting relay in the
  // first place.
  const hasDraftFlag = hasMessageFlag(draft.flags, "\\Draft");
  if (!hasDraftFlag) {
    throw new DraftSendError(
      403,
      "Only messages saved as drafts can be sent via this endpoint. Open the message in compose and save it as a draft first."
    );
  }
  if (!draftHasSendableRecipients(draft)) {
    throw new DraftSendError(400, "Please add at least one recipient before sending.");
  }
  const rawSource = (await getMessageSource(accountId, draft.id)) ?? draft.source ?? null;
  if (!rawSource) {
    throw new DraftSendError(
      409,
      "Draft source is not cached locally. Open the draft in compose to send it."
    );
  }

  const messageId = draft.messageId?.trim() || rawSource.match(/^Message-ID:\s*(.+)$/im)?.[1]?.trim();
  if (!messageId) throw new DraftSendError(409, "Draft has no Message-ID. Open it in compose and save it again.");
  const identity = await validateDraftIdentity(rawSource, draft, await listSenderIdentities(accountId));
  return { draft, rawSource, messageId, identity };
}

/**
 * Send a previously-saved draft without re-opening it in compose.
 *
 * The draft is relayed from its stored raw MIME source, which helps
 * preserve the drafted MIME structure and headers — attachments,
 * `Content-ID`s, the compose-invite header, and the original
 * `Message-ID` — as stored with the draft. The cached source in this
 * path is a UTF-8 string, so this preserves headers and structure
 * without promising byte-for-byte preservation; the `latin1` round-trip
 * inside `stripBccHeader` only matters when a caller hands us a
 * `Buffer` containing binary bytes, which isn't the case here. The
 * SMTP envelope is built from the draft's parsed `to`/`cc`/`bcc` —
 * we don't re-parse the raw blob for recipients.
 *
 * Two header-level edits happen before relay:
 *   1. `stripBccHeader` — the local draft is saved with
 *      `keepBcc: true`, but the wire copy must not carry `Bcc:` or
 *      blind-carbon addresses would leak to every To/Cc recipient.
 *   2. `injectUndisclosedRecipientsToHeader` — for BCC-only drafts
 *      (no To, no Cc), insert `To: undisclosed-recipients:;` so the
 *      wire copy has a recipient header. Mirrors the `outboundTo`
 *      fallback in `/api/accounts/[accountId]/smtp/send`.
 *
 * On success the draft is removed from both the IMAP Drafts mailbox
 * and the local message store, and a copy is appended to the Sent
 * folder. The result distinguishes delivery from Sent-copy failure.
 */
export async function sendDraftForAccount(params: {
  account: Account;
  accountId: string;
  clientId: string;
  draftId: string;
  actor: CollabActor;
  authorization?: OutboundAuthorization;
}): Promise<SendDraftResult> {
  const { account, accountId, clientId, draftId } = params;
  const { draft, rawSource, messageId, identity } = await loadSendableDraft(accountId, draftId);
  // Prepare the wire copy:
  //   - `stripBccHeader` removes the `Bcc:` header that's in the cached
  //     draft (saved with `keepBcc: true`). Relaying that unchanged would
  //     disclose blind-carbon addresses to every To/Cc recipient.
  //   - `injectUndisclosedRecipientsToHeader` handles the BCC-only case
  //     (no To, no Cc): after the strip, the message would have no
  //     recipient header at all — technically valid SMTP (the envelope
  //     still has `RCPT TO`) but several MUAs render it awkwardly.
  //     Inject `To: undisclosed-recipients:;` to match `/smtp/send`.
  //
  // The envelope recipients we build from the draft's parsed fields
  // still include Bcc addresses, so they receive the message — they
  // just don't appear in the message's own headers.
  const sentSource = injectUndisclosedRecipientsToHeader(stripIdentityHeader(rawSource));
  const wireSource = stripBccHeader(sentSource);
  const envelopeRecipients = buildDraftSendEnvelopeRecipients(draft);
  const authorization = params.authorization ? await authorizeOutbound(params.authorization, { accountId, minRole: "editor", identity }) : undefined;
  const beforeSend = authorization ? await prepareOutboundAssertion(authorization) : undefined;
  beforeSend?.();
  await sendRawSmtpMessage(account, wireSource, {
    from: identity.email,
    to: envelopeRecipients
  }, beforeSend);

  const deadlineAt = postSendDeadlineAt();
  const sentResult = await completeSend({ account, clientId, deadlineAt, raw: Buffer.from(sentSource),
    messageId, actor: params.actor, inReplyTo: draft.inReplyTo, references: draft.references,
    xForwardedMessageId: draft.xForwardedMessageId });

  // Everything past this point is post-send cleanup. The message has
  // already been relayed to the SMTP server; if any cleanup step
  // throws, we must NOT surface it as a send failure — the client
  // would display "Failed to send draft", prompting the user to retry
  // and send the message twice.
  //
  // Individually:
  //   - IMAP delete is non-fatal on its own already (wrapped below).
  //     Failure just means the draft re-appears on next sync.
  //   - `getAttachmentIds` can throw on DB issues.
  //   - `deleteMessageById` + `deleteMessageFiles` can fail on DB /
  //     filesystem issues.
  //
  // All of these are logged as warnings and swallowed. The endpoint
  // still returns success. Storage leak and stale draft rows in this
  // path are real but non-urgent; the alternative (user-visible
  // duplicate send) is worse. Surfacing these as a soft warning on
  // the client is a future UX polish.
  try {
    // Tombstone the draft by its stable Message-Id before any IMAP/DB
    // cleanup runs, so that even if the IMAP delete below fails (or another
    // client lags), the next Drafts sync drops this draft instead of
    // resurrecting it next to the message we just sent. Scoped enforcement
    // (Drafts-flagged only) keeps the Sent copy — which shares this
    // Message-Id — untouched. Kept inside the swallowing try so a transient
    // DB error here can't surface as a (false) send failure.
    await recordDraftTombstone(accountId, draft.messageId, draft.mailboxPath ?? null);
    const attachmentIds = await getAttachmentIds(accountId, draft.id);
    if (draft.mailboxPath && typeof draft.imapUid === "number") {
      try {
        await withImapDeadline(deadlineAt, () => deleteImapMessage(account, draft.mailboxPath!, draft.imapUid!, clientId));
      } catch (error) {
        if (error instanceof PostSendTimeoutError) {
          sentResult.sentCopy = "failed";
          sentResult.sentCopyWarning = "Email sent, but draft cleanup timed out. Do not send it again.";
          sentResult.postSendWarning = [sentResult.postSendWarning, "Email sent, but removing the server draft failed."].filter(Boolean).join(" ");
        }
        console.warn("[draft-send] IMAP delete failed after send", {
          accountId,
          draftId: draft.id,
          error
        });
      }
    }
    await deleteMessageById(accountId, draft.id);
    await deleteMessageFiles(accountId, draft.id, attachmentIds);
  } catch (error) {
    console.warn("[draft-send] post-send cleanup failed", {
      accountId,
      draftId: draft.id,
      error
    });
  }

  return { ...sentResult, identityId: identity.id };
}
