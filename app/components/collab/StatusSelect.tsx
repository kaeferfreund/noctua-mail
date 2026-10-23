"use client";

import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { THREAD_STATUSES, STATUS_STYLES, type ThreadStatus } from "./types";
export default function StatusSelect({
  value,
  disabled,
  onChange,
}: {
  value: ThreadStatus;
  disabled?: boolean;
  onChange: (value: ThreadStatus) => void;
}) {
  const t = useTranslations("Collaboration");
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as ThreadStatus)}
      disabled={disabled}
    >
      <SelectTrigger
        size="sm"
        aria-label={t("status.label")}
        style={STATUS_STYLES[value]}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {THREAD_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {t(`status.${status}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
