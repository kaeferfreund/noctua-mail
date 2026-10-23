"use client";

import type { UiLocale } from "@/lib/i18n/config";
import { formatNumber } from "@/lib/i18n/format";

import { useLocale, useTranslations } from "next-intl";
import { memo, useMemo } from "react";
import { QuestionMarkCircledIcon } from "@radix-ui/react-icons";
import { Flex, Popover, Text } from "@radix-ui/themes";
import type { Topic } from "@/lib/data";
import TopicBadge from "../TopicBadge";
import type { TopicSuggestionExplanation } from "./types";
import TooltipIconButton from "@/app/components/TooltipIconButton";

type ThreadTopicSuggestionsRowProps = {
  threadId: string;
  hasAssignedTopics: boolean;
  suggestions: Topic[];
  explanationOpen: boolean;
  explanationLoading: boolean;
  explanationError: string;
  explanation: TopicSuggestionExplanation | null;
  onExplanationOpenChange: (open: boolean) => void;
  onLoadExplanation: (threadId: string) => void;
  onToggleTopic: (topicId: string) => void;
};

function normalizeSuggestions(suggestions: Topic[]) {
  return suggestions.filter(
    (topic) =>
      typeof topic?.id === "string" &&
      topic.id.trim().length > 0 &&
      typeof topic?.name === "string" &&
      topic.name.trim().length > 0
  );
}

function formatTopicSuggestionScore(score: number | undefined, locale: UiLocale) {
  if (score === undefined) return null;
  return formatNumber(score, locale, { minimumFractionDigits: Number.isInteger(score) ? 0 : 2, maximumFractionDigits: 2 });
}

function formatTopicSuggestionSignal(signal: { type: string; value: string; weight: number }, locale: UiLocale) {
  return `${signal.type}=${signal.value} (${formatNumber(signal.weight, locale)})`;
}

function formatTopicSuggestionFormula(
  signals: Array<{ type: string; value: string; weight: number }>,
  locale: UiLocale
) {
  if (signals.length === 0) return "0";
  return signals
    .map((signal) => `${formatNumber(signal.weight, locale)} (${signal.type}=${signal.value})`)
    .join(" + ");
}

function buildSuggestionSignature(suggestions: Topic[]) {
  return suggestions
    .map((topic) => `${topic.id}:${topic.suggestionScore ?? ""}:${topic.name}`)
    .join("|");
}

function ThreadTopicSuggestionsRow({
  threadId,
  hasAssignedTopics,
  suggestions,
  explanationOpen,
  explanationLoading,
  explanationError,
  explanation,
  onExplanationOpenChange,
  onLoadExplanation,
  onToggleTopic
}: ThreadTopicSuggestionsRowProps) {
  const locale = useLocale();
  const t = useTranslations("Reader");
  const visibleSuggestions = useMemo(() => normalizeSuggestions(suggestions), [suggestions]);
  const displayedSuggestions = hasAssignedTopics ? [] : visibleSuggestions;

  if (displayedSuggestions.length === 0) {
    return null;
  }

  return (
    <Flex align="center" gap="2" wrap="wrap" justify="start" style={{ width: "100%" }}>
      <Text size="1" color="gray">{t("topicSuggestion")}</Text>
      {displayedSuggestions.map((topic) => {
        const scoreLabel = formatTopicSuggestionScore(topic.suggestionScore, locale);
        return (
          <Flex
            key={topic.id}
            align="center"
            gap="1"
            style={{ cursor: "pointer" }}
            onClick={() => {
              onToggleTopic(topic.id);
            }}
          >
            <TopicBadge topic={topic} size="1" />
            {scoreLabel ? (
              <Text size="1" color="gray">
                ({scoreLabel})
              </Text>
            ) : null}
          </Flex>
        );
      })}
      <Popover.Root
        open={explanationOpen}
        onOpenChange={(open) => {
          onExplanationOpenChange(open);
          if (open && threadId) {
            onLoadExplanation(threadId);
          }
        }}
      >
        <Popover.Trigger>
          <TooltipIconButton
            size="1"
            variant="ghost"
            color="gray"
            tooltip={t("why")}
          >
            <QuestionMarkCircledIcon width={14} height={14} />
          </TooltipIconButton>
        </Popover.Trigger>
        <Popover.Content size="1" className="topic-suggestion-explanation-popover">
          <Flex direction="column" gap="3" className="topic-suggestion-explanation-layout">
            <Text size="2" weight="medium">{t("whySuggestion")}</Text>
            <Flex direction="column" gap="3" className="topic-suggestion-explanation-body">
              {explanationLoading ? (
                <Text size="1" color="gray">{t("loadingExplanation")}</Text>
              ) : explanationError ? (
                <Text size="1" color="red">
                  {explanationError}
                </Text>
              ) : explanation ? (
                <>
                  <Flex direction="column" gap="1">
                    <Text size="1" color="gray">{t("signalWeights")}</Text>
                    <Text size="1" color="gray">{t("perThread")} <code>{t("threadScoreFormula")}</code>
                    </Text>
                    <Text size="1" color="gray">{t("perTopic")} <code>{t("suggestionScoreFormula")}</code>, <code>{t("matchCountFormula")}</code>
                    </Text>
                  </Flex>
                  <Flex direction="column" gap="1">
                    <Text size="1" weight="medium">{t("currentSignals")}</Text>
                    {explanation.signals.length > 0 ? (
                      explanation.signals.map((signal) => (
                        <Text key={`${signal.type}-${signal.value}`} size="1" color="gray">
                          {formatTopicSuggestionSignal(signal, locale)}
                        </Text>
                      ))
                    ) : (
                      <Text size="1" color="gray">{t("noSignals")}</Text>
                    )}
                  </Flex>
                  <Flex direction="column" gap="3">
                    {explanation.topics.map((entry) => (
                      <Flex key={entry.topic.id} direction="column" gap="1">
                        <Text size="1" weight="medium">
                          {t("topicScore", { topic: entry.topic.name, score: entry.suggestionScore, matches: entry.matchCount })}
                        </Text>
                        <Text size="1" color="gray">{t("bestMatchExplanation")}{entry.matchedThreads[0]
                            ? t("winningThread", { thread: entry.matchedThreads[0].threadId, score: entry.matchedThreads[0].score })
                            : ""}
                        </Text>
                        {entry.matchedThreads.map((thread) => (
                          <Flex key={`${entry.topic.id}-${thread.threadId}`} direction="column" gap="1">
                            <Text size="1" color="gray">
                              {thread.threadId}: {formatTopicSuggestionFormula(thread.signals, locale)} = {formatNumber(thread.score, locale)}
                            </Text>
                            <Text size="1" color="gray">{t("signalsLabel")} {thread.signals.map((signal) => formatTopicSuggestionSignal(signal, locale)).join(", ")}
                            </Text>
                          </Flex>
                        ))}
                      </Flex>
                    ))}
                  </Flex>
                </>
              ) : (
                <Text size="1" color="gray">{t("noExplanation")}</Text>
              )}
            </Flex>
          </Flex>
        </Popover.Content>
      </Popover.Root>
    </Flex>
  );
}

export default memo(ThreadTopicSuggestionsRow, (prev, next) => {
  return (
    prev.threadId === next.threadId &&
    prev.hasAssignedTopics === next.hasAssignedTopics &&
    buildSuggestionSignature(prev.suggestions) === buildSuggestionSignature(next.suggestions) &&
    prev.explanationOpen === next.explanationOpen &&
    prev.explanationLoading === next.explanationLoading &&
    prev.explanationError === next.explanationError &&
    prev.explanation === next.explanation
  );
});
