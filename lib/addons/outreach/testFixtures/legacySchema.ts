import type { Database } from "bun:sqlite";

/** Remove the v6 objects from a synthetic fixture before exercising an older migration. */
export function removeHistorySchema(db: Database) {
  db.exec(`DROP TABLE klaviyo_erased_sends; DROP INDEX idx_events_klaviyo; DROP INDEX idx_events_account_send_type;
    DROP INDEX idx_sends_step_contact;
    ALTER TABLE sends DROP COLUMN source;
    CREATE UNIQUE INDEX idx_sends_step_contact ON sends (sequenceStepId, contactId) WHERE sequenceStepId IS NOT NULL AND kind = 'sequence';
    PRAGMA user_version = 5;`);
}
