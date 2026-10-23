import { extractDisplayName, extractPrimaryEmail, formatAddress, splitAddressList } from "../../../../lib/senderIdentity";
export { formatAddress, splitAddressList } from "../../../../lib/senderIdentity";

export type ParsedAddress = {
  raw: string;
  displayName: string;
  email: string | null;
};

export function parseAddressList(value: string | null | undefined): ParsedAddress[] {
  return splitAddressList(value).map((raw) => ({
    raw,
    displayName: extractDisplayName(raw),
    email: extractPrimaryEmail(raw)
  }));
}

/**
 * True when the header uses RFC 5322 group syntax (`Group: a@x, b@x;`), which
 * `splitAddressList` cannot represent — it splits the members apart and leaves
 * the group name glued to the first one.
 */
function hasGroupSyntax(value: string): boolean {
  let inQuotes = false;
  let inAngles = false;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (inQuotes && ch === "\\" && i + 1 < value.length) {
      i += 1;
      continue;
    }
    if (ch === '"' && !inAngles) inQuotes = !inQuotes;
    else if (ch === "<" && !inQuotes) inAngles = true;
    else if (ch === ">" && !inQuotes) inAngles = false;
    else if (ch === ":" && !inQuotes && !inAngles) return true;
  }
  return false;
}

/** Comma-joined `Name <email>` list; entries without a parsable address keep their raw text. */
export function formatAddressList(value: string | null | undefined): string {
  const text = (value ?? "").trim();
  if (!text) return "";
  // A group header is already a valid address list; reformatting would drop the
  // group name, its terminator, and the members' display names.
  if (hasGroupSyntax(text)) return text;
  return parseAddressList(text)
    .map((addr) => (addr.email ? formatAddress(addr.displayName, addr.email) : addr.raw))
    .join(", ");
}
