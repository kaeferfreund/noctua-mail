"use client";

import { Monitor, Moon, RefreshCw, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "@/app/components/ui/button";
import { SidebarTrigger } from "@/app/components/ui/sidebar";
import { Separator } from "@/app/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuTrigger
} from "@/app/components/ui/dropdown-menu";
import ShellSearch, { type ShellSearchProps } from "./ShellSearch";

export type ShellHeaderProps = {
  title: string;
  search: ShellSearchProps;
  sync: { isSyncing: boolean; onCheckNewMail: () => void };
};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Theme" title="Theme">
          <Icon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light"><Sun />Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark"><Moon />Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system"><Monitor />System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ShellHeader({ title, search, sync }: ShellHeaderProps) {
  const syncLabel = sync.isSyncing ? "Checking for new mail" : "Check for new mail";
  return (
    <header data-slot="shell-header" className="flex h-(--header-height) shrink-0 items-center gap-2 border-b px-4 lg:px-6">
      <SidebarTrigger className="-ml-1" aria-label="Toggle sidebar" />
      <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
      <h1 className="m-0 min-w-0 truncate text-sm font-medium tracking-tight" title={title}>{title}</h1>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <div className="w-64 min-w-0 xl:w-80"><ShellSearch {...search} /></div>
        <Button variant="ghost" size="icon-sm" aria-label={syncLabel} title={syncLabel}
          aria-busy={sync.isSyncing} disabled={sync.isSyncing} onClick={sync.onCheckNewMail}>
          <RefreshCw className={cn(sync.isSyncing && "animate-spin")} />
        </Button>
        <ThemeToggle />
      </div>
    </header>
  );
}
