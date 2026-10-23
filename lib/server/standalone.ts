import { createServer } from "node:http";
import { createRequire } from "node:module";
import type { AddressInfo } from "node:net";
import { redactAuthUrl } from "../authRecoveryContext";
import { assertServerRunning, installShutdownCoordinator, isShuttingDown } from "./shutdown";

function redactedRequestUrl(target: string | undefined) {
  // An origin-form target such as "//reset-password/<token>" is a path, not a scheme-relative authority.
  const value = target?.startsWith("/") ? `http://localhost${target}` : target ?? "";
  return redactAuthUrl(URL.parse(value, "http://localhost")?.href ?? "");
}

/** Use the bound address (including an OS-selected port) for Next's internal URL. */
export function listenerOrigin(address: AddressInfo) {
  const hostname = address.address === "::" || address.address === "0.0.0.0" ? "localhost" : address.address;
  const formatted = hostname.includes(":") ? `[${hostname}]` : hostname;
  return { hostname, port: address.port, origin: `http://${formatted}:${address.port}` };
}

/** Same Next request/router initialization as its generated launcher; we own HTTP drain. */
export async function startServer(options: { dir: string; hostname: string; port: number; keepAliveTimeout?: number }) {
  process.env.NEXT_MANUAL_SIG_HANDLE = "1";
  const require = createRequire(import.meta.url);
  process.title = `next-server (v${require("next/package.json").version})`;
  const { getRequestHandlers } = require("next/dist/server/lib/start-server");
  let handlers: Awaited<ReturnType<typeof getRequestHandlers>>;
  let ready!: () => void;
  const initialized = new Promise<void>(resolve => { ready = resolve; });
  let active = 0;
  const server = createServer(async (request, response) => {
    if (isShuttingDown()) { response.writeHead(503, { Connection: "close" }); response.end(); return; }
    active++;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      active--;
      // Bun can leave a just-finished streaming response on an idle keepalive
      // socket after close() began. Retire it once the response has flushed.
      if (isShuttingDown()) setImmediate(() => server.closeIdleConnections());
    };
    response.once("finish", finish); response.once("close", finish);
    try { await initialized; await handlers.requestHandler(request, response); }
    catch (error) {
      console.error(`Failed to handle request for ${redactedRequestUrl(request.url)}`, error);
      if (!response.headersSent) response.writeHead(500);
      response.end("Internal Server Error");
    }
  });
  server.on("upgrade", async (request, socket, head) => {
    if (isShuttingDown()) { socket.destroy(); return; }
    try {
      await initialized;
      if (isShuttingDown()) { socket.destroy(); return; }
      await handlers.upgradeHandler(request, socket, head);
    } catch (error) {
      socket.destroy();
      console.error(`Failed to handle request for ${redactedRequestUrl(request.url)}`, error);
    }
  });
  if (options.keepAliveTimeout) server.keepAliveTimeout = options.keepAliveTimeout;
  let closed: Promise<void> | undefined;
  installShutdownCoordinator({ stop: () => {
    console.info("[shutdown] HTTP requests", { active });
    handlers?.closeUpgraded?.();
    closed = new Promise<void>(resolve => server.close(() => resolve()));
    server.closeIdleConnections();
  }, drain: async () => { await closed; await handlers?.server?.close(); } });
  await new Promise<void>((resolve, reject) => {
    const startupError = (error: Error) => { reject(error); };
    server.once("error", startupError);
    server.listen(options.port, options.hostname, () => { server.off("error", startupError); resolve(); });
  });
  server.on("error", error => { console.error(error); process.exit(1); });
  const listener = listenerOrigin(server.address() as AddressInfo);
  process.env.PORT = String(listener.port);
  process.env.__NEXT_PRIVATE_ORIGIN = listener.origin;
  handlers = await getRequestHandlers({ ...options, port: listener.port, isDev: false, server, minimalMode: false });
  ready();
  assertServerRunning();
  console.info(`Ready on ${listener.origin}`);
}
