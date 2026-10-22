import { mailboxFailureDto } from "@/lib/mailboxFailure";
import { getImapHttpError } from "@/lib/mail/imapError";
import { assertStreamAuthorized, registerAuthStream } from "@/lib/authStreams";
import { withAuthResponse } from "@/lib/auth";
import { NextResponse } from "next/server";

import {
  deleteMessageByFolderUid,
  getFolders,
  getLatestMessageUid,
  getMailboxState,
  saveMailboxState
} from "@/lib/serverDb";
import { logImapOp } from "@/lib/mail/imapLogger";
import {
  bindImapClientError,
  buildImapFlowOptions,
  connectImapClientWithRetry,
  safeLogoutImapClient,
  loadImapFlow,
  streamTimers
} from "@/lib/mail/imapStreamRuntime";
import { registerStream } from "@/lib/mail/imapStreamRegistry";
import { normalizeImapFlags } from "@/lib/messageFlags";
import { mailboxPathFromFolderId } from "@/lib/mailboxPaths";
import { findInboxFolder } from "@/lib/specialFolders";
import {
  getAccountIdFromParams,
  requireAccountContext,
  type AccountRouteParams
} from "@/app/api/_helpers/accountContext";

type EnvelopeAddress = { name?: string | null; mailbox?: string | null; host?: string | null };
type Envelope = { subject?: string | null; from?: EnvelopeAddress[] | null; date?: Date | null; messageId?: string | null };

const DEFAULT_MAX_IDLE = 3;
const DEFAULT_BACKGROUND_POLL_INTERVAL = 900_000; // 15 minutes

function formatAddress(addresses?: EnvelopeAddress[] | null) {
  if (!addresses || addresses.length === 0) return "";
  const parts = addresses.map((addr) => {
    const email = addr?.mailbox && addr?.host ? `${addr.mailbox}@${addr.host}` : "";
    if (addr?.name && email) return `"${addr.name}" <${email}>`;
    return addr?.name || email || "";
  });
  return parts.filter(Boolean).join(", ");
}

export async function GET(request: Request, { params }: AccountRouteParams) {
  const { searchParams } = new URL(request.url);
  const accountIdParam = await getAccountIdFromParams(params);
  const activeFolderId = searchParams.get("activeFolderId");
  const accountContext = await requireAccountContext(request, accountIdParam, {
    minRole: "viewer",
    missingAccountMessage: "Missing accountId"
  });
  if (accountContext instanceof NextResponse) return accountContext;
  return withAuthResponse(accountContext, async () => {
    const { accountId, account, clientId } = accountContext;
    const logContext = { accountId, clientId };

    const maxIdleSessions =
      Number(searchParams.get("maxIdleSessions")) ||
      account?.settings?.sync?.maxIdleSessions ||
      DEFAULT_MAX_IDLE;
    const pollIntervalMs =
      Number(searchParams.get("backgroundPollIntervalMs")) ||
      Number(searchParams.get("pollIntervalMs")) ||
      account?.settings?.sync?.backgroundPollIntervalMs ||
      account?.settings?.sync?.pollIntervalMs ||
      DEFAULT_BACKGROUND_POLL_INTERVAL;

    const folders = await getFolders(accountId);
    const inboxFolder = findInboxFolder(folders, accountId) ?? folders[0];

    const encoder = new TextEncoder();

    let ImapFlow: typeof import("imapflow").ImapFlow;
    try {
      ImapFlow = await loadImapFlow();
    } catch {
      return NextResponse.json(
        { ok: false, message: "IMAP library is missing. Run `bun install`." },
        { status: 500 }
      );
    }

    let cancelStream: () => void = () => {};
    const stream = new ReadableStream<Uint8Array>({
      cancel() { cancelStream(); },
      async start(controller) {
        let stopped = false;
        let pollTimer: ReturnType<typeof setInterval> | undefined;
        let keepaliveTimer: ReturnType<typeof setInterval> | undefined;
        let polling = false;
        let pollClient: import("imapflow").ImapFlow | null = null;
        const { userId, sessionId, generation, authenticatedAt, expiresAt } = accountContext.session;
        const identity = { userId, sessionId, generation, authenticatedAt, expiresAt, accountId, minRole: "viewer" as const };
        const send = async (event: string, data: unknown) => {
          if (stopped) return;
          try {
            const safeData = event === "error" ? getImapHttpError(data) ? await mailboxFailureDto(accountId, accountContext.role) : { accountId, message: "Mailbox unavailable" } : data;
            await assertStreamAuthorized(identity);
            if (stopped) return;
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(safeData)}\n\n`));
          } catch { authStream.close(); }
        };

        type Session = {
          mailbox: string;
          folderId: string;
          client: import("imapflow").ImapFlow;
          lastUidNext: number;
          lastUsed: number;
          inbox: boolean;
        };

        // Track clients from construction, including a connection still in flight.
        const ownedClients = new Set<import("imapflow").ImapFlow>();
        const disposedClients = new WeakSet<import("imapflow").ImapFlow>();
        const disposeClient = async (client: import("imapflow").ImapFlow | null) => {
          if (!client || disposedClients.has(client)) return;
          disposedClients.add(client);
          ownedClients.delete(client);
          await safeLogoutImapClient(client, logContext, "imap.logout");
        };
        const sessions = new Map<string, Session>(); // key: folderId
        const removedFolderIds = new Set<string>();
        const unregister = registerStream(accountId, {
          removeFolder: async (folderId: string) => {
            removedFolderIds.add(folderId);
            await closeSession(folderId);
          }
        });

        const stopAll = async () => {
          if (stopped) return;
          stopped = true;
          streamTimers.clearInterval(pollTimer); streamTimers.clearInterval(keepaliveTimer);
          request.signal.removeEventListener("abort", onAbort);
          unregister();
          try { controller.close(); } catch { /* Already closed. */ }
          sessions.clear();
          await Promise.allSettled([...ownedClients].map(disposeClient));
        };
        const authStream = registerAuthStream(identity, stopAll);
        const onAbort = () => authStream.close();
        cancelStream = onAbort;
        request.signal.addEventListener("abort", onAbort, { once: true });
        if (request.signal.aborted) { onAbort(); return; }

        const closeSession = async (folderId: string) => {
          const sess = sessions.get(folderId);
          if (!sess) return;
          sessions.delete(folderId);
          await disposeClient(sess.client);
        };

        const enforceCapacity = async () => {
          if (sessions.size <= maxIdleSessions) return;
          // pick least recently used that is not inbox and not the current active folder
          let oldest: Session | null = null;
          for (const sess of sessions.values()) {
            if (sess.inbox) continue;
            if (activeFolderId && sess.folderId === activeFolderId) continue;
            if (!oldest || sess.lastUsed < oldest.lastUsed) {
              oldest = sess;
            }
          }
          if (oldest) {
            await closeSession(oldest.folderId);
          }
        };

        const openWatcher = async (folderId: string | undefined | null, markUsed = true) => {
          if (stopped || !folderId) return;
          if (removedFolderIds.has(folderId)) return;
          const folder = folders.find((f) => f.id === folderId);
          if (!folder) return;
          if (sessions.has(folder.id)) {
            const existing = sessions.get(folder.id)!;
            if (markUsed) existing.lastUsed = Date.now();
            return;
          }
          const mailbox = mailboxPathFromFolderId(folder.id, accountId);

          const client = await connectImapClientWithRetry({
            account,
            disposeClient,
            logContext: { ...logContext, mailbox },
            connectOp: "imap.connect",
            createClient: () => {
              if (stopped) throw new Error("Stream closed");
              const nextClient = new ImapFlow(
                buildImapFlowOptions(account, {
                  maxIdleTime: 10 * 60 * 1000,
                  qresync: true
                }, { ...logContext, mailbox })
              );
              ownedClients.add(nextClient);
              bindImapClientError(nextClient, { ...logContext, mailbox });
              return nextClient;
            }
          });
          // The newly connected client is not yet tracked in `sessions`. If any
          // post-connect step below throws before we register it, `stopAll()`
          // would leave the connection dangling. Flip this flag immediately
          // after `sessions.set()` and clean up on failure otherwise.
          if (stopped) { await disposeClient(client); return; }
          let sessionRegistered = false;
          try {
          const caps: any =
            (client as any).enabledCapabilities ||
            (client as any).serverCapabilities ||
            (client as any).capabilities ||
            null;
          const hasCap = (cap: string) => {
            if (!caps) return false;
            if (caps instanceof Set) return caps.has(cap) || caps.has(cap.toLowerCase());
            if (Array.isArray(caps)) return caps.includes(cap) || caps.includes(cap.toLowerCase());
            return false;
          };
          const supportsQresync = hasCap("QRESYNC");

          const storedState = await getMailboxState(accountId, folder.id);

          const mailboxOptions: any = { readOnly: true };
          if (supportsQresync) {
            mailboxOptions.qresync = true;
            if (storedState?.uidValidity && storedState?.highestModSeq) {
              mailboxOptions.uidValidity = storedState.uidValidity;
              mailboxOptions.changedSince = BigInt(storedState.highestModSeq);
            }
          }

          const mailboxInfo = await logImapOp(
            "imap.mailboxOpen",
            { ...logContext, mailbox, readOnly: true },
            async () => await client.mailboxOpen(mailbox, mailboxOptions)
          );
          const lastUidNext = mailboxInfo?.uidNext ?? 0;
          // Don't update highestUid based on server's uidNext - keep existing value
          // highestUid should only be updated after successfully storing messages
          await saveMailboxState({
            accountId,
            folderId: folder.id,
            mailboxPath: mailbox,
            uidValidity: mailboxInfo?.uidValidity ? mailboxInfo.uidValidity.toString() : null,
            highestModSeq: (mailboxInfo as any)?.highestModseq
              ? (mailboxInfo as any).highestModseq.toString()
              : storedState?.highestModSeq ?? null,
            highestUid: storedState?.highestUid ?? null,
            supportsQresync
          });
          if (stopped) { await disposeClient(client); return; }
          sessions.set(folder.id, {
            mailbox,
            folderId: folder.id,
            client,
            lastUidNext,
            lastUsed: Date.now(),
            inbox: inboxFolder ? folder.id === inboxFolder.id : false
          });
          sessionRegistered = true;
          await enforceCapacity();
          await send("folder:update", [
            {
              id: folder.id,
              uidNext: lastUidNext,
              unseen: (mailboxInfo as any)?.unseen ?? 0,
              exists: (mailboxInfo as any)?.exists ?? 0
            }
          ]);

          const fetchNew = async () => {
            const watcher = sessions.get(folder.id);
            if (stopped || !watcher) return;
            const previousUidNext = watcher.lastUidNext;
            const status = await logImapOp(
              "imap.status",
              { ...logContext, mailbox },
              async () => await client.status(mailbox, { uidNext: true })
            );
            const uidNext = status?.uidNext ?? previousUidNext;
            if (uidNext <= previousUidNext) return;
            const range = { uid: `${previousUidNext}:${uidNext - 1}` };
            const items = await logImapOp(
              "imap.fetch",
              { ...logContext, mailbox, range: range.uid },
              async () => {
                const list: Array<{
                  uid: number;
                  subject: string;
                  from: string;
                  date?: string | null;
                  messageId?: string | null;
                  folderId: string;
                }> = [];
                for await (const message of client.fetch(range, { uid: true, envelope: true })) {
                  const env = message.envelope as Envelope | undefined;
                  list.push({
                    uid: message.uid,
                    subject: env?.subject ?? "(no subject)",
                    from: formatAddress(env?.from),
                    date: env?.date ? env.date.toISOString() : null,
                    messageId: env?.messageId ?? null,
                    folderId: folder.id
                  });
                }
                return list;
              }
            );
            if (items.length) {
              await send("new", { uidNext, messages: items });
            }
            const activeWatcher = sessions.get(folder.id);
            if (activeWatcher) activeWatcher.lastUidNext = uidNext;
            // Only update highestUid if messages were detected
            // The actual sync job will update it based on stored messages
            // Don't blindly trust server's uidNext to prevent gaps
            const currentHighestUid = await getLatestMessageUid(accountId, mailbox);
            await saveMailboxState({
              accountId,
              folderId: folder.id,
              mailboxPath: mailbox,
              uidValidity: (mailboxInfo as any)?.uidValidity
                ? (mailboxInfo as any).uidValidity.toString()
                : null,
              highestModSeq: (status as any)?.highestModseq
                ? (status as any).highestModseq.toString()
                : null,
              highestUid: currentHighestUid ?? (storedState?.highestUid ?? null),
              supportsQresync
            });
          };

          // Event listeners are fire-and-forget; a rejection from fetchNew
          // would otherwise surface as an unhandledRejection.
          client.on("exists", () => {
            fetchNew().catch((error: unknown) => {
              void send("error", error);
            });
          });
          client.on("expunge", (info) => {
            void (async () => {
              const payload: any = { folderId: folder.id };
              if (info?.uid) {
                payload.uid = info.uid;
                try {
                  const deleted = await deleteMessageByFolderUid(accountId, folder.id, info.uid);
                  payload.reconciled = deleted !== undefined;
                } catch {
                  payload.reconciled = false;
                }
              }
              send("message:removed", payload);
            })();
          });
          client.on("flags", (info) => {
            const uid = info?.uid;
            if (!uid) return;
            send("flags:update", {
              folderId: folder.id,
              uid,
              flags: normalizeImapFlags(Array.from(info.flags ?? []))
            });
          });

          const idleLoop = async () => {
            while (!stopped && !(client as any).closed) {
              try {
                await client.idle();
              } catch (error) {
                void send("error", error);
                break;
              }
            }
          };

          void idleLoop();
          } catch (error) {
            if (!sessionRegistered) {
              await disposeClient(client);
            }
            throw error;
          }
        };

        try {
          if (inboxFolder) {
            await openWatcher(inboxFolder.id);
          }
          const uniqueFolders = new Set<string>();
          if (activeFolderId) uniqueFolders.add(activeFolderId);
          for (const fid of uniqueFolders) {
            if (!inboxFolder || fid !== inboxFolder.id) {
              await openWatcher(fid);
            }
          }

          // Polling loop for remaining folders
            const pollFolders = async () => {
              if (stopped || polling) return;
              const watchIds = new Set(Array.from(sessions.keys()));
              const toPoll = folders.filter(
                (f) => !watchIds.has(f.id) && !removedFolderIds.has(f.id)
              );
              if (toPoll.length === 0) return;

            // Runs detached on a timer, so any escaping rejection would be
            // unhandled — the connect must stay inside the try.
            polling = true;
            try {
              const connectedClient = await connectImapClientWithRetry({
                account,
                disposeClient,
                logContext: { ...logContext, mailbox: "poll" },
                connectOp: "imap.connect",
                createClient: () => {
                  if (stopped) throw new Error("Stream closed");
                  const nextClient = new ImapFlow(
                    buildImapFlowOptions(account, {}, { ...logContext, mailbox: "poll" })
                  );
                  ownedClients.add(nextClient);
                  bindImapClientError(nextClient, { ...logContext, mailbox: "poll" });
                  return nextClient;
                }
              });
              pollClient = connectedClient;
              if (stopped) return;
              const updates: Array<{ id: string; uidNext?: number; unseen?: number; exists?: number }>
                = [];
              for (const folder of toPoll) {
                if (stopped) break;
                const mailbox = mailboxPathFromFolderId(folder.id, accountId);
                try {
                  const status = await logImapOp(
                    "imap.status",
                    { ...logContext, mailbox },
                    async () =>
                      await connectedClient.status(mailbox, {
                        uidNext: true,
                        messages: true,
                        unseen: true
                      })
                  );
                  updates.push({
                    id: folder.id,
                    uidNext: status.uidNext,
                    unseen: status.unseen,
                    exists: status.messages
                  });
                } catch (error) {
                  if (getImapHttpError(error)) throw error;
                  // Ignore transient per-folder status errors.
                }
              }
              if (updates.length) {
                await send("folder:update", updates);
              }
            } catch (error) {
              await send("error", error);
            } finally {
              await disposeClient(pollClient);
              pollClient = null;
              polling = false;
            }
          };

          if (stopped) return;
          pollTimer = streamTimers.setInterval(pollFolders, pollIntervalMs);

          // Comment pings keep proxies from timing out an otherwise idle stream.
          keepaliveTimer = streamTimers.setInterval(() => {
            try {
              if (!stopped) controller.enqueue(encoder.encode(":ping\n\n"));
            } catch {
              authStream.close();
            }
          }, 25_000);


        } catch (error) {
          await send("error", error);
          authStream.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
  });
}
