import { createRoot } from "react-dom/client";
import HtmlMessage from "../../app/components/HtmlMessage";

// Test-only entrypoint bundled by htmlPrivacy.test.ts; no application route.
const props = await (await fetch(`/fixture.json${window.location.search}`)).json();
createRoot(document.getElementById("root")!).render(<HtmlMessage {...props} darkMode={false} />);
