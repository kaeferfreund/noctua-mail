import { test, expect } from "bun:test";
import { createServer, type Socket } from "node:net";
import { once } from "node:events";
import { ImapFlow } from "imapflow";
import { runImapIdleLoop } from "./idle";

test("shared watcher/SSE IDLE loop closes and rejects a server's tagged NO without spinning", async () => {
  const sockets = new Set<Socket>();
  let idleCommands = 0;
  const server = createServer(socket => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    socket.write("* OK Synthetic IMAP server\r\n");
    let pending = "";
    socket.on("data", chunk => {
      pending += chunk.toString();
      let end: number;
      while ((end = pending.indexOf("\r\n")) >= 0) {
        const line = pending.slice(0, end); pending = pending.slice(end + 2);
        const [tag, command] = line.split(" ");
        if (command === "CAPABILITY") socket.write("* CAPABILITY IMAP4rev1 IDLE AUTH=PLAIN SASL-IR\r\n");
        if (command === "EXAMINE" || command === "SELECT") {
          socket.write("* 0 EXISTS\r\n* FLAGS (\\Seen)\r\n* OK [UIDVALIDITY 1] valid\r\n* OK [UIDNEXT 1] next\r\n");
        }
        if (command === "IDLE") { idleCommands++; socket.write(`${tag} NO IDLE unavailable\r\n`); }
        else socket.write(`${tag} OK completed\r\n`);
      }
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const client = new ImapFlow({ host: "127.0.0.1", port: (server.address() as { port: number }).port,
    secure: false, auth: { user: "synthetic@example.test", pass: "synthetic" }, logger: false, disableAutoIdle: true });
  client.on("error", () => {});
  try {
    await client.connect();
    await client.mailboxOpen("INBOX", { readOnly: true });
    const listeners = client.listenerCount("close");
    await expect(runImapIdleLoop(client)).rejects.toThrow("rejected IDLE");
    expect(client.usable).toBe(false);
    expect(idleCommands).toBe(1);
    expect(client.listenerCount("close")).toBe(listeners);
  } finally {
    client.close();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
