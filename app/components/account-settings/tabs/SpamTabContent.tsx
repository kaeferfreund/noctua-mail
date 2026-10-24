"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Callout, Flex, Switch, Text, TextField } from "@radix-ui/themes";
import { Info } from "lucide-react";
import Field from "@/app/components/account-settings/Field";
import { adminRequest, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";

type MailboxSpamSettings = { settings: { autoMove?: boolean; threshold?: number }; globalThreshold: number; enabled: boolean };

/** Per-mailbox spam settings (admin only): auto-move to Junk and an optional own threshold. */
export default function SpamTabContent({ accountId, apiFetch = fetch }: { accountId: string; apiFetch?: AdminFetch }) {
  const t = useTranslations("Settings.spam");
  const url = `/api/admin/accounts/${encodeURIComponent(accountId)}/spam-settings`;
  const [data, setData] = useState<MailboxSpamSettings | null>(null);
  const [autoMove, setAutoMove] = useState(false);
  const [threshold, setThreshold] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "failed">("idle");

  useEffect(() => {
    let active = true;
    adminRequest<MailboxSpamSettings>(apiFetch, url).then((result) => {
      if (!active) return;
      setData(result);
      setAutoMove(result.settings.autoMove ?? false);
      setThreshold(result.settings.threshold === undefined ? "" : String(result.settings.threshold));
    }).catch(() => { if (active) setStatus("failed"); });
    return () => { active = false; };
  }, [apiFetch, url]);

  const save = async () => {
    setStatus("saving");
    const value = threshold.trim().replace(",", ".");
    try {
      const result = await adminRequest<MailboxSpamSettings>(apiFetch, url, jsonMutation("PUT", { autoMove, threshold: value ? Number(value) : null }));
      setData(result);
      setStatus("saved");
    } catch {
      setStatus("failed");
    }
  };

  if (!data) return <Text size="2" role={status === "failed" ? "alert" : "status"}>{status === "failed" ? t("failed") : t("loading")}</Text>;
  return (
    <Flex direction="column" gap="4" p="2" style={{ maxWidth: 560 }}>
      <Text size="3" weight="medium">{t("heading")}</Text>
      <Text size="2" color="gray">{t("help")}</Text>
      {!data.enabled && <Callout.Root color="amber" size="1"><Callout.Icon><Info size={14} /></Callout.Icon><Callout.Text>{t("globalOff")}</Callout.Text></Callout.Root>}
      <Text as="label" size="2"><Flex gap="2" align="center"><Switch checked={autoMove} onCheckedChange={setAutoMove} />{t("autoMove")}</Flex></Text>
      <Field label={t("threshold", { threshold: data.globalThreshold })} hint={t("thresholdHelp")}>
        <TextField.Root inputMode="decimal" value={threshold} placeholder={String(data.globalThreshold)} onChange={(event) => setThreshold(event.target.value)} />
      </Field>
      <Flex gap="3" align="center">
        <Button disabled={status === "saving"} onClick={() => void save()}>{t("save")}</Button>
        {status === "saved" && <Text size="2" role="status">{t("saved")}</Text>}
        {status === "failed" && <Text size="2" color="red" role="alert">{t("failed")}</Text>}
      </Flex>
    </Flex>
  );
}
