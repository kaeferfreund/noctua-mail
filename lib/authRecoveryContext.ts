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
const REDACTED="[REDACTED]";
// Reset links carry the capability in the page query (/reset-password?token=) or
// in the Better Auth callback path (/api/ba/reset-password/<token>). Invite codes,
// recovery links and MFA resets travel in request/response bodies, not URLs.
const CAPABILITY_SEGMENT="reset-password";
// Defence in depth for every logged URL, including Better Auth's other token routes.
const CAPABILITY_PARAM=/token|code|otp|secret|passw|invite|credential|signature|ticket|api[-_]?key|^(?:key|sig)$/;

// Byte-wise and tolerant of malformed escapes; repeated so double encoding cannot hide a name.
function decodeFully(value:string) {
  for (let i=0;i<8;i++) {
    const next=value.replace(/%([0-9a-f]{2})/gi,(_,hex:string)=>String.fromCharCode(parseInt(hex,16)));
    if (next===value) break;
    value=next;
  }
  return value;
}

// Path segments as a lenient router would see them: decoded, case-folded, with
// empty and dot segments, matrix suffixes (;…) and trailing dots/spaces removed.
function normalizedSegments(pathname:string) {
  const segments:string[]=[];
  for (const raw of decodeFully(pathname).toLowerCase().replace(/\\/g,"/").split(/[?#]/)[0].split("/")) {
    const segment=raw.split(";")[0].replace(/[.\s]+$/,"");
    if (raw.trim()==="..") segments.pop();
    else if (segment) segments.push(segment);
  }
  return segments;
}

function redactParams(url:URL,depth:number) {
  for (const [name,value] of [...url.searchParams]) {
    if (CAPABILITY_PARAM.test(decodeFully(name).toLowerCase())) url.searchParams.set(name,REDACTED);
    // Nested callback URLs; unparseable values cannot be followed by a client either.
    else if (depth>0 && /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(value) && URL.canParse(value,"http://localhost")) url.searchParams.set(name,redactUrl(value,depth-1));
  }
}

function redactUrl(value:string,depth:number) {
  const url=new URL(value,"http://localhost"),relative=value.startsWith("/") && !value.startsWith("//");
  url.username="";url.password="";url.hash="";
  const segments=normalizedSegments(url.pathname),index=segments.findIndex(segment=>segment.includes(CAPABILITY_SEGMENT));
  if (index>=0) {
    // Any spelling that can reach the reset page or callback: keep the route recognizable, drop the rest.
    url.pathname=[...segments.slice(0,index),CAPABILITY_SEGMENT].join("/")+(segments.length>index+1 || segments[index]!==CAPABILITY_SEGMENT?`/${REDACTED}`:"");
    url.search="";
    return relative?url.href.slice(url.origin.length):url.href;
  }
  // An encoded "?" or "#" smuggles a query into the path; keep only what precedes it.
  if (/[?#]/.test(decodeFully(url.pathname))) url.pathname=`${segments.join("/")}/${REDACTED}`;
  redactParams(url,depth);
  return relative?url.href.slice(url.origin.length):url.href;
}

/** Use in any request logging integration; never persist reset capabilities in logs. */
export function redactAuthUrl(value:string) {
  try { if (!URL.canParse(value)) return "[invalid-url]"; return redactUrl(value,2); } catch { return "[invalid-url]"; }
}
