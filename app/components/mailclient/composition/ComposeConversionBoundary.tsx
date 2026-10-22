import type { ReactNode } from "react";
import { Button, Flex, Text } from "@radix-ui/themes";
import { useMarkdownConverters } from "./useMarkdownConverters";

export function ComposeConversionBoundary({ children }: { children: ReactNode }) {
  const { ready, error, retry } = useMarkdownConverters(true);
  if (!ready) {
    return <Flex gap="2" align="center" role="status">
      <Text size="2">{error ? "Could not load composer." : "Loading composer…"}</Text>
      {error && <Button size="1" variant="soft" onClick={retry}>Retry</Button>}
    </Flex>;
  }
  return children;
}
