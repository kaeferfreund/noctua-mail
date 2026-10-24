import { ArrowUpRight, ExternalLink } from "lucide-react";
import { useTranslations } from "next-intl";
import { Badge, Card } from "@radix-ui/themes";
import { badgeColors } from "@/lib/ui/badgeColors";
import ComposeFields from "./ComposeFields";
import ComposeActions from "./ComposeActions";
import { useComposeContext } from "./ComposeContext";
import threadStyles from "../message/ThreadMessageCard.module.css";
import styles from "./ComposeInlineCard.module.css";
import composeStyles from "./Compose.module.css";
import TooltipIconButton from "@/app/components/TooltipIconButton";

export default function ComposeInlineCard() {
  const {
    composeMode,
    composeSubject,
    composeTo,
    composeCc,
    composeBcc,
    composeShowBcc,
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
    identities, identityId, identityDisabled, sendDisabled, senderMessage, senderAction, onSenderRetry, onIdentityChange,
    inReplyToMessage,
    popOutCompose,
    openComposeInNewWindow,
    closeDetachedCompose,
    detachingCompose,
    setComposeSubject,
    setComposeTo,
    setComposeCc,
    setComposeBcc,
    setComposeShowBcc,
    setComposeOpen,
    setComposeView,
    handleSendMail,
    handleDiscardDraft,
    handleSaveDraft,
    applyRecipientSelection,
    loadRecipientOptions,
    markComposeDirty,
    jumpToMessage,
    getComposeToken,
    formatRelativeTime,
    handleComposeDragEnter,
    handleComposeDragLeave,
    handleComposeDragOver,
    handleComposeDrop,
    composeMessageField
  } = useComposeContext();

  const t = useTranslations("Compose");
  const composeModeLabel = t(`modes.${composeMode}`);

  return (
    <Card
      asChild
      size="2"
      variant="surface"
      className={`${threadStyles.card} ${styles.card} ${
        discardingDraft ? styles.disabled : ""
      } ${composeDragActive ? composeStyles.composeDropActive : ""}`}
    >
      <article
        className={styles.article}
        onDragEnter={handleComposeDragEnter}
        onDragLeave={handleComposeDragLeave}
        onDragOver={handleComposeDragOver}
        onDrop={handleComposeDrop}
      >
        <div className={threadStyles.header}>
          <div className={threadStyles.topRow}>
            <div className={threadStyles.badges}>
              <Badge size="1" variant="soft" color={badgeColors.compose}>
                {composeModeLabel}
              </Badge>
            </div>
            <div className={threadStyles.actions}>
              <TooltipIconButton
                variant="ghost"
                size="2"
                tooltip={t("window.openInModal")}
                onClick={popOutCompose}
              >
                <ArrowUpRight size={14} />
              </TooltipIconButton>
              {!detachedWindow && (
                <TooltipIconButton
                  variant="ghost"
                  size="2"
                  tooltip={t("window.openInNewWindow")}
                  aria-label={t("window.openComposerInNewWindow")}
                  onClick={openComposeInNewWindow}
                  disabled={detachingCompose || sendingMail || discardingDraft}
                >
                  <ExternalLink size={14} />
                </TooltipIconButton>
              )}
            </div>
          </div>
          {!deliveredWarnings?.length && <div className={`${threadStyles.info} ${styles.info}`}>
            <ComposeFields
              key={`inline-fields-${composeFieldsReset}`}
              variant="inline"
              composeSubject={composeSubject}
              composeTo={composeTo}
              composeCc={composeCc}
              composeBcc={composeBcc}
              composeShowBcc={composeShowBcc}
              activeAccountId={activeAccountId}
              fromValue={fromValue}
              identities={identities} identityId={identityId} identityDisabled={identityDisabled} senderMessage={senderMessage} senderAction={senderAction} onSenderRetry={onSenderRetry} onIdentityChange={onIdentityChange}
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
          </div>}
        </div>
        {!deliveredWarnings?.length && <div className={`${composeStyles.composeBody} ${styles.body}`}>{composeMessageField}</div>}
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
      </article>
    </Card>
  );
}
