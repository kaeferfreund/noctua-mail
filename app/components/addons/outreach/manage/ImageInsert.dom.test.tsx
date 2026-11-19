import { afterEach, describe, expect, it } from "bun:test";
import { act, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { render } from "@/lib/i18n/testRender";
import type { AccountRole } from "@/lib/data";
import { OUTREACH_IMAGE_MAX_BYTES, type OutreachImage } from "@/lib/addons/outreach/types";
import { resetOutreachStatusForTests } from "../useOutreachStatus";
import type { OutreachLocation } from "./location";
import { imageFileRefusal, imageTag } from "./ImageInsertDialog";
import { ACCOUNT_ID, DRAFT, IMAGES, SENT, SEQUENCE, TEMPLATE, json, stubFetch, ManageHarness, type Handler } from "./testFixtures";

afterEach(() => { cleanup(); resetOutreachStatusForTests(); });

const mount = (initial: OutreachLocation, handlers: Handler[] = [], role: AccountRole = "editor") => {
  const stub = stubFetch(handlers);
  const page = render(<ManageHarness role={role} initial={initial} fetchImpl={stub.fetchImpl} />);
  return { ...stub, page };
};

function deferred() {
  let release: (response: Response) => void = () => {};
  const promise = new Promise<Response>(resolve => { release = resolve; });
  return { promise, release };
}

// A role query over the whole editor is slow in happy-dom; the dialog is found by its role attribute.
const openDialogElement = () => document.querySelector("[role=dialog]");
const uploads = (calls: ReturnType<typeof stubFetch>["calls"]) => calls.filter(call => call.method === "POST" && call.path === "images");
const source = (page: ReturnType<typeof mount>["page"]) => page.getByLabelText("HTML source") as HTMLTextAreaElement;
const findSource = async (page: ReturnType<typeof mount>["page"]) => await page.findByLabelText("HTML source") as HTMLTextAreaElement;
const openDialog = async (page: ReturnType<typeof mount>["page"]) => {
  fireEvent.click(await page.findByRole("button", { name: "Insert image" }));
  return within(await page.findByRole("dialog"));
};
const NEW_IMAGE: OutreachImage = {
  id: "img-new", accountId: ACCOUNT_ID, url: `/t/m/${"d4".repeat(32)}.png`, contentType: "image/png", bytes: 1234,
  width: 640, height: 320, filename: "foto.png", createdAt: Date.UTC(2026, 10, 19)
};

describe("Bild einfügen", () => {
  it("lists the mailbox's images newest first and inserts the chosen one at the cursor, then leads to the alt text", async () => {
    const { page } = mount({ section: "templates", id: TEMPLATE.id });
    const area = await findSource(page);
    await waitFor(() => expect(area.value).toBe(TEMPLATE.html));
    const at = TEMPLATE.html.indexOf("<p style=\"font-size:15px");
    area.setSelectionRange(at, at);
    fireEvent.select(area);

    const dialog = await openDialog(page);
    expect(dialog.getByText(/cannot be removed again/)).toBeTruthy();
    const picks = await dialog.findAllByRole("button", { name: /\.(png|jpg|webp)/ });
    expect(picks.map(button => button.textContent)).toEqual(["siegel.webp", "team-foto.jpg800 × 600 px", "kopfzeile.png1,200 × 400 px"]);
    fireEvent.click(picks[1]);

    const team = IMAGES[1];
    const tag = `<img src="${team.url}" alt="" width="600" style="max-width:100%;height:auto">`;
    await waitFor(() => expect(openDialogElement()).toBeNull());
    expect(area.value).toBe(TEMPLATE.html.slice(0, at) + tag + TEMPLATE.html.slice(at));
    // The cursor sits inside alt="" so the user can describe the image right away.
    await waitFor(() => expect(document.activeElement).toBe(area));
    expect(area.selectionStart).toBe(at + `<img src="${team.url}" alt="`.length);
    expect(area.selectionEnd).toBe(area.selectionStart);
    // The live preview renders the source with the root-relative src unchanged.
    await waitFor(() => expect((page.getByTitle("Live preview") as HTMLIFrameElement).getAttribute("srcdoc")).toContain(tag), { timeout: 2000 });
  });

  it("appends at the end of a campaign body that never had a cursor, without width when it is unknown", async () => {
    const { page } = mount({ section: "campaigns", id: DRAFT.id });
    const dialog = await openDialog(page);
    fireEvent.click(await dialog.findByRole("button", { name: /siegel\.webp/ }));
    await waitFor(() => expect(source(page).value).toBe(`${DRAFT.html}<img src="${IMAGES[2].url}" alt="" style="max-width:100%;height:auto">`));
  });

  it("is offered in the HTML editor of a sequence step", async () => {
    const { page } = mount({ section: "sequences", id: SEQUENCE.id }, [
      call => call.method === "GET" && call.path === `sequences/${SEQUENCE.id}` ? json({ ok: true, sequence: { ...SEQUENCE, status: "draft" } }) : undefined
    ]);
    const dialog = await openDialog(page);
    fireEvent.click(await dialog.findByRole("button", { name: /kopfzeile\.png/ }));
    await waitFor(() => expect(source(page).value).toContain(`<img src="${IMAGES[0].url}" alt="" width="600"`));
  });

  it("uploads the file as raw bytes, refuses a second submit while it runs and inserts the server's image", async () => {
    const pending = deferred();
    const { page, calls } = mount({ section: "templates", id: TEMPLATE.id }, [
      call => call.method === "POST" && call.path === "images" ? pending.promise : undefined
    ]);
    await waitFor(() => expect(source(page).value).toBe(TEMPLATE.html));
    const dialog = await openDialog(page);
    const input = dialog.getByLabelText("Image file from device") as HTMLInputElement;
    expect(input.accept).toBe("image/png,image/jpeg,image/gif,image/webp");
    const file = new File([new Uint8Array([137, 80, 78, 71])], "foto.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(uploads(calls)).toHaveLength(1));
    const [call] = uploads(calls);
    expect(call.query.get("filename")).toBe("foto.png");
    expect(call.headers.get("Content-Type")).toBe("application/octet-stream");
    expect(call.body).toBe(file);
    const button = dialog.getByRole("button", { name: "Uploading …" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    for (const pick of dialog.getAllByRole("button", { name: /\.(jpg|webp)/ })) expect((pick as HTMLButtonElement).disabled).toBe(true);
    // A second file while the first is uploading starts no request, and Escape does not close the dialog.
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(uploads(calls)).toHaveLength(1);
    expect(openDialogElement()).not.toBeNull();

    await act(async () => { pending.release(json({ ok: true, image: NEW_IMAGE, created: true })); await pending.promise; });
    await waitFor(() => expect(openDialogElement()).toBeNull());
    expect(source(page).value).toBe(`${TEMPLATE.html}<img src="${NEW_IMAGE.url}" alt="" width="600" style="max-width:100%;height:auto">`);
  });

  it("refuses a too large file and a wrong type before any request", async () => {
    const { page, calls } = mount({ section: "templates", id: TEMPLATE.id });
    const dialog = await openDialog(page);
    const input = dialog.getByLabelText("Image file from device");
    fireEvent.change(input, { target: { files: [new File(["%PDF"], "brief.pdf", { type: "application/pdf" })] } });
    expect((await dialog.findByRole("alert")).textContent).toBe("This file is not a PNG, JPEG, GIF or WebP image.");
    fireEvent.change(input, { target: { files: [new File([new Uint8Array(OUTREACH_IMAGE_MAX_BYTES + 1)], "gross.jpg", { type: "image/jpeg" })] } });
    await waitFor(() => expect(dialog.getByRole("alert").textContent).toBe("The file is larger than 5 MB."));
    expect(uploads(calls)).toHaveLength(0);
  });

  it("shows the server's refusal and keeps the dialog open", async () => {
    let status = 413;
    const { page, calls } = mount({ section: "templates", id: TEMPLATE.id }, [
      call => call.method === "POST" && call.path === "images" ? json({ ok: false, message: "refused" }, status) : undefined
    ]);
    const dialog = await openDialog(page);
    const input = dialog.getByLabelText("Image file from device");
    const file = new File([new Uint8Array([1, 2, 3])], "bild.png", { type: "image/png" });
    fireEvent.change(input, { target: { files: [file] } });
    expect((await dialog.findByRole("alert")).textContent).toBe("The file is too large for the server.");
    status = 415;
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(dialog.getByRole("alert").textContent).toBe("This file type is not accepted."));
    expect(uploads(calls)).toHaveLength(2);
    expect(openDialogElement()).not.toBeNull();
    expect(source(page).value).toBe(TEMPLATE.html);
  });

  it("offers no image control to viewers and on a sent campaign", async () => {
    const viewer = mount({ section: "templates", id: TEMPLATE.id }, [], "viewer");
    await waitFor(() => expect(source(viewer.page).value).toBe(TEMPLATE.html));
    expect(viewer.page.queryByRole("button", { name: "Insert image" })).toBeNull();
    cleanup();
    const sent = mount({ section: "campaigns", id: SENT.id });
    await sent.page.findByText("Rundbrief November");
    expect(sent.page.queryByRole("button", { name: "Insert image" })).toBeNull();
    expect(viewer.calls.concat(sent.calls).some(call => call.path === "images")).toBe(false);
  });
});

describe("image helpers", () => {
  it("accepts the four raster types by type or, without one, by name", () => {
    expect(imageFileRefusal({ name: "a.png", type: "image/png", size: 10 })).toBeNull();
    expect(imageFileRefusal({ name: "a.WEBP", type: "", size: 10 })).toBeNull();
    expect(imageFileRefusal({ name: "a.svg", type: "image/svg+xml", size: 10 })).toBe("type");
    expect(imageFileRefusal({ name: "a.gif", type: "image/gif", size: OUTREACH_IMAGE_MAX_BYTES })).toBeNull();
    expect(imageFileRefusal({ name: "a.gif", type: "image/gif", size: OUTREACH_IMAGE_MAX_BYTES + 1 })).toBe("size");
  });

  it("keeps the server's URL and marks where the alt text goes", () => {
    const { tag, altAt } = imageTag({ url: "/t/m/abc.png", width: null });
    expect(tag).toBe(`<img src="/t/m/abc.png" alt="" style="max-width:100%;height:auto">`);
    expect(tag.slice(altAt, altAt + 1)).toBe("\"");
    expect(tag.slice(altAt - 5, altAt)).toBe("alt=\"");
  });
});
