import type React from "react";
import { useState } from "react";
import { MESSAGE_VIEW_MODES, type MessageViewMode } from "./messageListViewTypes";

function isValidMessageViewMode(value: unknown): value is MessageViewMode {
  return (
    typeof value === "string" &&
    (MESSAGE_VIEW_MODES as readonly string[]).includes(value)
  );
}

/**
 * The message list's layout (threads / compact / cards / table). MailClient
 * owns it because two siblings consume it: the view menu in the shell header
 * and the list pane that renders against it.
 *
 * `defaultMessageView` is the user's preferred view, typically from account
 * settings. The state follows it whenever it changes to a recognized value;
 * unrecognized values (`null`, `undefined`, a stored setting we don't know
 * about) fall back to "threads".
 */
export function useMessageViewMode(
  defaultMessageView: MessageViewMode | string | null | undefined
): [MessageViewMode, React.Dispatch<React.SetStateAction<MessageViewMode>>] {
  const resolvedDefaultMessageView = isValidMessageViewMode(defaultMessageView)
    ? defaultMessageView
    : null;
  const [messageViewState, setMessageViewState] = useState<{
    sourceDefault: MessageViewMode | null;
    value: MessageViewMode;
  }>(() => ({
    sourceDefault: resolvedDefaultMessageView,
    value: resolvedDefaultMessageView ?? "threads"
  }));
  const messageView =
    messageViewState.sourceDefault === resolvedDefaultMessageView
      ? messageViewState.value
      : resolvedDefaultMessageView ?? "threads";
  const setMessageView: React.Dispatch<React.SetStateAction<MessageViewMode>> = (next) => {
    setMessageViewState((current) => {
      const currentValue =
        current.sourceDefault === resolvedDefaultMessageView
          ? current.value
          : resolvedDefaultMessageView ?? "threads";
      return {
        sourceDefault: resolvedDefaultMessageView,
        value: typeof next === "function" ? next(currentValue) : next
      };
    });
  };
  return [messageView, setMessageView];
}
