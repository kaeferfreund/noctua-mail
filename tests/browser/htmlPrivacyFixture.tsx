import { createRoot } from "react-dom/client";
import I18nProvider from "../../app/components/i18n/I18nProvider";
import { getMessages } from "../../lib/i18n/translator";
import HtmlMessage from "../../app/components/HtmlMessage";

// Test-only entrypoint bundled by htmlPrivacy.test.ts; no application route.
const props = await (await fetch(`/fixture.json${window.location.search}`)).json();
createRoot(document.getElementById("root")!).render(<I18nProvider locale="en" messages={getMessages("en")} uiLocale={null} deviceLocale={null}><HtmlMessage {...props} darkMode={false} /></I18nProvider>);
