/**
 * Everything the server writes into the data directory (SQLite databases and
 * their WAL files, mail cache, add-on data) is private to the service user.
 * SQLite creates its files itself, so the process umask is the one place that
 * covers all of them. Workers started by this process inherit it.
 */
export function restrictNewFileModes() {
  const current = process.umask();
  process.umask(current | 0o077);
  return current;
}
