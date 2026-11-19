const key = Symbol.for("noctua.outreachSendingProcess");
const host = globalThis as typeof globalThis & { [key]?: string };

export const leaseMaxMs = 10 * 60_000;
const processOwner = () => host[key] ??= `${process.pid}:${crypto.randomUUID()}`;
export const sendOwner = () => `${processOwner()}/${crypto.randomUUID()}`;

export function sendOwnerAlive(owner: string) {
  const processPart = owner.split("/", 1)[0];
  if (processPart === processOwner()) return true;
  const pid = Number(processPart.split(":", 1)[0]);
  if (!Number.isSafeInteger(pid) || pid <= 0 || pid === process.pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}
