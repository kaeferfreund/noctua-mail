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
    constructor(path: string);
    exec(sql: string): void;
    close(): void;
    prepare(sql: string): {
      run: (...params: any[]) => void;
      get: (...params: any[]) => any;
      all: (...params: any[]) => any[];
    };
    query(sql: string): {
      run: (...params: any[]) => void;
      get: (...params: any[]) => any;
      all: (...params: any[]) => any[];
    };
    transaction<T>(fn: () => T): Transaction<T>;
  }
}
