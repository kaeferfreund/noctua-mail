import { afterEach, expect, test } from "bun:test";
import { act, cleanup, renderHook } from "@testing-library/react";
import { useRef } from "react";
import type { Folder } from "@/lib/data";
import { useSyncController, type UseSyncControllerParams } from "./useSyncController";

import { I18nTestProvider } from "@/lib/i18n/testRender";
import { useApiErrorMessage } from "./useApiErrorMessage";
import type { UiLocale } from "@/lib/i18n/config";
import type { ReactNode } from "react";

afterEach(cleanup);
const noop = () => {};
const folder = (accountId: string): Folder => ({ id: `${accountId}:INBOX`, accountId, name: "INBOX", count: 0, specialUse: "\\Inbox" });

function mount(locale: UiLocale, confirm: UseSyncControllerParams["confirmFullSyncStart"] = async () => true) {
  const notices: Array<{title:string;description?:string}> = [];
  const jobs: { accountId: string; folderId?: string }[] = [];
  const apiFetch: UseSyncControllerParams["apiFetch"] = async (input, init) => {
    const path = String(input);
    if (path.endsWith("/sync")) {
      jobs.push({ ...JSON.parse(String(init?.body)), accountId: path.split("/")[3] });
      return Response.json({ ok: true, jobId: "synthetic-job" });
    }
    if (path.includes("/sync/status")) return Response.json({ ok: true, job: { status: "done", result: { count: 0 } } });
    if (path.endsWith("/new-candidates")) return Response.json({ ok: true, decisions: [] });
    return Response.json({ ok: true, needsRepair: false });
  };
  const hook = renderHook(({ accountId, folderId }) => useSyncController({
    activeAccountId: accountId, activeFolderId: folderId, activeVirtualFolderId: "", searchScope: "folder", authState: "loading",
    inboxMailboxPath: "", accountFolders: [folder(accountId)], inboxFolder: folder(accountId), apiFetch,
    readErrorMessage: async res => `HTTP ${res.status}`, reportError: noop, pushNotice: notice => {notices.push(notice)}, showNotification: async () => false,
    refreshMailboxData: async () => true, refreshFolders: async () => [folder(accountId)], refreshPendingCalendarReminders: async () => {},
    setFolders: noop, setMessages: noop, setActiveFolderId: noop, isNotificationSuppressedFolder: () => false,
    updateMessagesWithCurrentResultPrune: noop, confirmFullSyncStart: confirm, currentKeyRef: useRef(accountId)
  }), { initialProps: { accountId: "synthetic-a", folderId: "synthetic-a:INBOX" },
    wrapper: ({ children }: { children: ReactNode }) => <I18nTestProvider locale={locale}>{children}</I18nTestProvider> });
  return { ...hook, jobs, notices };
}


const copy = {
  de: {
    title: "Vollständige Synchronisierung abgebrochen",
    selection: "Die vollständige Synchronisierung wurde vor dem Start abgebrochen, weil du ein anderes Postfach ausgewählt hast.",
    declined: "Die vollständige Synchronisierung wurde vor dem Start abgebrochen.",
    mismatch: "Der Ordner gehört nicht zu diesem Postfach. Bitte wähle das Postfach neu aus."
  },
  en: {
    title: "Full sync cancelled",
    selection: "Full sync was cancelled before starting because you selected another mailbox.",
    declined: "Full sync was cancelled before starting.",
    mismatch: "The folder does not belong to this mailbox. Please select the mailbox again."
  }
};

for (const locale of ["de", "en"] as const) {
  test(`${locale}: selection cancellation emits a localized user notice`, async () => {
    let resolve!: (accepted: boolean) => void;
    const confirmation = new Promise<boolean>(done => { resolve = done; });
    const { result, rerender, notices, jobs } = mount(locale, () => confirmation);
    let pending!: Promise<unknown>;
    act(() => { pending = result.current.syncFolderWithBackgroundRef.current("synthetic-a:INBOX", true, "full"); });
    rerender({ accountId: "synthetic-b", folderId: "synthetic-b:INBOX" });
    await act(async () => { resolve(true); await pending; });
    expect(jobs).toEqual([]);
    expect(notices).toMatchObject([{ title: copy[locale].title, description: copy[locale].selection }]);
  });

  test(`${locale}: declining confirmation never displays the diagnostic reason`, async () => {
    const { result, notices, jobs } = mount(locale, async () => false);
    await act(async () => { await result.current.syncFolderWithBackgroundRef.current("synthetic-a:INBOX", true, "full"); });
    expect(jobs).toEqual([]);
    expect(notices).toMatchObject([{ title: copy[locale].title, description: copy[locale].declined }]);
  });

  test(`${locale}: folder_account_mismatch resolves to specific UI copy before generic diagnostics`, async () => {
    const sideEffects: string[] = [];
    const { result } = renderHook(() => useApiErrorMessage({
      setAuthState: state => sideEffects.push(state),
      setReloginAccountId: id => sideEffects.push(id),
      setReloginDescription: text => sideEffects.push(text)
    }), { wrapper: ({ children }: { children: ReactNode }) => <I18nTestProvider locale={locale}>{children}</I18nTestProvider> });
    const response = Response.json({ ok: false, code: "folder_account_mismatch", message: "Request failed (400)" }, { status: 400 });
    Object.defineProperty(response, "url", { value: "http://localhost:3845/api/accounts/synthetic-b/sync" });
    expect(await result.current(response)).toBe(copy[locale].mismatch);
    expect(sideEffects).toEqual([]);
  });
}
