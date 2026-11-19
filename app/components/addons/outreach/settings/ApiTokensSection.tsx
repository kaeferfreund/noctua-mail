"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Badge, Button, Card, Checkbox, Flex, Text, TextField } from "@radix-ui/themes";
import { Check, Copy } from "lucide-react";
import type { ContactList, OutreachApiToken } from "@/lib/addons/outreach/types";
import { adminRequest, jsonMutation, type AdminFetch } from "@/app/hooks/useAdminApi";
import { formatDate } from "@/lib/i18n/format";
import { timeZone, type UiLocale } from "@/lib/i18n/config";
import TooltipIconButton from "@/app/components/TooltipIconButton";
import Field from "@/app/components/account-settings/Field";
import { outreachApiPath } from "../useOutreachStatus";

const TIMESTAMP: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone };

/**
 * API tokens for the subscribe interface (`POST /api/addons/outreach/subscribe`). Manager only;
 * the secret is answered once on creation and lives only in this component's state.
 */
export default function ApiTokensSection({ accountId, apiFetch }: { accountId: string; apiFetch: AdminFetch }) {
  const t = useTranslations("outreachTracking.tokens");
  const locale = useLocale() as UiLocale;
  const [tokens, setTokens] = useState<OutreachApiToken[]>([]);
  const [lists, setLists] = useState<ContactList[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [name, setName] = useState("");
  const [listIds, setListIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<{ name: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokingId, setRevokingId] = useState("");
  const [error, setError] = useState("");
  const copiedTimer = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      adminRequest<{ tokens: OutreachApiToken[] }>(apiFetch, outreachApiPath(accountId, "api-tokens")),
      adminRequest<{ lists: ContactList[] }>(apiFetch, outreachApiPath(accountId, "lists"))
    ]).then(([tokenData, listData]) => {
      if (!active) return;
      setTokens(tokenData.tokens ?? []);
      setLists((listData.lists ?? []).filter(list => list.archivedAt === null));
      setLoadState("ready");
    }, () => { if (active) setLoadState("error"); });
    return () => { active = false; };
  }, [accountId, apiFetch]);

  useEffect(() => () => { if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current); }, []);

  const listName = (id: string) => lists.find(list => list.id === id)?.name ?? t("unknownList");
  const when = (value: number) => formatDate(value, locale, TIMESTAMP);
  const activeTokens = tokens.filter(token => token.revokedAt === null);

  const create = async () => {
    const trimmed = name.trim();
    if (!trimmed || listIds.length === 0) return;
    setCreating(true);
    setError("");
    setCreated(null);
    try {
      const data = await adminRequest<{ token: OutreachApiToken; secret: string }>(apiFetch, outreachApiPath(accountId, "api-tokens"), jsonMutation("POST", { name: trimmed, listIds }));
      setTokens(current => [data.token, ...current.filter(token => token.id !== data.token.id)]);
      setCreated({ name: data.token.name, secret: data.secret });
      setCopied(false);
      setName("");
      setListIds([]);
    } catch {
      setError(t("createFailed"));
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (token: OutreachApiToken) => {
    if (!window.confirm(t("revokeConfirm", { name: token.name }))) return;
    setRevokingId(token.id);
    setError("");
    try {
      await adminRequest(apiFetch, outreachApiPath(accountId, `api-tokens/${encodeURIComponent(token.id)}`), { method: "DELETE" });
      setTokens(current => current.filter(item => item.id !== token.id));
    } catch {
      setError(t("revokeFailed"));
    } finally {
      setRevokingId("");
    }
  };

  const copySecret = async (secret: string) => {
    try {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => { setCopied(false); copiedTimer.current = null; }, 1200);
    } catch {
      // Clipboard denied: the secret stays visible for manual copying.
    }
  };

  return (
    <Card data-outreach-api-tokens="">
      <Flex direction="column" gap="3">
        <Text size="3" weight="medium">{t("heading")}</Text>
        <Text size="1" color="gray">{t.rich("intro", { code: chunks => <code>{chunks}</code>, endpoint: "POST /api/addons/outreach/subscribe" })}</Text>
        {loadState === "loading" && <Text size="2" color="gray" role="status">{t("loading")}</Text>}
        {loadState === "error" && <Text size="2" color="red" role="alert">{t("loadFailed")}</Text>}
        {loadState === "ready" && (
          <>
            <Field label={t("name")}>
              <TextField.Root value={name} maxLength={100} placeholder={t("namePlaceholder")} disabled={creating} onChange={event => setName(event.target.value)} />
            </Field>
            <Flex direction="column" gap="2" role="group" aria-label={t("lists")}>
              <Text size="2" weight="medium">{t("lists")}</Text>
              {lists.length === 0 && <Text size="1" color="gray">{t("noLists")}</Text>}
              {lists.map(list => (
                <Text as="label" size="2" key={list.id} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                  <Checkbox checked={listIds.includes(list.id)} disabled={creating}
                    onCheckedChange={checked => setListIds(current => checked ? [...new Set([...current, list.id])] : current.filter(id => id !== list.id))} />
                  <span data-user-text>{list.name}</span>
                </Text>
              ))}
            </Flex>
            <Flex align="center" gap="2" wrap="wrap">
              <Button onClick={() => void create()} disabled={creating || !name.trim() || listIds.length === 0}>
                {creating ? t("creating") : t("create")}
              </Button>
              <Text size="1" color="gray">{t("secretShownOnce")}</Text>
            </Flex>
            {created && (
              <Card variant="surface" data-outreach-token-secret="">
                <Flex direction="column" gap="2">
                  <Text size="2" weight="medium">{t("secretTitle", { name: created.name })}</Text>
                  <Text size="1" color="gray">{t("secretHint")}</Text>
                  <Flex align="center" gap="2">
                    <Text size="1" style={{ fontFamily: "var(--font-mono)", overflowWrap: "anywhere", minWidth: 0 }}>{created.secret}</Text>
                    <TooltipIconButton size="1" variant="soft" onClick={() => void copySecret(created.secret)} tooltip={copied ? t("copied") : t("copy")}>
                      {copied ? <Check size={14} /> : <Copy size={14} />}
                    </TooltipIconButton>
                  </Flex>
                </Flex>
              </Card>
            )}
            <Flex align="center" justify="between" style={{ marginTop: "var(--space-2)" }}>
              <Text size="2" weight="medium">{t("active")}</Text>
              <Badge color="gray" variant="soft">{activeTokens.length}</Badge>
            </Flex>
            {activeTokens.length === 0 && <Text size="2" color="gray">{t("none")}</Text>}
            {activeTokens.map(token => (
              <Card key={token.id} variant="surface">
                <Flex direction={{ initial: "column", sm: "row" }} gap="2" justify="between" align={{ initial: "stretch", sm: "start" }}>
                  <Flex direction="column" gap="1" style={{ minWidth: 0 }}>
                    <Text size="2" weight="medium" data-user-text>{token.name}</Text>
                    <Text size="1" style={{ overflowWrap: "anywhere" }}>{t("tokenLists", { lists: token.listIds.map(listName).join(", ") || "–" })}</Text>
                    <Text size="1" color="gray">{t("created", { date: when(token.createdAt) })}</Text>
                    <Text size="1" color="gray">{token.lastUsedAt === null ? t("neverUsed") : t("lastUsed", { date: when(token.lastUsedAt) })}</Text>
                  </Flex>
                  <Flex flexShrink="0">
                    <Button size="1" color="red" variant="soft" disabled={revokingId === token.id} onClick={() => void revoke(token)}>
                      {revokingId === token.id ? t("revoking") : t("revoke")}
                    </Button>
                  </Flex>
                </Flex>
              </Card>
            ))}
          </>
        )}
        {error && <Text size="2" color="red" role="alert">{error}</Text>}
      </Flex>
    </Card>
  );
}
