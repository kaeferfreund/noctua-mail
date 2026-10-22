import { AsyncLocalStorage } from "node:async_hooks";
import { AuthPolicyError } from "./authPolicy";

type ResetDelivery = {userId:string;deliver:(url:string)=>void};
const deliveries=new AsyncLocalStorage<ResetDelivery>();
export const withResetDelivery=<T>(sink:ResetDelivery,run:()=>T):T=>deliveries.run(sink,run);
export function handOverResetLink(data:{user:{id:string};url:string}) {
  const sink=deliveries.getStore();
  if (!sink || sink.userId!==data.user.id) throw new AuthPolicyError("recovery_authority_required");
  sink.deliver(data.url);
}
export const hasResetDelivery=()=>!!deliveries.getStore();

export function resetCallback(baseURL:string) { return new URL("/reset-password",baseURL).href; }
/** Use in any request logging integration; never persist reset capabilities in logs. */
export function redactAuthUrl(value:string) {
  try {
    const url=new URL(value);
    if (url.pathname.startsWith("/api/ba/reset-password/") || url.pathname==="/reset-password") {
      if (url.pathname.startsWith("/api/ba/")) url.pathname="/api/ba/reset-password/[REDACTED]";
      url.search="";url.hash="";
    }
    return url.href;
  } catch { return "[invalid-url]"; }
}
