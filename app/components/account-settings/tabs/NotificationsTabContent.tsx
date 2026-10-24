"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, Button, Callout, Card, Checkbox, Flex, Switch, Text } from "@radix-ui/themes";
import { Info } from "lucide-react";
import type { Account } from "@/lib/data";
import type { AdminFetch } from "@/app/hooks/useAdminApi";
import { nativeControlBaseClass } from "@/app/components/account-settings/Field";
import { DEFAULT_APP_TITLE } from "@/lib/appBranding";
import { formatDate, formatTime } from "@/lib/i18n/format";
import type { UiLocale } from "@/lib/i18n/config";
import type { PushDeviceSettings } from "@/lib/push/types";
import {
  describeUserAgent, disablePushSubscription, ensurePushSubscription, fetchVapidPublicKey, listPushDevices,
  pushAvailability, removePushDevice, sendTestPush, syncPushSubscription, updatePushDevice,
  type PushAvailability, type PushDevice
} from "@/lib/push/client";

type Mailbox = Pick<Account, "id" | "name" | "email">;
type Notice = { kind: "status" | "alert"; text: string } | null;

const DEFAULT_QUIET_HOURS = { from: "22:00", to: "07:00" };

/**
 * Per-device Web Push settings. Lives in the mailbox settings next to the
 * personal preferences, but applies to the signed-in user across mailboxes.
 */
export default function NotificationsTabContent({ mailboxes, apiFetch = fetch }: { mailboxes: Mailbox[]; apiFetch?: AdminFetch }) {
  const t = useTranslations("Settings.notifications");
  const [availability, setAvailability] = useState<PushAvailability>(() => pushAvailability());
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [devices, setDevices] = useState<PushDevice[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  // Latest PUT per device wins; older responses must not overwrite newer edits.
  const writes = useRef(new Map<string, number>());

  const reload = useCallback(async () => setDevices(await listPushDevices(apiFetch)), [apiFetch]);

  useEffect(() => {
    let active = true;
    void (async () => {
      const publicKey = await fetchVapidPublicKey(apiFetch);
      if (!active) return;
      setConfigured(Boolean(publicKey));
      if (!publicKey) return;
      const current = await syncPushSubscription(apiFetch).catch(() => null);
      const list = await listPushDevices(apiFetch);
      if (!active) return;
      setDevices(list);
      if (current) { setCurrentId(current.id); setExpanded(current.id); }
    })().catch(() => { if (active) setLoadFailed(true); });
    return () => { active = false; };
  }, [apiFetch]);

  const enable = async () => {
    setBusy(true); setNotice(null);
    try {
      const result = await ensurePushSubscription(undefined, apiFetch);
      if (result.status === "subscribed") {
        setCurrentId(result.id); setExpanded(result.id); await reload();
      } else if (result.status === "not-configured") setConfigured(false);
      else if (result.status === "dismissed") setNotice({ kind: "alert", text: t("dismissed") });
      else setAvailability(result.status);
    } catch {
      setNotice({ kind: "alert", text: t("failed") });
    } finally { setBusy(false); }
  };

  const disable = async () => {
    setBusy(true); setNotice(null);
    try {
      await disablePushSubscription(apiFetch);
      setCurrentId(null); await reload();
    } catch {
      setNotice({ kind: "alert", text: t("failed") });
    } finally { setBusy(false); }
  };

  const changeSettings = async (device: PushDevice, settings: PushDeviceSettings) => {
    const sequence = (writes.current.get(device.id) ?? 0) + 1;
    writes.current.set(device.id, sequence);
    setNotice(null);
    setDevices(list => list.map(item => item.id === device.id ? { ...item, settings } : item));
    try {
      const stored = await updatePushDevice(apiFetch, device.id, settings);
      if (writes.current.get(device.id) !== sequence) return;
      setDevices(list => list.map(item => item.id === device.id ? { ...item, settings: stored } : item));
      setNotice({ kind: "status", text: t("saved") });
    } catch {
      if (writes.current.get(device.id) !== sequence) return;
      setDevices(list => list.map(item => item.id === device.id ? { ...item, settings: device.settings } : item));
      setNotice({ kind: "alert", text: t("failed") });
    }
  };

  const test = async (device: PushDevice) => {
    setNotice(null);
    try {
      const result = await sendTestPush(apiFetch, device.id);
      setNotice(result.sent > 0 ? { kind: "status", text: t("testSent") } : { kind: "alert", text: t("testFailed") });
    } catch {
      setNotice({ kind: "alert", text: t("testFailed") });
    }
  };

  const remove = async (device: PushDevice) => {
    setBusy(true); setNotice(null);
    try {
      if (device.id === currentId) { await disablePushSubscription(apiFetch); setCurrentId(null); }
      else await removePushDevice(apiFetch, device.id);
      await reload();
    } catch {
      setNotice({ kind: "alert", text: t("failed") });
    } finally { setBusy(false); }
  };

  if (loadFailed) return <Text size="2" color="red" role="alert">{t("loadFailed")}</Text>;
  if (configured === null) return <Text size="2" role="status">{t("loading")}</Text>;
  return (
    <Flex direction="column" gap="4" p="2" style={{ maxWidth: 640 }}>
      <Text size="3" weight="medium">{t("title")}</Text>
      <Text size="2" color="gray">{t("help", { app: DEFAULT_APP_TITLE })}</Text>
      {!configured ? <Hint text={t("notConfigured")} /> : <>
        <ThisDevice availability={availability} subscribed={currentId !== null} busy={busy} onEnable={() => void enable()} onDisable={() => void disable()} />
        {notice && <Text size="2" color={notice.kind === "alert" ? "red" : undefined} role={notice.kind}>{notice.text}</Text>}
        <Flex direction="column" gap="2" role="group" aria-label={t("devices")}>
          <Text size="2" weight="medium">{t("devices")}</Text>
          {devices.length === 0 && <Text size="2" color="gray">{t("noDevices")}</Text>}
          {devices.map(device => <DeviceCard key={device.id} device={device} current={device.id === currentId} mailboxes={mailboxes} busy={busy}
            expanded={expanded === device.id} onToggle={() => setExpanded(open => open === device.id ? null : device.id)}
            onChange={settings => void changeSettings(device, settings)} onTest={() => void test(device)} onRemove={() => void remove(device)} />)}
        </Flex>
      </>}
    </Flex>
  );
}

function Hint({ text, color = "amber" }: { text: string; color?: "amber" | "red" }) {
  return <Callout.Root color={color} size="1"><Callout.Icon><Info size={14} /></Callout.Icon><Callout.Text>{text}</Callout.Text></Callout.Root>;
}

function ThisDevice({ availability, subscribed, busy, onEnable, onDisable }: {
  availability: PushAvailability; subscribed: boolean; busy: boolean; onEnable: () => void; onDisable: () => void;
}) {
  const t = useTranslations("Settings.notifications");
  if (availability === "unsupported") return <Hint text={t("unsupported")} />;
  if (availability === "denied") return <Hint text={t("denied")} color="red" />;
  if (availability === "install-required") return (
    <Callout.Root color="blue" size="1">
      <Callout.Icon><Info size={14} /></Callout.Icon>
      <Flex direction="column" gap="1">
        <Text size="2" weight="medium">{t("installTitle")}</Text>
        <Text size="2">{t("installHelp")}</Text>
        <ol className="m-0 list-decimal pl-5 text-sm hyphens-auto [overflow-wrap:break-word]">
          <li>{t("installStep1")}</li>
          <li>{t("installStep2")}</li>
          <li>{t("installStep3", { app: DEFAULT_APP_TITLE })}</li>
        </ol>
      </Flex>
    </Callout.Root>
  );
  return (
    <Text as="label" size="2">
      <Flex gap="2" align="center">
        <Switch checked={subscribed} disabled={busy} onCheckedChange={checked => checked ? onEnable() : onDisable()} />
        {busy && !subscribed ? t("enabling") : t("enable")}
      </Flex>
    </Text>
  );
}

function DeviceCard({ device, current, mailboxes, busy, expanded, onToggle, onChange, onTest, onRemove }: {
  device: PushDevice; current: boolean; mailboxes: Mailbox[]; busy: boolean; expanded: boolean;
  onToggle: () => void; onChange: (settings: PushDeviceSettings) => void; onTest: () => void; onRemove: () => void;
}) {
  const t = useTranslations("Settings.notifications");
  const locale = useLocale() as UiLocale;
  const name = describeUserAgent(device.userAgent) ?? t("unknownDevice");
  const seen = device.lastSeenAt ?? device.createdAt;
  return (
    <Card>
      <Flex direction="column" gap="3">
        <Flex align="center" justify="between" gap="3" wrap="wrap">
          <Flex direction="column" gap="1" style={{ minWidth: 0 }}>
            <Flex align="center" gap="2" wrap="wrap"><Text size="2" weight="medium">{name}</Text>{current && <Badge color="green">{t("currentDevice")}</Badge>}</Flex>
            <Text size="1" color="gray">{t("lastSeen", { date: `${formatDate(seen, locale)} ${formatTime(seen, locale)}` })}</Text>
          </Flex>
          <Flex gap="2" wrap="wrap">
            <Button size="1" variant="soft" aria-expanded={expanded} onClick={onToggle}>{expanded ? t("hideSettings") : t("showSettings")}</Button>
            <Button size="1" variant="soft" onClick={onTest}>{t("test")}</Button>
            <Button size="1" variant="soft" color="red" disabled={busy} aria-label={t("removeDevice", { device: name })} onClick={onRemove}>{t("remove")}</Button>
          </Flex>
        </Flex>
        {expanded && <DeviceSettingsForm label={t("settingsFor", { device: name })} settings={device.settings} mailboxes={mailboxes} onChange={onChange} />}
      </Flex>
    </Card>
  );
}

function DeviceSettingsForm({ label, settings, mailboxes, onChange }: {
  label: string; settings: PushDeviceSettings; mailboxes: Mailbox[]; onChange: (settings: PushDeviceSettings) => void;
}) {
  const t = useTranslations("Settings.notifications");
  const all = settings.accountIds === "all";
  const selected = all ? mailboxes.map(mailbox => mailbox.id) : settings.accountIds as string[];
  const quiet = settings.quietHours;
  const setQuiet = (patch: Partial<{ from: string; to: string }>) => quiet && onChange({ ...settings, quietHours: { ...quiet, ...patch } });
  return (
    <Flex direction="column" gap="3" role="group" aria-label={label}>
      <Flex direction="column" gap="2" role="group" aria-label={t("mailboxes")}>
        <Text size="2" weight="medium">{t("mailboxes")}</Text>
        <Text as="label" size="2" style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
          <Checkbox checked={all} onCheckedChange={checked => onChange({ ...settings, accountIds: checked ? "all" : mailboxes.map(mailbox => mailbox.id) })} />
          {t("allMailboxes")}
        </Text>
        {!all && mailboxes.map(mailbox => (
          <Text as="label" size="2" key={mailbox.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", overflowWrap: "anywhere", paddingLeft: "var(--space-5)" }}>
            <Checkbox checked={selected.includes(mailbox.id)}
              onCheckedChange={checked => onChange({ ...settings, accountIds: checked ? [...new Set([...selected, mailbox.id])] : selected.filter(id => id !== mailbox.id) })} />
            {mailbox.name} ({mailbox.email})
          </Text>
        ))}
        {!all && selected.length === 0 && <Text size="1" color="amber">{t("noMailboxSelected")}</Text>}
      </Flex>
      <Text as="label" size="2">
        <Flex gap="2" align="center"><Switch checked={settings.includeSubject} onCheckedChange={includeSubject => onChange({ ...settings, includeSubject })} />{t("includeSubject")}</Flex>
      </Text>
      <Text size="1" color="gray" style={{ marginTop: "calc(-1 * var(--space-2))" }}>{t("includeSubjectHelp")}</Text>
      <Text as="label" size="2">
        <Flex gap="2" align="center"><Switch checked={settings.badge} onCheckedChange={badge => onChange({ ...settings, badge })} />{t("badge")}</Flex>
      </Text>
      <Text as="label" size="2">
        <Flex gap="2" align="center"><Switch checked={quiet !== null} onCheckedChange={checked => onChange({
          ...settings, quietHours: checked ? { ...DEFAULT_QUIET_HOURS, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone } : null
        })} />{t("quietHours")}</Flex>
      </Text>
      {quiet && <Flex direction="column" gap="1" pl="5">
        <Flex gap="3" align="center" wrap="wrap">
          <label className="flex items-center gap-2 text-sm">{t("quietFrom")}
            <input type="time" className={nativeControlBaseClass} value={quiet.from} required onChange={event => event.target.value && setQuiet({ from: event.target.value })} /></label>
          <label className="flex items-center gap-2 text-sm">{t("quietTo")}
            <input type="time" className={nativeControlBaseClass} value={quiet.to} required onChange={event => event.target.value && setQuiet({ to: event.target.value })} /></label>
        </Flex>
        <Text size="1" color="gray">{t("quietHelp", { zone: quiet.timeZone })}</Text>
      </Flex>}
    </Flex>
  );
}
