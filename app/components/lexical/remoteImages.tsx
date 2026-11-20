"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useRemoteContent } from "@/app/hooks/useRemoteContent";

/** The message whose remote-content consent applies to the editor's images. */
export type RemoteImageSource = { accountId: string; id: string; senderKey?: string | null };

type EditorRemoteImages = { allowed: boolean; allow: () => void };

const EditorRemoteImagesContext = createContext<EditorRemoteImages>({ allowed: false, allow: () => {} });

/**
 * Remote-content consent for images in the rich compose editor (A31, DS-08):
 * a quoted original or a draft saved by another member can carry remote
 * images. They load when the reader's consent for the source message allows
 * them (sender permission or "load once") or after the user clicks a
 * placeholder in this editor session (`sessionKey`). The exported HTML keeps
 * every image source unchanged.
 */
export function EditorRemoteImagesProvider({ source, sessionKey, children }: {
  source?: RemoteImageSource | null;
  sessionKey?: unknown;
  children: ReactNode;
}) {
  const remote = useRemoteContent({ accountId: source?.accountId, senderKey: source?.senderKey, messageId: source?.id });
  const [shownFor, setShownFor] = useState<{ key: unknown } | null>(null);
  const shown = shownFor !== null && shownFor.key === sessionKey;
  const value = useMemo(
    () => ({ allowed: remote.allowed || shown, allow: () => setShownFor({ key: sessionKey }) }),
    [remote.allowed, sessionKey, shown]
  );
  return <EditorRemoteImagesContext.Provider value={value}>{children}</EditorRemoteImagesContext.Provider>;
}

export function useEditorRemoteImages() {
  return useContext(EditorRemoteImagesContext);
}
