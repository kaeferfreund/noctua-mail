declare module "bun:sqlite" {
  /**
   * Returned by `Database#transaction`: calling it runs the function in a
   * deferred transaction; `immediate()` takes the write lock up front.
   */
  export type Transaction<T> = {
    (): T;
    deferred(): T;
    immediate(): T;
    exclusive(): T;
  };

  export class Database {
    /** A number is a set of SQLITE_OPEN_* flags (e.g. READONLY | URI for `file:…?immutable=1`). */
    constructor(path: string, options?: number | { create?: boolean; readwrite?: boolean; readonly?: boolean });
    exec(sql: string): void;
    close(): void;
    prepare(sql: string): {
      run: (...params: any[]) => { changes: number; lastInsertRowid: number | bigint };
      get: (...params: any[]) => any;
      all: (...params: any[]) => any[];
    };
    query(sql: string): {
      run: (...params: any[]) => { changes: number; lastInsertRowid: number | bigint };
      get: (...params: any[]) => any;
      all: (...params: any[]) => any[];
    };
    transaction<T>(fn: () => T): Transaction<T>;
  }
}
