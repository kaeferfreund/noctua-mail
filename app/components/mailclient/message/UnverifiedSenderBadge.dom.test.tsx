import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { Theme } from "@radix-ui/themes";
import { I18nTestProvider, render as renderEnglish } from "@/lib/i18n/testRender";
import { reviewReaderProps, syntheticReviewMessage } from "@/tests/helpers/i18nSlice2b";
import ThreadMessageCard from "./ThreadMessageCard";
import UnverifiedSenderBadge from "./UnverifiedSenderBadge";

afterEach(cleanup);

const TITLE_DE = "Der Absender ist nicht bestätigt: Der empfangende Mailserver konnte weder SPF noch DKIM für die Absenderdomain bestätigen. Die Adresse könnte gefälscht sein.";

describe("UnverifiedSenderBadge", () => {
  it("renders only for senderVerified === false, with the explanation as title and label", () => {
    const page = render(<I18nTestProvider locale="de"><Theme>
      <UnverifiedSenderBadge message={{ senderVerified: false }} />
      <UnverifiedSenderBadge message={{ senderVerified: true }} />
      <UnverifiedSenderBadge message={{ senderVerified: null }} />
      <UnverifiedSenderBadge message={{}} />
    </Theme></I18nTestProvider>);
    const badges = page.container.querySelectorAll("[data-unverified-sender-badge]");
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe("Nicht bestätigt");
    expect(badges[0].getAttribute("title")).toBe(TITLE_DE);
    expect(page.getByLabelText(TITLE_DE)).toBe(badges[0] as HTMLElement);
  });

  it("appears in the expanded message header of the reader card", () => {
    const card = (senderVerified: boolean | null | undefined) =>
      <Theme><ThreadMessageCard {...reviewReaderProps()} message={{ ...syntheticReviewMessage, senderVerified }} /></Theme>;
    const view = renderEnglish(card(false));
    expect(view.container.querySelectorAll("[data-unverified-sender-badge]")).toHaveLength(1);
    expect(view.getByText("Unverified")).toBeTruthy();
    for (const value of [true, null, undefined]) {
      view.rerender(card(value));
      expect(view.container.querySelector("[data-unverified-sender-badge]"), String(value)).toBeNull();
    }
  });
});
