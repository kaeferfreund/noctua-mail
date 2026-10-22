import { createRoot } from "react-dom/client";
import HtmlMessage from "../../app/components/HtmlMessage";

// Test-only entrypoint bundled by htmlPrivacy.test.ts; no application route.
const html = await (await fetch("/fixture.html")).text();
createRoot(document.getElementById("root")!).render(<HtmlMessage html={html} darkMode={false} />);
