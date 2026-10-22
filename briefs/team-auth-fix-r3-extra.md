# Extra item for team-auth fix round 3 (found 2026-10-22 15:35 UTC while merging team-inbox 0beb9a6 into feat/thread-collaboration)

**forwardAuthHeaders overrides route caching.** `lib/auth.ts` `forwardAuthHeaders` copies every header of Better Auth's `getSession` response onto the route response, including `Cache-Control: no-store`. That silently neutralises the attachment byte cache from team-inbox 0beb9a6 (`app/api/accounts/[accountId]/messages/[messageId]/attachments/[attachmentId]/route.ts`: `private, max-age=86400` + ETag + 304) on every `withAuthResponse` route, and the merged test `route.test.ts` fails with `Received: "no-store"`.

Fix applied on feat/thread-collaboration (apply the IDENTICAL hunk on feat/team-auth so the later merge is conflict-free):

```ts
export function forwardAuthHeaders<T extends Response>(response: T, headers: Headers): T {
  headers.forEach((value, key) => {
    const name = key.toLowerCase();
    // Entity headers describe the library JSON, not this route's attachment/stream.
    if (["set-cookie", "content-type", "content-length"].includes(name)) return;
    // A route that set its own caching policy (private attachment cache, 304 revalidation) keeps it;
    // the library's no-store only applies where the route stayed silent.
    if (name === "cache-control" && response.headers.has("cache-control")) return;
    response.headers.set(key, value);
  });
  const existing = new Set(response.headers.getSetCookie());
  for (const cookie of headers.getSetCookie()) if (!existing.has(cookie)) response.headers.append("set-cookie", cookie);
  return response;
}
```

Also port any team-inbox tests that still use `sealSession`/`SessionData` to `authenticatedTestCookie` from `lib/testAuthHarness.ts` (done on thread-collab for the attachments and threads route tests).
