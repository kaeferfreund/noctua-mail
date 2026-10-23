import { useTranslations } from "next-intl";
import React from "react";
import { AlertDialog, Box, Button, Flex, Text } from "@radix-ui/themes";
import type { DeleteConfirmAction, DeleteConfirmState } from "../types";
import type { LinkedCalendarEventDetail } from "../utils/deleteConfirm";
import { formatCalendarEventRange } from "@/lib/calendar";
import type { AccountDateFormat } from "@/lib/data";
import { useAccountDateFormat } from "@/app/components/AccountDateFormatContext";
import AlertDialogContent from "./AlertDialogContent";

interface DeleteConfirmDialogProps {
  deleteConfirm: DeleteConfirmState | null;
  onOpenChange: (open: boolean) => void;
  resolveDeleteConfirm: (action: DeleteConfirmAction) => void;
}

type ReaderTranslator = ReturnType<typeof useTranslations<"Reader">>;

function getDeleteTitle(state: DeleteConfirmState, t: ReaderTranslator) {
  return t(state.permanentDeleteCount > 0 ? "deleteTitle" : "trashTitle", {
    kind: state.kind, count: state.messageCount
  });
}

function getDeleteDescription(state: DeleteConfirmState, t: ReaderTranslator) {
  if (state.permanentDeleteCount > 0 && state.moveToTrashCount > 0) {
    return t("mixedDeleteDescription", { deleted: state.permanentDeleteCount, moved: state.moveToTrashCount });
  }
  return t(state.permanentDeleteCount > 0 ? "deleteDescription" : "trashDescription", {
    kind: state.kind, count: state.permanentDeleteCount || state.messageCount
  });
}

function getCalendarAssociationDescription(state: DeleteConfirmState, t: ReaderTranslator) {
  const hasEvents = state.calendarLinkedEventCount > 0;
  const count = hasEvents ? state.calendarLinkedEventCount : state.calendarLinkedReminderCount;
  if (count === 0 || state.calendarLinkedMessageCount === 0) return null;
  const future = hasEvents ? state.calendarLinkedEventFutureCount : state.calendarLinkedReminderFutureCount;
  const past = hasEvents ? state.calendarLinkedEventPastCount : state.calendarLinkedReminderPastCount;
  return t("calendarAssociation", {
    scope: state.kind === "thread" ? "thread" : state.messageCount === 1 ? "single" : "selection",
    messages: state.calendarLinkedMessageCount, count, item: hasEvents ? "event" : "reminder", future, past,
    timing: future === count ? "future" : past === count ? "past" : future > 0 && past > 0 ? "mixed" : "none"
  });
}

function getDeleteLinkedLabel(state: DeleteConfirmState, t: ReaderTranslator) {
  if (state.calendarLinkedEventCount > 0) return t("deleteEventsMail", { count: state.calendarLinkedEventCount });
  if (state.calendarLinkedReminderCount > 0) return t("deleteRemindersMail", { count: state.calendarLinkedReminderCount });
  return t("deleteMailOnly");
}

function formatLinkedEventRange(event: LinkedCalendarEventDetail, dateFormat?: AccountDateFormat) {
  if (!Number.isFinite(event.occurrenceStartAtMs) || event.occurrenceStartAtMs <= 0) return "";
  return formatCalendarEventRange(
    new Date(event.occurrenceStartAtMs),
    event.occurrenceEndAtMs && event.occurrenceEndAtMs > event.occurrenceStartAtMs
      ? new Date(event.occurrenceEndAtMs)
      : undefined,
    { allDay: event.allDay, startTimeZone: event.startTimezone, dateFormat }
  );
}

function LinkedEventList({
  events,
  dateFormat
}: {
  events: LinkedCalendarEventDetail[];
  dateFormat?: AccountDateFormat;
}) {
  const t = useTranslations("Reader");
  if (events.length === 0) return null;
  return (
    <Box mt="3">
      <Flex direction="column" gap="2">
        {events.map((event) => {
          const rangeLabel = formatLinkedEventRange(event, dateFormat);
          const isNextOccurrence =
            event.isRecurring && event.isFuture && !event.isMessageSpecificOccurrence;
          return (
            <Box key={event.id}>
              <Text as="div" size="2" weight="medium">
                {event.summary}
                {event.isRecurring ? t("recurringSuffix") : ""}
              </Text>
              {rangeLabel ? (
                <Text as="div" size="2" color="gray">
                  {isNextOccurrence ? t("nextRange", { range: rangeLabel }) : rangeLabel}
                </Text>
              ) : null}
              {event.location ? (
                <Text as="div" size="2" color="gray">
                  {event.location}
                </Text>
              ) : null}
            </Box>
          );
        })}
      </Flex>
    </Box>
  );
}

export default function DeleteConfirmDialog({
  deleteConfirm,
  onOpenChange,
  resolveDeleteConfirm
}: DeleteConfirmDialogProps) {
  const t = useTranslations("Reader");
  const accountDateFormat = useAccountDateFormat();
  const calendarDescription =
    deleteConfirm ? getCalendarAssociationDescription(deleteConfirm, t) : null;
  const hasLinkedCalendarItems =
    Boolean(deleteConfirm) &&
    (deleteConfirm!.calendarLinkedReminderCount > 0 || deleteConfirm!.calendarLinkedEventCount > 0);

  return (
    <AlertDialog.Root open={Boolean(deleteConfirm)} onOpenChange={onOpenChange}>
      <AlertDialogContent size="2">
        <AlertDialog.Title size="3">
          {deleteConfirm ? getDeleteTitle(deleteConfirm, t) : t("deleteTitle", { kind: "message", count: 1 })}
        </AlertDialog.Title>
        <AlertDialog.Description>
          {deleteConfirm ? getDeleteDescription(deleteConfirm, t) : t("deleteFallback")}
          {deleteConfirm?.hiddenMessageCount
            ? t("hiddenSelection", { messages: deleteConfirm.hiddenMessageCount, threads: deleteConfirm.collapsedThreadCount ?? 1 })
            : null}
          {calendarDescription ? ` ${calendarDescription}` : null}
        </AlertDialog.Description>
        {deleteConfirm && deleteConfirm.linkedEvents.length > 0 ? (
          <LinkedEventList events={deleteConfirm.linkedEvents} dateFormat={accountDateFormat} />
        ) : null}
        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray" onClick={() => resolveDeleteConfirm("cancel")}>{t("cancel")}</Button>
          </AlertDialog.Cancel>
          {hasLinkedCalendarItems ? (
            <>
              <AlertDialog.Action>
                <Button
                  variant="soft"
                  color="gray"
                  onClick={() => resolveDeleteConfirm("delete_mail_only")}
                >
                  {t("deleteMailOnly")}
                </Button>
              </AlertDialog.Action>
              <AlertDialog.Action>
                <Button
                  color={deleteConfirm && deleteConfirm.permanentDeleteCount > 0 ? "red" : "gray"}
                  variant={deleteConfirm && deleteConfirm.permanentDeleteCount > 0 ? "solid" : "soft"}
                  onClick={() => resolveDeleteConfirm("delete_linked_and_mail")}
                >
                  {deleteConfirm ? getDeleteLinkedLabel(deleteConfirm, t) : t("deleteMailOnly")}
                </Button>
              </AlertDialog.Action>
            </>
          ) : (
            <AlertDialog.Action>
              <Button
                color={deleteConfirm && deleteConfirm.permanentDeleteCount > 0 ? "red" : "gray"}
                variant={deleteConfirm && deleteConfirm.permanentDeleteCount > 0 ? "solid" : "soft"}
                onClick={() => resolveDeleteConfirm("delete_mail_only")}
              >
                {deleteConfirm && deleteConfirm.permanentDeleteCount > 0
                  ? t("deletePermanent")
                  : t("moveTrash")}
              </Button>
            </AlertDialog.Action>
          )}
        </Flex>
      </AlertDialogContent>
    </AlertDialog.Root>
  );
}
