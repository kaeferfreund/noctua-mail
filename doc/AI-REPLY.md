# KI-Antwort (AI reply draft)

The reader's „KI-Antwort entwerfen“ button (sparkles icon, also in the ⋮ menu)
lets a language model write the obvious short reply that closes a conversation —
„Vielen Dank, das passt so.“, „Das ist ja klasse, danke!“ — and saves it as a
reply draft. The draft opens in the composer for review. **Nothing is sent.**

Code: `lib/aiReply.ts` (configuration, prompt, model call, draft body),
`app/api/accounts/[accountId]/messages/[messageId]/ai-reply/route.ts`,
`app/components/mailclient/message/MessageReaderActions.tsx` (client action).

## Flow

1. `POST /api/accounts/{accountId}/messages/{messageId}/ai-reply` with
   `{"locale":"de"|"en"}` (the UI language; it only decides the reply header
   „Am … schrieb …“). Same guard as saving a draft: live session, same origin,
   JSON, editor or manager of the mailbox. Drafts cannot be answered (400).
2. **Input.** From, To, Cc, Date, Subject and the message's own text: HTML-only
   mail is converted with the spam classifier's html→text helper, quoted lines
   (`>`) and everything from the first reply attribution / forward marker on are
   removed (`stripQuotedText`), the rest is capped at 8,000 characters.
3. **Model call** with the AI SDK Anthropic provider, `effort: "high"`, at most
   600 output tokens, 60 s timeout, no SDK retries. No `thinking`, thinking
   budget, `temperature` or `topP` are sent: current Opus models reject them.
   The fixed system prompt carries the same one-hour cache breakpoint as the
   spam classifier. The prompt asks for 1–3 sentences between greeting and
   sign-off in the mail's language (default German), mirroring „du“/„Sie“, no
   invented facts or commitments, no placeholders, plain text; a mail that
   needs a real answer gets a polite holding reply.
4. **Draft.** The sender identity is resolved like a manual reply
   (`resolveSendIdentity`, mode reply); its display name signs the reply, or the
   user's signature template follows the reply when one applies. The body is
   reply → signature → quoted original under the reply header (an HTML draft
   with the compose quote block for HTML mail, a text draft with `> ` lines
   otherwise). It is saved with `buildDraftInputForMode("reply")` +
   `saveDraftForAccount`, the path MCP `create_draft_message` uses (recipient,
   `Re:` subject, In-Reply-To/References), and gets the local `$NoctuaAI` flag
   („KI-bearbeitet“ badge), like MCP-written drafts.
5. The client opens the returned draft with the „Entwurf bearbeiten“ path.

Responses: `{ok:true,draftId,message,url}`; 503 `{code:"ai_unavailable"}`
without an API key (the client then shows „KI-Antwort ist nicht eingerichtet
(kein API-Schlüssel)“; the button is hidden anyway when the server has no key);
502 `{code:"ai_failed",reason:"ai_timeout"|"ai_empty"|"ai_call_failed"}`;
429 `{code:"rate_limited"}` after 10 calls per user and minute (per process).

Each call logs one content-free line: `[ai-reply] draft created` with account,
message id, model, duration and input/output tokens (or `[ai-reply] model call
failed` with the code). Mail text and reply text are never logged.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | unset | Shared with spam detection. Unset hides the button and the route answers 503 |
| `NOCTUA_AI_REPLY_MODEL` | `claude-opus-5-5` | Model ID for AI replies |
