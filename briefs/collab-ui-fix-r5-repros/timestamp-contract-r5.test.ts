import { expect, it } from 'bun:test';
import { Database } from 'bun:sqlite';
import { ensureThreadCollabRuntimeSchema } from '@/lib/db/schema';
import * as store from '@/lib/db/threadCollab';

it('R5-storage: actual SQLite storage permits equal-millisecond commits and backwards timestamps', () => {
  const db = new Database(':memory:');
  const actor = { userId: 'synthetic-editor', clientId: 'web:synthetic-review' };
  const T = 1800000000000;
  try {
    ensureThreadCollabRuntimeSchema(db);
    const open = store.updateThreadCollabState(db, 'a', 'X', { status: 'waiting' }, actor, T);
    const closed = store.updateThreadCollabState(db, 'a', 'X', { status: 'closed' }, actor, T);
    expect(open.status).toBe('waiting');
    expect(closed.status).toBe('closed');
    expect(open.updatedAt).toBe(closed.updatedAt);
    const added = store.addThreadComment(db, 'a', 'X', 'Synthetic original', actor, T);
    const edited = store.editThreadComment(db, { ...added.comment }, 'Synthetic edited', actor, T);
    expect(added.comment.body).toBe('Synthetic original');
    expect(edited.comment.body).toBe('Synthetic edited');
    expect(added.comment.updatedAt).toBe(edited.comment.updatedAt);
    const deleted = store.deleteThreadComment(db, 'a', 'X', added.comment.id, actor, T);
    expect(deleted.deleted).toBe(true);
    expect(store.listThreadComments(db, 'a', 'X')).toEqual([]);
    expect(deleted.state.updatedAt).toBe(T);
    const backwards = store.updateThreadCollabState(db, 'a', 'X', { status: 'open' }, actor, T - 1000);
    expect(backwards.status).toBe('open');
    expect(store.getThreadCollabState(db, 'a', 'X').updatedAt).toBe(T - 1000);
    console.log('R5-storage', JSON.stringify({ open, closed, added, edited, deleted, backwards }));
  } finally { db.close(); }
});
