import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, rename, rm, writeFile } from "fs/promises";
import path from "path";
import { domainToASCII } from "url";
import { deleteDomainIconRow, getDomainIconRow, listDomainIconRows, saveDomainIconRow } from "./db";
import { getDomainIconsDir } from "./runtimePaths";
import { listAccessibleAccountEmails } from "./accountAccess";
import { isFreeMailDomain, mailboxGroupDomain } from "./senderIdentity";

/**
 * Admin-uploaded sidebar icons per mail domain. One master-DB row per domain
 * (`domain_icons`) and one normalised PNG under
 * `<NOCTUA_DATA_DIR>/domain-icons/<sha256(domain)>.png`. The override takes
 * precedence over the fetched favicon wherever the sender-icon route shows
 * that domain's logo.
 */

const LABEL = "(?!-)[a-z0-9-]{1,63}(?<!-)";
const DOMAIN_PATTERN = new RegExp(`^${LABEL}(\\.${LABEL})+$`);

/** Lower-case ASCII (IDNA) form of a mail domain, or null when it is not a
 * plain host name of at least two labels (no leading dot, no path characters). */
export function normalizeIconDomain(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim().toLowerCase();
  if (!trimmed || trimmed.length > 253) return null;
  const ascii = domainToASCII(trimmed);
  return ascii && ascii.length <= 253 && DOMAIN_PATTERN.test(ascii) ? ascii : null;
}

/** Normalised icon domain of a mailbox address. */
export function mailboxDomain(email: string): string | null {
  return normalizeIconDomain(mailboxGroupDomain(email));
}

function sha256(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex");
}

function domainIconPath(domain: string) {
  return path.join(getDomainIconsDir(), `${sha256(domain)}.png`);
}

/** Short cache key for the client URL (`v=`), from the stored byte hash. */
export function domainIconVersion(hash: string) {
  return hash.slice(0, 16);
}

export type DomainIconOverride = { domain: string; body: Buffer; etag: string };

/** The stored override of one (normalised) domain, or null. */
export async function readDomainIconOverride(domain: string): Promise<DomainIconOverride | null> {
  const row = await getDomainIconRow(domain);
  if (!row) return null;
  try {
    const body = await readFile(domainIconPath(domain));
    // The tag hashes the bytes actually served, so it stays right even when
    // two uploads raced between the file and the row.
    return { domain, body, etag: `"${sha256(body)}"` };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

/** A sender domain and its parents down to the registrable root domain
 * (mail.brand.example.de → brand.example.de → example.de), normalised. */
export function senderIconDomains(domain: string | null, rootDomain: string | null): string[] {
  const exact = normalizeIconDomain(domain);
  if (!exact) return [];
  const root = normalizeIconDomain(rootDomain);
  const domains = [exact];
  if (!root || root === exact || !exact.endsWith(`.${root}`)) return domains;
  const labels = exact.split(".");
  for (let start = 1; labels.slice(start).join(".") !== root; start += 1) domains.push(labels.slice(start).join("."));
  return [...domains, root];
}

/**
 * Override for a sender: its exact domain first, then each parent down to the
 * root domain. Only domains of mailboxes the caller can open are considered,
 * so a member of one mailbox cannot probe another domain's upload through
 * any `fromEmail`. A free-mail domain (gmail.com, ...) applies only to the
 * mailbox's own address, i.e. the sidebar header of that domain, never to
 * every sender there.
 */
export async function findSenderDomainIcon(identity: { email: string | null; domain: string | null; rootDomain: string | null },
  caller: { mailboxEmail: string; userId: string }): Promise<DomainIconOverride | null> {
  const own = identity.email !== null && identity.email === caller.mailboxEmail.trim().toLowerCase();
  let memberDomains: Set<string> | null = null;
  for (const domain of senderIconDomains(identity.domain, identity.rootDomain)) {
    if (isFreeMailDomain(domain) && !own) continue;
    const override = await readDomainIconOverride(domain);
    if (!override) continue;
    memberDomains ??= new Set((await listAccessibleAccountEmails(caller.userId)).map(mailboxDomain).filter((value): value is string => value !== null));
    if (memberDomains.has(domain)) return override;
  }
  return null;
}

/** Overrides by domain → version, for the domains given. */
export async function domainIconVersions(domains: Iterable<string>): Promise<Map<string, string>> {
  const wanted = new Set(domains);
  const versions = new Map<string, string>();
  for (const row of await listDomainIconRows()) {
    if (wanted.has(row.domain)) versions.set(row.domain, domainIconVersion(row.hash));
  }
  return versions;
}

export type DomainIconEntry = { domain: string; mailboxes: number; version: string | null; updatedAt: number | null };

/** Admin list: every domain of the given mailboxes (the admin's own), plus any domain that still
 * has an override after its last mailbox went away (so it can be reset). A domain that only other
 * mailboxes of `allAccounts` use stays out. */
export async function listDomainIconEntries(accounts: ReadonlyArray<{ email: string }>, allAccounts: ReadonlyArray<{ email: string }>): Promise<DomainIconEntry[]> {
  const entries = new Map<string, DomainIconEntry>();
  for (const account of accounts) {
    const domain = mailboxDomain(account.email);
    if (!domain) continue;
    const entry = entries.get(domain) ?? { domain, mailboxes: 0, version: null, updatedAt: null };
    entry.mailboxes += 1;
    entries.set(domain, entry);
  }
  const used = new Set(allAccounts.map(account => mailboxDomain(account.email)));
  for (const row of await listDomainIconRows()) {
    const entry = entries.get(row.domain) ?? (used.has(row.domain) ? null : { domain: row.domain, mailboxes: 0, version: null, updatedAt: null });
    if (entry) entries.set(row.domain, { ...entry, version: domainIconVersion(row.hash), updatedAt: row.updatedAt });
  }
  return [...entries.values()].sort((a, b) => a.domain.localeCompare(b.domain, "en"));
}

// Route bundles share one process-wide queue per domain. Always release it, including on errors.
const mutationsKey = Symbol.for("noctua.domainIconMutations");
const host = globalThis as typeof globalThis & { [mutationsKey]?: Map<string, Promise<unknown>> };
const mutations = host[mutationsKey] ??= new Map<string, Promise<unknown>>();
function mutateDomainIcon<T>(domain: string, work: () => Promise<T>): Promise<T> {
  const previous = mutations.get(domain) ?? Promise.resolve();
  const next = previous.catch(() => {}).then(work);
  mutations.set(domain, next);
  void next.finally(() => { if (mutations.get(domain) === next) mutations.delete(domain); }).catch(() => {});
  return next;
}

/** Stores an already normalised PNG (lib/domainIconImage.ts) and logs it. */
export async function saveDomainIcon(domain: string, png: Buffer, userId: string) {
  return mutateDomainIcon(domain, async () => {
    const file = domainIconPath(domain);
    await mkdir(path.dirname(file), { recursive: true });
    const temp = `${file}.${randomUUID()}.tmp`;
    try {
      await writeFile(temp, png, { mode: 0o600 });
      await rename(temp, file);
    } finally {
      await rm(temp, { force: true });
    }
    const hash = sha256(png);
    await saveDomainIconRow({ domain, hash, size: png.byteLength, userId });
    return { domain, version: domainIconVersion(hash) };
  });
}

/** Drops the override (row, log entry, file); false when there was none. */
export async function resetDomainIcon(domain: string, userId: string) {
  return mutateDomainIcon(domain, async () => {
    const removed = await deleteDomainIconRow(domain, userId);
    await rm(domainIconPath(domain), { force: true });
    return removed;
  });
}
