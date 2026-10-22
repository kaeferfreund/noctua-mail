"use client";

import { useCallback, useState } from "react";
import type React from "react";
import { Button } from "@radix-ui/themes";
import { ArrowLeft } from "lucide-react";
import { useMobileBack } from "@/app/components/shell/MobileNavigation";
import { MessageLinkPreviewProvider } from "./MessageLinkPreviewContext";
import styles from "./MessageViewPane.module.css";

type MessageViewPaneProps = {
  children: React.ReactNode;
  header?: React.ReactNode;
};

export default function MessageViewPane({ children, header }: MessageViewPaneProps) {
  const back = useMobileBack();
  const [linkPreviewUrl, setLinkPreviewUrl] = useState<string | null>(null);
  const handleLinkPreviewChange = useCallback((nextValue: string | null) => {
    setLinkPreviewUrl((currentValue) => (currentValue === nextValue ? currentValue : nextValue));
  }, []);

  return (
    <section className={styles.pane}>
      {back ? <div className={styles.mobileHeader}><Button variant="ghost" onClick={back} aria-label="Back to messages"><ArrowLeft size={18} />Back</Button></div> : null}
      {header && <div className={styles.threadHeader}>{header}</div>}
      <div className={styles.threadViewShell}>
        <MessageLinkPreviewProvider value={handleLinkPreviewChange}>
          <div
            className={styles.threadView}
            onMouseLeave={() => handleLinkPreviewChange(null)}
          >
            {children}
          </div>
        </MessageLinkPreviewProvider>
        {linkPreviewUrl ? (
          <div className={styles.linkPreviewOverlay} title={linkPreviewUrl}>
            {linkPreviewUrl}
          </div>
        ) : null}
      </div>
    </section>
  );
}
