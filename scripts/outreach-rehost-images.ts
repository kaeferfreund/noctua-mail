import { Database } from "bun:sqlite";
import { isIP } from "node:net";
import { parseArgs } from "node:util";
import { parseFragment, type DefaultTreeAdapterTypes as Tree } from "parse5";
import { closeOutreachDb, getOutreachDb, getOutreachDbPath, outreachDbExists } from "@/lib/addons/outreach/db";
import { imageUrl, OutreachImageError, prepareImage, saveOutreachImage } from "@/lib/addons/outreach/media";
import { OUTREACH_IMAGE_MAX_BYTES } from "@/lib/addons/outreach/types";

type FetchImage = (url: URL, options: RequestInit) => Promise<Response>;
type Options = {
  accountId: string;
  hosts: readonly string[];
  dropLinksTo?: readonly string[];
  write?: boolean;
  directory?: string;
  fetchImage: FetchImage;
};
type Document = { kind: "template" | "campaign" | "sequence step"; id: string; name: string; html: string;
  sequenceId: string | null; updatedAt: number };
type DocumentRef = Pick<Document, "kind" | "id">;
type Range = { start: number; end: number };
type ImageRef = Range & { url: string };
class RehostError extends Error {}

function allowedHosts(hosts: readonly string[]) {
  return new Set(hosts.map(value => {
    const hostname = value.toLowerCase();
    if (hostname.length > 253 || isIP(hostname) || !/^(?:(?!-)[a-z0-9-]{1,63}(?<!-)\.)+(?!-)[a-z0-9-]{1,63}(?<!-)$/.test(hostname)
      || new URL(`https://${hostname}`).hostname !== hostname) {
      throw new RehostError("Specify plain DNS hostnames for --host and --drop-links-to.");
    }
    return hostname;
  }));
}

function httpUrl(value: string) {
  try {
    const url = value.trim().startsWith("//") ? new URL(`https:${value.trim()}`) : new URL(value);
    if (url.protocol === "https:" || url.protocol === "http:") return url;
  } catch { /* Ignore relative and invalid URLs. */ }
}

function findChanges(html: string, hosts: Set<string>, dropHosts: Set<string>) {
  const tree = parseFragment(html, { sourceCodeLocationInfo: true });
  const pending: Tree.Node[] = [tree];
  const matches: Array<ImageRef | Range> = [];
  while (pending.length) {
    const node = pending.pop()!;
    if ("tagName" in node && node.namespaceURI === "http://www.w3.org/1999/xhtml") {
      const location = node.sourceCodeLocation;
      if (location && node.tagName === "a") {
        const href = httpUrl(node.attrs.find(attr => attr.name === "href")?.value ?? "");
        if (href && dropHosts.has(href.hostname)) {
          matches.push({ start: location.startOffset, end: location.endOffset });
          continue;
        }
      }
      const attr = location?.attrs?.src;
      if (attr && node.tagName === "img") {
        const src = httpUrl(node.attrs.find(item => item.name === "src")?.value ?? "");
        if (src && hosts.has(src.hostname)) {
          src.hash = "";
          matches.push({ start: attr.startOffset, end: attr.endOffset, url: src.href });
        }
      }
    }
    if ("childNodes" in node) for (const child of node.childNodes) pending.push(child);
    if ("content" in node) pending.push((node as Tree.Template).content);
  }

  // Source offsets preserve the bytes outside edits, including mail-specific markup and placeholder syntax.
  // The HTML parser may reconstruct a formatting element with the same opening tag. Drop its range once.
  const images: ImageRef[] = [];
  const links: Range[] = [];
  matches.sort((a, b) => a.start - b.start || b.end - a.end);
  let covered = 0;
  for (const match of matches) {
    if (match.start < covered) continue;
    covered = match.end;
    if ("url" in match) images.push(match);
    else links.push(match);
  }
  return { images, links };
}

const redirects = new Set([301, 302, 303, 307, 308]);
function cancelBody(body: ReadableStream<Uint8Array> | null) {
  void body?.cancel().catch(() => {});
}

async function fetchBytes(url: URL, hosts: Set<string>, fetchImage: FetchImage, signal: AbortSignal) {
  for (let hop = 0; ; hop++) {
    signal.throwIfAborted();
    if (url.protocol !== "https:" || !hosts.has(url.hostname) || url.username || url.password || url.port) {
      throw new RehostError("Requires HTTPS on an allowed host, without credentials or a custom port.");
    }
    const response = await fetchImage(url, { redirect: "manual", signal });
    if (signal.aborted) {
      cancelBody(response.body);
      signal.throwIfAborted();
    }
    if (redirects.has(response.status)) {
      cancelBody(response.body);
      const location = response.headers.get("location");
      if (!location || hop >= 5) throw new RehostError("Missing redirect location or too many redirects.");
      try { url = new URL(location, url); } catch { throw new RehostError("Invalid redirect location."); }
      continue;
    }
    if (!response.ok || response.status === 206 || !response.body) {
      cancelBody(response.body);
      throw new RehostError(`Unexpected HTTP status ${response.status} or empty response.`);
    }
    if (Number(response.headers.get("content-length")) > OUTREACH_IMAGE_MAX_BYTES) {
      cancelBody(response.body);
      throw new RehostError("Image exceeds the 5 MiB limit.");
    }

    const bytes = new Uint8Array(OUTREACH_IMAGE_MAX_BYTES);
    let length = 0;
    const reader = response.body.getReader();
    const cancel = () => { void reader.cancel().catch(() => {}); };
    signal.addEventListener("abort", cancel, { once: true });
    try {
      while (true) {
        const { done, value } = await reader.read();
        signal.throwIfAborted();
        if (done) break;
        if (value.byteLength > bytes.length - length) {
          cancel();
          throw new RehostError("Image exceeds the 5 MiB limit.");
        }
        bytes.set(value, length);
        length += value.byteLength;
      }
      return { bytes: bytes.subarray(0, length), url };
    } finally {
      signal.removeEventListener("abort", cancel);
      reader.releaseLock();
    }
  }
}

async function download(source: string, hosts: Set<string>, fetchImage: FetchImage) {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new RehostError("Download timed out after 15 seconds."));
      controller.abort();
    }, 15_000);
  });
  try {
    const { bytes, url } = await Promise.race([deadline, fetchBytes(new URL(source), hosts, fetchImage, controller.signal)]);
    let name = url.pathname.split("/").pop() ?? "";
    try { name = decodeURIComponent(name); } catch { /* Keep the literal path segment. */ }
    return prepareImage(bytes, name);
  } finally {
    clearTimeout(timer);
  }
}

function updateDocuments(db: Database, accountId: string, edits: Array<{ document: Document; html: string }>) {
  return db.transaction(() => {
    const now = Date.now();
    const sequences = new Set<string>();
    const conflicts: DocumentRef[] = [];
    for (const { document: { kind, id, sequenceId, html: original, updatedAt }, html } of edits) {
      let changes: number;
      if (kind === "sequence step") {
        changes = db.query(`UPDATE sequence_steps SET html = ? WHERE accountId = ? AND id = ? AND sequenceId = ? AND html = ?
          AND EXISTS (SELECT 1 FROM sequences WHERE accountId = ? AND id = ? AND updatedAt = ?)`
        ).run(html, accountId, id, sequenceId, original, accountId, sequenceId, updatedAt).changes;
        if (changes && sequenceId) sequences.add(sequenceId);
      } else {
        const table = kind === "template" ? "templates" : "campaigns";
        const status = kind === "campaign" ? " AND status = 'draft'" : "";
        changes = db.query(`UPDATE ${table} SET html = ?, updatedAt = max(?, updatedAt + 1)
          WHERE accountId = ? AND id = ? AND html = ? AND updatedAt = ?${status}`
        ).run(html, now, accountId, id, original, updatedAt).changes;
      }
      if (!changes) conflicts.push({ kind, id });
    }
    for (const id of sequences) {
      db.query("UPDATE sequences SET updatedAt = max(?, updatedAt + 1) WHERE accountId = ? AND id = ?").run(now, accountId, id);
    }
    return conflicts;
  }).immediate();
}

export async function rehostImages(db: Database, options: Options) {
  const { accountId, fetchImage, directory, write } = options;
  const hosts = allowedHosts(options.hosts);
  if (!accountId || !hosts.size) throw new RehostError("Specify --account and at least one --host.");
  const dropHosts = allowedHosts(options.dropLinksTo ?? []);
  const documents = db.query(`
    SELECT 'template' AS kind, id, name, html, NULL AS sequenceId, updatedAt FROM templates WHERE accountId = ?
    UNION ALL
    SELECT 'campaign', id, name, html, NULL, updatedAt FROM campaigns WHERE accountId = ? AND status = 'draft'
    UNION ALL
    SELECT 'sequence step', step.id, step.name, step.html, step.sequenceId, sequence.updatedAt
    FROM sequence_steps step JOIN sequences sequence ON sequence.accountId = step.accountId AND sequence.id = step.sequenceId
    WHERE step.accountId = ?
    ORDER BY kind, name, id
  `).all(accountId, accountId, accountId) as Document[];

  const urls = new Map<string, string | null>();
  const failures: Array<{ url: string; reason: string }> = [];
  const edits: Array<{ document: Document; html: string }> = [];
  const summary = [];
  for (const document of documents) {
    const { images, links } = findChanges(document.html, hosts, dropHosts);
    const distinct = new Set<string>();
    const patches = links.map(link => ({ ...link, value: "" }));
    let references = 0;
    for (const ref of images) {
      const { url } = ref;
      if (!urls.has(url)) {
        let image: Awaited<ReturnType<typeof download>> | undefined;
        try {
          image = await download(url, hosts, fetchImage);
        } catch (error) {
          urls.set(url, null);
          failures.push({ url, reason: error instanceof RehostError || error instanceof OutreachImageError ? error.message : "Network or body read failed." });
        }
        if (image) {
          const hosted = write
            ? (await saveOutreachImage(db, accountId, image, null, directory)).image.url
            : imageUrl(image.hash, image.contentType);
          urls.set(url, hosted);
        }
      }
      const hosted = urls.get(url);
      if (!hosted) continue;
      references++;
      distinct.add(hosted);
      patches.push({ ...ref, value: `src="${hosted}"` });
    }
    summary.push({ kind: document.kind, id: document.id, name: document.name, references, images: distinct.size, links: links.length });
    if (write && patches.length) {
      let offset = 0;
      const parts: string[] = [];
      for (const patch of patches.sort((a, b) => a.start - b.start)) {
        parts.push(document.html.slice(offset, patch.start), patch.value);
        offset = patch.end;
      }
      parts.push(document.html.slice(offset));
      edits.push({ document, html: parts.join("") });
    }
  }
  const conflicts = write && edits.length ? updateDocuments(db, accountId, edits) : [];
  return { summary, failures, conflicts };
}

async function main() {
  const { values } = parseArgs({ options: {
    account: { type: "string" }, host: { type: "string", multiple: true },
    "drop-links-to": { type: "string", multiple: true }, write: { type: "boolean" }
  } });
  const accountId = values.account?.trim();
  if (!accountId || !values.host?.length) throw new RehostError("Specify --account and at least one --host.");
  if (!outreachDbExists()) throw new RehostError("Outreach database does not exist.");
  const db = values.write ? await getOutreachDb() : new Database(getOutreachDbPath(), { readonly: true });
  try {
    const result = await rehostImages(db, {
      accountId, hosts: values.host, dropLinksTo: values["drop-links-to"], write: values.write, fetchImage: fetch
    });
    console.info(values.write ? "Write run" : "Dry run");
    for (const row of result.summary) {
      console.info(`${row.kind} ${JSON.stringify(row.name)} (${row.id}): ${row.references} references, ${row.images} distinct images, ${row.links} links to drop.`);
    }
    for (const { url, reason } of result.failures) {
      const printable = new URL(url);
      printable.username = "";
      printable.password = "";
      if (printable.search) printable.search = "?[redacted]";
      console.error(`${printable.href}: ${reason}`);
    }
    for (const { kind, id } of result.conflicts) console.error(`${kind} ${id} changed while downloading; skipped.`);
    if (result.failures.length || result.conflicts.length) process.exitCode = 1;
  } finally {
    if (values.write) closeOutreachDb();
    else db.close();
  }
}

if (import.meta.main) {
  try { await main(); }
  catch (error) {
    console.error(error instanceof RehostError ? error.message : "Could not re-host outreach images.");
    process.exitCode = 1;
  }
}
