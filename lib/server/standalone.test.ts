import { expect, test } from "bun:test";
import { createServer } from "node:http";
import { connect, type AddressInfo } from "node:net";
import { listenerOrigin } from "./standalone";

for (const hostname of ["::", "0.0.0.0", "::1", "127.0.0.1"]) {
  test(`listener origin uses actual port and formats HOSTNAME=${hostname}`, async () => {
    const server = createServer();
    try {
      await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(0, hostname, resolve); });
      const address = server.address() as AddressInfo;
      const listener = listenerOrigin(address);
      const url = new URL(listener.origin);
      expect(listener.port).toBe(address.port);
      expect(Number(url.port)).toBe(address.port);
      expect(url.hostname).toBe(hostname === "::" || hostname === "0.0.0.0" ? "localhost" : hostname === "::1" ? "[::1]" : hostname);
    } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
  });
}

test("launcher request and upgrade error logs redact reset capabilities", async () => {
  // A separate process keeps Next's sole mocked seam and the real launcher's
  // process-global signal coordinator out of the rest of the test suite.
  const child = Bun.spawn([process.execPath, "--eval", `
    import { mock } from "bun:test";
    mock.module("next/dist/server/lib/start-server", () => ({
      getRequestHandlers: async () => ({
        requestHandler: async () => { throw new Error("synthetic request failure"); },
        upgradeHandler: async () => { throw new Error("synthetic upgrade failure"); },
        closeUpgraded() {},
        server: { async close() {} }
      })
    }));
    const { startServer } = await import(${JSON.stringify(new URL("./standalone.ts", import.meta.url).pathname)});
    await startServer({ dir: process.cwd(), hostname: "127.0.0.1", port: 0 });
  `], { stdout: "pipe", stderr: "pipe" });
  let output = "";
  const stdout = (async () => { for await (const chunk of child.stdout) output += Buffer.from(chunk).toString(); })();
  const stderr = new Response(child.stderr).text();
  try {
    const deadline = Date.now() + 5000;
    while (!output.includes("Ready on ") && Date.now() < deadline && child.exitCode === null) await Bun.sleep(10);
    const origin = output.match(/Ready on (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
    expect(origin).toBeDefined();
    const target = "/reset-password?token=synthetic-reset-capability";
    const response = await fetch(`${origin}${target}`, { signal: AbortSignal.timeout(2000) });
    expect(response.status).toBe(500);
    expect(await response.text()).toBe("Internal Server Error");
    const url = new URL(origin!);
    await new Promise<void>((resolve, reject) => {
      const socket = connect(Number(url.port), url.hostname);
      let received = "";
      socket.setTimeout(2000, () => { socket.destroy(); reject(new Error("Failed upgrade socket did not close")); });
      socket.once("connect", () => socket.write(`GET ${target} HTTP/1.1\r\nHost: localhost\r\nConnection: Upgrade\r\nUpgrade: websocket\r\n\r\n`));
      socket.on("data", chunk => { received += chunk.toString(); });
      socket.once("error", reject);
      socket.once("close", () => {
        try { expect(received).toBe(""); resolve(); } catch (error) { reject(error); }
      });
    });
    child.kill("SIGTERM");
    expect(await child.exited).toBe(0);
    await stdout;
    const errors = await stderr;
    expect(errors).not.toContain("synthetic-reset-capability");
    expect(errors.match(/Failed to handle request for http:\/\/localhost\/reset-password/g)).toHaveLength(2);
    expect(errors).toContain("synthetic request failure");
    expect(errors).toContain("synthetic upgrade failure");
    expect(output).toContain("[shutdown] complete");
  } finally {
    if (child.exitCode === null) { child.kill("SIGKILL"); await child.exited; }
    await stdout;
    await stderr;
  }
}, 10000);
