import MailClient from "./components/MailClient";
import { getBuildInfo, getBuildVersionLabel } from "@/lib/buildVersion";

// The root layout reads cookies and headers, so this renders per request and
// reports the build of the running server.
export default function Home() {
  return <MailClient buildVersionLabel={getBuildVersionLabel()} buildInfo={getBuildInfo()} />;
}
