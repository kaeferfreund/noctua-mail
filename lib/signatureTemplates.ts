import type { AccountSettings, SenderIdentity, UserAccountPrefs } from "./data";
import { escapeHtml } from "./html";

export type SignatureUser = { name?: string | null; email: string };
export type SignatureBlock = { id: string; text: string; html: string; markdown?: string };
const tokens = /\{\{(user\.(?:name|email)|identity\.(?:displayName|email))\}\}/g;

export function validSignatureTemplate(template: string) {
  return new TextEncoder().encode(template).length <= 8192 &&
    !/\{\{|\}\}/.test(template.replace(tokens, ""));
}

/** Substitute once, then escape. Profile text can never introduce markup/tokens. */
export function renderSignatureTemplate(template: string, user: SignatureUser, identity?: Pick<SenderIdentity, "email" | "displayName">) {
  if (!validSignatureTemplate(template)) throw new Error("Use only the supported signature placeholders (maximum 8 KiB).");
  const values: Record<string, string> = {
    "user.name": user.name?.trim() || user.email,
    "user.email": user.email,
    "identity.displayName": identity?.displayName ?? "",
    "identity.email": identity?.email ?? ""
  };
  const text = template.replace(/\r\n?/g, "\n").replace(tokens, (_, key: string) => values[key]).trim();
  return { text, markdown: text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/([\\`*_{}[\]()#+.!|~-])/g, "\\$1"), html: text ? `<p>${escapeHtml(text).replace(/\n/g, "<br>")}</p>` : "" };
}

export function resolveSignatureTemplate(settings: AccountSettings | undefined, prefs: UserAccountPrefs, identity?: SenderIdentity) {
  const warnings: string[] = [];
  if (prefs.signatureOverride !== undefined) return { id: "__personal", body: prefs.signatureOverride, warnings };
  for (const id of [prefs.defaultSignatureId, identity?.signatureId, settings?.defaultSignatureId]) {
    if (id === "") return { id: "", body: "", warnings };
    if (id === undefined) continue;
    const signature = settings?.signatures?.find(item => item.id === id);
    if (signature) return { ...signature, warnings };
    warnings.push("A signature template is unavailable. Review your signature preferences.");
  }
  return { id: "", body: "", warnings };
}

/** Only an exact, unique tracked block can be removed. Edited/ambiguous text survives. */
export function replaceSignatureBlock(body: string, previous: string | undefined, next: string, separator: string) {
  if (!previous) return { body: [body, next].filter(Boolean).join(separator), conflict: Boolean(body) };
  const index = body.indexOf(previous);
  const exactTextBlock = separator !== "\n\n" || ((index === 0 || body.slice(0, index).endsWith("\n\n")) && (index + previous.length === body.length || body.slice(index + previous.length).startsWith("\n\n")));
  if (index < 0 || !exactTextBlock || body.indexOf(previous, index + previous.length) !== -1) return { body, conflict: true };
  return { body: body.slice(0, index) + next + body.slice(index + previous.length), conflict: false };
}
