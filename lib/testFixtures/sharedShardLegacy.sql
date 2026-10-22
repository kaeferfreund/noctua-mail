-- Account shard tables at integration/stage 164a57e, before account keys.
CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      folderId TEXT NOT NULL,
      threadId TEXT NOT NULL,
      parentId TEXT,
      messageId TEXT,
      inReplyTo TEXT,
      "references" TEXT,
      xForwardedMessageId TEXT,
      xComposeFormat TEXT,
      quotedHtmlEdited INTEGER DEFAULT 0,
      subject TEXT NOT NULL,
      fromAddr TEXT NOT NULL,
      fromEmail TEXT,
      replyToAddr TEXT,
      toAddr TEXT NOT NULL,
      ccAddr TEXT,
      bccAddr TEXT,
      mailboxPath TEXT,
      imapUid INTEGER,
      pendingMoveSourceFolderId TEXT,
      pendingMoveSourceMailboxPath TEXT,
      pendingMoveSourceUid INTEGER,
      pendingMoveStartedAt INTEGER,
      preview TEXT NOT NULL,
      date TEXT NOT NULL,
      dateValue INTEGER NOT NULL,
      body TEXT NOT NULL,
      htmlBody TEXT,
      priority TEXT,
      hasSource INTEGER DEFAULT 0,
      unread INTEGER DEFAULT 0,
      flags TEXT,
      seen INTEGER DEFAULT 0,
      answered INTEGER DEFAULT 0,
      flagged INTEGER DEFAULT 0,
      deleted INTEGER DEFAULT 0,
      draft INTEGER DEFAULT 0,
      recent INTEGER DEFAULT 0,
      category TEXT,
      categoryScore REAL,
      categorySignals TEXT,
      categoryManualState TEXT,
      listId TEXT,
      sizeBytes INTEGER
    );

CREATE TABLE IF NOT EXISTS attachments (
      id TEXT PRIMARY KEY,
      messageId TEXT NOT NULL,
      filename TEXT NOT NULL,
      contentType TEXT NOT NULL,
      size INTEGER NOT NULL,
      inline INTEGER NOT NULL,
      cid TEXT,
      url TEXT,
      FOREIGN KEY(messageId) REFERENCES messages(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS message_translations (
      messageId TEXT NOT NULL,
      targetLang TEXT NOT NULL,
      format TEXT NOT NULL,
      marker TEXT,
      translatedText TEXT NOT NULL,
      detectedSourceLang TEXT,
      createdAt INTEGER NOT NULL,
      PRIMARY KEY (messageId, targetLang, format),
      FOREIGN KEY(messageId) REFERENCES messages(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS message_calendar_events (
      accountId TEXT NOT NULL,
      messageId TEXT NOT NULL,
      eventUid TEXT NOT NULL,
      eventUidKey TEXT,
      eventFirstStartAtMs INTEGER,
      eventLastEndAtMs INTEGER,
      inviteActionType TEXT,
      processedAtMs INTEGER,
      processedByUserId TEXT,
      processedAutomatically INTEGER,
      unprocessedReason TEXT,
      snapshotJson TEXT,
      snapshotVersion INTEGER,
      PRIMARY KEY (accountId, messageId, eventUid),
      FOREIGN KEY(messageId) REFERENCES messages(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS threads (
      threadId TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      rootMessageId TEXT,
      latestMessageId TEXT,
      latestDateValue INTEGER,
      latestReceivedDateValue INTEGER,
      messageCount INTEGER,
      unreadCount INTEGER
    );

CREATE TABLE IF NOT EXISTS thread_topics (
      threadId TEXT NOT NULL,
      topicId TEXT NOT NULL,
      accountId TEXT NOT NULL,
      assignedAt INTEGER NOT NULL,
      PRIMARY KEY (threadId, topicId)
    );

CREATE VIRTUAL TABLE message_fts USING fts5(messageId, subject, fromAddr, toAddr, ccAddr, bccAddr, body, preview);
