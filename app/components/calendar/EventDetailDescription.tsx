"use client";

import { linkifyText } from "@/app/components/LinkifiedText";
import { linkifyHtmlTextNodes, sanitizeHtmlForAppDocument } from "@/lib/html";
import senderHtmlStyles from "./SenderHtml.module.css";
import styles from "./EventDetailView.module.css";

export type EventDetailDescriptionProps = {
  description?: string;
};

function looksLikeHtml(value: string) {
  return /<\s*\/?\s*[a-z][\w:-]*(\s[^>]*?)?>/i.test(value);
}

function sanitizeDescriptionHtml(value: string) {
  return linkifyHtmlTextNodes(sanitizeHtmlForAppDocument(value));
}

/**
 * Renders the event description. HTML content goes through the app-document
 * sanitizer (no sender stylesheets, safe links) before being inserted via
 * dangerouslySetInnerHTML; the container confines inline styles. Plain-text
 * content is linkified so URLs become clickable.
 */
export default function EventDetailDescription({ description }: EventDetailDescriptionProps) {
  const trimmed = description?.trim() ?? "";
  if (!trimmed) return null;

  const descriptionHtml = looksLikeHtml(trimmed) ? sanitizeDescriptionHtml(trimmed) : "";
  const useHtml = Boolean(descriptionHtml);

  return (
    <div className={styles.description}>
      <span className={styles.descriptionLabel}>Description</span>
      {useHtml ? (
        <div className={`${styles.descriptionText} ${senderHtmlStyles.senderHtml}`} dangerouslySetInnerHTML={{ __html: descriptionHtml }} />
      ) : (
        <span className={styles.descriptionText}>
          {linkifyText(trimmed, styles.descriptionLink)}
        </span>
      )}
    </div>
  );
}
