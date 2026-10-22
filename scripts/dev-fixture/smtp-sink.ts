import { createServer, type Socket } from "node:net";
import { once } from "node:events";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { options } from "./cli";
import { demoPass, demoUser } from "./seed";
export type ReceivedMail = { from: string; to: string[]; source: Buffer; file: string };
export type SmtpOptions = { host?: string; port?: number; user?: string; pass?: string; out?: string; deliver?: (source: Buffer) => void | Promise<void> };
export async function startSmtpSink(config: SmtpOptions = {}) {
  const user = config.user ?? demoUser;
  const pass = config.pass ?? demoPass;
  const out = config.out ?? join(process.env.NOCTUA_DATA_DIR ?? ".data", "fixture-outbox");
  await mkdir(out, { recursive: true });
  const received: ReceivedMail[] = [];
  const sockets = new Set<Socket>();
  const server = createServer(socket => {
    sockets.add(socket);
    let buffer = "";
    let authenticated = false;
    let from: string | undefined;
    let recipients: string[] = [];
    let data: string[] | undefined;
    let auth: "plain" | "user" | "pass" | undefined;
    let username = "";
    let queue = Promise.resolve();
    const send = (line: string) => socket.write(line + "\r\n");
    const reset = () => { from = undefined; recipients = []; data = undefined; };
    const authenticate = (login: string, password: string) => {
      authenticated = login === user && password === pass;
      auth = undefined;
      send(authenticated ? "235 2.7.0 Authentication successful" : "535 5.7.8 Invalid fixture credentials");
    };
    async function lineReceived(line: string) {
      if (data) {
        if (line !== ".") { data.push(line.startsWith("..") ? line.slice(1) : line); return; }
        const source = Buffer.from(data.join("\r\n") + "\r\n", "latin1");
        const file = join(out, `${Date.now()}-${randomUUID()}.eml`);
        await writeFile(file, source);
        received.push({ from: from ?? "", to: [...recipients], source, file });
        if (recipients.some(to => to.toLowerCase() === user.toLowerCase())) await config.deliver?.(source);
        reset(); send("250 2.0.0 Stored in synthetic outbox"); return;
      }
      if (auth) {
        const value = Buffer.from(line, "base64").toString();
        if (auth === "plain") { const parts = value.split("\0"); authenticate(parts.at(-2) ?? "", parts.at(-1) ?? ""); }
        else if (auth === "user") { username = value; auth = "pass"; send("334 UGFzc3dvcmQ6"); }
        else authenticate(username, value);
        return;
      }
      const space = line.indexOf(" ");
      const command = (space < 0 ? line : line.slice(0, space)).toUpperCase();
      const arg = space < 0 ? "" : line.slice(space + 1);
      if (command === "EHLO") { send("250-fixture.monkeydent.test\r\n250-AUTH PLAIN LOGIN\r\n250-8BITMIME\r\n250 SIZE 26214400"); return; }
      if (command === "HELO") { send("250 fixture.monkeydent.test"); return; }
      if (command === "QUIT") { send("221 2.0.0 Bye"); socket.end(); return; }
      if (command === "NOOP") { send("250 2.0.0 OK"); return; }
      if (command === "RSET") { reset(); send("250 2.0.0 Reset"); return; }
      if (command === "AUTH") {
        const [method, initial] = arg.split(" ");
        if (method.toUpperCase() === "PLAIN") {
          if (initial) { const parts = Buffer.from(initial, "base64").toString().split("\0"); authenticate(parts.at(-2) ?? "", parts.at(-1) ?? ""); }
          else { auth = "plain"; send("334 "); }
        } else if (method.toUpperCase() === "LOGIN") {
          if (initial) { username = Buffer.from(initial, "base64").toString(); auth = "pass"; send("334 UGFzc3dvcmQ6"); }
          else { auth = "user"; send("334 VXNlcm5hbWU6"); }
        } else send("504 5.5.4 Unsupported AUTH mechanism");
        return;
      }
      if (!authenticated) { send("530 5.7.0 Authenticate first"); return; }
      if (command === "MAIL") {
        const address = arg.match(/^FROM:\s*<([^>]*)>/i);
        if (!address) { send("501 5.5.2 Expected MAIL FROM"); return; }
        reset(); from = address[1]; send("250 2.1.0 Sender accepted"); return;
      }
      if (command === "RCPT") {
        const address = arg.match(/^TO:\s*<([^>]+)>/i);
        if (from === undefined || !address) { send("503 5.5.1 MAIL FROM required"); return; }
        recipients.push(address[1]); send("250 2.1.5 Recipient accepted"); return;
      }
      if (command === "DATA") {
        if (from === undefined || !recipients.length) { send("503 5.5.1 MAIL and RCPT required"); return; }
        data = []; send("354 End with <CRLF>.<CRLF>"); return;
      }
      send("502 5.5.1 Unsupported command");
    }
    socket.on("error", () => {});
    socket.on("close", () => sockets.delete(socket));
    socket.on("data", chunk => {
      buffer += chunk.toString("latin1");
      let end: number;
      while ((end = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        queue = queue.then(() => lineReceived(line)).catch(error => { reset(); send(`451 4.3.0 ${String(error.message).replace(/[\r\n]/g, " ")}`); });
      }
    });
    send("220 fixture.monkeydent.test ESMTP synthetic mail sink");
  });
  server.listen(config.port ?? 3787, config.host ?? "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  return { port, received, async stop() { for (const socket of sockets) socket.destroy(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); } };
}
if (import.meta.main) {
  const args = options();
  const server = await startSmtpSink({ host: args.host, port: Number(args.port ?? 3787), user: args.user, pass: args.pass, out: args.out, deliver: args["imap-control"] ? async source => {
    const response = await fetch(`${args["imap-control"]}/inject`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ source: source.toString() }) });
    if (!response.ok) throw new Error(`IMAP delivery failed: ${response.status}`);
  } : undefined });
  console.log(`SMTP sink: ${args.host}:${server.port}`);
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, async () => { await server.stop(); process.exit(0); });
}
