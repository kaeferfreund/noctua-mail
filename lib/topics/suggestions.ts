import { ownAddressList, ownAddressMatcher, type OwnAddressInput } from "@/lib/ownAddresses";
import { withAccountDb } from "../db";
import type { Topic, TopicSuggestionSignal } from "../data";
import { TOPIC_SUGGESTION_SIGNALS } from "../data";
import { isFreeMailDomain } from "../senderIdentity";
import {
  collectTopicSignalEntries,
  type TopicSignalEntry,
  type TopicSignalSource
} from "../topicSignals";
import { rowToTopic } from "./core";

export type TopicSuggestionExplanationSignal = {
  type: TopicSuggestionSignal;
  value: string;
  weight: number;
};
export type TopicSuggestionExplanationTopic = {
  topic: Topic;
  suggestionScore: number;
  matchCount: number;
  matchedSignals: TopicSuggestionExplanationSignal[];
  matchedThreads: Array<{
    threadId: string;
    score: number;
    signals: TopicSuggestionExplanationSignal[];
  }>;
};
export type TopicSuggestionExplanation = {
  signals: TopicSuggestionExplanationSignal[];
  topics: TopicSuggestionExplanationTopic[];
};
export type TopicThreadSuggestion = {
  threadId: string;
  representativeMessageId?: string;
  suggestionScore: number;
};

type MessageSignals = TopicSignalSource & {
  /** threadId of the thread being evaluated — excluded from learning corpus */
  threadId?: string | null;
};

type TopicSuggestionSignals = {
  senderEmails: string[];
  senderDomains: string[];
  recipientEmails: string[];
  listIds: string[];
  jiraProjectKeys: string[];
  threadId?: string | null;
};

type TopicThreadSignalRow = {
  threadId?: string | null;
  signalType?: string | null;
  signalValue?: string | null;
};

const TOPIC_SUGGESTION_WEIGHTS = {
  senderEmail: 4,
  listId: 4,
  jiraProjectKey: 4,
  recipient: 2,
  senderDomain: 1
} as const;

function getTopicSuggestionWeight(type: TopicSuggestionSignal) {
  return TOPIC_SUGGESTION_WEIGHTS[type];
}

function topicSuggestionSignalsFromEntries(
  entries: TopicSignalEntry[],
  threadId?: string | null
): TopicSuggestionSignals {
  const signals: TopicSuggestionSignals = {
    senderEmails: [],
    senderDomains: [],
    recipientEmails: [],
    listIds: [],
    jiraProjectKeys: [],
    threadId
  };

  entries.forEach((entry) => {
    if (entry.type === "senderEmail") {
      signals.senderEmails.push(entry.value);
    } else if (entry.type === "senderDomain") {
      signals.senderDomains.push(entry.value);
    } else if (entry.type === "recipient") {
      signals.recipientEmails.push(entry.value);
    } else if (entry.type === "listId") {
      signals.listIds.push(entry.value);
    } else if (entry.type === "jiraProjectKey") {
      signals.jiraProjectKeys.push(entry.value);
    }
  });

  return signals;
}

function topicSuggestionSignalEntries(signals: TopicSuggestionSignals): TopicSignalEntry[] {
  return [
    ...signals.senderEmails.map((value) => ({ type: "senderEmail" as const, value })),
    ...signals.senderDomains.map((value) => ({ type: "senderDomain" as const, value })),
    ...signals.recipientEmails.map((value) => ({ type: "recipient" as const, value })),
    ...signals.listIds.map((value) => ({ type: "listId" as const, value })),
    ...signals.jiraProjectKeys.map((value) => ({ type: "jiraProjectKey" as const, value }))
  ];
}

type TopicSuggestionSignalIgnore = (entry: Pick<TopicSignalEntry, "type" | "value">) => boolean;

/**
 * Decides which signals never count for suggestions (own addresses, free-mail
 * senders). Built once per call: the own addresses are normalized once and
 * each (type, value) is decided once. Not shared across requests.
 */
function createTopicSuggestionSignalIgnore(options?: {
  accountEmail?: OwnAddressInput;
}): TopicSuggestionSignalIgnore {
  const isOwn = ownAddressMatcher(ownAddressList(options?.accountEmail));
  const decisions = new Map<string, boolean>();
  const decide = (entry: Pick<TopicSignalEntry, "type" | "value">) => {
    const value = entry.value.trim();
    if (!value) return true;

    if (entry.type === "senderEmail") {
      const normalizedEmail = value.toLowerCase();
      if (isOwn(normalizedEmail)) {
        return true;
      }
      const domain = normalizedEmail.split("@")[1] ?? "";
      return isFreeMailDomain(domain);
    }

    if (entry.type === "senderDomain") {
      return isFreeMailDomain(value.toLowerCase());
    }

    if (entry.type === "recipient" && isOwn(value)) {
      return true;
    }

    return false;
  };
  return (entry) => {
    const key = topicSuggestionSignalKey(entry.type, entry.value);
    const known = decisions.get(key);
    if (known !== undefined) return known;
    const decision = decide(entry);
    decisions.set(key, decision);
    return decision;
  };
}

function normalizeTopicSuggestionSignals(
  signals: MessageSignals,
  options?: {
    accountEmail?: OwnAddressInput;
  }
): TopicSuggestionSignals {
  const shouldIgnore = createTopicSuggestionSignalIgnore(options);
  return topicSuggestionSignalsFromEntries(
    collectTopicSignalEntries([signals], {
      excludeAccountEmail: options?.accountEmail ?? null
    }).filter((entry) => !shouldIgnore(entry)),
    signals.threadId
  );
}

function topicSuggestionEntriesFromThreadSignalRows(
  rows: Array<Pick<TopicThreadSignalRow, "signalType" | "signalValue">>,
  shouldIgnore: TopicSuggestionSignalIgnore
): TopicSignalEntry[] {
  return rows.flatMap((row) => {
    const type = (row.signalType ?? "").trim() as TopicSuggestionSignal;
    const value = (row.signalValue ?? "").trim();
    if (!TOPIC_SUGGESTION_SIGNALS.includes(type) || !value) return [];
    if (shouldIgnore({ type, value })) {
      return [];
    }
    return [{ type, value }];
  });
}

function getTopicSuggestionSignalsForThreadsFromDb(
  db: any,
  accountId: string,
  threadIds: string[],
  options?: {
    accountEmail?: OwnAddressInput;
  }
): Map<string, TopicSuggestionSignals> {
  const normalizedThreadIds = Array.from(
    new Set(threadIds.map((threadId) => threadId.trim()).filter(Boolean))
  );
  const result = new Map<string, TopicSuggestionSignals>();
  if (normalizedThreadIds.length === 0) return result;

  normalizedThreadIds.forEach((threadId) => {
    result.set(threadId, topicSuggestionSignalsFromEntries([], threadId));
  });

  const shouldIgnore = createTopicSuggestionSignalIgnore(options);
  const placeholders = normalizedThreadIds.map(() => "?").join(",");
  const rows = db
    .prepare(
      `SELECT threadId, signalType, signalValue
       FROM thread_signals
       WHERE accountId = ? AND threadId IN (${placeholders})
       ORDER BY threadId ASC, signalType ASC, signalValue ASC`
    )
    .all(accountId, ...normalizedThreadIds) as TopicThreadSignalRow[];

  let activeThreadId = "";
  let activeRows: TopicThreadSignalRow[] = [];

  const flush = () => {
    if (!activeThreadId) return;
    result.set(
      activeThreadId,
      topicSuggestionSignalsFromEntries(
        topicSuggestionEntriesFromThreadSignalRows(activeRows, shouldIgnore),
        activeThreadId
      )
    );
  };

  rows.forEach((row) => {
    const threadId = (row.threadId ?? "").trim();
    if (!threadId) return;
    if (threadId !== activeThreadId) {
      flush();
      activeThreadId = threadId;
      activeRows = [];
    }
    activeRows.push(row);
  });

  flush();
  return result;
}

async function getTopicSuggestionSignalsForThread(
  accountId: string,
  threadId: string,
  options?: {
    accountEmail?: OwnAddressInput;
  }
): Promise<TopicSuggestionSignals> {
  return withAccountDb(accountId, (db) => {
    return (
      getTopicSuggestionSignalsForThreadsFromDb(db, accountId, [threadId], options).get(threadId) ??
      topicSuggestionSignalsFromEntries([], threadId)
    );
  });
}

function getTopicSuggestionsForSignals(
  db: any,
  accountId: string,
  signals: TopicSuggestionSignals
): Topic[] {
  const {
    senderEmails,
    senderDomains,
    recipientEmails,
    listIds,
    jiraProjectKeys,
    threadId
  } = signals;

  if (
    senderEmails.length === 0 &&
    senderDomains.length === 0 &&
    recipientEmails.length === 0 &&
    listIds.length === 0 &&
    jiraProjectKeys.length === 0
  ) {
    return [];
  }

  const signalEntries = topicSuggestionSignalEntries(signals);
  const conditions: string[] = [];
  const conditionArgs: any[] = [];
  signalEntries.forEach((entry) => {
    conditions.push(`(tls.signalType = ? AND tls.signalValue = ?)`);
    conditionArgs.push(entry.type, entry.value);
  });

  if (conditions.length === 0) return [];

  const scoreCaseSql =
    `CASE tls.signalType
       WHEN 'senderEmail' THEN ${TOPIC_SUGGESTION_WEIGHTS.senderEmail}
       WHEN 'listId' THEN ${TOPIC_SUGGESTION_WEIGHTS.listId}
       WHEN 'jiraProjectKey' THEN ${TOPIC_SUGGESTION_WEIGHTS.jiraProjectKey}
       WHEN 'recipient' THEN ${TOPIC_SUGGESTION_WEIGHTS.recipient}
       WHEN 'senderDomain' THEN ${TOPIC_SUGGESTION_WEIGHTS.senderDomain}
       ELSE 0
     END`;
  const queryArgs: any[] = [accountId, ...conditionArgs, ...(threadId ? [threadId] : []), accountId];

  const rows = db
    .prepare(
      `SELECT t.*,
              MAX(matches.threadScore) AS suggestionScore,
              COUNT(*) AS matchCount
       FROM topics t
       JOIN (
         SELECT tls.topicId,
                tls.threadId,
                SUM(${scoreCaseSql}) AS threadScore
         FROM topic_learning_signals tls
         WHERE tls.accountId = ?
           AND (${conditions.join(" OR ")})
           ${threadId ? "AND tls.threadId != ?" : ""}
         GROUP BY tls.topicId, tls.threadId
       ) matches ON matches.topicId = t.id
       WHERE t.accountId = ?
       GROUP BY t.id
       ORDER BY suggestionScore DESC, matchCount DESC, t.name ASC`
    )
    .all(...queryArgs) as any[];

  return rows.map((row) => ({
    ...rowToTopic(row),
    suggestionScore: row.suggestionScore as number,
    matchCount: row.matchCount as number
  }));
}

function getTopicSuggestionExplanationForSignals(
  db: any,
  accountId: string,
  signals: TopicSuggestionSignals
): TopicSuggestionExplanation {
  const signalEntries = topicSuggestionSignalEntries(signals);
  if (signalEntries.length === 0) {
    return { signals: [], topics: [] };
  }

  const conditions: string[] = [];
  const conditionArgs: any[] = [];
  signalEntries.forEach((entry) => {
    conditions.push(`(tls.signalType = ? AND tls.signalValue = ?)`);
    conditionArgs.push(entry.type, entry.value);
  });

  if (conditions.length === 0) {
    return { signals: [], topics: [] };
  }

  const queryArgs: any[] = [
    accountId,
    ...conditionArgs,
    ...(signals.threadId ? [signals.threadId] : []),
    accountId
  ];
  const rows = db
    .prepare(
      `SELECT t.*,
              tls.topicId,
              tls.threadId,
              tls.signalType,
              tls.signalValue
       FROM topic_learning_signals tls
       JOIN topics t
         ON t.id = tls.topicId
        AND t.accountId = tls.accountId
       WHERE tls.accountId = ?
         AND (${conditions.join(" OR ")})
         ${signals.threadId ? "AND tls.threadId != ?" : ""}
         AND t.accountId = ?
       ORDER BY t.name ASC, tls.threadId ASC, tls.signalType ASC, tls.signalValue ASC`
    )
    .all(...queryArgs) as Array<{
    topicId: string;
    threadId: string;
    signalType: TopicSuggestionSignal;
    signalValue: string;
  } & Record<string, any>>;

  const currentSignals = signalEntries.map((entry) => ({
    ...entry,
    weight: getTopicSuggestionWeight(entry.type)
  }));
  const topicsById = new Map<
    string,
    {
      topic: Topic;
      matchedSignals: Map<string, TopicSuggestionExplanationSignal>;
      matchedThreads: Map<
        string,
        {
          threadId: string;
          score: number;
          signals: Map<string, TopicSuggestionExplanationSignal>;
        }
      >;
    }
  >();

  rows.forEach((row) => {
    const type = (row.signalType ?? "").trim() as TopicSuggestionSignal;
    const value = (row.signalValue ?? "").trim();
    const threadId = (row.threadId ?? "").trim();
    if (!TOPIC_SUGGESTION_SIGNALS.includes(type) || !value || !threadId) return;
    const weight = getTopicSuggestionWeight(type);
    const signalKey = `${type}\u0000${value}`;
    const topicState = topicsById.get(row.topicId) ?? {
      topic: rowToTopic(row),
      matchedSignals: new Map<string, TopicSuggestionExplanationSignal>(),
      matchedThreads: new Map<
        string,
        {
          threadId: string;
          score: number;
          signals: Map<string, TopicSuggestionExplanationSignal>;
        }
      >()
    };
    topicState.matchedSignals.set(signalKey, { type, value, weight });
    const threadState = topicState.matchedThreads.get(threadId) ?? {
      threadId,
      score: 0,
      signals: new Map<string, TopicSuggestionExplanationSignal>()
    };
    if (!threadState.signals.has(signalKey)) {
      threadState.signals.set(signalKey, { type, value, weight });
      threadState.score += weight;
    }
    topicState.matchedThreads.set(threadId, threadState);
    topicsById.set(row.topicId, topicState);
  });

  const topics = Array.from(topicsById.values())
    .map((topicState) => {
      const matchedThreads = Array.from(topicState.matchedThreads.values())
        .map((threadState) => ({
          threadId: threadState.threadId,
          score: threadState.score,
          signals: Array.from(threadState.signals.values()).sort((a, b) => {
            if (b.weight !== a.weight) return b.weight - a.weight;
            if (a.type !== b.type) return a.type.localeCompare(b.type);
            return a.value.localeCompare(b.value);
          })
        }))
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.threadId.localeCompare(b.threadId);
        });
      const suggestionScore = matchedThreads[0]?.score ?? 0;
      return {
        topic: {
          ...topicState.topic,
          suggestionScore,
          matchCount: matchedThreads.length
        },
        suggestionScore,
        matchCount: matchedThreads.length,
        matchedSignals: Array.from(topicState.matchedSignals.values()).sort((a, b) => {
          if (b.weight !== a.weight) return b.weight - a.weight;
          if (a.type !== b.type) return a.type.localeCompare(b.type);
          return a.value.localeCompare(b.value);
        }),
        matchedThreads
      };
    })
    .sort((a, b) => {
      if (b.suggestionScore !== a.suggestionScore) return b.suggestionScore - a.suggestionScore;
      if (b.matchCount !== a.matchCount) return b.matchCount - a.matchCount;
      return a.topic.name.localeCompare(b.topic.name);
    });

  return { signals: currentSignals, topics };
}

/**
 * Suggest topics for a message based on past manual assignments.
 *
 * Derives suggestions purely from the thread_topics corpus — no manual rules.
 * For each signal present in the message (sender email, sender domain,
 * List-Id, Jira project key, recipient addresses), we look up topics that were previously
 * assigned to threads sharing that signal, and rank them by how often they
 * appear across matching threads.
 *
 * Topics already assigned to the current thread are excluded.
 */
export async function getTopicSuggestionsForMessage(
  accountId: string,
  signals: MessageSignals,
  options?: {
    accountEmail?: OwnAddressInput;
  }
): Promise<Topic[]> {
  const normalizedSignals = normalizeTopicSuggestionSignals(signals, options);
  return withAccountDb(accountId, (db) => getTopicSuggestionsForSignals(db, accountId, normalizedSignals));
}

export async function getTopicSuggestionsForThread(
  accountId: string,
  threadId: string,
  options?: {
    accountEmail?: OwnAddressInput;
  }
): Promise<Topic[]> {
  const normalizedThreadId = threadId.trim();
  if (!normalizedThreadId) return [];
  const signals = await getTopicSuggestionSignalsForThread(accountId, normalizedThreadId, options);
  return withAccountDb(accountId, (db) => getTopicSuggestionsForSignals(db, accountId, signals));
}

export async function getTopicSuggestionExplanationForThread(
  accountId: string,
  threadId: string,
  options?: {
    accountEmail?: OwnAddressInput;
  }
): Promise<TopicSuggestionExplanation> {
  const normalizedThreadId = threadId.trim();
  if (!normalizedThreadId) return { signals: [], topics: [] };
  const signals = await getTopicSuggestionSignalsForThread(accountId, normalizedThreadId, options);
  return withAccountDb(accountId, (db) =>
    getTopicSuggestionExplanationForSignals(db, accountId, signals)
  );
}

/**
 * Two bindings per signal pair, plus the two accountId bindings on the
 * learning-signal lookup. Stay under SQLite's default 999-variable limit.
 */
const TOPIC_SUGGESTION_SIGNAL_PAIR_BATCH = 400;

type TopicLearningMatchRow = {
  id: string;
  accountId: string;
  name: string;
  shortName?: string | null;
  color?: string | null;
  imapKeyword: string;
  createdAt: number;
  updatedAt: number;
  learningThreadId?: string | null;
  signalType?: string | null;
  signalValue?: string | null;
};

/** Learning rows of one topic for one signal key, counted per learning thread. */
type TopicSignalMatches = {
  rowsByThreadId: Map<string, number>;
  maxRows: number;
};

function topicSuggestionSignalKey(type: string, value: string) {
  return `${type}\u0000${value}`;
}

/** SQLite `ORDER BY name` uses binary UTF-8 collation. */
function compareSqliteText(left: string, right: string) {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

/**
 * One learning-signal lookup for every signal on the page, then the same
 * per-thread score as `getTopicSuggestionsForSignals`: SUM(weight) inside
 * each other thread, suggestionScore = MAX of those sums, matchCount =
 * number of matching threads, requesting thread excluded.
 */
function getTopicSuggestionsForThreadSignalBatch(
  db: any,
  accountId: string,
  signalsByThreadId: Map<string, TopicSuggestionSignals>,
  threadIds: string[]
): Map<string, Topic[]> {
  const signalKeysByThreadId = new Map<string, Set<string>>();
  const uniquePairs: TopicSignalEntry[] = [];
  const seenPairs = new Set<string>();

  threadIds.forEach((threadId) => {
    const signals = signalsByThreadId.get(threadId);
    if (!signals) return;
    const keys = new Set<string>();
    topicSuggestionSignalEntries(signals).forEach((entry) => {
      const key = topicSuggestionSignalKey(entry.type, entry.value);
      keys.add(key);
      if (seenPairs.has(key)) return;
      seenPairs.add(key);
      uniquePairs.push(entry);
    });
    signalKeysByThreadId.set(threadId, keys);
  });

  const rowsBySignalKey = new Map<string, TopicLearningMatchRow[]>();
  for (let start = 0; start < uniquePairs.length; start += TOPIC_SUGGESTION_SIGNAL_PAIR_BATCH) {
    const chunk = uniquePairs.slice(start, start + TOPIC_SUGGESTION_SIGNAL_PAIR_BATCH);
    const args: Array<string> = [accountId, accountId];
    chunk.forEach((entry) => {
      args.push(entry.type, entry.value);
    });
    const rows = db
      .prepare(
        `SELECT t.id AS id,
                t.accountId AS accountId,
                t.name AS name,
                t.shortName AS shortName,
                t.color AS color,
                t.imapKeyword AS imapKeyword,
                t.createdAt AS createdAt,
                t.updatedAt AS updatedAt,
                tls.threadId AS learningThreadId,
                tls.signalType AS signalType,
                tls.signalValue AS signalValue
         FROM topic_learning_signals tls
         JOIN topics t
           ON t.id = tls.topicId
          AND t.accountId = tls.accountId
         WHERE tls.accountId = ?
           AND t.accountId = ?
           AND (tls.signalType, tls.signalValue) IN (${chunk.map(() => "(?, ?)").join(", ")})`
      )
      .all(...args) as TopicLearningMatchRow[];
    rows.forEach((row) => {
      const type = (row.signalType ?? "").trim();
      const value = (row.signalValue ?? "").trim();
      if (!type || !value) return;
      const key = topicSuggestionSignalKey(type, value);
      const bucket = rowsBySignalKey.get(key);
      if (bucket) {
        bucket.push(row);
      } else {
        rowsBySignalKey.set(key, [row]);
      }
    });
  }

  // Aggregate the learning rows once per batch: per signal key and topic
  // (in first-match order), how many rows each learning thread has.
  const matchesBySignalKey = new Map<string, Map<string, TopicSignalMatches>>();
  const topicRowsById = new Map<string, TopicLearningMatchRow>();
  const learningThreadIds = new Set<string>();
  rowsBySignalKey.forEach((rows, key) => {
    const byTopicId = new Map<string, TopicSignalMatches>();
    rows.forEach((row) => {
      const learningThreadId = (row.learningThreadId ?? "").trim();
      if (!learningThreadId) return;
      learningThreadIds.add(learningThreadId);
      let matches = byTopicId.get(row.id);
      if (!matches) {
        matches = { rowsByThreadId: new Map(), maxRows: 0 };
        byTopicId.set(row.id, matches);
        if (!topicRowsById.has(row.id)) topicRowsById.set(row.id, row);
      }
      const count = (matches.rowsByThreadId.get(learningThreadId) ?? 0) + 1;
      matches.rowsByThreadId.set(learningThreadId, count);
      if (count > matches.maxRows) matches.maxRows = count;
    });
    matchesBySignalKey.set(key, byTopicId);
  });
  const signalWeight = (key: string) =>
    getTopicSuggestionWeight(key.slice(0, key.indexOf("\u0000")) as TopicSuggestionSignal);

  // Page threads often share the same signals (one sender, one list). Their
  // score only differs when the thread itself is a learning thread, so the
  // result is reused per signal-key sequence for every other thread.
  const suggestionsBySignalKeys = new Map<string, Topic[]>();

  const result = new Map<string, Topic[]>();
  threadIds.forEach((threadId) => {
    const signals = signalsByThreadId.get(threadId);
    const keys = signalKeysByThreadId.get(threadId);
    if (!signals || !keys || keys.size === 0) return;
    const ownThreadId = (signals.threadId ?? "").trim();
    const excludeThreadId = ownThreadId && learningThreadIds.has(ownThreadId) ? ownThreadId : "";
    const memoKey = excludeThreadId ? null : Array.from(keys).join("\u0001");
    const memoized = memoKey === null ? undefined : suggestionsBySignalKeys.get(memoKey);
    if (memoized) {
      if (memoized.length > 0) {
        result.set(threadId, memoized.map((topic) => ({ ...topic })));
      }
      return;
    }

    // Every learning thread of the key with the most rows (usually the shared
    // sender domain) scores at least that key's weight; only the threads the
    // other keys reach need their own sum.
    const signalKeys = Array.from(keys);
    let baseKey = signalKeys[0];
    signalKeys.forEach((key) => {
      if ((rowsBySignalKey.get(key)?.length ?? 0) > (rowsBySignalKey.get(baseKey)?.length ?? 0)) baseKey = key;
    });
    const baseWeight = signalWeight(baseKey);

    // Topics in the order their first non-excluded row appears, key by key.
    const topicIds = new Set<string>();
    signalKeys.forEach((key) => {
      if (!excludeThreadId) {
        matchesBySignalKey.get(key)?.forEach((_, topicId) => topicIds.add(topicId));
        return;
      }
      (rowsBySignalKey.get(key) ?? []).forEach((row) => {
        const learningThreadId = (row.learningThreadId ?? "").trim();
        if (learningThreadId && learningThreadId !== excludeThreadId) topicIds.add(row.id);
      });
    });

    const suggestions: Topic[] = [];
    topicIds.forEach((topicId) => {
      const base = matchesBySignalKey.get(baseKey)?.get(topicId);
      let matchCount = base?.rowsByThreadId.size ?? 0;
      let suggestionScore = (base?.maxRows ?? 0) * baseWeight;
      if (base && excludeThreadId && base.rowsByThreadId.has(excludeThreadId)) {
        matchCount--;
        suggestionScore = 0;
        base.rowsByThreadId.forEach((count, learningThreadId) => {
          if (learningThreadId !== excludeThreadId) suggestionScore = Math.max(suggestionScore, count * baseWeight);
        });
      }
      const threadScores = new Map<string, number>();
      signalKeys.forEach((key) => {
        if (key === baseKey) return;
        const matches = matchesBySignalKey.get(key)?.get(topicId);
        if (!matches) return;
        const weight = signalWeight(key);
        matches.rowsByThreadId.forEach((count, learningThreadId) => {
          if (learningThreadId === excludeThreadId) return;
          let score = threadScores.get(learningThreadId);
          if (score === undefined) {
            const baseRows = base?.rowsByThreadId.get(learningThreadId) ?? 0;
            if (baseRows === 0) matchCount++;
            score = baseRows * baseWeight;
          }
          threadScores.set(learningThreadId, score + count * weight);
        });
      });
      threadScores.forEach((score) => {
        if (score > suggestionScore) suggestionScore = score;
      });
      if (matchCount === 0) return;
      // Every row of a topic carries the same joined topic columns.
      suggestions.push({
        ...rowToTopic(topicRowsById.get(topicId)),
        suggestionScore,
        matchCount
      });
    });
    suggestions.sort((left, right) => {
      const scoreDiff = (right.suggestionScore ?? 0) - (left.suggestionScore ?? 0);
      if (scoreDiff !== 0) return scoreDiff;
      const countDiff = (right.matchCount ?? 0) - (left.matchCount ?? 0);
      if (countDiff !== 0) return countDiff;
      return compareSqliteText(left.name, right.name);
    });
    if (memoKey !== null) {
      suggestionsBySignalKeys.set(memoKey, suggestions);
    }
    if (suggestions.length > 0) {
      result.set(threadId, suggestions);
    }
  });

  return result;
}

export async function getTopicSuggestionsForThreads(
  accountId: string,
  threadIds: string[],
  options?: {
    accountEmail?: OwnAddressInput;
  }
): Promise<Map<string, Topic[]>> {
  const normalizedThreadIds = Array.from(
    new Set(threadIds.map((threadId) => threadId.trim()).filter(Boolean))
  );
  if (normalizedThreadIds.length === 0) return new Map();

  return withAccountDb(accountId, (db) => {
    // Suggestions only come from learning signals of existing topics: a
    // mailbox without topics cannot match, so skip reading its signals.
    if (!db.prepare(`SELECT 1 FROM topics WHERE accountId = ? LIMIT 1`).get(accountId)) {
      return new Map<string, Topic[]>();
    }
    const signalsByThreadId = getTopicSuggestionSignalsForThreadsFromDb(
      db,
      accountId,
      normalizedThreadIds,
      options
    );
    return getTopicSuggestionsForThreadSignalBatch(
      db,
      accountId,
      signalsByThreadId,
      normalizedThreadIds
    );
  });
}

type TopicSuggestionCandidateRow = {
  id: string;
  threadId: string;
  dateValue: number;
};

export async function getTopicThreadSuggestions(
  accountId: string,
  topicId: string,
  options?: {
    accountEmail?: OwnAddressInput;
    limit?: number;
    maxAgeDays?: number;
  }
): Promise<TopicThreadSuggestion[]> {
  const normalizedTopicId = topicId.trim();
  if (!normalizedTopicId) return [];

  const limit = Math.max(1, Math.min(50, Math.trunc(options?.limit ?? 5) || 5));
  const maxAgeDays = Math.max(1, Math.min(3650, Math.trunc(options?.maxAgeDays ?? 180) || 180));
  const cutoffMs = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;

  return withAccountDb(accountId, (db) => {
    const topicExists = db
      .prepare(`SELECT 1 FROM topics WHERE id = ? AND accountId = ?`)
      .get(normalizedTopicId, accountId) as { 1?: number } | undefined;
    if (!topicExists) return [];

    const inboxFolderRow = db
      .prepare(
        `SELECT id
         FROM folders
         WHERE accountId = ?
           AND (
             lower(COALESCE(specialUse, '')) = '\\inbox'
             OR lower(name) = 'inbox'
           )
         ORDER BY
           CASE WHEN lower(COALESCE(specialUse, '')) = '\\inbox' THEN 0 ELSE 1 END,
           CASE WHEN lower(name) = 'inbox' THEN 0 ELSE 1 END,
           id ASC
         LIMIT 1`
      )
      .get(accountId) as { id?: string | null } | undefined;
    const inboxFolderId = String(inboxFolderRow?.id ?? "").trim();
    if (!inboxFolderId) return [];

    const candidateRows = db
      .prepare(
        `SELECT
           m.id,
           m.threadId,
           m.dateValue
         FROM messages m
         WHERE m.accountId = ?
           AND m.folderId = ?
           AND COALESCE(m.deleted, 0) = 0
           AND m.dateValue >= ?
           AND NOT EXISTS (
             SELECT 1
             FROM thread_topics tt
             WHERE tt.accountId = m.accountId
               AND tt.threadId = m.threadId
           )
           AND m.id = (
             SELECT m2.id
             FROM messages m2
             WHERE m2.accountId = m.accountId
               AND m2.threadId = m.threadId
               AND m2.folderId = ?
               AND COALESCE(m2.deleted, 0) = 0
             ORDER BY m2.dateValue DESC, m2.id DESC
             LIMIT 1
           )
         ORDER BY m.dateValue DESC, m.id DESC`
      )
      .all(accountId, inboxFolderId, cutoffMs, inboxFolderId) as TopicSuggestionCandidateRow[];

    if (candidateRows.length === 0) return [];

    const candidateRowsByThreadId = new Map<string, TopicSuggestionCandidateRow>();
    candidateRows.forEach((row) => {
      const threadId = String(row.threadId ?? "").trim();
      if (!threadId || candidateRowsByThreadId.has(threadId)) return;
      candidateRowsByThreadId.set(threadId, row);
    });
    const candidateThreadIds = Array.from(candidateRowsByThreadId.keys());
    if (candidateThreadIds.length === 0) return [];

    const signalsByThreadId = getTopicSuggestionSignalsForThreadsFromDb(
      db,
      accountId,
      candidateThreadIds,
      { accountEmail: options?.accountEmail }
    );

    const suggestions: TopicThreadSuggestion[] = [];
    candidateThreadIds.forEach((threadId) => {
      const signals = signalsByThreadId.get(threadId);
      if (!signals) return;
      const topicMatch = getTopicSuggestionsForSignals(db, accountId, signals).find(
        (topic) => topic.id === normalizedTopicId
      );
      if (!topicMatch) return;
      const row = candidateRowsByThreadId.get(threadId);
      if (!row) return;
      suggestions.push({
        threadId,
        representativeMessageId: row.id,
        suggestionScore: topicMatch.suggestionScore ?? 0
      });
    });

    suggestions.sort((a, b) => {
      if (b.suggestionScore !== a.suggestionScore) {
        return b.suggestionScore - a.suggestionScore;
      }
      const aRow = candidateRowsByThreadId.get(a.threadId);
      const bRow = candidateRowsByThreadId.get(b.threadId);
      if ((bRow?.dateValue ?? 0) !== (aRow?.dateValue ?? 0)) {
        return (bRow?.dateValue ?? 0) - (aRow?.dateValue ?? 0);
      }
      return a.threadId.localeCompare(b.threadId);
    });

    return suggestions.slice(0, limit);
  });
}
