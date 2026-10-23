import { useSenderMessages } from "@/lib/i18n/useSenderMessages";
import { useTranslations } from "next-intl";

import { validSignatureTemplate } from "@/lib/signatureTemplates";
import { Button, Card, Flex, Grid, Select, Text, TextArea, TextField } from "@radix-ui/themes";
import Field from "@/app/components/account-settings/Field";
import type { Account, AccountSettings } from "@/lib/data";

type Props = {
  editingAccount: Account;
  isExistingAccount: boolean;
  canSave: boolean;
  onUpdateSettings: (next: AccountSettings) => void;
  onClose: () => void;
  onSave: () => void;
};

export default function SignaturesTabContent({
  editingAccount,
  isExistingAccount,
  canSave,
  onUpdateSettings,
  onClose,
  onSave
}: Props) {
  const { messages: senderMessages } = useSenderMessages();
  const t = useTranslations("Settings");
  const signatures = editingAccount.settings?.signatures ?? [];
  const invalidTemplate = signatures.some(signature => !validSignatureTemplate(signature.body));
  const saveDisabled = !isExistingAccount || !canSave || invalidTemplate;

  return (
    <Flex direction="column" gap="4" style={{ height: "100%", minHeight: 0 }}>
      <Flex direction="column" gap="4" style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto" }}>
        <Text size="2" color="gray">
          {senderMessages.sharedTemplatesHelp}
        </Text>
        {invalidTemplate && <Text as="p" role="alert">{senderMessages.invalidTemplate}</Text>}
        <Flex align="center" justify="between">
          <Text size="3" weight="medium">
            {t("signatures.listTitle")}
          </Text>
          <Button
            size="1"
            variant="soft"
            onClick={() => {
              const next = {
                id: crypto.randomUUID(),
                // Default name is inserted into stored settings in the current UI language.
                name: t("signatures.newName"),
                body: ""
              };
              onUpdateSettings({ signatures: [...signatures, next] });
            }}
          >
            {t("signatures.add")}
          </Button>
        </Flex>
        <Grid columns="2" gap="3">
          <Field label={t("signatures.defaultSignature")}>
            <Select.Root
              value={editingAccount.settings?.defaultSignatureId || "none"}
              onValueChange={(value) =>
                onUpdateSettings({
                  defaultSignatureId: value === "none" ? "" : value
                })
              }
            >
              <Select.Trigger style={{ width: "100%" }} placeholder={t("signatures.none")} />
              <Select.Content position="popper">
                <Select.Item value="none">{t("signatures.none")}</Select.Item>
                {signatures.map((signature) => (
                  <Select.Item key={signature.id} value={signature.id}>
                    {signature.name}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </Field>
        </Grid>
        {signatures.length === 0 ? (
          <Text size="2" color="gray">
            {t("signatures.empty")}
          </Text>
        ) : (
          <Flex direction="column" gap="3">
            {signatures.map((signature) => (
              <Card key={signature.id} size="2">
                <Flex direction="column" gap="3">
                  <Field label={t("signatures.name")}>
                    <TextField.Root
                      value={signature.name}
                      onChange={(event) => {
                        const nextSignatures = signatures.map((entry) =>
                          entry.id === signature.id ? { ...entry, name: event.target.value } : entry
                        );
                        onUpdateSettings({ signatures: nextSignatures });
                      }}
                    />
                  </Field>
                  <Field label={t("signatures.text")}>
                    <TextArea
                      rows={8}
                      style={{ resize: "vertical" }}
                      value={signature.body}
                      onChange={(event) => {
                        const nextSignatures = signatures.map((entry) =>
                          entry.id === signature.id ? { ...entry, body: event.target.value } : entry
                        );
                        onUpdateSettings({ signatures: nextSignatures });
                      }}
                    />
                  </Field>
                  <Flex justify="end">
                    <Button
                      size="1"
                      variant="ghost"
                      color="red"
                      onClick={() => {
                        const nextSignatures = signatures.filter((entry) => entry.id !== signature.id);
                        const nextDefault =
                          editingAccount.settings?.defaultSignatureId === signature.id
                            ? ""
                            : editingAccount.settings?.defaultSignatureId ?? "";
                        onUpdateSettings({
                          signatures: nextSignatures,
                          defaultSignatureId: nextDefault
                        });
                      }}
                    >
                      {t("common.delete")}
                    </Button>
                  </Flex>
                </Flex>
              </Card>
            ))}
          </Flex>
        )}
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
        <Button size="2" onClick={() => { if (!invalidTemplate) onSave(); }} disabled={saveDisabled}>
          {t("common.save")}
        </Button>
      </Flex>
    </Flex>
  );
}
