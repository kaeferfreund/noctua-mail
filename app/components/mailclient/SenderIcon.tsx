import { useMemo, useState, type CSSProperties } from "react";
import { buildAccountSenderIconPath } from "@/lib/accountApiPaths";
import { getSenderIconColors, getSenderIdentity } from "@/lib/senderIdentity";
import styles from "./SenderIcon.module.css";

type SenderIconProps = {
  accountId: string;
  from?: string | null;
  fromEmail?: string | null;
  enabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  title?: string;
  /** Draws the accent ring that marks an unread row in the message lists. */
  unread?: boolean;
};

/** URL of the account's sender-icon route. With `fallback: "none"` the route
 * answers 404 instead of its initials SVG when no logo is found, so callers
 * can keep their own initials. `version` (of an uploaded domain icon) makes
 * the browser load a new upload instead of a cached favicon. */
export function buildSenderIconSrc(
  accountId: string,
  sender: { from?: string | null; fromEmail?: string | null; fallback?: "none"; version?: string | null }
) {
  const search = new URLSearchParams({
    from: sender.from ?? ""
  });
  if (sender.fromEmail) search.set("fromEmail", sender.fromEmail);
  if (sender.fallback) search.set("fallback", sender.fallback);
  if (sender.version) search.set("v", sender.version);
  return buildAccountSenderIconPath(accountId, search);
}

export default function SenderIcon({
  accountId,
  from,
  fromEmail,
  enabled = true,
  size = "sm",
  className = "",
  title,
  unread = false
}: SenderIconProps) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const identity = useMemo(
    () => getSenderIdentity({ from, fromEmail }),
    [from, fromEmail]
  );
  const src = useMemo(
    () => buildSenderIconSrc(accountId, { from, fromEmail }),
    [accountId, from, fromEmail]
  );

  if (!enabled || !accountId) return null;

  const colors = getSenderIconColors(identity.paletteIndex);

  return (
    <span
      className={[
        styles.icon,
        size === "md" ? styles.iconMd : styles.iconSm,
        className
      ]
        .filter(Boolean)
        .join(" ")}
      title={title}
      aria-hidden="true"
      data-unread={unread || undefined}
      style={
        {
          "--sender-icon-bg": colors.background,
          "--sender-icon-fg": colors.foreground
        } as CSSProperties
      }
    >
      <span className={styles.placeholder}>{identity.initials}</span>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={`${styles.image} ${loadedSrc === src ? styles.imageLoaded : ""}`}
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onLoad={() => setLoadedSrc(src)}
        onError={() => setLoadedSrc(null)}
      />
    </span>
  );
}
