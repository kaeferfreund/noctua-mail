import { foldSenderMail, senderMailFacts, type SenderMailFacts, type SenderProfile } from "./senderProfile";
import type { SpamInput } from "./types";

/** Synthetic trusted-sender fixtures for the spam tests (no real addresses). */
export const DAY = 24 * 60 * 60_000;
export const START = Date.UTC(2026, 2, 1);
export const ownAddresses = new Set(["anna@example.test"]);

export const trustedInput: SpamInput = {
  from: "Service <notify@service.example.test>", fromEmail: "notify@service.example.test", fromName: "Service",
  replyTo: null, to: "anna@example.test", cc: "", messageId: "<abc@mail.service.example.test>", subject: "[Service] Build passed",
  date: new Date(START + 60 * DAY).toISOString(), listId: "<builds.service.example.test>", listUnsubscribe: null, autoSubmitted: null,
  authenticationResults: ["mx.example.test; spf=pass smtp.mailfrom=bounce.service.example.test; dkim=pass header.d=service.example.test"],
  spamHeaders: ["x-spam-status: No, score=0.1"], linkDomains: ["app.service.example.test"], maskedLinkDomains: [], attachments: [],
  text: "Hello, the build of your project is green. You can see the details on the page. Thank you for using the service."
};

export function trustedFacts(overrides: Partial<SenderMailFacts> = {}): SenderMailFacts {
  return { ...senderMailFacts(trustedInput, { ownAddresses })!, ...overrides };
}

/** `count` mails spread evenly over `days`, all like trustedInput. */
export function trustedProfile(count = 25, days = 60, overrides: Partial<SenderMailFacts> = {}): SenderProfile {
  let profile: SenderProfile | null = null;
  for (let index = 0; index < count; index += 1) {
    profile = foldSenderMail(profile, trustedFacts({ date: START + Math.round((index * days * DAY) / Math.max(1, count - 1)), ...overrides }));
  }
  return profile!;
}

