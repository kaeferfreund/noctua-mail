/** Stable catalog IDs. Keep these in state/warnings; resolve copy only when rendering.
 * User content, signature tokens, and server error codes are never translated.
 */
export const senderMessages = {
  "chooseSender": "Compose.sender.chooseSender",
  "reviewSender": "Compose.sender.reviewSender",
  "unavailableDraft": "Compose.sender.unavailableDraft",
  "chooseEnabledSender": "Compose.sender.chooseEnabledSender",
  "confirmKeepEditedSignature": "Compose.sender.confirmKeepEditedSignature",
  "confirmKeepEditedWithoutSignature": "Compose.sender.confirmKeepEditedWithoutSignature",
  "senderLoadFailed": "Errors.sender.senderLoadFailed",
  "senderUnavailable": "Errors.sender.senderUnavailable",
  "identityLoadFailed": "Errors.sender.identityLoadFailed",
  "identityRefreshFailed": "Errors.sender.identityRefreshFailed",
  "templateUnavailable": "Errors.sender.templateUnavailable",
  "identityUnavailable": "Errors.sender.identityUnavailable",
  "draftIdentityChanged": "Errors.sender.draftIdentityChanged",
  "senderRejected": "Errors.sender.senderRejected",
  "recipientRejected": "Errors.sender.recipientRejected",
  "messageRejected": "Errors.sender.messageRejected",
  "providerTemporary": "Errors.sender.providerTemporary",
  "providerConfiguration": "Errors.sender.providerConfiguration",
  "providerConnection": "Errors.sender.providerConnection",
  "providerFailure": "Errors.sender.providerFailure",
  "connectionTimeout": "Errors.sender.connectionTimeout",
  "greetingTimeout": "Errors.sender.greetingTimeout",
  "deliveryUncertain": "Errors.sender.deliveryUncertain",
  "identitiesTitle": "Settings.sender.identitiesTitle",
  "identitiesHelp": "Settings.sender.identitiesHelp",
  "identitiesLoading": "Settings.sender.identitiesLoading",
  "identitySaved": "Settings.sender.identitySaved",
  "managerOnly": "Settings.sender.managerOnly",
  "replyToLabel": "Settings.sender.replyToLabel",
  "chooseDefaultBeforeDisable": "Settings.sender.chooseDefaultBeforeDisable",
  "identityDefaultFor": "Settings.sender.identityDefaultFor",
  "addIdentity": "Settings.sender.addIdentity",
  "saveIdentity": "Settings.sender.saveIdentity",
  "displayName": "Settings.sender.displayName",
  "replyTo": "Settings.sender.replyTo",
  "replyToHelp": "Settings.sender.replyToHelp",
  "signatureTemplate": "Settings.sender.signatureTemplate",
  "mailboxDefault": "Settings.sender.mailboxDefault",
  "senderPreferencesTitle": "Settings.sender.senderPreferencesTitle",
  "senderPreferencesHelp": "Settings.sender.senderPreferencesHelp",
  "senderPreferencesLoading": "Settings.sender.senderPreferencesLoading",
  "defaultFrom": "Settings.sender.defaultFrom",
  "unavailableIdentity": "Settings.sender.unavailableIdentity",
  "personalTemplate": "Settings.sender.personalTemplate",
  "inheritTemplate": "Settings.sender.inheritTemplate",
  "personalSignature": "Settings.sender.personalSignature",
  "personalSignatureHelp": "Settings.sender.personalSignatureHelp",
  "inheritSignature": "Settings.sender.inheritSignature",
  "usePersonalText": "Settings.sender.usePersonalText",
  "personalSignatureText": "Settings.sender.personalSignatureText",
  "placeholdersHelp": "Settings.sender.placeholdersHelp",
  "invalidTemplate": "Settings.sender.invalidTemplate",
  "signaturePreview": "Settings.sender.signaturePreview",
  "sharedTemplatesHelp": "Settings.sender.sharedTemplatesHelp",
  "retrySender": "Compose.sender.retrySender",
  "personalDefaultUnavailable": "Errors.sender.personalDefaultUnavailable",
  "savedIdentityUnavailable": "Errors.sender.savedIdentityUnavailable",
  "identityExists": "Errors.sender.identityExists",
  "defaultIdentityRequired": "Errors.sender.defaultIdentityRequired",
  "signatureInUse": "Errors.sender.signatureInUse",
  "invalidPreferences": "Errors.sender.invalidPreferences",
  "senderOption": "Compose.sender.senderOption",
  "senderDefaultOption": "Compose.sender.senderDefaultOption",
  "senderUnavailableOption": "Compose.sender.senderUnavailableOption",
  "identityEnabled": "Settings.sender.identityEnabled",
  "identityDefault": "Settings.sender.identityDefault",
  "identityDisabled": "Settings.sender.identityDisabled",
  "identityDefaultDisabled": "Settings.sender.identityDefaultDisabled",
  "identitySignatureDefault": "Settings.sender.identitySignatureDefault",
  "edit": "Settings.edit",
  "enable": "Admin.users.enable",
  "disable": "Admin.users.disable",
  "email": "Admin.email",
  "enabled": "Settings.members.enabled",
  "saving": "Settings.preferences.saving",
  "cancel": "Admin.cancel",
  "noSignature": "Settings.preferences.noSignature",
  "from": "Compose.from",
  "closeComposer": "Compose.closeComposer",
  "fromSubtitle": "Compose.fromValue"
} as const;

export type SenderMessageId = typeof senderMessages[keyof typeof senderMessages];
export type SenderCopy = Record<keyof typeof senderMessages, string>;
const messageIds = new Set<string>(Object.values(senderMessages));
export function isSenderMessageId(value: string): value is SenderMessageId {
  return messageIds.has(value);
}

export function senderOption(sender: string, state: "enabled" | "default" | "unavailable", senderMessages: SenderCopy) {
  const message = state === "unavailable" ? senderMessages.senderUnavailableOption : state === "default" ? senderMessages.senderDefaultOption : senderMessages.senderOption;
  return message.replace("{sender}", () => sender);
}

export function senderSettingsError(error: unknown, copy: SenderCopy): string {
  const messages: Record<string, string> = {
    identity_exists: copy.identityExists,
    default_identity_required: copy.defaultIdentityRequired,
    signature_in_use: copy.signatureInUse,
    invalid_preferences: copy.invalidPreferences,
    signature_template_invalid: copy.invalidTemplate
  };
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : "";
  if (messages[code]) return messages[code];
  if (error instanceof Error) {
    const entry = Object.entries(senderMessages).find(([, id]) => id === error.message);
    if (entry) return copy[entry[0] as keyof SenderCopy];
  }
  // Provider details and unknown API messages are never UI copy.
  return copy.identityLoadFailed;
}

export function identityStatus(sender: string, isDefault: boolean, enabled: boolean, senderMessages: SenderCopy) {
  const message = isDefault ? (enabled ? senderMessages.identityDefault : senderMessages.identityDefaultDisabled) : (enabled ? senderMessages.identityEnabled : senderMessages.identityDisabled);
  return message.replace("{sender}", () => sender);
}
