import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import net from "node:net";
import type { Account, MailServerConfig } from "@/lib/data";
import { verifyImapCredentials } from "./imapAuth";
import { verifySmtpCredentials } from "./smtp";
import { buildImapFlowOptions, buildImapIdentityKey } from "./imapClientOptions";

/**
 * A14, S3: choosing STARTTLS must make the upgrade mandatory. These servers
 * advertise authentication but no STARTTLS (as after a stripping attack);
 * with `requireTls` the clients must fail before sending any credentials.
 */

type Recorder = { server: net.Server; port: number; credentialsSeen: number };

function lineServer(greeting: string, reply: (line: string, socket: net.Socket, recorder: Recorder) => void): Promise<Recorder> {
  const recorder = { credentialsSeen: 0 } as Recorder;
  recorder.server = net.createServer((socket) => {
    socket.write(greeting);
    let buffer = "";
    socket.on("data", (chunk) => {
      buffer += chunk.toString("latin1");
      let index: number;
      while ((index = buffer.indexOf("\r\n")) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        reply(line, socket, recorder);
      }
    });
    socket.on("error", () => {});
  });
  return new Promise((resolve) => recorder.server.listen(0, "127.0.0.1", () => {
    recorder.port = (recorder.server.address() as net.AddressInfo).port;
    resolve(recorder);
  }));
}

let smtp: Recorder;
let imap: Recorder;

beforeAll(async () => {
  smtp = await lineServer("220 smtp.example.test ESMTP\r\n", (line, socket, recorder) => {
    const command = line.split(" ")[0].toUpperCase();
    if (command === "EHLO" || command === "HELO") socket.write("250-smtp.example.test\r\n250 AUTH PLAIN LOGIN\r\n");
    else if (command === "STARTTLS") socket.write("502 5.5.1 Command not implemented\r\n");
    else if (command === "AUTH") { recorder.credentialsSeen++; socket.write("235 2.7.0 Authentication successful\r\n"); }
    else if (command === "QUIT") socket.end("221 bye\r\n");
    else socket.write("250 ok\r\n");
  });
  imap = await lineServer("* OK IMAP4rev1 ready\r\n", (line, socket, recorder) => {
    const [tag, rawCommand = ""] = line.split(" ");
    const command = rawCommand.toUpperCase();
    if (command === "CAPABILITY") socket.write(`* CAPABILITY IMAP4rev1 AUTH=PLAIN\r\n${tag} OK done\r\n`);
    else if (command === "STARTTLS") socket.write(`${tag} BAD STARTTLS not supported\r\n`);
    else if (command === "LOGIN" || command === "AUTHENTICATE") { recorder.credentialsSeen++; socket.write(`${tag} OK logged in\r\n`); }
    else if (command === "LOGOUT") socket.end(`* BYE\r\n${tag} OK bye\r\n`);
    else if (tag) socket.write(`${tag} OK done\r\n`);
  });
});

afterAll(async () => {
  for (const recorder of [smtp, imap]) {
    await new Promise<void>((resolve) => recorder.server.close(() => resolve()));
  }
});

function account(server: Partial<MailServerConfig>): Account {
  const base = { host: "127.0.0.1", secure: false, user: "starttls@example.test", password: "synthetic-password" };
  return {
    id: "starttls-required-test", name: "STARTTLS", email: "starttls@example.test", avatar: "",
    imap: { ...base, port: imap.port, ...server },
    smtp: { ...base, port: smtp.port, ...server }
  };
}

describe("mandatory STARTTLS (A14, S3)", () => {
  test("SMTP refuses to authenticate when the required upgrade is not offered", async () => {
    smtp.credentialsSeen = 0;
    expect(await verifySmtpCredentials(account({ requireTls: true }))).toBe(false);
    expect(smtp.credentialsSeen).toBe(0);
    // Control: without the requirement the same server gets the credentials.
    expect(await verifySmtpCredentials(account({ requireTls: false }))).toBe(true);
    expect(smtp.credentialsSeen).toBe(1);
  });

  test("IMAP refuses to authenticate when the required upgrade is not offered", async () => {
    imap.credentialsSeen = 0;
    expect(await verifyImapCredentials(account({ requireTls: true }), "synthetic-password")).toBe("invalid");
    expect(imap.credentialsSeen).toBe(0);
    expect(await verifyImapCredentials(account({ requireTls: false }), "synthetic-password")).toBe("ok");
    expect(imap.credentialsSeen).toBe(1);
  }, 20000);

  test("every IMAP client built from the account options requires the upgrade (login, sync, idle, send-side append)", () => {
    expect(buildImapFlowOptions(account({ requireTls: true }))).toEqual(expect.objectContaining({ secure: false, doSTARTTLS: true }));
    expect(buildImapFlowOptions(account({ requireTls: false }))).not.toHaveProperty("doSTARTTLS");
    expect(buildImapFlowOptions(account({ secure: true, requireTls: true }))).not.toHaveProperty("doSTARTTLS");
    // Pooled connections opened before the change must not be reused.
    expect(buildImapIdentityKey(account({ requireTls: true }))).not.toBe(buildImapIdentityKey(account({ requireTls: false })));
  });
});
