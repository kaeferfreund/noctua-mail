"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, Copy } from "lucide-react";
import { Badge, Button, Card, Checkbox, Flex, Select, Text, TextField } from "@radix-ui/themes";
import {
  buildAccountMcpTokenPath,
  buildAccountMcpTokensPath
} from "@/lib/accountApiPaths";
import type { AccountDateFormat } from "@/lib/data";
import { formatAccountIntl } from "@/lib/dateFormatting";
import { formatDate } from "@/lib/i18n/format";
import { timeZone, type UiLocale } from "@/lib/i18n/config";
import TooltipIconButton from "@/app/components/TooltipIconButton";
import { MCP_PERMISSION_MODES, mcpPermissionMode, mcpTokenListItem, type McpPermissionMode, type McpTokenListItem } from "@/lib/mcpPermissions";
import type { mintMcpToken } from "@/lib/mcpAuth";
import { authClient as defaultAuthClient, type NoctuaAuthClient } from "@/lib/authClient";
import ReauthDialog from "@/app/components/auth/ReauthDialog";

type Props = {
  accountId?: string;
  isActive: boolean;
  isExistingAccount: boolean;
  accountDateFormat?: AccountDateFormat;
  apiFetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  /** Collects the fresh factor proof that token creation requires. */
  authClient?: NoctuaAuthClient;
  onClose: () => void;
};

// The route spreads mintMcpToken's result. Keep that server dependency type-only.
type CreateTokenResponse = Partial<Awaited<ReturnType<typeof mintMcpToken>>> & {
  ok?: boolean;
  message?: string;
};

type ListTokensResponse = {
  ok?: boolean;
  tokens?: McpTokenListItem[];
  mailboxes?: { id: string; name: string; email: string }[];
  message?: string;
};

const EXPIRY_PRESETS = [
  { value: "30d", days: 30 },
  { value: "90d", days: 90 },
  { value: "180d", days: 180 },
  { value: "custom", days: null }
] as const;

const TIMESTAMP_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone
};
const PRESET_TIMESTAMP_OPTIONS: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  timeZone
};

/** UI-locale timestamp; an explicit account date-format preset keeps its numeric order. */
function formatTimestamp(value: number, locale: UiLocale, accountDateFormat?: AccountDateFormat) {
  const date = new Date(value);
  if (!accountDateFormat || accountDateFormat === "locale") return formatDate(date, locale, TIMESTAMP_OPTIONS);
  const options = accountDateFormat === "mdy"
    ? { ...PRESET_TIMESTAMP_OPTIONS, hour12: true }
    : { ...PRESET_TIMESTAMP_OPTIONS, hourCycle: "h23" as const };
  return formatAccountIntl(date, accountDateFormat, options, locale);
}

function toDateTimeLocalValue(value: number) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function ttlFromPreset(
  preset: (typeof EXPIRY_PRESETS)[number]["value"],
  customDateTime: string
) {
  if (preset === "custom") {
    return customDateTime ? Math.floor((new Date(customDateTime).getTime() - Date.now()) / 1000) : Number.NaN;
  }
  const days = Number.parseInt(preset, 10);
  if (!Number.isFinite(days) || days <= 0) return Number.NaN;
  return days * 24 * 60 * 60;
}

export default function McpTabContent(props: Props) {
  return <McpTokenSettings key={props.accountId} {...props} />;
}

function McpTokenSettings({
  accountId,
  isActive,
  isExistingAccount,
  accountDateFormat,
  apiFetch,
  authClient = defaultAuthClient,
  onClose
}: Props) {
  const t = useTranslations("Settings");
  const locale = useLocale();
  const request = apiFetch ?? fetch;
  const [tokens, setTokens] = useState<McpTokenListItem[]>([]);
  const [mailboxes, setMailboxes] = useState<NonNullable<ListTokensResponse["mailboxes"]>>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>(accountId ? [accountId] : []);
  const [mode, setMode] = useState<McpPermissionMode>("drafts");
  const [label, setLabel] = useState("");
  const [expiryPreset, setExpiryPreset] = useState<(typeof EXPIRY_PRESETS)[number]["value"]>("180d");
  const [customExpiresAt, setCustomExpiresAt] = useState(() =>
    toDateTimeLocalValue(Date.now() + 180 * 24 * 60 * 60 * 1000)
  );
  const [createdSecret, setCreatedSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [error, setError] = useState("");
  const copyResetTimerRef = useRef<number | null>(null);
  const serverUrl = useMemo(() => {
    if (typeof window === "undefined") return "/api/mcp";
    return `${window.location.origin}/api/mcp`;
  }, []);

  const readError = useCallback(async (response: Response) => {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    return data?.message ?? t("mcp.requestFailed", { status: response.status });
  }, [t]);

  const loadTokens = useCallback(async () => {
    if (!accountId) {
      setTokens([]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await request(buildAccountMcpTokensPath(accountId), { cache: "no-store" });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      const data = (await response.json()) as ListTokensResponse;
      setTokens(data.ok && Array.isArray(data.tokens) ? data.tokens : []);
      setMailboxes(data.ok && Array.isArray(data.mailboxes) ? data.mailboxes : []);
    } catch {
      setError(t("mcp.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [accountId, readError, request, t]);

  useEffect(() => {
    if (isActive && isExistingAccount) {
      // Synchronize remote metadata when the tab opens; the request owns loading/error state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void loadTokens();
    }
    return () => { setCreatedSecret(""); setCopiedValue(null); };
  }, [isActive, isExistingAccount, loadTokens]);

  useEffect(() => {
    return () => {
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async (value: string) => {
    const normalized = value.trim();
    if (!normalized) return;
    try {
      await navigator.clipboard.writeText(normalized);
      setCopiedValue(normalized);
      if (copyResetTimerRef.current !== null) {
        window.clearTimeout(copyResetTimerRef.current);
      }
      copyResetTimerRef.current = window.setTimeout(() => {
        setCopiedValue((current) => (current === normalized ? null : current));
        copyResetTimerRef.current = null;
      }, 1200);
    } catch {
      // ignore
    }
  }, []);

  const validTtl = useCallback(() => {
    const ttlSeconds = ttlFromPreset(expiryPreset, customExpiresAt);
    return Number.isSafeInteger(ttlSeconds) && ttlSeconds >= 60 && ttlSeconds <= 31_536_000 ? ttlSeconds : null;
  }, [customExpiresAt, expiryPreset]);

  /** Check the input before asking for the password and authenticator code. */
  const requestCreate = useCallback(() => {
    setError("");
    if (validTtl() === null) { setError(t("mcp.invalidExpiry")); return; }
    setVerifying(true);
  }, [validTtl, t]);

  const handleCreate = useCallback(async (grant: string) => {
    if (!accountId) return;
    setCreating(true);
    setError("");
    setCreatedSecret("");
    try {
      const ttlSeconds = validTtl();
      if (ttlSeconds === null) {
        setError(t("mcp.invalidExpiry"));
        return;
      }
      const response = await request(buildAccountMcpTokensPath(accountId), {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-noctua-reauth": grant },
        body: JSON.stringify({
          label,
          ttlSeconds,
          accountIds: selectedAccountIds,
          mode
        })
      });
      const data = (await response.json().catch(() => null)) as CreateTokenResponse | null;
      if (!response.ok || !data?.ok || typeof data.token !== "string" || !data.tokenRecord?.id) {
        setError(data?.message ?? t("mcp.createFailed"));
        return;
      }
      const tokenRecord = mcpTokenListItem(data.tokenRecord, new Set(selectedAccountIds));
      setTokens((current) => [tokenRecord, ...current.filter((item) => item.id !== tokenRecord.id)]);
      setCreatedSecret(data.token);
      await loadTokens();
      setLabel("");
      setExpiryPreset("180d");
      setCustomExpiresAt(toDateTimeLocalValue(Date.now() + 180 * 24 * 60 * 60 * 1000));
    } catch {
      setError(t("mcp.createFailed"));
    } finally {
      setCreating(false);
    }
  }, [accountId, validTtl, label, selectedAccountIds, mode, request, loadTokens, t]);

  /** Names of accessible covered mailboxes plus a count for the rest; `exclude` drops the current tab's mailbox. */
  const describeMailboxes = useCallback((token: McpTokenListItem, exclude?: string) => [
    ...token.accountIds.filter(id => id !== exclude).map(id => {
      const mailbox = mailboxes.find(item => item.id === id);
      return mailbox ? `${mailbox.name} (${mailbox.email})` : id;
    }),
    ...(token.hiddenMailboxCount > 0 ? [t("mcp.tokenMailboxesHidden", { count: token.hiddenMailboxCount })] : [])
  ].join(", "), [mailboxes, t]);

  const handleDelete = useCallback(async (token: McpTokenListItem) => {
    if (!accountId) return;
    const tokenId = token.id;
    // Deleting revokes the token for every covered mailbox, not just this tab's.
    const others = describeMailboxes(token, accountId);
    const confirmed = window.confirm(others ? t("mcp.deleteConfirmShared", { mailboxes: others }) : t("mcp.deleteConfirm"));
    if (!confirmed) return;
    setDeletingId(tokenId);
    setError("");
    try {
      const response = await request(buildAccountMcpTokenPath(accountId, tokenId), {
        method: "DELETE"
      });
      if (!response.ok) {
        setError(await readError(response));
        return;
      }
      setTokens((current) => current.filter((item) => item.id !== tokenId));
    } catch {
      setError(t("mcp.deleteFailed"));
    } finally {
      setDeletingId("");
    }
  }, [accountId, describeMailboxes, readError, request, t]);

  if (!isExistingAccount) {
    return null;
  }

  const timestampLabel = (value: number | null) =>
    value == null || !Number.isFinite(value) ? t("mcp.never") : formatTimestamp(value, locale, accountDateFormat);

  return (
    <Flex direction="column" gap="4" style={{ height: "100%", minHeight: 0 }}>
      <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto", padding: "var(--space-2)" }}>
        <Card>
          <Flex direction="column" gap="3">
            <Text size="3" weight="medium">{t("mcp.serverHeading")}</Text>
            <Text size="2" color="gray">
              {t.rich("mcp.endpointHint", {
                header: "Authorization: Bearer <token>",
                code: (chunks) => <code>{chunks}</code>
              })}
            </Text>
            {/* The URL wraps beside its copy button instead of widening the card on phones. */}
            <Flex align="center" gap="2">
              <Text size="2" title={serverUrl} style={{ fontFamily: "var(--font-mono)", minWidth: 0, overflowWrap: "anywhere" }}>
                {serverUrl}
              </Text>
              <TooltipIconButton
                size="1"
                variant="soft"
                onClick={() => void handleCopy(serverUrl)}
                tooltip={copiedValue === serverUrl ? t("mcp.copiedServerUrl") : t("mcp.copyServerUrl")}
              >
                {copiedValue === serverUrl ? <Check size={14} /> : <Copy size={14} />}
              </TooltipIconButton>
            </Flex>
          </Flex>
        </Card>

        <Card style={{ marginTop: "var(--space-4)" }}>
          <Flex direction="column" gap="3">
            <Text size="3" weight="medium">{t("mcp.createHeading")}</Text>
            <Flex direction="column" gap="2">
              <Text size="2" color="gray">{t("mcp.label")}</Text>
              <TextField.Root
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={t("mcp.labelPlaceholder")}
              />
            </Flex>
            <Flex direction="column" gap="2" role="group" aria-label={t("mcp.mailboxes")}>
              <Text size="2" weight="medium">{t("mcp.mailboxes")}</Text>
              <Text size="1" color="gray">{t("mcp.primaryMailboxHint")}</Text>
              {mailboxes.map(mailbox => (
                <Text as="label" size="2" key={mailbox.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <Checkbox checked={selectedAccountIds.includes(mailbox.id)} disabled={mailbox.id === accountId || creating}
                    onCheckedChange={checked => setSelectedAccountIds(current => checked ? [...new Set([...current, mailbox.id])] : current.filter(id => id !== mailbox.id))} />
                  <span data-user-text>{mailbox.name} ({mailbox.email})</span>
                </Text>
              ))}
            </Flex>
            <Flex direction="column" gap="2" role="group" aria-label={t("mcp.permissionMode")}>
              <Text size="2" weight="medium">{t("mcp.permissionMode")}</Text>
              {MCP_PERMISSION_MODES.map(value => (
                <Text as="label" size="2" key={value} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <input type="radio" name={`mcp-mode-${accountId}`} value={value} checked={mode === value} disabled={creating} onChange={() => setMode(value)} />
                  {t(`mcp.mode.${value}`)}
                </Text>
              ))}
            </Flex>
            <Flex direction="column" gap="2">
              <Text size="2" color="gray">{t("mcp.expiry")}</Text>
              <Select.Root value={expiryPreset} onValueChange={(value) => setExpiryPreset(value as typeof expiryPreset)}>
                <Select.Trigger />
                <Select.Content>
                  {EXPIRY_PRESETS.map((preset) => (
                    <Select.Item key={preset.value} value={preset.value}>
                      {preset.days === null ? t("mcp.presetCustom") : t("mcp.presetDays", { days: preset.days })}
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Root>
            </Flex>
            {expiryPreset === "custom" && (
              <Flex direction="column" gap="2">
                <Text size="2" color="gray">{t("mcp.customExpiry")}</Text>
                <TextField.Root
                  type="datetime-local"
                  value={customExpiresAt}
                  onChange={(event) => setCustomExpiresAt(event.target.value)}
                />
              </Flex>
            )}
            <Flex align="center" gap="2" wrap="wrap">
              <Button
                onClick={requestCreate}
                disabled={!accountId || !label.trim() || creating || verifying}
              >
                {creating ? t("mcp.creating") : t("mcp.create")}
              </Button>
              <Text size="1" color="gray">
                {t("mcp.secretShownOnce")}
              </Text>
            </Flex>
            {createdSecret && (
              <Card variant="surface">
                <Flex direction="column" gap="2">
                  <Text size="2" weight="medium">{t("mcp.newToken")}</Text>
                  <Text size="1" color="gray">
                    {t("mcp.copyNow")}
                  </Text>
                  <Text
                    size="1"
                    style={{
                      fontFamily: "var(--font-mono)",
                      overflowWrap: "anywhere"
                    }}
                  >
                    {createdSecret}
                  </Text>
                  <Flex>
                    <TooltipIconButton
                      size="1"
                      variant="soft"
                      onClick={() => void handleCopy(createdSecret)}
                      tooltip={copiedValue === createdSecret ? t("mcp.copiedToken") : t("mcp.copyToken")}
                    >
                      {copiedValue === createdSecret ? <Check size={14} /> : <Copy size={14} />}
                    </TooltipIconButton>
                  </Flex>
                </Flex>
              </Card>
            )}
          </Flex>
        </Card>

        <Flex direction="column" gap="3" style={{ marginTop: "var(--space-4)" }}>
          <Flex align="center" justify="between">
            <Text size="3" weight="medium">{t("mcp.activeTokens")}</Text>
            <Badge color="gray" variant="soft">
              {tokens.length}
            </Badge>
          </Flex>
          {loading ? (
            <Text size="2" color="gray">{t("mcp.loadingTokens")}</Text>
          ) : tokens.length === 0 ? (
            <Text size="2" color="gray">{t("mcp.noTokens")}</Text>
          ) : (
            tokens.map((token) => (
              <Card key={token.id}>
                <Flex direction="column" gap="2">
                  <Flex align="center" justify="between" gap="3">
                    <Flex direction="column" gap="1">
                      <Text size="2" weight="medium">{token.label}</Text>
                      <Text size="1" color="gray">
                        {t.rich("mcp.tokenSuffix", {
                          suffix: token.tokenSuffix,
                          code: (chunks) => <code>{chunks}</code>
                        })}
                      </Text>
                    </Flex>
                    <Button
                      size="1"
                      color="red"
                      variant="soft"
                      disabled={deletingId === token.id}
                      onClick={() => void handleDelete(token)}
                    >
                      {deletingId === token.id ? t("mcp.deleting") : t("common.delete")}
                    </Button>
                  </Flex>
                  <Text size="1">{t(`mcp.mode.${mcpPermissionMode(token.scopes)}`)}</Text>
                  <Text size="1" style={{ overflowWrap: "anywhere" }}>{t("mcp.tokenMailboxes", { mailboxes: describeMailboxes(token) })}</Text>
                  <Text size="1" color="gray">{t("mcp.created", { date: timestampLabel(token.createdAt) })}</Text>
                  <Text size="1" color="gray">{t("mcp.expires", { date: timestampLabel(token.expiresAt) })}</Text>
                  <Text size="1" color="gray">{t("mcp.lastUsed", { date: timestampLabel(token.lastUsedAt) })}</Text>
                </Flex>
              </Card>
            ))
          )}
        </Flex>

        {error && (
          <Text size="2" color="red" style={{ marginTop: "var(--space-3)", display: "block" }}>
            {error}
          </Text>
        )}
      </div>

      <Flex
        justify="end"
        style={{ paddingTop: "var(--space-3)", borderTop: "1px solid var(--gray-a5)", flexShrink: 0 }}
      >
        <Button size="2" variant="soft" color="gray" onClick={onClose}>
          {t("close")}
        </Button>
      </Flex>
      {verifying && <ReauthDialog purpose="mcp.create" client={authClient} onCancel={() => setVerifying(false)} onVerified={async proof => {
        setVerifying(false);
        await handleCreate(proof.grant);
      }} />}
    </Flex>
  );
}
