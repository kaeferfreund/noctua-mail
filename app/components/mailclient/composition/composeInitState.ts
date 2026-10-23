import { resolveComposeIdentity } from "@/lib/senderIdentitySelection";
import { renderSignatureTemplate, resolveSignatureTemplate, type SignatureBlock } from "@/lib/signatureTemplates";
import type { SenderSettings } from "@/lib/ui/senderSettings";
import { isOwnAddress, parseAddressEmails } from "@/lib/ownAddresses";
import type { AccountDateFormat, Message } from "@/lib/data";
import { createDefaultComposeInviteDraft } from "@/lib/composeInvite";
import { formatForwardedMessageDate, formatMessageDate } from "@/lib/dateFormatting";
import {
  assembleQuotedHtml,
  buildForwardMetaHtml,
  buildQuotedHtmlPartsFromHtml,
  escapeHtml,
  extractQuotedHtmlFromDraft,
  FORWARDED_MESSAGE_MARKER,
  type ForwardMetaRow
} from "@/lib/html";
import { prefixSubject } from "@/lib/mail/subjectPrefix";
import { splitRecipientEntries } from "@/lib/recipientLists";
import { hasHtmlContent } from "@/lib/ui/messageView";
import { buildTextReplyBody } from "./composeContentBuilder";
import { computeDraftHash } from "./draftSaveUtils";
import type { ComposeMode, ComposeQuotedParts, ComposeReplyHeaders, ComposeTab } from "./composeTypes";

// ---------------------------------------------------------------------------
// Private helpers (previously scattered across useComposeController)
// ---------------------------------------------------------------------------

function getPrimaryEmail(value?: string) {
  return parseAddressEmails(value)[0] ?? null;
}

export function getDisplayRecipient(value: string): string {
  if (!value) return "";
  const match = value.match(/(.+)<([^>]+)>/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, "").trim();
    const email = match[2].trim();
    return name ? `${name} <${email}>` : email;
  }
  const email = getPrimaryEmail(value);
  return email || value.trim();
}

export function uniqueEmails(entries: string[]): string[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = entry.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function uniqueRecipients(entries: string[]): string[] {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const email = getPrimaryEmail(entry) || entry;
    const key = email.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function normalizeComposeTo(value?: string | null): string {
  const raw = (value ?? "").trim();
  if (!raw) return "";
  const normalized = raw.replace(/["<>]/g, "").toLowerCase();
  if (/undisclosed[- ]recipients?/.test(normalized)) return "";
  return raw;
}

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export type ComposeInitFields = {
  composeTo: string;
  composeCc: string;
  composeBcc: string;
  composeShowBcc: boolean;
  composeSubject: string;
  composeBody: string;
  composeIncludeInvite: boolean;
  composeInviteLocation: string;
  composeInviteStart: string;
  composeInviteEnd: string;
  composeInviteAllDay: boolean;
  composeInviteRecurrenceRule: string;
  composeHtml: string;
  composeHtmlText: string;
  composeMarkdown: string;
  composeQuotedHtml: string;
  composeQuotedHtmlEdited: boolean;
  composeQuotedParts: ComposeQuotedParts | null;
  composeReplyHeaders: ComposeReplyHeaders | null;
  composeReplyMessage: Message | null;
  composeDraftId: string | null;
  composeTab: ComposeTab;
  composeStripImages: boolean;
  composeIncludeOriginal: boolean;
  composeQuoteHtml: boolean;
  /** Seed for lastDraftHashRef — only set for edit mode, null otherwise. */
  initialDraftHash: string | null;
  /** Seed for draftSavedAt — only set for edit mode, null otherwise. */
  initialDraftSavedAt: number | null;
};

const BLANK: ComposeInitFields = {
  composeTo: "",
  composeCc: "",
  composeBcc: "",
  composeShowBcc: false,
  composeSubject: "",
  composeBody: "",
  composeIncludeInvite: false,
  composeInviteLocation: "",
  composeInviteStart: "",
  composeInviteEnd: "",
  composeInviteAllDay: false,
  composeInviteRecurrenceRule: "",
  composeHtml: "",
  composeHtmlText: "",
  composeMarkdown: "",
  composeQuotedHtml: "",
  composeQuotedHtmlEdited: false,
  composeQuotedParts: null,
  composeReplyHeaders: null,
  composeReplyMessage: null,
  composeDraftId: null,
  composeTab: "html",
  composeStripImages: false,
  composeIncludeOriginal: true,
  composeQuoteHtml: true,
  initialDraftHash: null,
  initialDraftSavedAt: null
};

// ---------------------------------------------------------------------------
// Pure function
// ---------------------------------------------------------------------------

function computeBaseComposeInitState(
  mode: ComposeMode,
  message: Message | undefined,
  asNew: boolean,
  opts: {
    accountEmail: string;
    ownAddresses?: readonly string[];
    accountDateFormat: AccountDateFormat;
    preferredComposeTab?: ComposeTab;
    findMessageByMessageId?: (messageId: string) => Message | undefined;
  },
  deps: {
    stripHtml: (value: string) => string;
    normalizeHtmlDerivedText: (value: string) => string;
  }
): ComposeInitFields {
  if (!message) {
    return { ...BLANK, composeTab: opts.preferredComposeTab ?? "html" };
  }

  const { stripHtml, normalizeHtmlDerivedText } = deps;
  const { accountEmail, accountDateFormat, preferredComposeTab } = opts;

  const ownAddresses = opts.ownAddresses ?? [accountEmail];
  const fromEmails = parseAddressEmails(message.from);
  const fromRecipient = getDisplayRecipient(message.from);
  // Honor RFC 5322 Reply-To: when present on the original message, replies
  // (and reply-alls) should go to that address instead of From. Mailing
  // lists and transactional senders rely on this to route replies to a
  // real inbox rather than a no-reply From.
  const replyToRaw = message.replyTo?.trim() ?? "";
  const replyToEmails = replyToRaw ? parseAddressEmails(replyToRaw) : [];
  const replyToRecipient = replyToRaw ? getDisplayRecipient(replyToRaw) : "";

  const isSentByCurrentUser = isOwnAddress(message.from, ownAddresses);

  const prefersHtml = hasHtmlContent(message.htmlBody);
  const replyMessageId = message.messageId ?? undefined;
  const replyReferences = replyMessageId
    ? [
        ...(message.references ?? []),
        ...(message.inReplyTo ? [message.inReplyTo] : []),
        replyMessageId
      ]
    : undefined;

  const formattedDate = formatMessageDate(message.dateValue, message.date, accountDateFormat);

  const buildReplyContent = (header: string, metaHtml?: string) => {
    const hasValidHtml = prefersHtml && hasHtmlContent(message.htmlBody);
    const wantsRichReply = preferredComposeTab !== "text";

    if (wantsRichReply && hasValidHtml && message.htmlBody) {
      const parts = {
        ...buildQuotedHtmlPartsFromHtml(message.htmlBody, header, false),
        ...(metaHtml ? { metaHtml } : {})
      };
      return {
        composeBody: "",
        composeQuotedHtml: assembleQuotedHtml(parts, true),
        composeQuotedParts: parts,
        composeTab: preferredComposeTab === "markdown" ? "markdown" : "html"
      } satisfies Pick<
        ComposeInitFields,
        "composeBody" | "composeQuotedHtml" | "composeQuotedParts" | "composeTab"
      >;
    }

    const textSource =
      typeof message.body === "string" && message.body.trim().length > 0
        ? message.body
        : hasValidHtml && message.htmlBody
          ? stripHtml(message.htmlBody)
          : "";

    return {
      composeBody: buildTextReplyBody(textSource, header),
      composeQuotedHtml: "",
      composeQuotedParts: null,
      composeTab: "text"
    } satisfies Pick<
      ComposeInitFields,
      "composeBody" | "composeQuotedHtml" | "composeQuotedParts" | "composeTab"
    >;
  };

  // -------------------------------------------------------------------------
  // reply
  // -------------------------------------------------------------------------
  if (mode === "reply") {
    const replyHeader = `On ${formattedDate}, ${message.from} wrote:`;

    let to: string;
    if (isSentByCurrentUser) {
      to = [message.to, message.cc, message.bcc].flatMap(splitRecipientEntries)
        .filter(recipient => !isOwnAddress(recipient, ownAddresses)).map(getDisplayRecipient)[0] ?? "";
    } else if (replyToRaw) {
      to = replyToRecipient || uniqueEmails(replyToEmails).join(", ");
    } else {
      to = fromRecipient || uniqueEmails(fromEmails).join(", ");
    }

    const replyContent = buildReplyContent(replyHeader);
    return {
      ...BLANK,
      composeTo: to,
      composeSubject: prefixSubject("Re", message.subject),
      ...replyContent,
      composeReplyMessage: message,
      composeReplyHeaders: { inReplyTo: replyMessageId, references: replyReferences }
    };
  }

  // -------------------------------------------------------------------------
  // replyAll
  // -------------------------------------------------------------------------
  if (mode === "replyAll") {
    const replyHeader = `On ${formattedDate}, ${message.from} wrote:`;

    let toList: string[];
    let ccList: string[];

    if (isSentByCurrentUser) {
      toList = uniqueRecipients(splitRecipientEntries(message.to)
        .filter(recipient => !isOwnAddress(recipient, ownAddresses)).map(getDisplayRecipient));
      ccList = uniqueEmails([message.cc, message.bcc].flatMap(value => parseAddressEmails(value))
        .filter(email => !isOwnAddress(email, ownAddresses)));
    } else {
      // When Reply-To is set we deliberately do not add the original From
      // to CC. Reply-To is an explicit redirection by the sender; including
      // From would risk duplicate delivery (e.g. the author also receives
      // every list reply via the list address they already redirected to).
      const replyTargetList = replyToRaw
        ? replyToRecipient
          ? [replyToRecipient]
          : replyToEmails
        : fromRecipient
          ? [fromRecipient]
          : fromEmails;
      toList = uniqueRecipients(replyTargetList);
      const toEmailSet = new Set(
        toList.map((r) => (getPrimaryEmail(r) || r).toLowerCase())
      );
      const allRecipientParts = [
        ...splitRecipientEntries(message.to),
        ...splitRecipientEntries(message.cc),
        ...splitRecipientEntries(message.bcc)
      ]
        .map((s) => s.trim())
        .filter(Boolean);
      ccList = uniqueRecipients(
        allRecipientParts
          .map((s) => getDisplayRecipient(s))
          .filter((r) => {
            const email = getPrimaryEmail(r) || r;
            return (
              !isOwnAddress(email, ownAddresses) &&
              !toEmailSet.has(email.toLowerCase())
            );
          })
      );
    }

    const replyContent = buildReplyContent(replyHeader);
    return {
      ...BLANK,
      composeTo: toList.join(", "),
      composeCc: ccList.join(", "),
      composeSubject: prefixSubject("Re", message.subject),
      ...replyContent,
      composeReplyMessage: message,
      composeReplyHeaders: { inReplyTo: replyMessageId, references: replyReferences }
    };
  }

  // -------------------------------------------------------------------------
  // forward
  // -------------------------------------------------------------------------
  if (mode === "forward") {
    const formatAddresses = (value?: string | null) =>
      splitRecipientEntries(value).map(getDisplayRecipient).filter(Boolean).join(", ");
    const replyToDiffersFromSender = replyToEmails.some(
      (email) => !fromEmails.some((from) => from.toLowerCase() === email.toLowerCase())
    );
    // Bcc is deliberately left out: forwarding one's own sent mail must not
    // reveal who was blind-copied.
    const forwardMetaRows: ForwardMetaRow[] = [
      { label: "From", value: formatAddresses(message.from) },
      { label: "Reply-To", value: replyToDiffersFromSender ? formatAddresses(replyToRaw) : "" },
      {
        label: "Date",
        value: formatForwardedMessageDate(message.dateValue, message.date, accountDateFormat)
      },
      { label: "Subject", value: message.subject ?? "" },
      { label: "To", value: formatAddresses(message.to) },
      { label: "Cc", value: formatAddresses(message.cc) }
    ];
    const forwardMetaLines = forwardMetaRows
      .filter((row) => row.value.trim().length > 0)
      .map((row) => `${row.label}: ${row.value.trim()}`);
    const replyHeaders: ComposeReplyHeaders = {
      inReplyTo: replyMessageId,
      references: replyReferences,
      xForwardedMessageId: replyMessageId
    };

    // For HTML/Markdown forwards, the prefix lives in the editor and the quoted
    // block holds the original HTML as-is, so the user can add a note above the
    // forwarded content. Text mode has no separate quoted block, so the header
    // and the header details stay embedded in the textarea body.
    const isRichForward = preferredComposeTab !== "text" && hasHtmlContent(message.htmlBody);
    const replyContent = buildReplyContent(
      isRichForward ? "" : `${FORWARDED_MESSAGE_MARKER}\n${forwardMetaLines.join("\n")}\n`,
      buildForwardMetaHtml(forwardMetaRows)
    );

    const editorFields: Partial<ComposeInitFields> =
      replyContent.composeTab === "html"
        ? {
            composeHtml: `<p>${escapeHtml(FORWARDED_MESSAGE_MARKER)}</p>`,
            composeHtmlText: FORWARDED_MESSAGE_MARKER
          }
        : replyContent.composeTab === "markdown"
          ? { composeMarkdown: `${FORWARDED_MESSAGE_MARKER}\n\n` }
          : {};

    return {
      ...BLANK,
      composeSubject: prefixSubject("Fwd", message.subject),
      ...replyContent,
      ...editorFields,
      composeReplyMessage: message,
      composeReplyHeaders: replyHeaders
    };
  }

  // -------------------------------------------------------------------------
  // edit / editAsNew
  // -------------------------------------------------------------------------
  const replyHeaders: ComposeReplyHeaders | null =
    mode === "edit" && !asNew
      ? {
          inReplyTo: message.inReplyTo ?? undefined,
          references: message.references,
          xForwardedMessageId: message.xForwardedMessageId
        }
      : mode === "editAsNew"
        ? { inReplyTo: replyMessageId, references: replyReferences }
        : null;

  let composeReplyMessage: Message | null = null;
  if (mode === "edit" && !asNew && opts.findMessageByMessageId) {
    const originalId = message.xForwardedMessageId || message.inReplyTo;
    if (originalId) {
      composeReplyMessage = opts.findMessageByMessageId(originalId) ?? null;
    }
  }

  const rawHtml = message.htmlBody ?? "";
  const nextHtml = typeof rawHtml === "string" && rawHtml.trim() === "0" ? "" : rawHtml;
  const hasDraftHtml = hasHtmlContent(nextHtml);

  const xFormat = message.xComposeFormat;
  const composeTab: ComposeTab =
    mode === "edit" && (xFormat === "markdown" || xFormat === "text" || xFormat === "html")
      ? xFormat
      : hasDraftHtml
        ? "html"
        : "text";

  let composeHtml: string;
  let composeHtmlText: string;
  let composeQuotedHtml: string;
  let composeQuotedHtmlEdited: boolean;

  if (mode === "edit" && !message.quotedHtmlEdited && nextHtml) {
    const { userHtml, quotedHtml } = extractQuotedHtmlFromDraft(nextHtml);
    composeHtml = userHtml;
    composeHtmlText = stripHtml(userHtml);
    composeQuotedHtml = quotedHtml;
    composeQuotedHtmlEdited = false;
  } else {
    composeHtml = nextHtml;
    composeHtmlText = stripHtml(nextHtml);
    composeQuotedHtml = "";
    composeQuotedHtmlEdited = message.quotedHtmlEdited ?? false;
  }

  const composeDraftId = mode === "edit" && !asNew ? message.id : null;
  const draftInvite = message.draftInvite ?? null;
  const defaultInvite = draftInvite ? null : createDefaultComposeInviteDraft();

  const initialDraftHash = !asNew
    ? computeDraftHash({
        identityId: message.senderIdentityId,
        to: message.to ?? "",
        cc: message.cc ?? "",
        bcc: message.bcc ?? "",
        subject: message.subject ?? "",
        text: message.body ?? "",
        // Markdown rendering happens on the server. The client save payload
        // carries only supplemental quoted HTML, not the rendered markdown
        // preview, so dirty tracking must hash that same representation.
        html:
          composeTab === "markdown"
            ? (composeQuotedHtml || undefined)
            : composeTab === "html"
              ? nextHtml
              : undefined,
        attachments: message.attachments ?? [],
        invite: draftInvite
      })
    : null;

  return {
    composeTo: normalizeComposeTo(message.to ?? ""),
    composeCc: message.cc ?? "",
    composeBcc: message.bcc ?? "",
    composeShowBcc: Boolean(message.cc || message.bcc),
    composeSubject: message.subject ?? "",
    composeBody: normalizeHtmlDerivedText(message.body ?? ""),
    composeIncludeInvite: Boolean(draftInvite),
    composeInviteLocation: draftInvite?.location ?? "",
    composeInviteStart: draftInvite?.start ?? defaultInvite?.start ?? "",
    composeInviteEnd: draftInvite?.end ?? defaultInvite?.end ?? "",
    composeInviteAllDay: draftInvite?.allDay ?? false,
    composeInviteRecurrenceRule: draftInvite?.recurrenceRule ?? "",
    composeHtml,
    composeHtmlText,
    composeMarkdown: composeTab === "markdown" ? (message.body ?? "") : "",
    composeQuotedHtml,
    composeQuotedHtmlEdited,
    composeQuotedParts: null,
    composeReplyHeaders: replyHeaders,
    composeReplyMessage,
    composeDraftId,
    composeTab,
    composeStripImages: false,
    composeIncludeOriginal: true,
    composeQuoteHtml: true,
    initialDraftHash,
    initialDraftSavedAt: !asNew ? (message.dateValue ?? Date.now()) : null
  };
}


/** One synchronous initializer for every host/editor. Saved drafts retain authored text. */
export function computeComposeInitState(
  mode: ComposeMode, message: Message | undefined, asNew: boolean,
  opts: Parameters<typeof computeBaseComposeInitState>[3] & { sender?: SenderSettings; skipSignature?: boolean },
  deps: Parameters<typeof computeBaseComposeInitState>[4]
): ComposeInitFields & { identityId?: string; unavailableFrom?: string; signature?: SignatureBlock; unsignedBody?: string; warnings: string[] } {
  const sender = opts.sender;
  const fields = computeBaseComposeInitState(mode, message, asNew, opts, deps);
  if (!sender) return { ...fields, warnings: [] };
  const reopening = mode === "edit" && !asNew;
  const selection = resolveComposeIdentity({ accountId: sender.account.id, identities: sender.identities,
    prefs: sender.prefs, mode: reopening ? "draft" : mode === "reply" || mode === "replyAll" || mode === "forward" ? mode : "new", message });
  const identityId = selection.unavailableIdentityId ?? selection.identity?.id;
  const result = { ...fields, identityId, unavailableFrom: reopening && !selection.identity?.enabled ? message?.from : undefined,
    warnings: [...sender.warnings, ...selection.warnings] };
  if (reopening || opts.skipSignature) {
    // Include a resolved legacy From in the baseline without changing its body.
    if (result.initialDraftHash && identityId) result.initialDraftHash = JSON.stringify({ identityId, ...JSON.parse(result.initialDraftHash) });
    return result;
  }
  const template = resolveSignatureTemplate(sender.account.settings, sender.prefs, selection.identity);
  result.warnings.push(...template.warnings);
  const block = { id: template.id, ...renderSignatureTemplate(template.body, sender.user, selection.identity) };
  // No signature for this identity: a later From switch may still prefix one
  // to this untouched body, exactly like the insert below.
  if (!block.text) return { ...result, unsignedBody: fields.composeTab === "html" ? fields.composeHtml : fields.composeTab === "markdown" ? fields.composeMarkdown : fields.composeBody };
  // Text replies contain their quote in the same field; prepend before that quote.
  return { ...result, signature: block,
    composeBody: [block.text, fields.composeBody].filter(Boolean).join("\n\n"),
    composeMarkdown: [block.markdown, fields.composeMarkdown].filter(Boolean).join("\n\n"),
    composeHtml: block.html + fields.composeHtml,
    composeHtmlText: [block.text, fields.composeHtmlText].filter(Boolean).join("\n\n") };
}
