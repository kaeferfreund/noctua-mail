import MailClient from "./components/MailClient";
import { getRunningBuild } from "@/lib/buildVersionFile";
import { isAiReplyAvailable } from "@/lib/aiReply";

// The root layout reads cookies and headers, so this renders per request and
// reports the build of the running server (from its build artifact).
export default function Home() {
  const { label, info } = getRunningBuild();
  return <MailClient buildVersionLabel={label} buildInfo={info} aiReplyAvailable={isAiReplyAvailable()} />;
}
