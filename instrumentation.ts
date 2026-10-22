let startupInitialized = false;

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (startupInitialized) return;
  const { installBackendConsoleTimestamps } = await import("@/lib/logging/backendConsole");
  installBackendConsoleTimestamps();
  const { assertImapSecretKeyConfigured } = await import("@/lib/secret");
  assertImapSecretKeyConfigured();
  const { getAuth } = await import("@/lib/betterAuth");
  // getAuth locks the datastore before initializing the master DB and auth.
  await getAuth();
  if (process.env.NOCTUA_MAILBOX_WATCHER === "1") (await import("@/lib/mailboxWatcher")).startMailboxWatcher();
  startupInitialized = true;
}
