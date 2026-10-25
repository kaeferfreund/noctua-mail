import { afterEach, describe, expect, it } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import { DomainIconVersionsContext } from "@/app/hooks/useDomainIconVersions";
import SenderIcon from "./SenderIcon";

afterEach(cleanup);

const versions = { "brand.example.test": "abcdef0123456789" };
const srcOf = (from: string) => {
  const view = render(<DomainIconVersionsContext.Provider value={versions}><SenderIcon accountId="mailbox-a" from={from} /></DomainIconVersionsContext.Provider>);
  return new URL(view.container.querySelector("img")!.getAttribute("src")!, "http://localhost");
};

describe("SenderIcon with uploaded domain icons", () => {
  it("adds the upload's version for senders at the domain and its subdomains, so a cached favicon is not reused", () => {
    expect(srcOf("Ada <ada@brand.example.test>").searchParams.get("v")).toBe("abcdef0123456789");
    expect(srcOf("Bo <bo@mail.brand.example.test>").searchParams.get("v")).toBe("abcdef0123456789");
  });

  it("keeps the plain URL for other domains and outside the provider", () => {
    expect(srcOf("Cy <cy@other.example.test>").searchParams.has("v")).toBe(false);
    const view = render(<SenderIcon accountId="mailbox-a" from="Ada <ada@brand.example.test>" />);
    expect(new URL(view.container.querySelector("img")!.getAttribute("src")!, "http://localhost").searchParams.has("v")).toBe(false);
  });
});
