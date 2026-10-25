import { useTranslations } from "next-intl";
import SendWarnings from "./SendWarnings";
import DraftSavedLabel from "./DraftSavedLabel";
import { Button, Text } from "@radix-ui/themes";
import styles from "./Compose.module.css";

type ComposeActionsProps = {
  deliveredWarnings?: string[];
  sendDisabled?: boolean;
  composeDraftId: string | null;
  composeOpen: boolean;
  canSaveDraft: boolean;
  draftSaving: boolean;
  draftSaveError: string | null;
  draftSavedAt: number | null;
  sendingMail: boolean;
  discardingDraft: boolean;
  busy?: boolean;
  attachmentLoadState?: "loading" | "error" | null;
  handleDiscardDraft: () => void;
  handleSaveDraft: () => void;
  handleCancel: () => void;
  handleSendMail: () => void;
  formatRelativeTime: (timestamp: number | null) => string;
};

export default function ComposeActions({
  deliveredWarnings = [],
  sendDisabled = false,
  composeDraftId,
  composeOpen,
  canSaveDraft,
  draftSaving,
  draftSaveError,
  draftSavedAt,
  sendingMail,
  discardingDraft,
  busy = false,
  attachmentLoadState = null,
  handleDiscardDraft,
  handleSaveDraft,
  handleCancel,
  handleSendMail,
  formatRelativeTime
}: ComposeActionsProps) {
  const t = useTranslations("Compose");
  if (deliveredWarnings.length) return <div className={styles.composeFooter}><SendWarnings warnings={deliveredWarnings} /><Button onClick={handleCancel}>{t("actions.close")}</Button></div>;
  return (
    <div className={styles.composeFooter}>
      <div className={styles.composeDraftMeta}>
        {composeOpen && (
          <Text
            size="1"
            title={composeDraftId ? t("draft.idTitle", { id: composeDraftId }) : undefined}
            className={`${styles.composeDraftStatus} ${
              draftSaveError
                ? styles.composeDraftStatusError
                : draftSaving
                  ? styles.composeDraftStatusSaving
                  : ""
            }`}
          >
            {draftSaving
              ? t("draft.saving")
              : draftSaveError
                ? t("draft.saveFailedStatus")
                : draftSavedAt
                  ? <DraftSavedLabel savedAt={draftSavedAt} formatRelativeTime={formatRelativeTime} />
                  : t("draft.notSavedYet")}
          </Text>
        )}
      </div>
      <div className={styles.composeActions}>
        {composeDraftId && (
          <>
            <Button
              size="2"
              variant="soft"
              color="red"
              onClick={handleDiscardDraft}
              disabled={busy || discardingDraft || draftSaving}
            >
              {t("actions.discardDraft")}
            </Button>
            <Button
              size="2"
              variant="soft"
              color="blue"
              onClick={handleSaveDraft}
              disabled={busy || draftSaving || !canSaveDraft}
              aria-busy={draftSaving || undefined}
            >
              {/* The label keeps its width while saving, so the phone action row
                  does not re-flow; the draft status beside it says "saving". */}
              {t("actions.saveDraft")}
            </Button>
          </>
        )}
        <Button
          size="2"
          variant="soft"
          color="gray"
          onClick={handleCancel}
          disabled={busy || sendingMail || discardingDraft || draftSaving}
        >
          {t("actions.cancel")}
        </Button>
        <Button
          size="2"
          onClick={handleSendMail}
          disabled={sendDisabled || busy || sendingMail || Boolean(attachmentLoadState)}
          title={
            attachmentLoadState === "error"
              ? t("actions.attachmentsFailedTitle")
              : undefined
          }
        >
          {sendingMail
            ? t("actions.sending")
            : attachmentLoadState === "loading"
              ? t("actions.loadingAttachments")
              : t("actions.send")}
        </Button>
      </div>
    </div>
  );
}
