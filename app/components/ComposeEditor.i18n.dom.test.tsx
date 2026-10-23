// Runs only under `bun run test:dom`, which preloads happy-dom before Lexical
// and @uiw/react-md-editor are imported.
import { afterEach, describe, expect, it } from "bun:test";
import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { I18nTestProvider } from "@/lib/i18n/testRender";
import type { UiLocale } from "@/lib/i18n/config";
import ComposeEditor, { type QuotedMessageConfig } from "./ComposeEditor";
import ComposeMarkdownEditor from "./ComposeMarkdownEditor";

afterEach(() => cleanup());

const noop = () => {};

function quotedMessage(): QuotedMessageConfig {
  return {
    visible: true,
    html: "<p>Synthetic original</p>",
    quoteHtml: true,
    canToggleQuote: true,
    canStripImages: true,
    canRemoveMeta: true,
    darkMode: false,
    onEdit: noop,
    onRemove: noop,
    onToggleQuote: noop,
    onStripImages: noop,
    onRemoveMeta: noop
  };
}

function renderIn(locale: UiLocale, ui: React.ReactElement) {
  return render(<I18nTestProvider locale={locale}><Theme>{ui}</Theme></I18nTestProvider>);
}

describe("compose editors in German", () => {
  it("labels the Lexical toolbar, placeholder and quoted-message controls", async () => {
    const view = renderIn("de", <ComposeEditor resetKey={1} onChange={noop} quotedMessage={quotedMessage()} />);

    for (const label of ["Fett", "Kursiv", "Aufzählung", "Tabelle einfügen", "Zeile oberhalb einfügen", "HTML-Quelltext"]) {
      const button = view.getByRole("button", { name: label });
      expect(button.getAttribute("title")).toBe(label);
    }
    expect(view.getByText("Schreib deine Nachricht …")).toBeTruthy();

    await waitFor(() => expect(view.getByText("Zitierte Nachricht")).toBeTruthy());
    expect(view.getByRole("button", { name: "Zitat aufheben" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Details entfernen" })).toBeTruthy();
    expect(view.getByTitle("Zitierte Nachricht ausblenden")).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: "HTML-Quelltext" }));
    expect(view.getByRole("button", { name: "Visueller Editor" })).toBeTruthy();
  });

  it("localizes the Markdown editor commands and keeps their order and shortcuts", async () => {
    const view = renderIn("de", <ComposeMarkdownEditor value="" onChange={noop} />);

    const bold = await view.findByRole("button", { name: "Fett (Strg + b)" });
    expect(bold.getAttribute("title")).toBe("Fett (Strg + b)");
    expect(view.getByRole("button", { name: "Durchgestrichen (Strg + Umschalt + x)" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Codeblock einfügen (Strg + Umschalt + j)" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Tabelle einfügen" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Vollbild umschalten (Strg + 0)" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Editor und Vorschau (Strg + 8)" })).toBeTruthy();

    fireEvent.click(view.getByRole("button", { name: "Überschrift einfügen" }));
    const heading = await view.findByRole("button", { name: "Überschrift 2 einfügen (Strg + 2)" });
    expect(heading.textContent).toBe("Überschrift 2");
  });

  it("keeps the library's English Markdown command labels", async () => {
    const view = renderIn("en", <ComposeMarkdownEditor value="" onChange={noop} />);
    expect(await view.findByRole("button", { name: "Add bold text (ctrl + b)" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Add checked list (ctrl + shift + c)" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Insert title" })).toBeTruthy();
  });
});
