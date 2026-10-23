"use client";

import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { Button, Flex, Text } from "@radix-ui/themes";
import { useTranslations } from "next-intl";
import {
  buildAccountRecipientAliasesPath,
  buildAccountRecipientAliasTransferPath
} from "@/lib/accountApiPaths";
import type { RecipientAlias } from "@/lib/data";
import type { RecipientAliasTransferImportSummary } from "@/lib/recipientAliases";
import RecipientAliasManager from "@/app/components/mailclient/RecipientAliasManager";
import ImportReplaceConfirmDialog from "./ImportReplaceConfirmDialog";

type Props = {
  accountId?: string;
  isExistingAccount: boolean;
  aliases: RecipientAlias[];
  apiFetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  onCreateAlias: (name: string, recipients: string) => Promise<RecipientAlias>;
  onUpdateAlias: (aliasId: string, name: string, recipients: string) => Promise<RecipientAlias>;
  onDeleteAlias: (aliasId: string) => Promise<void>;
  onAliasesChanged?: (aliases: RecipientAlias[]) => void;
  onClose: () => void;
};

type RecipientAliasTransferExportResponse = {
  ok?: boolean;
  data?: unknown;
  message?: string;
};

type RecipientAliasTransferImportResponse = {
  ok?: boolean;
  summary?: RecipientAliasTransferImportSummary;
  message?: string;
};

export default function RecipientAliasesTabContent({
  accountId,
  isExistingAccount,
  aliases,
  apiFetch,
  onCreateAlias,
  onUpdateAlias,
  onDeleteAlias,
  onAliasesChanged,
  onClose
}: Props) {
  const t = useTranslations("Settings");
  const request = apiFetch ?? fetch;
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);

  const readError = useCallback(async (res: Response) => {
    try {
      const data = (await res.json()) as { message?: string; error?: string };
      return data?.message || data?.error || t("recipientAliases.requestFailed", { status: res.status });
    } catch {
      return t("recipientAliases.requestFailed", { status: res.status });
    }
  }, [t]);

  const handleExport = useCallback(async () => {
    if (!accountId) return;
    setExporting(true);
    setError("");
    setNotice("");
    try {
      const res = await request(buildAccountRecipientAliasTransferPath(accountId));
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      const data = (await res.json()) as RecipientAliasTransferExportResponse;
      if (!data?.ok || !data.data) {
        setError(data?.message ?? t("recipientAliases.exportFailed"));
        return;
      }

      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `noctua-recipient-aliases-${accountId}-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setNotice(t("recipientAliases.exported"));
    } catch {
      setError(t("recipientAliases.exportFailed"));
    } finally {
      setExporting(false);
    }
  }, [accountId, readError, request, t]);

  const resetImportInput = useCallback(() => {
    if (importInputRef.current) {
      importInputRef.current.value = "";
    }
  }, []);

  const executeImport = useCallback(async (file: File) => {
    if (!accountId) {
      return;
    }

    setImporting(true);
    setError("");
    setNotice("");
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const res = await request(buildAccountRecipientAliasTransferPath(accountId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: parsed })
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      const data = (await res.json()) as RecipientAliasTransferImportResponse;
      if (!data?.ok || !data.summary) {
        setError(data?.message ?? t("recipientAliases.importFailed"));
        return;
      }

      const aliasesRes = await request(buildAccountRecipientAliasesPath(accountId), {
        cache: "no-store"
      });
      if (!aliasesRes.ok) {
        setError(await readError(aliasesRes));
        return;
      }
      const aliasesData = (await aliasesRes.json()) as {
        ok?: boolean;
        aliases?: RecipientAlias[];
        message?: string;
      };
      if (!aliasesData.ok || !Array.isArray(aliasesData.aliases)) {
        setError(aliasesData.message ?? t("recipientAliases.loadFailed"));
        return;
      }

      onAliasesChanged?.(aliasesData.aliases);
      setNotice(t("recipientAliases.imported", { count: data.summary.aliasCount }));
    } catch (importError) {
      setError(
        importError instanceof SyntaxError
          ? t("recipientAliases.invalidJson")
          : t("recipientAliases.importFailed")
      );
    } finally {
      resetImportInput();
      setImporting(false);
    }
  }, [accountId, onAliasesChanged, readError, request, resetImportInput, t]);

  const handleImportFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !accountId) {
      resetImportInput();
      return;
    }
    setPendingImportFile(file);
  }, [accountId, resetImportInput]);

  const handleImportDialogOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setPendingImportFile(null);
      resetImportInput();
    }
  }, [resetImportInput]);

  const confirmImport = useCallback(() => {
    const file = pendingImportFile;
    if (!file) {
      return;
    }
    setPendingImportFile(null);
    void executeImport(file);
  }, [executeImport, pendingImportFile]);

  if (!isExistingAccount) {
    return null;
  }

  return (
    <Flex direction="column" gap="4" style={{ height: "100%", minHeight: 0 }}>
      <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto" }}>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportFile}
          style={{ display: "none" }}
        />
        <Flex direction="column" gap="4" style={{ marginBottom: "var(--space-4)" }}>
          <Text size="3" weight="medium">{t("recipientAliases.syncTitle")}</Text>
          <Text size="2" color="gray">
            {t("recipientAliases.syncHelp")}
          </Text>
          <Flex align="center" gap="2" wrap="wrap">
            <Button
              size="1"
              variant="soft"
              onClick={() => void handleExport()}
              disabled={!accountId || exporting || importing}
            >
              {exporting ? t("recipientAliases.exporting") : t("recipientAliases.export")}
            </Button>
            <Button
              size="1"
              variant="soft"
              onClick={() => importInputRef.current?.click()}
              disabled={!accountId || exporting || importing}
            >
              {importing ? t("recipientAliases.importing") : t("recipientAliases.import")}
            </Button>
            <Text size="1" color="gray">
              {t("recipientAliases.importHint")}
            </Text>
          </Flex>
          {error && (
            <Text size="2" color="red">
              {error}
            </Text>
          )}
          {notice && (
            <Text size="2" color="green">
              {notice}
            </Text>
          )}
        </Flex>
        <RecipientAliasManager
          aliases={aliases}
          resetKey={`settings:${aliases.length}`}
          onCreateAlias={onCreateAlias}
          onUpdateAlias={onUpdateAlias}
          onDeleteAlias={onDeleteAlias}
        />
      </div>
      <ImportReplaceConfirmDialog
        open={pendingImportFile !== null}
        title={t("recipientAliases.importConfirmTitle")}
        description={t("recipientAliases.importConfirmDescription")}
        confirmLabel={t("recipientAliases.import")}
        onOpenChange={handleImportDialogOpenChange}
        onConfirm={confirmImport}
      />
      <Flex
        justify="end"
        style={{ paddingTop: "var(--space-3)", borderTop: "1px solid var(--gray-a5)", flexShrink: 0 }}
      >
        <Button size="2" variant="soft" color="gray" onClick={onClose}>
          {t("close")}
        </Button>
      </Flex>
    </Flex>
  );
}
