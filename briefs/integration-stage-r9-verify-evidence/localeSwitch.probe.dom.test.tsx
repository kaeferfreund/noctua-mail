// Verification probe (scratch, not part of the repo): the real bootstrap hooks under a
// switchable next-intl provider. An inline-reply composer lives below the "ready"
// gate exactly like MailClient's mail UI. Switching de -> en -> de (inside a
// transition, as LanguageSelector does with router.refresh) must not re-run the
// bootstrap, must not re-trigger the startup sync and must keep the composer state.
// PROBE_VARIANT=prefix swaps in the 98b4301 resolver (negative control).
import { afterEach, describe, expect, it } from "bun:test";
import { startTransition, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { useTranslations, useLocale } from "next-intl";
import type { Account, Folder } from "@/lib/data";
import { DEFAULT_SEARCH_BADGES, DEFAULT_SEARCH_FIELDS } from "@/app/components/mailclient/useSearchState";
import { useStartupSync } from "@/app/components/mailclient/useStartupSync";
import { useAccountController, type UseAccountControllerParams } from "@/app/components/mailclient/useAccountController";
import { useApiErrorMessage as fixedResolver } from "@/app/components/mailclient/useApiErrorMessage";
import { useApiErrorMessage as prefixResolver } from "./useApiErrorMessage.prefix";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import { getMessages } from "@/lib/i18n/translator";
import type { UiLocale } from "@/lib/i18n/config";
import { findInboxFolder } from "@/lib/specialFolders";

const useApiErrorMessage = process.env.PROBE_VARIANT === "prefix" ? prefixResolver : fixedResolver;
afterEach(cleanup);
const noop = () => {};
const accounts = [{ id: "account-a" }, { id: "account-b" }] as Account[];
const folders = [{ id: "account-b:INBOX", accountId: "account-b", name: "INBOX", specialUse: "\\Inbox" }] as unknown as Folder[];

let setLocaleOutside: (l: UiLocale) => void = noop;
function SwitchableProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<UiLocale>("de");
  setLocaleOutside = (l) => startTransition(() => setLocale(l));
  return <I18nTestProvider locale={locale}>{children}</I18nTestProvider>;
}

function InlineReply() {
  const [subject, setSubject] = useState("Re: synthetic");
  const [body, setBody] = useState("");
  const mounts = useRef(0);
  useEffect(() => { mounts.current += 1; (globalThis as { __composerMounts?: number }).__composerMounts = ((globalThis as { __composerMounts?: number }).__composerMounts ?? 0) + 1; }, []);
  return <form aria-label="inline reply">
    <input aria-label="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
    <textarea aria-label="Body" value={body} onChange={e => setBody(e.target.value)} />
  </form>;
}

type Rec = { calls: string[]; syncs: string[]; readyFalse: number; layoutResolved: { locale: string; text: string }[] };
function Harness({ rec, apiFetch }: { rec: Rec; apiFetch: UseAccountControllerParams["apiFetch"] }) {
  const tn = useTranslations("Notifications");
  const locale = useLocale();
  const [activeAccountId, setActiveAccountId] = useState("");
  const [ready, setReadyState] = useState(false);
  const setInitialDataReady = useCallback((value: React.SetStateAction<boolean>) => {
    if (value === false) rec.readyFalse += 1;
    setReadyState(value);
  }, [rec]);
  const [loadedAccounts, setAccounts] = useState<Account[]>([]);
  const [activeFolderId, setActiveFolderId] = useState("");
  const [, setLastFolderId] = useState("");
  const [folderList, setFolders] = useState<Folder[]>([]);
  const [initialFoldersLoadedAccountId, setInitialFoldersLoadedAccountId] = useState<string | null>(null);
  const [, setAuthState] = useState<"loading" | "ok" | "unauth">("loading");
  const [, setReloginAccountId] = useState("");
  const [, setReloginDescription] = useState("");
  const errors: string[] = [];
  const reportError = useCallback((m: string) => { errors.push(m); }, []);
  const readErrorMessage = useApiErrorMessage({ setAuthState, setReloginAccountId, setReloginDescription });
  // Same shape as MailClient's refreshFolders: locale-bound through tn.
  const refreshFolders = useCallback(async () => {
    try { return [] as Folder[]; } catch { reportError(tn("refreshFoldersFailed")); return null; }
  }, [reportError, tn]);
  const controller = useAccountController({
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
  void controller;
  const syncAccountRef = useRef<Parameters<typeof useStartupSync>[0]["syncAccountRef"]["current"]>(undefined);
  syncAccountRef.current = async folderId => { rec.syncs.push(`${activeAccountId}:${folderId ?? ""}`); };
  useStartupSync({ initialDataReady: ready, activeAccountId, initialFoldersLoadedAccountId,
    activeFolderId, accountFolders: folderList, initialSyncStatusRef: useRef({}),
    readInitialSyncSessionStatus: () => null, writeInitialSyncSessionStatus: noop, syncAccountRef });
  useEffect(() => {
    if (ready && folderList.length && !activeFolderId) setActiveFolderId(findInboxFolder(folderList, activeAccountId)?.id ?? "");
  }, [activeAccountId, activeFolderId, folderList, ready]);
  // Stale-translator window probe: resolve a mismatch error in the same commit as
  // the language change (layout effect runs before the passive ref update).
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    void readErrorMessage(Response.json({ code: "folder_account_mismatch" }, { status: 400 }))
      .then(text => rec.layoutResolved.push({ locale, text }));
  }, [locale, readErrorMessage]);
  return <div data-locale={locale}>{ready ? <InlineReply /> : <p>loading</p>}</div>;
}

describe("verify-r9: language switch keeps the mailbox bootstrap and the inline reply", () => {
  it("de -> en -> de (transition) does not re-bootstrap and keeps composer state", async () => {
    (globalThis as { __composerMounts?: number }).__composerMounts = 0;
    const rec: Rec = { calls: [], syncs: [], readyFalse: 0, layoutResolved: [] };
    const apiFetch: UseAccountControllerParams["apiFetch"] = async (input) => {
      const url = String(input); rec.calls.push(url);
      if (url === "/api/auth/me") return Response.json({ user: { id: "u1", uiLocale: "de" }, accounts, accountId: "account-b", mailboxState: "selected" });
      return Response.json(folders);
    };
    const view = render(<Harness rec={rec} apiFetch={apiFetch} />, { wrapper: SwitchableProvider });
    const subject = await waitFor(() => view.getByLabelText("Subject") as HTMLInputElement);
    await waitFor(() => expect(rec.syncs.length).toBe(1));
    fireEvent.change(subject, { target: { value: "Synthetic unsent locale draft" } });
    fireEvent.change(view.getByLabelText("Body"), { target: { value: "Synthetic locale body" } });
    const before = { calls: [...rec.calls], syncs: [...rec.syncs], readyFalse: rec.readyFalse };
    for (const locale of ["en", "de"] as const) {
      await act(async () => { setLocaleOutside(locale); });
      await act(async () => { await new Promise(r => setTimeout(r, 20)); });
      expect(view.container.querySelector("[data-locale]")?.getAttribute("data-locale")).toBe(locale);
      expect((view.getByLabelText("Subject") as HTMLInputElement).value).toBe("Synthetic unsent locale draft");
      expect((view.getByLabelText("Body") as HTMLTextAreaElement).value).toBe("Synthetic locale body");
    }
    console.log("probe calls", JSON.stringify(rec.calls), "syncs", JSON.stringify(rec.syncs),
      "readyFalse", rec.readyFalse, "composerMounts", (globalThis as { __composerMounts?: number }).__composerMounts);
    console.log("probe layout-effect resolutions", JSON.stringify(rec.layoutResolved.map(r => ({ locale: r.locale,
      matches: r.text === getMessages(r.locale as UiLocale).Notifications.folderAccountMismatch }))));
    expect(rec.calls).toEqual(before.calls);
    expect(rec.calls).toEqual(["/api/auth/me", "/api/accounts/account-b/folders"]);
    expect(rec.syncs).toEqual(before.syncs);
    expect(rec.readyFalse).toBe(before.readyFalse);
    expect((globalThis as { __composerMounts?: number }).__composerMounts).toBe(1);
  });
});
