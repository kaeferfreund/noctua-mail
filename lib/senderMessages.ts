/** Slice 3 English messages, staged for semantic Compose/Settings/Errors catalog IDs.
 * No component in this slice uses useTranslations yet. Stored template text and
 * the four signature placeholders are user content and are never translated.
 */
export const senderMessages = {
  chooseSender: "Choose a sender",
  reviewSender: "Review sender",
  unavailableDraft: "This draft's From address is unavailable. Choose an enabled sender and save the draft.",
  chooseEnabledSender: "Choose an enabled From address before sending.",
  confirmKeepEditedSignature: "Keep the edited signature and add the new signature? Your edited text will be preserved.",
  confirmKeepEditedWithoutSignature: "Keep the edited signature text and stop tracking it as a signature?",
  senderLoadFailed: "Could not load sender identities and preferences.",
  senderUnavailable: "Sender settings are unavailable for this mailbox.",
  identityLoadFailed: "Could not load sender identities.",
  identityRefreshFailed: "Could not refresh sender identities.",
  templateUnavailable: "A signature template is unavailable. Review your signature preferences. Ask a mailbox manager to repair the shared template.",
  identityUnavailable: "This From address is unavailable. Choose an enabled sender and save the draft.",
  draftIdentityChanged: "The saved sender details changed. Review From and save the draft before sending.",
  senderRejected: "The mail provider rejected this From address. Choose another sender or ask a mailbox manager to review it.",
  recipientRejected: "The mail provider rejected a recipient. Review To, Cc and Bcc before trying again.",
  messageRejected: "The mail provider rejected this message. Review its content and attachments.",
  providerTemporary: "The mail provider is temporarily unavailable. Keep this draft and try again later.",
  providerConfiguration: "Sending is unavailable. Ask a mailbox manager to review the mail configuration.",
  providerConnection: "Could not connect to the mail provider. Keep this draft and try again later.",
  providerFailure: "The mail provider could not process this message. Keep this draft and contact a mailbox manager.",
  connectionTimeout: "Connecting to the mail provider timed out. Keep this draft and try again later.",
  greetingTimeout: "The mail provider did not respond in time. Keep this draft and try again later.",
  deliveryUncertain: "The mail provider timed out. Delivery may have succeeded; check Sent and with the recipient before sending again.",
  identitiesTitle: "Identities",
  identitiesHelp: "Addresses this mailbox can send from. Check send-as permission with the mail provider before enabling an address. This is separate from your mailbox role.",
  identitiesLoading: "Loading identities…",
  identitySaved: "Identity saved.",
  managerOnly: "Only mailbox managers can change sender identities.",
  replyToLabel: "Reply-To:",
  chooseDefaultBeforeDisable: "Choose another mailbox default before disabling this identity.",
  identityDefaultFor: "Mailbox default for {email}",
  addIdentity: "Add identity",
  saveIdentity: "Save identity",
  displayName: "Display name",
  replyTo: "Reply-To",
  replyToHelp: "Optional single address; replies go here instead of From.",
  signatureTemplate: "Signature template",
  mailboxDefault: "Mailbox default",
  senderPreferencesTitle: "Sender preferences",
  senderPreferencesHelp: "Personal From and signature for this mailbox",
  senderPreferencesLoading: "Loading sender preferences…",
  senderPreferencesSaved: "Sender preferences saved.",
  defaultFrom: "Default From",
  unavailableIdentity: "Unavailable identity",
  personalTemplate: "Personal signature template",
  inheritTemplate: "Use identity or mailbox default",
  personalSignature: "Personal signature",
  personalSignatureHelp: "Overrides the template choice. Empty text explicitly means no signature.",
  inheritSignature: "Inherit signature template",
  usePersonalText: "Use personal text",
  personalSignatureText: "Personal signature text",
  placeholdersHelp: "Supported placeholders: {{user.name}}, {{user.email}}, {{identity.displayName}}, {{identity.email}}. Add job titles as plain text.",
  invalidTemplate: "Use only the supported signature placeholders (maximum 8 KiB).",
  signaturePreview: "Signature preview",
  saveSenderPreferences: "Save sender preferences",
  sharedTemplatesHelp: "Manage shared mailbox templates. Personal signature overrides are in Preferences. Supported placeholders: {{user.name}}, {{user.email}}, {{identity.displayName}}, {{identity.email}}.",
  retrySender: "Retry loading sender settings",
  personalDefaultUnavailable: "Your default identity is unavailable. Choose an enabled identity in Preferences, or ask a mailbox manager to re-enable it.",
  savedIdentityUnavailable: "The saved draft identity is unavailable. Review sender and save the draft.",
  identityExists: "An identity with this address already exists.",
  defaultIdentityRequired: "Choose another mailbox default before disabling this identity.",
  signatureInUse: "This signature is used by a sender identity. Choose another template for that identity first.",
  invalidPreferences: "Review your sender preferences and signature placeholders.",
  senderOption: "{sender}",
  senderDefaultOption: "{sender} (mailbox default)",
  senderUnavailableOption: "{sender} — unavailable",
  identityEnabled: "{sender}",
  identityDefault: "{sender} — Mailbox default",
  identityDisabled: "{sender} — Disabled",
  identityDefaultDisabled: "{sender} — Mailbox default — Disabled",
  identitySignatureDefault: "Mailbox default signature",
} as const;

export function senderOption(sender: string, state: "enabled" | "default" | "unavailable") {
  const message = state === "unavailable" ? senderMessages.senderUnavailableOption : state === "default" ? senderMessages.senderDefaultOption : senderMessages.senderOption;
  return message.replace("{sender}", () => sender);
}

export function senderSettingsError(error: unknown): string {
  const messages: Record<string, string> = {
    identity_exists: senderMessages.identityExists,
    default_identity_required: senderMessages.defaultIdentityRequired,
    signature_in_use: senderMessages.signatureInUse,
    invalid_preferences: senderMessages.invalidPreferences,
    signature_template_invalid: senderMessages.invalidTemplate
  };
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  return messages[code] ?? (error instanceof Error ? error.message : senderMessages.identityLoadFailed);
}

export function identityStatus(sender: string, isDefault: boolean, enabled: boolean) {
  const message = isDefault ? (enabled ? senderMessages.identityDefault : senderMessages.identityDefaultDisabled) : (enabled ? senderMessages.identityEnabled : senderMessages.identityDisabled);
  return message.replace("{sender}", () => sender);
}
