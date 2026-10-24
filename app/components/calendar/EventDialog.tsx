"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Dialog, Flex, Text, TextArea, TextField } from "@radix-ui/themes";
import { Trash2 } from "lucide-react";
import {
  buildAccountCalendarEventPath,
  buildAccountCalendarEventsPath
} from "@/lib/accountApiPaths";
import type { CalendarEvent } from "@/lib/data";
import {
  inviteInputToMs,
  msToDateLocal,
  msToDateTimeLocal,
  parseLocalScheduleDate,
  recurrenceOptionToRRule,
  rruleToOption,
  shiftEndPreservingDuration,
  type RecurrenceOption
} from "@/lib/composeInvite";
import { useDialogFocusRestore } from "@/app/components/ui/dialogFocus";
import DialogTitleBar from "@/app/components/mailclient/message/DialogTitleBar";
import CalendarEventScheduleFields from "./CalendarEventScheduleFields";

type Props = {
  open: boolean;
  accountId: string;
  event?: Partial<CalendarEvent>;
  defaultStart?: Date;
  defaultEnd?: Date;
  defaultAllDay?: boolean;
  onClose: () => void;
  onSaved?: (event: CalendarEvent) => void;
  onDeleted?: (eventId: string) => void;
};

export default function EventDialog({
  open,
  accountId,
  event,
  defaultStart,
  defaultEnd,
  defaultAllDay,
  onClose,
  onSaved,
  onDeleted
}: Props) {
  const t = useTranslations("Calendar.eventDialog");
  const isEditing = Boolean(event?.id);
  const titleRef = useRef<HTMLInputElement>(null);
  const focusRestore = useDialogFocusRestore();
  const [summary, setSummary] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [startValue, setStartValue] = useState("");
  const [endValue, setEndValue] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceOption>("none");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    const now = defaultStart ?? new Date();
    const end = defaultEnd ?? new Date(now.getTime() + 60 * 60 * 1000);
    const isAllDay = defaultAllDay ?? false;
    setSummary(event?.summary ?? "");
    setDescription(event?.description ?? "");
    setLocation(event?.location ?? "");
    setAllDay(event?.allDay ?? isAllDay);
    setRecurrence(rruleToOption(event?.recurrenceRule));
    setError("");
    if (event?.startAtMs) {
      setStartValue(isAllDay || event.allDay
        ? msToDateLocal(event.startAtMs)
        : msToDateTimeLocal(event.startAtMs));
      setEndValue(event.endAtMs
        ? (isAllDay || event.allDay ? msToDateLocal(event.endAtMs) : msToDateTimeLocal(event.endAtMs))
        : "");
    } else {
      setStartValue(isAllDay ? msToDateLocal(now.getTime()) : msToDateTimeLocal(now.getTime()));
      setEndValue(isAllDay ? msToDateLocal(end.getTime()) : msToDateTimeLocal(end.getTime()));
    }
  }, [open, event, defaultStart, defaultEnd, defaultAllDay]);

  const handleSave = async () => {
    if (!summary.trim()) {
      setError(t("titleRequired"));
      return;
    }
    const startMs = startValue ? inviteInputToMs(startValue, allDay) : Date.now();
    const endMs = endValue ? inviteInputToMs(endValue, allDay) : undefined;
    // monthly-by-day needs the start date to derive its BYDAY ordinal; without
    // it the helper silently downgrades to FREQ=MONTHLY and the user's
    // "Monthly on the Nth weekday" choice is lost on save.
    const rrule =
      recurrenceOptionToRRule(recurrence, parseLocalScheduleDate(startValue)) || undefined;

    setSaving(true);
    setError("");
    try {
      const url = isEditing
        ? buildAccountCalendarEventPath(accountId, event!.id!)
        : buildAccountCalendarEventsPath(accountId);
      const method = isEditing ? "PUT" : "POST";
      const body = {
        id: event?.id,
        eventUid: event?.eventUid,
        summary: summary.trim(),
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        startAtMs: startMs,
        endAtMs: endMs,
        allDay,
        recurrenceRule: rrule,
        sourceType: event?.sourceType ?? "local"
      };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = (await res.json()) as { ok: boolean; event?: CalendarEvent; message?: string };
      if (!res.ok || !data.ok) {
        setError(data.message ?? t("saveFailed"));
        return;
      }
      if (data.event) onSaved?.(data.event);
      onClose();
    } catch {
      setError(t("saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing || !event?.id) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(buildAccountCalendarEventsPath(accountId), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: event.id })
      });
      if (!res.ok) {
        setError(t("deleteFailed"));
        return;
      }
      onDeleted?.(event.id);
      onClose();
    } catch {
      setError(t("deleteFailed"));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Content size="3" style={{ maxWidth: 520 }} aria-describedby={undefined}
        onOpenAutoFocus={event => {
          focusRestore.onOpenAutoFocus();
          event.preventDefault();
          titleRef.current?.focus();
        }}
        onCloseAutoFocus={focusRestore.onCloseAutoFocus}>
        <Flex direction="column" gap="3">
          <DialogTitleBar
            title={isEditing ? t("editTitle") : t("newTitle")}
            onClose={onClose}
          />

          <Flex direction="column" gap="2">
            <TextField.Root
              placeholder={t("titlePlaceholder")}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              ref={titleRef}
            />
          </Flex>

          <CalendarEventScheduleFields
            startValue={startValue}
            endValue={endValue}
            allDay={allDay}
            recurrenceRule={recurrenceOptionToRRule(recurrence, parseLocalScheduleDate(startValue))}
            location={location}
            disabled={saving || deleting}
            onStartValueChange={(value) => {
              // Slide the end alongside the start so duration is preserved.
              // Editing the end directly (below) is the only way to change duration.
              //
              // Skip the duration-shift when the new value's shape (date-only
              // vs date+time) contradicts the current `allDay` closure — that
              // happens when the All-day toggle just flipped and queued
              // setAllDay; the toggle handler will overwrite endValue itself.
              const nextHasTime = value.includes("T");
              const shapeMatchesAllDay = nextHasTime === !allDay;
              if (!shapeMatchesAllDay) {
                setStartValue(value);
                return;
              }
              const nextEnd = shiftEndPreservingDuration(startValue, value, endValue, allDay);
              setStartValue(value);
              if (nextEnd !== endValue) setEndValue(nextEnd);
            }}
            onEndValueChange={setEndValue}
            onAllDayChange={setAllDay}
            onRecurrenceRuleChange={(value) => setRecurrence(rruleToOption(value))}
            onLocationChange={setLocation}
          />

          <Flex direction="column" gap="1">
            <Text size="1" color="gray">{t("description")}</Text>
            <TextArea
              placeholder={t("descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </Flex>

          {error && <Text size="1" color="red">{error}</Text>}

          <Flex justify="between" align="center" gap="2" wrap="wrap">
            {isEditing &&
            (event?.sourceType === "local" ||
              event?.sourceType === "caldav" ||
              event?.sourceType === "sent-invite") ? (
              <Button
                size="2"
                variant="soft"
                color="red"
                onClick={handleDelete}
                disabled={deleting || saving}
              >
                <Trash2 size={14} />
                {t("delete")}
              </Button>
            ) : (
              <span />
            )}
            <Flex gap="2">
              <Button size="2" variant="soft" color="gray" onClick={onClose} disabled={saving || deleting}>
                {t("cancel")}
              </Button>
              <Button size="2" onClick={handleSave} disabled={saving || deleting || !summary.trim()}>
                {saving ? t("saving") : isEditing ? t("save") : t("create")}
              </Button>
            </Flex>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
