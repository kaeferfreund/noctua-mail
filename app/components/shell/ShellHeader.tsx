"use client";

import { useIsMobile } from "@/app/hooks/use-mobile";
import { useSyncExternalStore, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Monitor, Moon, RefreshCw, Search, Sun } from "lucide-react";
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
  indicators?: ReactNode;
  title: string;
  search: ShellSearchProps;
  sync: { isSyncing: boolean; onCheckNewMail: () => void };
};

const subscribeMounted = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeMounted, () => true, () => false);
  const currentTheme = mounted ? theme : undefined;
  const Icon = currentTheme === "light" ? Sun : currentTheme === "dark" ? Moon : Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Theme" title="Theme">
          <span aria-hidden="true" style={{ visibility: mounted ? "visible" : "hidden", display: "contents" }}><Icon /></span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={currentTheme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light"><Sun />Light</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark"><Moon />Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system"><Monitor />System</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ShellHeader({ title, search, sync, indicators }: ShellHeaderProps) {
  const isMobile = useIsMobile();
  const syncLabel = sync.isSyncing ? "Checking for new mail" : "Check for new mail";
  return (
    <header data-slot="shell-header" className="flex h-(--header-height) shrink-0 items-center gap-2 border-b px-4 lg:px-6">
      <SidebarTrigger className="-ml-1 size-11 md:size-7" aria-label="Toggle sidebar" />
      <Separator orientation="vertical" className="mx-1 hidden md:block data-[orientation=vertical]:h-4" />
      <h1 className="m-0 min-w-0 truncate text-sm font-medium tracking-tight" title={title}>{title}</h1>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        {!isMobile ? <div className="hidden w-64 min-w-0 md:block xl:w-80"><ShellSearch {...search} /></div> : null}
        {isMobile ? <div className="md:hidden"><Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" aria-label="Search messages"><Search /></Button></PopoverTrigger>
          <PopoverContent align="end" className="w-[calc(100dvw-16px)] max-w-96"><ShellSearch {...search} /></PopoverContent>
        </Popover></div> : null}
        {indicators}
        <Button className="hidden md:inline-flex" variant="ghost" size="icon-sm" aria-label={syncLabel} title={syncLabel}
          aria-busy={sync.isSyncing} disabled={sync.isSyncing} onClick={sync.onCheckNewMail}>
          <RefreshCw className={cn(sync.isSyncing && "animate-spin")} />
        </Button>
        <div className="hidden md:block"><ThemeToggle /></div>
      </div>
    </header>
  );
}
