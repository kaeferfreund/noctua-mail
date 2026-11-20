"use client";

import ReactMarkdown, { type Components } from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import RemoteImagePlaceholder from "@/app/components/RemoteImagePlaceholder";
import { classifyImageSource } from "@/lib/html/remoteContent";

export type MarkdownContentProps = {
  source: string;
  /** Remote-content consent for this content (useRemoteContent). */
  remoteImagesAllowed: boolean;
  /** Placeholder action for a blocked remote image; without it the placeholder is inert. */
  onLoadRemoteImages?: () => void;
  onLinkPreview?: (url: string | null) => void;
};

type MarkdownImageProps = {
  src: string;
  alt?: string;
  title?: string;
  remoteImagesAllowed: boolean;
  onLoadRemoteImages?: () => void;
};

/** Local images render; remote ones only with consent; anything else never loads. */
function MarkdownImage({ src, alt, title, remoteImagesAllowed, onLoadRemoteImages }: MarkdownImageProps) {
  const kind = classifyImageSource(src);
  if (kind === "local" || (kind === "remote" && remoteImagesAllowed)) {
    // eslint-disable-next-line @next/next/no-img-element -- message content, not an app asset
    return <img src={src} alt={alt ?? ""} title={title} referrerPolicy="no-referrer" loading="lazy" />;
  }
  return <RemoteImagePlaceholder src={src} alt={alt} title={title} kind={kind} onLoad={onLoadRemoteImages} />;
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
