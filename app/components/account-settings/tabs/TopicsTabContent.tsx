"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { Badge, Button, Card, Flex, Switch, Text, TextField } from "@radix-ui/themes";
import {
  buildAccountTopicPath,
  buildAccountTopicSignalsPath,
  buildAccountTopicStatsPath,
  buildAccountTopicsPath,
  buildAccountTopicTransferPath
} from "@/lib/accountApiPaths";
import type { AccountSettings, Topic, TopicColor, TopicSuggestionSignal } from "@/lib/data";
import { topicColorToScale } from "@/lib/data";
import type { TopicStat, TopicTransferImportSummary } from "@/lib/topics";
import TopicColorPicker from "@/app/components/mailclient/TopicColorPicker";
import ImportReplaceConfirmDialog from "./ImportReplaceConfirmDialog";
import styles from "./TopicsTabContent.module.css";
import TooltipIconButton from "@/app/components/TooltipIconButton";

type Props = {
  accountId?: string;
  isActive: boolean;
  isExistingAccount: boolean;
  apiFetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  onTopicsChanged?: (topics: Topic[]) => void;
  topicColorRows?: boolean;
  onUpdateSettings?: (next: AccountSettings) => void;
  currentAppearance?: AccountSettings["appearance"];
  onClose?: () => void;
  onSave?: () => void;
  canSave?: boolean;
};

type TopicTransferExportResponse = {
  ok?: boolean;
  data?: unknown;
  message?: string;
};

type TopicTransferImportResponse = {
  ok?: boolean;
  summary?: TopicTransferImportSummary;
  message?: string;
};

export default function TopicsTabContent({
  accountId,
  isActive,
  isExistingAccount,
  apiFetch,
  onTopicsChanged,
  topicColorRows,
  onUpdateSettings,
  currentAppearance,
  onClose,
  onSave,
  canSave
}: Props) {
  const t = useTranslations("Settings");
  const request = apiFetch ?? fetch;
  const saveDisabled = !isExistingAccount || !canSave;
  const [topics, setTopics] = useState<Topic[]>([]);
  const [statsById, setStatsById] = useState<Map<string, TopicStat>>(new Map());
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editShortName, setEditShortName] = useState("");
  const [editColor, setEditColor] = useState<TopicColor | null>(null);
  const [newName, setNewName] = useState("");
  const [newShortName, setNewShortName] = useState("");
  const [newColor, setNewColor] = useState<TopicColor | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [removingSignalKey, setRemovingSignalKey] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const readError = useCallback(async (res: Response) => {
    try {
      const data = (await res.json()) as { message?: string; error?: string };
      return data?.message || data?.error || t("topics.requestFailed", { status: res.status });
    } catch {
      return t("topics.requestFailed", { status: res.status });
    }
  }, [t]);

  const loadTopics = useCallback(async () => {
    if (!accountId) return [];
    setLoading(true);
    try {
      const [topicsRes, statsRes] = await Promise.all([
        request(buildAccountTopicsPath(accountId)),
        request(buildAccountTopicStatsPath(accountId))
      ]);
      const topicsData = await topicsRes.json();
      const statsData = await statsRes.json();
      const nextTopics = topicsData.ok && Array.isArray(topicsData.topics) ? topicsData.topics : [];
      setTopics(nextTopics);
      if (statsData.ok && Array.isArray(statsData.stats)) {
        setStatsById(new Map((statsData.stats as TopicStat[]).map((s) => [s.topicId, s])));
      } else {
        setStatsById(new Map());
      }
      return nextTopics as Topic[];
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, [accountId, request]);

  useEffect(() => {
    if (isActive && isExistingAccount) loadTopics();
  }, [isActive, isExistingAccount, loadTopics]);

  const handleCreate = async () => {
    if (!newName.trim() || !accountId) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await request(buildAccountTopicsPath(accountId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), shortName: newShortName.trim(), color: newColor })
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message ?? t("topics.createFailed"));
        return;
      }
      const next = [...topics, data.topic].sort((a, b) => a.name.localeCompare(b.name));
      setTopics(next);
      onTopicsChanged?.(next);
      setNewName("");
      setNewShortName("");
      setShowCreate(false);
    } catch {
      setError(t("topics.createFailed"));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (topic: Topic) => {
    setEditingId(topic.id);
    setEditName(topic.name);
    setEditShortName(topic.shortName ?? "");
    setEditColor(topic.color);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditShortName("");
  };

  const handleSaveEdit = async (topicId: string) => {
    if (!accountId) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const res = await request(buildAccountTopicPath(accountId, topicId), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), shortName: editShortName.trim(), color: editColor })
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.message ?? t("topics.updateFailed"));
        return;
      }
      const next = topics
        .map((t) => (t.id === topicId ? data.topic : t))
        .sort((a, b) => a.name.localeCompare(b.name));
      setTopics(next);
      onTopicsChanged?.(next);
      setEditingId(null);
    } catch {
      setError(t("topics.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (topicId: string) => {
    if (!accountId) return;
    setError("");
    setNotice("");
    try {
      await request(buildAccountTopicPath(accountId, topicId), {
        method: "DELETE"
      });
      const next = topics.filter((t) => t.id !== topicId);
      setTopics(next);
      onTopicsChanged?.(next);
    } catch {
      setError(t("topics.deleteFailed"));
    }
  };

  const handleExport = useCallback(async () => {
    if (!accountId) return;
    setExporting(true);
    setError("");
    setNotice("");
    try {
      const res = await request(buildAccountTopicTransferPath(accountId));
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      const data = (await res.json()) as TopicTransferExportResponse;
      if (!data?.ok || !data.data) {
        setError(data?.message ?? t("topics.exportFailed"));
        return;
      }

      const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `noctua-topics-${accountId}-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
      setNotice(t("topics.exported"));
    } catch {
      setError(t("topics.exportFailed"));
    } finally {
      setExporting(false);
    }
  }, [accountId, readError, request, t]);

  const handleRemoveSignal = useCallback(async (
    topicId: string,
    signalType: TopicSuggestionSignal,
    signalValue: string
  ) => {
    if (!accountId) return;
    const normalizedValue = signalValue.trim();
    if (!normalizedValue) return;

    const signalKey = `${topicId}\u0000${signalType}\u0000${normalizedValue}`;
    setRemovingSignalKey(signalKey);
    setError("");
    setNotice("");
    try {
      const res = await request(buildAccountTopicSignalsPath(accountId, topicId), {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signalType,
          signalValue: normalizedValue
        })
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      await loadTopics();
      setNotice(t("topics.signalRemoved"));
    } catch {
      setError(t("topics.removeSignalFailed"));
    } finally {
      setRemovingSignalKey("");
    }
  }, [accountId, loadTopics, readError, request, t]);

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
      const res = await request(buildAccountTopicTransferPath(accountId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: parsed })
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      const data = (await res.json()) as TopicTransferImportResponse;
      if (!data?.ok || !data.summary) {
        setError(data?.message ?? t("topics.importFailed"));
        return;
      }
      const nextTopics = await loadTopics();
      onTopicsChanged?.(nextTopics);
      setNotice(t("topics.imported", {
        topicCount: data.summary.topicCount,
        assignmentCount: data.summary.assignmentCount
      }));
    } catch (error) {
      setError(error instanceof SyntaxError ? t("topics.invalidJson") : t("topics.importFailed"));
    } finally {
      resetImportInput();
      setImporting(false);
    }
  }, [accountId, loadTopics, onTopicsChanged, readError, request, resetImportInput, t]);

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

  if (!isExistingAccount) return null;

  const topicsWithSignals = topics.filter((t) => (statsById.get(t.id)?.topSignals.length ?? 0) > 0);

  return (
    <Flex direction="column" gap="4" style={{ height: "100%", minHeight: 0 }}>
      <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto" }}>
        <Flex direction="column" gap="4">
          <Text size="2" color="gray">
            {t("topics.intro")}
          </Text>

          <input
            ref={importInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            style={{ display: "none" }}
          />

          <Flex direction="column" gap="3">
            <Text size="3" weight="medium">{t("topics.settingsHeading")}</Text>
            <Flex direction="column" gap="2">
              <Flex asChild align="center" gap="2">
                <label style={{ cursor: "not-allowed" }}>
                  <Switch size="1" disabled checked={false} />
                  <Text size="2" color="gray">{t("topics.writeToImap")}</Text>
                </label>
              </Flex>
              <Flex asChild align="center" gap="2">
                <label>
                  <Switch
                    size="1"
                    checked={topicColorRows ?? true}
                    onCheckedChange={(checked) =>
                      onUpdateSettings?.({
                        appearance: {
                          ...(currentAppearance ?? {}),
                          topicColorRows: checked
                        }
                      })
                    }
                  />
                  <Text size="2">{t("topics.colorRows")}</Text>
                </label>
              </Flex>
            </Flex>
          </Flex>

          <Flex direction="column" gap="3">
            <Text size="3" weight="medium">{t("topics.syncHeading")}</Text>
            <Text size="2" color="gray">
              {t("topics.syncDescription")}
            </Text>
            <Flex align="center" gap="2" wrap="wrap">
              <Button
                size="1"
                variant="soft"
                onClick={() => void handleExport()}
                disabled={!accountId || exporting || importing}
              >
                {exporting ? t("topics.exporting") : t("topics.export")}
              </Button>
              <Button
                size="1"
                variant="soft"
                onClick={() => importInputRef.current?.click()}
                disabled={!accountId || exporting || importing}
              >
                {importing ? t("topics.importing") : t("topics.import")}
              </Button>
              <Text size="1" color="gray">
                {t("topics.importReplaces")}
              </Text>
            </Flex>
          </Flex>

          <Flex direction="column" gap="3">
            <Text size="3" weight="medium">{t("topics.topicsHeading")}</Text>

            {error && <Text size="2" color="red">{error}</Text>}
            {notice && <Text size="2" color="green">{notice}</Text>}
            {loading && <Text size="2" color="gray">{t("common.loading")}</Text>}

            {topics.length > 0 && (
              <Card size="2" className={styles.topicTable}>
                {topics.map((topic) => {
                  if (editingId === topic.id) {
                    return (
                      <div key={topic.id} className={styles.editRow}>
                        <TextField.Root
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(editingId);
                            if (e.key === "Escape") cancelEdit();
                          }}
                          autoFocus
                        />
                        <TextField.Root
                          placeholder={t("topics.shortNamePlaceholder")}
                          value={editShortName}
                          onChange={(e) => setEditShortName(e.target.value)}
                        />
                        <Flex align="center" gap="2" wrap="wrap">
                          <TopicColorPicker value={editColor} onChange={setEditColor} swatchSize="sm" />
                          <Flex gap="2" ml="auto">
                            <Button size="1" variant="soft" color="gray" onClick={cancelEdit}>{t("common.cancel")}</Button>
                            <Button size="1" onClick={() => handleSaveEdit(editingId)} disabled={!editName.trim() || saving} loading={saving}>{t("common.save")}</Button>
                          </Flex>
                        </Flex>
                      </div>
                    );
                  }
                  const stat = statsById.get(topic.id);
                  return (
                    <div key={topic.id} className={styles.topicRow}>
                      <div className={styles.topicMeta}>
                        <Badge color={topicColorToScale(topic.color) as any} variant="soft" size="2">
                          {topic.name}
                        </Badge>
                        {topic.shortName ? (
                          <Badge
                            color={topicColorToScale(topic.color) as any}
                            variant="soft"
                            size="1"
                            className={styles.topicShortName}
                          >
                            {topic.shortName}
                          </Badge>
                        ) : null}
                      </div>
                      <span className={styles.topicRowCount}>
                        {stat ? t("topics.threadCount", { count: stat.threadCount }) : ""}
                      </span>
                      <Flex gap="4">
                        <TooltipIconButton size="2" variant="ghost" onClick={() => startEdit(topic)} tooltip={t("edit")}>
                          <Pencil size={14} />
                        </TooltipIconButton>
                        <TooltipIconButton size="2" variant="ghost" color="red" onClick={() => handleDelete(topic.id)} tooltip={t("common.delete")}>
                          <Trash2 size={14} />
                        </TooltipIconButton>
                      </Flex>
                    </div>
                  );
                })}
              </Card>
            )}

            {topics.length === 0 && !loading && !showCreate && (
              <Text size="2" color="gray">{t("topics.empty")}</Text>
            )}

            {showCreate ? (
              <Flex direction="column" gap="2" className={styles.createSection}>
                <TextField.Root
                  placeholder={t("topics.namePlaceholder")}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") setShowCreate(false);
                  }}
                  autoFocus
                />
                <TextField.Root
                  placeholder={t("topics.shortNamePlaceholder")}
                  value={newShortName}
                  onChange={(e) => setNewShortName(e.target.value)}
                />
                <Flex align="center" gap="2" wrap="wrap">
                  <TopicColorPicker value={newColor} onChange={setNewColor} swatchSize="sm" />
                  <Flex gap="2" ml="auto">
                    <Button
                      size="1"
                      variant="soft"
                      color="gray"
                      onClick={() => {
                        setShowCreate(false);
                        setNewName("");
                        setNewShortName("");
                      }}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button size="1" onClick={handleCreate} disabled={!newName.trim() || saving} loading={saving}>{t("topics.create")}</Button>
                  </Flex>
                </Flex>
              </Flex>
            ) : (
              <Button size="1" variant="soft" onClick={() => setShowCreate(true)} style={{ alignSelf: "flex-start" }}>
                <Plus size={12} /> {t("topics.newTopic")}
              </Button>
            )}
          </Flex>

          <Flex direction="column" gap="3">
            <Text size="3" weight="medium">{t("topics.learningHeading")}</Text>
            {topicsWithSignals.length === 0 ? (
              <Text size="2" color="gray">{t("topics.learningEmpty")}</Text>
            ) : (
              <Card size="2">
                <Flex direction="column" gap="1">
                  {topicsWithSignals.map((topic, topicIdx) => {
                    const signals = statsById.get(topic.id)?.topSignals ?? [];
                    return (
                      <Flex key={topic.id} direction="column" gap="1">
                        {topicIdx > 0 && <div className={styles.signalDivider} />}
                        <Badge color={topicColorToScale(topic.color) as any} variant="soft" size="1" style={{ alignSelf: "flex-start" }}>{topic.name}</Badge>
                        {signals.map((s) => {
                          const signalKey = `${topic.id}\u0000${s.type}\u0000${s.value}`;
                          const removing = removingSignalKey === signalKey;
                          const signalLabel = t(`topics.signalTypes.${s.type}`);
                          return (
                            <Flex key={`${s.type}:${s.value}`} align="start" gap="2" className={styles.signalRow}>
                              <Text size="1" color="gray" className={styles.signalText}>
                                {t("topics.signalLine", { signal: signalLabel, value: s.value, count: s.count })}
                              </Text>
                              <TooltipIconButton
                                size="1"
                                variant="ghost"
                                color="gray"
                                className={styles.signalRemoveButton}
                                disabled={removing}
                                onClick={() => void handleRemoveSignal(topic.id, s.type, s.value)}
                                tooltip={t("topics.removeSignal", { signal: signalLabel })}
                              >
                                <X size={10} />
                              </TooltipIconButton>
                            </Flex>
                          );
                        })}
                      </Flex>
                    );
                  })}
                </Flex>
              </Card>
            )}
          </Flex>
        </Flex>
      </div>

      <ImportReplaceConfirmDialog
        open={pendingImportFile !== null}
        title={t("topics.importDialogTitle")}
        description={t("topics.importDialogDescription")}
        confirmLabel={t("topics.import")}
        onOpenChange={handleImportDialogOpenChange}
        onConfirm={confirmImport}
      />

      <Flex
        justify="end"
        align="center"
        gap="3"
        wrap="wrap"
        style={{ paddingTop: "var(--space-3)", borderTop: "1px solid var(--gray-a5)", flexShrink: 0 }}
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
