"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Card, Flex, Text, TextArea, TextField } from "@radix-ui/themes";
import type { RecipientAlias } from "@/lib/data";
import TooltipIconButton from "@/app/components/TooltipIconButton";

type RecipientAliasManagerProps = {
  aliases: RecipientAlias[];
  resetKey: string;
  initialAliasId?: string | null;
  initialRecipients?: string;
  onCreateAlias: (name: string, recipients: string) => Promise<RecipientAlias>;
  onUpdateAlias: (aliasId: string, name: string, recipients: string) => Promise<RecipientAlias>;
  onDeleteAlias: (aliasId: string) => Promise<void>;
  onCreateSuccess?: (alias: RecipientAlias) => void;
};

type FormMode = "create" | "edit" | null;

export default function RecipientAliasManager({
  aliases,
  resetKey,
  initialAliasId,
  initialRecipients = "",
  onCreateAlias,
  onUpdateAlias,
  onDeleteAlias,
  onCreateSuccess
}: RecipientAliasManagerProps) {
  const t = useTranslations("Settings");
  const [formMode, setFormMode] = useState<FormMode>(null);
  const [editingAliasId, setEditingAliasId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [recipients, setRecipients] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const editingAlias = useMemo(
    () => aliases.find((alias) => alias.id === editingAliasId) ?? null,
    [aliases, editingAliasId]
  );
  const initialAlias = useMemo(
    () => (initialAliasId ? aliases.find((alias) => alias.id === initialAliasId) ?? null : null),
    [aliases, initialAliasId]
  );

  const [previousAliasInputs, setPreviousAliasInputs] = useState<readonly unknown[] | null>(null);
  if (previousAliasInputs === null || previousAliasInputs[0] !== initialAlias || previousAliasInputs[1] !== initialAliasId || previousAliasInputs[2] !== initialRecipients || previousAliasInputs[3] !== resetKey) {
    setPreviousAliasInputs([initialAlias, initialAliasId, initialRecipients, resetKey]);
    if (initialAliasId && initialAlias) {
      setFormMode("edit");
      setEditingAliasId(initialAlias.id);
      setName(initialAlias.name);
      setRecipients(initialAlias.recipients);
    } else if (initialRecipients.trim()) {
      setFormMode("create");
      setEditingAliasId(null);
      setName("");
      setRecipients(initialRecipients.trim());
    } else {
      setFormMode(null);
      setEditingAliasId(null);
      setName("");
      setRecipients("");
    }
    setError("");
  }

  const startCreate = () => {
    setFormMode("create");
    setEditingAliasId(null);
    setName("");
    setRecipients(initialRecipients.trim());
    setError("");
  };

  const startEdit = (alias: RecipientAlias) => {
    setFormMode("edit");
    setEditingAliasId(alias.id);
    setName(alias.name);
    setRecipients(alias.recipients);
    setError("");
  };

  const cancelForm = () => {
    setFormMode(null);
    setEditingAliasId(null);
    setName("");
    setRecipients("");
    setError("");
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const trimmedRecipients = recipients.trim();
    if (!trimmedName || !trimmedRecipients) {
      setError(t("recipientAliases.required"));
      return;
    }

    setSaving(true);
    setError("");
    try {
      const alias =
        formMode === "edit" && editingAliasId
          ? await onUpdateAlias(editingAliasId, trimmedName, trimmedRecipients)
          : await onCreateAlias(trimmedName, trimmedRecipients);
      if (formMode === "create") {
        onCreateSuccess?.(alias);
      }
      setFormMode("edit");
      setEditingAliasId(alias.id);
      setName(alias.name);
      setRecipients(alias.recipients);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t("recipientAliases.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (aliasId: string) => {
    setDeletingId(aliasId);
    setError("");
    try {
      await onDeleteAlias(aliasId);
      if (editingAliasId === aliasId) {
        cancelForm();
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : t("recipientAliases.deleteFailed"));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Flex direction="column" gap="4" style={{ minHeight: 0 }}>
      <Text size="2" color="gray">
        {t("recipientAliases.intro")}
      </Text>

      {aliases.length > 0 ? (
        <Card size="2">
          <Flex direction="column" gap="2">
            {aliases.map((alias) => (
              <Flex
                key={alias.id}
                align="start"
                justify="between"
                gap="3"
                style={{ padding: "var(--space-2) 0", borderBottom: "1px solid var(--gray-a4)" }}
              >
                <Flex direction="column" gap="1" style={{ minWidth: 0, flex: 1 }}>
                  <Text size="2" weight="medium" style={{ overflowWrap: "anywhere" }}>
                    {alias.name}
                  </Text>
                  <Text size="1" color="gray" style={{ overflowWrap: "anywhere" }}>
                    {alias.recipients}
                  </Text>
                </Flex>
                <Flex gap="2" flexShrink="0">
                  <TooltipIconButton
                    size="2"
                    variant="ghost"
                    tooltip={t("recipientAliases.edit")}
                    onClick={() => startEdit(alias)}
                  >
                    <Pencil size={14} />
                  </TooltipIconButton>
                  <TooltipIconButton
                    size="2"
                    variant="ghost"
                    color="red"
                    tooltip={t("recipientAliases.delete")}
                    disabled={deletingId === alias.id}
                    onClick={() => void handleDelete(alias.id)}
                  >
                    <Trash2 size={14} />
                  </TooltipIconButton>
                </Flex>
              </Flex>
            ))}
          </Flex>
        </Card>
      ) : (
        <Text size="2" color="gray">
          {t("recipientAliases.empty")}
        </Text>
      )}

      {formMode ? (
        <Card size="2">
          <Flex direction="column" gap="3">
            <Text size="3" weight="medium">
              {formMode === "edit" && editingAlias ? t("recipientAliases.editTitle", { name: editingAlias.name }) : t("recipientAliases.createTitle")}
            </Text>
            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                {t("recipientAliases.name")}
              </Text>
              <TextField.Root
                value={name}
                placeholder={t("recipientAliases.namePlaceholder")}
                onChange={(event) => setName(event.target.value)}
              />
            </Flex>
            <Flex direction="column" gap="2">
              <Text size="2" weight="medium">
                {t("recipientAliases.recipients")}
              </Text>
              <TextArea
                value={recipients}
                placeholder={t("recipientAliases.recipientsPlaceholder")}
                onChange={(event) => setRecipients(event.target.value)}
                rows={5}
              />
            </Flex>
            {error && (
              <Text size="2" color="red">
                {error}
              </Text>
            )}
            <Flex gap="2" justify="end">
              <Button variant="soft" color="gray" onClick={cancelForm}>
                {t("common.cancel")}
              </Button>
              <Button onClick={() => void handleSave()} disabled={saving}>
                {formMode === "edit" ? t("recipientAliases.save") : t("recipientAliases.create")}
              </Button>
            </Flex>
          </Flex>
        </Card>
      ) : (
        <Button
          size="2"
          variant="soft"
          onClick={startCreate}
          style={{ alignSelf: "flex-start" }}
        >
          <Plus size={14} /> {t("recipientAliases.new")}
        </Button>
      )}
    </Flex>
  );
}
