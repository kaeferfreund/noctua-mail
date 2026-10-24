/**
 * Web Push contract shared by the server, the settings UI and the service
 * worker (doc/PUSH-NOTIFICATIONS.md). Type-only plus the defaults, so it is
 * safe to import from client code.
 */

export type PushQuietHours = { from: string; to: string; timeZone: string };

export type PushDeviceSettings = {
  /** Mailboxes to notify about; only those the user can access are honoured server-side. */
  accountIds: "all" | string[];
  /** false → the body shows the sender only. */
  includeSubject: boolean;
  quietHours: PushQuietHours | null;
  /** Send unread badge counts. */
  badge: boolean;
};

export const DEFAULT_PUSH_DEVICE_SETTINGS: PushDeviceSettings = {
  accountIds: "all",
  includeSubject: true,
  quietHours: null,
  badge: true
};

/** One of the user's own devices as listed by `GET /api/push/subscriptions`; the endpoint is never returned. */
export type PushSubscriptionSummary = {
  id: string;
  endpointHash: string;
  userAgent: string | null;
  settings: PushDeviceSettings;
  createdAt: number;
  lastSeenAt: number;
};

export type PushPayload =
  | {
    type: "new-mail";
    accountId: string;
    accountName: string;
    /** Messages collapsed into this push. */
    count: number;
    messageId: string;
    threadId: string | null;
    from: string;
    subject: string | null;
    url: string;
    badge?: number;
    sentAt: number;
  }
  | { type: "test"; url: string; sentAt: number }
  | { type: "badge"; badge: number; sentAt: number };
