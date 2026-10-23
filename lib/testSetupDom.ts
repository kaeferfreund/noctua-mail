// Preloaded only for the DOM test run (`bun run test:dom`), never for the
// default suite. Registering happy-dom defines `window`/`document` globally,
// and server-side modules branch on `typeof window` at import time — pulling
// this into the main run flips those branches and breaks route tests. Hence
// the separate run and the `*.dom.test.tsx` ignore pattern in bunfig.toml.
import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";
import "./testSetupEnv";

// happy-dom 21 disables iframe page loading by default, and every mount of a
// frame without srcdoc (HtmlMessage before its effect assigns srcdoc) then logs
// a NotSupportedError for about:blank. Enable it, but keep child frames from
// navigating, so an iframe src never turns into a real network request
// (lib/testSetupDom.dom.test.tsx). srcdoc documents do not navigate.
GlobalRegistrator.register({
  url: "http://localhost:4000/",
  settings: { enableIframePageLoading: true, navigation: { disableChildFrameNavigation: true } }
});

// React 19 requires this flag before `act` will drive updates.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Keep every mount independent of URL state left by another DOM test.
afterEach(() => window.history.replaceState(null, "", "/"));
