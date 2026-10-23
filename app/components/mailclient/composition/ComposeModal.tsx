import { useSenderMessages } from "@/lib/i18n/useSenderMessages";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Dock, ExternalLink, X } from "lucide-react";
import { MinusIcon } from "@radix-ui/react-icons";
import ComposeFields from "./ComposeFields";
import ComposeActions from "./ComposeActions";
import { Heading, Text, Theme } from "@radix-ui/themes";
import { useComposeContext } from "./ComposeContext";
import styles from "./Compose.module.css";
import TooltipIconButton from "@/app/components/TooltipIconButton";

type ComposeModalProps = {
  open: boolean;
  isMobile?: boolean;
};

function revealFocusedEditor(area: HTMLDivElement, target: EventTarget | null) {
  // Tall/desktop layouts use display: contents. At short heights reveal the
  // entire input, since native contenteditable focus may expose only its caret.
  if (area.clientHeight > 0 && target instanceof HTMLElement && area.contains(target) && target.matches('[data-lexical-editor="true"]')) {
    target.scrollIntoView({ block: "end" });
  }
}

function ComposeScrollArea({ children }: { children: ReactNode }) {
  const areaRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    // A keyboard can shrink the viewport while the editor already has focus.
    const observer = new ResizeObserver(() => revealFocusedEditor(area, document.activeElement));
    observer.observe(area);
    return () => observer.disconnect();
  }, []);
  return <div className={styles.composeScrollArea} ref={areaRef}
    onFocusCapture={event => revealFocusedEditor(event.currentTarget, event.target)}>{children}</div>;
}

export default function ComposeModal({ open, isMobile = false }: ComposeModalProps) {
  const {
    composeMode,
    composeTo,
    composeCc,
    composeBcc,
    composeSubject,
    composeShowBcc,
    composeOpenedAt,
    activeAccountId,
    deliveredWarnings,
    composeDraftId,
    composeOpen,
    composeFieldsReset,
    canSaveDraft,
    attachmentLoadState,
    draftSaving,
    draftSaveError,
    draftSavedAt,
    sendingMail,
    discardingDraft,
    composeDragActive,
    detachedWindow,
    fromValue,
    identities, identityId, identityDisabled, sendDisabled, senderMessage, onSenderRetry, onIdentityChange,
    composeSize,
    inReplyToMessage,
    composeModalRef,
    composeResizeRef,
    setComposeTo,
    setComposeCc,
    setComposeBcc,
    setComposeSubject,
    setComposeShowBcc,
    setComposeOpen,
    setComposeView,
    setComposeResizing,
    handleSendMail,
    handleDiscardDraft,
    handleSaveDraft,
    applyRecipientSelection,
    loadRecipientOptions,
    markComposeDirty,
    popInCompose,
    minimizeCompose,
    openComposeInNewWindow,
    closeDetachedCompose,
    detachingCompose,
    jumpToMessage,
    getComposeToken,
    formatRelativeTime,
    handleComposeDragEnter,
    handleComposeDragLeave,
    handleComposeDragOver,
    handleComposeDrop,
    composeMessageField
  } = useComposeContext();

  const { messages: senderMessages, resolve } = useSenderMessages();
  const returnFocusRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (open) returnFocusRef.current = document.activeElement as HTMLElement | null;
  }, [open]);

  if (!open) return null;

  const composeTitle =
    composeMode === "edit"
      ? "Edit draft"
      : composeMode === "editAsNew"
        ? "Edit as New"
        : composeMode === "reply"
          ? "Reply"
          : composeMode === "replyAll"
            ? "Reply All"
            : composeMode === "forward"
              ? "Forward"
              : "New message";

  const close = () => {
    if (!detachedWindow) setComposeOpen(false);
    setComposeView("inline");
  };
  const heading = <Heading size="5" weight="bold" className={styles.composeTitle}>{composeTitle}</Heading>;
  const modal = (
      <div
        className={`${styles.composeModal} ${discardingDraft ? styles.disabled : ""} ${
          composeDragActive ? styles.composeDropActive : ""
        }`}
        ref={composeModalRef}
        style={isMobile ? undefined : {
          width: composeSize.width,
          height: composeSize.height ?? "85dvh"
        }}
        onClick={(event) => event.stopPropagation()}
        onDragEnter={handleComposeDragEnter}
        onDragLeave={handleComposeDragLeave}
        onDragOver={handleComposeDragOver}
        onDrop={handleComposeDrop}
      >
        <div className={styles.composeHeader}>
          <div className={styles.composeHeaderText}>
            <DialogPrimitive.Title asChild>{heading}</DialogPrimitive.Title>
            <Text size="2" color="gray" className={styles.composeSubtitle} title={resolve("Compose.fromValue", { sender: fromValue })}>
              {resolve("Compose.fromValue", { sender: fromValue })}
            </Text>
          </div>
          <div className={styles.composeHeaderActions}>
            {!isMobile && <TooltipIconButton
              variant="ghost"
              size="2"
              tooltip="Dock in thread view"
              onClick={popInCompose}
              disabled={detachingCompose || sendingMail || discardingDraft}
            >
              <Dock size={16} />
            </TooltipIconButton>}
            {!isMobile && !detachedWindow && (
              <>
                <TooltipIconButton
                  variant="ghost"
                  size="2"
                  tooltip="Open in new window"
                  aria-label="Open composer in new window"
                  onClick={openComposeInNewWindow}
                  disabled={detachingCompose || sendingMail || discardingDraft}
                >
                  <ExternalLink size={16} />
                </TooltipIconButton>
                <TooltipIconButton
                  variant="ghost"
                  size="2"
                  tooltip="Minimize composer"
                  onClick={minimizeCompose}
                  disabled={detachingCompose}
                >
                  <MinusIcon width={16} height={16} />
                </TooltipIconButton>
              </>
            )}
            <TooltipIconButton
              variant="ghost"
              size="2"
              tooltip={senderMessages.closeComposer}
              disabled={detachingCompose}
              onClick={close}
            >
              <X size={16} />
            </TooltipIconButton>
          </div>
        </div>
        <ComposeScrollArea>
          {!deliveredWarnings?.length && <div className={styles.composeBody}>
            <ComposeFields
              key={`modal-fields-${composeFieldsReset}`}
              variant="modal"
              composeSubject={composeSubject}
              composeTo={composeTo}
              composeCc={composeCc}
              composeBcc={composeBcc}
              composeShowBcc={composeShowBcc}
              composeOpenedAt={composeOpenedAt}
              activeAccountId={activeAccountId}
              fromValue={fromValue}
              identities={identities} identityId={identityId} identityDisabled={identityDisabled} senderMessage={senderMessage} onSenderRetry={onSenderRetry} onIdentityChange={onIdentityChange}
              inReplyToMessage={inReplyToMessage}
              onJumpToMessage={jumpToMessage}
              setComposeSubject={setComposeSubject}
              setComposeTo={setComposeTo}
              setComposeCc={setComposeCc}
              setComposeBcc={setComposeBcc}
              setComposeShowBcc={setComposeShowBcc}
              applyRecipientSelection={applyRecipientSelection}
              loadRecipientOptions={loadRecipientOptions}
              getComposeToken={getComposeToken}
              markComposeDirty={markComposeDirty}
            />
            {composeMessageField}
          </div>}
          <ComposeActions
            deliveredWarnings={deliveredWarnings}
            composeDraftId={composeDraftId}
            composeOpen={composeOpen}
            canSaveDraft={canSaveDraft}
            draftSaving={draftSaving}
            draftSaveError={draftSaveError}
            draftSavedAt={draftSavedAt}
            sendingMail={sendingMail}
            discardingDraft={discardingDraft}
            busy={detachingCompose}
            attachmentLoadState={attachmentLoadState}
            handleDiscardDraft={handleDiscardDraft}
            handleSaveDraft={handleSaveDraft}
            handleCancel={() => {
              if (detachedWindow) {
                closeDetachedCompose();
                return;
              }
              setComposeOpen(false);
              setComposeView("inline");
            }}
            handleSendMail={handleSendMail}
            sendDisabled={sendDisabled}
            formatRelativeTime={formatRelativeTime}
          />
        </ComposeScrollArea>
        {!isMobile && <div
          className={styles.composeResizer}
          onPointerDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
            try {
              event.currentTarget.setPointerCapture(event.pointerId);
            } catch {
              // ignore if capture fails
            }
            const rect = composeModalRef.current?.getBoundingClientRect();
            const startWidth = rect?.width ?? composeSize.width;
            const startHeight = rect?.height ?? (composeSize.height ?? window.innerHeight * 0.85);
            composeResizeRef.current = {
              startX: event.clientX,
              startY: event.clientY,
              startWidth,
              startHeight
            };
            setComposeResizing(true);
          }}
        />}
      </div>
  );
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => { if (!next && !detachingCompose) close(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className={`modal-backdrop ${styles.composeBackdrop}`} />
        <Theme asChild>
          <DialogPrimitive.Content asChild aria-modal="true" aria-describedby={undefined}
            onEscapeKeyDown={(event) => { if (detachingCompose) event.preventDefault(); }}
            onCloseAutoFocus={(event) => {
              // Responsive navigation and inline compose openers may unmount.
              // Restore to the persistent compose/navigation action in that case.
              const opener = returnFocusRef.current;
              const target = opener?.isConnected && opener !== document.body
                ? opener
                : document.querySelector<HTMLButtonElement>(isMobile
                  ? 'button[data-shell-action="toggle-sidebar"]'
                  : 'button[data-shell-action="compose"], button[data-shell-action="toggle-sidebar"]');
              if (target) {
                event.preventDefault();
                target.focus();
              }
            }}>
            {modal}
          </DialogPrimitive.Content>
        </Theme>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
