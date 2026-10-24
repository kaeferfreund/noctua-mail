"use client";

import { useSenderMessages } from "@/lib/i18n/useSenderMessages";
import { useTranslations } from "next-intl";
import mobileStyles from "@/app/components/shell/MobileFrames.module.css";
import { useMemo, useState } from "react";
import { useIsMobile } from "@/app/hooks/use-mobile";
import SettingsFrame, { SettingsTitle } from "@/app/components/shell/SettingsFrame";
import { X } from "lucide-react";
import { Flex, Tabs } from "@radix-ui/themes";
import type { Account, AccountSettings, RecipientAlias, Topic } from "@/lib/data";
import { hasSavableAccountSettingsChanges } from "@/lib/accountSettings";
import AccountTabContent from "@/app/components/account-settings/tabs/AccountTabContent";
import IdentitiesTabContent from "@/app/components/account-settings/tabs/IdentitiesTabContent";
import SignaturesTabContent from "@/app/components/account-settings/tabs/SignaturesTabContent";
import PreferencesTabContent from "@/app/components/account-settings/tabs/PreferencesTabContent";
import CategorizationTabContent from "@/app/components/account-settings/tabs/CategorizationTabContent";
import AdminConfirmDialog from "@/app/components/admin/AdminConfirmDialog";
import MembersTabContent from "@/app/components/account-settings/tabs/MembersTabContent";
import { settingsTabVisible } from "@/app/components/account-settings/settingsAccess";
import CalendarTabContent from "@/app/components/account-settings/tabs/CalendarTabContent";
import TopicsTabContent from "@/app/components/account-settings/tabs/TopicsTabContent";
import RecipientAliasesTabContent from "@/app/components/account-settings/tabs/RecipientAliasesTabContent";
import McpTabContent from "@/app/components/account-settings/tabs/McpTabContent";
import TranslationTabContent from "@/app/components/account-settings/tabs/TranslationTabContent";
import SpamTabContent from "@/app/components/account-settings/tabs/SpamTabContent";
import { type OverflowTabItem } from "@/app/components/account-settings/OverflowTabsList";
import TooltipIconButton from "@/app/components/TooltipIconButton";
export type ManageTab =
  | "account"
  | "identities"
  | "signatures"
  | "preferences"
  | "categorization"
  | "calendar"
  | "topics"
  | "translation"
  | "mcp"
  | "recipient-aliases"
  | "members"
  | "spam";

function deriveImapSecurity(imap: Account["imap"]): "tls" | "starttls" | "none" {
  if (imap.secure) return "tls";
  return imap.port === 143 ? "starttls" : "none";
}

function deriveSmtpSecurity(smtp: Account["smtp"]): "tls" | "starttls" | "none" {
  if (smtp.secure) return "tls";
  if (smtp.port === 587) return "starttls";
  return "none";
}

type Props = {
  editingAccount: Account;
  isOpen: boolean;
  manageTab: ManageTab;
  isExistingAccount: boolean;
  onClose: () => void;
  onTabChange: (tab: ManageTab) => void;
  onSave: (account: Account) => void;
  onDelete: () => void;
  isAdminUser?: boolean;
  onNotifySuccess?: (title: string, description: string) => void;
  apiFetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  readErrorMessage?: (res: Response) => Promise<string>;
  onTopicsChanged?: (topics: Topic[]) => void;
  recipientAliases?: RecipientAlias[];
  onRecipientAliasesChanged?: (aliases: RecipientAlias[]) => void;
  onCreateRecipientAlias?: (name: string, recipients: string) => Promise<RecipientAlias>;
  onUpdateRecipientAlias?: (
    aliasId: string,
    name: string,
    recipients: string
  ) => Promise<RecipientAlias>;
  onDeleteRecipientAlias?: (aliasId: string) => Promise<void>;
};

export default function AccountSettingsModal({
  editingAccount: initialAccount,
  isOpen,
  manageTab,
  isExistingAccount,
  onClose,
  onTabChange,
  onSave,
  onDelete,
  isAdminUser = false,
  onNotifySuccess,
  apiFetch,
  readErrorMessage,
  onTopicsChanged,
  recipientAliases = [],
  onRecipientAliasesChanged,
  onCreateRecipientAlias,
  onUpdateRecipientAlias,
  onDeleteRecipientAlias
}: Props) {
  const { messages: senderMessages } = useSenderMessages();
  const t = useTranslations("Settings");
  const isMobile = useIsMobile();
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [localAccount, setLocalAccount] = useState<Account>(initialAccount);
  const [imapSecurity, setImapSecurity] = useState<"tls" | "starttls" | "none">(() =>
    deriveImapSecurity(initialAccount.imap)
  );
  const [smtpSecurity, setSmtpSecurity] = useState<"tls" | "starttls" | "none">(() =>
    deriveSmtpSecurity(initialAccount.smtp)
  );
  const [imapDetecting, setImapDetecting] = useState(false);
  const [smtpDetecting, setSmtpDetecting] = useState(false);
  const [imapProbe, setImapProbe] = useState<{ tls?: boolean; starttls?: boolean } | null>(null);
  const [smtpProbe, setSmtpProbe] = useState<{ tls?: boolean; starttls?: boolean } | null>(null);

  const fetchFn = apiFetch ?? fetch;

  const handleSave = () => onSave(localAccount);

  const canSaveAccountTab = useMemo(
    () =>
      hasSavableAccountSettingsChanges(initialAccount, localAccount, "account", { isAdminUser }) &&
      Boolean(localAccount.email?.trim()),
    [initialAccount, isAdminUser, localAccount]
  );
  const canSaveSignaturesTab = useMemo(
    () => hasSavableAccountSettingsChanges(initialAccount, localAccount, "signatures", { isAdminUser }),
    [initialAccount, isAdminUser, localAccount]
  );
  const canSaveCalendarTab = useMemo(
    () => hasSavableAccountSettingsChanges(initialAccount, localAccount, "calendar", { isAdminUser }),
    [initialAccount, isAdminUser, localAccount]
  );
  const canSaveTopicsTab = useMemo(
    () => hasSavableAccountSettingsChanges(initialAccount, localAccount, "topics", { isAdminUser }),
    [initialAccount, isAdminUser, localAccount]
  );
  const canSaveTranslationTab = useMemo(
    () => hasSavableAccountSettingsChanges(initialAccount, localAccount, "translation", { isAdminUser }),
    [initialAccount, isAdminUser, localAccount]
  );

  const tabItems = useMemo<OverflowTabItem[]>(() => {
    const items: OverflowTabItem[] = [
      { value: "account", label: t("tabs.account") },
      { value: "identities", label: senderMessages.identitiesTitle, disabled: !isExistingAccount },
      { value: "signatures", label: t("tabs.signatures"), disabled: !isExistingAccount },
      { value: "preferences", label: t("tabs.preferences"), disabled: !isExistingAccount },
      { value: "categorization", label: t("tabs.categorization"), disabled: !isExistingAccount },
      { value: "topics", label: t("tabs.topics"), disabled: !isExistingAccount },
      { value: "calendar", label: t("tabs.calendar"), disabled: !isExistingAccount },
      { value: "translation", label: t("tabs.translation"), disabled: !isExistingAccount },
      { value: "recipient-aliases", label: t("tabs.recipient-aliases"), disabled: !isExistingAccount },
      { value: "mcp", label: t("tabs.mcp"), disabled: !isExistingAccount }
    ];
    items.push({ value: "members", label: t("tabs.members"), disabled: !isExistingAccount });
    if (isAdminUser) items.push({ value: "spam", label: t("tabs.spam"), disabled: !isExistingAccount });
    return items.filter(tab => settingsTabVisible(tab.value, initialAccount.accessRole, isExistingAccount));
  }, [initialAccount.accessRole, isAdminUser, isExistingAccount, senderMessages.identitiesTitle, t]);
  const activeTab = tabItems.some(tab => tab.value === manageTab && !tab.disabled) ? manageTab : (tabItems.find(tab => tab.value === "preferences" && !tab.disabled)?.value ?? tabItems.find(tab => !tab.disabled)?.value ?? "preferences");

  if (!isOpen) return null;

  const handleUpdateSettings = (next: AccountSettings) => {
    setLocalAccount((prev) => ({
      ...prev,
      settings: { ...(prev.settings ?? {}), ...next }
    }));
  };

  const runProbe = async (protocol: "imap" | "smtp") => {
    if (protocol === "imap") setImapDetecting(true);
    if (protocol === "smtp") setSmtpDetecting(true);
    const config = protocol === "imap" ? localAccount.imap : localAccount.smtp;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 6000);
    try {
      const response = await fetchFn("/api/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocol, host: config.host, port: config.port }),
        signal: controller.signal
      });
      if (!response.ok) return;
      const data = (await response.json()) as { supportsTLS: boolean; supportsStartTLS: boolean };
      if (protocol === "imap") {
        setImapProbe({ tls: data.supportsTLS, starttls: data.supportsStartTLS });
        if (data.supportsTLS) {
          setImapSecurity("tls");
          setLocalAccount((prev) => ({ ...prev, imap: { ...prev.imap, secure: true, port: 993 } }));
        } else if (data.supportsStartTLS) {
          setImapSecurity("starttls");
          setLocalAccount((prev) => ({ ...prev, imap: { ...prev.imap, secure: false, port: 143 } }));
        } else {
          setImapSecurity("none");
          setLocalAccount((prev) => ({ ...prev, imap: { ...prev.imap, secure: false, port: 143 } }));
        }
      } else {
        setSmtpProbe({ tls: data.supportsTLS, starttls: data.supportsStartTLS });
        if (data.supportsTLS) {
          setSmtpSecurity("tls");
          setLocalAccount((prev) => ({ ...prev, smtp: { ...prev.smtp, secure: true, port: 465 } }));
        } else if (data.supportsStartTLS) {
          setSmtpSecurity("starttls");
          setLocalAccount((prev) => ({ ...prev, smtp: { ...prev.smtp, secure: false, port: 587 } }));
        } else {
          setSmtpSecurity("none");
          setLocalAccount((prev) => ({ ...prev, smtp: { ...prev.smtp, secure: false, port: 25 } }));
        }
      }
    } finally {
      window.clearTimeout(timer);
      setImapDetecting(false);
      setSmtpDetecting(false);
    }
  };

  return (
    <SettingsFrame open={isOpen} onClose={onClose}>
        <Flex direction="column" gap="4" style={{ height: "100%", minHeight: 0 }}>
          <Flex align="center" justify="between" style={{ paddingBottom: "var(--space-2)", flexShrink: 0 }}>
            <SettingsTitle>
              {t("accountTitle")}
            </SettingsTitle>
            <TooltipIconButton variant="ghost" tooltip={t("close")} onClick={onClose}>
              <X size={18} />
            </TooltipIconButton>
          </Flex>

          <Tabs.Root
            orientation="vertical"
            value={activeTab}
            onValueChange={(value) => onTabChange(value as ManageTab)}
            style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "row", gap: 12 }}
          >
            <Tabs.List className={isMobile ? mobileStyles.settingsTabs : undefined} style={{ flexDirection: "column", alignItems: "stretch", flexShrink: 0, overflow: "auto" }}>{tabItems.map(tab => <Tabs.Trigger key={tab.value} aria-label={tab.label} value={tab.value} disabled={tab.disabled}>{tab.label}</Tabs.Trigger>)}</Tabs.List>

            {settingsTabVisible("account", initialAccount.accessRole, isExistingAccount) && <Tabs.Content value="account" style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden" }}>
              <AccountTabContent
                editingAccount={localAccount}
                isExistingAccount={isExistingAccount}
                imapDetecting={imapDetecting}
                smtpDetecting={smtpDetecting}
                imapProbe={imapProbe}
                smtpProbe={smtpProbe}
                imapSecurity={imapSecurity}
                smtpSecurity={smtpSecurity}
                onImapSecurityChange={setImapSecurity}
                onSmtpSecurityChange={setSmtpSecurity}
                onClose={onClose}
                onSave={handleSave}
                onDelete={() => setDeleteConfirm(true)}
                canDelete={initialAccount.isOwner === true || isAdminUser}
                canSave={canSaveAccountTab}
                onUpdateAccount={setLocalAccount}
                onRunProbe={runProbe}
              />
            </Tabs.Content>}

            <Tabs.Content value="identities" style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden" }}><IdentitiesTabContent key={localAccount.id} editingAccount={localAccount} apiFetch={apiFetch} /></Tabs.Content>

            {settingsTabVisible("signatures", initialAccount.accessRole, isExistingAccount) && <Tabs.Content value="signatures" style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden" }}>
              <SignaturesTabContent
                editingAccount={localAccount}
                isExistingAccount={isExistingAccount}
                onUpdateSettings={handleUpdateSettings}
                onClose={onClose}
                onSave={handleSave}
                canSave={canSaveSignaturesTab}
              />
            </Tabs.Content>}

            <Tabs.Content value="preferences" style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden" }}>
              <PreferencesTabContent key={localAccount.id} editingAccount={localAccount} onClose={onClose} apiFetch={apiFetch} senderPreferences />
            </Tabs.Content>

            {settingsTabVisible("categorization", initialAccount.accessRole, isExistingAccount) && <Tabs.Content value="categorization" style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden" }}>
              <CategorizationTabContent
                accountId={localAccount.id}
                isActive={activeTab === "categorization"}
                isExistingAccount={isExistingAccount}
                accountDateFormat={localAccount.settings?.appearance?.dateFormat}
                onClose={onClose}
                onSave={handleSave}
                onModelResetSuccess={() =>
                  onNotifySuccess?.(
                    t("modal.modelResetTitle"),
                    t("modal.modelResetDescription")
                  )
                }
                apiFetch={apiFetch}
                readErrorMessage={readErrorMessage}
              />
            </Tabs.Content>}

            {settingsTabVisible("calendar", initialAccount.accessRole, isExistingAccount) && <Tabs.Content value="calendar" style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden" }}>
              <CalendarTabContent
                editingAccount={localAccount}
                isExistingAccount={isExistingAccount}
                onUpdateAccount={setLocalAccount}
                onClose={onClose}
                onSave={handleSave}
                canSave={canSaveCalendarTab}
              />
            </Tabs.Content>}

            {settingsTabVisible("translation", initialAccount.accessRole, isExistingAccount) && <Tabs.Content value="translation" style={{ flex: "1 1 auto", minHeight: 0, overflow: "hidden" }}>
              <TranslationTabContent
                editingAccount={localAccount}
                isExistingAccount={isExistingAccount}
                onUpdateAccount={setLocalAccount}
                onClose={onClose}
                onSave={handleSave}
                canSave={canSaveTranslationTab}
                apiFetch={apiFetch}
              />
            </Tabs.Content>}

            {settingsTabVisible("topics", initialAccount.accessRole, isExistingAccount) && <Tabs.Content value="topics" style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto", padding: "var(--space-2)" }}>
              <TopicsTabContent
                accountId={localAccount.id}
                isActive={activeTab === "topics"}
                isExistingAccount={isExistingAccount}
                apiFetch={apiFetch}
                onTopicsChanged={onTopicsChanged}
                topicColorRows={localAccount.settings?.appearance?.topicColorRows ?? true}
                onUpdateSettings={handleUpdateSettings}
                currentAppearance={localAccount.settings?.appearance}
                onClose={onClose}
                onSave={handleSave}
                canSave={canSaveTopicsTab}
              />
            </Tabs.Content>}

            {settingsTabVisible("mcp", initialAccount.accessRole, isExistingAccount) && <Tabs.Content
              value="mcp"
              style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto" }}
            >
              <McpTabContent
                accountId={localAccount.id}
                isActive={activeTab === "mcp"}
                isExistingAccount={isExistingAccount}
                accountDateFormat={localAccount.settings?.appearance?.dateFormat}
                apiFetch={apiFetch}
                onClose={onClose}
              />
            </Tabs.Content>}

            {settingsTabVisible("recipient-aliases", initialAccount.accessRole, isExistingAccount) && <Tabs.Content
              value="recipient-aliases"
              style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto", padding: "var(--space-2)" }}
            >
              <RecipientAliasesTabContent
                accountId={localAccount.id}
                isExistingAccount={isExistingAccount}
                aliases={recipientAliases}
                apiFetch={apiFetch}
                onCreateAlias={onCreateRecipientAlias ?? (async () => {
                  throw new Error(t("modal.aliasCreateUnavailable"));
                })}
                onUpdateAlias={onUpdateRecipientAlias ?? (async () => {
                  throw new Error(t("modal.aliasUpdateUnavailable"));
                })}
                onDeleteAlias={onDeleteRecipientAlias ?? (async () => {
                  throw new Error(t("modal.aliasDeleteUnavailable"));
                })}
                onAliasesChanged={onRecipientAliasesChanged}
                onClose={onClose}
              />
            </Tabs.Content>}

            {isAdminUser && isExistingAccount && <Tabs.Content value="spam" style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto" }}>
              <SpamTabContent key={localAccount.id} accountId={localAccount.id} apiFetch={apiFetch} />
            </Tabs.Content>}

            {initialAccount.accessRole === "manager" && <Tabs.Content value="members" style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto" }}>
              <MembersTabContent key={localAccount.id} accountId={localAccount.id} accessRole={initialAccount.accessRole} apiFetch={apiFetch} />
            </Tabs.Content>}

          </Tabs.Root>
          {deleteConfirm && (initialAccount.isOwner === true || isAdminUser) && <AdminConfirmDialog
            title={t("modal.deleteTitle")} description={t("modal.deleteDescription", { email: localAccount.email })}
            busy={false} onCancel={() => setDeleteConfirm(false)} onConfirm={() => { setDeleteConfirm(false); onDelete(); }} />}

        </Flex>
    </SettingsFrame>
  );
}
