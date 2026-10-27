import { NextResponse } from "next/server";
import { withAuthResponse } from "@/lib/auth";
import { readAuthEnv } from "@/lib/betterAuth";
import { AiReplyError, buildAiReplyDraftBody, generateAiReply, getAiReplyLanguageModel, resolveAiReplyConfig } from "@/lib/aiReply";
import { normalizeAccountDateFormat, getMessageDateDisplay } from "@/lib/dateFormatting";
import { DraftSaveError, buildDraftInputForMode, saveDraftForAccount } from "@/lib/drafts";
import { defaultLocale, isUiLocale } from "@/lib/i18n/config";
import { getTranslator } from "@/lib/i18n/translator";
import { AI_MODIFIED_FLAG } from "@/lib/messageFlags";
import { messageDeepLink } from "@/lib/navigation/deepLinks";
import { OutboundAuthorizationError } from "@/lib/outboundAuthorization";
import { createRateLimiter } from "@/lib/rateLimit";
import { SenderIdentityError } from "@/lib/senderIdentities";
import { resolveSendIdentity } from "@/lib/sendIdentity";
import { getMessageById, getUserAccountPrefs, getUserById } from "@/lib/serverDb";
import { renderSignatureTemplate, resolveSignatureTemplate } from "@/lib/signatureTemplates";
import { collabActorFromSession } from "@/lib/threadCollab";
import { getAccountIdFromParams, type AccountRouteParams } from "@/app/api/_helpers/accountContext";
import { requireAccountAndMessageContext } from "@/app/api/_helpers/message/routeHelpers";
import { requireJsonSameOrigin } from "@/app/api/_helpers/requestOrigin";

type Params = AccountRouteParams & {
  params: Promise<{ accountId?: string; messageId?: string }>;
};

/** Ten model calls per user and minute, across all mailboxes. */
const aiReplyLimiter = createRateLimiter({ max: 10 });

/**
 * POST — drafts the obvious closing reply to a message with the AI model
 * (doc/AI-REPLY.md) and saves it as a reply draft. Never sends.
 */
export async function POST(request: Request, { params }: Params) {
  const originError = requireJsonSameOrigin(request); if (originError) return originError;
  const accountId = await getAccountIdFromParams(params);
  const { messageId: rawMessageId } = await params;
  const messageId = typeof rawMessageId === "string" ? rawMessageId.trim() : "";
  const context = await requireAccountAndMessageContext(request, { accountId, messageId },
    { minRole: "editor", missingFieldsMessage: "Missing accountId or messageId" });
  if (context instanceof NextResponse) return context;
  return withAuthResponse(context, async () => {
    const { account, accountId: resolvedAccountId, message, userId } = context;
    if (message.draft) return NextResponse.json({ ok: false, code: "draft_message", message: "Drafts cannot be answered." }, { status: 400 });
    const config = resolveAiReplyConfig();
    const model = getAiReplyLanguageModel(config);
    if (!model) return NextResponse.json({ ok: false, code: "ai_unavailable", message: "AI reply is not configured (no API key)." }, { status: 503 });
    if (aiReplyLimiter.isLimited(userId)) {
      return NextResponse.json({ ok: false, code: "rate_limited", message: "Too many AI replies. Try again in a minute." },
        { status: 429, headers: { "Retry-After": "60" } });
    }
    const body = (await request.json().catch(() => null)) as { locale?: unknown } | null;
    const locale = isUiLocale(body?.locale) ? body.locale : defaultLocale;
    const started = Date.now();
    try {
      const identity = await resolveSendIdentity({ accountId: resolvedAccountId, userId, mode: "reply", message });
      const [prefs, user] = await Promise.all([getUserAccountPrefs(userId, resolvedAccountId), getUserById(userId)]);
      const template = resolveSignatureTemplate(account.settings, prefs, identity);
      const signature = template.body && user ? renderSignatureTemplate(template.body, { name: user.name, email: user.email }, identity) : null;
      const { text: reply, usage } = await generateAiReply({ model, message,
        sender: { name: identity.displayName || user?.name || identity.email, signatureFollows: Boolean(signature?.text) } });
      const date = getMessageDateDisplay(message.dateValue, message.date, normalizeAccountDateFormat(account.settings?.appearance?.dateFormat), locale).text;
      const replyHeader = getTranslator(locale)("Compose.generated.replyHeader", { date, sender: message.from });
      const payload = await buildDraftInputForMode(account, resolvedAccountId, { mode: "reply", messageId: message.id, identityId: identity.id,
        ...buildAiReplyDraftBody({ reply, signature: signature?.text ? signature : null, original: message, replyHeader }) });
      const result = await saveDraftForAccount({ account, accountId: resolvedAccountId, clientId: context.clientId ?? "", payload,
        localFlags: [AI_MODIFIED_FLAG], actor: collabActorFromSession(context.session, context.clientId), authorization: { request } });
      const draft = result.draftId ? await getMessageById(resolvedAccountId, result.draftId) : result.message;
      // Content-free journal line: never the mail or the reply text.
      console.info("[ai-reply] draft created", { accountId: resolvedAccountId, messageId: message.id, model: config.model,
        durationMs: Date.now() - started, inputTokens: usage.inputTokens ?? 0, outputTokens: usage.outputTokens ?? 0 });
      return NextResponse.json({ ok: true, draftId: result.draftId, message: draft ?? null,
        url: draft ? messageDeepLink(draft, readAuthEnv().baseURL) : null });
    } catch (error) {
      if (error instanceof AiReplyError) {
        console.warn("[ai-reply] model call failed", { accountId: resolvedAccountId, messageId: message.id, model: config.model,
          durationMs: Date.now() - started, code: error.code });
        return NextResponse.json({ ok: false, code: "ai_failed", reason: error.code, message: "The AI reply could not be written." }, { status: 502 });
      }
      if (error instanceof OutboundAuthorizationError) return error.response;
      if (error instanceof SenderIdentityError) return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: error.status });
      if (error instanceof DraftSaveError) return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
      throw error;
    }
  });
}
