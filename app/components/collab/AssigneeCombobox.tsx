"use client";
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
  const [open, setOpen] = useState(false);
  const choices = [
    { id: null, label: "Unassigned", search: "Unassigned" },
    ...(me && members.some((m) => m.userId === me && !m.disabled)
      ? [{ id: me, label: "Me", search: "Me" }]
      : []),
    ...members
      .filter((m) => !m.disabled)
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
          aria-label="Assignee"
          aria-expanded={open}
          disabled={disabled}
          className="max-w-48 min-w-0"
        >
          <span className="truncate">
            {value ? memberName(members, value) : "Unassigned"}
          </span>
          <ChevronsUpDown className="size-3 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 max-w-[calc(100vw-2rem)]">
        <Command>
          <CommandInput
            placeholder="Search members…"
            aria-label="Search members"
          />
          <CommandList>
            <CommandEmpty>No members found.</CommandEmpty>
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
