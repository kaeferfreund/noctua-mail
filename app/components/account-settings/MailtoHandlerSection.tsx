"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Flex, Text } from "@radix-ui/themes";
import { DEFAULT_APP_TITLE } from "@/lib/appBranding";

type Status =
  | { kind: "idle" }
  | { kind: "ok" }
  | { kind: "unsupported" }
  | { kind: "error"; message?: string };

// `mailto:` registration is a browser-wide setting, not per-account, but the
// preferences tab is the most discoverable place to expose it. The actual
// "set as system default" step happens in the OS — we just tell the browser
// it's willing to handle the protocol.
export default function MailtoHandlerSection() {
  const t = useTranslations("Settings.mailto");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const handleRegister = () => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;
    if (typeof navigator.registerProtocolHandler !== "function") {
      setStatus({ kind: "unsupported" });
      return;
    }
    try {
      navigator.registerProtocolHandler(
        "mailto",
        `${window.location.origin}/?c=%s`
      );
      setStatus({ kind: "ok" });
    } catch (err) {
      // A browser-provided error message is kept as is; otherwise show our own copy.
      setStatus({ kind: "error", message: err instanceof Error && err.message ? err.message : undefined });
    }
  };

  return (
    <Flex direction="column" gap="2">
      <Text size="3" weight="medium">
        {t("title")}
      </Text>
      <Text size="1" color="gray">
        {t.rich("help", { app: DEFAULT_APP_TITLE, code: (chunks) => <code>{chunks}</code> })}
      </Text>
      <Flex align="center" gap="3" wrap="wrap">
        <Button size="2" variant="soft" onClick={handleRegister}>
          {t("register")}
        </Button>
        {status.kind === "ok" && (
          <Text size="1" color="green">
            {t("requested")}
          </Text>
        )}
        {status.kind === "unsupported" && (
          <Text size="1" color="amber">
            {t("unsupported")}
          </Text>
        )}
        {status.kind === "error" && (
          <Text size="1" color="red">
            {status.message ?? t("failed")}
          </Text>
        )}
      </Flex>
    </Flex>
  );
}
