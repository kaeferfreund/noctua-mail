import { AsyncLocalStorage } from "node:async_hooks";
import type { Database } from "bun:sqlite";
import type { SecurityOperation, SessionSecurity } from "./db/authPolicy";
import type { ReauthPurpose } from "./authPolicy";

export type PendingChallenge = {
  identifier: string; userId: string | null; generation: number | null; loginEpoch: number | null;
  authenticatedAt: number; kind: string; sourceSessionId: string | null; expiresAt: number;
};
export type AuthProofContext = {
  db: Database; request?: Request; internal?: boolean; op?: SecurityOperation; source?: SessionSecurity;
  authenticatedAt: number; method: string; loginEpoch?: number; kind?: string;
  challenge?: PendingChallenge; challengeId?: string; grantHash?: string; purpose?: ReauthPurpose;
  verifiedCredentialId?: string; verifiedUV?: boolean; verifiedUserId?: string; newSessionId?: string;
  createdSessionIds: string[]; createdPasskeyId?: string; destructive?: boolean; retainOperation?: boolean;
  totpBefore?: string;
};

// AsyncLocalStorage isolates requests across awaits and module graphs. No client header can create a scope.
const proofContext = new AsyncLocalStorage<AuthProofContext>();
export const currentAuthProof = () => proofContext.getStore();
export const withAuthProof = <T>(context: AuthProofContext, run: () => T): T => proofContext.run(context, run);
