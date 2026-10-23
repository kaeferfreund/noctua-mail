"use client";

import { useTranslations } from "next-intl";

import { useIsMobile } from "@/app/hooks/use-mobile";
import { Fragment, useSyncExternalStore, type ReactNode } from "react";
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
  /** A plain title, or path segments (mailbox, folder) joined by a quiet "/". */
  title: string | readonly string[];
  /**
   * Controls for the list under the title (count, view and sort menus). The
   * header is a `@container/header`, so the toolbar can drop secondary parts
   * with `@…/header:` variants when space runs out.
   */
  toolbar?: ReactNode;
  search: ShellSearchProps;
  sync: { isSyncing: boolean; onCheckNewMail: () => void };
};

const subscribeMounted = () => () => {};
const TITLE_SEPARATOR = " / ";

export function ThemeToggle() {
  const t = useTranslations("Shell");
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeMounted, () => true, () => false);
  const currentTheme = mounted ? theme : undefined;
  const Icon = currentTheme === "light" ? Sun : currentTheme === "dark" ? Moon : Monitor;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t("theme.label")} title={t("theme.label")}>
          <span aria-hidden="true" style={{ visibility: mounted ? "visible" : "hidden", display: "contents" }}><Icon /></span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={currentTheme ?? "system"} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light"><Sun />{t("theme.light")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark"><Moon />{t("theme.dark")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system"><Monitor />{t("theme.system")}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ShellHeader({ title, toolbar, search, sync, indicators }: ShellHeaderProps) {
  const t = useTranslations("Shell");
  const isMobile = useIsMobile();
  const segments = typeof title === "string" ? [title] : title;
  const fullTitle = segments.join(TITLE_SEPARATOR);
  const syncLabel = sync.isSyncing ? t("sync.checking") : t("sync.check");
  return (
    <header data-slot="shell-header" className="@container/header flex h-(--header-height) shrink-0 items-center gap-2 border-b px-4 lg:px-6 max-md:gap-0 max-md:px-2 max-md:[&_button]:min-h-11 max-md:[&_button]:min-w-11">
      <SidebarTrigger className="-ml-1 size-11 md:size-7" aria-label={t("sidebar.toggle")} />
      <Separator orientation="vertical" className="mx-1 hidden md:block data-[orientation=vertical]:h-4" />
      {/* On phones the title takes the free space so the toolbar sits with search on the right. */}
      {/* One weight and the font's own tracking for the whole path; only the
          separator steps back. The spaces stay in the text so the heading
          still reads "Mailbox / Folder". Centred like everything else here,
          the 14px title would sit (14 - 12) * 0.364px below the 12px count
          and toolbar labels (Inter's (ascender - descender) / 2 is 0.364em);
          the lift puts them on one baseline. */}
      <h1 className="relative top-[calc((var(--text-xs)-var(--text-sm))*0.364)] m-0 min-w-0 truncate text-sm font-medium max-md:flex-1" title={fullTitle}>
        {segments.map((segment, index) => (
          <Fragment key={index}>
            {index > 0 ? <span className="font-normal text-muted-foreground">{TITLE_SEPARATOR}</span> : null}
            {segment}
          </Fragment>
        ))}
      </h1>
      {toolbar}
      {/* The search box gives way before the title (shrink-3) and may get narrow; the buttons never shrink. */}
      <div className="ml-auto flex min-w-0 shrink-3 items-center gap-2">
        {!isMobile ? <div className="hidden w-64 min-w-0 md:block xl:w-80"><ShellSearch {...search} /></div> : null}
        {isMobile ? <div className="md:hidden"><Popover><PopoverTrigger asChild><Button variant="ghost" size="icon" aria-label={t("search")}><Search /></Button></PopoverTrigger>
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
