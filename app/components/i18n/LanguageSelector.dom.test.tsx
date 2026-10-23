import { afterEach, beforeEach, expect, spyOn, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import LocaleSessionSync from "./LocaleSessionSync";
import { publishLocalePreference } from "@/lib/i18n/localeEvents";
import LanguageSelector from "./LanguageSelector";
import LoginScreen from "@/app/components/auth/LoginScreen";
import { clientFixture } from "@/app/components/auth/authTestHelpers";

const dom = window as unknown as { happyDOM: { setURL: (url: string) => void } };
const originalUrl = window.location.href;
beforeEach(() => { dom.happyDOM.setURL("http://localhost:3830/"); });
afterEach(() => { cleanup(); document.cookie = "noctua-ui-locale=; Path=/; Max-Age=0"; dom.happyDOM.setURL(originalUrl); });

test("anonymous selector translates its own labels and updates/removes the validated device cookie", async () => {
  let refreshes = 0;
  const page = render(<I18nTestProvider locale="de" deviceLocale="de" refresh={() => { refreshes++; }}><LanguageSelector /></I18nTestProvider>);
  const selector = page.getByRole("combobox", { name: "Sprache" }) as HTMLSelectElement;
  expect(selector.value).toBe("de");
  expect(page.getByRole("option", { name: "Automatisch" })).toBeTruthy();
  fireEvent.change(selector, { target: { value: "en" } });
  await waitFor(() => expect(refreshes).toBe(1));
  expect(document.cookie).toContain("noctua-ui-locale=en");
  fireEvent.change(selector, { target: { value: "automatic" } });
  await waitFor(() => expect(refreshes).toBe(2));
  expect(document.cookie).not.toContain("noctua-ui-locale=");
});

test("signed-in selector loads the user value, writes only uiLocale and refreshes on success", async () => {
  const writes: RequestInit[] = [];
  const network = spyOn(globalThis, "fetch").mockImplementation(Object.assign(async (_input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "PUT") { writes.push(init); return Response.json({ ok: true, uiLocale: "de" }); }
    return Response.json({ ok: true, user: { uiLocale: "en" } });
  }, { preconnect: globalThis.fetch.preconnect }));
  let refreshes = 0;
  try {
    const page = render(<I18nTestProvider refresh={() => { refreshes++; }}><LanguageSelector authenticated /></I18nTestProvider>);
    const selector = page.getByRole("combobox", { name: "Language" }) as HTMLSelectElement;
    await waitFor(() => expect(selector.value).toBe("en"));
    fireEvent.change(selector, { target: { value: "de" } });
    await waitFor(() => expect(refreshes).toBe(1));
    expect(writes).toHaveLength(1);
    expect(writes[0].body).toBe('{"uiLocale":"de"}');
    expect(writes[0].headers).toEqual({ "Content-Type": "application/json" });
    expect(document.cookie).toContain("noctua-ui-locale=de");
  } finally { network.mockRestore(); }
});

test("failed persistence leaves the language, device cookie and shell unchanged", async () => {
  const network = spyOn(globalThis, "fetch").mockImplementation(Object.assign(async (_input: RequestInfo | URL, init?: RequestInit) =>
    init?.method === "PUT" ? Response.json({ ok: false }, { status: 403 }) : Response.json({ user: { uiLocale: "en" } }), { preconnect: globalThis.fetch.preconnect }));
  let refreshes = 0;
  try {
    document.cookie = "noctua-ui-locale=en; Path=/";
    const page = render(<I18nTestProvider uiLocale="en" refresh={() => { refreshes++; }}><LanguageSelector authenticated /></I18nTestProvider>);
    const selector = page.getByRole("combobox", { name: "Language" }) as HTMLSelectElement;
    await waitFor(() => expect(selector.disabled).toBe(false));
    fireEvent.change(selector, { target: { value: "de" } });
    await page.findByRole("alert");
    expect(selector.value).toBe("en");
    expect(document.cookie).toContain("noctua-ui-locale=en");
    expect(refreshes).toBe(0);
  } finally { network.mockRestore(); }
});

test("merging refreshed locale props preserves invite form fields and its DOM identity", async () => {
  const { client } = clientFixture(() => Response.json({ methods: { imap: false } }));
  const done = () => {};
  const tree = (locale: "de" | "en") => <I18nTestProvider locale={locale}><LoginScreen client={client} onAuthenticated={done} /></I18nTestProvider>;
  const page = render(tree("en"));
  fireEvent.click(page.getByText("Sign up with an invite code"));
  const invite = page.getByLabelText("Invite code") as HTMLInputElement;
  fireEvent.change(invite, { target: { value: "synthetic-invite" } });
  fireEvent.change(page.getByLabelText("Email"), { target: { value: "synthetic@example.test" } });
  fireEvent.change(page.getByRole("combobox", { name: "Language" }), { target: { value: "de" } });
  page.rerender(tree("de"));
  expect(page.getByRole("combobox", { name: "Sprache" })).toBeTruthy();
  expect(page.getByLabelText("Invite code")).toBe(invite);
  expect(invite.value).toBe("synthetic-invite");
  expect((page.getByLabelText("Email") as HTMLInputElement).value).toBe("synthetic@example.test");
});

test("identity changes refresh the locale after login/logout without remounting the shell", () => {
  let refreshes = 0;
  const page = render(<I18nTestProvider refresh={() => { refreshes++; }}><LocaleSessionSync uiLocale={null} /><input aria-label="Synthetic draft" defaultValue="Unsent text" /></I18nTestProvider>);
  const draft = page.getByLabelText("Synthetic draft");
  publishLocalePreference(null);
  expect(refreshes).toBe(0);
  publishLocalePreference("de");
  expect(refreshes).toBe(1);
  expect(page.getByLabelText("Synthetic draft")).toBe(draft);
  page.unmount();
  publishLocalePreference("en");
  expect(refreshes).toBe(1);
});

test("a device selector does not offer an ineffective override of a signed-in fixed preference", () => {
  const page = render(<I18nTestProvider locale="de" uiLocale="de"><LanguageSelector /></I18nTestProvider>);
  expect(page.queryByRole("combobox")).toBeNull();
});
