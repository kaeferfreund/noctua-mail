// Keep the parser stack behind this single interaction-time boundary. Both
// compose controls and persistence wait for it before converting content.
// Server rendering can import markdownConverters directly.
type MarkdownConverters = typeof import("./markdownConverters");
let converters: MarkdownConverters | undefined;
let pending: Promise<MarkdownConverters> | undefined;
const listeners = new Set<() => void>();

export const areMarkdownConvertersReady = () => converters !== undefined;
export const subscribeMarkdownConverters = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function loadMarkdownConverters(): Promise<MarkdownConverters> {
  return pending ??= import("./markdownConverters").then((module) => {
    converters = module;
    listeners.forEach((listener) => listener());
    return module;
  }).catch((error: unknown) => {
    // A failed chunk download must allow the next compose attempt to retry.
    pending = undefined;
    throw error;
  });
}

function requireConverters(): MarkdownConverters {
  if (!converters) {
    throw new Error("Load Markdown converters before using compose conversions.");
  }
  return converters;
}

export function markdownToHtml(markdown: string): string {
  return requireConverters().markdownToHtml(markdown);
}

export function htmlToMarkdown(html: string): string {
  return requireConverters().htmlToMarkdown(html);
}

export function textToMarkdown(text: string): string {
  return text;
}
