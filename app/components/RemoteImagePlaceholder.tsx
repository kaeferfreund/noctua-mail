"use client";

import { ImageOff } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ImageSourceKind } from "@/lib/html/remoteContent";

function imageLabel(src: string, alt: string | undefined) {
  if (alt?.trim()) return alt.trim();
  try {
    return new URL(src).host;
  } catch {
    return src;
  }
}

/**
 * Stands in for an image of sender content that is not loaded in the app
 * document (rendered Markdown, rich compose editor). A remote image becomes a
 * button when `onLoad` is given (remote-content consent); an inert source
 * never loads.
 */
export default function RemoteImagePlaceholder({ src, alt, title, kind, onLoad }: {
  src: string;
  alt?: string;
  title?: string;
  kind: Exclude<ImageSourceKind, "local">;
  onLoad?: () => void;
}) {
  const t = useTranslations("Reader");
  const content = (
    <>
      <ImageOff size={14} aria-hidden="true" />
      <span>{t(kind === "remote" ? "remoteImage" : "blockedImage", { label: imageLabel(src, alt) })}</span>
    </>
  );
  return kind === "remote" && onLoad ? (
    <button type="button" className="remote-image-placeholder" title={t("loadOnce")} onClick={onLoad}>
      {content}
    </button>
  ) : (
    <span className="remote-image-placeholder" title={title}>{content}</span>
  );
}
