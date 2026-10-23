import { randomUUID } from "crypto";
import { describe, expect, test } from "bun:test";
import { dbModulePromise } from "./testDbHarness";
import type { Account, Folder, Message } from "./data";
import {
  createTopic,
  excludeTopicLearningSignal,
  getTopicThreadSuggestions,
  getTopicSuggestionExplanationForThread,
  getTopicStats,
  getTopicSuggestionsForMessage,
  getTopicSuggestionsForThread,
  getTopicSuggestionsForThreads,
  getTopicsForThread,
  setThreadTopics
} from "./topics";

function buildAccount(accountId: string): Account {
  return {
    id: accountId,
    name: "Test Account",
    email: "owner@example.com",
    avatar: "",
    imap: {
      host: "imap.example.com",
      port: 993,
      secure: true,
      user: "owner@example.com",
      password: "secret"
    },
    smtp: {
      host: "smtp.example.com",
      port: 465,
      secure: true,
      user: "owner@example.com",
      password: "secret"
    }
  };
}

function buildFolder(accountId: string): Folder {
  return {
    id: `${accountId}-inbox`,
    accountId,
    name: "Inbox",
    count: 0,
    unreadCount: 0,
    specialUse: "\\Inbox"
  };
}

function buildArchiveFolder(accountId: string): Folder {
  return {
    id: `${accountId}-archive`,
    accountId,
    name: "Archive",
    count: 0,
    unreadCount: 0,
    specialUse: "\\Archive"
  };
}

function buildMessage(params: {
  id: string;
  accountId: string;
  folderId: string;
  threadId: string;
  messageId: string;
  subject?: string;
  from: string;
  fromEmail: string;
  to: string;
  cc?: string;
  listId?: string;
  dateValue: number;
}): Message {
  return {
    id: params.id,
    accountId: params.accountId,
    folderId: params.folderId,
    threadId: params.threadId,
    messageId: params.messageId,
    subject: params.subject ?? params.messageId,
    from: params.from,
    fromEmail: params.fromEmail,
    to: params.to,
    cc: params.cc,
    listId: params.listId,
    preview: params.messageId,
    date: new Date(params.dateValue).toISOString(),
    dateValue: params.dateValue,
    body: params.messageId
  };
}

function uniqueAccountId(prefix: string) {
  return `${prefix}-${randomUUID()}`;
}

describe("topic suggestions", () => {
  test("prefers a strong multi-signal match over a more common weak match", async () => {
    const accountId = uniqueAccountId("acc-topic-suggestions");
    const folder = buildFolder(accountId);
    const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);

    await upsertMessages(
      accountId,
      folder.id,
      [
        buildMessage({
          id: "msg-strong",
          accountId,
          folderId: folder.id,
          threadId: "thread-strong",
          messageId: "<strong@example.com>",
          from: "Alerts <alerts@example.com>",
          fromEmail: "alerts@example.com",
          to: "Platform Team <team@example.com>",
          listId: "lists.example.com/unified-api",
          dateValue: Date.UTC(2026, 2, 18, 8, 0, 0)
        }),
        buildMessage({
          id: "msg-weak-1",
          accountId,
          folderId: folder.id,
          threadId: "thread-weak-1",
          messageId: "<weak-1@example.com>",
          from: "Build Bot <bot1@example.com>",
          fromEmail: "bot1@example.com",
          to: "Someone Else <other@example.com>",
          dateValue: Date.UTC(2026, 2, 18, 8, 5, 0)
        }),
        buildMessage({
          id: "msg-weak-2",
          accountId,
          folderId: folder.id,
          threadId: "thread-weak-2",
          messageId: "<weak-2@example.com>",
          from: "Build Bot <bot2@example.com>",
          fromEmail: "bot2@example.com",
          to: "Someone Else <other@example.com>",
          dateValue: Date.UTC(2026, 2, 18, 8, 10, 0)
        }),
        buildMessage({
          id: "msg-weak-3",
          accountId,
          folderId: folder.id,
          threadId: "thread-weak-3",
          messageId: "<weak-3@example.com>",
          from: "Build Bot <bot3@example.com>",
          fromEmail: "bot3@example.com",
          to: "Someone Else <other@example.com>",
          dateValue: Date.UTC(2026, 2, 18, 8, 15, 0)
        })
      ],
      true,
      { recomputeThreads: false }
    );

    const strongTopic = await createTopic(accountId, "Unified-API", "violet");
    const weakTopic = await createTopic(accountId, "PlanR", "red");
    await setThreadTopics(accountId, "thread-strong", [strongTopic.id]);
    await setThreadTopics(accountId, "thread-weak-1", [weakTopic.id]);
    await setThreadTopics(accountId, "thread-weak-2", [weakTopic.id]);
    await setThreadTopics(accountId, "thread-weak-3", [weakTopic.id]);

    const suggestions = await getTopicSuggestionsForMessage(accountId, {
      fromEmail: "alerts@example.com",
      to: "Platform Team <team@example.com>",
      listId: "lists.example.com/unified-api"
    });

    expect(suggestions.map((topic) => topic.name)).toEqual(["Unified-API", "PlanR"]);
    expect(suggestions[0]?.suggestionScore).toBe(11);
    expect(suggestions[0]?.matchCount).toBe(1);
    expect(suggestions[1]?.suggestionScore).toBe(1);
    expect(suggestions[1]?.matchCount).toBe(3);
  });

  test("prefers an exact list-id match over more common shared sender history", async () => {
    const accountId = uniqueAccountId("acc-topic-suggestions-gitlab-list-id");
    const folder = buildFolder(accountId);
    const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);

    await upsertMessages(
      accountId,
      folder.id,
      [
        buildMessage({
          id: "msg-project-a-1",
          accountId,
          folderId: folder.id,
          threadId: "thread-project-a-1",
          messageId: "<project-a-1@example.com>",
          from: "GitLab <gitlab@mg.gitlab.com>",
          fromEmail: "gitlab@mg.gitlab.com",
          to: "owner@example.com",
          listId: "group/project-a <project-a.gitlab.example>",
          dateValue: Date.UTC(2026, 2, 18, 8, 20, 0)
        }),
        buildMessage({
          id: "msg-project-a-2",
          accountId,
          folderId: folder.id,
          threadId: "thread-project-a-2",
          messageId: "<project-a-2@example.com>",
          from: "GitLab <gitlab@mg.gitlab.com>",
          fromEmail: "gitlab@mg.gitlab.com",
          to: "owner@example.com",
          listId: "group/project-a <project-a.gitlab.example>",
          dateValue: Date.UTC(2026, 2, 18, 8, 25, 0)
        }),
        buildMessage({
          id: "msg-project-a-3",
          accountId,
          folderId: folder.id,
          threadId: "thread-project-a-3",
          messageId: "<project-a-3@example.com>",
          from: "GitLab <gitlab@mg.gitlab.com>",
          fromEmail: "gitlab@mg.gitlab.com",
          to: "owner@example.com",
          listId: "group/project-a <project-a.gitlab.example>",
          dateValue: Date.UTC(2026, 2, 18, 8, 30, 0)
        }),
        buildMessage({
          id: "msg-project-b-history",
          accountId,
          folderId: folder.id,
          threadId: "thread-project-b-history",
          messageId: "<project-b-history@example.com>",
          from: "GitLab <gitlab@mg.gitlab.com>",
          fromEmail: "gitlab@mg.gitlab.com",
          to: "owner@example.com",
          listId: "group/project-b <project-b.gitlab.example>",
          dateValue: Date.UTC(2026, 2, 18, 8, 35, 0)
        }),
        buildMessage({
          id: "msg-project-b-target",
          accountId,
          folderId: folder.id,
          threadId: "thread-project-b-target",
          messageId: "<project-b-target@example.com>",
          from: "GitLab <gitlab@mg.gitlab.com>",
          fromEmail: "gitlab@mg.gitlab.com",
          to: "owner@example.com",
          listId: "group/project-b <project-b.gitlab.example>",
          dateValue: Date.UTC(2026, 2, 18, 8, 40, 0)
        })
      ],
      true,
      { recomputeThreads: false }
    );

    const topicA = await createTopic(accountId, "Topic A", "blue");
    const topicB = await createTopic(accountId, "Topic B", "green");
    await setThreadTopics(accountId, "thread-project-a-1", [topicA.id]);
    await setThreadTopics(accountId, "thread-project-a-2", [topicA.id]);
    await setThreadTopics(accountId, "thread-project-a-3", [topicA.id]);
    await setThreadTopics(accountId, "thread-project-b-history", [topicB.id]);

    const suggestions = await getTopicSuggestionsForThread(accountId, "thread-project-b-target", {
      accountEmail: "owner@example.com"
    });

    expect(suggestions.map((topic) => topic.name)).toEqual(["Topic B", "Topic A"]);
    expect(suggestions[0]?.suggestionScore).toBe(9);
    expect(suggestions[0]?.matchCount).toBe(1);
    expect(suggestions[1]?.suggestionScore).toBe(5);
    expect(suggestions[1]?.matchCount).toBe(3);
  });

  test("uses match count as a tiebreak when best-thread scores are equal", async () => {
    const accountId = uniqueAccountId("acc-topic-suggestions-best-score-tie");
    const folder = buildFolder(accountId);
    const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);

    await upsertMessages(
      accountId,
      folder.id,
      [
        buildMessage({
          id: "msg-alpha-history",
          accountId,
          folderId: folder.id,
          threadId: "thread-alpha-history",
          messageId: "<alpha-history@example.com>",
          from: "Alerts <alerts@example.com>",
          fromEmail: "alerts@example.com",
          to: "owner@example.com",
          dateValue: Date.UTC(2026, 2, 18, 8, 45, 0)
        }),
        buildMessage({
          id: "msg-beta-history-1",
          accountId,
          folderId: folder.id,
          threadId: "thread-beta-history-1",
          messageId: "<beta-history-1@example.com>",
          from: "Alerts <alerts@example.com>",
          fromEmail: "alerts@example.com",
          to: "owner@example.com",
          dateValue: Date.UTC(2026, 2, 18, 8, 50, 0)
        }),
        buildMessage({
          id: "msg-beta-history-2",
          accountId,
          folderId: folder.id,
          threadId: "thread-beta-history-2",
          messageId: "<beta-history-2@example.com>",
          from: "Alerts <alerts@example.com>",
          fromEmail: "alerts@example.com",
          to: "owner@example.com",
          dateValue: Date.UTC(2026, 2, 18, 8, 55, 0)
        }),
        buildMessage({
          id: "msg-target-tie",
          accountId,
          folderId: folder.id,
          threadId: "thread-target-tie",
          messageId: "<target-tie@example.com>",
          from: "Alerts <alerts@example.com>",
          fromEmail: "alerts@example.com",
          to: "owner@example.com",
          dateValue: Date.UTC(2026, 2, 18, 9, 0, 0)
        })
      ],
      true,
      { recomputeThreads: false }
    );

    const alpha = await createTopic(accountId, "Alpha", "blue");
    const beta = await createTopic(accountId, "Beta", "red");
    await setThreadTopics(accountId, "thread-alpha-history", [alpha.id]);
    await setThreadTopics(accountId, "thread-beta-history-1", [beta.id]);
    await setThreadTopics(accountId, "thread-beta-history-2", [beta.id]);

    const suggestions = await getTopicSuggestionsForThread(accountId, "thread-target-tie", {
      accountEmail: "owner@example.com"
    });

    expect(suggestions.map((topic) => topic.name)).toEqual(["Beta", "Alpha"]);
    expect(suggestions[0]?.suggestionScore).toBe(5);
    expect(suggestions[0]?.matchCount).toBe(2);
    expect(suggestions[1]?.suggestionScore).toBe(5);
    expect(suggestions[1]?.matchCount).toBe(1);
  });

  test("ignores the account owner's own email as a recipient suggestion signal", async () => {
    const accountId = uniqueAccountId("acc-topic-suggestions-own-recipient");
    const folder = buildFolder(accountId);
    const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);

    await upsertMessages(
      accountId,
      folder.id,
      [
        buildMessage({
          id: "msg-history-1",
          accountId,
          folderId: folder.id,
          threadId: "thread-history-1",
          messageId: "<history-1@example.com>",
          from: "Bot 1 <bot1@example.com>",
          fromEmail: "bot1@example.com",
          to: "owner@example.com",
          dateValue: Date.UTC(2026, 2, 18, 9, 0, 0)
        }),
        buildMessage({
          id: "msg-history-2",
          accountId,
          folderId: folder.id,
          threadId: "thread-history-2",
          messageId: "<history-2@example.com>",
          from: "Bot 2 <bot2@example.com>",
          fromEmail: "bot2@example.com",
          to: "owner@example.com",
          dateValue: Date.UTC(2026, 2, 18, 9, 5, 0)
        })
      ],
      true,
      { recomputeThreads: false }
    );

    const topic = await createTopic(accountId, "Unified-API", "violet");
    await setThreadTopics(accountId, "thread-history-1", [topic.id]);
    await setThreadTopics(accountId, "thread-history-2", [topic.id]);

    const suggestions = await getTopicSuggestionsForMessage(accountId, {
      fromEmail: "newsletter@kajabi.example",
      to: "owner@example.com"
    }, {
      accountEmail: "owner@example.com"
    });

    expect(suggestions).toEqual([]);
  });

  test("ignores the account owner's own email as a sender suggestion signal for threads", async () => {
    const accountId = uniqueAccountId("acc-topic-suggestions-own-sender");
    const folder = buildFolder(accountId);
    const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);

    await upsertMessages(
      accountId,
      folder.id,
      [
        buildMessage({
          id: "msg-history",
          accountId,
          folderId: folder.id,
          threadId: "thread-history",
          messageId: "<history-own-sender@example.com>",
          from: "Owner <owner@example.com>",
          fromEmail: "owner@example.com",
          to: "school@example.com",
          dateValue: Date.UTC(2026, 2, 18, 9, 0, 0)
        }),
        buildMessage({
          id: "msg-target",
          accountId,
          folderId: folder.id,
          threadId: "thread-target",
          messageId: "<target-own-sender@example.com>",
          from: "Owner <owner@example.com>",
          fromEmail: "owner@example.com",
          to: "newsletter@example.com",
          dateValue: Date.UTC(2026, 2, 18, 9, 5, 0)
        })
      ],
      true,
      { recomputeThreads: false }
    );

    const topic = await createTopic(accountId, "School", "blue");
    await setThreadTopics(accountId, "thread-history", [topic.id]);

    const suggestions = await getTopicSuggestionsForThread(accountId, "thread-target", {
      accountEmail: "owner@example.com"
    });

    expect(suggestions).toEqual([]);
  });

  test("uses Jira project keys to distinguish topics with otherwise identical sender signals", async () => {
    const accountId = uniqueAccountId("acc-topic-suggestions-jira-message");
    const folder = buildFolder(accountId);
    const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);

    await upsertMessages(
      accountId,
      folder.id,
      [
        buildMessage({
          id: "msg-unsapix",
          accountId,
          folderId: folder.id,
          threadId: "thread-unsapix",
          messageId: "<JIRA.100.1773827800000@Atlassian.JIRA>",
          subject: "[subshell Support] (UNSAPIX-24) Bug report",
          from: "Support System <noreply@subshell.com>",
          fromEmail: "noreply@subshell.com",
          to: "paul@example.com",
          dateValue: Date.UTC(2026, 2, 18, 9, 10, 0)
        }),
        buildMessage({
          id: "msg-planr",
          accountId,
          folderId: folder.id,
          threadId: "thread-planr",
          messageId: "<JIRA.101.1773827810000@Atlassian.JIRA>",
          subject: "[subshell Support] (PLANR-88) Feature request",
          from: "Support System <noreply@subshell.com>",
          fromEmail: "noreply@subshell.com",
          to: "paul@example.com",
          dateValue: Date.UTC(2026, 2, 18, 9, 20, 0)
        })
      ],
      true,
      { recomputeThreads: false }
    );

    const unsapixTopic = await createTopic(accountId, "UNSAPIX", "blue");
    const planrTopic = await createTopic(accountId, "PLANR", "red");
    await setThreadTopics(accountId, "thread-unsapix", [unsapixTopic.id]);
    await setThreadTopics(accountId, "thread-planr", [planrTopic.id]);

    const suggestions = await getTopicSuggestionsForMessage(accountId, {
      fromEmail: "noreply@subshell.com",
      to: "paul@example.com",
      subject: "[subshell Support] (UNSAPIX-311) Buegeleisen: TopMedia",
      messageId: "<JIRA.132074.1770738900000.60180.1773827820586@Atlassian.JIRA>"
    });

    expect(suggestions.map((topic) => topic.name)).toEqual(["UNSAPIX", "PLANR"]);
    expect(suggestions[0]?.suggestionScore).toBe(11);
    expect(suggestions[0]?.matchCount).toBe(1);
    expect(suggestions[1]?.suggestionScore).toBe(7);
    expect(suggestions[1]?.matchCount).toBe(1);
  });

  test("derives suggestion signals from stored thread messages", async () => {
    const accountId = uniqueAccountId("acc-topic-suggestions-thread-signals");
    const folder = buildFolder(accountId);
    const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);

    await upsertMessages(
      accountId,
      folder.id,
      [
        buildMessage({
          id: "msg-history",
          accountId,
          folderId: folder.id,
          threadId: "thread-history",
          messageId: "<history@example.com>",
          from: "GitLab <gitlab@mg.gitlab.com>",
          fromEmail: "gitlab@mg.gitlab.com",
          to: "owner@example.com",
          listId: "linon/erwin/planning <40384606.planning.erwin.linon.gitlab.com>",
          dateValue: Date.UTC(2026, 2, 18, 10, 0, 0)
        }),
        buildMessage({
          id: "msg-target",
          accountId,
          folderId: folder.id,
          threadId: "thread-target",
          messageId: "<target@example.com>",
          from: "GitLab <gitlab@mg.gitlab.com>",
          fromEmail: "gitlab@mg.gitlab.com",
          to: "owner@example.com",
          listId: "linon/erwin/planning <40384606.planning.erwin.linon.gitlab.com>",
          dateValue: Date.UTC(2026, 2, 18, 10, 5, 0)
        })
      ],
      true,
      { recomputeThreads: false }
    );

    const topic = await createTopic(accountId, "Linon", "orange");
    await setThreadTopics(accountId, "thread-history", [topic.id]);

    const suggestions = await getTopicSuggestionsForThread(accountId, "thread-target", {
      accountEmail: "owner@example.com"
    });

    expect(suggestions.map((item) => item.name)).toEqual(["Linon"]);
    expect(suggestions[0]?.suggestionScore).toBe(9);
    expect(suggestions[0]?.matchCount).toBe(1);
  });

  test("ignores free-mail sender signals for topic suggestions", async () => {
    const accountId = uniqueAccountId("acc-topic-suggestions-free-mail");
    const folder = buildFolder(accountId);
    const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);

    await upsertMessages(
      accountId,
      folder.id,
      [
        buildMessage({
          id: "msg-history",
          accountId,
          folderId: folder.id,
          threadId: "thread-history",
          messageId: "<history-free-mail@example.com>",
          from: "Sender <person@gmail.com>",
          fromEmail: "person@gmail.com",
          to: "owner@example.com",
          dateValue: Date.UTC(2026, 2, 18, 10, 0, 0)
        }),
        buildMessage({
          id: "msg-target",
          accountId,
          folderId: folder.id,
          threadId: "thread-target",
          messageId: "<target-free-mail@example.com>",
          from: "Sender <person@gmail.com>",
          fromEmail: "person@gmail.com",
          to: "owner@example.com",
          dateValue: Date.UTC(2026, 2, 18, 10, 5, 0)
        })
      ],
      true,
      { recomputeThreads: false }
    );

    const topic = await createTopic(accountId, "Helge", "orange");
    await setThreadTopics(accountId, "thread-history", [topic.id]);

    const suggestions = await getTopicSuggestionsForThread(accountId, "thread-target", {
      accountEmail: "owner@example.com"
    });
    expect(suggestions).toEqual([]);

    const explanation = await getTopicSuggestionExplanationForThread(accountId, "thread-target", {
      accountEmail: "owner@example.com"
    });
    expect(explanation.signals).toEqual([]);
    expect(explanation.topics).toEqual([]);
  });

  test("derives Jira project keys from stored thread messages", async () => {
    const accountId = uniqueAccountId("acc-topic-suggestions-thread-jira");
    const folder = buildFolder(accountId);
    const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);

    await upsertMessages(
      accountId,
      folder.id,
      [
        buildMessage({
          id: "msg-history-unsapix",
          accountId,
          folderId: folder.id,
          threadId: "thread-history-unsapix",
          messageId: "<JIRA.200.1773827820000@Atlassian.JIRA>",
          subject: "[subshell Support] (UNSAPIX-24) Bug report",
          from: "Support System <noreply@subshell.com>",
          fromEmail: "noreply@subshell.com",
          to: "paul@example.com",
          dateValue: Date.UTC(2026, 2, 18, 10, 0, 0)
        }),
        buildMessage({
          id: "msg-history-planr",
          accountId,
          folderId: folder.id,
          threadId: "thread-history-planr",
          messageId: "<JIRA.201.1773827830000@Atlassian.JIRA>",
          subject: "[subshell Support] (PLANR-88) Feature request",
          from: "Support System <noreply@subshell.com>",
          fromEmail: "noreply@subshell.com",
          to: "paul@example.com",
          dateValue: Date.UTC(2026, 2, 18, 10, 5, 0)
        }),
        buildMessage({
          id: "msg-target",
          accountId,
          folderId: folder.id,
          threadId: "thread-target",
          messageId: "<JIRA.202.1773827840000@Atlassian.JIRA>",
          subject: "[subshell Support] (UNSAPIX-311) Buegeleisen: TopMedia",
          from: "Support System <noreply@subshell.com>",
          fromEmail: "noreply@subshell.com",
          to: "paul@example.com",
          dateValue: Date.UTC(2026, 2, 18, 10, 10, 0)
        })
      ],
      true,
      { recomputeThreads: false }
    );

    const unsapixTopic = await createTopic(accountId, "UNSAPIX", "blue");
    const planrTopic = await createTopic(accountId, "PLANR", "red");
    await setThreadTopics(accountId, "thread-history-unsapix", [unsapixTopic.id]);
    await setThreadTopics(accountId, "thread-history-planr", [planrTopic.id]);

    const suggestions = await getTopicSuggestionsForThread(accountId, "thread-target", {
      accountEmail: "owner@example.com"
    });

    expect(suggestions.map((item) => item.name)).toEqual(["UNSAPIX", "PLANR"]);
    expect(suggestions[0]?.suggestionScore).toBe(11);
    expect(suggestions[0]?.matchCount).toBe(1);
    expect(suggestions[1]?.suggestionScore).toBe(7);
    expect(suggestions[1]?.matchCount).toBe(1);
  });

  test("explains why a thread topic suggestion was made", async () => {
    const accountId = uniqueAccountId("acc-topic-suggestions-thread-explain");
    const folder = buildFolder(accountId);
    const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);

    await upsertMessages(
      accountId,
      folder.id,
      [
        buildMessage({
          id: "msg-history",
          accountId,
          folderId: folder.id,
          threadId: "thread-history",
          messageId: "<history-explain@example.com>",
          from: "GitLab <gitlab@mg.gitlab.com>",
          fromEmail: "gitlab@mg.gitlab.com",
          to: "owner@example.com",
          listId: "linon/erwin/planning <40384606.planning.erwin.linon.gitlab.com>",
          dateValue: Date.UTC(2026, 2, 18, 10, 0, 0)
        }),
        buildMessage({
          id: "msg-target",
          accountId,
          folderId: folder.id,
          threadId: "thread-target",
          messageId: "<target-explain@example.com>",
          from: "GitLab <gitlab@mg.gitlab.com>",
          fromEmail: "gitlab@mg.gitlab.com",
          to: "owner@example.com",
          listId: "linon/erwin/planning <40384606.planning.erwin.linon.gitlab.com>",
          dateValue: Date.UTC(2026, 2, 18, 10, 5, 0)
        })
      ],
      true,
      { recomputeThreads: false }
    );

    const topic = await createTopic(accountId, "Linon", "orange");
    await setThreadTopics(accountId, "thread-history", [topic.id]);

    const explanation = await getTopicSuggestionExplanationForThread(accountId, "thread-target", {
      accountEmail: "owner@example.com"
    });

    expect(explanation.signals).toEqual(expect.arrayContaining([
      { type: "senderEmail", value: "gitlab@mg.gitlab.com", weight: 4 },
      { type: "senderDomain", value: "mg.gitlab.com", weight: 1 },
      {
        type: "listId",
        value: "linon/erwin/planning <40384606.planning.erwin.linon.gitlab.com>",
        weight: 4
      }
    ]));
    expect(explanation.topics).toHaveLength(1);
    expect(explanation.topics[0]?.topic.name).toBe("Linon");
    expect(explanation.topics[0]?.suggestionScore).toBe(9);
    expect(explanation.topics[0]?.matchCount).toBe(1);
    expect(explanation.topics[0]?.matchedThreads).toEqual([
      {
        threadId: "thread-history",
        score: 9,
        signals: [
          {
            type: "listId",
            value: "linon/erwin/planning <40384606.planning.erwin.linon.gitlab.com>",
            weight: 4
          },
          { type: "senderEmail", value: "gitlab@mg.gitlab.com", weight: 4 },
          { type: "senderDomain", value: "mg.gitlab.com", weight: 1 }
        ]
      }
    ]);
  });

  test("reports the best matching thread score in explanations while keeping all matches", async () => {
    const accountId = uniqueAccountId("acc-topic-suggestions-thread-explain-best-match");
    const folder = buildFolder(accountId);
    const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);

    await upsertMessages(
      accountId,
      folder.id,
      [
        buildMessage({
          id: "msg-history-strong",
          accountId,
          folderId: folder.id,
          threadId: "thread-history-strong",
          messageId: "<history-strong@example.com>",
          from: "Alerts <alerts@example.com>",
          fromEmail: "alerts@example.com",
          to: "Platform Team <team@example.com>",
          listId: "lists.example.com/unified-api",
          dateValue: Date.UTC(2026, 2, 18, 10, 10, 0)
        }),
        buildMessage({
          id: "msg-history-weak",
          accountId,
          folderId: folder.id,
          threadId: "thread-history-weak",
          messageId: "<history-weak@example.com>",
          from: "Alerts <alerts@example.com>",
          fromEmail: "alerts@example.com",
          to: "owner@example.com",
          dateValue: Date.UTC(2026, 2, 18, 10, 15, 0)
        }),
        buildMessage({
          id: "msg-target-best-match",
          accountId,
          folderId: folder.id,
          threadId: "thread-target-best-match",
          messageId: "<target-best-match@example.com>",
          from: "Alerts <alerts@example.com>",
          fromEmail: "alerts@example.com",
          to: "Platform Team <team@example.com>",
          listId: "lists.example.com/unified-api",
          dateValue: Date.UTC(2026, 2, 18, 10, 20, 0)
        })
      ],
      true,
      { recomputeThreads: false }
    );

    const topic = await createTopic(accountId, "Unified-API", "violet");
    await setThreadTopics(accountId, "thread-history-strong", [topic.id]);
    await setThreadTopics(accountId, "thread-history-weak", [topic.id]);

    const explanation = await getTopicSuggestionExplanationForThread(
      accountId,
      "thread-target-best-match",
      {
        accountEmail: "owner@example.com"
      }
    );

    expect(explanation.topics).toHaveLength(1);
    expect(explanation.topics[0]?.topic.name).toBe("Unified-API");
    expect(explanation.topics[0]?.suggestionScore).toBe(11);
    expect(explanation.topics[0]?.matchCount).toBe(2);
    expect(explanation.topics[0]?.matchedThreads).toEqual([
      {
        threadId: "thread-history-strong",
        score: 11,
        signals: [
          { type: "listId", value: "lists.example.com/unified-api", weight: 4 },
          { type: "senderEmail", value: "alerts@example.com", weight: 4 },
          { type: "recipient", value: "team@example.com", weight: 2 },
          { type: "senderDomain", value: "example.com", weight: 1 }
        ]
      },
      {
        threadId: "thread-history-weak",
        score: 5,
        signals: [
          { type: "senderEmail", value: "alerts@example.com", weight: 4 },
          { type: "senderDomain", value: "example.com", weight: 1 }
        ]
      }
    ]);
  });

  test("batches thread suggestions and only returns matches for topic-less threads", async () => {
    const accountId = uniqueAccountId("acc-topic-suggestions-thread-batch");
    const folder = buildFolder(accountId);
    const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);

    await upsertMessages(
      accountId,
      folder.id,
      [
        buildMessage({
          id: "msg-history",
          accountId,
          folderId: folder.id,
          threadId: "thread-history",
          messageId: "<history-batch@example.com>",
          from: "GitLab <gitlab@mg.gitlab.com>",
          fromEmail: "gitlab@mg.gitlab.com",
          to: "owner@example.com",
          listId: "linon/erwin/planning <40384606.planning.erwin.linon.gitlab.com>",
          dateValue: Date.UTC(2026, 2, 18, 10, 0, 0)
        }),
        buildMessage({
          id: "msg-target-match",
          accountId,
          folderId: folder.id,
          threadId: "thread-target-match",
          messageId: "<target-match@example.com>",
          from: "GitLab <gitlab@mg.gitlab.com>",
          fromEmail: "gitlab@mg.gitlab.com",
          to: "owner@example.com",
          listId: "linon/erwin/planning <40384606.planning.erwin.linon.gitlab.com>",
          dateValue: Date.UTC(2026, 2, 18, 10, 5, 0)
        }),
        buildMessage({
          id: "msg-target-miss",
          accountId,
          folderId: folder.id,
          threadId: "thread-target-miss",
          messageId: "<target-miss@example.com>",
          from: "Newsletter <newsletter@example.com>",
          fromEmail: "newsletter@example.com",
          to: "owner@example.com",
          dateValue: Date.UTC(2026, 2, 18, 10, 10, 0)
        })
      ],
      true,
      { recomputeThreads: false }
    );

    const topic = await createTopic(accountId, "Linon", "orange");
    await setThreadTopics(accountId, "thread-history", [topic.id]);

    const suggestionsByThreadId = await getTopicSuggestionsForThreads(
      accountId,
      ["thread-target-match", "thread-target-miss"],
      {
        accountEmail: "owner@example.com"
      }
    );

    expect(suggestionsByThreadId.get("thread-target-match")?.map((item) => item.name)).toEqual([
      "Linon"
    ]);
    expect(suggestionsByThreadId.get("thread-target-match")?.[0]?.suggestionScore).toBe(9);
    expect(suggestionsByThreadId.has("thread-target-miss")).toBe(false);
  });

  test("refreshes persisted thread signals when new messages add learning signals to an existing topic thread", async () => {
    const accountId = uniqueAccountId("acc-topic-suggestions-late-signal");
    const folder = buildFolder(accountId);
    const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);

    await upsertMessages(
      accountId,
      folder.id,
      [
        buildMessage({
          id: "msg-history-initial",
          accountId,
          folderId: folder.id,
          threadId: "thread-history",
          messageId: "<history-initial@example.com>",
          from: "Alerts <alerts@example.com>",
          fromEmail: "alerts@example.com",
          to: "owner@example.com",
          dateValue: Date.UTC(2026, 2, 18, 10, 15, 0)
        })
      ],
      true,
      { recomputeThreads: false }
    );

    const topic = await createTopic(accountId, "Unified-API", "violet");
    await setThreadTopics(accountId, "thread-history", [topic.id]);

    await upsertMessages(
      accountId,
      folder.id,
      [
        buildMessage({
          id: "msg-history-late-signal",
          accountId,
          folderId: folder.id,
          threadId: "thread-history",
          messageId: "<history-late@example.com>",
          subject: "Late signal message",
          from: "Alerts <alerts@example.com>",
          fromEmail: "alerts@example.com",
          to: "owner@example.com",
          listId: "lists.example.com/unified-api",
          dateValue: Date.UTC(2026, 2, 18, 10, 20, 0)
        }),
        buildMessage({
          id: "msg-target-late-signal",
          accountId,
          folderId: folder.id,
          threadId: "thread-target",
          messageId: "<target-late@example.com>",
          subject: "Target message",
          from: "Other Alerts <noreply@example.com>",
          fromEmail: "noreply@example.com",
          to: "owner@example.com",
          listId: "lists.example.com/unified-api",
          dateValue: Date.UTC(2026, 2, 18, 10, 25, 0)
        })
      ],
      false,
      { recomputeThreads: false }
    );

    const suggestions = await getTopicSuggestionsForThread(accountId, "thread-target", {
      accountEmail: "owner@example.com"
    });

    expect(suggestions.map((item) => item.name)).toEqual(["Unified-API"]);
    expect(suggestions[0]?.suggestionScore).toBe(5);
    expect(suggestions[0]?.matchCount).toBe(1);
  });

  test("keeps an excluded learning signal removed across rebuilds", async () => {
    const accountId = uniqueAccountId("acc-topic-suggestions-excluded-signal");
    const folder = buildFolder(accountId);
    const { recomputeThreadsForAccount, saveFoldersForAccount, upsertAccount, upsertMessages } =
      await dbModulePromise;

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);

    await upsertMessages(
      accountId,
      folder.id,
      [
        buildMessage({
          id: "msg-history",
          accountId,
          folderId: folder.id,
          threadId: "thread-history",
          messageId: "<history@example.com>",
          from: "GitLab <gitlab@mg.gitlab.com>",
          fromEmail: "gitlab@mg.gitlab.com",
          to: "owner@example.com",
          listId: "group/project-a <project-a.gitlab.example>",
          dateValue: Date.UTC(2026, 2, 18, 10, 25, 0)
        }),
        buildMessage({
          id: "msg-target",
          accountId,
          folderId: folder.id,
          threadId: "thread-target",
          messageId: "<target@example.com>",
          from: "GitLab <gitlab@mg.gitlab.com>",
          fromEmail: "gitlab@mg.gitlab.com",
          to: "owner@example.com",
          listId: "group/project-a <project-a.gitlab.example>",
          dateValue: Date.UTC(2026, 2, 18, 10, 30, 0)
        })
      ],
      true,
      { recomputeThreads: false }
    );

    const topic = await createTopic(accountId, "Project A", "blue");
    await setThreadTopics(accountId, "thread-history", [topic.id]);

    let suggestions = await getTopicSuggestionsForThread(accountId, "thread-target", {
      accountEmail: "owner@example.com"
    });
    expect(suggestions.map((item) => item.name)).toEqual(["Project A"]);
    expect(suggestions[0]?.suggestionScore).toBe(9);

    const removed = await excludeTopicLearningSignal(
      accountId,
      topic.id,
      "listId",
      "group/project-a <project-a.gitlab.example>"
    );
    expect(removed).toBe(true);

    let stats = await getTopicStats(accountId, {
      accountEmail: "owner@example.com"
    });
    expect(stats[0]?.topSignals.some((signal) =>
      signal.type === "listId" && signal.value === "group/project-a <project-a.gitlab.example>"
    )).toBe(false);

    suggestions = await getTopicSuggestionsForThread(accountId, "thread-target", {
      accountEmail: "owner@example.com"
    });
    expect(suggestions.map((item) => item.name)).toEqual(["Project A"]);
    expect(suggestions[0]?.suggestionScore).toBe(5);

    await recomputeThreadsForAccount(accountId, ["thread-history"]);

    stats = await getTopicStats(accountId, {
      accountEmail: "owner@example.com"
    });
    expect(stats[0]?.topSignals.some((signal) =>
      signal.type === "listId" && signal.value === "group/project-a <project-a.gitlab.example>"
    )).toBe(false);

    suggestions = await getTopicSuggestionsForThread(accountId, "thread-target", {
      accountEmail: "owner@example.com"
    });
    expect(suggestions[0]?.suggestionScore).toBe(5);
  });

  test("prunes orphaned thread-topic associations while retaining learned signals after the last message is deleted", async () => {
    const accountId = uniqueAccountId("acc-topic-orphan-prune");
    const folder = buildFolder(accountId);
    const { deleteMessageById, saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);

    await upsertMessages(
      accountId,
      folder.id,
      [
        buildMessage({
          id: "msg-history",
          accountId,
          folderId: folder.id,
          threadId: "thread-history",
          messageId: "<history-prune@example.com>",
          subject: "History message",
          from: "Alerts <alerts@example.com>",
          fromEmail: "alerts@example.com",
          to: "owner@example.com",
          dateValue: Date.UTC(2026, 2, 18, 10, 30, 0)
        })
      ],
      true,
      { recomputeThreads: false }
    );

    const topic = await createTopic(accountId, "Disposable", "red");
    await setThreadTopics(accountId, "thread-history", [topic.id]);

    await deleteMessageById(accountId, "msg-history");

    expect(await getTopicsForThread(accountId, "thread-history")).toEqual([]);
    const stats = await getTopicStats(accountId, {
      accountEmail: "owner@example.com"
    });
    expect(stats).toHaveLength(1);
    expect(stats[0]?.threadCount).toBe(1);
    expect(stats[0]?.messageCount).toBe(0);
    expect(stats[0]?.topSignals).toEqual(expect.arrayContaining([
      { type: "senderEmail", value: "alerts@example.com", count: 1 },
      { type: "senderDomain", value: "example.com", count: 1 }
    ]));

    const suggestions = await getTopicSuggestionsForMessage(accountId, {
      fromEmail: "alerts@example.com",
      to: "owner@example.com"
    }, {
      accountEmail: "owner@example.com"
    });
    expect(suggestions.map((item) => item.name)).toEqual(["Disposable"]);
  });

  test("reports all learned signal types in topic stats", async () => {
    const accountId = uniqueAccountId("acc-topic-stats-all-signals");
    const folder = buildFolder(accountId);
    const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);

    await upsertMessages(
      accountId,
      folder.id,
      [
        buildMessage({
          id: "msg-history-list",
          accountId,
          folderId: folder.id,
          threadId: "thread-history-list",
          messageId: "<history-list@example.com>",
          subject: "Unified API update",
          from: "Alerts <alerts@example.com>",
          fromEmail: "alerts@example.com",
          to: "Platform Team <team@example.com>",
          listId: "lists.example.com/unified-api",
          dateValue: Date.UTC(2026, 2, 18, 11, 0, 0)
        }),
        buildMessage({
          id: "msg-history-list-2",
          accountId,
          folderId: folder.id,
          threadId: "thread-history-list",
          messageId: "<history-list-2@example.com>",
          subject: "Re: Unified API update",
          from: "Alerts <alerts@example.com>",
          fromEmail: "alerts@example.com",
          to: "Platform Team <team@example.com>",
          listId: "lists.example.com/unified-api",
          dateValue: Date.UTC(2026, 2, 18, 11, 2, 0)
        }),
        buildMessage({
          id: "msg-history-jira",
          accountId,
          folderId: folder.id,
          threadId: "thread-history-jira",
          messageId: "<JIRA.300.1773827850000@Atlassian.JIRA>",
          subject: "[subshell Support] (UNSAPIX-24) Bug report",
          from: "Support System <noreply@subshell.com>",
          fromEmail: "noreply@subshell.com",
          to: "owner@example.com",
          dateValue: Date.UTC(2026, 2, 18, 11, 5, 0)
        })
      ],
      true,
      { recomputeThreads: false }
    );

    const topic = await createTopic(accountId, "Support", "blue");
    await setThreadTopics(accountId, "thread-history-list", [topic.id]);
    await setThreadTopics(accountId, "thread-history-jira", [topic.id]);

    const stats = await getTopicStats(accountId, {
      accountEmail: "owner@example.com"
    });

    expect(stats).toHaveLength(1);
    expect(stats[0]?.threadCount).toBe(2);
    expect(stats[0]?.messageCount).toBe(3);
    expect(stats[0]?.topSignals).toEqual(expect.arrayContaining([
      { type: "senderEmail", value: "alerts@example.com", count: 1 },
      { type: "senderEmail", value: "noreply@subshell.com", count: 1 },
      { type: "senderDomain", value: "example.com", count: 1 },
      { type: "senderDomain", value: "subshell.com", count: 1 },
      { type: "recipient", value: "team@example.com", count: 1 },
      { type: "listId", value: "lists.example.com/unified-api", count: 1 },
      { type: "jiraProjectKey", value: "UNSAPIX", count: 1 }
    ]));
    expect(stats[0]?.topSignals.some((signal) => signal.type === "recipient" && signal.value === "owner@example.com")).toBe(false);
  });

  test("returns only Inbox threads without topics for the active topic, ordered by score then recency", async () => {
    const accountId = uniqueAccountId("acc-topic-message-suggestions");
    const inboxFolder = buildFolder(accountId);
    const archiveFolder = buildArchiveFolder(accountId);
    const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [inboxFolder, archiveFolder]);

    // The suggestion cutoff is measured from the real clock, so a fixed anchor would age out of the window.
    const now = Date.now();
    const oldDate = now - 181 * 24 * 60 * 60 * 1000;

    await upsertMessages(
      accountId,
      inboxFolder.id,
      [
        buildMessage({
          id: "msg-history-active-1",
          accountId,
          folderId: inboxFolder.id,
          threadId: "thread-history-active-1",
          messageId: "<history-active-1@example.com>",
          subject: "BUILD-101 Main build failed",
          from: "CI Bot <ci@example.com>",
          fromEmail: "ci@example.com",
          to: "Build Team <build-team@example.com>",
          listId: "lists.example.com/build-alerts",
          dateValue: now - 10_000
        }),
        buildMessage({
          id: "msg-history-active-2",
          accountId,
          folderId: inboxFolder.id,
          threadId: "thread-history-active-2",
          messageId: "<history-active-2@example.com>",
          subject: "BUILD-102 Another build failed",
          from: "CI Bot <ci@example.com>",
          fromEmail: "ci@example.com",
          to: "Build Team <build-team@example.com>",
          listId: "lists.example.com/build-alerts",
          dateValue: now - 9_000
        }),
        buildMessage({
          id: "msg-history-other",
          accountId,
          folderId: inboxFolder.id,
          threadId: "thread-history-other",
          messageId: "<history-other@example.com>",
          subject: "Billing receipt",
          from: "Billing <billing@example.com>",
          fromEmail: "billing@example.com",
          to: "Finance <finance@example.com>",
          dateValue: now - 8_000
        }),
        buildMessage({
          id: "msg-candidate-strong",
          accountId,
          folderId: inboxFolder.id,
          threadId: "thread-candidate-strong",
          messageId: "<candidate-strong@example.com>",
          subject: "BUILD-103 Main build failed",
          from: "CI Bot <ci@example.com>",
          fromEmail: "ci@example.com",
          to: "Build Team <build-team@example.com>",
          listId: "lists.example.com/build-alerts",
          dateValue: now - 7_000
        }),
        buildMessage({
          id: "msg-candidate-weak",
          accountId,
          folderId: inboxFolder.id,
          threadId: "thread-candidate-weak",
          messageId: "<candidate-weak@example.com>",
          subject: "Build status update",
          from: "CI Bot <ci@example.com>",
          fromEmail: "ci@example.com",
          to: "Other <other@example.com>",
          dateValue: now - 1_000
        }),
        buildMessage({
          id: "msg-candidate-old",
          accountId,
          folderId: inboxFolder.id,
          threadId: "thread-candidate-old",
          messageId: "<candidate-old@example.com>",
          subject: "BUILD-090 Old build failed",
          from: "CI Bot <ci@example.com>",
          fromEmail: "ci@example.com",
          to: "Build Team <build-team@example.com>",
          listId: "lists.example.com/build-alerts",
          dateValue: oldDate
        }),
        buildMessage({
          id: "msg-candidate-assigned",
          accountId,
          folderId: inboxFolder.id,
          threadId: "thread-candidate-assigned",
          messageId: "<candidate-assigned@example.com>",
          subject: "BUILD-104 Assigned already",
          from: "CI Bot <ci@example.com>",
          fromEmail: "ci@example.com",
          to: "Build Team <build-team@example.com>",
          listId: "lists.example.com/build-alerts",
          dateValue: now - 500
        }),
        buildMessage({
          id: "msg-candidate-archive",
          accountId,
          folderId: archiveFolder.id,
          threadId: "thread-candidate-archive",
          messageId: "<candidate-archive@example.com>",
          subject: "BUILD-105 Archived build failed",
          from: "CI Bot <ci@example.com>",
          fromEmail: "ci@example.com",
          to: "Build Team <build-team@example.com>",
          listId: "lists.example.com/build-alerts",
          dateValue: now - 250
        })
      ],
      true,
      { recomputeThreads: false }
    );

    const buildTopic = await createTopic(accountId, "Build Alerts", "blue");
    const billingTopic = await createTopic(accountId, "Billing", "green");
    await setThreadTopics(accountId, "thread-history-active-1", [buildTopic.id]);
    await setThreadTopics(accountId, "thread-history-active-2", [buildTopic.id]);
    await setThreadTopics(accountId, "thread-history-other", [billingTopic.id]);
    await setThreadTopics(accountId, "thread-candidate-assigned", [billingTopic.id]);

    const suggestions = await getTopicThreadSuggestions(accountId, buildTopic.id, {
      accountEmail: "owner@example.com",
      limit: 5,
      maxAgeDays: 180
    });

    expect(suggestions.map((item) => item.threadId)).toEqual([
      "thread-candidate-strong",
      "thread-candidate-weak"
    ]);
    expect(suggestions.map((item) => item.suggestionScore)).toEqual([11, 5]);
    expect(suggestions.every((item) => item.representativeMessageId?.startsWith("msg-candidate-"))).toBe(true);
  });

  test("batched thread suggestions match per-thread scores, exclusion, and name order", async () => {
    const accountId = uniqueAccountId("acc-topic-suggestions-batch-equiv");
    const folder = buildFolder(accountId);
    const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);

    await upsertMessages(
      accountId,
      folder.id,
      [
        buildMessage({
          id: "msg-hist-alpha",
          accountId,
          folderId: folder.id,
          threadId: "thread-hist-alpha",
          messageId: "<hist-alpha@example.com>",
          from: "Alpha Bot <alpha-bot@vendor.example>",
          fromEmail: "alpha-bot@vendor.example",
          to: "owner@example.com",
          dateValue: Date.UTC(2026, 2, 18, 12, 0, 0)
        }),
        buildMessage({
          id: "msg-hist-zulu",
          accountId,
          folderId: folder.id,
          threadId: "thread-hist-zulu",
          messageId: "<hist-zulu@example.com>",
          from: "Zulu Bot <zulu-bot@vendor.example>",
          fromEmail: "zulu-bot@vendor.example",
          to: "owner@example.com",
          dateValue: Date.UTC(2026, 2, 18, 12, 1, 0)
        }),
        buildMessage({
          id: "msg-hist-mid",
          accountId,
          folderId: folder.id,
          threadId: "thread-hist-mid",
          messageId: "<hist-mid@example.com>",
          from: "Alerts <alerts@vendor.example>",
          fromEmail: "alerts@vendor.example",
          to: "owner@example.com",
          listId: "lists.vendor.example/alerts",
          dateValue: Date.UTC(2026, 2, 18, 12, 2, 0)
        }),
        buildMessage({
          id: "msg-target-ranked",
          accountId,
          folderId: folder.id,
          threadId: "thread-target-ranked",
          messageId: "<target-ranked@example.com>",
          from: "Alerts <alerts@vendor.example>",
          fromEmail: "alerts@vendor.example",
          to: "owner@example.com",
          listId: "lists.vendor.example/alerts",
          dateValue: Date.UTC(2026, 2, 18, 12, 3, 0)
        }),
        buildMessage({
          id: "msg-target-self",
          accountId,
          folderId: folder.id,
          threadId: "thread-target-self",
          messageId: "<target-self@example.com>",
          from: "Only Self <only-self@isolated.example>",
          fromEmail: "only-self@isolated.example",
          to: "owner@example.com",
          dateValue: Date.UTC(2026, 2, 18, 12, 4, 0)
        }),
        buildMessage({
          id: "msg-target-miss",
          accountId,
          folderId: folder.id,
          threadId: "thread-target-miss",
          messageId: "<target-miss@example.com>",
          from: "Newsletter <news@other.example>",
          fromEmail: "news@other.example",
          to: "owner@example.com",
          dateValue: Date.UTC(2026, 2, 18, 12, 5, 0)
        })
      ],
      true,
      { recomputeThreads: false }
    );

    const alpha = await createTopic(accountId, "Alpha", "blue");
    const zulu = await createTopic(accountId, "Zulu", "red");
    const mid = await createTopic(accountId, "Mid", "green");
    const isolated = await createTopic(accountId, "Isolated", "orange");
    await setThreadTopics(accountId, "thread-hist-alpha", [alpha.id]);
    await setThreadTopics(accountId, "thread-hist-zulu", [zulu.id]);
    await setThreadTopics(accountId, "thread-hist-mid", [mid.id]);
    await setThreadTopics(accountId, "thread-target-ranked", [alpha.id]);
    await setThreadTopics(accountId, "thread-target-self", [isolated.id]);

    const threadIds = [
      "thread-target-ranked",
      "  thread-target-ranked  ",
      "thread-target-self",
      "thread-target-miss",
      ""
    ];
    const batched = await getTopicSuggestionsForThreads(accountId, threadIds, {
      accountEmail: "owner@example.com"
    });

    const ranked = batched.get("thread-target-ranked") ?? [];
    expect(ranked.map((item) => item.name)).toEqual(["Mid", "Alpha", "Zulu"]);
    expect(ranked.map((item) => item.suggestionScore)).toEqual([9, 1, 1]);
    expect(ranked.map((item) => item.matchCount)).toEqual([1, 1, 1]);
    expect(batched.has("thread-target-self")).toBe(false);
    expect(batched.has("thread-target-miss")).toBe(false);
    expect(batched.size).toBe(1);

    for (const threadId of ["thread-target-ranked", "thread-target-self", "thread-target-miss"]) {
      const single = await getTopicSuggestionsForThread(accountId, threadId, {
        accountEmail: "owner@example.com"
      });
      expect(batched.get(threadId) ?? []).toEqual(single);
    }
  });

  test("batched thread suggestions stay equivalent when signal pairs exceed one SQL chunk", async () => {
    const accountId = uniqueAccountId("acc-topic-suggestions-batch-chunk");
    const folder = buildFolder(accountId);
    const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);

    const recipientCount = 410;
    const recipients = Array.from(
      { length: recipientCount },
      (_, index) => `user${index}@chunk.example`
    ).join(", ");
    const lateRecipient = "user400@chunk.example";

    await upsertMessages(
      accountId,
      folder.id,
      [
        buildMessage({
          id: "msg-hist-chunk",
          accountId,
          folderId: folder.id,
          threadId: "thread-hist-chunk",
          messageId: "<hist-chunk@example.com>",
          from: "Chunk Bot <chunk-bot@vendor.example>",
          fromEmail: "chunk-bot@vendor.example",
          to: recipients,
          dateValue: Date.UTC(2026, 2, 18, 13, 0, 0)
        }),
        buildMessage({
          id: "msg-target-chunk",
          accountId,
          folderId: folder.id,
          threadId: "thread-target-chunk",
          messageId: "<target-chunk@example.com>",
          from: "Chunk Bot <chunk-bot@vendor.example>",
          fromEmail: "chunk-bot@vendor.example",
          to: recipients,
          dateValue: Date.UTC(2026, 2, 18, 13, 1, 0)
        }),
        buildMessage({
          id: "msg-target-late",
          accountId,
          folderId: folder.id,
          threadId: "thread-target-late",
          messageId: "<target-late-chunk@example.com>",
          from: "Other <other-late@elsewhere.example>",
          fromEmail: "other-late@elsewhere.example",
          to: lateRecipient,
          dateValue: Date.UTC(2026, 2, 18, 13, 2, 0)
        })
      ],
      true,
      { recomputeThreads: false }
    );

    const topic = await createTopic(accountId, "Chunked", "violet");
    await setThreadTopics(accountId, "thread-hist-chunk", [topic.id]);

    const batched = await getTopicSuggestionsForThreads(
      accountId,
      ["thread-target-chunk", "thread-target-late"],
      { accountEmail: "owner@example.com" }
    );

    for (const threadId of ["thread-target-chunk", "thread-target-late"]) {
      const single = await getTopicSuggestionsForThread(accountId, threadId, {
        accountEmail: "owner@example.com"
      });
      expect(batched.get(threadId) ?? []).toEqual(single);
    }

    const full = batched.get("thread-target-chunk") ?? [];
    expect(full.map((item) => item.name)).toEqual(["Chunked"]);
    expect(full[0]?.matchCount).toBe(1);
    expect(full[0]?.suggestionScore).toBe(4 + 1 + recipientCount * 2);

    const late = batched.get("thread-target-late") ?? [];
    expect(late.map((item) => item.name)).toEqual(["Chunked"]);
    expect(late[0]?.suggestionScore).toBe(2);
    expect(late[0]?.matchCount).toBe(1);
  });

  test("batched suggestions without topics in the mailbox skip the thread-signal read", async () => {
    const accountId = uniqueAccountId("acc-topic-suggestions-no-topics");
    const folder = buildFolder(accountId);
    const { saveFoldersForAccount, upsertAccount, upsertMessages, withAccountDb } = await dbModulePromise;

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);
    await upsertMessages(
      accountId,
      folder.id,
      [
        buildMessage({
          id: "msg-no-topics",
          accountId,
          folderId: folder.id,
          threadId: "thread-no-topics",
          messageId: "<no-topics@example.com>",
          from: "Vendor <vendor@vendor.example>",
          fromEmail: "vendor@vendor.example",
          to: "owner@example.com",
          dateValue: Date.UTC(2026, 2, 18, 14, 0, 0)
        }),
        buildMessage({
          id: "msg-vendor-history",
          accountId,
          folderId: folder.id,
          threadId: "thread-vendor-history",
          messageId: "<vendor-history@example.com>",
          from: "Vendor <vendor@vendor.example>",
          fromEmail: "vendor@vendor.example",
          to: "owner@example.com",
          dateValue: Date.UTC(2026, 2, 18, 13, 0, 0)
        })
      ],
      true,
      { recomputeThreads: false }
    );

    const statements: string[] = [];
    const empty = await withAccountDb(accountId, async (db) => {
      const prepare = db.prepare;
      db.prepare = ((sql: string) => {
        statements.push(sql);
        return prepare.call(db, sql);
      }) as typeof db.prepare;
      try {
        return await getTopicSuggestionsForThreads(accountId, ["thread-no-topics"], {
          accountEmail: "owner@example.com"
        });
      } finally {
        db.prepare = prepare;
      }
    });
    expect(empty.size).toBe(0);
    expect(statements.some((sql) => sql.includes("thread_signals"))).toBe(false);

    // Nothing is remembered across calls: a topic created afterwards is used by the next call.
    const topic = await createTopic(accountId, "Vendor", "blue");
    await setThreadTopics(accountId, "thread-vendor-history", [topic.id]);
    const next = await getTopicSuggestionsForThreads(accountId, ["thread-no-topics"], {
      accountEmail: "owner@example.com"
    });
    expect((next.get("thread-no-topics") ?? []).map((item) => item.name)).toEqual(["Vendor"]);
  });

  test("batched suggestions for threads with identical signals match per-thread results", async () => {
    const accountId = uniqueAccountId("acc-topic-suggestions-shared-signals");
    const folder = buildFolder(accountId);
    const { saveFoldersForAccount, upsertAccount, upsertMessages } = await dbModulePromise;

    await upsertAccount(buildAccount(accountId));
    await saveFoldersForAccount(accountId, [folder]);
    const fromVendor = (id: string, threadId: string, minute: number, from = "Vendor <vendor@vendor.example>") =>
      buildMessage({
        id,
        accountId,
        folderId: folder.id,
        threadId,
        messageId: `<${id}@example.com>`,
        from,
        fromEmail: from.replace(/^.*<|>$/g, ""),
        to: "owner@example.com, alias@example.com",
        dateValue: Date.UTC(2026, 2, 18, 15, minute, 0)
      });
    await upsertMessages(
      accountId,
      folder.id,
      [
        fromVendor("msg-shared-history", "thread-shared-history", 0),
        fromVendor("msg-shared-learning", "thread-shared-learning", 1),
        fromVendor("msg-shared-a", "thread-shared-a", 2),
        fromVendor("msg-shared-b", "thread-shared-b", 3),
        fromVendor("msg-shared-alias", "thread-shared-alias", 4, "Me <alias@example.com>"),
        fromVendor("msg-shared-free", "thread-shared-free", 5, "Someone <someone@gmail.com>")
      ],
      true,
      { recomputeThreads: false }
    );
    const vendor = await createTopic(accountId, "Vendor", "blue");
    const other = await createTopic(accountId, "Other", "red");
    await setThreadTopics(accountId, "thread-shared-history", [vendor.id]);
    // A learning thread on the page: its own history must stay excluded from its score.
    await setThreadTopics(accountId, "thread-shared-learning", [other.id]);

    const threadIds = [
      "thread-shared-a",
      "thread-shared-learning",
      "thread-shared-b",
      "thread-shared-alias",
      "thread-shared-free"
    ];
    const accountEmail = ["owner@example.com", "alias@example.com"];
    const batched = await getTopicSuggestionsForThreads(accountId, threadIds, { accountEmail });
    for (const threadId of threadIds) {
      const single = await getTopicSuggestionsForThread(accountId, threadId, { accountEmail });
      expect(batched.get(threadId) ?? []).toEqual(single);
    }
    expect((batched.get("thread-shared-a") ?? []).map((item) => item.name)).toEqual(["Other", "Vendor"]);
    expect((batched.get("thread-shared-learning") ?? []).map((item) => item.name)).toEqual(["Vendor"]);
    expect(batched.get("thread-shared-b")).not.toBe(batched.get("thread-shared-a"));
    expect(batched.get("thread-shared-b")?.[0]).not.toBe(batched.get("thread-shared-a")?.[0]);
  });
});
