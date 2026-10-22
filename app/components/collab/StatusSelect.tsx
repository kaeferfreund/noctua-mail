"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { STATUS_LABELS, STATUS_STYLES, type ThreadStatus } from "./types";
export default function StatusSelect({
  value,
  disabled,
  onChange,
}: {
  value: ThreadStatus;
  disabled?: boolean;
  onChange: (value: ThreadStatus) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => onChange(v as ThreadStatus)}
      disabled={disabled}
    >
      <SelectTrigger
        size="sm"
        aria-label="Thread status"
        style={STATUS_STYLES[value]}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(STATUS_LABELS).map(([status, label]) => (
          <SelectItem key={status} value={status}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
