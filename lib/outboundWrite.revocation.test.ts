// Permanent round-4 probes: actual HTTP membership revocation and file rollback.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { getAttachmentMessageDir, getSourcesAccountDir } from './runtimePaths';
import { withOutboundWrite } from './outboundWrite';
import { test, expect, spyOn } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createCollabFixture } from './testThreadCollabHarness';
import { createAuthenticatedTestSession } from './testAuthHarness';
import { getDb } from './db/connection';
import { authorizeOutbound, OutboundAuthorizationError } from './outboundAuthorization';
import { getMessageSource, getAttachmentData } from './storage';
import { SHARD_FTS_TABLE } from './db/shardFormat';
for (const kind of ['draft', 'series', 'occurrence'] as const) {
  test(`master wait + committed membership revoke: ${kind} returns 403 with zero effects`, async () => {
    const f = await createCollabFixture();
    const u = await createAuthenticatedTestSession(f.accountId), master = await getDb();
    const request = new Request('http://localhost:3834/synthetic', { headers: { cookie: u.jar.header() } });
    const old = f.message('<revoke-probe@example.test>', { id: 'synthetic-old', flags: ['\\Draft'], source: 'Synthetic retained source', attachments: [{ id: 'synthetic-att', filename: 'synthetic.txt', contentType: 'text/plain', inline: false, size: 3, dataUrl: 'data:text/plain;base64,b2xk' }] });
    await f.seed(old);
    const snapshot = () => JSON.stringify(['messages', 'attachments', SHARD_FTS_TABLE, 'calendar_events', 'calendar_participation_overrides'].map(t => f.db.prepare(`SELECT * FROM ${t} WHERE accountId=? ORDER BY rowid`).all(f.accountId)));
    const prior = snapshot();
    let preparations = 0, finalAssertions = 0, shardRollbacks = 0, failedMasterBegins = 0;
    const other = new Database(master.filename) as Database & { readonly inTransaction: boolean };
    other.exec('PRAGMA busy_timeout=0');
    other.exec('PRAGMA foreign_keys=ON');
    const masterExec = master.exec.bind(master), shardExec = f.db.exec.bind(f.db);
    const ms = spyOn(master, 'exec').mockImplementation((sql: string) => { try {
      return masterExec(sql);
    }
    catch (e) {
      if (sql === 'BEGIN IMMEDIATE') {
        failedMasterBegins++;
        // Revoke between the failed attempt and its next preparation. Scheduling
        // from the observed collision avoids racing slow staging with a timer.
        if (failedMasterBegins === 1) queueMicrotask(() => {
          expect(master.inTransaction || f.db.inTransaction).toBe(false);
          other.prepare('DELETE FROM user_accounts WHERE accountId=? AND userId=?').run(f.accountId, u.user.id);
          other.exec('COMMIT');
          committed = true;
        });
      }
      throw e;
    } });
    const ss = spyOn(f.db, 'exec').mockImplementation((sql: string) => { if (sql === 'ROLLBACK')
      shardRollbacks++; return shardExec(sql); });
    const beforeWrite = async () => { preparations++; const a = await authorizeOutbound({ request }, { accountId: f.accountId, minRole: 'editor' }); return { ...a, assertCurrent: (db: Database) => { finalAssertions++; a.assertCurrent(db); } }; };
    other.exec('BEGIN IMMEDIATE');
    let committed = false;
    let caught: unknown;
    const event = { id: 'synthetic-event', eventUid: 'synthetic-event', accountId: f.accountId, summary: 'Synthetic', startAtMs: 1800000000000, allDay: false, sourceType: 'email' as const, createdAtMs: 1, updatedAtMs: 1 };
    try {
      try {
        if (kind === 'draft')
          await f.api.upsertMessages(f.accountId, null, [{ ...old, id: 'synthetic-new', source: 'Synthetic new source' }], false, { beforeWrite, replaceDraftId: old.id });
        if (kind === 'series')
          await f.api.upsertCalendarEvent(f.accountId, event, beforeWrite);
        if (kind === 'occurrence')
          await f.api.upsertCalendarParticipationOverride(f.accountId, { eventUid: event.eventUid, occurrenceStartAtMs: event.startAtMs, partstat: 'ACCEPTED' }, beforeWrite);
      }
      catch (e) {
        caught = e;
      }
      expect(committed).toBe(true);
      expect(caught).toBeInstanceOf(OutboundAuthorizationError);
      if (!(caught instanceof OutboundAuthorizationError))
        throw caught;
      expect(caught.response.status).toBe(403);
      expect(preparations).toBeGreaterThanOrEqual(2);
      expect(finalAssertions).toBe(0);
      expect(failedMasterBegins).toBe(preparations - 1);
      expect(shardRollbacks).toBe(failedMasterBegins);
      expect(snapshot()).toBe(prior);
      expect(await getMessageSource(f.accountId, old.id)).toBe(old.source!);
      expect((await getAttachmentData(f.accountId, old.id, 'synthetic-att'))?.toString()).toBe('old');
      expect(master.inTransaction || f.db.inTransaction).toBe(false);
      console.info('OUTBOUND_REVOKE', kind, { preparations, finalAssertions, failedMasterBegins, shardRollbacks, status: caught.response.status });
    }
    finally {
      ms.mockRestore();
      ss.mockRestore();
      if (other.inTransaction)
        other.exec('ROLLBACK');
      other.close();
    }
  });
}
test('commit BUSY after file publication rolls SQL/files back before reauthorization denies the retry', async () => {
  const f = await createCollabFixture(), u = await createAuthenticatedTestSession(f.accountId), master = await getDb();
  const request = new Request('http://localhost:3834/synthetic', { headers: { cookie: u.jar.header() } });
  const old = f.message('<commit-probe@example.test>', { id: 'synthetic-commit-old', flags: ['\\Draft'], source: 'Synthetic old source', attachments: [{ id: 'synthetic-att', filename: 'synthetic.txt', contentType: 'text/plain', inline: false, size: 3, dataUrl: 'data:text/plain;base64,b2xk' }] });
  await f.seed(old);
  const snap = () => JSON.stringify(['messages', 'attachments', SHARD_FTS_TABLE].map(t => f.db.prepare(`SELECT * FROM ${t} WHERE accountId=? ORDER BY rowid`).all(f.accountId)));
  const prior = snap(), exec = f.db.exec.bind(f.db);
  const source = () => readFileSync(path.join(getSourcesAccountDir(f.accountId), `${encodeURIComponent(old.id)}.eml`), 'utf8');
  const attachment = () => readFileSync(path.join(getAttachmentMessageDir(f.accountId, old.id), 'synthetic-att.bin'), 'utf8');
  let failed = 0, preparations = 0;
  const retry = spyOn(console, 'warn');
  const spy = spyOn(f.db, 'exec').mockImplementation((sql: string) => {
    if (sql === 'COMMIT' && !failed++) {
      expect(master.inTransaction).toBe(true);
      expect(source()).toBe('Synthetic changed source');
      expect(attachment()).toBe('new');
      expect(snap()).not.toBe(prior);
      queueMicrotask(() => {
        expect(master.inTransaction || f.db.inTransaction).toBe(false);
        master.prepare('DELETE FROM user_accounts WHERE accountId=? AND userId=?').run(f.accountId, u.user.id);
      });
      throw Object.assign(new Error('Synthetic database is locked after publication'), { code: 'SQLITE_BUSY' });
    }
    return exec(sql);
  });
  const beforeWrite = async () => {
    preparations++;
    if (preparations === 2) {
      expect(snap()).toBe(prior);
      expect(source()).toBe(old.source!);
      expect(attachment()).toBe('old');
    }
    return authorizeOutbound({ request }, { accountId: f.accountId, minRole: 'editor' });
  };
  try {
    let error: unknown;
    try {
      await f.api.upsertMessages(f.accountId, null, [{ ...old, source: 'Synthetic changed source', attachments: [{ ...old.attachments![0], dataUrl: 'data:text/plain;base64,bmV3' }] }], false, { beforeWrite, replaceDraftId: old.id });
    }
    catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(OutboundAuthorizationError);
    if (!(error instanceof OutboundAuthorizationError))
      throw error;
    expect(error.response.status).toBe(403);
    expect(preparations).toBe(2);
    const logs = retry.mock.calls.filter(call => call[0] === '[db-write-retry] retry' && call[1].operation === 'upsertMessages');
    expect(logs).toHaveLength(1);
    expect(logs[0][1]).toMatchObject({ phase: 'write', policy: 'coarse' });
    expect(logs[0][1].delayMs).toBeGreaterThanOrEqual(96);
    expect(logs[0][1].delayMs).toBeLessThanOrEqual(144);
    expect(failed).toBe(1);
    expect(snap()).toBe(prior);
    expect(await getMessageSource(f.accountId, old.id)).toBe(old.source!);
    expect((await getAttachmentData(f.accountId, old.id, 'synthetic-att'))?.toString()).toBe('old');
    expect(master.inTransaction || f.db.inTransaction).toBe(false);
  }
  finally {
    spy.mockRestore();
    retry.mockRestore();
  }
});


test('a real membership revoke committed during read-only planning is rejected by the final assertion', async () => {
  const f = await createCollabFixture(), u = await createAuthenticatedTestSession(f.accountId), master = await getDb();
  const request = new Request('http://localhost:3834/synthetic', { headers: { cookie: u.jar.header() } });
  const other = new Database(master.filename) as Database & { readonly inTransaction: boolean };
  other.exec('PRAGMA busy_timeout=0');
  let assertions = 0, effects = 0;
  try {
    const actor = await authorizeOutbound({ request }, { accountId: f.accountId, minRole: 'editor' });
    const result = withOutboundWrite('synthetic planning revoke', async () => ({ ...actor, assertCurrent: db => {
      assertions++;
      actor.assertCurrent(db);
    } }), async write => write(f.db, () => { effects++; }, () => {
      expect(f.db.inTransaction).toBe(true);
      expect(master.inTransaction).toBe(false);
      other.exec('BEGIN IMMEDIATE');
      other.prepare('DELETE FROM user_accounts WHERE accountId=? AND userId=?').run(f.accountId, u.user.id);
      other.exec('COMMIT');
    }));
    const error = await result.catch(error => error);
    expect(error).toBeInstanceOf(OutboundAuthorizationError);
    expect(error.response.status).toBe(403);
    expect(assertions).toBe(1);
    expect(effects).toBe(0);
    expect(master.inTransaction || f.db.inTransaction).toBe(false);
  } finally {
    if (other.inTransaction) other.exec('ROLLBACK');
    other.close();
  }
});
