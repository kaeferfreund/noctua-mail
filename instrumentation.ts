let startupInitialized = false;

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (startupInitialized) return;
  (await import("@/lib/server/privateFileModes")).restrictNewFileModes();
  const { installShutdownCoordinator } = await import("@/lib/server/shutdown");
  // Without HTTP lifecycle hooks this participates in Next-owned cleanup only.
  installShutdownCoordinator();
  const { installBackendConsoleTimestamps } = await import("@/lib/logging/backendConsole");
  installBackendConsoleTimestamps();
  const { assertImapSecretKeyConfigured } = await import("@/lib/secret");
  assertImapSecretKeyConfigured();
  const { getAuth } = await import("@/lib/betterAuth");
  // getAuth locks the datastore before initializing the master DB and auth.
  await getAuth();
  (await import("@/lib/threadRecomputeJobs")).resumeIdentityRecomputeJobs();
  // Resumes planned sends from scheduled_sends; overdue rows go out on the first pass.
  (await import("@/lib/scheduledSendJob")).startScheduledSendScheduler();
  // Addon: campaigns, sequences and tracking retention. Nothing of it loads while the flag is off.
  if ((await import("@/lib/addons/outreach/config")).outreachAddonEnabled()) (await import("@/lib/addons/outreach/sending")).startOutreachScheduler();
  if (process.env.NOCTUA_MAILBOX_WATCHER === "1") (await import("@/lib/mailboxWatcher")).startMailboxWatcher();
  startupInitialized = true;
}
