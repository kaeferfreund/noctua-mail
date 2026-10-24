"use client";

import { useTranslations } from "next-intl";
import { Button, Dialog, Flex, Select, Text } from "@radix-ui/themes";
import {
  CALENDAR_REMINDER_LEAD_OPTIONS,
  type CalendarReminder
} from "@/app/components/mailclient/utils/calendarReminders";
import { reminderLeadUnit } from "@/app/components/mailclient/status/upcomingEntries";
import styles from "./EventDetailView.module.css";

export type EventReminderDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  existingReminder: CalendarReminder | null;
  leadOptionValue: string;
  onLeadOptionChange: (value: string) => void;
  onSchedule: () => void | Promise<void>;
  savingReminder: boolean;
};

/**
 * Modal used to schedule a new reminder or modify an existing one. The caller
 * owns all state (lead option, saving flag, existing reminder) so that the
 * parent can keep a single source of truth for reminder persistence.
 */
export default function EventReminderDialog({
  open,
  onOpenChange,
  title,
  existingReminder,
  leadOptionValue,
  onLeadOptionChange,
  onSchedule,
  savingReminder
}: EventReminderDialogProps) {
  const t = useTranslations("Calendar.reminderDialog");
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next && !savingReminder) onOpenChange(false);
      }}
    >
      <Dialog.Content size="2" className={styles.reminderDialog}>
        <Flex direction="column" gap="3">
          <Dialog.Title size="4">{existingReminder ? t("modifyTitle") : t("scheduleTitle")}</Dialog.Title>
          <Dialog.Description size="2" color="gray">{title || t("untitled")}</Dialog.Description>
          {existingReminder && (
            <Text size="2" color="gray">
              {t("current", reminderLeadUnit(existingReminder.leadMinutes))}
            </Text>
          )}
          <Flex direction="column" gap="2">
            <Text size="2" weight="medium">{t("notifyMe")}</Text>
            <Select.Root value={leadOptionValue} onValueChange={onLeadOptionChange}>
              <Select.Trigger />
              <Select.Content position="popper">
                {CALENDAR_REMINDER_LEAD_OPTIONS.map((opt) => (
                  <Select.Item key={opt.value} value={opt.value}>{t("lead", reminderLeadUnit(opt.minutes))}</Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Flex>
          <Flex justify="end" gap="2">
            <Button variant="soft" color="gray" onClick={() => onOpenChange(false)} disabled={savingReminder}>
              {t("cancel")}
            </Button>
            <Button onClick={() => void onSchedule()} disabled={savingReminder}>
              {savingReminder ? t("saving") : existingReminder ? t("update") : t("schedule")}
            </Button>
          </Flex>
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
