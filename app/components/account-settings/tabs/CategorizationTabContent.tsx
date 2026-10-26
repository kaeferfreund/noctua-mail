import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, Flex, Grid, Text } from "@radix-ui/themes";
import { useTranslations } from "next-intl";
import {
  buildAccountCategoriesDebugPath,
  buildAccountCategoriesModelResetPath
} from "@/lib/accountApiPaths";
import type { AccountDateFormat } from "@/lib/data";
import { formatAccountTimestampLabel } from "@/lib/dateFormatting";
import type { CategoryLearningDebugSnapshot } from "@/lib/mail/categorization/debugTypes";

type CategoryDebugResponse = {
  ok?: boolean;
  snapshot?: CategoryLearningDebugSnapshot;
  message?: string;
};

type CategoryModelResetResponse = {
  ok?: boolean;
  message?: string;
};

type Props = {
  accountId?: string;
  isActive: boolean;
  isExistingAccount: boolean;
  accountDateFormat?: AccountDateFormat;
  onClose: () => void;
  onSave: () => void;
  onModelResetSuccess?: () => void;
  apiFetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  readErrorMessage?: (res: Response) => Promise<string>;
};

export default function CategorizationTabContent({
  accountId,
  isActive,
  isExistingAccount,
  accountDateFormat,
  onClose,
  onSave,
  onModelResetSuccess,
  apiFetch,
  readErrorMessage
}: Props) {
  const t = useTranslations("Settings");
  const [snapshot, setSnapshot] = useState<CategoryLearningDebugSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetting, setResetting] = useState(false);

  const request = apiFetch ?? fetch;
  const readError = useMemo(
    () =>
      readErrorMessage ??
      (async (res: Response) => {
        try {
          const data = (await res.json()) as { message?: string; error?: string };
          return data?.message || data?.error || t("categorization.requestFailed", { status: res.status });
        } catch {
          return t("categorization.requestFailed", { status: res.status });
        }
      }),
    [readErrorMessage, t]
  );

  const formatTimestamp = (value?: number | null) =>
    formatAccountTimestampLabel(value, accountDateFormat, t("categorization.never"));

  // Category codes stay stable; only the presentation is translated. Unknown
  // codes from the server are shown as is.
  const formatCategory = (value: string | null) => {
    if (!value) return t("categorization.categories.none");
    if (value === "newsletter" || value === "notification" || value === "transactional" || value === "uncategorized") {
      return t(`categorization.categories.${value}`);
    }
    return value;
  };

  const categoryLabels: Array<"newsletter" | "notification" | "transactional"> = [
    "newsletter",
    "notification",
    "transactional"
  ];

  const loadCategorizationDebug = useCallback(() => {
    if (!accountId) return Promise.resolve();
    return request(buildAccountCategoriesDebugPath(accountId, new URLSearchParams({ limit: "20" })))
      .then(async res => {
        if (!res.ok) { setError(await readError(res)); return; }
        const data = (await res.json()) as CategoryDebugResponse;
        if (!data?.ok || !data.snapshot) { setError(data?.message || t("categorization.invalidResponse")); return; }
        setSnapshot(data.snapshot);
      })
      .catch(() => { setError(t("categorization.loadFailed")); })
      .finally(() => { setLoading(false); });
  }, [accountId, readError, request, t]);

  const resetCategorizationModel = useCallback(async () => {
    if (!accountId) return;
    const confirmed = window.confirm(t("categorization.confirmReset"));
    if (!confirmed) return;
    setResetting(true);
    setError("");
    try {
      const res = await request(buildAccountCategoriesModelResetPath(accountId), {
        method: "POST"
      });
      if (!res.ok) {
        setError(await readError(res));
        return;
      }
      const data = (await res.json()) as CategoryModelResetResponse;
      if (!data?.ok) {
        setError(data?.message || t("categorization.resetFailed"));
        return;
      }
      onModelResetSuccess?.();
      setLoading(true); setError("");
      await loadCategorizationDebug();
    } catch {
      setError(t("categorization.resetFailed"));
    } finally {
      setResetting(false);
    }
  }, [accountId, loadCategorizationDebug, onModelResetSuccess, readError, request, t]);

  const [previousLoadInputs, setPreviousLoadInputs] = useState<readonly unknown[] | null>(null);
  if (previousLoadInputs === null || previousLoadInputs[0] !== accountId || previousLoadInputs[1] !== isActive || previousLoadInputs[2] !== isExistingAccount || previousLoadInputs[3] !== loadCategorizationDebug) {
    setPreviousLoadInputs([accountId, isActive, isExistingAccount, loadCategorizationDebug]);
    if (isActive && accountId && isExistingAccount) {
      setLoading(true);
      setError("");
    }
  }
  useEffect(() => {
    if (!isActive || !accountId || !isExistingAccount) return;
    void loadCategorizationDebug();
  }, [accountId, isActive, isExistingAccount, loadCategorizationDebug]);

  return (
    <Flex direction="column" gap="4" style={{ height: "100%", minHeight: 0 }}>
      <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto" }}>
        <Flex direction="column" gap="4">
          <Flex align="center" justify="between" gap="3" wrap="wrap">
            <Text size="2" color="gray">
              {t("categorization.intro")}
            </Text>
            <Flex align="center" gap="2" wrap="wrap">
              <Button
                size="1"
                variant="soft"
                color="red"
                onClick={() => void resetCategorizationModel()}
                disabled={resetting || loading || !accountId}
              >
                {resetting ? t("categorization.resetting") : t("categorization.reset")}
              </Button>
              <Button
                size="1"
                variant="soft"
                onClick={() => { setLoading(true); setError(""); void loadCategorizationDebug(); }}
                disabled={loading || resetting || !accountId}
              >
                {loading ? t("categorization.refreshing") : t("categorization.refresh")}
              </Button>
            </Flex>
          </Flex>

          {error && (
            <Card size="2">
              <Text size="2" color="red">
                {error}
              </Text>
            </Card>
          )}

          <Card size="2">
            <Flex direction="column" gap="2">
              <Text size="3" weight="medium">
                {t("categorization.modelTitle")}
              </Text>
              {snapshot?.model ? (
                <Grid columns={{ initial: "1", sm: "2" }} gap="2">
                  <Text size="2">{t("categorization.version", { version: snapshot.model.version })}</Text>
                  <Text size="2">{t("categorization.examples", { count: snapshot.model.examples })}</Text>
                  <Text size="2">{t("categorization.updated", { time: formatTimestamp(snapshot.model.updatedAt) })}</Text>
                  <Text size="2">{t("categorization.learningRate", { value: snapshot.model.learningRate })}</Text>
                  <Text size="2">{t("categorization.l2", { value: snapshot.model.l2 })}</Text>
                  <Text size="2">
                    {t("categorization.features", {
                      list: categoryLabels
                        .map((category) => t("categorization.featureCount", { category: formatCategory(category), count: snapshot.model?.featureCounts[category] ?? 0 }))
                        .join(" · ")
                    })}
                  </Text>
                </Grid>
              ) : (
                <Text size="2" color="gray">
                  {t("categorization.noModel")}
                </Text>
              )}
            </Flex>
          </Card>

          <Card size="2">
            <Flex direction="column" gap="2">
              <Text size="3" weight="medium">
                {t("categorization.distributionTitle")}
              </Text>
              <Flex direction="column" gap="1">
                {(snapshot?.categoryCounts ?? []).map((entry) => (
                  <Text key={entry.category} size="2">
                    {t("categorization.distributionEntry", { category: formatCategory(entry.category), count: entry.count })}
                  </Text>
                ))}
              </Flex>
              <Text size="2">{t("categorization.manualOverrides", { count: snapshot?.manualCategorizedCount ?? 0 })}</Text>
            </Flex>
          </Card>

          <Card size="2">
            <Flex direction="column" gap="2">
              <Text size="3" weight="medium">
                {t("categorization.feedbackTitle")}
              </Text>
              <Text size="2">
                {t("categorization.feedbackSummary", { total: snapshot?.feedback.totalEvents ?? 0, last: formatTimestamp(snapshot?.feedback.lastEventAt) })}
              </Text>
              <Text size="2" weight="medium">
                {t("categorization.topTransitions")}
              </Text>
              <Flex direction="column" gap="1">
                {(snapshot?.feedback.transitions ?? []).slice(0, 8).map((entry) => (
                  <Text
                    key={`${entry.previousCategory ?? "none"}-${entry.nextCategory ?? "none"}-${entry.count}`}
                    size="2"
                  >
                    {t("categorization.transition", { from: formatCategory(entry.previousCategory), to: formatCategory(entry.nextCategory), count: entry.count })}
                  </Text>
                ))}
              </Flex>
              <Text size="2" weight="medium">
                {t("categorization.recentTitle")}
              </Text>
              <Flex direction="column" gap="1">
                {(snapshot?.feedback.recent ?? []).map((entry) => (
                  <Text
                    key={`${entry.createdAt}-${entry.messageId}-${entry.previousCategory ?? "none"}-${entry.nextCategory ?? "none"}`}
                    size="2"
                  >
                    {t("categorization.recentEntry", { time: formatTimestamp(entry.createdAt), from: formatCategory(entry.previousCategory), to: formatCategory(entry.nextCategory), count: entry.featureCount })}
                  </Text>
                ))}
                {(snapshot?.feedback.recent ?? []).length === 0 && (
                  <Text size="2" color="gray">
                    {t("categorization.noFeedback")}
                  </Text>
                )}
              </Flex>
            </Flex>
          </Card>

          <Card size="2">
            <Flex direction="column" gap="2">
              <Text size="3" weight="medium">
                {t("categorization.weightsTitle")}
              </Text>
              {!snapshot?.model ? (
                <Text size="2" color="gray">
                  {t("categorization.noWeights")}
                </Text>
              ) : (
                <Grid columns={{ initial: "1", sm: "3" }} gap="3">
                  {categoryLabels.map((category) => (
                    <Flex key={category} direction="column" gap="1">
                      <Text size="2" weight="medium">
                        {formatCategory(category)}
                      </Text>
                      {snapshot.model?.topWeights[category].length ? (
                        snapshot.model.topWeights[category].map((entry) => (
                          <Text
                            key={`${category}-${entry.feature}`}
                            size="1"
                            color="gray"
                            style={{ overflowWrap: "anywhere" }}
                          >
                            {entry.feature}: {entry.weight >= 0 ? "+" : ""}
                            {entry.weight}
                          </Text>
                        ))
                      ) : (
                        <Text size="1" color="gray">
                          {t("categorization.noFeatures")}
                        </Text>
                      )}
                    </Flex>
                  ))}
                </Grid>
              )}
            </Flex>
          </Card>
        </Flex>
      </div>

      <Flex
        justify="end"
        align="center"
        gap="3"
        wrap="wrap"
        style={{ paddingTop: "var(--space-3)", borderTop: "1px solid var(--gray-a5)" }}
      >
        <Button size="2" variant="soft" color="gray" onClick={onClose}>
          {t("close")}
        </Button>
        <Button size="2" onClick={onSave} disabled>
          {t("common.save")}
        </Button>
      </Flex>
    </Flex>
  );
}
