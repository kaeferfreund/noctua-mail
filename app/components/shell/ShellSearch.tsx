"use client";

import { getFolderDisplayName } from "@/lib/i18n/folderNames";

import { useLocale, useTranslations } from "next-intl";

import type React from "react";
import { useId, useMemo } from "react";
import {
  Folder as FolderIcon,
  Search,
  SlidersHorizontal,
  Sparkles,
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
  name?: string;
  value?: string;
  disabled?: boolean;
  indented?: boolean;
  onSelect: () => void;
  children: React.ReactNode;
};

function FilterRow({ kind, checked, name, value, disabled, indented, onSelect, children }: FilterRowProps) {
  return (
    <label
      className={cn(
        "flex w-full shrink-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground hover:bg-accent has-[:focus-visible]:bg-accent has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50",
        indented && "pl-7"
      )}
    >
      <input
        type={kind}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={onSelect}
        className="m-0 size-3.5 shrink-0 appearance-auto accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      <span className="flex min-w-0 flex-1 items-center gap-2">{children}</span>
    </label>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="m-0 min-w-0 shrink-0 border-0 p-0">
      <legend className="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">{label}</legend>
      {children}
    </fieldset>
  );
}

/**
 * Header search input with the scope / field / badge filters that TopBar
 * used to offer as three dropdown menus, now in one popover (design §7.2).
 */
export default function ShellSearch({ state, actions }: ShellSearchProps) {
  const locale = useLocale();
  const t = useTranslations("Search");
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
    accountFolders
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

  const scopeName = useId();
  const folderById = useMemo(
    () => new Map(accountFolders.map((folder) => [folder.id, folder])),
    [accountFolders]
  );
  const currentFolderId =
    searchScope === "folder" ? activeFolderId : lastFolderId || accountFolders[0]?.id || "";
  const currentFolder = currentFolderId ? (folderById.get(currentFolderId) ?? null) : null;
  const currentFolderPath = useMemo(() => {
    if (!currentFolder) return "";
    const parts = [getFolderDisplayName(currentFolder, locale)];
    let parentId = currentFolder.parentId ?? null;
    while (parentId) {
      const parent = folderById.get(parentId);
      if (!parent) break;
      parts.unshift(getFolderDisplayName(parent, locale));
      parentId = parent.parentId ?? null;
    }
    return parts.join("/");
  }, [currentFolder, folderById, locale]);

  const handleScopeChange = (nextScope: SearchScope) => {
    if (nextScope === searchScope) return;
    setSearchScope(nextScope);
    if (nextScope === "all") {
      setLastFolderId(activeFolderId);
      setActiveFolderId("");
    } else {
      setActiveFolderId(lastFolderId || accountFolders[0]?.id || "");
    }
  };

  const allFields = searchFields.participants && searchFields.subject && searchFields.body && searchFields.attachments;
  const selectedFields = SEARCH_FIELD_OPTIONS.filter(([key]) => searchFields[key] && !(key === "sender" && searchFields.participants)).map(([, label]) => t(label));
  const selectedBadges = SEARCH_BADGE_OPTIONS.filter(([key]) => searchBadges[key]).map(([, label]) => t(label));
  const searchFieldsLabel = t("fieldSummary", {fields: allFields || !selectedFields.length ? t("allFields") : selectedFields.join(", ")});
  const searchBadgesLabel = t("badgeSummary", {badges: selectedBadges.join(", ") || t("noFilters")});
  const activeBadgeCount = Object.values(searchBadges).filter(Boolean).length;
  const activeFilterCount = activeBadgeCount + (searchScope === "all" ? 1 : 0);
  const scopeLabel = searchScope === "all" ? t("scope.everywhere") : t("scope.folder");
  const placeholder =
    searchScope === "all"
      ? t("placeholder.everywhere")
      : currentFolder
        ? t("placeholder.folder", {folder: getFolderDisplayName(currentFolder, locale)})
        : t("placeholder.messages");

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
            aria-label={t("clear")}
            title={t("clear")}
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
            aria-label={t("filters")}
            title={t("summary", {scope: scopeLabel, fields: searchFieldsLabel, badges: searchBadgesLabel})}
          >
            <SlidersHorizontal />
            <span className="hidden lg:inline">{t("filterButton")}</span>
            {activeFilterCount > 0 ? (
              <Badge variant="secondary" className="h-4 min-w-4 px-1">
                {activeFilterCount}
              </Badge>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="max-h-(--radix-popover-content-available-height) w-80 gap-0 overflow-y-auto p-1 [&>[data-slot=separator]]:shrink-0">
          <FilterGroup label={t("scope.title")}>
            <FilterRow
              kind="radio"
              name={scopeName}
              value="folder"
              checked={searchScope === "folder"}
              onSelect={() => handleScopeChange("folder")}
            >
              <span>{t("scope.folderLabel")}</span>
              {currentFolder ? (
                <Badge variant="outline" title={currentFolderPath} className="max-w-40">
                  <FolderIcon data-icon="inline-start" />
                  <span className="truncate">{getFolderDisplayName(currentFolder, locale)}</span>
                </Badge>
              ) : null}
            </FilterRow>
            <FilterRow
              kind="radio"
              name={scopeName}
              value="all"
              checked={searchScope === "all"}
              onSelect={() => handleScopeChange("all")}
            >
              {t("scope.everywhere")}</FilterRow>
            {sentFolderName ? (
              <FilterRow
                kind="checkbox"
                checked={includeSentInEverywhere}
                disabled={searchScope !== "all"}
                indented
                onSelect={() => setIncludeSentInEverywhere((value) => !value)}
              >
                {t("scope.includeSent", {folder: sentFolderName})}
              </FilterRow>
            ) : null}
          </FilterGroup>
          <Separator className="my-1" />
          <FilterGroup label={t("fields.title")}>
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
                {t(label)}
              </FilterRow>
            ))}
          </FilterGroup>
          <Separator className="my-1" />
          <FilterGroup label={t("badges.title")}>
            {PRIMARY_BADGES.map(([key, label]) => (
              <FilterRow
                key={key}
                kind="checkbox"
                checked={searchBadges[key]}
                onSelect={() => setSearchBadges((prev) => ({ ...prev, [key]: !prev[key] }))}
              >
                {t(label)}
              </FilterRow>
            ))}
          </FilterGroup>
          <Separator className="my-1" />
          <FilterGroup label={t("categories")}>
            {CATEGORY_BADGE_OPTIONS.map(([key, label]) => (
              // The three categories are exclusive: selecting one clears the
              // others, selecting it again clears the category filter.
              <FilterRow
                key={key}
                kind="checkbox"
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
                {t(label)}
              </FilterRow>
            ))}
          </FilterGroup>
          <Separator className="my-1" />
          <FilterGroup label={t("ai")}>
            <FilterRow
              kind="checkbox"
              checked={searchBadges["ai-modified"]}
              onSelect={() =>
                setSearchBadges((prev) => ({ ...prev, "ai-modified": !prev["ai-modified"] }))
              }
            >
              <Sparkles className="size-3.5" aria-hidden />
              {t("badges.ai-modified")}</FilterRow>
          </FilterGroup>
        </PopoverContent>
      </Popover>
    </div>
  );
}
