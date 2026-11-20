"use client";

import { ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import { classifyMarkdownImage } from "./markdownImages";

export type MarkdownContentProps = {
  source: string;
  /** Remote-content consent for this content (useRemoteContent). */
  remoteImagesAllowed: boolean;
  /** Placeholder action for a blocked remote image; without it the placeholder is inert. */
  onLoadRemoteImages?: () => void;
  onLinkPreview?: (url: string | null) => void;
};

function imageLabel(src: string, alt: string | undefined) {
  if (alt?.trim()) return alt.trim();
  try {
    return new URL(src).host;
  } catch {
    return src;
  }
}

type MarkdownImageProps = {
  src: string;
  alt?: string;
  title?: string;
  remoteImagesAllowed: boolean;
  onLoadRemoteImages?: () => void;
};

/** Local images render; remote ones only with consent; anything else never loads. */
function MarkdownImage({ src, alt, title, remoteImagesAllowed, onLoadRemoteImages }: MarkdownImageProps) {
  const t = useTranslations("Reader");
  const kind = classifyMarkdownImage(src);
  if (kind === "local" || (kind === "remote" && remoteImagesAllowed)) {
    // eslint-disable-next-line @next/next/no-img-element -- message content, not an app asset
    return <img src={src} alt={alt ?? ""} title={title} referrerPolicy="no-referrer" loading="lazy" />;
  }
  const label = t(kind === "remote" ? "remoteImage" : "blockedImage", { label: imageLabel(src, alt) });
  const content = (
    <>
      <ImageOff size={14} aria-hidden="true" />
      <span>{label}</span>
    </>
  );
  return kind === "remote" && onLoadRemoteImages ? (
    <button type="button" className="markdown-blocked-image" title={t("loadOnce")} onClick={onLoadRemoteImages}>
      {content}
    </button>
  ) : (
    <span className="markdown-blocked-image" title={title}>{content}</span>
  );
}

/**
 * Noctua's Markdown renderer for the app document (mail Markdown view,
 * thread notes, compose preview): react-markdown with remark-gfm and
 * remark-breaks and without raw HTML, which stays visible as text. Links open
 * in a new tab without referrer. Remote images load only with consent;
 * relative or unknown image sources never load.
 */
export default function MarkdownContent({ source, remoteImagesAllowed, onLoadRemoteImages, onLinkPreview }: MarkdownContentProps) {
  const components: Components = {
    a: ({ node: _node, href, ...props }) => (
      <a
        {...props}
        href={href}
        target="_blank"
        rel="noreferrer"
        onMouseEnter={onLinkPreview ? (event) => onLinkPreview(event.currentTarget.href || href || null) : undefined}
        onMouseLeave={onLinkPreview ? () => onLinkPreview(null) : undefined}
        onFocus={onLinkPreview ? (event) => onLinkPreview(event.currentTarget.href || href || null) : undefined}
        onBlur={onLinkPreview ? () => onLinkPreview(null) : undefined}
      />
    ),
    img: ({ node: _node, src, alt, title }) => (
      <MarkdownImage
        src={typeof src === "string" ? src : ""}
        alt={alt}
        title={title}
        remoteImagesAllowed={remoteImagesAllowed}
        onLoadRemoteImages={onLoadRemoteImages}
      />
    )
  };
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]} components={components}>
      {source}
    </ReactMarkdown>
  );
}
