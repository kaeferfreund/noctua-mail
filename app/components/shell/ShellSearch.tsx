"use client";

import type React from "react";
import { useMemo } from "react";
import {
  Circle,
  CircleDot,
  Folder as FolderIcon,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  SquareCheck,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/app/components/ui/popover";
import { Separator } from "@/app/components/ui/separator";
import { SEARCH_BADGE_OPTIONS, SEARCH_FIELD_OPTIONS } from "@/lib/ui/searchFilters";
import type { Folder } from "@/lib/data";
import type {
  SearchBadgesState,
  SearchFieldsState
} from "@/app/components/mailclient/useSearchState";

type SearchScope = "folder" | "all";

const CATEGORY_BADGES = ["newsletter", "notification", "transactional"] as const;
const PRIMARY_BADGES = SEARCH_BADGE_OPTIONS.filter(
  ([key]) => !(CATEGORY_BADGES as readonly string[]).includes(key) && key !== "ai-modified"
);
const CATEGORY_BADGE_OPTIONS = SEARCH_BADGE_OPTIONS.filter(([key]) =>
  (CATEGORY_BADGES as readonly string[]).includes(key)
);

export type ShellSearchProps = {
  state: {
    query: string;
    searchScope: SearchScope;
    includeSentInEverywhere: boolean;
    sentFolderName: string | null;
    searchFields: SearchFieldsState;
    searchBadges: SearchBadgesState;
    isRelatedSearch: boolean;
    activeFolderId: string;
    lastFolderId: string;
    accountFolders: Folder[];
    searchFieldsLabel: string;
    searchBadgesLabel: string;
  };
  actions: {
    setQuery: React.Dispatch<React.SetStateAction<string>>;
    setSearchScope: React.Dispatch<React.SetStateAction<SearchScope>>;
    setIncludeSentInEverywhere: React.Dispatch<React.SetStateAction<boolean>>;
    setSearchFields: React.Dispatch<React.SetStateAction<SearchFieldsState>>;
    setSearchBadges: React.Dispatch<React.SetStateAction<SearchBadgesState>>;
    clearSearch: () => void;
    setActiveFolderId: React.Dispatch<React.SetStateAction<string>>;
    setLastFolderId: React.Dispatch<React.SetStateAction<string>>;
  };
};

type FilterRowProps = {
  kind: "checkbox" | "radio";
  checked: boolean;
  disabled?: boolean;
  indented?: boolean;
  onSelect: () => void;
  children: React.ReactNode;
};

function FilterRow({ kind, checked, disabled, indented, onSelect, children }: FilterRowProps) {
  const Icon = kind === "radio" ? (checked ? CircleDot : Circle) : checked ? SquareCheck : Square;
  return (
    <button
      type="button"
      role={kind === "radio" ? "menuitemradio" : "menuitemcheckbox"}
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-md bg-transparent px-2 py-1.5 text-left text-sm text-foreground outline-none hover:bg-accent hover:text-accent-foreground focus-visible:bg-accent disabled:pointer-events-none disabled:opacity-50",
        indented && "pl-7"
      )}
    >
      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">{children}</div>;
}

/**
 * Header search input with the scope / field / badge filters that TopBar
 * used to offer as three dropdown menus, now in one popover (design §7.2).
 */
export default function ShellSearch({ state, actions }: ShellSearchProps) {
  const {
    query,
    searchScope,
    includeSentInEverywhere,
    sentFolderName,
    searchFields,
    searchBadges,
    isRelatedSearch,
    activeFolderId,
    lastFolderId,
    accountFolders,
    searchFieldsLabel,
    searchBadgesLabel
  } = state;
  const {
    setQuery,
    setSearchScope,
    setIncludeSentInEverywhere,
    setSearchFields,
    setSearchBadges,
    clearSearch,
    setActiveFolderId,
    setLastFolderId
  } = actions;

  const folderById = useMemo(
    () => new Map(accountFolders.map((folder) => [folder.id, folder])),
    [accountFolders]
  );
  const currentFolderId =
    searchScope === "folder" ? activeFolderId : lastFolderId || accountFolders[0]?.id || "";
  const currentFolder = currentFolderId ? (folderById.get(currentFolderId) ?? null) : null;
  const currentFolderPath = useMemo(() => {
    if (!currentFolder) return "";
    const parts = [currentFolder.name];
    let parentId = currentFolder.parentId ?? null;
    while (parentId) {
      const parent = folderById.get(parentId);
      if (!parent) break;
      parts.unshift(parent.name);
      parentId = parent.parentId ?? null;
    }
    return parts.join("/");
  }, [currentFolder, folderById]);

  const handleScopeChange = (nextScope: SearchScope) => {
    setSearchScope(nextScope);
    if (nextScope === "all") {
      setLastFolderId(activeFolderId);
      setActiveFolderId("");
    } else {
      setActiveFolderId(lastFolderId || accountFolders[0]?.id || "");
    }
  };

  const activeBadgeCount = Object.values(searchBadges).filter(Boolean).length;
  const activeFilterCount = activeBadgeCount + (searchScope === "all" ? 1 : 0);
  const scopeLabel = searchScope === "all" ? "Everywhere" : "Current folder";
  const placeholder =
    searchScope === "all"
      ? "Search messages everywhere"
      : currentFolder
        ? `Search messages in ${currentFolder.name}`
        : "Search messages";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1.5">
      <div className="relative min-w-0 flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="top-search-input"
          type="text"
          enterKeyHint="search"
          aria-label={placeholder}
          placeholder={placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="bg-background pr-8 pl-8"
        />
        {query ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="absolute top-1/2 right-1 -translate-y-1/2"
            aria-label="Clear search"
            title="Clear search"
            onClick={() => (isRelatedSearch ? clearSearch() : setQuery(""))}
          >
            <X />
          </Button>
        ) : null}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isRelatedSearch}
            aria-label="Search filters"
            title={`${scopeLabel} · ${searchFieldsLabel} · ${searchBadgesLabel}`}
          >
            <SlidersHorizontal />
            <span className="hidden lg:inline">Filters</span>
            {activeFilterCount > 0 ? (
              <Badge variant="secondary" className="h-4 min-w-4 px-1">
                {activeFilterCount}
              </Badge>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 gap-0 p-1">
          <SectionLabel>Scope</SectionLabel>
          <FilterRow
            kind="radio"
            checked={searchScope === "folder"}
            onSelect={() => handleScopeChange("folder")}
          >
            <span>Current folder:</span>
            {currentFolder ? (
              <Badge variant="outline" title={currentFolderPath} className="max-w-40">
                <FolderIcon data-icon="inline-start" />
                <span className="truncate">{currentFolder.name}</span>
              </Badge>
            ) : null}
          </FilterRow>
          <FilterRow
            kind="radio"
            checked={searchScope === "all"}
            onSelect={() => handleScopeChange("all")}
          >
            Everywhere
          </FilterRow>
          {sentFolderName ? (
            <FilterRow
              kind="checkbox"
              checked={includeSentInEverywhere}
              disabled={searchScope !== "all"}
              indented
              onSelect={() => setIncludeSentInEverywhere((value) => !value)}
            >
              {`Include ${sentFolderName}`}
            </FilterRow>
          ) : null}
          <Separator className="my-1" />
          <SectionLabel>Search in</SectionLabel>
          {SEARCH_FIELD_OPTIONS.map(([key, label]) => (
            <FilterRow
              key={key}
              kind="checkbox"
              checked={searchFields[key]}
              disabled={key === "sender" && searchFields.participants}
              onSelect={() =>
                setSearchFields((prev) => {
                  const next = !prev[key];
                  return {
                    ...prev,
                    [key]: next,
                    ...(key === "participants" && next ? { sender: false } : {})
                  };
                })
              }
            >
              {label}
            </FilterRow>
          ))}
          <Separator className="my-1" />
          <SectionLabel>Filter</SectionLabel>
          {PRIMARY_BADGES.map(([key, label]) => (
            <FilterRow
              key={key}
              kind="checkbox"
              checked={searchBadges[key]}
              onSelect={() => setSearchBadges((prev) => ({ ...prev, [key]: !prev[key] }))}
            >
              {label}
            </FilterRow>
          ))}
          <Separator className="my-1" />
          {CATEGORY_BADGE_OPTIONS.map(([key, label]) => (
            // The three categories are exclusive: selecting one clears the
            // others, selecting it again clears the category filter.
            <FilterRow
              key={key}
              kind="radio"
              checked={searchBadges[key]}
              onSelect={() =>
                setSearchBadges((prev) => ({
                  ...prev,
                  newsletter: key === "newsletter" ? !prev.newsletter : false,
                  notification: key === "notification" ? !prev.notification : false,
                  transactional: key === "transactional" ? !prev.transactional : false
                }))
              }
            >
              {label}
            </FilterRow>
          ))}
          <Separator className="my-1" />
          <SectionLabel>AI</SectionLabel>
          <FilterRow
            kind="checkbox"
            checked={searchBadges["ai-modified"]}
            onSelect={() =>
              setSearchBadges((prev) => ({ ...prev, "ai-modified": !prev["ai-modified"] }))
            }
          >
            <Sparkles className="size-3.5" aria-hidden />
            AI Modified
          </FilterRow>
        </PopoverContent>
      </Popover>
    </div>
  );
}
