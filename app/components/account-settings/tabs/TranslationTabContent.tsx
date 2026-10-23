"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useDeeplLanguageLabel } from "@/lib/i18n/useDeeplLanguageLabel";
import { Badge, Button, Callout, Flex, Select, Switch, Text } from "@radix-ui/themes";
import { CheckCircle, Info, Languages, XCircle } from "lucide-react";
import Field from "@/app/components/account-settings/Field";
import PasswordField from "@/app/components/PasswordField";
import type { Account, DeeplConfig } from "@/lib/data";
import {
  DEEPL_TARGET_LANGUAGES,
  DEFAULT_DEEPL_TARGET_LANG
} from "@/lib/deeplLanguages";
import { buildAccountTranslationTestPath } from "@/lib/accountApiPaths";
import { formatNumber } from "@/lib/i18n/format";

type TestResult =
  | { ok: true; plan: string; characterCount: number; characterLimit: number }
  | { ok: false; message: string };

// Client-side failures keep a stable kind and are translated at render time;
// server-provided `message` text stays opaque.
type TestOutcome = TestResult | { ok: false; failure: "http"; status: number } | { ok: false; failure: "unreachable" };

type Props = {
  editingAccount: Account;
  isExistingAccount: boolean;
  canSave: boolean;
  onUpdateAccount: (next: Account) => void;
  onClose: () => void;
  onSave: () => void;
  apiFetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

export default function TranslationTabContent({
  editingAccount,
  isExistingAccount,
  canSave,
  onUpdateAccount,
  onClose,
  onSave,
  apiFetch
}: Props) {
  const [testing, setTesting] = useState(false);
  const t = useTranslations("Settings");
  const languageLabel = useDeeplLanguageLabel();
  const locale = useLocale();
  const [testResult, setTestResult] = useState<TestOutcome | null>(null);
  const saveDisabled = !isExistingAccount || !canSave;

  const deepl = editingAccount.deepl;
  const enabled = deepl?.enabled ?? false;
  const targetLang = deepl?.targetLang ?? DEFAULT_DEEPL_TARGET_LANG;
  // A key is available if one was typed into the form, or one is already stored
  // server-side (the field is blank by design, but `hasApiKey` is surfaced).
  const keyAvailable = Boolean(deepl?.apiKey?.trim()) || Boolean(deepl?.hasApiKey);

  const updateDeepl = (patch: Partial<DeeplConfig>) => {
    const next: DeeplConfig = { ...(deepl ?? {}), ...patch };
    onUpdateAccount({ ...editingAccount, deepl: next });
  };

  const clearDeepl = () => {
    onUpdateAccount({ ...editingAccount, deepl: undefined });
    setTestResult(null);
  };

  const fetchFn = apiFetch ?? fetch;

  const handleTestKey = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetchFn(buildAccountTranslationTestPath(editingAccount.id), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: deepl?.apiKey ?? "" })
      });
      // A non-JSON error body (e.g. an HTML 500) parses to null — report it as a
      // server error with the status rather than masking it as a network error.
      const data = (await res.json().catch(() => null)) as TestResult | null;
      setTestResult(data ?? { ok: false, failure: "http", status: res.status });
    } catch {
      setTestResult({ ok: false, failure: "unreachable" });
    } finally {
      setTesting(false);
    }
  };

  const testResultText = (result: TestOutcome) => {
    if (result.ok) {
      return t("translation.keyValid", {
        plan: result.plan,
        used: formatNumber(result.characterCount, locale),
        limit: formatNumber(result.characterLimit, locale)
      });
    }
    if ("failure" in result) {
      return result.failure === "http"
        ? t("translation.testHttpFailed", { status: result.status })
        : t("translation.testUnreachable");
    }
    return result.message;
  };

  return (
    <Flex direction="column" gap="4" style={{ height: "100%", minHeight: 0 }}>
      <Flex direction="column" gap="4" style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto" }}>
        <Flex align="center" gap="2">
          <Languages size={18} />
          <Text size="3" weight="medium">
            {t("translation.heading")}
          </Text>
          <Badge size="1" color="gray" variant="soft">
            {t("common.optional")}
          </Badge>
        </Flex>

        <Field
          label={t("translation.apiKey")}
          hint={t("translation.apiKeyHint")}
        >
          <PasswordField
            value={deepl?.apiKey ?? ""}
            onChange={(e) => updateDeepl({ apiKey: e.target.value })}
            placeholder={
              deepl?.hasApiKey ? t("translation.apiKeySavedPlaceholder") : t("translation.apiKeyPlaceholder")
            }
            autoComplete="off"
            style={{ width: "100%" }}
          />
        </Field>

        <Field label={t("translation.enable")} hint={t("translation.enableHint")}>
          <Flex asChild align="center" gap="2">
            <label>
              <Switch
                size="1"
                checked={enabled}
                onCheckedChange={(checked) => updateDeepl({ enabled: checked })}
              />
              <Text size="2">{t("translation.enableSwitch")}</Text>
            </label>
          </Flex>
        </Field>

        <Field label={t("translation.targetLanguage")} hint={t("translation.targetLanguageHint")}>
          <Select.Root value={targetLang} onValueChange={(v) => updateDeepl({ targetLang: v })}>
            <Select.Trigger style={{ width: "100%" }} />
            <Select.Content position="popper">
              {DEEPL_TARGET_LANGUAGES.map((language) => (
                <Select.Item key={language.code} value={language.code}>
                  {languageLabel(language.code)}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
        </Field>

        <Flex gap="2" align="center" wrap="wrap">
          <Button
            size="2"
            variant="soft"
            onClick={handleTestKey}
            disabled={testing || !keyAvailable}
          >
            {testing ? t("translation.testing") : t("translation.testKey")}
          </Button>
          {deepl ? (
            <Button size="2" variant="soft" color="red" onClick={clearDeepl}>
              {t("translation.remove")}
            </Button>
          ) : null}
        </Flex>

        {testResult !== null && (
          <Callout.Root color={testResult.ok ? "green" : "red"} size="1">
            <Callout.Icon>
              {testResult.ok ? <CheckCircle size={14} /> : <XCircle size={14} />}
            </Callout.Icon>
            <Callout.Text>
              {testResultText(testResult)}
            </Callout.Text>
          </Callout.Root>
        )}

        {enabled && !keyAvailable && (
          <Callout.Root color="amber" size="1" variant="soft">
            <Callout.Icon>
              <Info size={14} />
            </Callout.Icon>
            <Callout.Text>{t("translation.missingKey")}</Callout.Text>
          </Callout.Root>
        )}

        <Callout.Root color="gray" size="1" variant="soft">
          <Callout.Icon>
            <Info size={14} />
          </Callout.Icon>
          <Callout.Text>{t("translation.privacy")}</Callout.Text>
        </Callout.Root>
      </Flex>

      <Flex
        justify="end"
        align="center"
        gap="3"
        wrap="wrap"
        style={{ paddingTop: "var(--space-3)", borderTop: "1px solid var(--gray-a5)" }}
      >
        <Button size="2" variant="soft" color="gray" onClick={onClose}>
          {saveDisabled ? t("close") : t("common.cancel")}
        </Button>
        <Button size="2" onClick={onSave} disabled={saveDisabled}>
          {t("common.save")}
        </Button>
      </Flex>
    </Flex>
  );
}
