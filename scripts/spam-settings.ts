/**
 * Shows and sets a mailbox's spam threshold (doc/SPAM-DETECTION.md), the same
 * setting as Postfacheinstellungen → Spam-Erkennung → Schwelle.
 *
 *   bun scripts/spam-settings.ts --data /path/to/noctua-data --mailbox kontakt@example.test
 *   bun scripts/spam-settings.ts --data /path/to/noctua-data --mailbox kontakt@example.test --threshold 0.8 --write --actor admin@example.test
 *
 * Without --write nothing is written: the script prints the global setting
 * (stored and effective), the mailbox's stored setting and its effective
 * threshold, and with --threshold the planned change. --write stores the
 * threshold through the admin UI's helper (lib/mail/spam/settings.ts), keeps
 * the mailbox's other settings (on/off, auto-move) and records the given admin
 * (--actor, an existing user with the admin role) as the one who changed it.
 * `--threshold default` removes the mailbox's own threshold. It needs an
 * explicit --data; the NOCTUA_DATA_DIR of the environment is never used.
 */
import path from "node:path";
import { isValidThreshold, resolveMailboxThreshold, type SpamMailboxSettings } from "../lib/mail/spam/config";

function arg(name: string) {
  const index = process.argv.indexOf(`--${name}`);
  const value = index > 0 ? process.argv[index + 1] : undefined;
  return value && !value.startsWith("--") ? value : undefined;
}

const data = arg("data");
const mailbox = arg("mailbox")?.trim().toLowerCase();
if (!data) throw new Error("Pass --data <data dir> (the environment's NOCTUA_DATA_DIR is never used)");
if (!mailbox) throw new Error("Pass --mailbox <email address of the mailbox>");
const write = process.argv.includes("--write");
const thresholdArg = arg("threshold");
const clear = thresholdArg === "default";
const threshold = thresholdArg && !clear ? Number(thresholdArg.replace(",", ".")) : undefined;
if (thresholdArg && !clear && !isValidThreshold(threshold)) throw new Error("--threshold must be a number from 0.5 to 1, or default");
if (write && !thresholdArg) throw new Error("--write needs --threshold <0.5–1 | default>");
const actorEmail = arg("actor")?.trim().toLowerCase();
if (write && !actorEmail) throw new Error("--write needs --actor <email of an admin user>");

// The app's DB layer reads NOCTUA_DATA_DIR; the explicit --data wins over the environment.
process.env.NOCTUA_DATA_DIR = path.resolve(data);
const { getDb } = await import("../lib/db/connection");
const { loadMailboxSpamSettings, loadSpamAdminSettings, loadSpamConfig, saveMailboxSpamSettings } = await import("../lib/mail/spam/settings");
const db = await getDb();
const account = db.prepare("SELECT id, email FROM accounts WHERE email = ? COLLATE NOCASE").get(mailbox) as { id: string; email: string } | null;
if (!account) throw new Error(`No mailbox ${mailbox} in ${process.env.NOCTUA_DATA_DIR}`);

const config = await loadSpamConfig();
const admin = await loadSpamAdminSettings();
const describe = (settings: SpamMailboxSettings) => `${JSON.stringify(settings)} → effective threshold ${resolveMailboxThreshold(config, settings)}`
  + `${settings.threshold === undefined ? " (global)" : " (own)"}, detection ${settings.enabled === false ? "off" : "on"}, auto-move ${settings.autoMove ? "on" : "off"}`;
const current = await loadMailboxSpamSettings(account.id);
console.log(`Global: stored ${JSON.stringify(admin)} → effective threshold ${config.threshold}, detection ${config.enabled ? "on" : "off"}`);
console.log(`Mailbox ${account.email} (${account.id}): ${describe(current)}`);

if (thresholdArg) {
  const { threshold: _previous, ...rest } = current;
  const next: SpamMailboxSettings = clear ? rest : { ...rest, threshold };
  if (!write) {
    console.log(`Planned: ${describe(next)}. Nothing written; add --write --actor <admin email> to store it.`);
  } else {
    const actor = db.prepare("SELECT id, role FROM users WHERE email = ? COLLATE NOCASE").get(actorEmail!) as { id: string; role: string } | null;
    if (actor?.role !== "admin") throw new Error(`--actor ${actorEmail} is not an admin user`);
    await saveMailboxSpamSettings(account.id, next, actor.id);
    console.log(`Written: ${describe(await loadMailboxSpamSettings(account.id))} (previous threshold: ${current.threshold ?? "default"})`);
  }
}
