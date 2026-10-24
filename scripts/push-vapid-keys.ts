/**
 * Prints a fresh VAPID key pair for Web Push (doc/PUSH-NOTIFICATIONS.md).
 * Writes nothing: copy the lines into the deployment's environment.
 *
 *   bun scripts/push-vapid-keys.ts [mailto:admin@example.test]
 */
import webpush from "web-push";
import { isValidVapidSubject } from "../lib/push/server";

const subject = process.argv[2] ?? "mailto:admin@example.test";
if (!isValidVapidSubject(subject)) {
  console.error("The subject must be a mailto: address or an https: URL.");
  process.exit(1);
}
const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log(`NOCTUA_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`NOCTUA_VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`NOCTUA_VAPID_SUBJECT=${subject}`);
