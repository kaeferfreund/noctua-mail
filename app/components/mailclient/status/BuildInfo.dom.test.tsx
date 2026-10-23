import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import type { UiLocale } from "@/lib/i18n/config";
import type { BuildIdentity } from "@/lib/buildVersion";
import BuildInfo from "./BuildInfo";

const HASH = "0ac6cfa3d9e1b2c4f5a6b7c8d9e0f1a2b3c4d5e6";
const build = (builtAt: string | null): BuildIdentity => ({ hash: HASH, shortHash: "0ac6cfa", builtAt });

function renderIn(locale: UiLocale, info: BuildIdentity | null) {
  const wrapper = ({ children }: { children: ReactNode }) => <I18nTestProvider locale={locale}>{children}</I18nTestProvider>;
  return render(<BuildInfo info={info} className="synthetic-slot" />, { wrapper });
}

afterEach(cleanup);

describe("BuildInfo", () => {
  it("formats the build time in Europe/Berlin for German", () => {
    const { container } = renderIn("de", build("2026-10-23T13:16:05Z"));
    const label = container.querySelector("span.synthetic-slot");
    expect(label?.textContent).toBe("Build 0ac6cfa · 23.10.2026, 15:16");
    expect(label?.getAttribute("title")).toBe(`Commit ${HASH}, gebaut 2026-10-23T13:16:05Z`);
  });

  it("formats the build time in Europe/Berlin for English", () => {
    const { container } = renderIn("en", build("2026-10-23T13:16:05Z"));
    const label = container.querySelector("span.synthetic-slot");
    expect(label?.textContent).toBe("Build 0ac6cfa · 23/10/2026, 15:16");
    expect(label?.getAttribute("title")).toBe(`Commit ${HASH}, built 2026-10-23T13:16:05Z`);
  });

  it("follows the DST change at the end of October", () => {
    // 2026-10-25 01:00 UTC: Berlin switches from CEST (UTC+2) to CET (UTC+1).
    expect(renderIn("de", build("2026-10-25T00:30:00Z")).container.textContent).toBe("Build 0ac6cfa · 25.10.2026, 02:30");
    cleanup();
    expect(renderIn("de", build("2026-10-25T01:30:00Z")).container.textContent).toBe("Build 0ac6cfa · 25.10.2026, 02:30");
    cleanup();
    expect(renderIn("en", build("2026-10-24T22:30:00Z")).container.textContent).toBe("Build 0ac6cfa · 25/10/2026, 00:30");
  });

  it("shows only the commit when the build time is unknown", () => {
    const { container } = renderIn("de", build(null));
    expect(container.textContent).toBe("Build 0ac6cfa");
    expect(container.querySelector("span")?.getAttribute("title")).toBe(`Commit ${HASH}`);
  });

  it("renders nothing without build data", () => {
    expect(renderIn("de", null).container.innerHTML).toBe("");
  });
});
