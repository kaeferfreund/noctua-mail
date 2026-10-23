import { useTranslations } from "next-intl";
import { AlertDialog, Box, Button, Flex, Text } from "@radix-ui/themes";
import type { FullSyncConfirmState } from "../types";
import AlertDialogContent from "./AlertDialogContent";

type FullSyncConfirmDialogProps = {
  confirmState: FullSyncConfirmState | null;
  onOpenChange: (open: boolean) => void;
  resolveConfirm: (confirmed: boolean) => void;
};

export default function FullSyncConfirmDialog({
  confirmState,
  onOpenChange,
  resolveConfirm
}: FullSyncConfirmDialogProps) {
  const t = useTranslations("Reader");
  return (
    <AlertDialog.Root open={Boolean(confirmState)} onOpenChange={onOpenChange}>
      <AlertDialogContent size="2">
        <AlertDialog.Title size="3">{t("fullSyncTitle")}</AlertDialog.Title>
        <AlertDialog.Description>{t("fullSyncDescription")}</AlertDialog.Description>
        <Box
          mt="4"
          p="3"
          style={{
            borderRadius: "12px",
            background: "var(--gray-3)",
            border: "1px solid var(--gray-6)",
            userSelect: "text"
          }}
        >
          <Flex direction="column" gap="2">
            <Text size="2" style={{ whiteSpace: "pre-wrap" }}>
              <strong>{t("accountLabel")}</strong> {confirmState?.accountId ?? ""}
            </Text>
            <Text size="2" style={{ whiteSpace: "pre-wrap" }}>
              <strong>{t("scopeLabel")}</strong> {confirmState?.scopeLabel ?? ""}
            </Text>
            <Text size="2" style={{ whiteSpace: "pre-wrap" }}>
              <strong>{t("modeLabel")}</strong> {t("syncMode", { mode: confirmState?.mode ?? "full" })}
            </Text>
            <Text size="2" style={{ whiteSpace: "pre-wrap" }}>
              <strong>{t("reasonLabel")}</strong> {confirmState?.reason ?? ""}
            </Text>
          </Flex>
        </Box>
        <Flex gap="3" mt="4" justify="end" wrap="wrap">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray" onClick={() => resolveConfirm(false)}>{t("cancel")}</Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button color="orange" onClick={() => resolveConfirm(true)}>{t("startFullSync")}</Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialogContent>
    </AlertDialog.Root>
  );
}
