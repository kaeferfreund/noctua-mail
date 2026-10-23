import { createServer } from "node:http";
import { createRequire } from "node:module";
import { assertServerRunning, installShutdownCoordinator, isShuttingDown, onShutdown } from "./shutdown";

/** Same Next request/router initialization as its generated launcher; we own HTTP drain. */
export async function startServer(options: { dir: string; hostname: string; port: number; keepAliveTimeout?: number }) {
  process.env.NEXT_MANUAL_SIG_HANDLE = "1";
  installShutdownCoordinator();
  const require = createRequire(import.meta.url);
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
    catch (error) { console.error(error); if (!response.headersSent) response.writeHead(500); response.end(); }
  });
  server.on("upgrade", async (request, socket, head) => {
    if (isShuttingDown()) { socket.destroy(); return; }
    await initialized;
    if (isShuttingDown()) { socket.destroy(); return; }
    await handlers.upgradeHandler(request, socket, head);
  });
  if (options.keepAliveTimeout !== undefined) server.keepAliveTimeout = options.keepAliveTimeout;
  let closed: Promise<void> | undefined;
  onShutdown("http:stop", "stop", () => {
    console.info("[shutdown] HTTP requests", { active });
    handlers?.closeUpgraded?.();
    closed = new Promise<void>(resolve => server.close(() => resolve()));
    server.closeIdleConnections();
  });
  onShutdown("http:drain", "drain", async () => { await closed; });
  onShutdown("next:drain", "drain", async () => { await closed; await handlers?.server?.close(); });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject); server.listen(options.port, options.hostname, resolve);
  });
  process.env.__NEXT_PRIVATE_ORIGIN = `http://${options.hostname}:${options.port}`;
  handlers = await getRequestHandlers({ ...options, isDev: false, server, minimalMode: false });
  ready();
  assertServerRunning();
  console.info(`Ready on http://${options.hostname}:${options.port}`);
}
