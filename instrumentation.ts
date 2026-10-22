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
  // SPIKE: Better Auth's additive migrations run against the master DB right
  // after Noctua's schema, so a missing BETTER_AUTH_SECRET or a schema
  // problem fails the start instead of the first login. The route bundle
  // has its own module instances and builds its own auth instance on the
  // first request (doc/SPIKE-BETTER-AUTH.md §8).
  const { getAuth } = await import("@/lib/betterAuth");
  await getAuth();
}
