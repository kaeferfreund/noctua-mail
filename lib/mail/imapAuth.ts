import { ImapFlow } from "imapflow";
import type { Account } from "@/lib/data";
import {
  bindImapClientError,
  buildImapFlowOptions,
  connectImapClientWithRetry,
  safeLogoutImapClient
} from "./imapClientOptions";
import { isImapConnectFailure } from "./imapError";

/**
 * `ok`: the server accepted the login. `invalid`: it was rejected (or could
 * not be attempted, e.g. a required STARTTLS was not offered).
 * `unreachable`: the server could not be asked or could not process the login,
 * so the credentials are unjudged. Callers must accept only `"ok"`; every
 * other value is a string and therefore truthy.
 */
export type ImapCredentialsCheck = "ok" | "invalid" | "unreachable";

export async function verifyImapCredentials(
  account: Account,
  password: string,
  clientId?: string
): Promise<ImapCredentialsCheck> {
  const logContext = { accountId: account.id, clientId };
  try {
    const client = await connectImapClientWithRetry({
      account,
      logContext,
      skipBreaker: true,
      createClient: () => {
        const nextClient = new ImapFlow(
          buildImapFlowOptions(account, {
            auth: {
              user: account.imap.user,
              pass: password
            }
          }, logContext)
        );
        bindImapClientError(nextClient, logContext);
        return nextClient;
      }
    });
    await safeLogoutImapClient(client, { accountId: account.id, clientId });
    return "ok";
  } catch (error) {
    return isImapConnectFailure(error) ? "unreachable" : "invalid";
  }
}
