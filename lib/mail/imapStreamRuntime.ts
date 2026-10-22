/** Narrow protocol/timer seam for production stream lifecycle tests. */
export { bindImapClientError, buildImapFlowOptions, connectImapClientWithRetry, safeLogoutImapClient } from "./imapClientOptions";
export async function loadImapFlow() { return (await import("imapflow")).ImapFlow; }
export const streamTimers = { setInterval, clearInterval };
