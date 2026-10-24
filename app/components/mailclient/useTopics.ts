"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type SetStateAction } from "react";
import { buildAccountTopicStatsPath, buildAccountTopicsPath } from "@/lib/accountApiPaths";
import { deferUntilIdle } from "./deferUntilIdle";
import type { Topic } from "@/lib/data";

type ApiFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

type UseTopicsOptions = {
  activeAccountId: string;
  apiFetch: ApiFetch;
};

type TopicStatsResponse = {
  ok?: boolean;
  stats?: Array<{
    topicId?: string;
    messageCount?: number;
  }>;
};

const NO_TOPICS: Topic[] = [];

export function useTopics({ activeAccountId, apiFetch }: UseTopicsOptions) {
  // Keyed by mailbox: one mailbox's topics are never shown under another.
  const [storedTopics, setStoredTopics] = useState({ accountId: "", topics: NO_TOPICS });
  const [topicStats, setTopicStats] = useState({
    accountId: "", counts: new Map<string, number>()
  });
  const statsVersionRef = useRef(0);

  const fetchTopicMessageCounts = useCallback(async (accountId: string) => {
    try {
      const res = await apiFetch(buildAccountTopicStatsPath(accountId), { cache: "no-store" });
      const data: TopicStatsResponse = await res.json();
      if (!data.ok || !Array.isArray(data.stats)) {
        return new Map<string, number>();
      }
      return new Map(
        data.stats
          .map((stat) => [
            String(stat.topicId ?? ""),
            Number(stat.messageCount ?? 0)
          ] as const)
          .filter(([topicId]) => topicId)
      );
    } catch {
      return new Map<string, number>();
    }
  }, [apiFetch]);

  const refreshTopicStats = useCallback(async (accountId: string) => {
    const version = ++statsVersionRef.current;
    const counts = await fetchTopicMessageCounts(accountId);
    if (version === statsVersionRef.current) setTopicStats({ accountId, counts });
  }, [fetchTopicMessageCounts]);

  useEffect(() => {
    if (!activeAccountId) return;
    let cancelled = false;
    apiFetch(buildAccountTopicsPath(activeAccountId))
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.ok && Array.isArray(data.topics)) {
          setStoredTopics({ accountId: activeAccountId, topics: data.topics });
        }
      })
      .catch(() => {});
    const statsVersion = ++statsVersionRef.current;
    const cancelStats = deferUntilIdle(() => {
      // An explicit refresh supersedes this scheduled startup read.
      if (statsVersion !== statsVersionRef.current) return;
      void fetchTopicMessageCounts(activeAccountId).then((counts) => {
        if (!cancelled && statsVersion === statsVersionRef.current) {
          setTopicStats({ accountId: activeAccountId, counts });
        }
      });
    });
    return () => {
      cancelled = true;
      cancelStats();
      statsVersionRef.current += 1;
    };
  }, [activeAccountId, apiFetch, fetchTopicMessageCounts]);

  const allTopics = activeAccountId && storedTopics.accountId === activeAccountId ? storedTopics.topics : NO_TOPICS;
  const topicMessageCountById = activeAccountId && topicStats.accountId === activeAccountId
    ? topicStats.counts : new Map<string, number>();
  const shownAccountIdRef = useRef(activeAccountId);
  useLayoutEffect(() => { shownAccountIdRef.current = activeAccountId; }, [activeAccountId]);
  // Updates apply to the active mailbox's topics. A setter captured before a switch
  // (e.g. a topic created in A whose POST settles after the switch to B) belongs to
  // its own mailbox, which re-reads its topics on the next visit.
  const setAllTopics = useCallback((action: SetStateAction<Topic[]>) => {
    if (activeAccountId !== shownAccountIdRef.current) return;
    setStoredTopics(prev => {
      const current = prev.accountId === activeAccountId ? prev.topics : NO_TOPICS;
      return { accountId: activeAccountId, topics: typeof action === "function" ? action(current) : action };
    });
  }, [activeAccountId]);

  return {
    allTopics,
    setAllTopics,
    topicMessageCountById,
    refreshTopicStats
  };
}
