import { createServer, type Socket } from "node:net";
import { once } from "node:events";
import { createServer as createHttpServer } from "node:http";
import { options } from "./cli";
import { bodyStructure, decodeWords, decodeMailbox, encodeMailbox, envelope, inSet, quote, searchableBody, section, tokens, type CommandPart } from "./parser";
import { makeMessage, demoPass, demoUser } from "./seed";
import { MailStore, type FixtureMessage, type Mailbox } from "./store";

const capabilities = "IMAP4rev1 LITERAL+ UIDPLUS MOVE SPECIAL-USE IDLE NAMESPACE ID ENABLE UNSELECT AUTH=PLAIN SASL-IR";
const standardFlags = "\\Answered \\Flagged \\Deleted \\Seen \\Draft";
const normalizeFlag = (flag: string) => standardFlags.split(" ").find(item => item.toLowerCase() === flag.toLowerCase()) ?? flag;
const hasFlag = (message: FixtureMessage, flag: string) => message.flags.has(normalizeFlag(flag));
const flagsResponse = (message: FixtureMessage) => `UID ${message.uid} FLAGS (${[...message.flags].join(" ")})`;
function imapDate(date: Date) {
  return `${String(date.getUTCDate()).padStart(2, "0")}-${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getUTCMonth()]}-${date.getUTCFullYear()} ${date.toISOString().slice(11, 19)} +0000`;
}
/** Parse search expressions before evaluating, so OR/NOT never short-circuit token consumption. */
function searchPredicate(args: string[], box: Mailbox) {
  let i = 0;
  type Predicate = (message: FixtureMessage, seq: number) => boolean;
  const next = () => args[i++] ?? "";
  function expression(): Predicate {
    const key = next().toUpperCase();
    if (key === "(") {
      const children: Predicate[] = [];
      while (i < args.length && args[i] !== ")") children.push(expression());
      if (next() !== ")") throw new Error("Unclosed search group");
      return (m, seq) => children.every(test => test(m, seq));
    }
    if (key === "OR") { const a = expression(); const b = expression(); return (m, seq) => a(m, seq) || b(m, seq); }
    if (key === "NOT") { const test = expression(); return (m, seq) => !test(m, seq); }
    if (key === "ALL") return () => true;
    if (key === "UID") { const set = next(); return m => inSet(set, m.uid, box.messages.at(-1)?.uid ?? 0); }
    if (/^[\d*,,:]+$/.test(key)) return (_m, seq) => inSet(key, seq, box.messages.length);
    if (["SINCE", "BEFORE", "ON", "SENTSINCE", "SENTBEFORE", "SENTON"].includes(key)) {
      const target = Date.parse(next());
      return m => {
        const date = key.startsWith("SENT") ? new Date(m.mime.headers.get("date") ?? m.date).getTime() : m.date.getTime();
        const day = Math.floor(date / 86400000) * 86400000;
        return key.endsWith("SINCE") ? day >= target : key.endsWith("BEFORE") ? day < target : day === target;
      };
    }
    if (["SEEN", "UNSEEN", "FLAGGED", "UNFLAGGED", "ANSWERED", "UNANSWERED", "DELETED", "UNDELETED", "DRAFT", "UNDRAFT"].includes(key)) {
      const negated = key.startsWith("UN");
      const flag = `\\${negated ? key.slice(2) : key}`;
      return m => hasFlag(m, flag) !== negated;
    }
    if (key === "RECENT") return () => false;
    if (key === "OLD") return () => true;
    if (key === "NEW") return () => false;
    if (key === "KEYWORD" || key === "UNKEYWORD") { const flag = next(); return m => hasFlag(m, flag) !== (key === "UNKEYWORD"); }
    if (["HEADER", "FROM", "TO", "CC", "BCC", "SUBJECT", "TEXT", "BODY"].includes(key)) {
      const field = key === "HEADER" ? next().toLowerCase() : key.toLowerCase();
      const value = next().toUpperCase();
      return m => {
        const haystack = field === "body" ? searchableBody(m.mime) : field === "text"
          ? `${[...m.mime.headers].map(([name, value]) => `${name}: ${decodeWords(value)}`).join("\n")}\n${searchableBody(m.mime)}`
          : decodeWords(m.mime.headers.get(field) ?? "");
        return haystack.toUpperCase().includes(value);
      };
    }
    if (key === "LARGER" || key === "SMALLER") { const size = Number(next()); return m => key === "LARGER" ? m.mime.raw.length > size : m.mime.raw.length < size; }
    throw new Error(`Unsupported SEARCH key ${key}`);
  }
  if (args[0]?.toUpperCase() === "CHARSET") i = 2;
  const predicates: Predicate[] = [];
  while (i < args.length) predicates.push(expression());
  return (m: FixtureMessage, seq: number) => predicates.every(test => test(m, seq));
}
export type ImapOptions = {
  host?: string; port?: number; user?: string; pass?: string; store?: MailStore; controlPort?: number; seed?: string; date?: Date;
  /** Observes every authenticated command (upper-case name and its arguments), for tests. */
  onCommand?: (command: string, args: string[]) => void;
};
export async function startImapServer(config: ImapOptions = {}) {
  const host = config.host ?? "127.0.0.1";
  const user = config.user ?? demoUser;
  const pass = config.pass ?? demoPass;
  const store = config.store ?? new MailStore(config.seed, config.date);
  const sockets = new Set<Socket>();
  const server = createServer(socket => {
    sockets.add(socket);
    let buffer = Buffer.alloc(0);
    let command: CommandPart[] = [];
    let literalSize: number | undefined;
    let authenticated = false;
    let selected: Mailbox | undefined;
    let readOnly = false;
    let idleTag: string | undefined;
    let authTag: string | undefined;
    const send = (line: string) => socket.write(line + "\r\n");
    const exists = (box: Mailbox) => { if (selected === box) send(`* ${box.messages.length} EXISTS`); };
    const expunged = (box: Mailbox, seq: number, silentFor?: object) => { if (selected === box && socket !== silentFor) send(`* ${seq} EXPUNGE`); };
    const flagsChanged = (box: Mailbox, message: FixtureMessage, origin: Socket) => {
      if (selected === box && socket !== origin) send(`* ${box.messages.indexOf(message) + 1} FETCH (${flagsResponse(message)})`);
    };
    const reset = () => { send("* BYE Fixture reset; reconnect to reload UIDVALIDITY"); socket.end(); };
    store.on("exists", exists).on("expunge", expunged).on("flags", flagsChanged).on("reset", reset);
    socket.on("error", () => {});
    socket.on("close", () => {
      sockets.delete(socket);
      store.off("exists", exists).off("expunge", expunged).off("flags", flagsChanged).off("reset", reset);
    });
    const authenticate = (tag: string, username: string, password: string) => {
      authenticated = username === user && password === pass;
      send(authenticated ? `${tag} OK [CAPABILITY ${capabilities}] Authenticated` : `${tag} NO [AUTHENTICATIONFAILED] Invalid fixture credentials`);
    };
    function execute(parts: CommandPart[]) {
      const line = parts.length === 1 && typeof parts[0] === "string" ? parts[0] : "";
      if (idleTag) {
        if (line.toUpperCase() === "DONE") { send(`${idleTag} OK IDLE completed`); idleTag = undefined; }
        else send("* BAD Expected DONE");
        return;
      }
      if (authTag) {
        const tag = authTag;
        authTag = undefined;
        const parts = Buffer.from(line, "base64").toString().split("\0");
        authenticate(tag, parts.at(-2) ?? "", parts.at(-1) ?? "");
        return;
      }
      let parsed: CommandPart[];
      try { parsed = tokens(parts); }
      catch (error) {
        const tag = typeof parts[0] === "string" ? parts[0].match(/^[^\s()"{}]+/)?.[0] ?? "*" : "*";
        send(`${tag} BAD ${String((error as Error).message).replace(/[\r\n]/g, " ")}`);
        return;
      }
      const args = parsed.map(token => typeof token === "string" ? token : token.data.toString());
      const tag = args.shift() ?? "*";
      let cmd = (args.shift() ?? "").toUpperCase();
      const uidMode = cmd === "UID";
      if (uidMode) cmd = (args.shift() ?? "").toUpperCase();
      const ok = (text = `${cmd} completed`) => send(`${tag} OK ${text}`);
      try {
        if (cmd === "CAPABILITY") { send(`* CAPABILITY ${capabilities}`); ok(); return; }
        if (cmd === "LOGOUT") { send("* BYE Fixture logging out"); ok(); socket.end(); return; }
        if (cmd === "NOOP") { ok(); return; }
        if (cmd === "ID") { send('* ID ("name" "MonkeyDent fixture" "version" "1")'); ok(); return; }
        if (cmd === "LOGIN") { authenticate(tag, args[0], args[1]); return; }
        if (cmd === "AUTHENTICATE") {
          if (args[0]?.toUpperCase() !== "PLAIN") throw new Error("Only AUTHENTICATE PLAIN supported");
          if (args[1]) { const data = Buffer.from(args[1], "base64").toString().split("\0"); authenticate(tag, data.at(-2) ?? "", data.at(-1) ?? ""); }
          else { authTag = tag; send("+ "); }
          return;
        }
        if (!authenticated) { send(`${tag} NO Authenticate first`); return; }
        config.onCommand?.(cmd, args);
        if (cmd === "NAMESPACE") { send('* NAMESPACE (("" "/")) NIL NIL'); ok(); return; }
        if (cmd === "ENABLE") { send("* ENABLED"); ok(); return; }
        if (cmd === "LIST" || cmd === "LSUB") {
          const nonGroups = args.filter(value => value !== "(" && value !== ")");
          const offset = nonGroups[0]?.toUpperCase() === "SPECIAL-USE" ? 1 : 0;
          const reference = decodeMailbox(nonGroups[offset] ?? "");
          const pattern = decodeMailbox(nonGroups[offset + 1] ?? "*");
          if (!pattern) { send(`* ${cmd} (\\Noselect) "/" ""`); ok(); return; }
          const regex = new RegExp(`^${(reference + pattern).split("").map(char => char === "*" ? ".*" : char === "%" ? "[^/]*" : char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("")}$`, "i");
          for (const box of store.boxes.values()) {
            if (!regex.test(box.path) || (cmd === "LSUB" && !box.subscribed) || (offset && !box.special)) continue;
            const children = [...store.boxes.keys()].some(path => path.startsWith(box.path + "/"));
            send(`* ${cmd} (${children ? "\\HasChildren" : "\\HasNoChildren"}${box.special ? " " + box.special : ""}) "/" ${quote(encodeMailbox(box.path))}`);
          }
          ok(); return;
        }
        if (cmd === "STATUS") {
          const box = store.get(decodeMailbox(args[0]));
          const values: Record<string, number> = { MESSAGES: box.messages.length, UNSEEN: box.messages.filter(m => !hasFlag(m, "\\Seen")).length, RECENT: 0, UIDNEXT: box.uidNext, UIDVALIDITY: box.uidValidity };
          send(`* STATUS ${quote(encodeMailbox(box.path))} (${args.slice(1).filter(item => item !== "(" && item !== ")").map(item => `${item.toUpperCase()} ${values[item.toUpperCase()] ?? 0}`).join(" ")})`); ok(); return;
        }
        if (cmd === "SELECT" || cmd === "EXAMINE") {
          selected = store.get(decodeMailbox(args[0])); readOnly = cmd === "EXAMINE";
          send(`* FLAGS (${standardFlags})`);
          send(`* ${selected.messages.length} EXISTS`); send("* 0 RECENT");
          send(`* OK [UIDVALIDITY ${selected.uidValidity}] Stable within fixture lifetime`);
          send(`* OK [UIDNEXT ${selected.uidNext}] Next UID`);
          send(`* OK [PERMANENTFLAGS (${standardFlags} \\*)] Flags`);
          const unseen = selected.messages.findIndex(m => !hasFlag(m, "\\Seen"));
          if (unseen >= 0) send(`* OK [UNSEEN ${unseen + 1}] First unseen`);
          ok(`[${readOnly ? "READ-ONLY" : "READ-WRITE"}] ${cmd} completed`); return;
        }
        if (cmd === "CREATE") { store.create(decodeMailbox(args[0])); ok(); return; }
        if (cmd === "DELETE") {
          const box = store.get(decodeMailbox(args[0]));
          if (box.path === "INBOX") throw new Error("Cannot delete INBOX");
          store.boxes.delete(box.path); ok(); return;
        }
        if (cmd === "RENAME") {
          const box = store.get(decodeMailbox(args[0]));
          const destination = decodeMailbox(args[1]);
          if (box.path === "INBOX") throw new Error("Cannot rename mailbox");
          const children = [...store.boxes.values()].filter(item => item === box || item.path.startsWith(box.path + "/"));
          const moves = children.map(child => ({ child, path: destination + child.path.slice(box.path.length) }));
          if (moves.some(move => store.boxes.has(move.path))) throw new Error("Destination mailbox already exists");
          for (const { child } of moves) store.boxes.delete(child.path);
          for (const { child, path } of moves) { child.path = path; store.boxes.set(path, child); }
          ok(); return;
        }
        if (cmd === "SUBSCRIBE" || cmd === "UNSUBSCRIBE") { store.get(decodeMailbox(args[0])).subscribed = cmd === "SUBSCRIBE"; ok(); return; }
        if (cmd === "APPEND") {
          const box = store.get(decodeMailbox(args[0]));
          const literal = parsed.at(-1);
          const raw = typeof literal === "object" && literal.kind === "literal" ? literal.data : undefined;
          if (!raw) throw new Error("APPEND requires literal");
          const endFlags = args.indexOf(")");
          const flags = args[1] === "(" ? args.slice(2, endFlags).map(normalizeFlag) : [];
          const dateArg = args[args[1] === "(" ? endFlags + 1 : 1];
          const parsedDate = new Date(dateArg);
          const message = store.append(box.path, raw, flags, Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate);
          ok(`[APPENDUID ${box.uidValidity} ${message.uid}] APPEND completed`); return;
        }
        if (!selected) { send(`${tag} NO Select a mailbox first`); return; }
        const box = selected;
        if (cmd === "IDLE") { idleTag = tag; send("+ idling"); return; }
        if (cmd === "UNSELECT" || cmd === "CLOSE") {
          if (cmd === "CLOSE" && !readOnly) store.expunge(box, m => hasFlag(m, "\\Deleted"), socket);
          selected = undefined; ok(); return;
        }
        if (cmd === "SEARCH") {
          const test = searchPredicate(args, box);
          const matches = box.messages.flatMap((m, i) => test(m, i + 1) ? [uidMode ? m.uid : i + 1] : []);
          send(`* SEARCH${matches.length ? " " + matches.join(" ") : ""}`); ok(); return;
        }
        const matches = box.messages.filter((message, index) => inSet(args[0] ?? "", uidMode ? message.uid : index + 1, uidMode ? (box.messages.at(-1)?.uid ?? 0) : box.messages.length));
        if (cmd === "FETCH") {
          let items = args.slice(1).filter(item => item !== "(" && item !== ")").map(item => item.toUpperCase());
          if (items.length === 1 && ["ALL", "FAST", "FULL"].includes(items[0])) items = ["FLAGS", "INTERNALDATE", "RFC822.SIZE", ...(items[0] === "FAST" ? [] : ["ENVELOPE"]), ...(items[0] === "FULL" ? ["BODY"] : [])];
          if (uidMode && !items.includes("UID")) items.unshift("UID");
          for (const message of matches) {
            const parts: Buffer[] = [];
            const add = (value: string) => parts.push(Buffer.from(value));
            if (!readOnly && items.some(item => /^(BODY\[|RFC822$|RFC822.TEXT$)/.test(item))) {
              message.flags.add("\\Seen");
              store.emit("flags", box, message, socket);
              if (!items.includes("FLAGS")) items.push("FLAGS");
            }
            for (const item of items) {
              if (parts.length) add(" ");
              if (item === "UID") add(`UID ${message.uid}`);
              else if (item === "FLAGS") add(`FLAGS (${[...message.flags].join(" ")})`);
              else if (item === "RFC822.SIZE") add(`RFC822.SIZE ${message.mime.raw.length}`);
              else if (item === "INTERNALDATE") add(`INTERNALDATE ${quote(imapDate(message.date))}`);
              else if (item === "ENVELOPE") add(`ENVELOPE ${envelope(message.mime)}`);
              else if (item === "BODYSTRUCTURE" || item === "BODY") add(`${item} ${bodyStructure(message.mime)}`);
              else {
                const body = item.match(/^BODY(?:\.PEEK)?\[([^\]]*)\](?:<(\d+)\.(\d+)>)?$/);
                const spec = body?.[1] ?? ({ RFC822: "", "RFC822.HEADER": "HEADER", "RFC822.TEXT": "TEXT" } as Record<string, string>)[item];
                if (spec === undefined) throw new Error(`Unsupported FETCH item ${item}`);
                let data = section(message.mime, spec);
                if (data && body?.[2]) data = data.subarray(Number(body[2]), Number(body[2]) + Number(body[3]));
                const label = body ? `BODY[${spec}]${body[2] ? `<${body[2]}>` : ""}` : item;
                if (data === null) add(`${label} NIL`);
                else { add(`${label} {${data.length}}\r\n`); parts.push(data); }
              }
            }
            socket.write(Buffer.concat([Buffer.from(`* ${box.messages.indexOf(message) + 1} FETCH (`), ...parts, Buffer.from(")\r\n")]));
          }
          ok(); return;
        }
        if (readOnly && ["STORE", "MOVE", "EXPUNGE"].includes(cmd)) throw new Error("Mailbox is read-only");
        if (cmd === "STORE") {
          const operation = args[1].toUpperCase();
          const flags = args.slice(2).filter(item => item !== "(" && item !== ")").map(normalizeFlag);
          for (const message of matches) {
            if (operation.startsWith("+")) flags.forEach(flag => message.flags.add(flag));
            else if (operation.startsWith("-")) flags.forEach(flag => message.flags.delete(flag));
            else { message.flags = new Set(flags); }
            store.emit("flags", box, message, socket);
            if (!operation.endsWith(".SILENT")) send(`* ${box.messages.indexOf(message) + 1} FETCH (${flagsResponse(message)})`);
          }
          ok(); return;
        }
        if (cmd === "COPY" || cmd === "MOVE") {
          const destination = store.get(decodeMailbox(args[1]));
          const copied = matches.map(message => store.append(destination.path, message.mime.raw, [...message.flags], message.date).uid);
          if (cmd === "MOVE") store.expunge(box, m => matches.includes(m));
          ok(matches.length ? `[COPYUID ${destination.uidValidity} ${matches.map(m => m.uid).join(",")} ${copied.join(",")}] ${cmd} completed` : `${cmd} completed`); return;
        }
        if (cmd === "EXPUNGE") { store.expunge(box, m => hasFlag(m, "\\Deleted") && (!uidMode || matches.includes(m))); ok(); return; }
        send(`${tag} BAD Unsupported command ${cmd}`);
      } catch (error) { send(`${tag} NO ${String((error as Error).message).replace(/[\r\n]/g, " ")}`); }
    }
    socket.on("data", chunk => {
      buffer = Buffer.concat([buffer, Buffer.from(chunk)]);
      while (buffer.length) {
        if (literalSize !== undefined) {
          if (buffer.length < literalSize) return;
          command.push({ kind: "literal", data: buffer.subarray(0, literalSize) });
          buffer = buffer.subarray(literalSize);
          literalSize = undefined;
        }
        const end = buffer.indexOf("\r\n");
        if (end < 0) return;
        const line = buffer.subarray(0, end).toString();
        buffer = buffer.subarray(end + 2);
        const literal = line.match(/\{(\d+)(\+)?\}$/);
        if (literal) {
          command.push(line.slice(0, literal.index));
          literalSize = Number(literal[1]);
          if (!Number.isSafeInteger(literalSize)) {
            send("* BAD Invalid literal size");
            command = []; literalSize = undefined;
            continue;
          }
          if (!literal[2]) send("+ Ready for literal");
          continue;
        }
        const parts = [...command, line];
        command = [];
        try { execute(parts); }
        catch { send("* BAD Malformed command"); }
      }
    });
    send(`* OK [CAPABILITY ${capabilities}] MonkeyDent synthetic mailbox`);
  });
  store.setMaxListeners(100);
  server.listen(config.port ?? 3789, host);
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  const control = config.controlPort === undefined ? undefined : createHttpServer(async (request, response) => {
    const respond = (value: unknown, status = 200) => { response.writeHead(status, { "content-type": "application/json" }); response.end(JSON.stringify(value)); };
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    try {
      if (request.method === "POST" && path === "/reset") { store.reset(); respond({ ok: true }); return; }
      if (request.method === "POST" && path === "/inject") {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const input = JSON.parse(Buffer.concat(chunks).toString()) as { source?: string; subject?: string; text?: string; folder?: string; flags?: string[] };
        const id = `injected-${Date.now()}-${store.get("INBOX").uidNext}`;
        const message = store.append(input.folder ?? "INBOX", input.source ? Buffer.from(input.source) : makeMessage({ id, subject: input.subject ?? "Neue synthetische Terminanfrage", text: input.text }), input.flags ?? []);
        respond({ ok: true, uid: message.uid }); return;
      }
      if (request.method === "GET" && path === "/status") { respond([...store.boxes.values()].map(box => ({ path: box.path, messages: box.messages.length, uidNext: box.uidNext }))); return; }
      respond({ error: "Use GET /status, POST /inject or POST /reset" }, 404);
    } catch (error) { respond({ error: (error as Error).message }, 400); }
  });
  if (control) {
    control.listen(config.controlPort, host);
    try { await once(control, "listening"); }
    catch (error) { for (const socket of sockets) socket.destroy(); server.close(); throw error; }
  }
  const controlAddress = control?.address();
  const controlPort = typeof controlAddress === "object" && controlAddress ? controlAddress.port : undefined;
  return { port, store, controlPort, async stop() {
    if (control) { control.closeAllConnections(); await new Promise<void>(resolve => control.close(() => resolve())); }
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  } };

}
if (import.meta.main) {
  const args = options();
  const server = await startImapServer({ host: args.host, port: Number(args.port ?? 3789), user: args.user, pass: args.pass, seed: args.seed, date: args.date ? new Date(args.date) : undefined, controlPort: Number(args["control-port"]) });
  console.log(`IMAP fixture: ${args.host}:${server.port}; control: ${server.controlPort}`);
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, async () => { await server.stop(); process.exit(0); });
}
