    expect(refreshed?.id).toBe(variant.id);
    expect(refreshed?.senderKey).toBe("second@example.test");
    expect(await getMessageSource(account.id, base.id, { exact: true })).toBe(baseSource);
    expect(await getMessageSource(account.id, variant.id, { exact: true })).toBe(copySource);
    expect((await f.api.getMessageById(account.id, base.id))?.senderKey).toBeNull();
    const ownership = f.db.prepare("SELECT sourceSha256 FROM messages WHERE accountId = ? AND id = ?")
      .get(account.id, variant.id) as { sourceSha256: string };
    expect(ownership.sourceSha256).toBe(createHash("sha256").update(copySource).digest("hex"));
  } finally {
    await drainImapConnectionPool();
    await server.stop();
  }
});

realResyncTest(`special <tag> & "double" 'single' [x] (y) $z ^a* +b? {c} |d \\e`, async () => {
  expect(1 + 1).toBe(2);
});
realResyncTest(`special failing <b> & "q" 'a'`, async () => {
  expect(1 + 1).toBe(3);
});
