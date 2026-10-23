import type { ReactNode } from "react";
import { Button, Flex, Text } from "@radix-ui/themes";
import { useTranslations } from "next-intl";
import { useMarkdownConverters } from "./useMarkdownConverters";

export function ComposeConversionBoundary({ children }: { children: ReactNode }) {
  const { ready, error, retry } = useMarkdownConverters(true);
  const t = useTranslations("Editor.loading");
  if (!ready) {
    return <Flex gap="2" align="center" role="status">
      <Text size="2">{error ? t("composerFailed") : t("composer")}</Text>
      {error && <Button size="1" variant="soft" onClick={retry}>{t("retry")}</Button>}
    </Flex>;
  }
  return children;
}
