# KI-Antwort (AI reply draft)

The reader's „KI-Antwort entwerfen“ button (sparkles icon, also in the ⋮ menu)
lets a language model write the obvious short reply that closes a conversation —
„Vielen Dank, das passt so.“, „Das ist ja klasse, danke!“ — or, with a short
instruction from the user, the reply the user wants („Zusage, Donnerstag 14 Uhr
passt“), and saves it as a reply draft. The draft opens in the composer for
review. **Nothing is sent.**

Code: `lib/aiReply.ts` (configuration, prompt, model call, draft body),
`lib/aiReplyInstruction.ts` (instruction limit and normalization, shared by client
and server), `app/api/accounts/[accountId]/messages/[messageId]/ai-reply/route.ts`,
`app/components/mailclient/message/MessageReaderActions.tsx` (client action),
`app/components/mailclient/message/AiReplyPrompt.tsx` (instruction prompt),
`app/hooks/useSpeechDictation.ts` (dictation).

## Instruction prompt

A click on the button (or the ⋮ entry) first opens a small prompt: a popover at
the button on desktop (at the ⋮ button for the menu entry), a bottom sheet below
768 px.

- One text field, „Worum soll es gehen? (optional)“, at most 200 characters; the
  counter „150/200“ appears from 150 characters on.
- „Entwerfen“ (or Enter in the field) drafts with the instruction; „Ohne Hinweis“
  drafts without one, exactly the one-click reply from before. A blank field
  counts as no instruction. Esc (or a click outside) closes the prompt.
- Submitting closes the prompt; the button shows the running state until the
  draft opens.
- **Dictation.** A microphone button appears when the browser offers the Web
  Speech API (`SpeechRecognition` or `webkitSpeechRecognition`). It records one
  utterance in the UI language (`de-DE`/`en-US`); words in progress show in grey
  behind the typed text, the final text is appended to the field within the
  200-character limit. A second click stops early. A denied microphone, silence
  or a missing connection show a short hint below the field, never a toast.
  The recognition runs in the browser; Chrome and Edge send the audio to their
  vendor's speech service, Safari uses Apple's. Noctua itself only receives the
  resulting text.
- **iPhone/iPad.** The keyboard's own dictation key works in the field as in any
  text field, also where the microphone button is missing.

| Browser | Microphone button |
| --- | --- |
| Chrome, Edge (desktop, Android) | yes |
| Safari 14.1+ (macOS), Safari on iOS/iPadOS 14.5+ | yes (`webkitSpeechRecognition`; the keyboard dictation key works too) |
| Firefox | no (no Web Speech recognition); type, or use the OS dictation |
| Installed PWA | as the underlying browser |

## Flow

1. `POST /api/accounts/{accountId}/messages/{messageId}/ai-reply` with
   `{"locale":"de"|"en","instruction"?:string}` (the UI language only decides the
   reply header „Am … schrieb …“). The instruction is trimmed and whitespace runs
   collapse to one space, on the client and again on the server; beyond 200
   characters the route answers 400 `instruction_too_long`, a blank one counts as
   none. Same guard as saving a draft: live session, same origin, JSON, editor or
   manager of the mailbox. Drafts cannot be answered (400).
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
   With an instruction, the user turn starts with it in its own
   `<instruction>` block before the `<email>` block: the reply says what it
   asks for, may state the facts it contains (dates, prices, yes/no) and may
   use up to 4 sentences; the rule becomes „no facts beyond the e-mail and the
   user's instruction“. Tags `<email>`/`<instruction>` are removed from both
   texts, so neither can open or close a block; the e-mail stays data, not
   instructions. Output cap unchanged (600 tokens).
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
message id, model, duration, `instructionChars` (length of the instruction, 0
without one) and input/output tokens (or `[ai-reply] model call failed` with the
code). Mail text, instruction text and reply text are never logged.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | unset | Shared with spam detection. Unset hides the button and the route answers 503 |
| `NOCTUA_AI_REPLY_MODEL` | `claude-opus-5-5` | Model ID for AI replies |
