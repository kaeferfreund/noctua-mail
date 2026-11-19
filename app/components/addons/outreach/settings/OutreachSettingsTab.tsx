"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Callout, Card, Flex, Select, Switch, Text, TextArea, TextField } from "@radix-ui/themes";
import { Info } from "lucide-react";
import type { SenderIdentity } from "@/lib/data";
import { OUTREACH_TRANSPORTS, type OutreachAccountSettings, type OutreachSettingsPatch, type OutreachTransport } from "@/lib/addons/outreach/types";
import { adminRequest, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";
import Field from "@/app/components/account-settings/Field";
import { outreachApiPath, refreshOutreachStatus, useOutreachStatus } from "../useOutreachStatus";
import ApiTokensSection from "./ApiTokensSection";

type Props = {
  accountId: string;
  /** Mailbox managers edit; everybody else sees the settings read-only. */
  canManage: boolean;
  apiFetch?: AdminFetch;
  onClose: () => void;
};

/** Limits of `normalizeOutreachSettingsPatch` (lib/addons/outreach/settings.ts). */
const LIMITS = { ipRetentionDays: [0, 730], sendRatePerMinute: [1, 600], organizationName: 200, organizationAddress: 500 } as const;
const MAILBOX_SENDER = "__mailbox";

type Form = {
  enabled: boolean;
  transport: OutreachTransport;
  senderIdentityId: string | null;
  trackMailDefault: boolean;
  ipRetentionDays: string;
  sendRatePerMinute: string;
  organizationName: string;
  organizationAddress: string;
};

/** True when the identities were loaded and the stored default sender is not among them (deleted). */
function senderMissing(settings: OutreachAccountSettings, identities: SenderIdentity[] | null) {
  return identities !== null && settings.senderIdentityId !== null && !identities.some(identity => identity.id === settings.senderIdentityId);
}

/** The form for stored settings; a deleted default sender becomes "mailbox default", so saving does not store it again. */
function toForm(settings: OutreachAccountSettings, identities: SenderIdentity[] | null): Form {
  return {
    enabled: settings.enabled,
    transport: settings.transport,
    senderIdentityId: senderMissing(settings, identities) ? null : settings.senderIdentityId,
    trackMailDefault: settings.trackMailDefault,
    ipRetentionDays: String(settings.ipRetentionDays),
    sendRatePerMinute: String(settings.sendRatePerMinute),
    organizationName: settings.organizationName,
    organizationAddress: settings.organizationAddress
  };
}

function parseIntInRange(value: string, [min, max]: readonly [number, number]) {
  if (!/^\d+$/.test(value.trim())) return null;
  const number = Number(value.trim());
  return Number.isSafeInteger(number) && number >= min && number <= max ? number : null;
}

/** Valid patch for the form, or null when a number is out of range. */
function toPatch(form: Form): OutreachSettingsPatch | null {
  const ipRetentionDays = parseIntInRange(form.ipRetentionDays, LIMITS.ipRetentionDays);
  const sendRatePerMinute = parseIntInRange(form.sendRatePerMinute, LIMITS.sendRatePerMinute);
  if (ipRetentionDays === null || sendRatePerMinute === null) return null;
  return {
    enabled: form.enabled,
    transport: form.transport,
    senderIdentityId: form.senderIdentityId,
    trackMailDefault: form.trackMailDefault,
    ipRetentionDays,
    sendRatePerMinute,
    organizationName: form.organizationName.trim(),
    organizationAddress: form.organizationAddress.trim()
  };
}

/** „Newsletter & Tracking" in the mailbox settings. Mounted only while the server flag is on. */
export default function OutreachSettingsTab(props: Props) {
  return <OutreachSettingsForm key={props.accountId} {...props} />;
}

function OutreachSettingsForm({ accountId, canManage, apiFetch = fetch, onClose }: Props) {
  const t = useTranslations("outreachTracking.settings");
  const status = useOutreachStatus();
  const [settings, setSettings] = useState<OutreachAccountSettings | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  // null: the identities could not be loaded, so a stored sender is not known to be missing.
  const [identities, setIdentities] = useState<SenderIdentity[] | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ kind: "saved" | "error"; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      adminRequest<{ settings: OutreachAccountSettings }>(apiFetch, outreachApiPath(accountId, "settings")),
      // Sender identities only fill the picker; without them the mailbox default stays selectable.
      adminRequest<{ identities: SenderIdentity[] }>(apiFetch, `/api/accounts/${encodeURIComponent(accountId)}/identities`)
        .then(data => data.identities ?? [], () => null)
    ]).then(([data, list]) => {
      if (!active) return;
      setSettings(data.settings);
      setForm(toForm(data.settings, list));
      setIdentities(list);
      setLoadState("ready");
    }, () => { if (active) setLoadState("error"); });
    return () => { active = false; };
  }, [accountId, apiFetch]);

  const update = (patch: Partial<Form>) => {
    setForm(current => current ? { ...current, ...patch } : current);
    setNotice(null);
  };

  const patch = form ? toPatch(form) : null;
  // Against the stored values as they are, so a deleted sender replaced by "mailbox default" counts as a change.
  const dirty = Boolean(settings && form && JSON.stringify(toForm(settings, null)) !== JSON.stringify(form));
  const readOnly = !canManage || saving;

  const save = async () => {
    if (!canManage || !patch) return;
    setSaving(true);
    setNotice(null);
    try {
      const data = await adminRequest<{ settings: OutreachAccountSettings }>(apiFetch, outreachApiPath(accountId, "settings"), jsonMutation("PUT", patch));
      setSettings(data.settings);
      setForm(toForm(data.settings, identities));
      setNotice({ kind: "saved", text: t("saved") });
      // Compose switch, reader line and navigation read the activation from the shared status.
      void refreshOutreachStatus();
    } catch {
      setNotice({ kind: "error", text: t("saveFailed") });
    } finally {
      setSaving(false);
    }
  };

  const identityList = identities ?? [];
  const senderValue = form?.senderIdentityId && identityList.some(identity => identity.id === form.senderIdentityId) ? form.senderIdentityId : MAILBOX_SENDER;
  const showSenderMissing = Boolean(settings && form && senderMissing(settings, identities) && form.senderIdentityId === null);

  return (
    <Flex direction="column" gap="4" style={{ height: "100%", minHeight: 0 }} data-outreach-settings="">
      <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto", padding: "var(--space-2)" }}>
        <Flex direction="column" gap="4">
          <Text size="2" color="gray">{t("intro")}</Text>
          {!canManage && <Callout.Root size="1" color="gray"><Callout.Icon><Info size={14} /></Callout.Icon><Callout.Text>{t("readOnly")}</Callout.Text></Callout.Root>}
          {loadState === "loading" && <Text size="2" color="gray" role="status">{t("loading")}</Text>}
          {loadState === "error" && <Text size="2" color="red" role="alert">{t("loadFailed")}</Text>}
          {form && (
            <>
              <Card>
                <Flex direction="column" gap="4">
                  <Flex direction="column" gap="1">
                    <Text as="label" size="2" weight="medium" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <Switch checked={form.enabled} disabled={readOnly} onCheckedChange={enabled => update({ enabled })} />
                      {t("enabled")}
                    </Text>
                    <Text size="1" color="gray">{t("enabledHint")}</Text>
                  </Flex>
                  {!status.trackingConfigured && status.loaded && (
                    <Callout.Root size="1" color="amber"><Callout.Icon><Info size={14} /></Callout.Icon><Callout.Text>{t("trackingMissing")}</Callout.Text></Callout.Root>
                  )}
                  <Flex direction="column" gap="1">
                    <Text as="label" size="2" weight="medium" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <Switch checked={form.trackMailDefault} disabled={readOnly} onCheckedChange={trackMailDefault => update({ trackMailDefault })} />
                      {t("trackMailDefault")}
                    </Text>
                    <Text size="1" color="gray">{t("trackMailDefaultHint")}</Text>
                  </Flex>
                </Flex>
              </Card>

              <Card>
                <Flex direction="column" gap="4">
                  <Text size="3" weight="medium">{t("sendingHeading")}</Text>
                  <Field label={t("transport")} hint={status.sesConfigured ? undefined : t("sesMissing")}>
                    <Select.Root value={form.transport} disabled={readOnly} onValueChange={value => update({ transport: value as OutreachTransport })}>
                      <Select.Trigger />
                      <Select.Content>
                        {OUTREACH_TRANSPORTS.map(value => <Select.Item key={value} value={value}>{t(`transports.${value}`)}</Select.Item>)}
                      </Select.Content>
                    </Select.Root>
                  </Field>
                  {showSenderMissing && (
                    <Callout.Root size="1" color="amber"><Callout.Icon><Info size={14} /></Callout.Icon><Callout.Text>{t("senderMissing")}</Callout.Text></Callout.Root>
                  )}
                  <Field label={t("sender")} hint={t("senderHint")}>
                    <Select.Root value={senderValue} disabled={readOnly} onValueChange={value => update({ senderIdentityId: value === MAILBOX_SENDER ? null : value })}>
                      <Select.Trigger />
                      <Select.Content>
                        <Select.Item value={MAILBOX_SENDER}>{t("senderMailbox")}</Select.Item>
                        {identityList.filter(identity => identity.enabled || identity.id === form.senderIdentityId).map(identity => (
                          <Select.Item key={identity.id} value={identity.id}>
                            {identity.displayName ? `${identity.displayName} <${identity.email}>` : identity.email}
                          </Select.Item>
                        ))}
                      </Select.Content>
                    </Select.Root>
                  </Field>
                  <Field label={t("sendRate")} hint={t("sendRateHint", { min: LIMITS.sendRatePerMinute[0], max: LIMITS.sendRatePerMinute[1] })}>
                    <TextField.Root type="number" inputMode="numeric" min={LIMITS.sendRatePerMinute[0]} max={LIMITS.sendRatePerMinute[1]} step={1}
                      value={form.sendRatePerMinute} disabled={readOnly} onChange={event => update({ sendRatePerMinute: event.target.value })} />
                  </Field>
                  <Field label={t("ipRetention")} hint={t("ipRetentionHint", { max: LIMITS.ipRetentionDays[1] })}>
                    <TextField.Root type="number" inputMode="numeric" min={LIMITS.ipRetentionDays[0]} max={LIMITS.ipRetentionDays[1]} step={1}
                      value={form.ipRetentionDays} disabled={readOnly} onChange={event => update({ ipRetentionDays: event.target.value })} />
                  </Field>
                </Flex>
              </Card>

              <Card>
                <Flex direction="column" gap="4">
                  <Text size="3" weight="medium">{t("organizationHeading")}</Text>
                  <Text size="1" color="gray">{t("organizationHint")}</Text>
                  <Field label={t("organizationName")}>
                    <TextField.Root value={form.organizationName} maxLength={LIMITS.organizationName} disabled={readOnly}
                      onChange={event => update({ organizationName: event.target.value })} />
                  </Field>
                  <Field label={t("organizationAddress")}>
                    <TextArea value={form.organizationAddress} maxLength={LIMITS.organizationAddress} rows={3} disabled={readOnly}
                      onChange={event => update({ organizationAddress: event.target.value })} />
                  </Field>
                </Flex>
              </Card>

              {canManage && (settings?.enabled
                ? <ApiTokensSection accountId={accountId} apiFetch={apiFetch} />
                : <Text size="2" color="gray">{t("tokensAfterActivation")}</Text>)}
            </>
          )}
        </Flex>
      </div>

      <Flex align="center" justify="end" gap="3" wrap="wrap" style={{ paddingTop: "var(--space-3)", borderTop: "1px solid var(--gray-a5)", flexShrink: 0 }}>
        {notice && <Text size="2" color={notice.kind === "error" ? "red" : "green"} role={notice.kind === "error" ? "alert" : "status"}>{notice.text}</Text>}
        {form && !patch && <Text size="2" color="red" role="alert">{t("invalidNumbers")}</Text>}
        <Button size="2" variant="soft" color="gray" onClick={onClose}>{t("close")}</Button>
        {canManage && (
          <Button size="2" disabled={!dirty || !patch || saving} onClick={() => void save()}>
            {saving ? t("saving") : t("save")}
          </Button>
        )}
      </Flex>
    </Flex>
  );
}
