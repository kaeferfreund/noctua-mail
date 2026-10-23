import { expect, test } from "bun:test";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
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
