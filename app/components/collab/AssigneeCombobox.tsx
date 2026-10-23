"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/app/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandItem,
} from "@/app/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { memberName, type CollabMember } from "./types";
export default function AssigneeCombobox({
  value,
  members,
  me,
  disabled,
  onChange,
}: {
  value: string | null;
  members: CollabMember[];
  me: string | null;
  disabled?: boolean;
  onChange: (id: string | null) => void;
}) {
  const t = useTranslations("Collaboration");
  const [open, setOpen] = useState(false);
  const active = members.filter((m) => !m.disabled);
  const self = active.find((m) => m.userId === me);
  // The current user is listed once, first, as "Me (name)".
  const choices = [
    { id: null, label: t("assignee.unassigned"), search: t("assignee.unassigned") },
    ...(self
      ? [{
          id: self.userId,
          label: t("assignee.meNamed", { name: self.name || self.email }),
          search: `${t("assignee.me")} ${self.name} ${self.email} ${self.userId}`,
        }]
      : []),
    ...active
      .filter((m) => m !== self)
      .map((m) => ({
        id: m.userId,
        label: m.name || m.email,
        search: `${m.name} ${m.email} ${m.userId}`,
      })),
  ];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-label={t("assignee.label")}
          aria-expanded={open}
          disabled={disabled}
          className="max-w-48 min-w-0"
        >
          <span className="truncate">
            {value ? memberName(members, value, t("formerMember")) : t("assignee.unassigned")}
          </span>
          <ChevronsUpDown className="size-3 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 max-w-[calc(100vw-2rem)]">
        <Command>
          <CommandInput
            placeholder={t("assignee.searchPlaceholder")}
            aria-label={t("assignee.search")}
          />
          <CommandList>
            <CommandEmpty>{t("assignee.noMembers")}</CommandEmpty>
            {choices.map((choice, i) => (
              <CommandItem
                key={i}
                value={choice.search}
                onSelect={() => {
                  onChange(choice.id);
                  setOpen(false);
                }}
              >
                {choice.label}
                {value === choice.id && <Check className="ml-auto size-3" />}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
