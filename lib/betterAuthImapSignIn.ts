import { BASE_ERROR_CODES, type BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  formCsrfMiddleware
} from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { parseUserOutput } from "better-auth/db";
import * as z from "zod";

/**
 * Checks an e-mail/password pair against the user's own IMAP mailbox.
 * Production must enforce the login-mailbox eligibility rule (including
 * owner, personal address, TLS and host allowlist); the spike injects a stub.
 */
export type VerifyImapCredentials = (email: string, password: string) => Promise<boolean>;

/** The shape of one entry in a Better Auth plugin's `hooks.after`. */
type AfterHook = NonNullable<NonNullable<BetterAuthPlugin["hooks"]>["after"]>[number];

export const IMAP_SIGN_IN_PATH = "/sign-in/imap";

/**
 * First factor "IMAP password" as a Better Auth plugin.
 *
 * The endpoint mirrors `signInEmail` (same CSRF middleware, same error for
 * unknown user and wrong password, same session creation through the
 * internal adapter so the admin plugin's ban check and every
 * `databaseHooks.session.create` hook run). Second factors are not applied
 * automatically: the two-factor plugin's after-hook only matches
 * `/sign-in/email`, `/sign-in/username` and `/sign-in/phone-number`.
 * Pass that hook in `secondFactorHooks` to re-use it for this path.
 *
 * Noctua's policy plugin guards factor operations separately. This port intentionally
 * keeps only the custom first-factor endpoint and the version-coupled MFA bridge.
 */
export function imapSignIn(options: {
  verifyImap: VerifyImapCredentials;
  secondFactorHooks?: ReadonlyArray<AfterHook>;
}) {
  const matchesImapSignIn = (context: { path?: string }) => context.path === IMAP_SIGN_IN_PATH;
  return {
    id: "noctua-imap-sign-in",
    endpoints: {
      signInImap: createAuthEndpoint(
        IMAP_SIGN_IN_PATH,
        {
          method: "POST",
          use: [formCsrfMiddleware],
          body: z.object({
            email: z.string().max(320),
            password: z.string().min(1).max(256),
            rememberMe: z.boolean().optional()
          })
        },
        async (ctx) => {
          const email = ctx.body.email.trim().toLowerCase();
          const { password } = ctx.body;
          const found = await ctx.context.internalAdapter.findUserByEmail(email);
          // One response for "unknown user" and "wrong password" (no user enumeration).
          if (!found?.user || !password) {
            await ctx.context.password.hash(password || "synthetic-unknown-password");
            throw APIError.from("UNAUTHORIZED", BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD);
          }
          if (!(await options.verifyImap(email, password))) {
            throw APIError.from("UNAUTHORIZED", BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD);
          }
          const dontRememberMe = ctx.body.rememberMe === false;
          const session = await ctx.context.internalAdapter.createSession(found.user.id, dontRememberMe);
          if (!session) {
            throw APIError.from("UNAUTHORIZED", BASE_ERROR_CODES.FAILED_TO_CREATE_SESSION);
          }
          await setSessionCookie(ctx, { session, user: found.user }, dontRememberMe);
          return ctx.json({
            redirect: false,
            token: session.token,
            user: parseUserOutput(ctx.context.options, found.user)
          });
        }
      )
    },
    hooks: {
      after: (options.secondFactorHooks ?? []).map((hook) => ({
        matcher: matchesImapSignIn,
        handler: hook.handler
      }))
    }
  } satisfies BetterAuthPlugin;
}
