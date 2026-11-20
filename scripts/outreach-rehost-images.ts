import { Database } from "bun:sqlite";
import { isIP } from "node:net";
import { isDeepStrictEqual, parseArgs } from "node:util";
import { parse, parseFragment, type DefaultTreeAdapterTypes as Tree } from "parse5";
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
type ImageRef = Range & { url: string; src: Tree.Element["attrs"][number] };
type Patch = Range & { value: string };
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

function* walkTree(root: Tree.Node, removed?: ReadonlySet<Tree.Node>) {
  const pending: Array<{ node: Tree.Node; parent?: Tree.Node; depth: number }> = [{ node: root, depth: 0 }];
  while (pending.length) {
    const entry = pending.pop()!;
    const { node, depth } = entry;
    if (removed?.has(node)) continue;
    yield entry;
    if ("content" in node) pending.push({ node: (node as Tree.Template).content, parent: node, depth: depth + 1 });
    if ("childNodes" in node) {
      for (let i = node.childNodes.length - 1; i >= 0; i--) {
        pending.push({ node: node.childNodes[i], parent: node, depth: depth + 1 });
      }
    }
  }
}

function treeShape(root: Tree.Node, removed?: ReadonlySet<Tree.Node>) {
  return Array.from(walkTree(root, removed), ({ node, depth }) => {
    const base = [depth, node.nodeName];
    if ("tagName" in node) return [...base, node.tagName, node.namespaceURI, node.attrs];
    if ("value" in node) return [...base, node.value];
    if ("data" in node) return [...base, node.data];
    if ("name" in node) return [...base, node.name, node.publicId, node.systemId];
    if ("mode" in node) return [...base, node.mode];
    return base;
  });
}

function overlaps(a: Range, b: Range) {
  return a.start < b.end && b.start < a.end;
}

type Location = NonNullable<Tree.Node["sourceCodeLocation"]>;
function sourceRange(location: Location): Range {
  return { start: location.startOffset, end: location.endOffset };
}

function unambiguousLink(node: Tree.Element, range: Range, nodes: Tree.Node[], ancestors: Set<Tree.Node>) {
  const descendants = new Set(Array.from(walkTree(node), entry => entry.node));
  return nodes.every(other => {
    const location = other.sourceCodeLocation;
    if (!location || descendants.has(other) || !overlaps(range, sourceRange(location))) return true;
    if (!ancestors.has(other)) return false;
    // A containing ancestor may span the link, but its own tags must be outside the cut.
    if (location.startOffset >= range.start || location.endOffset < range.end) return false;
    return !("startTag" in location && location.startTag && overlaps(range, sourceRange(location.startTag))) &&
      !("endTag" in location && location.endTag && overlaps(range, sourceRange(location.endTag)));
  });
}

function parseHtml(html: string, sourceCodeLocationInfo = false) {
  // Match the preview/send renderer's choice of document versus fragment.
  const fullDocument = /^(?:\s|<!--(?:(?!-->)[\s\S])*-->)*(?:<!doctype\b|<html\b|<head\b|<body\b)/i.test(html);
  return fullDocument ? parse(html, { sourceCodeLocationInfo }) : parseFragment(html, { sourceCodeLocationInfo });
}

function findChanges(original: string, hosts: Set<string>, dropHosts: Set<string>) {
  const tree = parseHtml(original, true);
  const entries = Array.from(walkTree(tree));
  const nodes = entries.map(entry => entry.node);
  const parents = new Map(entries.map(({ node, parent }) => [node, parent]));
  const removed = new Set<Tree.Node>();
  const patches: Patch[] = [];
  let html = original;

  function acceptPatch(patch: Patch) {
    if (patches.some(other => overlaps(patch, other))) return false;
    const nextPatches = [...patches, patch].sort((a, b) => a.start - b.start);
    // Source offsets preserve untouched bytes, including mail-specific syntax and comments.
    let offset = 0;
    const parts: string[] = [];
    for (const { start, end, value } of nextPatches) {
      parts.push(original.slice(offset, start), value);
      offset = end;
    }
    parts.push(original.slice(offset));
    const next = parts.join("");
    if (!isDeepStrictEqual(treeShape(parseHtml(next)), treeShape(tree, removed))) return false;
    patches.push(patch);
    html = next;
    return true;
  }

  const skippedLinks = new Set<number | Tree.Node>();
  let links = 0;
  if (dropHosts.size) {
    for (const node of nodes) {
      if (!("tagName" in node) || node.namespaceURI !== "http://www.w3.org/1999/xhtml" || node.tagName !== "a") continue;
      const href = httpUrl(node.attrs.find(attr => attr.name === "href")?.value ?? "");
      if (!href || !dropHosts.has(href.hostname)) continue;

      const ancestors = new Set<Tree.Node>();
      for (let parent = parents.get(node); parent; parent = parents.get(parent)) ancestors.add(parent);
      if (Array.from(ancestors).some(ancestor => removed.has(ancestor))) continue;

      const location = node.sourceCodeLocation;
      const key = location?.startOffset ?? node;
      if (skippedLinks.has(key)) continue;
      if (location?.startTag && location.endTag) {
        const range = { start: location.startTag.startOffset, end: location.endTag.endOffset };
        if (unambiguousLink(node, range, nodes, ancestors)) {
          removed.add(node);
          if (acceptPatch({ ...range, value: "" })) {
            links++;
            continue;
          }
          removed.delete(node);
        }
      }
      // The parser can split one source anchor into several elements. Count that source anchor once.
      skippedLinks.add(key);
    }
  }

  const images: ImageRef[] = [];
  for (const { node } of walkTree(tree, removed)) {
    if (!("tagName" in node) || node.namespaceURI !== "http://www.w3.org/1999/xhtml" || node.tagName !== "img") continue;
    const location = node.sourceCodeLocation?.attrs?.src;
    const src = node.attrs.find(attr => attr.name === "src");
    const url = src && httpUrl(src.value);
    if (location && src && url && hosts.has(url.hostname)) {
      url.hash = "";
      images.push({ ...sourceRange(location), url: url.href, src });
    }
  }
  images.sort((a, b) => a.start - b.start);
  return {
    images, links, skippedLinks: skippedLinks.size,
    get html() { return html; },
    replaceImage(ref: ImageRef, hosted: string) {
      const previous = ref.src.value;
      ref.src.value = hosted;
      if (acceptPatch({ start: ref.start, end: ref.end, value: `src="${hosted}"` })) return true;
      ref.src.value = previous;
      return false;
    }
  };
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
    return prepareImage(bytes, name, { canonicalExtension: true });
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
    const changes = findChanges(document.html, hosts, dropHosts);
    const distinct = new Set<string>();
    let skippedAmbiguous = changes.skippedLinks;
    let references = 0;
    for (const ref of changes.images) {
      const { url } = ref;
      let hosted = urls.get(url);
      let image: Awaited<ReturnType<typeof download>> | undefined;
      if (hosted === undefined) {
        try {
          image = await download(url, hosts, fetchImage);
          hosted = imageUrl(image.hash, image.contentType);
        } catch (error) {
          urls.set(url, null);
          failures.push({ url, reason: error instanceof RehostError || error instanceof OutreachImageError ? error.message : "Network or body read failed." });
          continue;
        }
      }
      if (!hosted) continue;
      if (!changes.replaceImage(ref, hosted)) {
        skippedAmbiguous++;
        continue;
      }
      if (image) {
        // An operator migration of existing references is not an editor upload: no mailbox quota.
        if (write) await saveOutreachImage(db, accountId, image, null, directory, Number.POSITIVE_INFINITY);
        urls.set(url, hosted);
      }
      references++;
      distinct.add(hosted);
    }
    summary.push({
      kind: document.kind, id: document.id, name: document.name,
      references, images: distinct.size, links: changes.links, skippedAmbiguous
    });
    if (write && changes.html !== document.html) edits.push({ document, html: changes.html });
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
      console.info(`${row.kind} ${JSON.stringify(row.name)} (${row.id}): ${row.references} references, ${row.images} distinct images, ${row.links} links to drop, ${row.skippedAmbiguous} skipped (ambiguous markup).`);
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
