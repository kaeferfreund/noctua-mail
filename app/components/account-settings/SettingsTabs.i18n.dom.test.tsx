import { afterEach, expect, test } from "bun:test";
import { cleanup } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { I18nTestProvider, render } from "@/lib/i18n/testRender";
import { getTranslator } from "@/lib/i18n/translator";
import AccountSettingsModal from "../AccountSettingsModal";
import type { Account } from "@/lib/data";
import { MOBILE_QUERY } from "@/app/hooks/use-mobile";

afterEach(cleanup);
const account: Account = {
  id: "synthetic", avatar: "", email: "user@example.test", name: "Synthetic mailbox", accessRole: "manager",
  imap: { host: "imap.example.test", port: 993, secure: true, user: "user@example.test", password: "" },
  smtp: { host: "smtp.example.test", port: 465, secure: true, user: "user@example.test", password: "" }
};
for (const locale of ["de", "en"] as const) for (const width of [320, 360, 390]) {
  test(`settings exposes complete wrapped tab labels at ${width}px in ${locale}`, () => {
    const original = window.matchMedia;
    const originalWidth = window.innerWidth;
    window.innerWidth = width;
    window.matchMedia = ((query: string) => ({ matches: query === MOBILE_QUERY, media: query,
      onchange: null, addListener() {}, removeListener() {}, dispatchEvent: () => true,
      addEventListener() {}, removeEventListener() {} })) as typeof window.matchMedia;
    try {
      const t = getTranslator(locale);
      const page = render(<I18nTestProvider locale={locale}><Theme><AccountSettingsModal
        editingAccount={account} isOpen manageTab="account" isExistingAccount
        onClose={() => {}} onTabChange={() => {}} onSave={() => {}} onDelete={() => {}}
      /></Theme></I18nTestProvider>);
      expect(page.getByRole("tablist").getAttribute("aria-orientation")).toBe("vertical");
      for (const key of ["preferences", "categorization"] as const) {
        const label = t(`Settings.tabs.${key}`);
        expect(page.getByRole("tab", { name: label }).textContent).toContain(label);
      }
    } finally { cleanup(); window.matchMedia = original; window.innerWidth = originalWidth; }
  });
}
