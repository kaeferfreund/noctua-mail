"use client";

import { useTranslations } from "next-intl";
import { Button, Dialog, Flex, Select, Switch, Text } from "@radix-ui/themes";
import type { CalendarParticipationScope, CalendarParticipationStatus } from "@/lib/data";
import styles from "./EventDetailView.module.css";

export type EventResponseDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  timeRange: string;
  responseTargetLabel: string;
  organizer?: string;
  draftPartstat: CalendarParticipationStatus;
  onDraftPartstatChange: (value: CalendarParticipationStatus) => void;
  draftScope: CalendarParticipationScope;
  onDraftScopeChange: (value: CalendarParticipationScope) => void;
  canChooseOccurrenceScope: boolean;
  responseOccurrenceLabel: string;
  sendReply: boolean;
  onSendReplyChange: (value: boolean) => void;
  replyRequested?: boolean;
  submittingResponse: boolean;
  onSubmit: () => void | Promise<void>;
  isReplyChoice: (status: CalendarParticipationStatus) => boolean;
};

/**
 * Modal that captures an attendee's RSVP choice, whether the RSVP applies to a
 * single occurrence or the whole series, and whether the organizer should be
 * emailed a reply. All decision state is lifted to the parent so the dialog is
 * fully controlled.
 */
export default function EventResponseDialog({
  open,
  onOpenChange,
  title,
  timeRange,
  responseTargetLabel,
  organizer,
  draftPartstat,
  onDraftPartstatChange,
  draftScope,
  onDraftScopeChange,
  canChooseOccurrenceScope,
  responseOccurrenceLabel,
  sendReply,
  onSendReplyChange,
  replyRequested,
  submittingResponse,
  onSubmit,
  isReplyChoice
}: EventResponseDialogProps) {
  const t = useTranslations("Calendar.responseDialog");
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !submittingResponse) onOpenChange(false);
      }}
    >
      <Dialog.Content size="2" className={styles.responseDialog}>
        <Flex direction="column" gap="3">
          <Dialog.Title size="4">{t("title")}</Dialog.Title>

          <div className={styles.responseSummary}>
            <Dialog.Description size="2" weight="medium">{title || t("untitled")}</Dialog.Description>
            {timeRange && (
              <Text size="1" color="gray">{responseTargetLabel}</Text>
            )}
            {organizer && (
              <Text size="1" color="gray">{t("organizer", { organizer })}</Text>
            )}
          </div>

          <Flex direction="column" gap="2">
            <Text size="2" weight="medium">{t("yourResponse")}</Text>
            <Flex gap="2" wrap="wrap">
              <Button
                size="1"
                variant={draftPartstat === "ACCEPTED" ? "solid" : "soft"}
                color="green"
                onClick={() => onDraftPartstatChange("ACCEPTED")}
              >
                {t("accept")}
              </Button>
              <Button
                size="1"
                variant={draftPartstat === "TENTATIVE" ? "solid" : "soft"}
                color="orange"
                onClick={() => onDraftPartstatChange("TENTATIVE")}
              >
                {t("tentative")}
              </Button>
              <Button
                size="1"
                variant={draftPartstat === "DECLINED" ? "solid" : "soft"}
                color="red"
                onClick={() => onDraftPartstatChange("DECLINED")}
              >
                {t("decline")}
              </Button>
            </Flex>
          </Flex>

          {canChooseOccurrenceScope && (
            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">{t("applyTo")}</Text>
              <Select.Root
                value={draftScope}
                onValueChange={(value) => onDraftScopeChange(value as CalendarParticipationScope)}
              >
                <Select.Trigger />
                <Select.Content position="popper">
                  <Select.Item value="occurrence">{responseOccurrenceLabel}</Select.Item>
                  <Select.Item value="series">{t("wholeSeries")}</Select.Item>
                </Select.Content>
              </Select.Root>
            </Flex>
          )}

          <Flex direction="column" gap="2">
            <Text size="2" weight="medium">{t("notifyOrganizer")}</Text>
            <Flex align="center" justify="between" gap="3" className={styles.responseToggleRow}>
              <div className={styles.responseToggleText}>
                <Text size="2">{t("sendReply")}</Text>
                {replyRequested === false && (
                  <Text size="1" color="gray">{t("replyNotRequested")}</Text>
                )}
              </div>
              <Switch
                checked={sendReply}
                onCheckedChange={onSendReplyChange}
                disabled={submittingResponse}
                aria-label={t("sendReplyLabel")}
              />
            </Flex>
          </Flex>

          <Flex justify="end" gap="2">
            <Button
              variant="soft"
              color="gray"
              disabled={submittingResponse}
              onClick={() => onOpenChange(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              disabled={submittingResponse || !isReplyChoice(draftPartstat)}
              onClick={() => void onSubmit()}
            >
              {submittingResponse
                ? t("saving")
                : t(sendReply ? "submitAndSend" : "submitWithoutSending", { status: draftPartstat })}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
