import type { Database } from "bun:sqlite";

/** Type the projection locally while using the repository's Bun SQLite declaration. */
export function rows<T>(db: Database, sql: string): {
  get: (...params: Array<string | number | null>) => T | null;
  all: (...params: Array<string | number | null>) => T[];
} {
  return db.query(sql);
}
