let startupInitialized = false;

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (startupInitialized) return;
  startupInitialized = true;
  const { installBackendConsoleTimestamps } = await import("@/lib/logging/backendConsole");
  installBackendConsoleTimestamps();
  const { assertImapSecretKeyConfigured } = await import("@/lib/secret");
  assertImapSecretKeyConfigured();
  const { initializeMasterDb } = await import("@/lib/db");
  await initializeMasterDb();
  if (process.env.NOCTUA_MAILBOX_WATCHER === "1") (await import("@/lib/mailboxWatcher")).startMailboxWatcher(); // mailbox-watcher hook (DB-storage gate inside)
}
