import { useEffect, useMemo } from "react";
import RemoteContentBanner from "@/app/components/RemoteContentBanner";
import { useRemoteContent } from "@/app/hooks/useRemoteContent";
import MarkdownContent from "./MarkdownContent";
import { hasRemoteMarkdownImages } from "./markdownImages";
import { normalizeMarkdownBody } from "./normalizeMarkdownBody";
import { useMessageLinkPreview } from "./MessageLinkPreviewContext";

type MarkdownPanelProps = {
  body?: string;
  fontScale?: number;
  /**
   * The message whose body this is. Remote images then follow the reader's
   * remote-content consent for it (banner, "load once", sender permission).
   * Without it (thread notes) each panel can load its images once.
   */
  message?: { accountId: string; id: string; senderKey?: string | null };
};

export default function MarkdownPanel({ body, fontScale = 1, message }: MarkdownPanelProps) {
  const setLinkPreviewUrl = useMessageLinkPreview();
  const source = useMemo(() => normalizeMarkdownBody(body ?? ""), [body]);
  const remote = useRemoteContent(message?.accountId, message?.senderKey, message?.id ?? source);
  const hasRemoteImages = useMemo(() => hasRemoteMarkdownImages(source), [source]);

  useEffect(() => () => setLinkPreviewUrl(null), [setLinkPreviewUrl]);

  return (
    <>
      {message && hasRemoteImages && !remote.allowed && <RemoteContentBanner remote={remote} />}
      <div
        className="markdown-view"
        style={{
          fontSize: `${15 * fontScale}px`
        }}
      >
        <MarkdownContent
          source={source}
          remoteImagesAllowed={remote.allowed}
          onLoadRemoteImages={remote.loadOnce}
          onLinkPreview={setLinkPreviewUrl}
        />
      </div>
    </>
  );
}
