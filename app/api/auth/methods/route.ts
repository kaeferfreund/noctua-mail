import {imapLoginAvailable} from "@/lib/imapLoginPolicy";
/** Public method availability; never expose the operator's host allowlist. */
export function GET() {
  return Response.json({ok:true,methods:{password:true,passkey:true,imap:imapLoginAvailable()}},{headers:{"cache-control":"no-store"}});
}
