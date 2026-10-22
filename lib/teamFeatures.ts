import { shouldStorePasswordInDb } from "./secret";

/** Handoff: feat/team-auth replaces this seam with its supported-runtime predicate. */
export function teamFeaturesSupported() {
  return shouldStorePasswordInDb();
}
