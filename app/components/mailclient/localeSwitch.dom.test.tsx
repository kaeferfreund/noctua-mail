// A UI language switch (LanguageSelector runs it in a transition, then
// router.refresh) must leave the mailbox bootstrap alone: no second auth/me or
// folder load, no second startup sync, and an open inline reply keeps its state.
// The hooks are the production ones MailClient wires together.
import { afterEach, describe, expect, it } from "bun:test";
import { startTransition, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode, type SetStateAction } from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { useLocale } from "next-intl";
import type { Account, Folder } from "@/lib/data";
import { DEFAULT_SEARCH_BADGES, DEFAULT_SEARCH_FIELDS } from "./useSearchState";
import { useStartupSync } from "./useStartupSync";
import { useAccountController, type UseAccountControllerParams } from "./useAccountController";
import { useApiErrorMessage } from "./useApiErrorMessage";
import { useFolderRefresh } from "./useFolderRefresh";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import { getMessages } from "@/lib/i18n/translator";
import type { UiLocale } from "@/lib/i18n/config";
import { findInboxFolder } from "@/lib/specialFolders";
import { useLatestRef } from "@/app/hooks/useLatestRef";

const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
afterEach(() => {
  actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
  cleanup();
});

const noop = () => {};
const accounts = [{ id: "account-a" }, { id: "account-b" }] as Account[];
const folders = [{ id: "account-b:INBOX", accountId: "account-b", name: "INBOX", specialUse: "\\Inbox" }] as unknown as Folder[];
const mismatchResponse = () => Response.json({ code: "folder_account_mismatch" }, { status: 400 });

const localeControl: { switchTo: (locale: UiLocale) => void } = { switchTo: noop };
function SwitchableProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<UiLocale>("de");
  useEffect(() => {
    localeControl.switchTo = (next) => startTransition(() => setLocale(next));
  }, []);
  return <I18nTestProvider locale={locale}>{children}</I18nTestProvider>;
}

function InlineReply() {
  const [subject, setSubject] = useState("Re: synthetic");
  const [body, setBody] = useState("");
  useEffect(() => { observed.composerMounts += 1; }, []);
  return <form aria-label="inline reply">
    <input aria-label="Subject" value={subject} onChange={(event) => setSubject(event.target.value)} />
    <textarea aria-label="Body" value={body} onChange={(event) => setBody(event.target.value)} />
  </form>;
}

type Observed = {
  calls: string[];
  syncs: string[];
  readyFalse: number;
  refreshFolders: unknown;
  readErrorMessage: unknown;
  composerMounts: number;
};
const observed: Observed = { calls: [], syncs: [], readyFalse: 0, refreshFolders: null, readErrorMessage: null, composerMounts: 0 };

const apiFetch: UseAccountControllerParams["apiFetch"] = async (input) => {
  const url = String(input); observed.calls.push(url);
  if (url === "/api/auth/me") return Response.json({ user: { id: "u1", uiLocale: "de" }, accounts, accountId: "account-b", mailboxState: "selected" });
  return Response.json(folders);
};

function MailboxHarness() {
  const locale = useLocale();
  const [activeAccountId, setActiveAccountId] = useState("");
  const [ready, setReady] = useState(false);
  const setInitialDataReady = useCallback((value: SetStateAction<boolean>) => {
    if (value === false) observed.readyFalse += 1;
    setReady(value);
  }, []);
  const [loadedAccounts, setAccounts] = useState<Account[]>([]);
  const [activeFolderId, setActiveFolderId] = useState("");
  const [, setLastFolderId] = useState("");
  const [folderList, setFolders] = useState<Folder[]>([]);
  const [initialFoldersLoadedAccountId, setInitialFoldersLoadedAccountId] = useState<string | null>(null);
  const [, setAuthState] = useState<"loading" | "ok" | "unauth">("loading");
  const reportError = useCallback((message: string) => { throw new Error(`unexpected error: ${message}`); }, []);
  const readErrorMessage = useApiErrorMessage({ setAuthState, setReloginAccountId: noop, setReloginDescription: noop });
  const refreshFolders = useFolderRefresh({ activeAccountId, apiFetch, reportError, readErrorMessage, setFolders });
  useEffect(() => {
    observed.refreshFolders = refreshFolders;
    observed.readErrorMessage = readErrorMessage;
  }, [refreshFolders, readErrorMessage]);
  useAccountController({
    activeAccountId, accounts: loadedAccounts, accountFolders: folderList, activeFolderId,
    deletingFolderIds: new Set(), refreshFolders, runSyncJob: async () => ({ count: 0 }),
    defaultSearchFields: DEFAULT_SEARCH_FIELDS, defaultSearchBadges: DEFAULT_SEARCH_BADGES,
    apiFetch, reportError, readErrorMessage,
    setAccounts, setActiveAccountId, setFolders, setAuthState, setCurrentUser: noop,
    setInitialDataReady, setInitialFoldersLoadedAccountId, setSessionTtlSeconds: noop,
    setMessages: noop, setMessagesPage: noop, setHasMoreMessages: noop, setTotalMessages: noop,
    setActiveMessageId: noop, setViewMessage: noop, setActiveFolderId, setQuery: noop,
    setSearchScope: noop, setSearchFields: noop, setSearchBadges: noop, setActiveVirtualFolderId: noop,
    setLastFolderId, setMessageListError: noop, setExceptionEntries: noop, setManageOpen: noop,
    setManageTab: noop, setEditingAccount: noop, setDeletingFolderIds: noop,
  } as UseAccountControllerParams);
  const syncAccountRef = useLatestRef<Parameters<typeof useStartupSync>[0]["syncAccountRef"]["current"]>(
    async (folderId) => { observed.syncs.push(`${activeAccountId}:${folderId ?? ""}`); });
  useStartupSync({ initialDataReady: ready, activeAccountId, initialFoldersLoadedAccountId,
    activeFolderId, accountFolders: folderList, initialSyncStatusRef: useRef({}),
    readInitialSyncSessionStatus: () => null, writeInitialSyncSessionStatus: noop, syncAccountRef });
  useEffect(() => {
    // Mirrors MailClient's inbox selection once the folders are in.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ready && folderList.length && !activeFolderId) setActiveFolderId(findInboxFolder(folderList, activeAccountId)?.id ?? "");
  }, [activeAccountId, activeFolderId, folderList, ready]);
  return <div data-locale={locale}>{ready ? <InlineReply /> : <p>loading</p>}</div>;
}

describe("UI language switch", () => {
  it("de -> en -> de in a transition keeps the bootstrap, the callbacks and the inline reply", async () => {
    Object.assign(observed, { calls: [], syncs: [], readyFalse: 0, refreshFolders: null, readErrorMessage: null, composerMounts: 0 });
    const record = observed;
    const view = render(<MailboxHarness />, { wrapper: SwitchableProvider });
    const subject = await waitFor(() => view.getByLabelText("Subject") as HTMLInputElement);
    await waitFor(() => expect(record.syncs).toEqual(["account-b:account-b:INBOX"]));
    fireEvent.change(subject, { target: { value: "Synthetic unsent locale draft" } });
    fireEvent.change(view.getByLabelText("Body"), { target: { value: "Synthetic locale body" } });
    // refreshFolders follows the active mailbox; once it is selected, only the
    // language changes below and neither callback may change identity.
    const { readyFalse, refreshFolders, readErrorMessage } = record;

    for (const locale of ["en", "de"] as const) {
      await act(async () => { localeControl.switchTo(locale); });
      await waitFor(() => expect(view.container.querySelector("[data-locale]")?.getAttribute("data-locale")).toBe(locale));
      expect((view.getByLabelText("Subject") as HTMLInputElement).value).toBe("Synthetic unsent locale draft");
      expect((view.getByLabelText("Body") as HTMLTextAreaElement).value).toBe("Synthetic locale body");
    }

    expect(record.calls).toEqual(["/api/auth/me", "/api/accounts/account-b/folders"]);
    expect(record.syncs).toEqual(["account-b:account-b:INBOX"]);
    expect(record.readyFalse).toBe(readyFalse);
    expect(record.composerMounts).toBe(1);
    expect(record.refreshFolders).toBe(refreshFolders);
    expect(record.readErrorMessage).toBe(readErrorMessage);
  });

  it("an error resolved right after the switching commit uses the new language", async () => {
    // Without act, the transition commits on the scheduler and passive effects
    // flush in a later task; the awaited json() continuation runs before that.
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
    const resolved: Array<{ locale: string; text: string }> = [];
    function Probe() {
      const locale = useLocale();
      const readErrorMessage = useApiErrorMessage({ setAuthState: noop, setReloginAccountId: noop, setReloginDescription: noop });
      const first = useRef(true);
      useLayoutEffect(() => {
        if (first.current) { first.current = false; return; }
        void readErrorMessage(mismatchResponse()).then((text) => { resolved.push({ locale, text }); });
      }, [locale, readErrorMessage]);
      return <p data-locale={locale} />;
    }
    const view = render(<Probe />, { wrapper: SwitchableProvider });
    for (const [index, locale] of (["en", "de"] as const).entries()) {
      localeControl.switchTo(locale);
      await waitFor(() => expect(resolved.length).toBe(index + 1));
      expect(view.container.querySelector("[data-locale]")?.getAttribute("data-locale")).toBe(locale);
    }
    expect(resolved).toEqual([
      { locale: "en", text: getMessages("en").Notifications.folderAccountMismatch },
      { locale: "de", text: getMessages("de").Notifications.folderAccountMismatch },
    ]);
  });
});
