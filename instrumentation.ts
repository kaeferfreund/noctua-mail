let startupInitialized = false;

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (startupInitialized) return;
  const { installBackendConsoleTimestamps } = await import("@/lib/logging/backendConsole");
  installBackendConsoleTimestamps();
  const { assertImapSecretKeyConfigured } = await import("@/lib/secret");
  assertImapSecretKeyConfigured();
  const { initializeMasterDb } = await import("@/lib/db");
  await initializeMasterDb();
  // feat/team-auth hook point: const { getAuth } = await import("@/lib/betterAuth");
  // await getAuth(); Keep this after master DB initialization and before the watcher.
  if (process.env.NOCTUA_MAILBOX_WATCHER === "1") (await import("@/lib/mailboxWatcher")).startMailboxWatcher(); // supported-runtime gate inside
  startupInitialized = true;
}
