import { randomUUID } from "node:crypto";
import { validateAccountFolders } from "@/app/api/_helpers/folderAccount";
import { formatEnvelopeAddresses, resolveMessageSenderKey } from "@/lib/mail/imap/parser";
import type { ImapEnvelope } from "@/lib/mail/imap/_shared";
import { connectIdleImapClient, runImapIdleLoop } from "@/lib/mail/imap/idle";
import { getImapHttpError } from "@/lib/mail/imapError";
import { registerAuthStream } from "@/lib/authStreams";
import { createStreamEventSender } from "./streamEventSender";
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
import { isStreamKey, registerStream } from "@/lib/mail/imapStreamRegistry";
import { normalizeImapFlags } from "@/lib/messageFlags";
import { mailboxPathFromFolderId } from "@/lib/mailboxPaths";
import { findInboxFolder } from "@/lib/specialFolders";
import {
  getAccountIdFromParams,
  requireAccountContext,
  type AccountRouteParams
} from "@/app/api/_helpers/accountContext";

const DEFAULT_MAX_IDLE = 3;
const DEFAULT_BACKGROUND_POLL_INTERVAL = 900_000; // 15 minutes
// Bound orphaned streams even when the runtime reports neither abort nor cancel.
const MAX_STREAM_LIFETIME_MS = 60 * 60 * 1000;

export async function GET(request: Request, { params }: AccountRouteParams) {
  const { searchParams } = new URL(request.url);
  const accountIdParam = await getAccountIdFromParams(params);
  // Folder switches arrive later through `stream/folder`; see `switchActiveFolder`.
  let activeFolderId = searchParams.get("activeFolderId");
  const streamKey = searchParams.get("streamKey");
  const accountContext = await requireAccountContext(request, accountIdParam, {
    minRole: "viewer",
    missingAccountMessage: "Missing accountId"
  });
  if (accountContext instanceof NextResponse) return accountContext;
  return withAuthResponse(accountContext, async () => {
    const { accountId, account, clientId } = accountContext;
    const folderError = await validateAccountFolders(accountId,
      [activeFolderId, searchParams.get("folderId")]);
    if (folderError) return folderError;
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

    if (streamKey !== null && !isStreamKey(streamKey)) {
      return NextResponse.json({ ok: false, message: "Invalid streamKey" }, { status: 400 });
    }
    let folders = await getFolders(accountId);
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
        let lifetimeTimer: ReturnType<typeof setTimeout> | undefined;
        let polling = false;
        let pollClient: import("imapflow").ImapFlow | null = null;
        const { userId, sessionId, generation, authenticatedAt } = accountContext.session;
        const identity = { userId, sessionId, generation, authenticatedAt, accountId, minRole: "viewer" as const };
        const send = createStreamEventSender({ identity, accountId, role: accountContext.role, controller,
          isStopped: () => stopped, close: () => authStream.close() });

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
          },
          owner: streamKey ? { key: streamKey, userId, sessionId } : undefined,
          setActiveFolder: (folderId, seq) => switchActiveFolder(folderId, seq)
        });

        const stopAll = async () => {
          if (stopped) return;
          stopped = true;
          streamTimers.clearInterval(pollTimer); streamTimers.clearInterval(keepaliveTimer);
          streamTimers.clearTimeout(lifetimeTimer);
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
        if (stopped) return;

        const streamId = randomUUID().slice(0, 8);
        lifetimeTimer = streamTimers.setTimeout(async () => {
          try {
            // Authorization is asynchronous: deliver before closing the stream.
            await send("reconnect", { streamId });
          } finally {
            authStream.close();
          }
        }, MAX_STREAM_LIFETIME_MS);

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

          const client = await connectIdleImapClient(account, { ...logContext, mailbox }, {
            disposeClient,
            createClient: (options) => {
              if (stopped) throw new Error("Stream closed");
              const nextClient = new ImapFlow(options);
              ownedClients.add(nextClient);
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
          // SELECT/EXAMINE UNSEEN is the first unseen sequence number. Only
          // STATUS UNSEEN is an unread count, including for a selected mailbox.
          const readFolderStatus = async () => {
            const status = await logImapOp(
              "imap.status",
              { ...logContext, mailbox },
              () => client.status(mailbox, {
                uidNext: true, uidValidity: true, messages: true, unseen: true
              })
            );
            if (!status) throw new Error(`IMAP STATUS failed for ${mailbox}`);
            return status;
          };
          const sendFolderStatus = (status: Awaited<ReturnType<typeof readFolderStatus>>) =>
            send("folder:update", [{
              id: folder.id,
              uidNext: status.uidNext,
              unseen: status.unseen,
              exists: status.messages
            }]);
          await sendFolderStatus(await readFolderStatus());

          const fetchNew = async () => {
            const watcher = sessions.get(folder.id);
            if (stopped || !watcher) return;
            const previousUidNext = watcher.lastUidNext;
            const status = await readFolderStatus();
            // Reconcile resets even if the server reuses the previous UIDs.
            const currentState = await getMailboxState(accountId, folder.id);
            await saveMailboxState({ accountId, folderId: folder.id, mailboxPath: mailbox,
              uidValidity: status.uidValidity == null ? currentState?.uidValidity : String(status.uidValidity),
              highestUid: currentState?.highestUid, highestModSeq: currentState?.highestModSeq,
              supportsQresync });
            const uidNext = status.uidNext ?? previousUidNext;
            if (uidNext <= previousUidNext) {
              await sendFolderStatus(status);
              return;
            }
            const range = { uid: `${previousUidNext}:${uidNext - 1}` };
            const items = await logImapOp(
              "imap.fetch",
              { ...logContext, mailbox, range: range.uid },
              async () => {
                const list: Array<{
                  uid: number;
                  subject: string;
                  from: string;
                  senderKey: string | null;
                  date?: string | null;
                  messageId?: string | null;
                  folderId: string;
                }> = [];
                for await (const message of client.fetch(range, { uid: true, envelope: true })) {
                  const env = message.envelope as ImapEnvelope | undefined;
                  list.push({
                    uid: message.uid,
                    subject: env?.subject ?? "(no subject)",
                    from: formatEnvelopeAddresses(env?.from),
                    senderKey: resolveMessageSenderKey(env, new Map()),
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
              uidValidity: status.uidValidity == null ? currentState?.uidValidity : String(status.uidValidity),
              highestModSeq: (status as any)?.highestModseq
                ? (status as any).highestModseq.toString()
                : null,
              highestUid: currentHighestUid ?? null,
              supportsQresync
            });
            await sendFolderStatus(status);
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
            void readFolderStatus().then(sendFolderStatus).catch((error: unknown) => {
              void send("error", error);
            });
          });

          void runImapIdleLoop(client).catch((error: unknown) => {
            if (!stopped) void send("error", error);
          });
          } catch (error) {
            if (!sessionRegistered) {
              await disposeClient(client);
            }
            throw error;
          }
        };

        // One connect per folder even when a switch races the initial watchers.
        const pendingWatchers = new Map<string, Promise<void>>();
        const watchFolder = (folderId: string) => {
          const pending = pendingWatchers.get(folderId);
          if (pending) return pending;
          const task = openWatcher(folderId).finally(() => pendingWatchers.delete(folderId));
          pendingWatchers.set(folderId, task);
          return task;
        };

        // A folder switch keeps the INBOX IDLE session and the recently used
        // folder sessions (LRU up to maxIdleSessions) instead of reconnecting.
        let lastSwitchSeq = -1;
        const switchActiveFolder = async (folderId: string | null, seq: number) => {
          if (stopped || seq <= lastSwitchSeq) return;
          lastSwitchSeq = seq;
          activeFolderId = folderId;
          if (!folderId) return;
          if (!folders.some((folder) => folder.id === folderId)) {
            // Created after this stream started; the caller validated the account.
            folders = await getFolders(accountId);
            if (stopped || activeFolderId !== folderId) return;
          }
          try {
            await watchFolder(folderId);
          } catch (error) {
            // Same outcome as a failing initial watcher: report, end the stream.
            await send("error", error);
            authStream.close();
          }
        };

        try {
          if (inboxFolder) {
            await watchFolder(inboxFolder.id);
          }
          if (activeFolderId && activeFolderId !== inboxFolder?.id) {
            await watchFolder(activeFolderId);
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
                  if (!status) continue;
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
