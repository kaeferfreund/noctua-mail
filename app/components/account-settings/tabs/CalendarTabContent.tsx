"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge, Button, Callout, Flex, Grid, Select, Text, TextField } from "@radix-ui/themes";
import { CheckCircle, Info, XCircle } from "lucide-react";
import Field from "@/app/components/account-settings/Field";
import PasswordField from "@/app/components/PasswordField";
import type { Account, CaldavConfig } from "@/lib/data";

type TestResult = { ok: true; calendars: { displayName?: string; url: string }[] } | { ok: false; message: string };
// A client-side connection failure is translated at render time; server `message` text stays opaque.
type TestOutcome = TestResult | { ok: false; failure: "connection" };

// The stored value is milliseconds; the label is derived from the amount and unit.
const SYNC_INTERVAL_OPTIONS = [
  { value: "60000", unit: "minutes", count: 1 },
  { value: "300000", unit: "minutes", count: 5 },
  { value: "900000", unit: "minutes", count: 15 },
  { value: "1800000", unit: "minutes", count: 30 },
  { value: "3600000", unit: "hours", count: 1 }
] as const;

type Props = {
  editingAccount: Account;
  isExistingAccount: boolean;
  canSave: boolean;
  onUpdateAccount: (next: Account) => void;
  onClose: () => void;
  onSave: () => void;
};

export default function CalendarTabContent({
  editingAccount,
  isExistingAccount,
  canSave,
  onUpdateAccount,
  onClose,
  onSave
}: Props) {
  const [testing, setTesting] = useState(false);
  const t = useTranslations("Settings");
  const [testResult, setTestResult] = useState<TestOutcome | null>(null);
  const saveDisabled = !isExistingAccount || !canSave;

  const caldav = editingAccount.caldav;

  const updateCaldav = (patch: Partial<CaldavConfig>) => {
    const next: CaldavConfig = {
      url: caldav?.url ?? "",
      user: caldav?.user ?? "",
      password: caldav?.password ?? "",
      ...caldav,
      ...patch
    };
    onUpdateAccount({ ...editingAccount, caldav: next });
  };

  const clearCaldav = () => {
    onUpdateAccount({ ...editingAccount, caldav: undefined });
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/calendar/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: caldav?.url ?? "",
          user: caldav?.user ?? "",
          password: caldav?.password ?? ""
        })
      });
      const data = (await res.json()) as TestResult;
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, failure: "connection" });
    } finally {
      setTesting(false);
    }
  };

  const canTest = Boolean(caldav?.url?.trim() && caldav?.user?.trim() && caldav?.password?.trim());

  const weekStartsOn = editingAccount.settings?.calendar?.weekStartsOn ?? "monday";

  const updateWeekStartsOn = (value: "monday" | "sunday") => {
    onUpdateAccount({
      ...editingAccount,
      settings: {
        ...editingAccount.settings,
        calendar: {
          ...editingAccount.settings?.calendar,
          weekStartsOn: value
        }
      }
    });
  };

  const testResultText = (result: TestOutcome) => {
    if (result.ok) {
      return t("calendar.connected", {
        count: result.calendars.length,
        // Calendar display names and URLs are user/server content and stay untranslated.
        names: result.calendars.map((c) => c.displayName ?? c.url).join(", ")
      });
    }
    return "failure" in result ? t("calendar.connectionFailed") : result.message;
  };

  return (
    <Flex direction="column" gap="4" style={{ height: "100%", minHeight: 0 }}>
      <Flex direction="column" gap="4" style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto" }}>
        <Flex direction="column" gap="3">
          <Text size="3" weight="medium">
            {t("calendar.appearance")}
          </Text>
          <Field label={t("calendar.weekStartsOn")}>
            <Select.Root value={weekStartsOn} onValueChange={(v) => updateWeekStartsOn(v as "monday" | "sunday")}>
              <Select.Trigger style={{ width: "100%" }} />
              <Select.Content position="popper">
                <Select.Item value="monday">{t("calendar.monday")}</Select.Item>
                <Select.Item value="sunday">{t("calendar.sunday")}</Select.Item>
              </Select.Content>
            </Select.Root>
          </Field>
        </Flex>

        <Flex direction="column" gap="3">
          <Flex align="center" gap="2">
            <Text size="3" weight="medium">
              {t("calendar.caldavHeading")}
            </Text>
            <Badge size="1" color="gray" variant="soft">
              {t("common.optional")}
            </Badge>
          </Flex>
          <Grid columns="2" gap="3">
            <Field label={t("calendar.serverUrl")} hint={t("calendar.serverUrlHint")}>
              <TextField.Root
                value={caldav?.url ?? ""}
                onChange={(e) => updateCaldav({ url: e.target.value })}
                placeholder="https://caldav.example.com/"
                style={{ width: "100%" }}
              />
            </Field>
            <Field label={t("calendar.username")}>
              <TextField.Root
                value={caldav?.user ?? ""}
                onChange={(e) => updateCaldav({ user: e.target.value })}
                placeholder="user@example.com"
                autoComplete="off"
                style={{ width: "100%" }}
              />
            </Field>
            <Field label={t("calendar.password")}>
              <PasswordField
                value={caldav?.password ?? ""}
                onChange={(e) => updateCaldav({ password: e.target.value })}
                placeholder={t("calendar.passwordPlaceholder")}
                autoComplete="new-password"
                style={{ width: "100%" }}
              />
            </Field>
            <Field label={t("calendar.calendarPath")} hint={t("calendar.calendarPathHint")}>
              <TextField.Root
                value={caldav?.calendarPath ?? ""}
                onChange={(e) =>
                  updateCaldav({ calendarPath: e.target.value || undefined })
                }
                placeholder="/principals/user/calendar/"
                style={{ width: "100%" }}
              />
            </Field>
            <Field label={t("calendar.syncInterval")}>
              <Select.Root
                value={String(caldav?.syncIntervalMs ?? "300000")}
                onValueChange={(v) =>
                  updateCaldav({ syncIntervalMs: Number(v) })
                }
              >
                <Select.Trigger style={{ width: "100%" }} />
                <Select.Content position="popper">
                  {SYNC_INTERVAL_OPTIONS.map((opt) => (
                    <Select.Item key={opt.value} value={opt.value}>
                      {opt.unit === "hours"
                        ? t("calendar.intervalHours", { count: opt.count })
                        : t("calendar.intervalMinutes", { count: opt.count })}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Field>
          </Grid>

          <Flex gap="2" align="center">
            <Button
              size="2"
              variant="soft"
              onClick={handleTestConnection}
              disabled={testing || !canTest}
            >
              {testing ? t("calendar.testing") : t("calendar.testConnection")}
            </Button>
            {caldav?.url ? (
              <Button size="2" variant="soft" color="red" onClick={clearCaldav}>
                {t("calendar.remove")}
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

          <Callout.Root color="gray" size="1" variant="soft">
            <Callout.Icon>
              <Info size={14} />
            </Callout.Icon>
            <Callout.Text>{t("calendar.optionalInfo")}</Callout.Text>
          </Callout.Root>
        </Flex>
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
