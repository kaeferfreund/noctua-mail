// Load-once decisions last while the message is open and are never prefs.
const allowedMessages = new Set<string>();
const readers = new Map<string, number>();
const listeners = new Set<() => void>();
const key = (accountId: string, messageId: string) => JSON.stringify([accountId, messageId]);
export function retainRemoteContentDecision(accountId: string, messageId: string) {
  const messageKey = key(accountId, messageId);
  readers.set(messageKey, (readers.get(messageKey) ?? 0) + 1);
  return () => {
    const count = (readers.get(messageKey) ?? 1) - 1;
    if (count > 0) readers.set(messageKey, count);
    else {
      readers.delete(messageKey);
      if (allowedMessages.delete(messageKey)) listeners.forEach(listener => listener());
    }
  };
}
export function hasLoadedRemoteContent(accountId: string, messageId: string) {
  return allowedMessages.has(key(accountId, messageId));
}
export function loadRemoteContentOnce(accountId: string, messageId: string) {
  allowedMessages.add(key(accountId, messageId));
  listeners.forEach(listener => listener());
}
export function subscribeRemoteContent(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function withRemoteContentDecision(path: string, accountId: string, messageId: string) {
  return hasLoadedRemoteContent(accountId, messageId) ? `${path}?remoteContent=allow` : path;
}
