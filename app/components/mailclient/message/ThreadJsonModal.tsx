import { useTranslations } from "next-intl";
import { Dialog, Flex, Switch, Text } from "@radix-ui/themes";
import DialogTitleBar from "./DialogTitleBar";
import RawTextPanel from "./RawTextPanel";
import styles from "./ThreadJsonModal.module.css";

type ThreadJsonModalProps = {
  open: boolean;
  omitBody: boolean;
  jsonPayload: unknown;
  onClose: () => void;
  onToggleOmitBody: () => void;
};

export default function ThreadJsonModal({
  open,
  omitBody,
  jsonPayload,
  onClose,
  onToggleOmitBody
}: ThreadJsonModalProps) {
  const t = useTranslations("Reader");
  if (!open) return null;

  const payload = JSON.stringify(jsonPayload, null, 2);

  return (
    <Dialog.Root open={open} onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}>
      <Dialog.Content size="4" className={styles.content}>
        <Flex direction="column" gap="3" className={styles.body}>
          <DialogTitleBar title={t("threadJson")} onClose={onClose} />
          <Dialog.Description size="2" color="gray">{t("threadJsonDescription")}</Dialog.Description>
          <Flex align="center" gap="2" className={styles.toolbar}>
            <Switch
              checked={!omitBody}
              onCheckedChange={() => onToggleOmitBody()}
              aria-label={t("includeBody")}
            />
            <Text size="2">{t("includeBody")}</Text>
          </Flex>
          <RawTextPanel text={payload} copyText={payload} copyLabel={t("copyJson")} />
        </Flex>
      </Dialog.Content>
    </Dialog.Root>
  );
}
