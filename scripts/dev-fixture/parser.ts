/** Small wire/MIME helpers. Operate on bytes for RFC822 literals, never JS character counts. */
export type LiteralToken = { kind: "literal"; data: Buffer };
export type CommandPart = string | LiteralToken;
export function tokens(parts: readonly CommandPart[]): CommandPart[] {
  const result: CommandPart[] = [];
  for (const part of parts) {
    if (typeof part !== "string") {
      if (part.kind !== "literal" || !Buffer.isBuffer(part.data)) throw new Error("Invalid literal token");
      result.push(part);
      continue;
    }
    let i = 0;
    while (i < part.length) {
      if (/\s/.test(part[i])) { i++; continue; }
      if ('()'.includes(part[i])) { result.push(part[i++]); continue; }
      if (part[i] === '"') {
        let value = "";
        i++;
        while (i < part.length && part[i] !== '"') {
          if (part[i] === "\\") {
            if (++i === part.length) throw new Error("Unclosed quoted string");
          }
          value += part[i++];
        }
        if (part[i++] !== '"') throw new Error("Unclosed quoted string");
        result.push(value);
        continue;
      }
      const start = i;
      let bracket = 0;
      while (i < part.length) {
        if (part[i] === "[") bracket++;
        if (part[i] === "]" && --bracket < 0) throw new Error("Unexpected closing bracket");
        if (!bracket && /[\s()]/.test(part[i])) break;
        i++;
      }
      if (bracket) throw new Error("Unclosed section bracket");
      result.push(part.slice(start, i));
    }
  }
  return result;
}
export const quote = (value: string | undefined | null): string => value == null ? "NIL" : `"${value.replace(/[\r\n]/g, " ").replace(/[\\"]/g, "\\$&")}"`;
export function inSet(set: string, value: number, max: number): boolean {
  return set.split(",").some(range => {
    const parts = range.split(":").map(v => v === "*" ? max : Number(v));
    return parts.length === 1 ? value === parts[0] : value >= Math.min(...parts) && value <= Math.max(...parts);
  });
}
export type MimeNode = { raw: Buffer; header: Buffer; body: Buffer; headers: Map<string, string>; type: string; subtype: string; params: Map<string, string>; children: MimeNode[] };
function parameters(value: string) {
  const result = new Map<string, string>();
  for (const match of value.matchAll(/;\s*([\w-]+)\s*=\s*(?:"([^"]*)"|([^;\s]+))/g)) result.set(match[1].toLowerCase(), match[2] ?? match[3]);
  return result;
}
export function parseMime(raw: Buffer): MimeNode {
  const split = raw.indexOf("\r\n\r\n");
  const header = split < 0 ? raw : raw.subarray(0, split + 4);
  const body = split < 0 ? Buffer.alloc(0) : raw.subarray(split + 4);
  const headers = new Map<string, string>();
  for (const line of header.toString().replace(/\r\n[ \t]+/g, " ").trimEnd().split("\r\n")) {
    const colon = line.indexOf(":");
    if (colon > 0) headers.set(line.slice(0, colon).toLowerCase(), line.slice(colon + 1).trim());
  }
  const contentType = headers.get("content-type") ?? "text/plain";
  const [type, subtype] = contentType.split(";")[0].trim().toLowerCase().split("/");
  const params = parameters(contentType);
  const children: MimeNode[] = [];
  if (type === "multipart" && params.has("boundary")) {
    const delimiter = `--${params.get("boundary")}`;
    // latin1 is a reversible byte mapping; do not round-trip binary parts through UTF-8.
    let lines: string[] | undefined;
    for (const line of body.toString("latin1").split("\r\n")) {
      if (line === delimiter || line === delimiter + "--") {
        if (lines) children.push(parseMime(Buffer.from(lines.join("\r\n"), "latin1")));
        if (line === delimiter + "--") break;
        lines = [];
      } else lines?.push(line);
    }
  }
  return { raw, header, body, headers, type, subtype: subtype ?? "plain", params, children };
}
/** Decode transfer bytes before interpreting their declared charset. */
export function decodeQuotedPrintable(value: string): Buffer {
  return Buffer.from(value.replace(/=[\t ]*\r?\n/g, "").replace(/=([a-f0-9]{2})/gi, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))), "latin1");
}
function decodeText(bytes: Buffer, charset = "utf-8"): string {
  try { return new TextDecoder(charset).decode(bytes); }
  catch { return bytes.toString("utf8"); }
}
export function decodeWords(value: string): string {
  // Whitespace between adjacent encoded words is folding, not visible text.
  return value.replace(/(\?=)[ \t\r\n]+(?==\?[^?]+\?[bq]\?)/gi, "$1")
    .replace(/=\?([^?]+)\?([bq])\?([^?]*)\?=/gi, (_, charset: string, encoding: string, data: string) =>
      decodeText(encoding.toLowerCase() === "b" ? Buffer.from(data, "base64") : decodeQuotedPrintable(data.replace(/_/g, " ")), charset));
}
export function searchableBody(node: MimeNode): string {
  if (node.children.length) return node.children.map(searchableBody).join(" ");
  const encoding = node.headers.get("content-transfer-encoding")?.toLowerCase();
  const bytes = encoding === "base64" ? Buffer.from(node.body.toString(), "base64") : encoding === "quoted-printable" ? decodeQuotedPrintable(node.body.toString("latin1")) : node.body;
  return decodeText(bytes, node.params.get("charset"));
}
const paramList = (params: Map<string, string>) => params.size ? `(${[...params].flatMap(([k, v]) => [quote(k.toUpperCase()), quote(v)]).join(" ")})` : "NIL";
export function bodyStructure(node: MimeNode): string {
  const disp = node.headers.get("content-disposition");
  const disposition = disp ? `(${quote(disp.split(";")[0].toUpperCase())} ${paramList(parameters(disp))})` : "NIL";
  if (node.type === "multipart") return `(${node.children.map(bodyStructure).join(" ")} ${quote(node.subtype.toUpperCase())} ${paramList(node.params)} ${disposition} NIL NIL)`;
  const fields = [quote(node.type.toUpperCase()), quote(node.subtype.toUpperCase()), paramList(node.params), quote(node.headers.get("content-id")), quote(node.headers.get("content-description")), quote((node.headers.get("content-transfer-encoding") ?? "7BIT").toUpperCase()), String(node.body.length)];
  if (node.type === "text") fields.push(String(node.body.toString().split("\r\n").length));
  fields.push("NIL", disposition, "NIL", "NIL");
  return `(${fields.join(" ")})`;
}
function addresses(value?: string) {
  if (!value) return "NIL";
  return `(${value.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(part => {
    const match = part.trim().match(/^(.*?)<([^>]+)>$/);
    const address = match ? match[2] : part.trim();
    const at = address.lastIndexOf("@");
    return `(${quote(match?.[1].trim().replace(/^"|"$/g, "") || null)} NIL ${quote(address.slice(0, at))} ${quote(address.slice(at + 1))})`;
  }).join(" ")})`;
}
export function envelope(node: MimeNode) {
  const h = node.headers;
  return `(${[quote(h.get("date")), quote(h.get("subject")), addresses(h.get("from")), addresses(h.get("sender") ?? h.get("from")), addresses(h.get("reply-to") ?? h.get("from")), addresses(h.get("to")), addresses(h.get("cc")), addresses(h.get("bcc")), quote(h.get("in-reply-to")), quote(h.get("message-id"))].join(" ")})`;
}
export function section(node: MimeNode, spec: string): Buffer | null {
  const part = spec.match(/^(\d+(?:\.\d+)*)(?:\.(.*))?$/);
  if (part) {
    let target = node;
    const path = part[1].split(".").map(Number);
    for (let i = 0; i < path.length; i++) {
      if (!target.children.length && i === 0 && path[i] === 1) continue;
      target = target.children[path[i] - 1];
      if (!target) return null;
    }
    return part[2] ? section(target, part[2]) : target.body;
  }
  if (!spec) return node.raw;
  if (spec === "TEXT") return node.body;
  if (spec === "HEADER" || spec === "MIME") return node.header;
  const fields = spec.match(/^HEADER\.FIELDS(\.NOT)?\s*\(([^)]*)\)$/i);
  if (fields) {
    const names = fields[2].toLowerCase().split(/\s+/);
    const lines = node.header.toString().trimEnd().split(/\r\n(?![ \t])/).filter(line => names.includes(line.split(":")[0].toLowerCase()) !== Boolean(fields[1]));
    return Buffer.from((lines.length ? lines.join("\r\n") + "\r\n" : "") + "\r\n");
  }
  return null;
}

/** IMAP4rev1 mailbox names use modified UTF-7 until UTF8=ACCEPT is enabled. */
export function encodeMailbox(value: string): string {
  return value.replace(/[^\x20-\x7e]+|&/g, run => run === "&" ? "&-" : `&${Buffer.from(run, "utf16le").swap16().toString("base64").replace(/=/g, "").replace(/\//g, ",")}-`);
}
export function decodeMailbox(value: string): string {
  return value.replace(/&([A-Za-z0-9+,]*)-/g, (_, encoded: string) => encoded ? Buffer.from(encoded.replace(/,/g, "/"), "base64").swap16().toString("utf16le") : "&");
}
