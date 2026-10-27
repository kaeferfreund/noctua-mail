"use client";

import { createContext, useCallback, useContext, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Mic } from "lucide-react";
import { cn } from "cn";
import type { Message } from "@/lib/data";
import { AI_REPLY_INSTRUCTION_LIMIT, appendAiReplyInstruction, normalizeAiReplyInstruction } from "@/lib/aiReplyInstruction";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/app/components/ui/popover";
import { Sheet, SheetContent, SheetTitle } from "@/app/components/ui/sheet";
import { useIsMobile } from "@/app/hooks/use-mobile";
import { useSpeechDictation } from "@/app/hooks/useSpeechDictation";

/** The counter appears from this many characters on. */
const COUNTER_FROM = 150;

/** Kept after closing so the popover leaves from its anchor; `opening` remounts the form per opening. */
type AiReplyPromptTarget = { message: Message; anchor: HTMLElement | null; open: boolean; opening: number };
type AiReplyPrompt = {
  /** Opens the instruction prompt for `message` next to `anchor`; the same anchor again closes it. */
  open: (message: Message, anchor: HTMLElement | null) => void;
};

const AiReplyPromptContext = createContext<AiReplyPrompt | null>(null);

export function useAiReplyPrompt() {
  return useContext(AiReplyPromptContext);
}

/**
 * For the ⋮ menu: the item calls `request`, the menu content passes its `onCloseAutoFocus` here.
 * The prompt opens once the menu has closed, anchored to `triggerRef` (the ⋮ button); opening it
 * from the item itself would lose its focus to the menu's focus return. Returns whether it took over.
 */
export function useAiReplyPromptFromMenu(message: Message, triggerRef: RefObject<HTMLElement | null>) {
  const prompt = useAiReplyPrompt();
  const requested = useRef(false);
  return {
    available: Boolean(prompt),
    request: () => { requested.current = true; },
    onCloseAutoFocus: (event: Event) => {
      if (!requested.current || !prompt) return false;
      requested.current = false;
      event.preventDefault();
      prompt.open(message, triggerRef.current);
      return true;
    }
  };
}

/**
 * „KI-Antwort entwerfen“ asks first for an optional short instruction, typed or dictated
 * (doc/AI-REPLY.md): a popover at the button on desktop, a bottom sheet on phones. One prompt
 * for the reader button and the ⋮ menu entry; submitting closes it and starts `draft`.
 */
export function AiReplyPromptProvider({ draft, children }: {
  draft: (message: Message, instruction?: string) => Promise<void>;
  children: ReactNode;
}) {
  const [target, setTarget] = useState<AiReplyPromptTarget | null>(null);
  const open = useCallback((message: Message, anchor: HTMLElement | null) => {
    setTarget(current => current?.open && current.anchor === anchor && current.message.id === message.id
      ? { ...current, open: false }
      : { message, anchor, open: true, opening: (current?.opening ?? 0) + 1 });
  }, []);
  const value = useMemo(() => ({ open }), [open]);
  const close = () => setTarget(current => current && { ...current, open: false });
  const submit = (instruction: string) => {
    if (!target?.open) return;
    close();
    void draft(target.message, instruction || undefined);
  };
  return (
    <AiReplyPromptContext.Provider value={value}>
      {children}
      {target ? <AiReplyPromptSurface target={target} onClose={close} onSubmit={submit} /> : null}
    </AiReplyPromptContext.Provider>
  );
}

function AiReplyPromptSurface({ target, onClose, onSubmit }: {
  target: AiReplyPromptTarget;
  onClose: () => void;
  onSubmit: (instruction: string) => void;
}) {
  const isMobile = useIsMobile();
  const t = useTranslations("Reader");
  const { anchor } = target;
  const anchorRef = useMemo(() => ({ current: anchor ?? document.body }), [anchor]);
  const changeOpen = (open: boolean) => { if (!open) onClose(); };
  // Remount per opening: an empty field and a fresh recognizer each time.
  const form = <AiReplyPromptForm key={target.opening} onSubmit={onSubmit} />;
  if (isMobile) {
    return (
      <Sheet open={target.open} onOpenChange={changeOpen}>
        <SheetContent side="bottom" aria-describedby={undefined} data-ai-reply-prompt="sheet" className="gap-0 px-4 pt-4 pb-[calc(var(--sab)+1rem)]">
          <SheetTitle className="mb-3 pr-10">{t("aiReply")}</SheetTitle>
          {form}
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Popover open={target.open} onOpenChange={changeOpen}>
      <PopoverAnchor virtualRef={anchorRef as RefObject<HTMLElement>} />
      <PopoverContent align="end" side="bottom" aria-label={t("aiReply")} data-ai-reply-prompt="popover" className="w-[22rem] p-3"
        // A click on the anchor itself toggles through `open`; do not let it count as outside first.
        onInteractOutside={event => { if (event.target instanceof Node && anchor?.contains(event.target)) event.preventDefault(); }}
        onCloseAutoFocus={event => { event.preventDefault(); anchor?.focus({ preventScroll: true }); }}>
        {form}
      </PopoverContent>
    </Popover>
  );
}

function AiReplyPromptForm({ onSubmit }: { onSubmit: (instruction: string) => void }) {
  const t = useTranslations("Reader.aiReplyPrompt");
  const locale = useLocale();
  const [value, setValue] = useState("");
  const hintId = useId();
  const dictation = useSpeechDictation({
    lang: locale === "en" ? "en-US" : "de-DE",
    onFinal: text => setValue(current => appendAiReplyInstruction(current, text))
  });
  const submit = (instruction: string) => onSubmit(normalizeAiReplyInstruction(instruction).slice(0, AI_REPLY_INSTRUCTION_LIMIT));
  const hint = dictation.error ? t(`dictationErrors.${dictation.error}`) : dictation.listening ? t("listening") : null;
  const textClass = "text-base md:text-sm";
  const interimRef = useRef<HTMLDivElement>(null);
  // Keep the newest words in view when the text is longer than the field.
  useLayoutEffect(() => {
    const mirror = interimRef.current;
    if (mirror) mirror.scrollLeft = mirror.scrollWidth;
  }, [dictation.interim, value]);

  return (
    <form className="flex flex-col gap-2" onSubmit={event => { event.preventDefault(); submit(value); }}>
      <div className="flex items-center gap-1.5">
        <div className="relative min-w-0 flex-1">
          <Input value={value} maxLength={AI_REPLY_INSTRUCTION_LIMIT} placeholder={dictation.interim ? undefined : t("placeholder")}
            aria-label={t("label")} aria-describedby={hint ? hintId : undefined} autoComplete="off" enterKeyHint="send"
            data-ai-reply-instruction className={cn("h-9", textClass, dictation.interim && "text-transparent")} onChange={event => setValue(event.target.value)} />
          {dictation.interim ? (
            // While words are recognized the text shows here: typed text, then the interim words in grey;
            // the final result replaces them in the field.
            <div ref={interimRef} aria-hidden data-ai-reply-interim
              className={cn("pointer-events-none absolute inset-0 flex items-center overflow-hidden border border-transparent px-2.5 whitespace-pre", textClass)}>
              <span>{value ? `${value} ` : ""}</span>
              <span className="text-muted-foreground">{dictation.interim}</span>
            </div>
          ) : null}
        </div>
        {dictation.supported ? (
          <Button type="button" size="icon" variant={dictation.listening ? "destructive" : "outline"} className="size-9"
            aria-label={dictation.listening ? t("stopDictation") : t("dictate")} title={dictation.listening ? t("stopDictation") : t("dictate")}
            aria-pressed={dictation.listening} data-ai-reply-dictate={dictation.listening ? "listening" : "idle"} onClick={dictation.toggle}>
            <Mic className={dictation.listening ? "motion-safe:animate-pulse" : undefined} />
          </Button>
        ) : null}
      </div>
      {hint || value.length >= COUNTER_FROM ? (
        <div className="flex min-h-4 items-center gap-2 text-xs text-muted-foreground">
          {hint ? <span id={hintId} role="status" data-ai-reply-hint={dictation.error ?? "listening"}
            className={dictation.error ? "text-destructive" : undefined}>{hint}</span> : null}
          {value.length >= COUNTER_FROM ? (
            <span className="ml-auto tabular-nums" data-ai-reply-counter>{t("counter", { count: value.length, limit: AI_REPLY_INSTRUCTION_LIMIT })}</span>
          ) : null}
        </div>
      ) : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" data-ai-reply-submit="plain" onClick={() => submit("")}>{t("withoutHint")}</Button>
        <Button type="submit" data-ai-reply-submit="instruction">{t("submit")}</Button>
      </div>
    </form>
  );
}
