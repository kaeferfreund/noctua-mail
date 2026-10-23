import { useTranslations } from "next-intl";
import { AlertDialog, Button, Flex, Text } from "@radix-ui/themes";
import type { Attachment } from "@/lib/data";
import AlertDialogContent from "./AlertDialogContent";

const isImageAttachment = (attachment: Attachment) =>
  (attachment.contentType ?? "").toLowerCase().startsWith("image/");

export function RemoveAttachmentConfirmDialog({
  attachment,
  removing,
  onCancel,
  onConfirm
}: {
  attachment: Attachment | null;
  removing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const t = useTranslations("Reader");
  const noun = attachment && isImageAttachment(attachment) ? "image" : "attachment";
  return (
    <AlertDialog.Root
      open={Boolean(attachment)}
      onOpenChange={(open) => {
        if (!open && !removing) onCancel();
      }}
    >
      <AlertDialogContent size="2">
        <AlertDialog.Title size="3">{t("removeAttachmentTitle", { kind: noun })}</AlertDialog.Title>
        <AlertDialog.Description>
          <Text as="span">
            {t("removeAttachmentDescription", { kind: noun, named: attachment?.filename ? "yes" : "no", filename: attachment?.filename ?? "" })}
          </Text>
        </AlertDialog.Description>
        <Flex gap="3" mt="4" justify="end">
          <Button variant="soft" color="gray" onClick={onCancel} disabled={removing}>{t("cancel")}</Button>
          {/* Not wrapped in AlertDialog.Action: the removal is async and the
              dialog must stay open, showing progress, until it resolves. */}
          <Button color="red" variant="solid" onClick={onConfirm} loading={removing}>{t("removeAttachmentAction", { kind: noun })}
          </Button>
        </Flex>
      </AlertDialogContent>
    </AlertDialog.Root>
  );
}
